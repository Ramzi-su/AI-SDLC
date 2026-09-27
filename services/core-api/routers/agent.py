import copy
import os
import httpx
from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from models.schemas import AgentRequest, AgentStep, ConfirmationRequest, ProjectStatus, PageGenerateRequest, PageApproveRequest
from models.orm import Project, User
from database import get_db
from auth import verified_user, get_owned_project

router = APIRouter(prefix="/api/agent", tags=["Agent"])
AGENT_SERVICE_URL = os.getenv("AGENT_SERVICE_URL", "http://agent-service:8001")

STEP_STATUS_MAP = {
    AgentStep.FRAMEWORK: ProjectStatus.FRAMEWORK_CONFIRMED,
    AgentStep.COMPONENTS: ProjectStatus.COMPONENTS_CONFIRMED,
    AgentStep.STYLE: ProjectStatus.STYLE_CONFIRMED,
    AgentStep.GENERATE: ProjectStatus.GENERATED,
}

@router.post("/run")
async def run_agent(req: AgentRequest, db: AsyncSession = Depends(get_db), user: User = Depends(verified_user)):
    project = await get_owned_project(db, req.project_id, user)

    project_dict = {
        "id": project.id,
        "name": project.name,
        "description": project.description,
        "project_type": project.project_type,
        "framework": project.framework,
        "layout": project.layout,
        "style": project.style,
        "generated": project.generated
    }

    payload = {
        "project": project_dict,
        "step": req.step.value,
        "user_feedback": req.user_feedback,
        "model": req.model
    }

    # Same budget as agent-service gives Ollama (600 s): a cold model load alone can take ~5 min
    async with httpx.AsyncClient(timeout=600.0) as client:
        try:
            response = await client.post(f"{AGENT_SERVICE_URL}/internal/run", json=payload)
            response.raise_for_status()
            agent_result = response.json()
            return agent_result
        except httpx.HTTPError as e:
            raise HTTPException(status_code=500, detail=f"Agent service error: {str(e)}")

@router.post("/confirm")
async def confirm_step(project_id: str, req: ConfirmationRequest, db: AsyncSession = Depends(get_db), user: User = Depends(verified_user)):
    project = await get_owned_project(db, project_id, user)
    if not req.approved:
        return {
            "status": "rejected",
            "message": "Step rejected. Run the agent again with feedback.",
            "feedback": req.feedback
        }

    data = req.modifications
    
    if req.step == AgentStep.FRAMEWORK:
        project.framework = data
    elif req.step == AgentStep.COMPONENTS:
        project.layout = data
    elif req.step == AgentStep.STYLE:
        project.style = data
    elif req.step == AgentStep.GENERATE:
        project.generated = data

    project.status = STEP_STATUS_MAP[req.step].value
    await db.commit()
    await db.refresh(project)
    
    # Store component embeddings if generating components
    if req.step == AgentStep.COMPONENTS and data and "components" in data:
        # Trigger background task to Agent Service to vectorize and save components
        async with httpx.AsyncClient() as client:
            try:
                await client.post(
                    f"{AGENT_SERVICE_URL}/internal/embed-components",
                    json={"project_id": project.id, "components": data["components"]}
                )
            except Exception as e:
                print(f"Warning: Failed to trigger embedding creation: {e}")

    return {"status": "confirmed", "project": project}


# ---- Page-by-page generation loop ----
# project.generated = {"pages": {page_id: {page_id, page_name, status: "draft"|"approved",
#                                          attempt, files, preview_html, explanation, fallback, feedback_history}}}


def _layout_pages(project: Project) -> list[dict]:
    layout = project.layout or {}
    return layout.get("pages", []) if isinstance(layout, dict) else []

def _page_generations(project: Project) -> dict:
    # Deep copy: SQLAlchemy only detects JSON column changes on reassignment.
    generated = copy.deepcopy(project.generated) if isinstance(project.generated, dict) else {}
    generated.setdefault("pages", {})
    return generated

@router.get("/pages/{project_id}")
async def get_page_generations(project_id: str, db: AsyncSession = Depends(get_db), user: User = Depends(verified_user)):
    project = await get_owned_project(db, project_id, user)
    return {"pages": _layout_pages(project), "generations": _page_generations(project)["pages"]}

@router.post("/pages/generate")
async def generate_page(req: PageGenerateRequest, db: AsyncSession = Depends(get_db), user: User = Depends(verified_user)):
    project = await get_owned_project(db, req.project_id, user)
    pages = _layout_pages(project)
    page = next((p for p in pages if p.get("id") == req.page_id), None)
    if not page:
        raise HTTPException(status_code=404, detail="Page not found in confirmed layout")

    generated = _page_generations(project)
    existing = generated["pages"].get(req.page_id)
    if existing and existing.get("status") == "approved":
        raise HTTPException(status_code=409, detail="Page is already approved")

    # Approved pages, in the order the user built them, give the LLM context for consistency.
    approved_pages = [
        generated["pages"][p["id"]]
        for p in pages
        if p.get("id") != req.page_id and generated["pages"].get(p.get("id"), {}).get("status") == "approved"
    ]

    payload = {
        "project": {
            "id": project.id,
            "name": project.name,
            "description": project.description,
            "framework": project.framework,
            "style": project.style,
        },
        "page": page,
        "approved_pages": approved_pages,
        "previous_attempt": existing,
        "user_feedback": req.user_feedback,
        "model": req.model,
    }

    async with httpx.AsyncClient(timeout=600.0) as client:
        try:
            response = await client.post(f"{AGENT_SERVICE_URL}/internal/generate-page", json=payload)
            response.raise_for_status()
            result = response.json()
        except httpx.HTTPError as e:
            raise HTTPException(status_code=500, detail=f"Agent service error: {str(e)}")

    feedback_history = list(existing.get("feedback_history", [])) if existing else []
    if req.user_feedback:
        feedback_history.append(req.user_feedback)

    generation = {
        "page_id": req.page_id,
        "page_name": page.get("name", req.page_id),
        "status": "draft",
        "attempt": (existing.get("attempt", 0) if existing else 0) + 1,
        "files": result.get("files", []),
        "preview_html": result.get("preview_html", ""),
        "explanation": result.get("explanation", ""),
        "fallback": result.get("fallback", False),
        "feedback_history": feedback_history,
    }
    generated["pages"][req.page_id] = generation
    project.generated = generated
    await db.commit()

    return generation

@router.post("/pages/approve")
async def approve_page(req: PageApproveRequest, db: AsyncSession = Depends(get_db), user: User = Depends(verified_user)):
    project = await get_owned_project(db, req.project_id, user)
    generated = _page_generations(project)
    generation = generated["pages"].get(req.page_id)
    if not generation:
        raise HTTPException(status_code=400, detail="Generate the page before approving it")

    generation["status"] = "approved"
    project.generated = generated

    pages = _layout_pages(project)
    all_approved = bool(pages) and all(
        generated["pages"].get(p.get("id"), {}).get("status") == "approved" for p in pages
    )
    if all_approved:
        project.status = ProjectStatus.GENERATED.value
    await db.commit()

    next_page = next(
        (p for p in pages if generated["pages"].get(p.get("id"), {}).get("status") != "approved"),
        None,
    )
    return {
        "generation": generation,
        "all_approved": all_approved,
        "next_page_id": next_page.get("id") if next_page else None,
    }
