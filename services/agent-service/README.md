# AI-SDLC agent-service

The LLM agents of [AI-SDLC](../../README.md), built with **FastAPI**. It is **internal**: only the [core-api](../core-api/README.md) calls it, and it has no authentication of its own, so don't expose port 8001 publicly.

## Models

`services/llm_service.py` picks the provider from the model id, `provider:model`:

| Model id | Provider | Needs |
|---|---|---|
| `openai:<model>` | OpenAI API | `OPENAI_API_KEY` |
| `gemini:<model>` | Google Gemini API | `GEMINI_API_KEY` |
| `vllm:<model>` | vLLM or any OpenAI-compatible server | `VLLM_BASE_URL` (+ `VLLM_API_KEY` if it requires one) |
| anything else (e.g. `codellama:7b`) | Ollama (`OLLAMA_BASE_URL`) | the model pulled in Ollama |

Ids saved before prefixes existed (`gpt-4o`, `gemini-1.5-pro`) still work. `GET /internal/models/catalog` lists every provider, whether it is usable (and why not), and its models: live from Ollama's `/api/tags`, the server's `/models` for vLLM, and your OpenAI / Gemini account (filtered to text chat models, cached 5 minutes). API keys are sent in headers only, never in URLs or logs.

The default is `OLLAMA_DEFAULT_MODEL` (`codellama:7b`). Small models often produce output the agents can't use; the agents then fall back to a template or return a clear error so the user can retry or pick a stronger model.

## Agents

| Agent | Job |
|---|---|
| `framework_agent.py` | Recommends the tech stack, respecting the user's preferences |
| `component_agent.py` | Suggests a page layout and UI components for the project |
| `style_agent.py` | Generates the color palette and typography tokens |
| `page_agent.py` | Turns one drawn page (positions, sizes, texts, colors, freehand outlines) into code in the chosen framework, plus a standalone HTML preview, consistent with already approved pages; redo takes the user's feedback |
| `learning_agent.py` | Lessons, tutor answers, quizzes, the three challenge types, and grading |
| `generator_agent.py` | Legacy one-shot generator; its template is the page agent's fallback |

Output format rule: agents never ask the model to put code inside JSON (small models break it). Pages come back as `===FILE: …===` blocks; lessons point to line numbers and the server cuts the real excerpts; "complete the code" challenges get line ranges and the server removes them.

## Endpoints (internal)

| Endpoint | |
|---|---|
| `POST /internal/run` | Run a wizard agent (framework, components, style, generate) |
| `POST /internal/generate-page` | Generate or regenerate one page |
| `POST /internal/learn/{lesson,ask,quiz,challenge,grade}` | Learning content and grading |
| `POST /internal/embed-components` | Store component embeddings (pgvector), in the background |
| `GET /internal/models/catalog` | All providers and their models |
| `/internal/models` | List, pull, delete Ollama models |
| `GET /api/health` | Health check |

## Run

With the whole stack: `podman-compose up --build` from the repository root (port 8001, `--reload`).
