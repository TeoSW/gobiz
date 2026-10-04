"""SQLAlchemy models. Column types are portable between MySQL 8 and SQLite."""

from datetime import date, datetime, timezone

from sqlalchemy import JSON, Boolean, Date, DateTime, Float, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .db import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)

ROLES = ("student", "company", "university")
OPPORTUNITY_TYPES = ("project", "internship", "job")
WORK_MODES = ("remote", "onsite", "hybrid", "any")
# draft -> open -> in_progress -> delivered -> paid -> completed ; closed at any time
OPPORTUNITY_STATUSES = ("draft", "open", "in_progress", "delivered", "paid", "completed", "closed")
STUDENT_GOALS = ("paid_project", "course_credit", "mandatory_practice", "thesis", "internship", "part_time_job", "full_time_job")


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    role: Mapped[str] = mapped_column(String(20), index=True)
    name: Mapped[str] = mapped_column(String(120))
    email: Mapped[str] = mapped_column(String(160), unique=True)
    headline: Mapped[str] = mapped_column(String(200), default="")
    # demo login (mockup): only the test accounts have credentials; other users exist as data only
    username: Mapped[str | None] = mapped_column(String(60), unique=True, nullable=True)
    password_hash: Mapped[str | None] = mapped_column(String(200), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

    student: Mapped["StudentProfile | None"] = relationship(back_populates="user", uselist=False)
    company: Mapped["CompanyProfile | None"] = relationship(back_populates="user", uselist=False)


class Skill(Base):
    __tablename__ = "skills"

    id: Mapped[str] = mapped_column(String(60), primary_key=True)  # canonical slug, e.g. "power_bi"
    name: Mapped[str] = mapped_column(String(80))
    category: Mapped[str] = mapped_column(String(40))
    esco_hint: Mapped[str] = mapped_column(String(200), default="")
    synonyms: Mapped[list] = mapped_column(JSON, default=list)
    related: Mapped[list] = mapped_column(JSON, default=list)


class StudentProfile(Base):
    __tablename__ = "student_profiles"

    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), primary_key=True)
    university: Mapped[str] = mapped_column(String(160), default="")
    faculty: Mapped[str] = mapped_column(String(160), default="")
    study_program: Mapped[str] = mapped_column(String(160), default="")
    study_level: Mapped[str] = mapped_column(String(20), default="bachelor")  # bachelor / master / phd
    year: Mapped[int] = mapped_column(Integer, default=1)
    city: Mapped[str] = mapped_column(String(80), default="")
    bio: Mapped[str] = mapped_column(Text, default="")
    accepted_types: Mapped[list] = mapped_column(JSON, default=list)  # subset of OPPORTUNITY_TYPES
    goals: Mapped[list] = mapped_column(JSON, default=list)  # subset of STUDENT_GOALS
    domains: Mapped[list] = mapped_column(JSON, default=list)  # e.g. ["retail", "finance"]
    courses: Mapped[list] = mapped_column(JSON, default=list)
    hours_per_week: Mapped[int] = mapped_column(Integer, default=10)
    available_from: Mapped[date | None] = mapped_column(Date, nullable=True)
    available_to: Mapped[date | None] = mapped_column(Date, nullable=True)
    work_mode: Mapped[str] = mapped_column(String(10), default="any")
    portfolio_url: Mapped[str] = mapped_column(String(300), default="")
    github_url: Mapped[str] = mapped_column(String(300), default="")
    cv_filename: Mapped[str] = mapped_column(String(300), default="")
    embedding: Mapped[dict | None] = mapped_column(JSON, nullable=True)  # {"key": hash, "vectors": [[...]]}

    user: Mapped[User] = relationship(back_populates="student")
    skills: Mapped[list["StudentSkill"]] = relationship(cascade="all, delete-orphan", lazy="selectin")
    past_projects: Mapped[list["PastProject"]] = relationship(cascade="all, delete-orphan", lazy="selectin")


class StudentSkill(Base):
    __tablename__ = "student_skills"
    __table_args__ = (UniqueConstraint("student_id", "skill_id"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    student_id: Mapped[int] = mapped_column(ForeignKey("student_profiles.user_id"), index=True)
    skill_id: Mapped[str] = mapped_column(ForeignKey("skills.id"))
    level: Mapped[int] = mapped_column(Integer, default=0)  # 0 none, 1 beginner, 2 intermediate, 3 advanced
    wants_to_learn: Mapped[bool] = mapped_column(Boolean, default=False)


class PastProject(Base):
    """Self-declared portfolio item (not verified by GoBiz)."""

    __tablename__ = "past_projects"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    student_id: Mapped[int] = mapped_column(ForeignKey("student_profiles.user_id"), index=True)
    title: Mapped[str] = mapped_column(String(200))
    description: Mapped[str] = mapped_column(Text, default="")
    skills: Mapped[list] = mapped_column(JSON, default=list)
    domain: Mapped[str] = mapped_column(String(60), default="")
    url: Mapped[str] = mapped_column(String(300), default="")


class CompanyProfile(Base):
    __tablename__ = "company_profiles"

    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), primary_key=True)
    industry: Mapped[str] = mapped_column(String(80), default="")
    size: Mapped[str] = mapped_column(String(30), default="")  # "1-9", "10-49", "50-249"
    city: Mapped[str] = mapped_column(String(80), default="")
    website: Mapped[str] = mapped_column(String(300), default="")
    description: Mapped[str] = mapped_column(Text, default="")

    user: Mapped[User] = relationship(back_populates="company")


class Opportunity(Base):
    __tablename__ = "opportunities"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    company_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    type: Mapped[str] = mapped_column(String(12), index=True)
    title: Mapped[str] = mapped_column(String(200))
    description: Mapped[str] = mapped_column(Text)
    tasks: Mapped[list] = mapped_column(JSON, default=list)
    expected_outcome: Mapped[str] = mapped_column(Text, default="")
    domain: Mapped[str] = mapped_column(String(60), default="")
    difficulty: Mapped[int] = mapped_column(Integer, default=2)  # 1 easy, 2 medium, 3 hard
    hours_per_week: Mapped[int] = mapped_column(Integer, default=10)
    duration_weeks: Mapped[int] = mapped_column(Integer, default=4)
    start_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    deadline: Mapped[date | None] = mapped_column(Date, nullable=True)
    work_mode: Mapped[str] = mapped_column(String(10), default="remote")
    city: Mapped[str] = mapped_column(String(80), default="")
    compensation_type: Mapped[str] = mapped_column(String(12), default="fixed")  # fixed / monthly / hourly / unpaid
    compensation_amount: Mapped[float] = mapped_column(Float, default=0)
    currency: Mapped[str] = mapped_column(String(3), default="RON")
    academic_options: Mapped[list] = mapped_column(JSON, default=list)  # course_credit / mandatory_practice / thesis
    mentoring_offered: Mapped[bool] = mapped_column(Boolean, default=False)
    status: Mapped[str] = mapped_column(String(12), default="open", index=True)
    university_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    verified_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    verification_requested: Mapped[bool] = mapped_column(Boolean, default=False)
    selected_student_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    ai_extraction: Mapped[dict | None] = mapped_column(JSON, nullable=True)  # raw LLM output, kept for audit
    embedding: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

    company: Mapped[User] = relationship(foreign_keys=[company_id], lazy="joined")
    skills: Mapped[list["OpportunitySkill"]] = relationship(cascade="all, delete-orphan", lazy="selectin")


class OpportunitySkill(Base):
    __tablename__ = "opportunity_skills"
    __table_args__ = (UniqueConstraint("opportunity_id", "skill_id"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    opportunity_id: Mapped[int] = mapped_column(ForeignKey("opportunities.id"), index=True)
    skill_id: Mapped[str] = mapped_column(ForeignKey("skills.id"))
    min_level: Mapped[int] = mapped_column(Integer, default=1)
    mandatory: Mapped[bool] = mapped_column(Boolean, default=False)
    learnable: Mapped[bool] = mapped_column(Boolean, default=False)  # can be learned with guidance
    source: Mapped[str] = mapped_column(String(12), default="manual")  # explicit / suggested / manual


class Application(Base):
    """Both student applications and company invitations live here (kind)."""

    __tablename__ = "applications"
    __table_args__ = (UniqueConstraint("opportunity_id", "student_id"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    opportunity_id: Mapped[int] = mapped_column(ForeignKey("opportunities.id"), index=True)
    student_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    kind: Mapped[str] = mapped_column(String(12))  # application / invitation
    # pending -> accepted / declined (invitation) ; pending -> selected / rejected (company decision) ; withdrawn
    status: Mapped[str] = mapped_column(String(12), default="pending")
    message: Mapped[str] = mapped_column(Text, default="")
    match_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

    opportunity: Mapped[Opportunity] = relationship(lazy="joined")
    student: Mapped[User] = relationship(lazy="joined")


class Message(Base):
    __tablename__ = "messages"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    opportunity_id: Mapped[int] = mapped_column(ForeignKey("opportunities.id"), index=True)
    sender_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    recipient_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    body: Mapped[str] = mapped_column(Text)
    read: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class Review(Base):
    __tablename__ = "reviews"
    __table_args__ = (UniqueConstraint("opportunity_id", "reviewer_id"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    opportunity_id: Mapped[int] = mapped_column(ForeignKey("opportunities.id"), index=True)
    reviewer_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    reviewee_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    direction: Mapped[str] = mapped_column(String(20))  # company_to_student / student_to_company
    ratings: Mapped[dict] = mapped_column(JSON)  # dimension -> 1..5
    overall: Mapped[float] = mapped_column(Float)
    comment: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class MentorshipRequest(Base):
    __tablename__ = "mentorship_requests"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    opportunity_id: Mapped[int] = mapped_column(ForeignKey("opportunities.id"))
    student_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    mentor_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    note: Mapped[str] = mapped_column(Text, default="")
    status: Mapped[str] = mapped_column(String(12), default="pending")  # pending / accepted / declined
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

    opportunity: Mapped[Opportunity] = relationship(lazy="joined")
    student: Mapped[User] = relationship(foreign_keys=[student_id], lazy="joined")


class InteractionEvent(Base):
    """Implicit + explicit feedback, logged now so a learned ranker can be trained later."""

    __tablename__ = "interaction_events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    event: Mapped[str] = mapped_column(String(30), index=True)
    actor_id: Mapped[int] = mapped_column(Integer)
    student_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    opportunity_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    match_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    value: Mapped[float | None] = mapped_column(Float, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class AppMeta(Base):
    """Key/value settings, e.g. the version of the seeded demo data."""

    __tablename__ = "app_meta"

    key: Mapped[str] = mapped_column(String(60), primary_key=True)
    value: Mapped[str] = mapped_column(String(200))
