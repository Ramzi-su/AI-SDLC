import logging
from fastapi import FastAPI, BackgroundTasks
from pydantic import BaseModel
import httpx
from typing import Optional
from agents.framework_agent import framework_agent
from agents.component_agent import component_agent
from agents.style_agent import style_agent
from agents.generator_agent import generator_agent
from agents.page_agent import page_agent
from routers import models, learn

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Agent Worker Service")

from redis_client import test_redis_connection

@app.on_event("startup")
async def startup():
    await test_redis_connection()

class AgentRunRequest(BaseModel):
    project: dict
    step: str
    user_feedback: Optional[str] = None
    model: str = "codellama:7b"

class PageGenerateRequest(BaseModel):
    project: dict
    page: dict
    approved_pages: list[dict] = []
    previous_attempt: Optional[dict] = None
    user_feedback: Optional[str] = None
    model: str = "codellama:7b"

class EmbeddingRequest(BaseModel):
    project_id: str
    components: list[dict]

STEP_AGENT_MAP = {
    "framework": framework_agent,
    "components": component_agent,
    "style": style_agent,
    "generate": generator_agent,
}

@app.post("/internal/run")
async def run_agent(req: AgentRunRequest):
    agent = STEP_AGENT_MAP.get(req.step)
    if not agent:
        return {"error": "Invalid step"}

    logger.info(f"Running agent {agent.name} for project {req.project.get('id')}")
    result = await agent.execute(
        context=req.project,
        model=req.model,
        user_feedback=req.user_feedback
    )

    return {
        "step": req.step,
        "data": result,
        "requires_confirmation": True,
        "message": f"{agent.name} completed. Please review and confirm."
    }

@app.post("/internal/generate-page")
async def generate_page(req: PageGenerateRequest):
    logger.info(f"Generating page {req.page.get('id')} for project {req.project.get('id')}")
    return await page_agent.execute(
        context={
            "project": req.project,
            "page": req.page,
            "approved_pages": req.approved_pages,
            "previous_attempt": req.previous_attempt,
        },
        model=req.model,
        user_feedback=req.user_feedback,
    )

async def compute_and_store_embeddings(project_id: str, components: list[dict]):
    # This is a background task that calculates embeddings via Ollama 
    # and stores them directly into the Postgres DB for pgvector usage.
    from services.vector_store import store_component_embeddings
    await store_component_embeddings(project_id, components)

@app.post("/internal/embed-components")
async def embed_components(req: EmbeddingRequest, background_tasks: BackgroundTasks):
    background_tasks.add_task(compute_and_store_embeddings, req.project_id, req.components)
    return {"status": "processing"}

app.include_router(models.router)
app.include_router(learn.router)

@app.get("/api/health")
async def health_check():
    return {"status": "healthy", "service": "Agent Service"}
