import httpx
import json
import logging
from typing import AsyncGenerator
from core.config import get_settings

logger = logging.getLogger(__name__)

OLLAMA_GENERATE_ENDPOINT = "/api/generate"
OLLAMA_CHAT_ENDPOINT = "/api/chat"
OLLAMA_TAGS_ENDPOINT = "/api/tags"
OLLAMA_PULL_ENDPOINT = "/api/pull"
OLLAMA_DELETE_ENDPOINT = "/api/delete"


class LLMService:
    def __init__(self):
        self.settings = get_settings()
        self.base_url = self.settings.ollama_base_url

    async def generate(self, prompt: str, model: str = None, system: str = None) -> str:
        model = model or self.settings.ollama_default_model
        
        if model.startswith("gemini"):
            api_key = self.settings.gemini_api_key
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"
            payload = {
                "contents": [{"parts": [{"text": (f"System: {system}\n\n" if system else "") + prompt}]}]
            }
            try:
                async with httpx.AsyncClient(timeout=600.0) as client:
                    response = await client.post(url, json=payload)
                    response.raise_for_status()
                    data = response.json()
                    return data["candidates"][0]["content"]["parts"][0]["text"]
            except httpx.HTTPError as e:
                logger.error(f"Gemini request failed: {e}")
                raise

        if model.startswith("gpt"):
            api_key = self.settings.openai_api_key
            url = "https://api.openai.com/v1/chat/completions"
            messages = []
            if system:
                messages.append({"role": "system", "content": system})
            messages.append({"role": "user", "content": prompt})
            payload = {
                "model": model,
                "messages": messages
            }
            try:
                async with httpx.AsyncClient(timeout=600.0) as client:
                    response = await client.post(url, headers={"Authorization": f"Bearer {api_key}"}, json=payload)
                    response.raise_for_status()
                    data = response.json()
                    return data["choices"][0]["message"]["content"]
            except httpx.HTTPError as e:
                logger.error(f"OpenAI request failed: {e}")
                raise

        payload = {
            "model": model,
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
