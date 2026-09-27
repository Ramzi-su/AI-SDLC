import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from database import init_db
from routers import project, agent, models, learn, auth
import httpx

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="AI-SDLC Core API",
    description="Handles project state and DB interaction",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    # Let the frontend read why a request was refused.
    expose_headers=["X-Error-Code", "Retry-After"],
)

from redis_client import test_redis_connection

@app.on_event("startup")
async def startup():
    logger.info("Initializing database...")
    await init_db()
    logger.info("Database initialized.")
    await test_redis_connection()

app.include_router(auth.router)
app.include_router(project.router)
app.include_router(agent.router)
app.include_router(models.router)
app.include_router(learn.router)

@app.get("/api/health")
async def health_check():
    return {"status": "healthy", "service": "AI-SDLC Core API"}
