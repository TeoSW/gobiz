"""Optional skill knowledge graph in Neo4j Community (GPLv3).

(:Student)-[:HAS_SKILL {level, wants_to_learn}]->(:Skill)<-[:REQUIRES {min_level, mandatory}]-(:Opportunity)
(:Skill)-[:RELATED_TO]-(:Skill)      from the catalog
(:Company)-[:POSTED]->(:Opportunity)  (:Student)-[:COMPLETED {rating}]->(:Opportunity)

Enabled when NEO4J_URI is set and reachable. Every query has an in-process fallback computed from MySQL,
so the product works identically without the graph; Neo4j adds an explorable graph and scales the analytics.
"""

import logging
import time
from collections import Counter
from itertools import combinations

from sqlalchemy.orm import Session

from .config import get_settings
from .models import Opportunity, Review, StudentSkill, User
from .skills_catalog import SKILL_BY_ID, SKILLS, related_skills

log = logging.getLogger(__name__)
_driver = None
_last_error: str | None = None
_last_attempt = 0.0
_synced = False  # Neo4j may come up after the API: the first query after connecting triggers a full sync
RETRY_AFTER_S = 30


def _get_driver():
    global _driver, _last_error, _last_attempt
    uri = get_settings().neo4j_uri
    if not uri:
        return None
    if _driver is None:
        if time.monotonic() - _last_attempt < RETRY_AFTER_S and _last_error:
            return None  # don't pay a connection timeout on every request while Neo4j is down
        _last_attempt = time.monotonic()
        try:
            from neo4j import GraphDatabase

            s = get_settings()
            drv = GraphDatabase.driver(uri, auth=(s.neo4j_user, s.neo4j_password), connection_timeout=3)
            drv.verify_connectivity()
            _driver = drv
            _last_error = None
        except Exception as exc:  # noqa: BLE001
            _last_error = str(exc)[:200]
            return None
    return _driver


def status() -> dict:
    uri = get_settings().neo4j_uri
    if not uri:
        return {"enabled": False, "reachable": False, "detail": "NEO4J_URI not set (start compose with --profile graph)"}
    drv = _get_driver()
    if drv is None:
        return {"enabled": True, "reachable": False, "detail": _last_error}
    with drv.session() as s:
        counts = s.run("MATCH (n) RETURN count(n) AS nodes").single()["nodes"]
        rels = s.run("MATCH ()-[r]->() RETURN count(r) AS rels").single()["rels"]
    return {"enabled": True, "reachable": True, "nodes": counts, "relationships": rels}


def _ready_driver(db: Session):
    drv = _get_driver()
    if drv is not None and not _synced:
        safe_sync(db)
    return drv


def sync_all(db: Session) -> bool:
    """Rebuild the graph from the relational store (idempotent MERGE)."""
    global _synced
    drv = _get_driver()
    if drv is None:
        return False
    skills = [{"id": s["id"], "name": s["name"], "category": s["category"]} for s in SKILLS]
    rel_pairs = [{"a": s["id"], "b": r} for s in SKILLS for r in s["related"] if r in SKILL_BY_ID]
    student_skills = [
        {"sid": ss.student_id, "skill": ss.skill_id, "level": ss.level, "wants": ss.wants_to_learn}
        for ss in db.query(StudentSkill).all()
    ]
    students = [{"id": u.id, "name": u.name} for u in db.query(User).filter(User.role == "student")]
    companies = [{"id": u.id, "name": u.name} for u in db.query(User).filter(User.role == "company")]
    opps = db.query(Opportunity).all()
    opp_rows = [{"id": o.id, "title": o.title, "type": o.type, "domain": o.domain, "company": o.company_id} for o in opps]
    req_rows = [
        {"oid": o.id, "skill": r.skill_id, "min_level": r.min_level, "mandatory": r.mandatory} for o in opps for r in o.skills
    ]
    ratings = {r.opportunity_id: r.overall for r in db.query(Review).filter(Review.direction == "company_to_student")}
    done = [
        {"sid": o.selected_student_id, "oid": o.id, "rating": ratings.get(o.id)}
        for o in opps if o.status == "completed" and o.selected_student_id
    ]
    with drv.session() as s:
        s.run("MATCH (n) DETACH DELETE n")
        s.run("UNWIND $rows AS r MERGE (k:Skill {id: r.id}) SET k.name = r.name, k.category = r.category", rows=skills)
        s.run("UNWIND $rows AS r MATCH (a:Skill {id: r.a}), (b:Skill {id: r.b}) MERGE (a)-[:RELATED_TO]-(b)", rows=rel_pairs)
        s.run("UNWIND $rows AS r MERGE (:Student {id: r.id, name: r.name})", rows=students)
        s.run("UNWIND $rows AS r MERGE (:Company {id: r.id, name: r.name})", rows=companies)
        s.run(
            "UNWIND $rows AS r MERGE (o:Opportunity {id: r.id}) SET o.title = r.title, o.type = r.type, o.domain = r.domain "
            "WITH o, r MATCH (c:Company {id: r.company}) MERGE (c)-[:POSTED]->(o)", rows=opp_rows,
        )
        s.run(
            "UNWIND $rows AS r MATCH (st:Student {id: r.sid}), (k:Skill {id: r.skill}) "
            "MERGE (st)-[h:HAS_SKILL]->(k) SET h.level = r.level, h.wants_to_learn = r.wants", rows=student_skills,
        )
        s.run(
            "UNWIND $rows AS r MATCH (o:Opportunity {id: r.oid}), (k:Skill {id: r.skill}) "
            "MERGE (o)-[q:REQUIRES]->(k) SET q.min_level = r.min_level, q.mandatory = r.mandatory", rows=req_rows,
        )
        s.run(
            "UNWIND $rows AS r MATCH (st:Student {id: r.sid}), (o:Opportunity {id: r.oid}) "
            "MERGE (st)-[c:COMPLETED]->(o) SET c.rating = r.rating", rows=done,
        )
    _synced = True
    return True


def safe_sync(db: Session) -> None:
    try:
        sync_all(db)
    except Exception as exc:  # noqa: BLE001 - the graph is optional, never break a request because of it
        log.warning("Neo4j sync failed: %s", exc)


def co_demand(db: Session, limit: int = 12) -> dict:
    """Skill pairs that companies request together."""
    drv = _ready_driver(db)
    if drv is not None:
        try:
            with drv.session() as s:
                rows = s.run(
                    "MATCH (a:Skill)<-[:REQUIRES]-(o:Opportunity)-[:REQUIRES]->(b:Skill) WHERE a.id < b.id "
                    "RETURN a.name AS a, b.name AS b, count(o) AS n ORDER BY n DESC LIMIT $limit", limit=limit,
                ).data()
            return {"source": "neo4j", "pairs": rows}
        except Exception as exc:  # noqa: BLE001
            log.warning("Neo4j co-demand query failed: %s", exc)
    counter: Counter = Counter()
    for o in db.query(Opportunity).all():
        ids = sorted({r.skill_id for r in o.skills})
        counter.update(combinations(ids, 2))
    pairs = [{"a": SKILL_BY_ID[a]["name"], "b": SKILL_BY_ID[b]["name"], "n": n} for (a, b), n in counter.most_common(limit)]
    return {"source": "sql", "pairs": pairs}


def skill_neighborhood(db: Session, skill_id: str) -> dict:
    """Related skills (catalog) + co-demanded skills + how many students/opportunities touch this skill."""
    drv = _ready_driver(db)
    if drv is not None:
        try:
            with drv.session() as s:
                rec = s.run(
                    "MATCH (k:Skill {id: $id}) "
                    "OPTIONAL MATCH (k)-[:RELATED_TO]-(r:Skill) WITH k, collect(DISTINCT r.id) AS related "
                    "OPTIONAL MATCH (k)<-[:REQUIRES]-(o:Opportunity)-[:REQUIRES]->(c:Skill) "
                    "WITH k, related, c.id AS cid, count(o) AS n ORDER BY n DESC "
                    "WITH k, related, collect({id: cid, n: n})[..8] AS co "
                    "OPTIONAL MATCH (st:Student)-[h:HAS_SKILL]->(k) WHERE h.level > 0 "
                    "WITH k, related, co, count(st) AS students "
                    "OPTIONAL MATCH (o2:Opportunity)-[:REQUIRES]->(k) "
                    "RETURN related, co, students, count(o2) AS opportunities", id=skill_id,
                ).single()
            if rec:
                return {"source": "neo4j", "skill_id": skill_id, "related": rec["related"],
                        "co_demanded": [c for c in rec["co"] if c["id"]], "students": rec["students"],
                        "opportunities": rec["opportunities"]}
        except Exception as exc:  # noqa: BLE001
            log.warning("Neo4j neighborhood query failed: %s", exc)
    co: Counter = Counter()
    n_opps = 0
    for o in db.query(Opportunity).all():
        ids = {r.skill_id for r in o.skills}
        if skill_id in ids:
            n_opps += 1
            co.update(ids - {skill_id})
    n_students = db.query(StudentSkill).filter(StudentSkill.skill_id == skill_id, StudentSkill.level > 0).count()
    return {"source": "sql", "skill_id": skill_id, "related": sorted(related_skills(skill_id)),
            "co_demanded": [{"id": k, "n": n} for k, n in co.most_common(8)], "students": n_students,
            "opportunities": n_opps}
