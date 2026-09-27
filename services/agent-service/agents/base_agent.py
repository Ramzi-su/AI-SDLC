import json
import logging
from abc import ABC, abstractmethod
from services.llm_service import llm_service

logger = logging.getLogger(__name__)


class BaseAgent(ABC):
    """Base class for all SDLC agents."""

    def __init__(self, name: str, system_prompt: str):
        self.name = name
        self.system_prompt = system_prompt

    @abstractmethod
    async def execute(self, context: dict, model: str = None, user_feedback: str = None) -> dict:
        pass

    async def ask_llm(self, prompt: str, model: str = None) -> str:
        return await llm_service.generate(
            prompt=prompt,
            model=model,
            system=self.system_prompt
        )

    def parse_json_response(self, raw: str) -> dict:
        try:
            start = raw.find("{")
            end = raw.rfind("}") + 1
            if start == -1:
                start = raw.find("[")
                end = raw.rfind("]") + 1
            if start != -1 and end > start:
                return json.loads(raw[start:end])
        except json.JSONDecodeError:
            logger.warning(f"[{self.name}] Failed to parse JSON, returning raw text")
        return {"raw_response": raw}
