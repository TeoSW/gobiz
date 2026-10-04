from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import graph
from ..db import SessionLocal, get_db
from ..deps import current_user, log_event, optional_user, require_role
from ..matching.engine import rank_key
from ..matching.service import match_pair, rank_opportunities_for_student, rank_students_for_opportunity
from ..models import Application, MentorshipRequest, Message, Opportunity, OpportunitySkill, Review, StudentProfile, User
from ..schemas import ApplyIn, InviteIn, MentorshipIn, OpportunityIn, ReviewIn, SelectIn, StatusIn
from ..serializers import iso, opportunity_out, user_brief
from ..skills_catalog import SKILL_BY_ID

router = APIRouter(prefix="/api/opportunities", tags=["opportunities"])

REVIEW_DIMENSIONS = {
    "company_to_student": ("quality", "deadline", "communication"),
    "student_to_company": ("clarity", "collaboration", "payment"),
}
# allowed transitions: status -> {next status: who may trigger it}
TRANSITIONS = {
    "draft": {"open": "company", "closed": "company"},
    "open": {"in_progress": "company", "closed": "company"},
    "in_progress": {"delivered": "student", "closed": "company"},
    "delivered": {"paid": "company", "in_progress": "company"},
    "paid": {"completed": "company"},
}


def _sync_graph_bg():
    with SessionLocal() as db:
        graph.safe_sync(db)


def _get(db: Session, opp_id: int) -> Opportunity:
    o = db.get(Opportunity, opp_id)
    if not o:
        raise HTTPException(404, "Opportunity not found")
    return o


def _own(o: Opportunity, user: User) -> None:
    if o.company_id != user.id:
        raise HTTPException(403, "Only the company that posted this opportunity can do this")


def _apply_body(o: Opportunity, body: OpportunityIn) -> None:
    for field in ("type", "title", "description", "expected_outcome", "difficulty", "hours_per_week", "duration_weeks",
                  "start_date", "deadline", "work_mode", "city", "compensation_type", "compensation_amount",
                  "mentoring_offered"):
        setattr(o, field, getattr(body, field))
    o.tasks = [t.strip() for t in body.tasks if t.strip()]
    o.domain = body.domain.lower().strip()
    o.academic_options = list(dict.fromkeys(body.academic_options))
    if body.compensation_type == "unpaid":
        o.compensation_amount = 0
    unknown = [r.skill_id for r in body.requirements if r.skill_id not in SKILL_BY_ID]
    if unknown:
        raise HTTPException(422, f"Unknown skills: {', '.join(unknown)}")
    o.skills.clear()
    seen = set()
    for r in body.requirements:
        if r.skill_id in seen:
            continue
        seen.add(r.skill_id)
        o.skills.append(OpportunitySkill(skill_id=r.skill_id, min_level=r.min_level, mandatory=r.mandatory,
                                         learnable=r.learnable, source=r.source))


@router.get("")
def list_opportunities(type: str | None = None, q: str = "", skill: str | None = None, work_mode: str | None = None,
                       verified: bool = False, academic: str | None = None, mentoring: bool = False,
                       sort: str = "recent", user: User | None = Depends(optional_user), db: Session = Depends(get_db)):
    query = db.query(Opportunity).filter(Opportunity.status == "open")
    if type:
        query = query.filter(Opportunity.type == type)
    if work_mode:
        query = query.filter(Opportunity.work_mode == work_mode)
    if verified:
        query = query.filter(Opportunity.university_verified.is_(True))
    if mentoring:
        query = query.filter(Opportunity.mentoring_offered.is_(True))
    opps = query.order_by(Opportunity.created_at.desc(), Opportunity.id.desc()).all()
    if skill:
        opps = [o for o in opps if any(r.skill_id == skill for r in o.skills)]
    if academic:
        opps = [o for o in opps if academic in (o.academic_options or [])]
    if q.strip():
        needle = q.lower().strip()
        opps = [o for o in opps if needle in f"{o.title} {o.description} {o.company.name} {o.domain}".lower()
                or any(needle in SKILL_BY_ID.get(r.skill_id, {}).get("name", "").lower() for r in o.skills)]

    matches: dict[int, dict] = {}
    if user and user.role == "student":
        p = db.get(StudentProfile, user.id)
        if p:
            matches = {m["opportunity_id"]: m for m in rank_opportunities_for_student(db, p, opps)}
    out = [opportunity_out(db, o, match=matches.get(o.id)) for o in opps]
    if sort == "match" and matches:
        out.sort(key=lambda x: rank_key(x["match"]))
    elif sort == "budget":
        out.sort(key=lambda x: -x["compensation_amount"])
    return out


@router.get("/mine")
def my_opportunities(user: User = Depends(require_role("company")), db: Session = Depends(get_db)):
    opps = db.query(Opportunity).filter(Opportunity.company_id == user.id).order_by(Opportunity.created_at.desc(), Opportunity.id.desc()).all()
    return [opportunity_out(db, o) for o in opps]


@router.post("", status_code=201)
def create_opportunity(body: OpportunityIn, bg: BackgroundTasks, user: User = Depends(require_role("company")),
                       db: Session = Depends(get_db)):
    o = Opportunity(company_id=user.id, status=body.status, verification_requested=body.request_verification,
                    ai_extraction=body.ai_extraction)
    _apply_body(o, body)
    db.add(o)
    db.commit()
    log_event(db, "opportunity_published", user.id, opportunity_id=o.id)
    db.commit()
    bg.add_task(_sync_graph_bg)
    return opportunity_out(db, o, detail=True)


@router.put("/{opp_id}")
def update_opportunity(opp_id: int, body: OpportunityIn, bg: BackgroundTasks,
                       user: User = Depends(require_role("company")), db: Session = Depends(get_db)):
    o = _get(db, opp_id)
    _own(o, user)
    _apply_body(o, body)
    if body.request_verification and not o.university_verified:
        o.verification_requested = True
    db.commit()
    bg.add_task(_sync_graph_bg)
    return opportunity_out(db, o, detail=True)


@router.get("/{opp_id}")
def get_opportunity(opp_id: int, user: User | None = Depends(optional_user), db: Session = Depends(get_db)):
    o = _get(db, opp_id)
    out = opportunity_out(db, o, detail=True)
    if user and user.role == "student":
        p = db.get(StudentProfile, user.id)
        out["match"] = match_pair(db, p, o) if p else None
        app = db.query(Application).filter_by(opportunity_id=o.id, student_id=user.id).first()
        out["my_application"] = (
            {"id": app.id, "kind": app.kind, "status": app.status, "created_at": iso(app.created_at)} if app else None
        )
        mr = db.query(MentorshipRequest).filter_by(opportunity_id=o.id, student_id=user.id).first()
        out["my_mentorship"] = {"status": mr.status, "mentor": user_brief(db.get(User, mr.mentor_id)) if mr.mentor_id else None} if mr else None
        log_event(db, "view", user.id, student_id=user.id, opportunity_id=o.id,
                  match_score=out["match"]["score"] if out["match"] else None)
        db.commit()
    out["is_owner"] = bool(user and user.id == o.company_id)
    out["reviews"] = _reviews(db, o)
    return out


@router.get("/{opp_id}/candidates")
def candidates(opp_id: int, user: User = Depends(require_role("company")), db: Session = Depends(get_db)):
    """AI Match ranking over all students + applicants + invited, so the company keeps full freedom of choice."""
    o = _get(db, opp_id)
    _own(o, user)
    students = {p.user_id: p for p in db.query(StudentProfile).all()}
    ranked = rank_students_for_opportunity(db, o, list(students.values()))
    by_student = {r["student_id"]: r for r in ranked}
    apps = db.query(Application).filter(Application.opportunity_id == o.id).order_by(Application.created_at.desc()).all()
    app_by_student = {a.student_id: a for a in apps}

    def card(sid: int) -> dict:
        p = students[sid]
        a = app_by_student.get(sid)
        return {
            "student": {"id": sid, "name": p.user.name, "headline": p.user.headline, "university": p.university,
                        "year": p.year, "city": p.city},
            "match": by_student[sid],
            "application": {"id": a.id, "kind": a.kind, "status": a.status, "message": a.message,
                            "created_at": iso(a.created_at)} if a else None,
        }

    return {
        "ai_matches": [card(r["student_id"]) for r in ranked if r["status"] != "incompatible"][:12],
        "applicants": [card(a.student_id) for a in apps if a.kind == "application"],
        "invited": [card(a.student_id) for a in apps if a.kind == "invitation"],
        "all_count": len(ranked),
    }


@router.post("/{opp_id}/apply", status_code=201)
def apply(opp_id: int, body: ApplyIn, user: User = Depends(require_role("student")), db: Session = Depends(get_db)):
    o = _get(db, opp_id)
    if o.status != "open":
        raise HTTPException(409, "This opportunity is not accepting applications")
    p = db.get(StudentProfile, user.id)
    m = match_pair(db, p, o)
    existing = db.query(Application).filter_by(opportunity_id=o.id, student_id=user.id).first()
    if existing:
        if existing.kind == "invitation" and existing.status == "pending":
            existing.status = "accepted"
            existing.message = body.message or existing.message
            log_event(db, "invite_accepted", user.id, user.id, o.id, m["score"])
            db.commit()
            return {"id": existing.id, "kind": existing.kind, "status": existing.status}
        if existing.status != "withdrawn":
            raise HTTPException(409, "You already applied")
        db.delete(existing)
        db.flush()
    a = Application(opportunity_id=o.id, student_id=user.id, kind="application", message=body.message, match_score=m["score"])
    db.add(a)
    log_event(db, "apply", user.id, user.id, o.id, m["score"])
    db.commit()
    return {"id": a.id, "kind": a.kind, "status": a.status}


@router.post("/{opp_id}/invite", status_code=201)
def invite(opp_id: int, body: InviteIn, user: User = Depends(require_role("company")), db: Session = Depends(get_db)):
    o = _get(db, opp_id)
    _own(o, user)
    p = db.get(StudentProfile, body.student_id)
    if not p:
        raise HTTPException(404, "Student not found")
    if db.query(Application).filter_by(opportunity_id=o.id, student_id=p.user_id).first():
        raise HTTPException(409, "This student already applied or was invited")
    m = match_pair(db, p, o)
    a = Application(opportunity_id=o.id, student_id=p.user_id, kind="invitation", message=body.message, match_score=m["score"])
    db.add(a)
    text = body.message.strip() or f"Hi {p.user.name.split()[0]}, we think you'd be a great fit for \"{o.title}\". Interested?"
    db.add(Message(opportunity_id=o.id, sender_id=user.id, recipient_id=p.user_id, body=text))
    log_event(db, "invite", user.id, p.user_id, o.id, m["score"])
    db.commit()
    return {"id": a.id, "kind": a.kind, "status": a.status}


@router.post("/{opp_id}/select")
def select_student(opp_id: int, body: SelectIn, bg: BackgroundTasks, user: User = Depends(require_role("company")),
                   db: Session = Depends(get_db)):
    o = _get(db, opp_id)
    _own(o, user)
    if o.status != "open":
        raise HTTPException(409, "A student can be selected only while the opportunity is open")
    a = db.query(Application).filter_by(opportunity_id=o.id, student_id=body.student_id).first()
    if not a or a.status in ("declined", "withdrawn") or (a.kind == "invitation" and a.status != "accepted"):
        raise HTTPException(409, "Select a student who applied or accepted your invitation")
    for other in db.query(Application).filter(Application.opportunity_id == o.id):
        if other.id == a.id:
            other.status = "selected"
        elif other.status in ("pending", "accepted"):
            other.status = "rejected"
    o.selected_student_id = body.student_id
    o.status = "in_progress"
    db.add(Message(opportunity_id=o.id, sender_id=user.id, recipient_id=body.student_id,
                   body=f"Good news - you have been selected for \"{o.title}\". Let's get started!"))
    log_event(db, "selected", user.id, body.student_id, o.id, a.match_score)
    db.commit()
    bg.add_task(_sync_graph_bg)
    return opportunity_out(db, o, detail=True)


@router.post("/{opp_id}/status")
def change_status(opp_id: int, body: StatusIn, bg: BackgroundTasks, user: User = Depends(current_user),
                  db: Session = Depends(get_db)):
    o = _get(db, opp_id)
    allowed = TRANSITIONS.get(o.status, {})
    who = allowed.get(body.status)
    if not who:
        raise HTTPException(409, f"Cannot move from {o.status} to {body.status}")
    if who == "company":
        _own(o, user)
    elif user.id != o.selected_student_id:
        raise HTTPException(403, "Only the selected student can mark the work as delivered")
    if body.status == "in_progress" and not o.selected_student_id:
        raise HTTPException(409, "Select a student first")
    o.status = body.status
    log_event(db, f"status_{body.status}", user.id, o.selected_student_id, o.id)
    db.commit()
    bg.add_task(_sync_graph_bg)
    return opportunity_out(db, o, detail=True)


@router.post("/{opp_id}/request-verification")
def request_verification(opp_id: int, user: User = Depends(require_role("company")), db: Session = Depends(get_db)):
    o = _get(db, opp_id)
    _own(o, user)
    o.verification_requested = True
    db.commit()
    return {"ok": True}


@router.post("/{opp_id}/mentorship", status_code=201)
def request_mentorship(opp_id: int, body: MentorshipIn, user: User = Depends(require_role("student")),
                       db: Session = Depends(get_db)):
    o = _get(db, opp_id)
    if db.query(MentorshipRequest).filter_by(opportunity_id=o.id, student_id=user.id).first():
        raise HTTPException(409, "Mentorship already requested")
    db.add(MentorshipRequest(opportunity_id=o.id, student_id=user.id, note=body.note))
    log_event(db, "mentorship_requested", user.id, user.id, o.id)
    db.commit()
    return {"ok": True}


def _reviews(db: Session, o: Opportunity) -> list[dict]:
    return [
        {"id": r.id, "direction": r.direction, "reviewer": user_brief(db.get(User, r.reviewer_id)),
         "ratings": r.ratings, "overall": r.overall, "comment": r.comment, "created_at": iso(r.created_at)}
        for r in db.query(Review).filter(Review.opportunity_id == o.id).order_by(Review.created_at)
    ]


@router.post("/{opp_id}/reviews", status_code=201)
def review(opp_id: int, body: ReviewIn, bg: BackgroundTasks, user: User = Depends(current_user),
           db: Session = Depends(get_db)):
    o = _get(db, opp_id)
    if o.status not in ("paid", "completed"):
        raise HTTPException(409, "Reviews open after payment is confirmed")
    if user.id == o.company_id:
        direction, reviewee = "company_to_student", o.selected_student_id
    elif user.id == o.selected_student_id:
        direction, reviewee = "student_to_company", o.company_id
    else:
        raise HTTPException(403, "Only the company and the selected student can review")
    dims = REVIEW_DIMENSIONS[direction]
    if set(body.ratings) != set(dims) or any(not 1 <= v <= 5 for v in body.ratings.values()):
        raise HTTPException(422, f"Rate each of {', '.join(dims)} from 1 to 5")
    if db.query(Review).filter_by(opportunity_id=o.id, reviewer_id=user.id).first():
        raise HTTPException(409, "You already reviewed this collaboration")
    overall = round(sum(body.ratings.values()) / len(dims), 2)
    db.add(Review(opportunity_id=o.id, reviewer_id=user.id, reviewee_id=reviewee, direction=direction,
                  ratings=body.ratings, overall=overall, comment=body.comment))
    if direction == "company_to_student" and o.status == "paid":
        o.status = "completed"  # the company's review closes the loop -> project enters the verified portfolio
    log_event(db, "rated", user.id, o.selected_student_id, o.id, value=overall)
    db.commit()
    bg.add_task(_sync_graph_bg)
    return {"ok": True, "status": o.status}
