import asyncio
import httpx
import json
import logging
import re
import time
from typing import AsyncGenerator
from core.config import get_settings

logger = logging.getLogger(__name__)

OLLAMA_GENERATE_ENDPOINT = "/api/generate"
OLLAMA_CHAT_ENDPOINT = "/api/chat"
OLLAMA_TAGS_ENDPOINT = "/api/tags"
OLLAMA_PULL_ENDPOINT = "/api/pull"
OLLAMA_DELETE_ENDPOINT = "/api/delete"


GEMINI_API = "https://generativelanguage.googleapis.com/v1beta"
OPENAI_API = "https://api.openai.com/v1"

# Model ids are "provider:model" for these providers; anything else is an Ollama model
# (Ollama names can contain ":" too, e.g. "codellama:7b").
PREFIXED_PROVIDERS = ("openai", "gemini", "vllm")

# Cloud model lists change rarely; don't ask the providers on every page load.
CATALOG_CACHE_SECONDS = 300

# Entries of OpenAI's /models that can't be used for chat completions.
OPENAI_EXCLUDED = ("audio", "realtime", "tts", "transcribe", "image", "search", "instruct", "embedding",
                   "moderation", "codex", "computer-use", "deep-research")
GEMINI_EXCLUDED = ("embedding", "image", "tts", "live", "audio", "aqa")


def _status(error: Exception) -> str:
    """A short, secret-free description of a failed request (no URLs or keys)."""
    if isinstance(error, httpx.HTTPStatusError):
        return f"HTTP {error.response.status_code}"
    return type(error).__name__


class LLMNotConfiguredError(Exception):
    """A provider was requested but is not set up; the message says how to fix it."""


def parse_model(model: str) -> tuple[str, str]:
    """(provider, model name) from a model id."""
    head, sep, rest = model.partition(":")
    if sep and head in PREFIXED_PROVIDERS and rest:
        return head, rest
    # Ids saved before provider prefixes existed.
    if model.startswith("gemini"):
        return "gemini", model
    if model.startswith("gpt"):
        return "openai", model
    return "ollama", model


class LLMService:
    def __init__(self):
        self.settings = get_settings()
        self.base_url = self.settings.ollama_base_url
        self._catalog_cache: dict[str, tuple[float, dict]] = {}

    async def generate(self, prompt: str, model: str = None, system: str = None) -> str:
        provider, name = parse_model(model or self.settings.ollama_default_model)

        if provider == "gemini":
            return await self._gemini_generate(name, prompt, system)
        if provider == "openai":
            if not self.settings.openai_api_key:
                raise LLMNotConfiguredError("OpenAI is not configured: set OPENAI_API_KEY.")
            return await self._openai_compatible_chat(OPENAI_API, self.settings.openai_api_key, name, prompt, system, "OpenAI")
        if provider == "vllm":
            if not self.settings.vllm_base_url:
                raise LLMNotConfiguredError("vLLM is not configured: set VLLM_BASE_URL.")
            return await self._openai_compatible_chat(
                self.settings.vllm_base_url.rstrip("/"), self.settings.vllm_api_key, name, prompt, system, "vLLM",
            )

        payload = {
            "model": name,
            "prompt": prompt,
            "stream": False,
            "options": {
                "temperature": 0.7,
                "num_predict": 4096,
            }
        }
        if system:
            payload["system"] = system

        try:
            async with httpx.AsyncClient(timeout=600.0) as client:
                response = await client.post(
                    f"{self.base_url}{OLLAMA_GENERATE_ENDPOINT}",
                    json=payload
                )
                response.raise_for_status()
                return response.json().get("response", "")
        except httpx.HTTPError as e:
            logger.error(f"LLM request failed: {e}")
            raise

    async def _gemini_generate(self, model: str, prompt: str, system: str | None) -> str:
        if not self.settings.gemini_api_key:
            raise LLMNotConfiguredError("Gemini is not configured: set GEMINI_API_KEY.")
        payload = {"contents": [{"role": "user", "parts": [{"text": prompt}]}]}
        if system:
            payload["systemInstruction"] = {"parts": [{"text": system}]}
        try:
            async with httpx.AsyncClient(timeout=600.0) as client:
                # The key goes in a header, not the URL, so it never ends up in logged errors.
                response = await client.post(
                    f"{GEMINI_API}/models/{model}:generateContent",
                    headers={"x-goog-api-key": self.settings.gemini_api_key},
                    json=payload,
                )
                response.raise_for_status()
                data = response.json()
                return "".join(part.get("text", "") for part in data["candidates"][0]["content"]["parts"])
        except httpx.HTTPError as e:
            logger.error(f"Gemini request failed: {e}")
            raise

    async def _openai_compatible_chat(
        self, base_url: str, api_key: str, model: str, prompt: str, system: str | None, label: str,
    ) -> str:
        """Chat completion against OpenAI or any server with the same API (vLLM, LM Studio, llama.cpp...)."""
        messages = []
        if system:
            messages.append({"role": "system", "content": system})
        messages.append({"role": "user", "content": prompt})
        headers = {"Authorization": f"Bearer {api_key}"} if api_key else {}
        try:
            async with httpx.AsyncClient(timeout=600.0) as client:
                response = await client.post(
                    f"{base_url}/chat/completions", headers=headers, json={"model": model, "messages": messages},
                )
                response.raise_for_status()
                return response.json()["choices"][0]["message"]["content"] or ""
        except httpx.HTTPError as e:
            logger.error(f"{label} request failed: {e}")
            raise

    # ---------- model catalog ----------

    async def catalog(self) -> dict:
        """Every provider, whether it is usable, and the models it offers, as model ids for generate()."""
        providers = await asyncio.gather(
            self._ollama_catalog(),
            self._cached("vllm", self._vllm_catalog),
            self._cached("openai", self._openai_catalog),
            self._cached("gemini", self._gemini_catalog),
        )
        return {"providers": list(providers), "default_model": self.settings.ollama_default_model}

    async def _cached(self, key: str, loader) -> dict:
        cached = self._catalog_cache.get(key)
        if cached and time.monotonic() - cached[0] < CATALOG_CACHE_SECONDS:
            return cached[1]
        result = await loader()
        # Don't keep failures around; the next load retries.
        if result["available"] or not result["configured"]:
            self._catalog_cache[key] = (time.monotonic(), result)
        return result

    @staticmethod
    def _provider(id: str, label: str, configured: bool, models: list[dict] | None = None, error: str | None = None) -> dict:
        return {
            "id": id, "label": label, "configured": configured,
            "available": configured and error is None, "error": error, "models": models or [],
        }

    async def _ollama_catalog(self) -> dict:
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(f"{self.base_url}{OLLAMA_TAGS_ENDPOINT}")
                response.raise_for_status()
            models = [{"id": m["name"], "label": m["name"]} for m in response.json().get("models", [])]
            return self._provider("ollama", "Ollama (local)", True, models)
        except (httpx.HTTPError, ValueError, KeyError) as e:
            return self._provider("ollama", "Ollama (local)", True, error=f"Ollama is not reachable ({type(e).__name__})")

    async def _vllm_catalog(self) -> dict:
        base_url = self.settings.vllm_base_url.rstrip("/")
        if not base_url:
            return self._provider("vllm", "vLLM", False, error="Set VLLM_BASE_URL to use a vLLM (or other OpenAI-compatible) server.")
        headers = {"Authorization": f"Bearer {self.settings.vllm_api_key}"} if self.settings.vllm_api_key else {}
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(f"{base_url}/models", headers=headers)
                response.raise_for_status()
            models = [{"id": f"vllm:{m['id']}", "label": m["id"]} for m in response.json().get("data", [])]
            return self._provider("vllm", "vLLM", True, models)
        except (httpx.HTTPError, ValueError, KeyError) as e:
            return self._provider("vllm", "vLLM", True, error=f"vLLM server at {base_url} is not reachable ({type(e).__name__})")

    async def _openai_catalog(self) -> dict:
        if not self.settings.openai_api_key:
            return self._provider("openai", "OpenAI", False, error="Set OPENAI_API_KEY to use OpenAI models.")
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                response = await client.get(
                    f"{OPENAI_API}/models", headers={"Authorization": f"Bearer {self.settings.openai_api_key}"},
                )
                response.raise_for_status()
            ids = sorted(
                (m["id"] for m in response.json().get("data", [])
                 if (m["id"].startswith(("gpt-", "chatgpt-")) or re.match(r"^o\d", m["id"]))
                 and not any(word in m["id"] for word in OPENAI_EXCLUDED)),
                reverse=True,
            )
            return self._provider("openai", "OpenAI", True, [{"id": f"openai:{i}", "label": i} for i in ids])
        except (httpx.HTTPError, ValueError, KeyError) as e:
            return self._provider("openai", "OpenAI", True, error=f"Could not list OpenAI models ({_status(e)})")

    async def _gemini_catalog(self) -> dict:
        if not self.settings.gemini_api_key:
            return self._provider("gemini", "Google Gemini", False, error="Set GEMINI_API_KEY to use Gemini models.")
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                response = await client.get(
                    f"{GEMINI_API}/models", params={"pageSize": 1000},
                    headers={"x-goog-api-key": self.settings.gemini_api_key},
                )
                response.raise_for_status()
            models = []
            for m in response.json().get("models", []):
                name = m.get("name", "").removeprefix("models/")
                if ("gemini" in name and "generateContent" in m.get("supportedGenerationMethods", [])
                        and not any(word in name for word in GEMINI_EXCLUDED)):
                    models.append({"id": f"gemini:{name}", "label": m.get("displayName") or name})
            models.sort(key=lambda m: m["id"], reverse=True)
            return self._provider("gemini", "Google Gemini", True, models)
        except (httpx.HTTPError, ValueError, KeyError) as e:
            return self._provider("gemini", "Google Gemini", True, error=f"Could not list Gemini models ({_status(e)})")

    async def generate_stream(self, prompt: str, model: str = None, system: str = None) -> AsyncGenerator[str, None]:
        model = model or self.settings.ollama_default_model
        payload = {
            "model": model,
            "prompt": prompt,
            "stream": True,
            "options": {
                "temperature": 0.7,
                "num_predict": 4096,
            }
        }
        if system:
            payload["system"] = system

        try:
            async with httpx.AsyncClient(timeout=600.0) as client:
                async with client.stream(
                    "POST",
                    f"{self.base_url}{OLLAMA_GENERATE_ENDPOINT}",
                    json=payload
                ) as response:
                    response.raise_for_status()
                    async for line in response.aiter_lines():
                        if line:
                            data = json.loads(line)
                            token = data.get("response", "")
                            if token:
                                yield token
                            if data.get("done", False):
                                break
        except httpx.HTTPError as e:
            logger.error(f"LLM stream failed: {e}")
            raise

    async def list_models(self) -> list[dict]:
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.get(f"{self.base_url}{OLLAMA_TAGS_ENDPOINT}")
                response.raise_for_status()
                return response.json().get("models", [])
        except httpx.HTTPError as e:
            logger.error(f"Failed to list models: {e}")
            return []

    async def pull_model(self, model_name: str) -> AsyncGenerator[str, None]:
        try:
            async with httpx.AsyncClient(timeout=600.0) as client:
                async with client.stream(
                    "POST",
                    f"{self.base_url}{OLLAMA_PULL_ENDPOINT}",
                    json={"name": model_name}
                ) as response:
                    response.raise_for_status()
                    async for line in response.aiter_lines():
                        if line:
                            yield line
        except httpx.HTTPError as e:
            logger.error(f"Failed to pull model: {e}")
            raise

    async def delete_model(self, model_name: str) -> bool:
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.delete(
                    f"{self.base_url}{OLLAMA_DELETE_ENDPOINT}",
                    json={"name": model_name}
                )
                return response.status_code == 200
        except httpx.HTTPError as e:
            logger.error(f"Failed to delete model: {e}")
            return False


llm_service = LLMService()
