"""Requirement extraction service: provider call + validation + normalisation to the skill catalog."""

import logging
import re
import time
import unicodedata

from ..skills_catalog import SKILL_BY_ID, normalize_skill
from .providers import HeuristicProvider, get_provider
from .schema import Extraction

log = logging.getLogger(__name__)


def _plain(s: str) -> str:
    s = unicodedata.normalize("NFKD", s.lower())
    return re.sub(r"\s+", " ", "".join(ch for ch in s if not unicodedata.combining(ch))).strip()


def _evidence_found(evidence: str, text: str) -> bool:
    """Anti-hallucination check: the quoted evidence (or most of its words) must appear in the source text."""
    ev, src = _plain(evidence), _plain(text)
    if not ev:
        return False
    if ev in src:
        return True
    words = [w for w in re.findall(r"\w+", ev) if len(w) > 2]
    return bool(words) and sum(w in src for w in words) / len(words) >= 0.7


def postprocess(raw: Extraction, title: str, description: str) -> dict:
    text = f"{title}\n{description}"
    skills: dict[str, dict] = {}
    unrecognized: list[str] = []

    for item in raw.skills_explicit:
        sid = normalize_skill(item.skill)
        if not sid:
            unrecognized.append(item.skill)
            continue
        grounded = _evidence_found(item.evidence, text) or _evidence_found(item.skill, text)
        source = "explicit" if grounded else "suggested"
        if sid in skills and skills[sid]["source"] == "explicit":
            continue
        skills[sid] = {
            "skill_id": sid,
            "name": SKILL_BY_ID[sid]["name"],
            "min_level": item.min_level,
            # rule: only grounded, explicitly-required skills may start as mandatory
            "mandatory": bool(item.mandatory and grounded),
            "learnable": False,
            "source": source,
            "note": item.evidence if grounded else "Not found verbatim in the text - downgraded to a suggestion",
        }

    for item in raw.skills_suggested:
        sid = normalize_skill(item.skill)
        if not sid:
            unrecognized.append(item.skill)
            continue
        if sid in skills:
            continue
        skills[sid] = {
            "skill_id": sid,
            "name": SKILL_BY_ID[sid]["name"],
            "min_level": item.min_level,
            "mandatory": False,  # rule: a suggestion is never mandatory automatically
            "learnable": True,
            "source": "suggested",
            "note": item.reason,
        }

    ordered = sorted(skills.values(), key=lambda s: (s["source"] != "explicit", not s["mandatory"], s["name"]))
    return {
        "summary": raw.summary,
        "type_guess": raw.type_guess if raw.type_guess in ("project", "internship", "job") else "project",
        "domain": raw.domain.lower().strip(),
        "difficulty": raw.difficulty,
        "tasks": [t.strip() for t in raw.tasks if t.strip()][:6],
        "skills": ordered,
        "unrecognized_skills": sorted(set(unrecognized)),
        "missing_info": raw.missing_info[:6],
    }


def merge_with_rules(llm: Extraction, rules: Extraction) -> Extraction:
    """Hybrid: the LLM proposes, deterministic rules verify.

    Small local models (e.g. qwen3:1.7b) miss explicit wording such as "Power BI este obligatoriu" or a tool named
    in passing. The rule-based pass reads the same text, so for skills it finds verbatim:
      * required / optional comes from cue words at clause level ("obligatoriu", "is a plus"), not from the LLM;
      * skills the LLM skipped are added back as explicit.
    Empty fields (domain, summary, tasks) are filled from the rules.
    """
    rule_explicit = {sid: r for r in rules.skills_explicit if (sid := normalize_skill(r.skill))}
    explicit, seen = [], set()
    for item in llm.skills_explicit:
        sid = normalize_skill(item.skill)
        if sid in seen:
            continue
        if sid in rule_explicit:
            r = rule_explicit[sid]
            item = item.model_copy(update={"mandatory": r.mandatory, "min_level": max(item.min_level, r.min_level)})
        explicit.append(item)
        if sid:
            seen.add(sid)
    explicit += [r for sid, r in rule_explicit.items() if sid not in seen]
    taken = seen | set(rule_explicit)
    suggested = [x for x in llm.skills_suggested if normalize_skill(x.skill) not in taken] or [
        x for x in rules.skills_suggested if normalize_skill(x.skill) not in taken
    ]
    return llm.model_copy(update={
        "skills_explicit": explicit,
        "skills_suggested": suggested,
        "domain": llm.domain or rules.domain,
        "summary": llm.summary or rules.summary,
        "tasks": llm.tasks or rules.tasks,
        "missing_info": llm.missing_info or rules.missing_info,
    })


def extract_requirements(title: str, description: str, type_hint: str | None = None) -> dict:
    provider = get_provider()
    started = time.perf_counter()
    fallback_reason = None
    rules = HeuristicProvider().extract(title, description, type_hint)
    try:
        raw = provider.extract(title, description, type_hint)
        used = provider.name
        if used != "heuristic":
            raw = merge_with_rules(raw, rules)
    except Exception as exc:  # noqa: BLE001 - any failure (offline, timeout, invalid JSON) -> deterministic fallback
        log.warning("LLM provider %s failed, using heuristic: %s", provider.name, exc)
        fallback_reason = f"{provider.name} unavailable: {str(exc)[:160]}"
        raw = rules
        used = "heuristic"
    result = postprocess(raw, title, description)
    result.update(
        provider=used,
        model=getattr(provider, "model", None) if used != "heuristic" else None,
        fallback_reason=fallback_reason,
        elapsed_ms=round((time.perf_counter() - started) * 1000),
        raw=raw.model_dump(),
    )
    return result
