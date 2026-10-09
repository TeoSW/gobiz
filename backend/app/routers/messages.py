from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import and_, or_
from sqlalchemy.orm import Session

from ..db import get_db
from ..i18n import tr
from ..deps import current_user
from ..models import Application, Message, Opportunity, User
from ..schemas import MessageIn
from ..serializers import iso, user_brief

router = APIRouter(prefix="/api/messages", tags=["messages"])


def _may_talk(db: Session, o: Opportunity, a: int, b: int) -> bool:
    """Messaging is scoped to an opportunity: company <-> a student who applied, was invited or selected."""
    company, other = (a, b) if a == o.company_id else (b, a) if b == o.company_id else (None, None)
    if company is None:
        return False
    return o.selected_student_id == other or bool(
        db.query(Application).filter_by(opportunity_id=o.id, student_id=other).first()
    )


@router.get("/threads")
def threads(user: User = Depends(current_user), db: Session = Depends(get_db)):
    msgs = (
        db.query(Message)
        .filter(or_(Message.sender_id == user.id, Message.recipient_id == user.id))
        .order_by(Message.created_at.desc(), Message.id.desc())
        .all()
    )
    seen: dict[tuple[int, int], dict] = {}
    for m in msgs:
        other = m.recipient_id if m.sender_id == user.id else m.sender_id
        key = (m.opportunity_id, other)
        if key not in seen:
            o = db.get(Opportunity, m.opportunity_id)
            seen[key] = {"opportunity": {"id": o.id, "title": o.title, "status": o.status},
                         "with": user_brief(db.get(User, other)), "last": m.body[:140],
                         "last_at": iso(m.created_at), "unread": 0}
        if m.recipient_id == user.id and not m.read:
            seen[key]["unread"] += 1
    # new swipe matches show up as conversations before anyone writes
    new: list[dict] = []
    q = db.query(Application).filter(Application.kind == "match")
    if user.role == "student":
        q = q.filter(Application.student_id == user.id)
    else:
        q = q.join(Opportunity, Application.opportunity_id == Opportunity.id).filter(Opportunity.company_id == user.id)
    for a in q.order_by(Application.created_at.desc()):
        o = a.opportunity
        other = o.company_id if user.role == "student" else a.student_id
        if (o.id, other) not in seen:
            new.append({"opportunity": {"id": o.id, "title": o.title, "status": o.status},
                        "with": user_brief(db.get(User, other)), "last": tr("thread.new_match"),
                        "last_at": iso(a.created_at), "unread": 0, "new_match": True})
    return new + list(seen.values())


@router.get("")
def conversation(opportunity_id: int, with_user: int, user: User = Depends(current_user), db: Session = Depends(get_db)):
    msgs = (
        db.query(Message)
        .filter(Message.opportunity_id == opportunity_id,
                or_(and_(Message.sender_id == user.id, Message.recipient_id == with_user),
                    and_(Message.sender_id == with_user, Message.recipient_id == user.id)))
        .order_by(Message.created_at, Message.id)
        .all()
    )
    for m in msgs:
        if m.recipient_id == user.id:
            m.read = True
    db.commit()
    return [{"id": m.id, "mine": m.sender_id == user.id, "body": m.body, "created_at": iso(m.created_at)} for m in msgs]


@router.post("", status_code=201)
def send(body: MessageIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    o = db.get(Opportunity, body.opportunity_id)
    if not o or not _may_talk(db, o, user.id, body.recipient_id):
        raise HTTPException(403, "You can message only within an opportunity you are part of")
    m = Message(opportunity_id=o.id, sender_id=user.id, recipient_id=body.recipient_id, body=body.body.strip())
    db.add(m)
    db.commit()
    return {"id": m.id, "mine": True, "body": m.body, "created_at": iso(m.created_at)}
