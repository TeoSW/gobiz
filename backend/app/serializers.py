"""Model -> JSON dict helpers shared by routers."""

from collections import Counter

from sqlalchemy import func
from sqlalchemy.orm import Session

from .matching.service import verified_projects
from .models import Application, CompanyProfile, Opportunity, Review, StudentProfile, User
from .skills_catalog import SKILL_BY_ID


def iso(d):
    return d.isoformat() if d else None


def user_brief(u: User | None) -> dict | None:
    if u is None:
        return None
    return {"id": u.id, "name": u.name, "role": u.role, "headline": u.headline}


def skill_name(sid: str) -> str:
    return SKILL_BY_ID.get(sid, {}).get("name", sid)


def rating_summary(db: Session, user_id: int) -> dict:
    rows = db.query(Review).filter(Review.reviewee_id == user_id).all()
    if not rows:
        return {"count": 0, "average": None, "dimensions": {}}
    dims: dict[str, list[int]] = {}
    for r in rows:
        for k, v in r.ratings.items():
            dims.setdefault(k, []).append(v)
    return {
        "count": len(rows),
        "average": round(sum(r.overall for r in rows) / len(rows), 2),
        "dimensions": {k: round(sum(v) / len(v), 2) for k, v in dims.items()},
    }


def requirement_out(r) -> dict:
    sk = SKILL_BY_ID.get(r.skill_id, {})
    return {"skill_id": r.skill_id, "name": sk.get("name", r.skill_id), "category": sk.get("category", "other"),
            "min_level": r.min_level, "mandatory": r.mandatory, "learnable": r.learnable, "source": r.source}


def opportunity_out(db: Session, o: Opportunity, match: dict | None = None, detail: bool = False) -> dict:
    company = o.company
    cp = db.get(CompanyProfile, o.company_id)
    counts = dict(
        db.query(Application.kind, func.count(Application.id)).filter(Application.opportunity_id == o.id).group_by(Application.kind).all()
    )
    out = {
        "id": o.id, "type": o.type, "title": o.title, "description": o.description, "tasks": o.tasks or [],
        "expected_outcome": o.expected_outcome, "domain": o.domain, "difficulty": o.difficulty,
        "hours_per_week": o.hours_per_week, "duration_weeks": o.duration_weeks, "start_date": iso(o.start_date),
        "deadline": iso(o.deadline), "work_mode": o.work_mode, "city": o.city,
        "compensation_type": o.compensation_type, "compensation_amount": o.compensation_amount, "currency": o.currency,
        "academic_options": o.academic_options or [], "mentoring_offered": o.mentoring_offered, "status": o.status,
        "university_verified": o.university_verified, "verification_requested": o.verification_requested,
        "selected_student": user_brief(db.get(User, o.selected_student_id)) if o.selected_student_id else None,
        "created_at": iso(o.created_at),
        "company": {"id": company.id, "name": company.name, "industry": cp.industry if cp else "",
                    "city": cp.city if cp else "", "size": cp.size if cp else ""},
        "skills": [requirement_out(r) for r in sorted(o.skills, key=lambda r: (not r.mandatory, r.skill_id))],
        "applications_count": counts.get("application", 0),
        "invitations_count": counts.get("invitation", 0),
        "match": match,
    }
    if detail:
        out["ai_extraction"] = o.ai_extraction
        out["verified_by"] = user_brief(db.get(User, o.verified_by)) if o.verified_by else None
    return out


def portfolio(db: Session, student_id: int) -> dict:
    projects = verified_projects(db, student_id)
    reviews = {
        r.opportunity_id: r
        for r in db.query(Review).filter(Review.reviewee_id == student_id, Review.direction == "company_to_student")
    }
    skill_counter: Counter = Counter()
    items = []
    for o in projects:
        ids = [r.skill_id for r in o.skills]
        skill_counter.update(ids)
        rv = reviews.get(o.id)
        items.append({
            "opportunity_id": o.id, "title": o.title, "type": o.type, "company": o.company.name,
            "domain": o.domain, "skills": [skill_name(s) for s in ids], "completed_at": iso(o.deadline or o.created_at),
            "university_verified": o.university_verified,
            "rating": rv.overall if rv else None, "review": rv.comment if rv else "",
        })
    ratings = [i["rating"] for i in items if i["rating"] is not None]
    return {
        "completed": len(items),
        "by_skill": [{"skill_id": k, "name": skill_name(k), "count": n} for k, n in skill_counter.most_common(6)],
        "average_rating": round(sum(ratings) / len(ratings), 2) if ratings else None,
        "items": items,
    }


def student_out(db: Session, p: StudentProfile, private: bool = False) -> dict:
    u = p.user
    out = {
        "id": u.id, "name": u.name, "headline": u.headline, "email": u.email if private else None,
        "university": p.university, "faculty": p.faculty, "study_program": p.study_program,
        "study_level": p.study_level, "year": p.year, "city": p.city, "bio": p.bio,
        "accepted_types": p.accepted_types or [], "goals": p.goals or [], "domains": p.domains or [],
        "courses": p.courses or [], "hours_per_week": p.hours_per_week, "available_from": iso(p.available_from),
        "available_to": iso(p.available_to), "work_mode": p.work_mode, "portfolio_url": p.portfolio_url,
        "github_url": p.github_url, "cv_filename": p.cv_filename,
        "skills": sorted(
            [{"skill_id": s.skill_id, "name": skill_name(s.skill_id),
              "category": SKILL_BY_ID.get(s.skill_id, {}).get("category", "other"),
              "level": s.level, "wants_to_learn": s.wants_to_learn} for s in p.skills],
            key=lambda s: (-s["level"], s["name"]),
        ),
        "past_projects": [{"id": pp.id, "title": pp.title, "description": pp.description, "skills": pp.skills or [],
                           "domain": pp.domain, "url": pp.url} for pp in p.past_projects],
        "portfolio": portfolio(db, u.id),
        "ratings": rating_summary(db, u.id),
    }
    return out


def company_out(db: Session, u: User) -> dict:
    cp = db.get(CompanyProfile, u.id)
    n_opps = db.query(Opportunity).filter(Opportunity.company_id == u.id).count()
    return {
        "id": u.id, "name": u.name, "headline": u.headline,
        "industry": cp.industry if cp else "", "size": cp.size if cp else "", "city": cp.city if cp else "",
        "website": cp.website if cp else "", "description": cp.description if cp else "",
        "opportunities": n_opps, "ratings": rating_summary(db, u.id),
    }
