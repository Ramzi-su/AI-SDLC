import os
import httpx
import logging
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import declarative_base
from sqlalchemy import Column, String, Text, DateTime
from pgvector.sqlalchemy import Vector
import datetime
import uuid

logger = logging.getLogger(__name__)

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql+asyncpg://postgres:postgres@postgres:5432/sdlc_db")
OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://ollama:11434")
EMBEDDING_MODEL = "codellama:7b" # Assuming this model supports embeddings, or use nomic-embed-text

engine = create_async_engine(DATABASE_URL)
AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)
Base = declarative_base()

class ComponentEmbedding(Base):
    __tablename__ = "component_embeddings"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    project_id = Column(String, nullable=False)
    component_name = Column(String, nullable=False)
    component_type = Column(String, nullable=False)
    content = Column(Text, nullable=False)
    embedding = Column(Vector(4096))
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

async def get_embedding(text: str) -> list[float]:
    async with httpx.AsyncClient() as client:
        try:
            # Ollama /api/embeddings endpoint
            response = await client.post(
                f"{OLLAMA_BASE_URL}/api/embeddings",
                json={
                    "model": EMBEDDING_MODEL,
                    "prompt": text
                }
            )
            response.raise_for_status()
            return response.json().get("embedding", [])
        except Exception as e:
            logger.error(f"Failed to get embedding: {e}")
            return []

async def store_component_embeddings(project_id: str, components: list[dict]):
    async with AsyncSessionLocal() as session:
        for comp in components:
            text_to_embed = f"{comp.get('name')} ({comp.get('type')}): {comp.get('description')}"
            embedding = await get_embedding(text_to_embed)
            
            if not embedding:
                continue
                
            db_comp = ComponentEmbedding(
                project_id=project_id,
                component_name=comp.get('name', 'Unknown'),
                component_type=comp.get('type', 'Unknown'),
                content=comp.get('description', ''),
                embedding=embedding
            )
            session.add(db_comp)
        
        try:
            await session.commit()
            logger.info(f"Stored {len(components)} component embeddings for project {project_id}")
        except Exception as e:
            await session.rollback()
            logger.error(f"DB Error storing embeddings: {e}")
