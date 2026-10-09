"""Request bodies (responses are plain dicts built in serializers.py)."""

from datetime import date
from typing import Literal

from pydantic import BaseModel, Field

OppType = Literal["project", "internship", "job"]
WorkMode = Literal["remote", "onsite", "hybrid", "any"]


class SkillLevelIn(BaseModel):
    skill_id: str
    level: int = Field(ge=0, le=3)
    wants_to_learn: bool = False


class PastProjectIn(BaseModel):
    title: str = Field(min_length=2, max_length=200)
    description: str = ""
    skills: list[str] = []
    domain: str = ""
    url: str = ""


class StudentProfileIn(BaseModel):
    name: str | None = None
    headline: str = ""
    university: str = ""
    faculty: str = ""
    study_program: str = ""
    study_level: Literal["bachelor", "master", "phd"] = "bachelor"
    year: int = Field(default=1, ge=1, le=6)
    city: str = ""
    bio: str = ""
    accepted_types: list[OppType] = []
    goals: list[str] = []
    domains: list[str] = []
    courses: list[str] = []
    hours_per_week: int = Field(default=10, ge=1, le=60)
    available_from: date | None = None
    available_to: date | None = None
    work_mode: WorkMode = "any"
    portfolio_url: str = ""
    github_url: str = ""
    skills: list[SkillLevelIn] = []
    past_projects: list[PastProjectIn] = []


class CompanyProfileIn(BaseModel):
    name: str | None = None
    headline: str = ""
    industry: str = ""
    size: str = ""
    city: str = ""
    website: str = ""
    description: str = ""


class RequirementIn(BaseModel):
    skill_id: str
    min_level: int = Field(default=1, ge=1, le=3)
    mandatory: bool = False
    learnable: bool = False
    source: Literal["explicit", "suggested", "manual"] = "manual"


class OpportunityIn(BaseModel):
    type: OppType
    title: str = Field(min_length=4, max_length=200)
    description: str = Field(min_length=20)
    tasks: list[str] = []
    expected_outcome: str = ""
    domain: str = ""
    difficulty: int = Field(default=2, ge=1, le=3)
    hours_per_week: int = Field(default=10, ge=1, le=60)
    duration_weeks: int = Field(default=4, ge=1, le=104)
    start_date: date | None = None
    deadline: date | None = None
    work_mode: Literal["remote", "onsite", "hybrid"] = "remote"
    city: str = ""
    compensation_type: Literal["fixed", "monthly", "hourly", "unpaid"] = "fixed"
    compensation_amount: float = Field(default=0, ge=0)
    academic_options: list[Literal["course_credit", "mandatory_practice", "thesis"]] = []
    mentoring_offered: bool = False
    request_verification: bool = False
    requirements: list[RequirementIn] = []
    ai_extraction: dict | None = None
    status: Literal["draft", "open"] = "open"


class ExtractIn(BaseModel):
    title: str = ""
    description: str = Field(min_length=20, max_length=6000)
    type: OppType | None = None


class ApplyIn(BaseModel):
    message: str = ""


class InviteIn(BaseModel):
    student_id: int
    message: str = ""


class RespondIn(BaseModel):
    action: Literal["accept", "decline", "withdraw"]


class SelectIn(BaseModel):
    student_id: int


class StatusIn(BaseModel):
    status: Literal["open", "in_progress", "delivered", "paid", "completed", "closed"]


class ReviewIn(BaseModel):
    ratings: dict[str, int]
    comment: str = ""


class MessageIn(BaseModel):
    opportunity_id: int
    recipient_id: int
    body: str = Field(min_length=1, max_length=4000)


class MentorshipIn(BaseModel):
    note: str = ""


class MentorshipRespondIn(BaseModel):
    action: Literal["accept", "decline"]


class SwipeIn(BaseModel):
    opportunity_id: int
    student_id: int | None = None  # companies say which student; for students it is always themselves
    liked: bool


class UndoSwipeIn(BaseModel):
    opportunity_id: int
    student_id: int | None = None
