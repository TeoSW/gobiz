"""Bridge between the database and the pure matching engine (views, cached embeddings, ranking)."""

from sqlalchemy.orm import Session

from .. import i18n
from ..config import get_settings
from ..models import Opportunity, Review, StudentProfile
from ..skills_catalog import SKILL_BY_ID, related_skills
from .embeddings import chunk_similarity, embed_cached
from .engine import OpportunityView, ProjectRecord, Requirement, StudentView, Weights, match, rank_key


def weights() -> Weights:
    s = get_settings()
    return Weights(s.w_skills, s.w_experience, s.w_interests, s.w_semantic)


# ---------------------------------------------------------------- text used for semantic similarity
def opportunity_text(o: Opportunity) -> str:
    parts = [o.title + ".", *[t.rstrip(".") + "." for t in (o.tasks or [])], o.description, o.expected_outcome]
    return "\n".join(p for p in parts if p)


def student_text(p: StudentProfile) -> str:
    parts = [p.bio]
    parts += [f"{pp.title}. {pp.description}" for pp in p.past_projects]
    if p.courses:
        parts.append("Courses: " + ", ".join(p.courses) + ".")
    known = [SKILL_BY_ID[s.skill_id]["name"] for s in p.skills if s.level > 0 and s.skill_id in SKILL_BY_ID]
    if known:
        parts.append("Skills: " + ", ".join(known) + ".")
    return "\n".join(x for x in parts if x)


def opportunity_vectors(db: Session, o: Opportunity) -> list[list[float]]:
    vectors, new_cache = embed_cached(opportunity_text(o), o.embedding)
    if new_cache is not None:
        o.embedding = new_cache
        db.add(o)
        db.commit()
    return vectors


def student_vectors(db: Session, p: StudentProfile) -> list[list[float]]:
    vectors, new_cache = embed_cached(student_text(p), p.embedding)
    if new_cache is not None:
        p.embedding = new_cache
        db.add(p)
        db.commit()
    return vectors


# ---------------------------------------------------------------- views
def to_opportunity_view(o: Opportunity) -> OpportunityView:
    return OpportunityView(
        id=o.id, type=o.type, title=o.title, domain=o.domain or "", hours_per_week=o.hours_per_week,
        start_date=o.start_date, duration_weeks=o.duration_weeks, deadline=o.deadline, work_mode=o.work_mode,
        city=o.city or "", compensation_type=o.compensation_type, compensation_amount=o.compensation_amount or 0,
        academic_options=list(o.academic_options or []), mentoring_offered=o.mentoring_offered,
        requirements=[Requirement(r.skill_id, r.min_level, r.mandatory, r.learnable) for r in o.skills],
    )


def verified_projects(db: Session, student_id: int) -> list[Opportunity]:
    return (
        db.query(Opportunity)
        .filter(Opportunity.selected_student_id == student_id, Opportunity.status == "completed")
        .order_by(Opportunity.created_at.desc())
        .all()
    )


def to_student_view(db: Session, p: StudentProfile) -> StudentView:
    ratings = {
        r.opportunity_id: r.overall
        for r in db.query(Review).filter(Review.reviewee_id == p.user_id, Review.direction == "company_to_student")
    }
    verified = [
        ProjectRecord({r.skill_id for r in o.skills}, o.domain or "", ratings.get(o.id)) for o in verified_projects(db, p.user_id)
    ]
    declared = [ProjectRecord(set(pp.skills or []), pp.domain or "") for pp in p.past_projects]
    return StudentView(
        id=p.user_id, name=p.user.name if p.user else "", accepted_types=list(p.accepted_types or []),
        goals=list(p.goals or []), domains=list(p.domains or []), hours_per_week=p.hours_per_week,
        available_from=p.available_from, available_to=p.available_to, work_mode=p.work_mode, city=p.city or "",
        skills={s.skill_id: (s.level, s.wants_to_learn) for s in p.skills},
        verified_projects=verified, declared_projects=declared,
    )


# ---------------------------------------------------------------- public API
def match_pair(db: Session, p: StudentProfile, o: Opportunity, weights_override: Weights | None = None) -> dict:
    sem = chunk_similarity(opportunity_vectors(db, o), student_vectors(db, p))
    return match(to_student_view(db, p), to_opportunity_view(o), semantic=sem, related=related_skills,
                 weights=weights_override or weights(), lang=i18n.lang())


def rank_opportunities_for_student(db: Session, p: StudentProfile, opportunities: list[Opportunity]) -> list[dict]:
    sv = to_student_view(db, p)
    s_vec = student_vectors(db, p)
    w = weights()
    results = []
    for o in opportunities:
        sem = chunk_similarity(opportunity_vectors(db, o), s_vec)
        results.append(match(sv, to_opportunity_view(o), semantic=sem, related=related_skills, weights=w, lang=i18n.lang()))
    return sorted(results, key=rank_key)


def rank_students_for_opportunity(db: Session, o: Opportunity, students: list[StudentProfile]) -> list[dict]:
    ov = to_opportunity_view(o)
    o_vec = opportunity_vectors(db, o)
    w = weights()
    results = []
    for p in students:
        sem = chunk_similarity(o_vec, student_vectors(db, p))
        results.append(match(to_student_view(db, p), ov, semantic=sem, related=related_skills, weights=w,
                             lang=i18n.lang()))
    return sorted(results, key=rank_key)

