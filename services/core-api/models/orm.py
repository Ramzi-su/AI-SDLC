from sqlalchemy import Column, String, Text, DateTime, JSON, ForeignKey, Integer, Boolean, UniqueConstraint
from sqlalchemy.orm import relationship
from pgvector.sqlalchemy import Vector
from database import Base
import datetime
import uuid

class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    email = Column(String, unique=True, nullable=False, index=True)  # stored lower-case
    name = Column(String, nullable=False)
    # Null for accounts created through Google/GitHub only.
    password_hash = Column(String, nullable=True)
    email_verified_at = Column(DateTime, nullable=True)
    # Copied into every access token; bumping it invalidates all of the user's tokens at once
    # (password reset, account takeover protection).
    session_version = Column(Integer, default=0, nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

class LoginAttempt(Base):
    """One sign-in attempt, used to slow down password guessing."""
    __tablename__ = "login_attempts"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    email = Column(String, nullable=False, index=True)
    ip = Column(String, nullable=False, index=True)
    success = Column(Boolean, nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow, index=True)

class RateLimitEvent(Base):
    """One occurrence of a rate-limited action (e.g. a sign-up) by a key (e.g. an IP address)."""
    __tablename__ = "rate_limit_events"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    action = Column(String, nullable=False)
    key = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow, index=True)

class EmailToken(Base):
    """A one-time secret sent by email: a verification link or a password reset code. Only a hash is stored."""
    __tablename__ = "email_tokens"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    purpose = Column(String, nullable=False)  # verify | reset
    token_hash = Column(String, unique=True, nullable=False)
    expires_at = Column(DateTime, nullable=False)
    used_at = Column(DateTime, nullable=True)
    # Wrong guesses of a reset code; the code stops working after too many.
    attempts = Column(Integer, default=0, nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

class OAuthAccount(Base):
    """A Google or GitHub identity linked to a user."""
    __tablename__ = "oauth_accounts"
    __table_args__ = (UniqueConstraint("provider", "provider_user_id"),)

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    provider = Column(String, nullable=False)
    provider_user_id = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

class Session(Base):
    """A signed-in browser: a chain of refresh tokens. Deleting it signs that browser out."""
    __tablename__ = "sessions"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    expires_at = Column(DateTime, nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

class RefreshToken(Base):
    """One refresh token of a session. Each is used once; reusing an old one reveals a stolen token."""
    __tablename__ = "refresh_tokens"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    session_id = Column(String, ForeignKey("sessions.id", ondelete="CASCADE"), nullable=False, index=True)
    token_hash = Column(String, unique=True, nullable=False)
    used_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

class Project(Base):
    __tablename__ = "projects"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4())[:8])
    # Nullable only for projects created before accounts existed; the first user claims them.
    owner_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True)
    name = Column(String, nullable=False)
    description = Column(Text, nullable=False)
    project_type = Column(String, default="web_app")
    status = Column(String, default="draft")
    
    # Store JSON state of steps
    framework = Column(JSON, nullable=True)
    layout = Column(JSON, nullable=True)
    style = Column(JSON, nullable=True)
    generated = Column(JSON, nullable=True)
    # Frontend wizard state (canvas pages, preferences, current step, unconfirmed agent results)
    # so a project can be reopened exactly where the user left it.
    wizard_state = Column(JSON, nullable=True)
    
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

class ComponentEmbedding(Base):
    __tablename__ = "component_embeddings"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    project_id = Column(String, ForeignKey("projects.id", ondelete="CASCADE"))
    component_name = Column(String, nullable=False)
    component_type = Column(String, nullable=False)
    content = Column(Text, nullable=False)
    
    # Assuming 4096 dimensions for Ollama models (e.g., codellama) 
    # or less depending on the embedding model used (e.g., 768 for nomic-embed-text)
    # We'll use 4096 here as a placeholder for codellama.
    embedding = Column(Vector(4096))
    
    created_at = Column(DateTime, default=datetime.datetime.utcnow)


class LearningActivity(Base):
    """A lesson, quiz or challenge, either about a project page or standalone (project_id is null)."""
    __tablename__ = "learning_activities"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    project_id = Column(String, ForeignKey("projects.id", ondelete="CASCADE"), nullable=True, index=True)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True)
    page_id = Column(String, nullable=True)
    kind = Column(String, nullable=False)  # lesson | quiz | challenge
    # Full generated content, including answers/solutions that are hidden from the learner until earned.
    content = Column(JSON, nullable=False)
    # Learner's answers, attempts, grades.
    result = Column(JSON, nullable=True)
    points = Column(Integer, default=0, nullable=False)
    completed = Column(Boolean, default=False, nullable=False)

    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)
