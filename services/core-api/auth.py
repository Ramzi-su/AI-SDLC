import base64
import datetime
import hashlib
import hmac
import logging
import os
import secrets
import uuid
import jwt
from fastapi import Depends, HTTPException, Request, Response
from sqlalchemy import delete, func, text, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from database import get_db
from client_ip import TRUSTED_PROXIES, resolve_client_ip
from models.orm import User, Session, RefreshToken, LoginAttempt, RateLimitEvent, EmailToken, Project, LearningActivity

logger = logging.getLogger(__name__)

# Access tokens are short-lived JWTs; refresh tokens are random, stored hashed and rotated on use.
ACCESS_COOKIE = "sdlc_access"
REFRESH_COOKIE = "sdlc_refresh"
ACCESS_TOKEN_TTL = datetime.timedelta(minutes=15)
SESSION_TTL = datetime.timedelta(days=30)
# Two tabs may refresh with the same token at once; that is not treated as theft.
REFRESH_REUSE_GRACE = datetime.timedelta(seconds=30)
JWT_ALGORITHM = "HS256"
# Set COOKIE_SECURE=true when serving over HTTPS.
COOKIE_SECURE = os.getenv("COOKIE_SECURE", "false").lower() == "true"

JWT_SECRET = os.getenv("JWT_SECRET", "")
if not JWT_SECRET:
    JWT_SECRET = secrets.token_urlsafe(48)
    logger.warning("JWT_SECRET is not set: using a random one, so everyone is signed out when the API restarts.")

# scrypt parameters (N=2^14, r=8, p=1) as recommended for interactive logins.
SCRYPT_N, SCRYPT_R, SCRYPT_P = 2**14, 8, 1


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.scrypt(password.encode(), salt=salt, n=SCRYPT_N, r=SCRYPT_R, p=SCRYPT_P)
    return "$".join([
        "scrypt", str(SCRYPT_N), str(SCRYPT_R), str(SCRYPT_P),
        base64.b64encode(salt).decode(), base64.b64encode(digest).decode(),
    ])


def verify_password(password: str, stored: str | None) -> bool:
    if not stored:
        return False
    try:
        scheme, n, r, p, salt_b64, digest_b64 = stored.split("$")
        if scheme != "scrypt":
            return False
        digest = hashlib.scrypt(
            password.encode(), salt=base64.b64decode(salt_b64), n=int(n), r=int(r), p=int(p)
        )
        return hmac.compare_digest(digest, base64.b64decode(digest_b64))
    except (ValueError, TypeError):
        return False


# A real hash to verify against when the email is unknown, so a login attempt takes the same
# time whether or not the account exists.
_DUMMY_HASH = hash_password(secrets.token_urlsafe(16))


def verify_password_or_dummy(password: str, user: User | None) -> bool:
    ok = verify_password(password, user.password_hash if user else _DUMMY_HASH)
    return ok and user is not None and user.password_hash is not None


def _token_hash(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


# ---------- sessions: JWT access token + rotating refresh token ----------

def _issue_access_token(user: User, session_id: str) -> str:
    now = datetime.datetime.now(datetime.timezone.utc)
    return jwt.encode({
        "type": "access",
        "sub": user.id,
        "sid": session_id,
        "ver": user.session_version,
        "iat": now,
        "exp": now + ACCESS_TOKEN_TTL,
    }, JWT_SECRET, algorithm=JWT_ALGORITHM)


def _set_access_cookie(response: Response, access_token: str) -> None:
    response.set_cookie(
        ACCESS_COOKIE, access_token, max_age=int(ACCESS_TOKEN_TTL.total_seconds()),
        httponly=True, secure=COOKIE_SECURE, samesite="lax", path="/",
    )


async def _new_refresh_token(db: AsyncSession, session: Session, response: Response) -> None:
    token = secrets.token_urlsafe(32)
    db.add(RefreshToken(session_id=session.id, token_hash=_token_hash(token)))
    # Only sent to /api/auth, so ordinary API requests never carry the long-lived token.
    response.set_cookie(
        REFRESH_COOKIE, token, max_age=int(SESSION_TTL.total_seconds()),
        httponly=True, secure=COOKIE_SECURE, samesite="lax", path="/api/auth",
    )


async def start_session(db: AsyncSession, user: User, response: Response) -> None:
    session = Session(user_id=user.id, expires_at=datetime.datetime.utcnow() + SESSION_TTL)
    db.add(session)
    await db.flush()
    await _new_refresh_token(db, session, response)
    await db.commit()
    _set_access_cookie(response, _issue_access_token(user, session.id))


async def refresh_session(db: AsyncSession, request: Request, response: Response) -> User | None:
    """Trades the refresh cookie for a new access token and a new refresh token."""
    token = request.cookies.get(REFRESH_COOKIE)
    if not token:
        return None
    record = (await db.execute(select(RefreshToken).filter_by(token_hash=_token_hash(token)))).scalars().first()
    if not record:
        return None
    session = await db.get(Session, record.session_id)
    now = datetime.datetime.utcnow()
    if not session or session.expires_at < now:
        if session:
            await db.delete(session)
            await db.commit()
        return None
    user = await db.get(User, session.user_id)

    if record.used_at is not None:
        if now - record.used_at <= REFRESH_REUSE_GRACE:
            # A parallel request already rotated this token; its response carries the new refresh
            # cookie, so only hand out an access token here.
            _set_access_cookie(response, _issue_access_token(user, session.id))
            return user
        # An old refresh token came back: it was probably stolen. End the whole session.
        logger.warning("Refresh token reuse detected for user %s; ending session %s", user.id, session.id)
        await db.delete(session)
        await db.commit()
        return None

    record.used_at = now
    session.expires_at = now + SESSION_TTL
    await _new_refresh_token(db, session, response)
    await db.commit()
    _set_access_cookie(response, _issue_access_token(user, session.id))
    return user


def clear_auth_cookies(response: Response) -> None:
    response.delete_cookie(ACCESS_COOKIE, path="/", httponly=True, secure=COOKIE_SECURE, samesite="lax")
    response.delete_cookie(REFRESH_COOKIE, path="/api/auth", httponly=True, secure=COOKIE_SECURE, samesite="lax")


async def end_session(db: AsyncSession, request: Request, response: Response) -> None:
    token = request.cookies.get(REFRESH_COOKIE)
    if token:
        record = (await db.execute(select(RefreshToken).filter_by(token_hash=_token_hash(token)))).scalars().first()
        if record:
            await db.execute(delete(Session).where(Session.id == record.session_id))
            await db.commit()
    clear_auth_cookies(response)


async def end_all_sessions(db: AsyncSession, user: User) -> None:
    """Signs the user out everywhere, immediately: refresh tokens are deleted and the version
    bump makes every access token already handed out invalid. The caller commits."""
    await db.execute(delete(Session).where(Session.user_id == user.id))
    user.session_version = (user.session_version or 0) + 1


async def optional_user(request: Request, db: AsyncSession = Depends(get_db)) -> User | None:
    token = request.cookies.get(ACCESS_COOKIE)
    if not token:
        return None
    try:
        claims = jwt.decode(
            token, JWT_SECRET, algorithms=[JWT_ALGORITHM],
            options={"require": ["exp", "sub", "sid", "ver", "type"]},
        )
    except jwt.InvalidTokenError:
        return None
    if claims["type"] != "access":
        return None
    user = await db.get(User, claims["sub"])
    if not user or user.session_version != claims["ver"]:
        return None
    return user


async def current_user(user: User | None = Depends(optional_user)) -> User:
    if not user:
        raise HTTPException(status_code=401, detail="Please sign in")
    return user


EMAIL_NOT_VERIFIED = "Please confirm your email address to continue."


async def verified_user(user: User = Depends(current_user)) -> User:
    """A signed-in user who has confirmed their email: required for everything but the account itself."""
    if user.email_verified_at is None:
        raise HTTPException(status_code=403, detail=EMAIL_NOT_VERIFIED, headers={"X-Error-Code": "email_not_verified"})
    return user


# ---------- limiting password guessing ----------

LOGIN_WINDOW = datetime.timedelta(minutes=15)
MAX_FAILURES_PER_EMAIL = 5
MAX_FAILURES_PER_IP = 20


async def _retry_after(db: AsyncSession, condition, limit: int, since: datetime.datetime) -> int | None:
    result = await db.execute(
        select(LoginAttempt.created_at)
        .filter(condition, LoginAttempt.success.is_(False), LoginAttempt.created_at > since)
        .order_by(LoginAttempt.created_at.desc())
        .limit(limit)
    )
    failures = [row[0] for row in result.all()]
    if len(failures) < limit:
        return None
    # Blocked until the oldest of the last `limit` failures leaves the window.
    seconds = (failures[-1] + LOGIN_WINDOW - datetime.datetime.utcnow()).total_seconds()
    return max(1, int(seconds))


async def login_retry_after(db: AsyncSession, email: str, ip: str) -> int | None:
    """Seconds until this email/IP may try again, or None if not blocked."""
    now = datetime.datetime.utcnow()
    last_success = await db.scalar(
        select(func.max(LoginAttempt.created_at)).filter(LoginAttempt.email == email, LoginAttempt.success.is_(True))
    )
    # A successful sign-in wipes the slate for that account.
    email_since = max(now - LOGIN_WINDOW, last_success or datetime.datetime.min)
    by_email = await _retry_after(db, LoginAttempt.email == email, MAX_FAILURES_PER_EMAIL, email_since)
    by_ip = await _retry_after(db, LoginAttempt.ip == ip, MAX_FAILURES_PER_IP, now - LOGIN_WINDOW)
    blocked = [s for s in (by_email, by_ip) if s]
    return max(blocked) if blocked else None


async def record_login_attempt(db: AsyncSession, email: str, ip: str, success: bool) -> None:
    db.add(LoginAttempt(email=email, ip=ip, success=success))
    await db.execute(delete(LoginAttempt).where(LoginAttempt.created_at < datetime.datetime.utcnow() - datetime.timedelta(days=1)))
    await db.commit()


# ---------- generic rate limits ----------

REGISTER_WINDOW = datetime.timedelta(hours=1)
# Generous by default: a whole classroom often signs up from one school IP address.
REGISTER_LIMIT_PER_HOUR = int(os.getenv("REGISTER_LIMIT_PER_HOUR", "10"))
FORGOT_PASSWORD_WINDOW = datetime.timedelta(hours=1)
FORGOT_PASSWORD_LIMIT_PER_HOUR = int(os.getenv("FORGOT_PASSWORD_LIMIT_PER_HOUR", "10"))


async def rate_limit_retry_after(db: AsyncSession, action: str, key: str, limit: int, window: datetime.timedelta) -> int | None:
    """Seconds until `key` may do `action` again, or None if under the limit."""
    result = await db.execute(
        select(RateLimitEvent.created_at)
        .filter(RateLimitEvent.action == action, RateLimitEvent.key == key,
                RateLimitEvent.created_at > datetime.datetime.utcnow() - window)
        .order_by(RateLimitEvent.created_at.desc())
        .limit(limit)
    )
    events = [row[0] for row in result.all()]
    if len(events) < limit:
        return None
    return max(1, int((events[-1] + window - datetime.datetime.utcnow()).total_seconds()))


async def record_rate_limit_event(db: AsyncSession, action: str, key: str) -> None:
    db.add(RateLimitEvent(action=action, key=key))
    await db.execute(delete(RateLimitEvent).where(RateLimitEvent.created_at < datetime.datetime.utcnow() - datetime.timedelta(days=1)))
    await db.commit()


def client_ip(request: Request) -> str:
    """The client's address for rate limiting, looking through trusted reverse proxies."""
    # Proxies may send several X-Forwarded-For lines; together they form one chain.
    forwarded_for = ",".join(request.headers.getlist("x-forwarded-for")) or None
    return resolve_client_ip(request.client.host if request.client else None, forwarded_for, TRUSTED_PROXIES)


# ---------- one-time email secrets ----------

VERIFY_TOKEN_TTL = datetime.timedelta(hours=24)
RESET_CODE_TTL = datetime.timedelta(minutes=15)
MAX_RESET_CODE_ATTEMPTS = 5
# Minimum gap between two emails of the same kind to one user.
EMAIL_RESEND_INTERVAL = datetime.timedelta(seconds=60)


async def _revoke_unused(db: AsyncSession, user: User, purpose: str, now: datetime.datetime) -> None:
    await db.execute(
        update(EmailToken)
        .where(EmailToken.user_id == user.id, EmailToken.purpose == purpose, EmailToken.used_at.is_(None))
        .values(used_at=now)
    )


async def issue_verification_token(db: AsyncSession, user: User) -> str:
    """A single-use token for an email verification link; earlier unused links stop working."""
    now = datetime.datetime.utcnow()
    await _revoke_unused(db, user, "verify", now)
    token = secrets.token_urlsafe(32)
    db.add(EmailToken(user_id=user.id, purpose="verify", token_hash=_token_hash(token), expires_at=now + VERIFY_TOKEN_TTL))
    await db.commit()
    return token


def _reset_code_hash(record_id: str, code: str) -> str:
    # Keyed with the server secret: a 6-digit code hashed on its own could be brute-forced from a DB dump.
    return hmac.new(JWT_SECRET.encode(), f"{record_id}:{code}".encode(), hashlib.sha256).hexdigest()


async def issue_reset_code(db: AsyncSession, user: User) -> str:
    """A 6-digit password reset code; any earlier code stops working."""
    now = datetime.datetime.utcnow()
    await _revoke_unused(db, user, "reset", now)
    record_id = str(uuid.uuid4())
    code = f"{secrets.randbelow(10**6):06d}"
    db.add(EmailToken(
        id=record_id, user_id=user.id, purpose="reset",
        token_hash=_reset_code_hash(record_id, code), expires_at=now + RESET_CODE_TTL,
    ))
    await db.commit()
    return code


async def consume_reset_code(db: AsyncSession, user: User, code: str) -> bool:
    """Whether the code is the user's current, unexpired reset code. Wrong guesses count
    against the code, which stops working after too many. The caller commits on success."""
    now = datetime.datetime.utcnow()
    record = (await db.execute(
        select(EmailToken)
        .filter(EmailToken.user_id == user.id, EmailToken.purpose == "reset",
                EmailToken.used_at.is_(None), EmailToken.expires_at > now)
        .order_by(EmailToken.created_at.desc())
    )).scalars().first()
    if not record:
        return False
    if not hmac.compare_digest(record.token_hash, _reset_code_hash(record.id, code.strip())):
        record.attempts += 1
        if record.attempts >= MAX_RESET_CODE_ATTEMPTS:
            record.used_at = now
        await db.commit()
        return False
    record.used_at = now
    return True


async def email_recently_sent(db: AsyncSession, user: User, purpose: str) -> bool:
    since = datetime.datetime.utcnow() - EMAIL_RESEND_INTERVAL
    result = await db.execute(
        select(EmailToken.id).filter(
            EmailToken.user_id == user.id, EmailToken.purpose == purpose, EmailToken.created_at > since,
        ).limit(1)
    )
    return result.first() is not None


async def consume_verification_token(db: AsyncSession, token: str) -> User | None:
    """The token's user if the link is valid, unused and unexpired; it can't be used again."""
    result = await db.execute(select(EmailToken).filter_by(token_hash=_token_hash(token), purpose="verify"))
    record = result.scalars().first()
    now = datetime.datetime.utcnow()
    if not record or record.used_at is not None or record.expires_at < now:
        return None
    record.used_at = now
    return await db.get(User, record.user_id)


async def get_owned_project(db: AsyncSession, project_id: str, user: User) -> Project:
    """The project, if it belongs to the user. Other users' projects look like they don't exist."""
    project = await db.get(Project, project_id)
    if not project or project.owner_id != user.id:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


async def create_user(
    db: AsyncSession, email: str, name: str, password_hash: str | None, email_verified: bool = False,
) -> User:
    """Creates a user. The very first account also takes over data from before accounts existed."""
    # Serialise account creation so two simultaneous first sign-ups can't both claim the old data.
    await db.execute(text("SELECT pg_advisory_xact_lock(4242)"))
    is_first = (await db.execute(select(User.id).limit(1))).first() is None

    user = User(
        email=email, name=name, password_hash=password_hash,
        email_verified_at=datetime.datetime.utcnow() if email_verified else None,
    )
    db.add(user)
    await db.flush()

    if is_first:
        await db.execute(update(Project).where(Project.owner_id.is_(None)).values(owner_id=user.id))
        await db.execute(
            update(LearningActivity).where(LearningActivity.user_id.is_(None)).values(user_id=user.id)
        )
    await db.commit()
    await db.refresh(user)
    return user
