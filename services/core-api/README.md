# AI-SDLC core-api

The public API of [AI-SDLC](../../README.md), built with **FastAPI**, **SQLAlchemy (async)** and **PostgreSQL + pgvector**. It owns accounts, sessions, projects and learning progress, and forwards AI work to the [agent-service](../agent-service/README.md).

Interactive API docs: **http://localhost:8000/docs** when running.

## Run

With the whole stack: `podman-compose up --build` from the repository root. The container runs:

```bash
uvicorn main:app --host 0.0.0.0 --port 8000 --reload --no-proxy-headers
```

`--no-proxy-headers` is intentional: client IPs behind reverse proxies are resolved by the app itself (`client_ip.py`, `TRUSTED_PROXIES`), in one place.

Tables and new columns are created on startup (`database.py`); there are no manual migrations. See the root README for all environment variables.

## Endpoints

| Prefix | Purpose | Access |
|---|---|---|
| `/api/auth` | Register, login, refresh, logout, `me`, email verification, password reset by code, Google/GitHub OAuth | Public or signed in |
| `/api/projects` | Create, list, open, autosave (`PUT /{id}/state`), delete | Verified owner |
| `/api/agent` | Run the wizard agents, confirm steps, page loop (`/pages/generate`, `/pages/approve`) | Verified owner |
| `/api/learn` | Lessons, tutor, quizzes, challenges and grading, activity history, points | Verified user |
| `/api/models` | Model catalog of all providers (`/catalog`); list, pull and delete Ollama models | Verified user |
| `/api/health` | Health check | Public |

"Verified" means signed in with a confirmed email (`verified_user` in `auth.py`); unverified users get `403` with `X-Error-Code: email_not_verified`. Another user's project answers `404`, as if it didn't exist.

## Security design

- **Passwords:** scrypt (`hashlib`), constant-time comparison, and the same response time for unknown emails.
- **Sessions:** a 15-minute JWT access token (HS256, `JWT_SECRET`) in an HTTP-only cookie, and a refresh token (random, stored as a SHA-256 hash, cookie limited to `/api/auth`) rotated on every use. Reusing an old refresh token ends the session. A per-user `session_version` in the JWT signs a user out everywhere instantly (password reset).
- **Email secrets:** verification links (24 h) and 6-digit reset codes (15 min, 5 tries, HMAC-hashed), single-use; a new one cancels the previous one.
- **Rate limits:** sign-in (5 failures per account / 20 per IP per 15 min, shared with reset codes), sign-up and forgot-password (per IP per hour, configurable).
- **OAuth:** state cookie against CSRF, redirects only within the app, and an unverified account with the same email is secured before linking (prevents pre-registration takeover).

## Files

```
main.py            App, CORS, routers
auth.py            Passwords, JWT sessions, refresh rotation, rate limits, email tokens, ownership checks
client_ip.py       Real client IP behind trusted proxies
mailer.py          SMTP email (logged instead when SMTP_HOST is unset)
database.py        Engine, sessions, startup schema updates
models/orm.py      Tables: users, sessions, refresh_tokens, oauth_accounts, email_tokens,
                   login_attempts, rate_limit_events, projects, learning_activities, component_embeddings
models/schemas.py  Request/response models
routers/           auth, project, agent, learn, models
```
