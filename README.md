# AI-SDLC

**Draw your website, let AI agents build it page by page, and learn how the code works along the way.**

AI-SDLC is a visual, AI-assisted web development platform. You sketch each page on a canvas (drag components, draw shapes, pick their function and colors), choose your tech stack, and a team of LLM agents turns the design into real code in the framework you picked. Every page is shown to you before moving on: approve it, or ask for a redo with feedback. With **Learning mode** on, each approved page becomes a lesson, a quiz and hands-on coding challenges about the code that was just written for you.

## Features

### Build
- **Guided wizard:** describe the project → pick the stack (frontend, backend, database, architecture) → build the pages → pick the design system → generate.
- **Visual canvas** per page:
  - Drag and drop 100 ready-made components (navbar, hero, search bar, pricing, forms, charts…), then move, resize and style them.
  - Freehand drawing, rectangles and ellipses, with undo/redo and an eraser. A drawn shape can be given a function (button, search bar…) and a color, and the AI reproduces its outline.
- **Page-by-page generation loop:** the AI generates one page at a time in your chosen framework, with a live preview. **Approve** to continue to the next page, or **Redo** with feedback. Approved pages are given to the AI as context so the whole site stays consistent.
- **Autosave:** projects, canvas and progress are saved to PostgreSQL and can be reopened from the home page.

### Learn
- **Learning mode** (a checkbox per project): after each approved page, study it before building the next one. Turn it off to just build.
- **Lessons** that walk through the real code of your page, adapted to your level.
- **Ask the tutor:** a chat that knows your page's code.
- **Quizzes** generated from your code, or from any topic.
- **Challenges** with a code editor, live preview and AI grading: *complete the missing code*, *modify the page*, *build from scratch*. They earn points.
- A standalone **/learn** area to practice without a project.

### Accounts and security
- Email + password sign-up, plus optional Google / GitHub sign-in.
- Mandatory email verification; password reset with a 6-digit code.
- JWT access tokens (15 min) and rotating refresh tokens with reuse detection, in HTTP-only cookies.
- Rate limits on sign-in (per account and per IP), sign-up and password reset, with correct client IPs behind trusted reverse proxies.
- Each user only sees their own projects and learning progress.

## Architecture

```
Browser ──▶ frontend (Next.js, :3000)
               │  REST + session cookies
               ▼
            core-api (FastAPI, :8000) ── PostgreSQL + pgvector (:5432)
               │  internal HTTP            Redis (:6379)
               ▼
            agent-service (FastAPI, :8001) ──▶ Ollama (:11434, GPU), vLLM, OpenAI or Gemini
```

| Service | Role |
|---|---|
| `frontend/` | Next.js 16 + React 19 + Zustand: wizard, canvas, page builder, learning UI, account pages |
| `services/core-api/` | Public API: accounts and sessions, projects, page generation loop, learning activities and points, rate limiting |
| `services/agent-service/` | LLM agents: framework, components, style, page generator, learning (lessons, quizzes, challenges, grading) |
| PostgreSQL (pgvector) | Projects, users, sessions, learning progress, component embeddings |
| Ollama | Local LLMs (default `codellama:7b`), GPU-accelerated |
| vLLM (optional) | Fast local serving of Hugging Face models, via `podman-compose.vllm.yml` |

## Getting started

### Requirements
- [Podman](https://podman.io/) with `podman-compose` (Docker Compose works too)
- An NVIDIA GPU with the container toolkit for Ollama (or remove the `devices` section of the `ollama` service to run on CPU, much slower)

### Run
```bash
cp .env.example .env
# At minimum, set a JWT secret:
#   JWT_SECRET=$(openssl rand -base64 48)
podman-compose up --build
```

Then:
1. Pull a model: open **http://localhost:3000/settings** after signing in, or run
   `podman exec -it <ollama container> ollama pull codellama:7b`.
2. Open **http://localhost:3000** and create an account.
3. Confirm your email. Without SMTP configured, the confirmation link is printed in the core-api log:
   ```bash
   podman logs <core-api container> 2>&1 | grep verify-email
   ```

The first account to register takes ownership of any projects created before accounts existed.

### LLM providers

Pick the model per project (or on `/learn`) from one list grouped by provider. The lists are live: whatever your Ollama, vLLM server or cloud account offers appears automatically; providers that aren't set up are shown greyed out with the reason. Their status is also on the **Settings** page.

| Provider | Setup |
|---|---|
| **Ollama** (default) | Runs in the stack. Pull models from Settings. |
| **vLLM** | Start with the override file and point the agent-service at it:<br>`VLLM_BASE_URL=http://vllm:8000/v1` in `.env`, then<br>`podman-compose -f podman-compose.yml -f podman-compose.vllm.yml up --build`<br>Also works with any OpenAI-compatible server (LM Studio, llama.cpp server…) by setting `VLLM_BASE_URL` to it. |
| **OpenAI** | `OPENAI_API_KEY` |
| **Google Gemini** | `GEMINI_API_KEY` |

vLLM reserves most of the GPU's memory when it starts. On a single small GPU, don't use Ollama models while vLLM runs (or lower `VLLM_GPU_MEMORY_UTILIZATION`). The default vLLM model, `Qwen/Qwen2.5-Coder-1.5B-Instruct-AWQ`, fits in 4 GB; choose a bigger one with `VLLM_MODEL` if your GPU allows.

> **Model quality matters.** Small local models like `codellama:7b` often fail to produce valid pages, lessons or grades (the app shows a clear error and lets you retry). Use a larger local model or a cloud model for good results.

## Configuration

All settings are environment variables; see [`.env.example`](.env.example).

| Variable | Default | Purpose |
|---|---|---|
| `JWT_SECRET` | random at startup | Signs session tokens. **Set it**, or everyone is signed out on each restart. |
| `FRONTEND_URL` / `API_PUBLIC_URL` | `http://localhost:3000` / `:8000` | Public URLs, used in emails and OAuth redirects |
| `COOKIE_SECURE` | `false` | Set `true` when served over HTTPS |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM`, `SMTP_SECURITY` | unset | Outgoing email. Without it, emails are written to the core-api log. |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | unset | Enables "Continue with Google". Redirect URI: `<API_PUBLIC_URL>/api/auth/oauth/google/callback` |
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` | unset | Enables "Continue with GitHub". Redirect URI: `<API_PUBLIC_URL>/api/auth/oauth/github/callback` |
| `TRUSTED_PROXIES` | empty | IPs/CIDRs of your reverse proxies, so rate limits see real client IPs. Leave empty if none. |
| `REGISTER_LIMIT_PER_HOUR` | `10` | Sign-up attempts per IP per hour |
| `FORGOT_PASSWORD_LIMIT_PER_HOUR` | `10` | Password reset requests per IP per hour |
| `OLLAMA_DEFAULT_MODEL` | `codellama:7b` | Default local model |
| `GEMINI_API_KEY` / `OPENAI_API_KEY` | unset | Enables Gemini / OpenAI models (listed from your account) |
| `VLLM_BASE_URL` / `VLLM_API_KEY` | unset | An OpenAI-compatible server: the bundled vLLM (`http://vllm:8000/v1`) or another one |
| `VLLM_MODEL`, `VLLM_GPU_MEMORY_UTILIZATION`, `VLLM_MAX_MODEL_LEN`, `VLLM_DTYPE`, `HF_TOKEN` | see `.env.example` | Settings of the bundled vLLM service |

Database tables and new columns are created automatically when the core-api starts; there are no manual migrations.

## Project structure

```
.
├── frontend/                  Next.js app
│   ├── app/                   Routes: /, /project/new, /project/[id], /learn, /login, /register, ...
│   ├── components/wizard/     Wizard steps, canvas, page builder
│   ├── components/learn/      Lessons, tutor chat, quizzes, challenges
│   ├── components/auth/       Sign-in forms, route guard, email verification
│   ├── lib/                   API client, sketch geometry, persistence
│   └── store/                 Zustand stores (project, auth)
├── services/
│   ├── core-api/              FastAPI: auth.py, client_ip.py, mailer.py, routers/, models/
│   └── agent-service/         FastAPI: agents/ (framework, component, style, page, learning), routers/
├── podman-compose.yml
├── podman-compose.vllm.yml    Optional vLLM service
└── .env.example
```

## Security notes for deployment

- Serve over HTTPS and set `COOKIE_SECURE=true`, `FRONTEND_URL`, `API_PUBLIC_URL` and a strong `JWT_SECRET`.
- The allowed frontend origin for CORS is set in `services/core-api/main.py` (currently `localhost:3000`); update it for your domain.
- Behind a reverse proxy, set `TRUSTED_PROXIES`, and make sure the proxy itself sees real client IPs.

## License

AI-SDLC is free software, licensed under the **GNU Affero General Public License v3.0** ([`LICENSE`](LICENSE)).

You may use, modify and redistribute it. If you distribute a modified version, **or run a modified version as a network service that others use**, you must make its complete source code available under the same license.

Copyright (C) 2026 AI-SDLC contributors
