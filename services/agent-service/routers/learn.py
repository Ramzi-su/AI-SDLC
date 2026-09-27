from typing import Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from agents.learning_agent import learning_agent, LearningError

router = APIRouter(prefix="/internal/learn", tags=["Learning"])

DEFAULT_MODEL = "codellama:7b"
DEFAULT_LEVEL = "Intermediate"


class LessonRequest(BaseModel):
    page_name: str
    files: list[dict]
    level: str = DEFAULT_LEVEL
    model: str = DEFAULT_MODEL

class AskRequest(BaseModel):
    question: str
    history: list[dict] = []
    files: Optional[list[dict]] = None
    level: str = DEFAULT_LEVEL
    model: str = DEFAULT_MODEL

class QuizRequest(BaseModel):
    files: Optional[list[dict]] = None
    topic: Optional[str] = None
    level: str = DEFAULT_LEVEL
    model: str = DEFAULT_MODEL

class ChallengeRequest(BaseModel):
    kind: str
    source_code: Optional[str] = None
    topic: Optional[str] = None
    level: str = DEFAULT_LEVEL
    model: str = DEFAULT_MODEL

class GradeRequest(BaseModel):
    challenge: dict
    submission: str
    level: str = DEFAULT_LEVEL
    model: str = DEFAULT_MODEL


async def _run(coro):
    try:
        return await coro
    except LearningError as e:
        # 502: the upstream model produced something unusable; the message is learner-facing.
        raise HTTPException(status_code=502, detail=str(e))


@router.post("/lesson")
async def lesson(req: LessonRequest):
    return await _run(learning_agent.lesson(req.page_name, req.files, req.level, req.model))

@router.post("/ask")
async def ask(req: AskRequest):
    return await _run(learning_agent.ask(req.question, req.history, req.files, req.level, req.model))

@router.post("/quiz")
async def quiz(req: QuizRequest):
    return await _run(learning_agent.quiz(req.files, req.topic, req.level, req.model))

@router.post("/challenge")
async def challenge(req: ChallengeRequest):
    return await _run(learning_agent.challenge(req.kind, req.source_code, req.topic, req.level, req.model))

@router.post("/grade")
async def grade(req: GradeRequest):
    return await _run(learning_agent.grade(req.challenge, req.submission, req.level, req.model))
