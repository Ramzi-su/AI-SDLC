from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    app_name: str = "AI-SDLC Agent"
    backend_host: str = "0.0.0.0"
    backend_port: int = 8000
    ollama_base_url: str = "http://localhost:11434"
    ollama_default_model: str = "codellama:7b"
    gemini_api_key: str = ""
    openai_api_key: str = ""
    # Any OpenAI-compatible server (vLLM, LM Studio, llama.cpp...), e.g. http://vllm:8000/v1
    vllm_base_url: str = ""
    vllm_api_key: str = ""

    class Config:
        env_file = ".env"


@lru_cache()
def get_settings() -> Settings:
    return Settings()
