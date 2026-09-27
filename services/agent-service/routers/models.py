import os
import httpx
import json
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from services.llm_service import llm_service

router = APIRouter(prefix="/internal/models", tags=["Internal Models"])
OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://ollama:11434")

class PullRequest(BaseModel):
    model_name: str

@router.get("/catalog")
async def model_catalog():
    """All providers (Ollama, vLLM, OpenAI, Gemini), their status and usable model ids."""
    return await llm_service.catalog()

@router.get("")
async def list_models():
    async with httpx.AsyncClient() as client:
        try:
            res = await client.get(f"{OLLAMA_BASE_URL}/api/tags")
            res.raise_for_status()
            return res.json()
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))

@router.post("/pull")
async def pull_model(req: PullRequest):
    async def stream_generator():
        async with httpx.AsyncClient() as client:
            try:
                async with client.stream("POST", f"{OLLAMA_BASE_URL}/api/pull", json={"name": req.model_name}) as response:
                    response.raise_for_status()
                    async for chunk in response.aiter_bytes():
                        # We just yield the raw chunk which is typically NDJSON
                        yield chunk
            except httpx.HTTPStatusError as e:
                # If model is not found or other API error
                yield json.dumps({"error": f"Ollama API Error: {e.response.status_code}"}).encode('utf-8')
            except Exception as e:
                yield json.dumps({"error": str(e)}).encode('utf-8')

    return StreamingResponse(stream_generator(), media_type="application/x-ndjson")

@router.delete("/{model_name}")
async def delete_model(model_name: str):
    async with httpx.AsyncClient() as client:
        try:
            res = await client.request("DELETE", f"{OLLAMA_BASE_URL}/api/delete", json={"name": model_name})
            res.raise_for_status()
            return {"status": "success", "message": f"Deleted model {model_name}"}
        except httpx.HTTPStatusError as e:
            if e.response.status_code == 404:
                raise HTTPException(status_code=404, detail="Model not found")
            raise HTTPException(status_code=e.response.status_code, detail=str(e))
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))
