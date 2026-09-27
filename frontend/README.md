# AI-SDLC frontend

The web app of [AI-SDLC](../README.md): project wizard, visual canvas, page-by-page builder, learning area and account pages.

Built with **Next.js 16** (App Router), **React 19** and **Zustand**. It talks only to the [core-api](../services/core-api/README.md).

> This Next.js version has breaking changes from older releases. Check `node_modules/next/dist/docs/` before relying on APIs from memory (see `AGENTS.md`).

## Run

Normally the whole stack runs with `podman-compose up --build` from the repository root. To run only the frontend against a running core-api:

```bash
npm install
NEXT_PUBLIC_API_URL=http://localhost:8000 npm run dev   # http://localhost:3000
```

| Script | |
|---|---|
| `npm run dev` | Development server |
| `npm run build` | Production build (also type-checks) |
| `npm run lint` | ESLint |

The core-api only accepts requests from `http://localhost:3000` (CORS), so keep that port in development.

## Routes

| Route | Page |
|---|---|
| `/` | Landing page, your projects |
| `/project/new` | New project wizard |
| `/project/[id]` | Reopen a saved project where you left it |
| `/learn` | Standalone learning: tutor, quizzes, challenges |
| `/settings` | Manage local Ollama models |
| `/login`, `/register` | Sign in / create an account (email + password, Google, GitHub) |
| `/verify-email` | Target of the email confirmation link |
| `/forgot-password` | Password reset with a 6-digit code |

Every route except the landing and account pages requires a signed-in user with a confirmed email (`components/auth/RequireAuth.tsx`).

## Code map

```
app/                     Routes (see above)
components/
  wizard/                ProjectWizard (steps + autosave), ComponentStep (canvas: drag & drop,
                         draw, rectangle, ellipse, eraser, undo/redo), ComponentEditor,
                         PageBuildStep (generate → preview → approve / redo), palette.ts
  learn/                 LearnPanel with LessonView, TutorChat, QuizView, ChallengeView; PointsBadge
  auth/                  AuthForm, RequireAuth, VerifyEmailGate, UserMenu, password reset
  ProjectList.tsx        Saved projects on the home page
lib/
  api.ts                 Typed API client: session cookies, silent token refresh and retry
  sketch.ts              Freehand/shape geometry: simplification, paths, hit-testing
  projectPersistence.ts  What is saved to the server and how a project is restored
store/
  projectStore.ts        Wizard, canvas (with undo/redo history) and page generation state
  authStore.ts           Signed-in user and session status
```

## How sessions work here

The API sets HTTP-only cookies, so the frontend never sees tokens. `lib/api.ts` sends them with `credentials: 'include'`. When a request gets a 401 because the 15-minute access token expired, it calls `/api/auth/refresh` once (shared between concurrent requests) and retries. If that fails, the user is sent to sign in.
