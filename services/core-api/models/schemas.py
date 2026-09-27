from pydantic import BaseModel, Field
from typing import Optional
from enum import Enum
from datetime import datetime

class FrameworkType(str, Enum):
    REACT = "react"
    NEXTJS = "nextjs"
    VUE = "vue"
    NUXT = "nuxt"
    SVELTE = "svelte"
    VANILLA = "vanilla"

class AgentStep(str, Enum):
    FRAMEWORK = "framework"
    COMPONENTS = "components"
    STYLE = "style"
    GENERATE = "generate"

class ProjectStatus(str, Enum):
    DRAFT = "draft"
    FRAMEWORK_CONFIRMED = "framework_confirmed"
    COMPONENTS_CONFIRMED = "components_confirmed"
    STYLE_CONFIRMED = "style_confirmed"
    GENERATED = "generated"

class ProjectCreateRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    description: str = Field(..., min_length=10, max_length=2000)
    project_type: str = Field(default="web_app")

class ProjectSummary(BaseModel):
    id: str
    name: str
    description: str
    project_type: str
    status: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class ProjectResponse(BaseModel):
    id: str
    name: str
    description: str
    project_type: str
    status: str
    framework: Optional[dict] = None
    layout: Optional[dict] = None
    style: Optional[dict] = None
    generated: Optional[dict] = None
    wizard_state: Optional[dict] = None
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True

class AgentRequest(BaseModel):
    project_id: str
    step: AgentStep
    user_feedback: Optional[str] = None
    model: str = "codellama:7b"

class ConfirmationRequest(BaseModel):
    step: AgentStep
    approved: bool
    feedback: Optional[str] = None
    modifications: Optional[dict] = None

class PageGenerateRequest(BaseModel):
    project_id: str
    page_id: str
    user_feedback: Optional[str] = None
    model: str = "codellama:7b"

class PageApproveRequest(BaseModel):
    project_id: str
    page_id: str
