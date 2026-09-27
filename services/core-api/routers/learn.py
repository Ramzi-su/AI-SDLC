import copy
import os
from typing import Optional
import httpx
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from models.orm import LearningActivity, User
from database import get_db
from auth import verified_user, get_owned_project

router = APIRouter(prefix="/api/learn", tags=["Learning"])
AGENT_SERVICE_URL = os.getenv("AGENT_SERVICE_URL", "http://agent-service:8001")

DEFAULT_MODEL = "codellama:7b"
DEFAULT_LEVEL = "Intermediate"

LESSON_POINTS = 10
QUIZ_POINTS_PER_CORRECT = 5
CHALLENGE_POINTS = {"complete": 20, "modify": 30, "scratch": 40}


class LessonRequest(BaseModel):
    project_id: str
    page_id: str
    level: str = DEFAULT_LEVEL
    model: str = DEFAULT_MODEL
    regenerate: bool = False

class AskRequest(BaseModel):
    question: str
    history: list[dict] = []
    project_id: Optional[str] = None
    page_id: Optional[str] = None
    level: str = DEFAULT_LEVEL
    model: str = DEFAULT_MODEL

class QuizRequest(BaseModel):
    project_id: Optional[str] = None
    page_id: Optional[str] = None
    topic: Optional[str] = None
    level: str = DEFAULT_LEVEL
    model: str = DEFAULT_MODEL

class QuizSubmission(BaseModel):
    answers: list[Optional[int]]

class ChallengeRequest(BaseModel):
    kind: str
    project_id: Optional[str] = None
    page_id: Optional[str] = None
    topic: Optional[str] = None
    level: str = DEFAULT_LEVEL
    model: str = DEFAULT_MODEL

class ChallengeSubmission(BaseModel):
    code: str
    level: str = DEFAULT_LEVEL
    model: str = DEFAULT_MODEL


# ---------- helpers ----------

async def _agent(path: str, payload: dict) -> dict:
    try:
        async with httpx.AsyncClient(timeout=600.0) as client:
            response = await client.post(f"{AGENT_SERVICE_URL}/internal/learn/{path}", json=payload)
    except httpx.RequestError as e:
        raise HTTPException(status_code=503, detail=f"Agent service unavailable: {e}")
    if response.status_code >= 400:
        try:
            detail = response.json().get("detail", response.text)
        except ValueError:
            detail = response.text
        raise HTTPException(status_code=502 if response.status_code == 502 else 500, detail=detail)
    return response.json()

async def _get_activity(db: AsyncSession, activity_id: str, kind: str, user: User) -> LearningActivity:
    activity = await db.get(LearningActivity, activity_id)
    if not activity or activity.kind != kind or activity.user_id != user.id:
        raise HTTPException(status_code=404, detail=f"{kind.capitalize()} not found")
    return activity

async def _page_generation(db: AsyncSession, project_id: str, page_id: str, user: User) -> dict:
    project = await get_owned_project(db, project_id, user)
    pages = (project.generated or {}).get("pages", {}) if isinstance(project.generated, dict) else {}
    generation = pages.get(page_id)
    if not generation:
        raise HTTPException(status_code=400, detail="Generate this page before learning about it")
    return generation

def _files_for_learning(generation: dict) -> list[dict]:
    files = generation.get("files") or []
    if not files and generation.get("preview_html"):
        files = [{"filename": "page.html", "content": generation["preview_html"]}]
    return files

def _runnable_source(generation: dict) -> Optional[str]:
    """Challenges run in a live preview, so they use the page's self-contained HTML."""
    if generation.get("preview_html"):
        return generation["preview_html"]
    html = next((f for f in generation.get("files", []) if f.get("language") == "html"), None)
    return html.get("content") if html else None

def _public(activity: LearningActivity) -> dict:
    """What the learner may see: answers and solutions stay hidden until earned or revealed."""
    content = copy.deepcopy(activity.content)
    result = activity.result or {}
    if activity.kind == "quiz" and not activity.completed:
        for q in content.get("questions", []):
            q.pop("answer_index", None)
            q.pop("explanation", None)
    if activity.kind == "challenge":
        content.pop("reference_code", None)
        if not (activity.completed or result.get("solution_revealed")):
            content.pop("solution", None)
    return {
        "id": activity.id,
        "project_id": activity.project_id,
        "page_id": activity.page_id,
        "kind": activity.kind,
        "content": content,
        "result": result,
        "points": activity.points,
        "completed": activity.completed,
        "created_at": activity.created_at,
    }

async def _save(db: AsyncSession, activity: LearningActivity) -> dict:
    db.add(activity)
    await db.commit()
    await db.refresh(activity)
    return _public(activity)


# ---------- lessons ----------

@router.post("/lessons")
async def create_lesson(req: LessonRequest, db: AsyncSession = Depends(get_db), user: User = Depends(verified_user)):
    if not req.regenerate:
        existing = await db.execute(
            select(LearningActivity)
            .filter_by(project_id=req.project_id, page_id=req.page_id, kind="lesson", user_id=user.id)
            .order_by(LearningActivity.created_at.desc())
        )
        lesson = existing.scalars().first()
        if lesson:
            return _public(lesson)

    generation = await _page_generation(db, req.project_id, req.page_id, user)
    content = await _agent("lesson", {
        "page_name": generation.get("page_name", req.page_id),
        "files": _files_for_learning(generation),
        "level": req.level,
        "model": req.model,
    })
    return await _save(db, LearningActivity(user_id=user.id, project_id=req.project_id, page_id=req.page_id, kind="lesson", content=content))

@router.post("/lessons/{activity_id}/complete")
async def complete_lesson(activity_id: str, db: AsyncSession = Depends(get_db), user: User = Depends(verified_user)):
    lesson = await _get_activity(db, activity_id, "lesson", user)
    if not lesson.completed:
        lesson.completed = True
        lesson.points = LESSON_POINTS
    return await _save(db, lesson)


# ---------- tutor ----------

@router.post("/ask")
async def ask(req: AskRequest, db: AsyncSession = Depends(get_db), user: User = Depends(verified_user)):
    files = None
    if req.project_id and req.page_id:
        files = _files_for_learning(await _page_generation(db, req.project_id, req.page_id, user))
    return await _agent("ask", {
        "question": req.question,
        "history": req.history,
        "files": files,
        "level": req.level,
        "model": req.model,
    })


# ---------- quizzes ----------

@router.post("/quizzes")
async def create_quiz(req: QuizRequest, db: AsyncSession = Depends(get_db), user: User = Depends(verified_user)):
    files = None
    if req.project_id and req.page_id:
        files = _files_for_learning(await _page_generation(db, req.project_id, req.page_id, user))
    elif not req.topic:
        raise HTTPException(status_code=400, detail="Give a page or a topic for the quiz")
    content = await _agent("quiz", {"files": files, "topic": req.topic, "level": req.level, "model": req.model})
    return await _save(db, LearningActivity(user_id=user.id, project_id=req.project_id, page_id=req.page_id, kind="quiz", content=content))

@router.post("/quizzes/{activity_id}/submit")
async def submit_quiz(activity_id: str, req: QuizSubmission, db: AsyncSession = Depends(get_db), user: User = Depends(verified_user)):
    quiz = await _get_activity(db, activity_id, "quiz", user)
    if quiz.completed:
        return _public(quiz)

    questions = quiz.content.get("questions", [])
    correct = [
        i < len(req.answers) and req.answers[i] == q.get("answer_index")
        for i, q in enumerate(questions)
    ]
    quiz.result = {"answers": req.answers, "correct": correct, "score": sum(correct), "total": len(questions)}
    quiz.points = sum(correct) * QUIZ_POINTS_PER_CORRECT
    quiz.completed = True
    return await _save(db, quiz)


# ---------- challenges ----------

@router.post("/challenges")
async def create_challenge(req: ChallengeRequest, db: AsyncSession = Depends(get_db), user: User = Depends(verified_user)):
    if req.kind not in CHALLENGE_POINTS:
        raise HTTPException(status_code=400, detail=f"Challenge type must be one of: {', '.join(CHALLENGE_POINTS)}")
    source = None
    if req.project_id and req.page_id:
        source = _runnable_source(await _page_generation(db, req.project_id, req.page_id, user))
    content = await _agent("challenge", {
        "kind": req.kind,
        "source_code": source,
        "topic": req.topic,
        "level": req.level,
        "model": req.model,
    })
    return await _save(db, LearningActivity(
        user_id=user.id, project_id=req.project_id, page_id=req.page_id, kind="challenge", content=content,
        result={"attempts": []},
    ))

@router.post("/challenges/{activity_id}/submit")
async def submit_challenge(activity_id: str, req: ChallengeSubmission, db: AsyncSession = Depends(get_db), user: User = Depends(verified_user)):
    challenge = await _get_activity(db, activity_id, "challenge", user)
    grade = await _agent("grade", {
        "challenge": challenge.content,
        "submission": req.code,
        "level": req.level,
        "model": req.model,
    })

    result = copy.deepcopy(challenge.result or {})
    result.setdefault("attempts", []).append(grade)
    result["last_submission"] = req.code
    challenge.result = result

    if grade["passed"] and not challenge.completed:
        challenge.completed = True
        # Revealing the solution first still completes the challenge, but earns nothing.
        if not result.get("solution_revealed"):
            challenge.points = CHALLENGE_POINTS.get(challenge.content.get("kind"), 0)

    return {"activity": await _save(db, challenge), "grade": grade}

@router.post("/challenges/{activity_id}/solution")
async def reveal_solution(activity_id: str, db: AsyncSession = Depends(get_db), user: User = Depends(verified_user)):
    challenge = await _get_activity(db, activity_id, "challenge", user)
    if not challenge.content.get("solution"):
        raise HTTPException(
            status_code=400,
            detail="This challenge has no single correct answer. Use the hints, or ask the tutor for help.",
        )
    result = copy.deepcopy(challenge.result or {})
    result["solution_revealed"] = True
    challenge.result = result
    return await _save(db, challenge)


# ---------- history and progress ----------

@router.get("/activities")
async def list_activities(
    project_id: Optional[str] = None,
    page_id: Optional[str] = None,
    standalone: bool = False,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(verified_user),
):
    query = (
        select(LearningActivity)
        .filter(LearningActivity.user_id == user.id)
        .order_by(LearningActivity.created_at.desc())
    )
    if standalone:
        query = query.filter(LearningActivity.project_id.is_(None))
    elif project_id:
        query = query.filter(LearningActivity.project_id == project_id)
    if page_id:
        query = query.filter(LearningActivity.page_id == page_id)
    result = await db.execute(query.limit(100))
    return [_public(a) for a in result.scalars().all()]

@router.get("/progress")
async def progress(project_id: Optional[str] = None, db: AsyncSession = Depends(get_db), user: User = Depends(verified_user)):
    mine = LearningActivity.user_id == user.id
    total = await db.scalar(select(func.coalesce(func.sum(LearningActivity.points), 0)).filter(mine))

    completed_query = (
        select(LearningActivity.kind, func.count())
        .filter(mine, LearningActivity.completed.is_(True))
        .group_by(LearningActivity.kind)
    )
    project_points = None
    if project_id:
        completed_query = completed_query.filter(LearningActivity.project_id == project_id)
        project_points = await db.scalar(
            select(func.coalesce(func.sum(LearningActivity.points), 0))
            .filter(mine, LearningActivity.project_id == project_id)
        )
    completed = {kind: count for kind, count in (await db.execute(completed_query)).all()}

    return {"total_points": total, "project_points": project_points, "completed": completed}
