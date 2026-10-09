"""Swipe matching: students swipe opportunities, companies swipe students. Two right swipes make a match.

A pending application counts as the student's right swipe and a pending invitation as the company's, so the swipe
decks and the classic apply / invite buttons work together. A match is an Application with kind "match", which
opens messaging and lets the company select the student like any accepted application.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..db import get_db
from ..deps import log_event, require_role
from ..matching.service import match_pair, rank_opportunities_for_student, rank_students_for_opportunity
from ..models import Application, Opportunity, StudentProfile, Swipe, User
from ..schemas import SwipeIn, UndoSwipeIn
from ..serializers import iso, opportunity_out, portfolio, rating_summary, skill_name, user_brief

router = APIRouter(prefix="/api/swipe", tags=["swipe"])


def _open_opportunity(db: Session, opp_id: int) -> Opportunity:
    o = db.get(Opportunity, opp_id)
    if not o:
        raise HTTPException(404, "Opportunity not found")
    if o.status != "open":
        raise HTTPException(409, "This opportunity is not open any more")
    return o


def _pair(user: User, o: Opportunity, student_id: int | None, db: Session) -> int:
    """Return the student of the swiped pair and check that the user may swipe on it."""
    if user.role == "student":
        return user.id
    if o.company_id != user.id:
        raise HTTPException(403, "Only the company that posted this opportunity can do this")
    if student_id is None or not db.get(StudentProfile, student_id):
        raise HTTPException(404, "Student not found")
    return student_id


def liked_by(db: Session, o: Opportunity, student_id: int, side: str) -> bool:
    """Did `side` (student / company) already say yes to this pair, by a swipe or by applying / inviting?"""
    s = db.query(Swipe).filter_by(opportunity_id=o.id, student_id=student_id, actor_role=side).first()
    if s is not None:
        return s.liked
    a = db.query(Application).filter_by(opportunity_id=o.id, student_id=student_id, status="pending").first()
    return bool(a and a.kind == ("application" if side == "student" else "invitation"))


def _match_out(db: Session, a: Application) -> dict:
    o = a.opportunity
    return {"application_id": a.id, "status": a.status, "created_at": iso(a.created_at), "match_score": a.match_score,
            "opportunity": {"id": o.id, "title": o.title, "type": o.type, "status": o.status},
            "student": user_brief(a.student), "company": user_brief(o.company)}


# ---------------------------------------------------------------- decks
@router.get("/student/deck")
def student_deck(user: User = Depends(require_role("student")), db: Session = Depends(get_db)):
    """Open opportunities the student has not swiped yet, best fit first. Clear mismatches are left out."""
    p = db.get(StudentProfile, user.id)
    swiped = {s.opportunity_id for s in db.query(Swipe).filter_by(student_id=user.id, actor_role="student")}
    apps = {a.opportunity_id: a for a in db.query(Application).filter_by(student_id=user.id)}
    invited = {oid for oid, a in apps.items() if a.kind == "invitation" and a.status == "pending"}
    opps = {
        o.id: o for o in db.query(Opportunity).filter(Opportunity.status == "open")
        if o.id not in swiped and (o.id not in apps or o.id in invited)
    }
    cards = []
    for r in rank_opportunities_for_student(db, p, list(opps.values())):
        if r["status"] == "incompatible":
            continue
        card = opportunity_out(db, opps[r["opportunity_id"]], match=r)
        card["invited"] = r["opportunity_id"] in invited
        cards.append(card)
    return cards


def _student_card(db: Session, p: StudentProfile) -> dict:
    pf = portfolio(db, p.user_id)
    return {
        "id": p.user_id, "name": p.user.name, "headline": p.user.headline, "university": p.university,
        "study_program": p.study_program, "year": p.year, "city": p.city, "bio": p.bio,
        "hours_per_week": p.hours_per_week, "work_mode": p.work_mode,
        "top_skills": [{"skill_id": s.skill_id, "name": skill_name(s.skill_id), "level": s.level}
                       for s in sorted(p.skills, key=lambda s: -s.level) if s.level > 0][:6],
        "learning": [skill_name(s.skill_id) for s in p.skills if s.wants_to_learn],
        "completed_projects": pf["completed"], "rating": rating_summary(db, p.user_id)["average"],
    }


@router.get("/company/deck")
def company_deck(opportunity_id: int | None = None, user: User = Depends(require_role("company")),
                 db: Session = Depends(get_db)):
    """Students to swipe for one open opportunity, or for all of them (each card says which one)."""
    q = db.query(Opportunity).filter(Opportunity.company_id == user.id, Opportunity.status == "open")
    if opportunity_id is not None:
        q = q.filter(Opportunity.id == opportunity_id)
    profiles = db.query(StudentProfile).all()
    cards = []
    for o in q.all():
        swiped = {s.student_id for s in db.query(Swipe).filter_by(opportunity_id=o.id, actor_role="company")}
        apps = {a.student_id: a for a in db.query(Application).filter_by(opportunity_id=o.id)}
        applied = {sid for sid, a in apps.items() if a.kind == "application" and a.status == "pending"}
        eligible = {p.user_id: p for p in profiles if p.user_id not in swiped and (p.user_id not in apps or p.user_id in applied)}
        for r in rank_students_for_opportunity(db, o, list(eligible.values())):
            if r["status"] == "incompatible":
                continue
            sid = r["student_id"]
            cards.append({
                "opportunity": {"id": o.id, "title": o.title, "type": o.type},
                "student": _student_card(db, eligible[sid]),
                "match": r,
                "applied": sid in applied,
                "application_message": apps[sid].message if sid in applied else "",
            })
    cards.sort(key=lambda c: -c["match"]["score"])
    return cards


# ---------------------------------------------------------------- swipe, undo, matches
@router.post("")
def swipe(body: SwipeIn, user: User = Depends(require_role("student", "company")), db: Session = Depends(get_db)):
    o = _open_opportunity(db, body.opportunity_id)
    student_id = _pair(user, o, body.student_id, db)
    a = db.query(Application).filter_by(opportunity_id=o.id, student_id=student_id).first()
    if a and a.kind == "match":
        raise HTTPException(409, "You already matched")

    s = db.query(Swipe).filter_by(opportunity_id=o.id, student_id=student_id, actor_role=user.role).first()
    if s is None:
        s = Swipe(opportunity_id=o.id, student_id=student_id, actor_role=user.role, liked=body.liked)
        db.add(s)
    s.liked = body.liked
    score = match_pair(db, db.get(StudentProfile, student_id), o)["score"]
    log_event(db, "swipe_right" if body.liked else "swipe_left", user.id, student_id, o.id, score)

    other = "company" if user.role == "student" else "student"
    if not (body.liked and liked_by(db, o, student_id, other)):
        db.commit()
        return {"matched": False}
    if a is None:
        a = Application(opportunity_id=o.id, student_id=student_id, kind="match", status="accepted", match_score=score)
        db.add(a)
    elif a.status == "pending":
        a.kind, a.status = "match", "accepted"
    else:  # e.g. the student withdrew earlier: keep the old decision
        db.commit()
        return {"matched": False}
    log_event(db, "match", user.id, student_id, o.id, score)
    db.commit()
    return {"matched": True, "match": _match_out(db, a)}


@router.post("/undo")
def undo(body: UndoSwipeIn, user: User = Depends(require_role("student", "company")), db: Session = Depends(get_db)):
    o = db.get(Opportunity, body.opportunity_id)
    if not o:
        raise HTTPException(404, "Opportunity not found")
    student_id = _pair(user, o, body.student_id, db)
    if db.query(Application).filter_by(opportunity_id=o.id, student_id=student_id, kind="match").first():
        raise HTTPException(409, "You already matched, a match cannot be undone")
    s = db.query(Swipe).filter_by(opportunity_id=o.id, student_id=student_id, actor_role=user.role).first()
    if not s:
        raise HTTPException(404, "Nothing to undo")
    db.delete(s)
    log_event(db, "swipe_undo", user.id, student_id, o.id)
    db.commit()
    return {"ok": True}


@router.get("/matches")
def matches(user: User = Depends(require_role("student", "company")), db: Session = Depends(get_db)):
    q = db.query(Application).filter(Application.kind == "match")
    if user.role == "student":
        q = q.filter(Application.student_id == user.id)
    else:
        q = q.join(Opportunity, Application.opportunity_id == Opportunity.id).filter(Opportunity.company_id == user.id)
    return [_match_out(db, a) for a in q.order_by(Application.created_at.desc(), Application.id.desc())]
