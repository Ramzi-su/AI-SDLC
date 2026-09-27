import os
import sqlalchemy
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import declarative_base

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql+asyncpg://postgres:postgres@localhost:5432/sdlc_db")

engine = create_async_engine(DATABASE_URL, echo=True)
AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)
Base = declarative_base()

async def get_db():
    async with AsyncSessionLocal() as session:
        yield session

async def init_db():
    from models.orm import User, OAuthAccount, Session, RefreshToken, LoginAttempt, RateLimitEvent, EmailToken, Project, ComponentEmbedding, LearningActivity  # import to register with Base
    from pgvector.sqlalchemy import Vector
    async with engine.begin() as conn:
        # Create vector extension if it doesn't exist
        await conn.execute(sqlalchemy.text("CREATE EXTENSION IF NOT EXISTS vector"))
        await conn.run_sync(Base.metadata.create_all)
        # create_all does not add columns to existing tables; there are no migrations yet.
        await conn.execute(sqlalchemy.text("ALTER TABLE projects ADD COLUMN IF NOT EXISTS wizard_state JSON"))
        await conn.execute(sqlalchemy.text(
            "ALTER TABLE projects ADD COLUMN IF NOT EXISTS owner_id VARCHAR REFERENCES users(id) ON DELETE CASCADE"
        ))
        await conn.execute(sqlalchemy.text("ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMP"))
        await conn.execute(sqlalchemy.text(
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS session_version INTEGER NOT NULL DEFAULT 0"
        ))
        await conn.execute(sqlalchemy.text(
            "ALTER TABLE email_tokens ADD COLUMN IF NOT EXISTS attempts INTEGER NOT NULL DEFAULT 0"
        ))
        # Sessions moved to JWT + refresh tokens: old cookie-token sessions can't be used any more
        # (everyone signs in once more).
        await conn.execute(sqlalchemy.text(
            "DO $$ BEGIN "
            "IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sessions' AND column_name = 'token_hash') "
            "THEN DELETE FROM sessions; ALTER TABLE sessions DROP COLUMN token_hash; END IF; END $$"
        ))
        await conn.execute(sqlalchemy.text(
            "ALTER TABLE learning_activities ADD COLUMN IF NOT EXISTS user_id VARCHAR REFERENCES users(id) ON DELETE CASCADE"
        ))
        await conn.execute(sqlalchemy.text("CREATE INDEX IF NOT EXISTS ix_projects_owner_id ON projects (owner_id)"))
        await conn.execute(sqlalchemy.text(
            "CREATE INDEX IF NOT EXISTS ix_learning_activities_user_id ON learning_activities (user_id)"
        ))
