"""The model proposes facts; application code owns state and authorizations."""
from typing import Annotated, Literal
from pydantic import BaseModel, ConfigDict, Field, StringConstraints
from flemme_manager.schemas import ManagerAssessment

Text = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=1500)]
Fact = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=1000)]

class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid")

class MissionFacts(StrictModel):
    scope: Fact | None = None
    location: Fact | None = None
    budget: Fact | None = None
    deadline: Fact | None = None
    success_criteria: Fact | None = None
    constraints: Fact | None = None
    documents_summary: Annotated[str, StringConstraints(max_length=4000)] | None = None

class QualificationAssessment(ManagerAssessment):
    facts: MissionFacts

class StartConversation(StrictModel):
    task: Text
    consent: Literal[True]

class SendMessage(StrictModel):
    message: Text
    version: int = Field(ge=0)
    request_id: Annotated[str, StringConstraints(pattern=r"^[a-zA-Z0-9-]{8,64}$")]
