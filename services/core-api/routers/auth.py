import datetime
import logging
import os
import re
import secrets
from urllib.parse import urlencode
import httpx
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from fastapi.responses import JSONResponse, RedirectResponse
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from database import get_db
from models.orm import User, OAuthAccount
from auth import (
    COOKIE_SECURE, MAX_RESET_CODE_ATTEMPTS, RESET_CODE_TTL, VERIFY_TOKEN_TTL, clear_auth_cookies, client_ip,
    consume_reset_code, consume_verification_token, create_user, current_user, email_recently_sent,
    end_all_sessions, end_session, hash_password, issue_reset_code, issue_verification_token,
    login_retry_after, rate_limit_retry_after, record_login_attempt, record_rate_limit_event, refresh_session,
    REGISTER_LIMIT_PER_HOUR, REGISTER_WINDOW, FORGOT_PASSWORD_LIMIT_PER_HOUR, FORGOT_PASSWORD_WINDOW, start_session, verify_password_or_dummy,
)
from mailer import send_email

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/auth", tags=["Auth"])

FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000").rstrip("/")
# Public URL of this API, used to build the OAuth redirect URI registered with each provider.
API_PUBLIC_URL = os.getenv("API_PUBLIC_URL", "http://localhost:8000").rstrip("/")

EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
MIN_PASSWORD_LENGTH = 8
OAUTH_STATE_COOKIE = "sdlc_oauth_state"

PROVIDERS = {
    "google": {
        "client_id": os.getenv("GOOGLE_CLIENT_ID", ""),
        "client_secret": os.getenv("GOOGLE_CLIENT_SECRET", ""),
        "authorize_url": "https://accounts.google.com/o/oauth2/v2/auth",
        "token_url": "https://oauth2.googleapis.com/token",
        "scope": "openid email profile",
    },
    "github": {
        "client_id": os.getenv("GITHUB_CLIENT_ID", ""),
        "client_secret": os.getenv("GITHUB_CLIENT_SECRET", ""),
        "authorize_url": "https://github.com/login/oauth/authorize",
        "token_url": "https://github.com/login/oauth/access_token",
        "scope": "read:user user:email",
    },
}


class RegisterRequest(BaseModel):
    email: str
    password: str
    name: str

class LoginRequest(BaseModel):
    email: str
    password: str

class TokenRequest(BaseModel):
    token: str

class ForgotPasswordRequest(BaseModel):
    email: str

class ResetPasswordRequest(BaseModel):
    email: str
    code: str
    password: str


def _public_user(user: User) -> dict:
    return {"id": user.id, "email": user.email, "name": user.name, "email_verified": user.email_verified_at is not None}

def _safe_next(path: str | None) -> str:
    """Only allow redirects back into this app (a relative path), never to another site."""
    if path and path.startswith("/") and not path.startswith("//") and "\\" not in path:
        return path
    return "/"

def _enabled(provider: str) -> bool:
    config = PROVIDERS.get(provider)
    return bool(config and config["client_id"] and config["client_secret"])


def _hours(delta: datetime.timedelta) -> int:
    return int(delta.total_seconds() // 3600)

async def _send_verification(db: AsyncSession, user: User) -> None:
    token = await issue_verification_token(db, user)
    await send_email(user.email, "Confirm your email for AI-SDLC", f"""Hi {user.name},

Please confirm your email address by opening this link:

{FRONTEND_URL}/verify-email?token={token}

The link expires in {_hours(VERIFY_TOKEN_TTL)} hours. If you didn't create an account, you can ignore this email.
""")

async def _send_password_reset(db: AsyncSession, user: User) -> None:
    code = await issue_reset_code(db, user)
    minutes = int(RESET_CODE_TTL.total_seconds() // 60)
    await send_email(user.email, f"{code} is your AI-SDLC password reset code", f"""Hi {user.name},

Someone (hopefully you) asked to reset your password. Enter this code on the reset page:

    {code}

The code expires in {minutes} minutes and can be used once. Never share it: we will never ask you for it.
If you didn't ask for this, ignore this email: your password stays the same.
""")

def _too_many_attempts(retry_after: int, what: str = "Too many failed attempts") -> HTTPException:
    minutes = max(1, round(retry_after / 60))
    return HTTPException(
        status_code=429,
        detail=f"{what}. Try again in {minutes} minute{'s' if minutes != 1 else ''}.",
        headers={"Retry-After": str(retry_after)},
    )

def _check_password(password: str) -> None:
    if len(password) < MIN_PASSWORD_LENGTH:
        raise HTTPException(status_code=400, detail=f"Password must be at least {MIN_PASSWORD_LENGTH} characters")


# ---------- email + password ----------

@router.post("/register")
async def register(req: RegisterRequest, request: Request, response: Response, db: AsyncSession = Depends(get_db)):
    # Every attempt counts, including invalid ones and "already exists": this limits mass sign-ups,
    # verification emails sent to strangers' inboxes, and probing which emails have accounts.
    ip = client_ip(request)
    retry_after = await rate_limit_retry_after(db, "register", ip, REGISTER_LIMIT_PER_HOUR, REGISTER_WINDOW)
    if retry_after:
        raise _too_many_attempts(retry_after, "Too many sign-ups from your network")
    await record_rate_limit_event(db, "register", ip)

    email = req.email.strip().lower()
    name = req.name.strip()
    if not EMAIL_RE.match(email):
        raise HTTPException(status_code=400, detail="Enter a valid email address")
    _check_password(req.password)
    if not name:
        raise HTTPException(status_code=400, detail="Enter your name")

    existing = (await db.execute(select(User).filter_by(email=email))).scalars().first()
    if existing:
        raise HTTPException(status_code=409, detail="An account with this email already exists. Sign in instead.")

    user = await create_user(db, email, name, hash_password(req.password))
    await start_session(db, user, response)
    try:
        await _send_verification(db, user)
    except Exception:
        # The account exists either way; the user can ask for a new email from the banner.
        logger.exception("Could not send the verification email to %s", user.email)
    return _public_user(user)

@router.post("/login")
async def login(req: LoginRequest, request: Request, response: Response, db: AsyncSession = Depends(get_db)):
    email = req.email.strip().lower()
    ip = client_ip(request)
    # Checked before the password, and applied to unknown emails too, so a lock reveals nothing.
    retry_after = await login_retry_after(db, email, ip)
    if retry_after:
        raise _too_many_attempts(retry_after)

    user = (await db.execute(select(User).filter_by(email=email))).scalars().first()
    ok = verify_password_or_dummy(req.password, user)
    await record_login_attempt(db, email, ip, ok)
    if not ok:
        # Same message whether the email is unknown or the password is wrong.
        raise HTTPException(status_code=401, detail="Wrong email or password")
    await start_session(db, user, response)
    return _public_user(user)

@router.post("/refresh")
async def refresh(request: Request, response: Response, db: AsyncSession = Depends(get_db)):
    user = await refresh_session(db, request, response)
    if not user:
        # Clear the dead cookies on the error response itself, so the browser stops sending them.
        expired = JSONResponse(status_code=401, content={"detail": "Please sign in"})
        clear_auth_cookies(expired)
        return expired
    return _public_user(user)

@router.post("/logout")
async def logout(request: Request, response: Response, db: AsyncSession = Depends(get_db)):
    await end_session(db, request, response)
    return {"status": "signed_out"}

@router.get("/me")
async def me(user: User = Depends(current_user)):
    return _public_user(user)

# ---------- email verification ----------

@router.post("/verify-email")
async def verify_email(req: TokenRequest, db: AsyncSession = Depends(get_db)):
    user = await consume_verification_token(db, req.token)
    if not user:
        raise HTTPException(status_code=400, detail="This link is invalid or has expired. Ask for a new one.")
    if user.email_verified_at is None:
        user.email_verified_at = datetime.datetime.utcnow()
    await db.commit()
    return _public_user(user)

@router.post("/resend-verification")
async def resend_verification(db: AsyncSession = Depends(get_db), user: User = Depends(current_user)):
    if user.email_verified_at is not None:
        return {"status": "already_verified"}
    if await email_recently_sent(db, user, "verify"):
        raise HTTPException(status_code=429, detail="An email was just sent. Please wait a minute before asking again.")
    try:
        await _send_verification(db, user)
    except Exception:
        logger.exception("Could not send the verification email to %s", user.email)
        raise HTTPException(status_code=502, detail="The email could not be sent. Please try again later.")
    return {"status": "sent"}


# ---------- password reset ----------

FORGOT_PASSWORD_REPLY = {"status": "sent", "message": "If an account exists for this email, a reset code is on its way."}

@router.post("/forgot-password")
async def forgot_password(req: ForgotPasswordRequest, request: Request, db: AsyncSession = Depends(get_db)):
    # Per IP, counting every request: stops one sender triggering reset emails to many accounts.
    # The limit applies whatever the email, so hitting it reveals nothing about accounts.
    ip = client_ip(request)
    retry_after = await rate_limit_retry_after(db, "forgot_password", ip, FORGOT_PASSWORD_LIMIT_PER_HOUR, FORGOT_PASSWORD_WINDOW)
    if retry_after:
        raise _too_many_attempts(retry_after, "Too many password reset requests from your network")
    await record_rate_limit_event(db, "forgot_password", ip)

    # Same reply whether or not the email is known, so this can't be used to discover accounts.
    user = (await db.execute(select(User).filter_by(email=req.email.strip().lower()))).scalars().first()
    if user and not await email_recently_sent(db, user, "reset"):
        try:
            await _send_password_reset(db, user)
        except Exception:
            logger.exception("Could not send the password reset email to %s", user.email)
    return FORGOT_PASSWORD_REPLY

@router.post("/reset-password")
async def reset_password(req: ResetPasswordRequest, request: Request, response: Response, db: AsyncSession = Depends(get_db)):
    _check_password(req.password)
    email = req.email.strip().lower()
    ip = client_ip(request)
    # Wrong codes share the sign-in limits, so a 6-digit code can't be guessed by asking for new ones.
    retry_after = await login_retry_after(db, email, ip)
    if retry_after:
        raise _too_many_attempts(retry_after)

    user = (await db.execute(select(User).filter_by(email=email))).scalars().first()
    if not user or not await consume_reset_code(db, user, req.code):
        await record_login_attempt(db, email, ip, False)
        raise HTTPException(
            status_code=400,
            detail=f"This code is wrong or has expired. After {MAX_RESET_CODE_ATTEMPTS} wrong tries, ask for a new code.",
        )
    user.password_hash = hash_password(req.password)
    # Receiving the code proves access to the inbox.
    if user.email_verified_at is None:
        user.email_verified_at = datetime.datetime.utcnow()
    # Whoever knew the old password is signed out everywhere, immediately.
    await end_all_sessions(db, user)
    await db.commit()
    await record_login_attempt(db, email, ip, True)
    await start_session(db, user, response)
    return _public_user(user)


@router.get("/providers")
async def providers():
    return {"providers": [name for name in PROVIDERS if _enabled(name)]}


# ---------- Google / GitHub ----------

@router.get("/oauth/{provider}/start")
async def oauth_start(provider: str, next: str | None = None):
    if not _enabled(provider):
        raise HTTPException(status_code=404, detail=f"Sign-in with {provider} is not configured")
    config = PROVIDERS[provider]
    state = secrets.token_urlsafe(24)
    params = {
        "client_id": config["client_id"],
        "redirect_uri": f"{API_PUBLIC_URL}/api/auth/oauth/{provider}/callback",
        "scope": config["scope"],
        "state": state,
    }
    if provider == "google":
        params["response_type"] = "code"

    redirect = RedirectResponse(f"{config['authorize_url']}?{urlencode(params)}")
    # The state cookie ties the provider's callback to this browser (CSRF protection).
    redirect.set_cookie(
        OAUTH_STATE_COOKIE, f"{state}|{_safe_next(next)}",
        max_age=600, httponly=True, secure=COOKIE_SECURE, samesite="lax", path="/api/auth/oauth",
    )
    return redirect

def _login_error(message: str) -> RedirectResponse:
    return RedirectResponse(f"{FRONTEND_URL}/login?{urlencode({'error': message})}")

async def _fetch_identity(provider: str, code: str) -> dict:
    """Exchanges the code and returns {id, email, email_verified, name} from the provider."""
    config = PROVIDERS[provider]
    async with httpx.AsyncClient(timeout=20.0) as client:
        token_response = await client.post(config["token_url"], headers={"Accept": "application/json"}, data={
            "client_id": config["client_id"],
            "client_secret": config["client_secret"],
            "code": code,
            "redirect_uri": f"{API_PUBLIC_URL}/api/auth/oauth/{provider}/callback",
            "grant_type": "authorization_code",
        })
        token_response.raise_for_status()
        access_token = token_response.json().get("access_token")
        if not access_token:
            raise ValueError("no access token")
        headers = {"Authorization": f"Bearer {access_token}", "Accept": "application/json"}

        if provider == "google":
            info = (await client.get("https://openidconnect.googleapis.com/v1/userinfo", headers=headers)).json()
            return {
                "id": str(info["sub"]),
                "email": (info.get("email") or "").lower(),
                "email_verified": bool(info.get("email_verified")),
                "name": info.get("name") or info.get("email", "").split("@")[0],
            }

        info = (await client.get("https://api.github.com/user", headers=headers)).json()
        emails = (await client.get("https://api.github.com/user/emails", headers=headers)).json()
        primary = next((e for e in emails if e.get("primary") and e.get("verified")), None) if isinstance(emails, list) else None
        return {
            "id": str(info["id"]),
            "email": (primary or {}).get("email", "").lower(),
            "email_verified": primary is not None,
            "name": info.get("name") or info.get("login", ""),
        }

@router.get("/oauth/{provider}/callback")
async def oauth_callback(
    provider: str, request: Request,
    code: str | None = None, state: str | None = None, error: str | None = None,
    db: AsyncSession = Depends(get_db),
):
    if not _enabled(provider):
        return _login_error(f"Sign-in with {provider} is not configured")
    if error or not code:
        return _login_error("Sign-in was cancelled")

    saved_state, _, next_path = (request.cookies.get(OAUTH_STATE_COOKIE) or "").partition("|")
    if not state or not saved_state or not secrets.compare_digest(state, saved_state):
        return _login_error("Sign-in expired, please try again")

    try:
        identity = await _fetch_identity(provider, code)
    except (httpx.HTTPError, ValueError, KeyError):
        return _login_error(f"Could not sign in with {provider}, please try again")

    link = (await db.execute(
        select(OAuthAccount).filter_by(provider=provider, provider_user_id=identity["id"])
    )).scalars().first()
    if link:
        user = await db.get(User, link.user_id)
    else:
        if not identity["email"] or not identity["email_verified"]:
            return _login_error(f"Your {provider} account has no verified email address")
        # Link to an existing account with the same verified email, or create a new one.
        user = (await db.execute(select(User).filter_by(email=identity["email"]))).scalars().first()
        if not user:
            user = await create_user(db, identity["email"], identity["name"] or identity["email"], None, email_verified=True)
        elif user.email_verified_at is None:
            # Someone may have registered this address without owning it, to take over the real
            # owner's account once they sign in with Google/GitHub. The provider proved ownership,
            # so drop that unverified password and its sessions.
            user.password_hash = None
            user.email_verified_at = datetime.datetime.utcnow()
            await end_all_sessions(db, user)
        db.add(OAuthAccount(user_id=user.id, provider=provider, provider_user_id=identity["id"]))
        await db.commit()

    redirect = RedirectResponse(f"{FRONTEND_URL}{_safe_next(next_path)}")
    redirect.delete_cookie(OAUTH_STATE_COOKIE, path="/api/auth/oauth")
    await start_session(db, user, redirect)
    return redirect
