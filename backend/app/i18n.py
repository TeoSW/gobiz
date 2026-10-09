"""Romanian / English texts produced by the API (match explanations, errors, generated messages).

The language comes from the Accept-Language header (the frontend sends "ro" or "en") and is kept in a context
variable for the duration of the request. Data written by people (titles, descriptions, messages) is never translated.
"""

import re
from contextvars import ContextVar

LANGS = ("en", "ro")
current_lang: ContextVar[str] = ContextVar("lang", default="en")


def parse_accept_language(value: str | None) -> str:
    for part in (value or "").split(","):
        code = part.split(";")[0].strip().lower()[:2]
        if code in LANGS:
            return code
    return "en"


def lang() -> str:
    return current_lang.get()


class LanguageMiddleware:
    """Pure ASGI middleware, so the language is visible in sync endpoints (thread pool) and in exception handlers."""

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        header = dict(scope.get("headers") or []).get(b"accept-language", b"").decode("latin-1")
        token = current_lang.set(parse_accept_language(header))
        try:
            await self.app(scope, receive, send)
        finally:
            current_lang.reset(token)


# ---------------------------------------------------------------- matching explanations
TEXTS: dict[str, dict[str, str]] = {
    "en": {
        "level.0": "none", "level.1": "beginner", "level.2": "intermediate", "level.3": "advanced",
        "skill_below": "{skill} required at {need} level (declared {has})",
        "confirm_related": "Confirm {skill} level (knows related {via})",
        "required_undeclared": "{skill} is required but not declared in the profile",
        "no_requirements": "The company has not listed required skills yet",
        "not_looking.project": "Not looking for projects",
        "not_looking.internship": "Not looking for internships",
        "not_looking.job": "Not looking for jobs",
        "hours": "Needs {need}h/week, available {has}h/week",
        "period": "Availability period does not overlap the opportunity period",
        "onsite_city": "On-site in {city}, prefers remote only",
        "onsite": "On-site at the company office, prefers remote only",
        "hybrid": "Hybrid role - confirm how many office days are needed",
        "other_city": "Office in {office}, student based in {student}",
        "check.type": "Opportunity type", "check.availability": "Availability", "check.period": "Period",
        "check.mode": "Work mode", "check.experience": "Similar experience",
        "detail.hours": "{need}h/week needed, {has}h available",
        "detail.experience": "{verified} verified, {declared} self-declared",
        "hl.availability": "Availability ✓", "hl.experience": "Similar experience ✓", "hl.goals": "Goals ✓",
        "label.very_good": "Very good fit", "label.good": "Good fit", "label.possible": "Possible fit", "label.weak": "Weak fit",
        "summary.not_fit": "Not a fit right now: {reason}.",
        "summary.meets": "Meets {met} of {total} skills",
        "summary.similar.1": "has done 1 similar project",
        "summary.similar.n": "has done {n} similar projects",
        "summary.domain": "interested in {domain}",
        # generated chat messages
        "thread.new_match": "New match! Say hello.",
        "graph.disabled": "NEO4J_URI not set (start compose with --profile graph)",
        "msg.invite": "Hi {name}, we think you'd be a great fit for \"{title}\". Interested?",
        "msg.selected": "Good news - you have been selected for \"{title}\". Let's get started!",
    },
    "ro": {
        "level.0": "niciunul", "level.1": "începător", "level.2": "intermediar", "level.3": "avansat",
        "skill_below": "{skill} este cerut la nivel {need} (declarat: {has})",
        "confirm_related": "De confirmat nivelul la {skill} (cunoaște {via}, o abilitate înrudită)",
        "required_undeclared": "{skill} este obligatoriu, dar nu apare în profil",
        "no_requirements": "Compania nu a precizat încă abilitățile necesare",
        "not_looking.project": "Nu caută proiecte",
        "not_looking.internship": "Nu caută stagii",
        "not_looking.job": "Nu caută un job",
        "hours": "Necesită {need} h/săptămână, are {has} h/săptămână",
        "period": "Perioada în care e disponibil nu se suprapune cu perioada oportunității",
        "onsite_city": "Se lucrează la birou în {city}, preferă doar remote",
        "onsite": "Se lucrează la sediul companiei, preferă doar remote",
        "hybrid": "Rol hibrid - de confirmat câte zile pe săptămână sunt la birou",
        "other_city": "Biroul e în {office}, studentul e în {student}",
        "check.type": "Tipul oportunității", "check.availability": "Disponibilitate", "check.period": "Perioadă",
        "check.mode": "Mod de lucru", "check.experience": "Experiență similară",
        "detail.hours": "necesare {need} h/săptămână, disponibile {has} h",
        "detail.experience": "{verified} verificate, {declared} declarate",
        "hl.availability": "Disponibilitate ✓", "hl.experience": "Experiență similară ✓", "hl.goals": "Obiective ✓",
        "label.very_good": "Potrivire foarte bună", "label.good": "Potrivire bună", "label.possible": "Potrivire posibilă",
        "label.weak": "Potrivire slabă",
        "summary.not_fit": "Nu se potrivește acum: {reason}.",
        "summary.meets": "Îndeplinește {met} din {total} abilități",
        "summary.similar.1": "a mai făcut un proiect similar",
        "summary.similar.n": "a mai făcut {n} proiecte similare",
        "summary.domain": "are interes pentru {domain}",
        "thread.new_match": "Match nou! Spune bună.",
        "graph.disabled": "NEO4J_URI nu este setat (pornește compose cu --profile graph)",
        "msg.invite": "Bună, {name}! Credem că te potrivești foarte bine pentru „{title}”. Te interesează?",
        "msg.selected": "Vești bune - ai fost selectat(ă) pentru „{title}”. Să începem!",
    },
}

DOMAIN_NAMES = {
    "en": {
        "retail": "retail", "e-commerce": "e-commerce", "finance": "finance", "banking": "banking",
        "manufacturing": "manufacturing", "logistics": "logistics", "healthcare": "healthcare", "education": "education",
        "tourism": "tourism", "agriculture": "agriculture", "real-estate": "real estate", "marketing": "marketing",
        "public-sector": "public sector", "energy": "energy", "it-services": "IT services", "hr": "HR",
    },
    "ro": {
        "retail": "retail", "e-commerce": "comerț online", "finance": "finanțe", "banking": "bănci",
        "manufacturing": "producție", "logistics": "logistică", "healthcare": "sănătate", "education": "educație",
        "tourism": "turism", "agriculture": "agricultură", "real-estate": "imobiliare", "marketing": "marketing",
        "public-sector": "sector public", "energy": "energie", "it-services": "servicii IT", "hr": "resurse umane",
    },
}


def tr(key: str, lang_code: str | None = None, **params) -> str:
    texts = TEXTS[lang_code or lang()]
    return texts.get(key, TEXTS["en"][key]).format(**params)


def domain_name(domain: str, lang_code: str | None = None) -> str:
    return DOMAIN_NAMES[lang_code or lang()].get(domain, domain.replace("-", " "))


# ---------------------------------------------------------------- API errors
ERRORS_RO = {
    "Choose a demo persona (X-User-Id header missing)": "Autentifică-te mai întâi",
    "Unknown user": "Utilizator necunoscut",
    "Wrong username or password": "Utilizator sau parolă greșită",
    "Not your opportunity": "Oportunitatea nu îți aparține",
    "Only the company and the selected student can review": "Doar compania și studentul selectat pot lăsa o recenzie",
    "Only the company that posted this opportunity can do this": "Doar compania care a publicat oportunitatea poate face asta",
    "Only the selected student can mark the work as delivered": "Doar studentul selectat poate marca lucrarea ca predată",
    "You can message only within an opportunity you are part of": "Poți trimite mesaje doar în oportunitățile la care participi",
    "Company not found": "Compania nu a fost găsită",
    "No CV uploaded": "Nu a fost încărcat niciun CV",
    "Not found": "Nu a fost găsit",
    "Nothing to undo": "Nu este nimic de anulat",
    "Opportunity not found": "Oportunitatea nu a fost găsită",
    "Student not found": "Studentul nu a fost găsit",
    "A student can be selected only while the opportunity is open": "Un student poate fi selectat doar cât timp oportunitatea e deschisă",
    "Cannot withdraw now": "Nu te mai poți retrage acum",
    "Mentorship already requested": "Ai cerut deja ajutorul unui profesor",
    "Only pending invitations can be accepted or declined": "Doar invitațiile în așteptare pot fi acceptate sau refuzate",
    "Reviews open after payment is confirmed": "Recenziile se pot lăsa după confirmarea plății",
    "Select a student first": "Selectează mai întâi un student",
    "Select a student who applied or accepted your invitation": "Selectează un student care a aplicat sau ți-a acceptat invitația",
    "This opportunity is not accepting applications": "Oportunitatea nu mai primește aplicări",
    "This opportunity is not open any more": "Oportunitatea nu mai este deschisă",
    "This student already applied or was invited": "Studentul a aplicat deja sau a fost deja invitat",
    "You already applied": "Ai aplicat deja",
    "You already matched": "Aveți deja un match",
    "You already matched, a match cannot be undone": "Aveți deja un match, iar un match nu poate fi anulat",
    "You already reviewed this collaboration": "Ai lăsat deja o recenzie pentru această colaborare",
    "CV must be at most 5 MB": "CV-ul poate avea cel mult 5 MB",
    "CV must be PDF, DOC, DOCX or ODT": "CV-ul trebuie să fie PDF, DOC, DOCX sau ODT",
}

_ROLE_RO = {"student": "student", "company": "companie", "university": "universitate"}
_ERROR_PATTERNS_RO = [
    (re.compile(r"^Only (.+) accounts can do this$"),
     lambda m: "Doar conturile de tip " + " / ".join(_ROLE_RO.get(r, r) for r in m.group(1).split(" / ")) + " pot face asta"),
    (re.compile(r"^Cannot move from (\w+) to (\w+)$"), lambda m: f"Nu se poate trece din starea {m.group(1)} în {m.group(2)}"),
    (re.compile(r"^Rate each of (.+) from 1 to 5$"), lambda m: f"Dă o notă de la 1 la 5 pentru: {m.group(1)}"),
    (re.compile(r"^Unknown skills: (.+)$"), lambda m: f"Abilități necunoscute: {m.group(1)}"),
]


def translate_error(detail, lang_code: str | None = None):
    if (lang_code or lang()) != "ro" or not isinstance(detail, str):
        return detail
    if detail in ERRORS_RO:
        return ERRORS_RO[detail]
    for pattern, render in _ERROR_PATTERNS_RO:
        m = pattern.match(detail)
        if m:
            return render(m)
    return detail
