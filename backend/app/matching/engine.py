"""Content-based matching between one student and one opportunity.

Pipeline (from the design discussion):
  1. hard filters  -> incompatible / to_clarify / evaluated
  2. score         = 100 * (w_s*skills + w_e*experience + w_i*interests + w_sem*semantic)
  3. explanation   -> per-skill status, checks, highlights, plain-language summary

The score is a ranking aid, not a probability of success. Everything here is pure (no DB, no model)
so it can be unit-tested and reused by the offline evaluation script.
"""

from dataclasses import dataclass, field
from datetime import date, timedelta
from typing import Callable

from ..skills_catalog import SKILL_BY_ID

LEVEL_NAMES = {0: "none", 1: "beginner", 2: "intermediate", 3: "advanced"}


@dataclass
class Requirement:
    skill_id: str
    min_level: int = 1
    mandatory: bool = False
    learnable: bool = False


@dataclass
class OpportunityView:
    id: int
    type: str
    title: str = ""
    domain: str = ""
    hours_per_week: int = 10
    start_date: date | None = None
    duration_weeks: int = 4
    deadline: date | None = None
    work_mode: str = "remote"
    city: str = ""
    compensation_type: str = "fixed"
    compensation_amount: float = 0
    academic_options: list[str] = field(default_factory=list)
    mentoring_offered: bool = False
    requirements: list[Requirement] = field(default_factory=list)


@dataclass
class ProjectRecord:
    skills: set[str]
    domain: str = ""
    rating: float | None = None  # only for verified (GoBiz-completed) projects


@dataclass
class StudentView:
    id: int
    name: str = ""
    accepted_types: list[str] = field(default_factory=list)
    goals: list[str] = field(default_factory=list)
    domains: list[str] = field(default_factory=list)
    hours_per_week: int = 10
    available_from: date | None = None
    available_to: date | None = None
    work_mode: str = "any"
    city: str = ""
    skills: dict[str, tuple[int, bool]] = field(default_factory=dict)  # skill_id -> (level, wants_to_learn)
    verified_projects: list[ProjectRecord] = field(default_factory=list)
    declared_projects: list[ProjectRecord] = field(default_factory=list)


@dataclass
class Weights:
    skills: float = 0.50
    experience: float = 0.25
    interests: float = 0.15
    semantic: float = 0.10


def _name(skill_id: str) -> str:
    return SKILL_BY_ID.get(skill_id, {}).get("name", skill_id)


def _opportunity_window(o: OpportunityView) -> tuple[date | None, date | None]:
    start = o.start_date
    end = o.deadline or (start + timedelta(weeks=o.duration_weeks) if start else None)
    return start, end


def _goals_served(o: OpportunityView) -> set[str]:
    served = set(o.academic_options)
    if o.type == "project" and o.compensation_amount > 0:
        served.add("paid_project")
    if o.type == "internship":
        served.add("internship")
    if o.type == "job":
        served.add("full_time_job" if o.hours_per_week >= 30 else "part_time_job")
    return served


def _score_skills(s: StudentView, o: OpportunityView, related: Callable[[str], set[str]]):
    rows, blockers, clarify = [], [], []
    total_w = got = 0.0
    for req in o.requirements:
        w = 2.0 if req.mandatory else 1.0
        total_w += w
        declared = req.skill_id in s.skills
        level, wants = s.skills.get(req.skill_id, (None, False))
        row = {
            "skill_id": req.skill_id, "name": _name(req.skill_id), "required_level": req.min_level,
            "mandatory": req.mandatory, "learnable": req.learnable, "student_level": level, "wants_to_learn": wants,
        }
        via = next((r for r in related(req.skill_id) if s.skills.get(r, (0, False))[0] >= req.min_level), None)

        if declared and level >= req.min_level:
            credit, row["status"] = 1.0, "met"
        elif declared and req.learnable and (wants or level >= req.min_level - 1):
            credit, row["status"] = 0.5, "learnable"
        elif declared and req.mandatory:
            # a declared level below a required minimum is a hard filter (related skills cannot override it)
            credit, row["status"] = 0.0, "missing"
            blockers.append(
                f"{_name(req.skill_id)} required at {LEVEL_NAMES[req.min_level]} level (declared {LEVEL_NAMES[level]})"
            )
        elif declared and level > 0:
            credit, row["status"] = 0.5 * level / req.min_level, "below"
        elif via:
            credit, row["status"], row["via"] = 0.3, "related", via
            if req.mandatory:
                clarify.append(f"Confirm {_name(req.skill_id)} level (knows related {_name(via)})")
        elif req.mandatory:
            credit, row["status"] = 0.0, "unknown"
            clarify.append(f"{_name(req.skill_id)} is required but not declared in the profile")
        else:
            credit, row["status"] = 0.0, "missing"
        got += w * credit
        rows.append(row)

    if not o.requirements:
        clarify.append("The company has not listed required skills yet")
        return 0.5, rows, blockers, clarify
    return got / total_w, rows, blockers, clarify


def _score_experience(s: StudentView, o: OpportunityView) -> tuple[float, int, int]:
    req_ids = {r.skill_id for r in o.requirements}

    def similar(p: ProjectRecord) -> bool:
        return bool(p.skills & req_ids) or (bool(o.domain) and p.domain == o.domain)

    verified = [p for p in s.verified_projects if similar(p)]
    declared = [p for p in s.declared_projects if similar(p)]
    value = sum(0.6 + 0.4 * ((p.rating if p.rating is not None else 4.0) / 5) for p in verified)
    value += 0.5 * len(declared)
    return min(1.0, value / 2), len(verified), len(declared)


def _score_interests(s: StudentView, o: OpportunityView) -> tuple[float, bool, list[str]]:
    if not s.domains:
        domain = 0.25
        domain_hit = False
    else:
        domain_hit = bool(o.domain) and o.domain in s.domains
        domain = 0.5 if domain_hit else 0.0
    served = _goals_served(o)
    goal_hits = sorted(served & set(s.goals))
    goal = 0.25 if not s.goals else 0.5 if goal_hits else 0.0
    return domain + goal, domain_hit, goal_hits


def match(
    s: StudentView,
    o: OpportunityView,
    semantic: float | None = None,
    related: Callable[[str], set[str]] = lambda _sid: set(),
    weights: Weights | None = None,
) -> dict:
    w = weights or Weights()
    blockers: list[str] = []
    clarify: list[str] = []
    checks: list[dict] = []

    # 1. hard filters ---------------------------------------------------------------------
    type_ok = o.type in s.accepted_types
    checks.append({"label": "Opportunity type", "ok": type_ok})
    if not type_ok:
        blockers.append(f"Not looking for {o.type}s")

    hours_ok = s.hours_per_week >= o.hours_per_week
    checks.append({"label": "Availability", "ok": hours_ok, "detail": f"{o.hours_per_week}h/week needed, {s.hours_per_week}h available"})
    if not hours_ok:
        blockers.append(f"Needs {o.hours_per_week}h/week, available {s.hours_per_week}h/week")

    o_start, o_end = _opportunity_window(o)
    if o_start and o_end and s.available_from and s.available_to:
        period_ok = s.available_from <= o_end and o_start <= s.available_to
        checks.append({"label": "Period", "ok": period_ok})
        if not period_ok:
            blockers.append("Availability period does not overlap the opportunity period")

    mode_ok: bool | None = True
    if o.work_mode == "onsite" and s.work_mode == "remote":
        mode_ok = False
        blockers.append(f"On-site in {o.city or 'the company office'}, prefers remote only")
    elif o.work_mode == "hybrid" and s.work_mode == "remote":
        mode_ok = None
        clarify.append("Hybrid role - confirm how many office days are needed")
    elif o.work_mode in ("onsite", "hybrid") and o.city and s.city and o.city.lower() != s.city.lower():
        mode_ok = None
        clarify.append(f"Office in {o.city}, student based in {s.city}")
    checks.append({"label": "Work mode", "ok": mode_ok})

    # 2. components -------------------------------------------------------------------------------
    skills_score, skill_rows, skill_blockers, skill_clarify = _score_skills(s, o, related)
    blockers += skill_blockers
    clarify += skill_clarify
    exp_score, n_verified, n_declared = _score_experience(s, o)
    int_score, domain_hit, goal_hits = _score_interests(s, o)
    sem_score = max(0.0, min(1.0, semantic)) if semantic is not None else 0.0
    sem_weight = w.semantic if semantic is not None else 0.0

    total_w = w.skills + w.experience + w.interests + sem_weight
    score = 100 * (w.skills * skills_score + w.experience * exp_score + w.interests * int_score + sem_weight * sem_score) / total_w
    checks.append({"label": "Similar experience", "ok": (n_verified + n_declared) > 0,
                   "detail": f"{n_verified} verified, {n_declared} self-declared"})

    status = "incompatible" if blockers else "to_clarify" if clarify else "evaluated"

    # 3. explanation -------------------------------------------------------------------------------
    highlights = []
    for r in skill_rows:
        mark = {"met": "✓", "learnable": "~", "related": "≈", "below": "~"}.get(r["status"], "✗")
        highlights.append(f"{r['name']} {mark}")
    if hours_ok:
        highlights.append("Availability ✓")
    if n_verified + n_declared:
        highlights.append("Similar experience ✓")
    if goal_hits:
        highlights.append("Goals ✓")

    met = sum(r["status"] == "met" for r in skill_rows)
    label = "Very good fit" if score >= 80 else "Good fit" if score >= 65 else "Possible fit" if score >= 50 else "Weak fit"
    # plain-language summary, read by both students and companies
    if status == "incompatible":
        summary = "Not a fit right now: " + blockers[0][0].lower() + blockers[0][1:] + "."
    else:
        parts = [f"Meets {met} of {len(skill_rows)} skills"]
        n_similar = n_verified + n_declared
        if n_similar:
            parts.append(f"has done {n_similar} similar project{'s' if n_similar > 1 else ''}")
        if domain_hit:
            parts.append(f"interested in {o.domain}")
        summary = ", ".join(parts) + "."

    return {
        "student_id": s.id,
        "opportunity_id": o.id,
        "status": status,
        "score": round(score, 1),
        "label": label,
        "components": {
            "skills": round(skills_score, 3), "experience": round(exp_score, 3),
            "interests": round(int_score, 3), "semantic": round(sem_score, 3) if semantic is not None else None,
        },
        "weights": {"skills": w.skills, "experience": w.experience, "interests": w.interests, "semantic": sem_weight},
        "skills": skill_rows,
        "checks": checks,
        "blockers": blockers,
        "to_clarify": clarify,
        "highlights": highlights,
        "summary": summary,
    }


def rank_key(result: dict) -> tuple:
    """Incompatible results go last; "to clarify" ones are ranked by score alongside evaluated ones."""
    return (result["status"] == "incompatible", -result["score"])
