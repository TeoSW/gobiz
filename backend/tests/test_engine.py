from datetime import date

from app.matching.engine import OpportunityView, ProjectRecord, Requirement, StudentView, match, rank_key
from app.skills_catalog import related_skills


def opp(**kw) -> OpportunityView:
    base = dict(id=1, type="project", domain="retail", hours_per_week=10, work_mode="remote",
                requirements=[Requirement("power_bi", 2, mandatory=True), Requirement("sql", 1)])
    base.update(kw)
    return OpportunityView(**base)


def student(**kw) -> StudentView:
    base = dict(id=7, accepted_types=["project"], goals=["paid_project"], domains=["retail"], hours_per_week=15,
                skills={"power_bi": (3, False), "sql": (2, False)})
    base.update(kw)
    return StudentView(**base)


def test_full_fit_is_evaluated_with_high_score():
    r = match(student(), opp(compensation_amount=1500), semantic=0.6)
    assert r["status"] == "evaluated"
    assert r["score"] >= 70
    assert "Power BI ✓" in r["highlights"]


def test_type_filter_blocks():
    r = match(student(accepted_types=["internship"]), opp())
    assert r["status"] == "incompatible"
    assert "Not looking for projects" in r["blockers"][0]


def test_hours_filter_blocks():
    r = match(student(hours_per_week=5), opp(hours_per_week=10))
    assert r["status"] == "incompatible"


def test_period_without_overlap_blocks():
    r = match(student(available_from=date(2026, 1, 1), available_to=date(2026, 2, 1)),
              opp(start_date=date(2026, 6, 1), duration_weeks=3))
    assert r["status"] == "incompatible"


def test_remote_only_student_vs_onsite_blocks():
    r = match(student(work_mode="remote"), opp(work_mode="onsite", city="Iasi"))
    assert r["status"] == "incompatible"


def test_other_city_onsite_is_to_clarify():
    r = match(student(work_mode="any", city="Cluj-Napoca"), opp(work_mode="onsite", city="Iasi"))
    assert r["status"] == "to_clarify"


def test_mandatory_declared_below_minimum_blocks():
    r = match(student(skills={"power_bi": (1, False)}), opp())
    assert r["status"] == "incompatible"
    assert "Power BI" in r["blockers"][0]


def test_mandatory_not_declared_is_to_clarify_not_incompatible():
    r = match(student(skills={"sql": (2, False)}), opp())
    assert r["status"] == "to_clarify"
    assert any("Power BI" in c for c in r["to_clarify"])


def test_learnable_requirement_with_wants_to_learn_gives_partial_credit():
    o = opp(requirements=[Requirement("power_bi", 2, mandatory=True, learnable=True)])
    r = match(student(skills={"power_bi": (0, True)}), o)
    assert r["status"] == "evaluated"
    assert r["skills"][0]["status"] == "learnable"
    assert r["components"]["skills"] == 0.5


def test_related_skill_gives_partial_credit():
    assert "tableau" in related_skills("power_bi")
    o = opp(requirements=[Requirement("power_bi", 2)])
    r = match(student(skills={"tableau": (3, False)}), o, related=related_skills)
    assert r["skills"][0]["status"] == "related"
    assert r["components"]["skills"] == 0.3


def test_experience_counts_verified_more_than_declared():
    verified = match(student(verified_projects=[ProjectRecord({"power_bi"}, "retail", 5.0)]), opp())
    declared = match(student(declared_projects=[ProjectRecord({"power_bi"}, "retail")]), opp())
    none = match(student(), opp())
    assert verified["components"]["experience"] > declared["components"]["experience"] > none["components"]["experience"]


def test_semantic_weight_is_dropped_when_unavailable():
    r = match(student(), opp(), semantic=None)
    assert r["weights"]["semantic"] == 0
    assert r["components"]["semantic"] is None
    assert 0 <= r["score"] <= 100


def test_ranking_puts_incompatible_last_and_sorts_by_score():
    results = [
        {"status": "incompatible", "score": 99},
        {"status": "to_clarify", "score": 80},
        {"status": "evaluated", "score": 60},
    ]
    assert [r["score"] for r in sorted(results, key=rank_key)] == [80, 60, 99]


def test_no_requirements_is_to_clarify():
    r = match(student(), opp(requirements=[]))
    assert r["status"] == "to_clarify"


def test_declared_below_minimum_is_not_rescued_by_related_skill():
    o = opp(requirements=[Requirement("power_bi", 1, mandatory=True)])
    r = match(student(skills={"power_bi": (0, True), "sql": (2, False)}), o, related=related_skills)
    assert r["status"] == "incompatible"


def test_undeclared_mandatory_with_related_skill_is_to_clarify():
    o = opp(requirements=[Requirement("power_bi", 1, mandatory=True)])
    r = match(student(skills={"tableau": (3, False)}), o, related=related_skills)
    assert r["status"] == "to_clarify"
    assert r["skills"][0]["status"] == "related"
