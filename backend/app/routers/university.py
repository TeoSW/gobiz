from collections import Counter, defaultdict

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from .. import graph
from ..db import get_db
from ..deps import current_user, log_event, require_role
from ..models import MentorshipRequest, Opportunity, Review, StudentProfile, StudentSkill, User
from ..schemas import MentorshipRespondIn
from ..serializers import iso, opportunity_out, skill_name, user_brief

router = APIRouter(prefix="/api", tags=["university"])


class VerifyIn(BaseModel):
    approve: bool = True


@router.get("/university/dashboard")
def dashboard(_user: User = Depends(require_role("university")), db: Session = Depends(get_db)):
    opps = db.query(Opportunity).filter(Opportunity.status != "draft").all()
    students = db.query(StudentProfile).all()
    n_opps, n_students = len(opps) or 1, len(students) or 1

    by_type = Counter(o.type for o in opps)
    by_status = Counter(o.status for o in opps)
    comp: dict[str, list[float]] = defaultdict(list)
    for o in opps:
        if o.compensation_amount > 0:
            comp[f"{o.type}:{o.compensation_type}"].append(o.compensation_amount)

    demand = Counter()
    mandatory_demand = Counter()
    for o in opps:
        for r in o.skills:
            demand[r.skill_id] += 1
            if r.mandatory:
                mandatory_demand[r.skill_id] += 1
    supply = Counter()
    want = Counter()
    for ss in db.query(StudentSkill).all():
        if ss.level >= 2:
            supply[ss.skill_id] += 1
        if ss.wants_to_learn:
            want[ss.skill_id] += 1

    top_skills = [
        {"skill_id": k, "name": skill_name(k), "opportunities": n, "mandatory": mandatory_demand[k]}
        for k, n in demand.most_common(12)
    ]
    gap = sorted(
        (
            {"skill_id": k, "name": skill_name(k),
             "demand_pct": round(100 * n / n_opps, 1),
             "supply_pct": round(100 * supply[k] / n_students, 1),
             "gap": round(100 * n / n_opps - 100 * supply[k] / n_students, 1),
             "students_want_to_learn": want[k]}
            for k, n in demand.items()
        ),
        key=lambda x: -x["gap"],
    )[:10]
    domains = Counter(o.domain for o in opps if o.domain)
    academic = Counter(a for o in opps for a in (o.academic_options or []))
    ratings = [r.overall for r in db.query(Review).filter(Review.direction == "company_to_student")]

    return {
        "kpis": {
            "opportunities": len(opps),
            "open": by_status.get("open", 0),
            "completed": by_status.get("completed", 0),
            "in_progress": by_status.get("in_progress", 0) + by_status.get("delivered", 0) + by_status.get("paid", 0),
            "students": len(students),
            "companies": db.query(User).filter(User.role == "company").count(),
            "university_verified": sum(o.university_verified for o in opps),
            "avg_student_rating": round(sum(ratings) / len(ratings), 2) if ratings else None,
        },
        "by_type": [{"type": t, "count": by_type.get(t, 0)} for t in ("project", "internship", "job")],
        "compensation": [
            {"key": k, "type": k.split(":")[0], "unit": k.split(":")[1], "average": round(sum(v) / len(v)), "count": len(v)}
            for k, v in sorted(comp.items())
        ],
        "top_skills": top_skills,
        "skill_gap": gap,
        "domains": [{"domain": d, "count": n} for d, n in domains.most_common(10)],
        "academic": [{"option": k, "count": academic.get(k, 0)} for k in ("course_credit", "mandatory_practice", "thesis")],
        "co_demand": graph.co_demand(db, 10),
    }


@router.get("/university/verification-queue")
def verification_queue(_user: User = Depends(require_role("university")), db: Session = Depends(get_db)):
    opps = (
        db.query(Opportunity)
        .filter(Opportunity.verification_requested.is_(True), Opportunity.university_verified.is_(False))
        .order_by(Opportunity.created_at.desc())
        .all()
    )
    return [opportunity_out(db, o) for o in opps]


@router.post("/university/opportunities/{opp_id}/verify")
def verify(opp_id: int, body: VerifyIn, user: User = Depends(require_role("university")), db: Session = Depends(get_db)):
    o = db.get(Opportunity, opp_id)
    if not o:
        raise HTTPException(404, "Opportunity not found")
    o.university_verified = body.approve
    o.verification_requested = False
    o.verified_by = user.id if body.approve else None
    log_event(db, "verified" if body.approve else "verification_rejected", user.id, opportunity_id=o.id)
    db.commit()
    return opportunity_out(db, o)


@router.get("/university/mentorship")
def mentorship_requests(_user: User = Depends(require_role("university")), db: Session = Depends(get_db)):
    rows = db.query(MentorshipRequest).order_by(MentorshipRequest.created_at.desc()).all()
    return [
        {"id": r.id, "status": r.status, "note": r.note, "created_at": iso(r.created_at),
         "student": user_brief(r.student), "mentor": user_brief(db.get(User, r.mentor_id)) if r.mentor_id else None,
         "opportunity": {"id": r.opportunity.id, "title": r.opportunity.title, "type": r.opportunity.type,
                         "company": r.opportunity.company.name}}
        for r in rows
    ]


@router.post("/university/mentorship/{req_id}/respond")
def respond_mentorship(req_id: int, body: MentorshipRespondIn, user: User = Depends(require_role("university")),
                       db: Session = Depends(get_db)):
    r = db.get(MentorshipRequest, req_id)
    if not r:
        raise HTTPException(404, "Not found")
    r.status = "accepted" if body.action == "accept" else "declined"
    r.mentor_id = user.id if body.action == "accept" else None
    log_event(db, f"mentorship_{r.status}", user.id, r.student_id, r.opportunity_id)
    db.commit()
    return {"id": r.id, "status": r.status}


# ------------------------------------------------------------------ knowledge graph
@router.get("/graph/status")
def graph_status():
    return graph.status()


@router.get("/graph/skills/{skill_id}")
def graph_skill(skill_id: str, _user: User = Depends(current_user), db: Session = Depends(get_db)):
    data = graph.skill_neighborhood(db, skill_id)
    data["name"] = skill_name(skill_id)
    data["related"] = [{"id": s, "name": skill_name(s)} for s in data["related"]]
    data["co_demanded"] = [{**c, "name": skill_name(c["id"])} for c in data["co_demanded"]]
    return data


@router.post("/graph/sync")
def graph_sync(_user: User = Depends(current_user), db: Session = Depends(get_db)):
    ok = graph.sync_all(db)
    return {"synced": ok, **graph.status()}
