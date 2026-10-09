"""LLM providers. Only open-source / local options: Ollama (default) and a deterministic heuristic fallback."""

import json
import logging
import re
import threading
import time
import unicodedata
from typing import Protocol

import httpx

from ..config import get_settings
from ..skills_catalog import find_skill_mentions
from .schema import EXTRACTION_JSON_SCHEMA, SYSTEM_PROMPT, Extraction, ExtractedSkill, SuggestedSkill

log = logging.getLogger(__name__)


# state of the startup model download (shown on the System status page)
pull_state: dict = {"state": "idle", "error": None}


class LLMProvider(Protocol):
    name: str

    def extract(self, title: str, description: str, type_hint: str | None, lang: str = "en") -> Extraction: ...


class OllamaProvider:
    """Calls a local Ollama server with a JSON schema in `format` (structured outputs)."""

    name = "ollama"

    def __init__(self, url: str, model: str, timeout_s: float, num_ctx: int):
        self.url = url.rstrip("/")
        self.model = model
        self.timeout_s = timeout_s
        self.num_ctx = num_ctx

    def status(self) -> dict:
        try:
            r = httpx.get(f"{self.url}/api/tags", timeout=httpx.Timeout(3.0, connect=2.0))
            r.raise_for_status()
            models = [m["name"] for m in r.json().get("models", [])]
            pulled = self.model in models or f"{self.model}:latest" in models
            return {"reachable": True, "model": self.model, "model_pulled": pulled, "models": models}
        except Exception as exc:  # noqa: BLE001
            return {"reachable": False, "model": self.model, "model_pulled": False, "error": str(exc)[:200]}

    def pull(self) -> None:
        """Blocking download of the model into Ollama's volume (~1.4 GB for qwen3:1.7b)."""
        r = httpx.post(f"{self.url}/api/pull", json={"model": self.model, "stream": False}, timeout=None)
        r.raise_for_status()

    def extract(self, title: str, description: str, type_hint: str | None, lang: str = "en") -> Extraction:
        system = SYSTEM_PROMPT.replace("{language}", "Romanian" if lang == "ro" else "English")
        user = f"Title: {title}\nType selected by the company: {type_hint or 'unknown'}\n\nDescription:\n{description}"
        payload = {
            "model": self.model,
            "messages": [{"role": "system", "content": system}, {"role": "user", "content": user}],
            "format": EXTRACTION_JSON_SCHEMA,
            "stream": False,
            "think": False,  # Qwen3 thinking mode off: faster and the schema already constrains the output
            # num_predict caps the answer: a runaway generation ends as invalid JSON -> rule-based fallback
            "options": {"temperature": 0, "num_ctx": self.num_ctx, "num_predict": 900},
        }
        r = httpx.post(f"{self.url}/api/chat", json=payload, timeout=httpx.Timeout(self.timeout_s, connect=2.0))
        r.raise_for_status()
        content = r.json()["message"]["content"]
        content = re.sub(r"<think>.*?</think>", "", content, flags=re.S).strip()
        return Extraction.model_validate(json.loads(content))


_MANDATORY_CUES = r"\b(obligatoriu|obligatorie|required|must|necesar|necesara|necesară|trebuie|esential|esențial|mandatory)"
_OPTIONAL_CUES = r"\b(un plus|este un plus|avantaj|nice to have|is a plus|a plus|optional|optionala|bonus|preferabil|preferably)"
_ADVANCED_CUES = r"\b(avansat|advanced|expert|senior|foarte bun|strong|solid|experienta vasta)"
_INTERMEDIATE_CUES = r"\b(intermediar|intermediate|bun|good|experienta|experiență|experience)"
_TASK_VERBS = (
    "build", "create", "develop", "analy", "clean", "automat", "design", "implement", "collect", "scrape", "migrate",
    "realiz", "constru", "dezvolt", "curat", "curăț", "organiz", "centraliz", "creeze", "crea", "analiz", "automatiz",
    "colect", "extrag", "integr", "optimiz", "migr", "vrem", "dorim", "avem nevoie", "need", "want",
)
_DOMAIN_CUES = {
    "retail": ["vanzari", "vânzări", "magazin", "retail", "sales", "produse", "store"],
    "e-commerce": ["e-commerce", "ecommerce", "magazin online", "shop online", "comenzi online", "woocommerce"],
    "finance": ["financiar", "finance", "contabil", "buget", "cash flow", "facturi", "invoice"],
    "logistics": ["logistic", "transport", "depozit", "warehouse", "livrari", "livrări", "stoc", "inventory"],
    "marketing": ["marketing", "campanii", "social media", "clienti", "clienți", "brand", "seo"],
    "manufacturing": ["productie", "producție", "fabrica", "fabrică", "manufacturing", "linie de productie"],
    "healthcare": ["clinica", "clinică", "pacienti", "pacienți", "medical", "health"],
    "hr": ["recrutare", "angajati", "angajați", "hr", "resurse umane", "pontaj"],
    "tourism": ["turism", "hotel", "rezervari", "rezervări", "pensiune", "booking"],
    "real-estate": ["imobiliar", "apartamente", "real estate", "chirii"],
    "education": ["scoala", "școală", "cursuri", "elevi", "education", "training"],
}
# skills commonly needed alongside others (used for *suggestions*, never mandatory)
# skill found -> (suggested skill, reason in English, reason in Romanian)
_SUGGEST_RULES = {
    "dashboards": [("data_visualization", "Dashboards need clear visual design", "Un dashboard are nevoie de grafice clare")],
    "power_bi": [("data_cleaning", "Source data usually needs preparing before modelling",
                  "Datele sursă trebuie de obicei pregătite înainte de modelare"),
                 ("sql", "Useful if data comes from a database", "Util dacă datele vin dintr-o bază de date")],
    "web_scraping": [("python", "Most scrapers are written in Python", "Majoritatea scraperelor sunt scrise în Python"),
                     ("data_cleaning", "Scraped data needs cleaning", "Datele colectate trebuie curățate")],
    "machine_learning": [("python", "Standard language for ML", "Limbajul standard pentru ML"),
                         ("statistics", "Needed to evaluate models", "Necesară pentru evaluarea modelelor")],
    "survey_design": [("statistics", "Needed to analyse survey results", "Necesară pentru analiza răspunsurilor")],
    "market_research": [("data_analysis", "Market research relies on data analysis", "Studiile de piață se bazează pe analiza datelor")],
    "process_automation": [("excel", "Automations often start from spreadsheets", "Automatizările pornesc des de la foi de calcul")],
    "database_design": [("sql", "Databases are queried with SQL", "Bazele de date se interoghează cu SQL")],
}

_QUESTIONS = {
    "deadline": ("What is the deadline or expected duration?", "Care este termenul sau durata estimată?"),
    "budget": ("What is the budget / compensation?", "Care este bugetul / plata?"),
    "data": ("How will the student access the data (export, anonymised sample, on-site)?",
             "Cum va avea studentul acces la date (export, eșantion anonimizat, la sediu)?"),
    "deliverable": ("What exactly should be delivered and in what format?", "Ce anume trebuie predat și în ce format?"),
}


def _sentences(text: str) -> list[str]:
    parts = re.split(r"(?<=[.!?;\n])\s+|\n|•|- ", text)
    return [p.strip(" -•\t") for p in parts if len(p.strip()) > 3]


class HeuristicProvider:
    """Deterministic extractor: catalog alias matching + cue words. Always available, no model needed."""

    name = "heuristic"

    def extract(self, title: str, description: str, type_hint: str | None, lang: str = "en") -> Extraction:
        ro = lang == "ro"
        text = f"{title}\n{description}"
        low = text.lower()
        sentences = _sentences(description) or [description]

        explicit: list[ExtractedSkill] = []
        for sid, alias in find_skill_mentions(text):
            # every sentence mentioning the skill counts ("... cu Python. Python obligatoriu." -> mandatory), but cues are
            # read per clause so "Power BI este obligatoriu, SQL este un plus" keeps SQL optional
            hits = [s for s in sentences if re.search(r"(?<!\w)" + re.escape(alias) + r"(?!\w)", _strip(s))] or [alias]
            clauses = [
                c for h in hits for c in re.split(r"[,;:]|\s(?:dar|but|iar|while)\s", _strip(h))
                if re.search(r"(?<!\w)" + re.escape(alias) + r"(?!\w)", c)
            ] or [_strip(h) for h in hits]
            level = 3 if any(re.search(_ADVANCED_CUES, x) for x in clauses) else 2 if any(re.search(_INTERMEDIATE_CUES, x) for x in clauses) else 1
            optional = any(re.search(_OPTIONAL_CUES, x) for x in clauses)
            mandatory = not optional and any(re.search(_MANDATORY_CUES, x) for x in clauses)
            explicit.append(ExtractedSkill(skill=sid, min_level=level, mandatory=mandatory, evidence=hits[0][:160]))

        have = {e.skill for e in explicit}
        suggested: list[SuggestedSkill] = []
        for e in explicit:
            for sid, reason_en, reason_ro in _SUGGEST_RULES.get(e.skill, []):
                if sid not in have and sid not in {s.skill for s in suggested}:
                    suggested.append(SuggestedSkill(skill=sid, min_level=1, reason=reason_ro if ro else reason_en))

        tasks = [s.rstrip(".") for s in sentences if any(v in _strip(s) for v in _TASK_VERBS)][:8]
        if not tasks:
            tasks = [s.rstrip(".") for s in sentences[:3]]

        domain = max(_DOMAIN_CUES, key=lambda d: sum(c in low for c in _DOMAIN_CUES[d]))
        if not any(c in low for c in _DOMAIN_CUES[domain]):
            domain = ""

        missing = []
        if not re.search(r"(termen|deadline|saptamani|săptămâni|weeks|zile|days|luni|months)", low):
            missing.append(_QUESTIONS["deadline"][ro])
        if not re.search(r"(lei|ron|eur|€|buget|budget|plata|plată|remunera|salary|salariu)", low):
            missing.append(_QUESTIONS["budget"][ro])
        if re.search(r"(date|data|baza|tranzac|fisier|fișier)", low) and not re.search(r"(acces|access|export|csv|xlsx|anonim)", low):
            missing.append(_QUESTIONS["data"][ro])
        if not re.search(r"(livr|deliver|predare|format|raport final|documenta)", low):
            missing.append(_QUESTIONS["deliverable"][ro])

        n_skills = len(explicit)
        difficulty = 3 if re.search(r"(machine learning|ml|model predictiv|deep|complex|avansat)", low) else 1 if n_skills <= 1 else 2
        type_guess = type_hint or (
            "internship" if re.search(r"(stagiu|practica|practică|internship)", low)
            else "job" if re.search(r"(angajare|full[- ]time|part[- ]time|post|job|salariu)", low)
            else "project"
        )
        summary = sentences[0][:200] if sentences else title
        return Extraction(
            summary=summary, type_guess=type_guess, domain=domain,
            difficulty=difficulty, tasks=tasks, skills_explicit=explicit, skills_suggested=suggested,
            missing_info=missing,
        )


def _strip(s: str) -> str:
    s = unicodedata.normalize("NFKD", s.lower())
    return "".join(ch for ch in s if not unicodedata.combining(ch))


def _pull_worker(provider: OllamaProvider) -> None:
    for _ in range(36):  # the Ollama container may still be starting: wait up to ~3 minutes
        status = provider.status()
        if status["reachable"]:
            break
        time.sleep(5)
    else:
        pull_state.update(state="unreachable")
        return
    if status["model_pulled"]:
        pull_state.update(state="ready")
        return
    pull_state.update(state="pulling")
    log.info("Downloading %s into Ollama (first start only)...", provider.model)
    try:
        provider.pull()
        pull_state.update(state="ready")
        log.info("Model %s ready", provider.model)
    except Exception as exc:  # noqa: BLE001 - extraction keeps working with the rule-based fallback
        pull_state.update(state="failed", error=str(exc)[:200])
        log.warning("Model download failed: %s", exc)


def ensure_model_pulled() -> None:
    """On startup, download the configured model in the background if Ollama does not have it yet."""
    s = get_settings()
    if s.llm_provider != "ollama" or not s.ollama_auto_pull:
        return
    provider = OllamaProvider(s.ollama_url, s.ollama_model, s.ollama_timeout_s, s.ollama_num_ctx)
    threading.Thread(target=_pull_worker, args=(provider,), daemon=True, name="ollama-pull").start()


def get_provider() -> LLMProvider:
    s = get_settings()
    if s.llm_provider == "ollama":
        return OllamaProvider(s.ollama_url, s.ollama_model, s.ollama_timeout_s, s.ollama_num_ctx)
    return HeuristicProvider()
