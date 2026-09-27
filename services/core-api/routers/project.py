from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from models.schemas import ProjectCreateRequest, ProjectResponse, ProjectSummary
from models.orm import Project, User
from database import get_db
from auth import verified_user, get_owned_project

router = APIRouter(prefix="/api/projects", tags=["Projects"])

@router.post("", response_model=ProjectResponse)
async def create_project(req: ProjectCreateRequest, db: AsyncSession = Depends(get_db), user: User = Depends(verified_user)):
    project = Project(
        name=req.name,
        description=req.description,
        project_type=req.project_type,
        owner_id=user.id,
    )
    db.add(project)
    await db.commit()
    await db.refresh(project)
    return project

@router.get("", response_model=list[ProjectSummary])
async def list_projects(db: AsyncSession = Depends(get_db), user: User = Depends(verified_user)):
    result = await db.execute(
        select(Project).filter(Project.owner_id == user.id).order_by(Project.updated_at.desc())
    )
    return result.scalars().all()

@router.get("/{project_id}", response_model=ProjectResponse)
async def get_project(project_id: str, db: AsyncSession = Depends(get_db), user: User = Depends(verified_user)):
    return await get_owned_project(db, project_id, user)

@router.put("/{project_id}/state")
async def save_wizard_state(project_id: str, state: dict, db: AsyncSession = Depends(get_db), user: User = Depends(verified_user)):
    project = await get_owned_project(db, project_id, user)
    project.wizard_state = state
    await db.commit()
    await db.refresh(project)
    return {"status": "saved", "updated_at": project.updated_at}

@router.delete("/{project_id}")
async def delete_project(project_id: str, db: AsyncSession = Depends(get_db), user: User = Depends(verified_user)):
    project = await get_owned_project(db, project_id, user)
    await db.delete(project)
    await db.commit()
    return {"status": "deleted"}
