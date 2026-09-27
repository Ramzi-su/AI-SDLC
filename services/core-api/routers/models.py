import os
import httpx
from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from auth import verified_user

router = APIRouter(prefix="/api/models", tags=["Models"], dependencies=[Depends(verified_user)])
AGENT_SERVICE_URL = os.getenv("AGENT_SERVICE_URL", "http://agent-service:8001")

@router.get("/catalog")
async def model_catalog():
    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            res = await client.get(f"{AGENT_SERVICE_URL}/internal/models/catalog")
            res.raise_for_status()
            return res.json()
        except httpx.HTTPError as e:
            raise HTTPException(status_code=502, detail=f"Agent service error: {type(e).__name__}")

@router.get("")
async def list_models():
    async with httpx.AsyncClient() as client:
        try:
            res = await client.get(f"{AGENT_SERVICE_URL}/internal/models")
            res.raise_for_status()
            return res.json()
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))

class PullRequest(BaseModel):
    model_name: str

@router.post("/pull")
async def pull_model(req: PullRequest):
    async def proxy_stream():
        async with httpx.AsyncClient() as client:
            try:
                # Streaming from agent-service which streams from ollama
                async with client.stream("POST", f"{AGENT_SERVICE_URL}/internal/models/pull", json={"model_name": req.model_name}) as response:
                    response.raise_for_status()
                    async for chunk in response.aiter_bytes():
                        yield chunk
            except httpx.HTTPStatusError as e:
                yield f'{{"error": "Agent API Error: {e.response.status_code}"}}'.encode('utf-8')
            except Exception as e:
                yield f'{{"error": "{str(e)}"}}'.encode('utf-8')

    return StreamingResponse(proxy_stream(), media_type="application/x-ndjson")

@router.delete("/{model_name}")
async def delete_model(model_name: str):
    async with httpx.AsyncClient() as client:
        try:
            res = await client.delete(f"{AGENT_SERVICE_URL}/internal/models/{model_name}")
            res.raise_for_status()
            return res.json()
        except httpx.HTTPStatusError as e:
            raise HTTPException(status_code=e.response.status_code, detail=str(e))
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))
