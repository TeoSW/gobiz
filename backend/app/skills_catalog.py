"""Canonical skill catalog.

Both forms (company + student) use the same ids, so "Microsoft Excel", "excel" and "foi de calcul"
all become `excel`. Labels follow ESCO wording where a close ESCO concept exists (esco_hint);
the catalog is intentionally small and editable. `related` edges feed partial credit in matching
and the optional Neo4j knowledge graph.
"""

import difflib
import re
import unicodedata

# id, name, category, esco_hint, synonyms (EN + RO, lowercase), related ids
_RAW: list[tuple[str, str, str, str, list[str], list[str]]] = [
    # --- data & analytics
    ("excel", "Excel", "data", "use spreadsheets software", ["microsoft excel", "ms excel", "spreadsheet", "spreadsheets", "foi de calcul", "pivot table", "pivot tables", "tabele pivot", "xlsx"], ["vba", "power_query", "data_analysis"]),
    ("vba", "Excel VBA / Macros", "automation", "", ["macro", "macros", "macrocomenzi", "visual basic"], ["excel", "process_automation"]),
    ("power_query", "Power Query", "data", "", ["power query", "m language"], ["excel", "power_bi", "data_cleaning"]),
    ("power_bi", "Power BI", "bi", "use business intelligence software", ["powerbi", "power bi", "dax", "microsoft power bi"], ["tableau", "data_visualization", "dashboards", "power_query", "sql"]),
    ("tableau", "Tableau", "bi", "", ["tableau desktop"], ["power_bi", "data_visualization", "dashboards"]),
    ("looker_studio", "Looker Studio", "bi", "", ["google data studio", "looker studio", "data studio"], ["dashboards", "data_visualization", "google_analytics"]),
    ("dashboards", "Dashboards & Reporting", "bi", "", ["dashboard", "dashboarduri", "raport", "rapoarte", "report", "reports", "reporting", "raportare", "kpi"], ["power_bi", "tableau", "data_visualization"]),
    ("data_visualization", "Data Visualization", "data", "present data visually", ["vizualizare", "vizualizarea datelor", "grafice", "charts", "charting", "visualisation", "visualization"], ["dashboards", "power_bi", "python"]),
    ("data_analysis", "Data Analysis", "data", "perform data analysis", ["analiza datelor", "analiză de date", "analiza de date", "data analytics", "analytics", "analize"], ["excel", "python", "sql", "statistics"]),
    ("data_cleaning", "Data Cleaning", "data", "perform data cleansing", ["curatare", "curățare", "curatarea datelor", "data cleansing", "data wrangling", "deduplicare", "deduplication"], ["data_analysis", "python", "excel"]),
    ("sql", "SQL", "data", "SQL", ["mysql", "postgresql", "postgres", "sql server", "t-sql", "query", "queries", "interogari"], ["database_design", "data_analysis", "power_bi"]),
    ("database_design", "Database Design", "data", "design database scheme", ["database design", "proiectare baze de date", "proiectarea bazei de date", "organizarea bazei de date", "schema", "modelare date", "data modeling", "data modelling", "normalizare"], ["sql", "data_cleaning"]),
    ("etl", "ETL / Data Pipelines", "data", "", ["etl", "pipeline", "pipelines", "data pipeline", "integrare date", "data integration"], ["sql", "python", "data_cleaning"]),
    ("statistics", "Statistics", "quant", "statistics", ["statistica", "statistică", "statistical analysis", "analiza statistica", "regresie", "regression", "hypothesis testing"], ["econometrics", "r", "data_analysis"]),
    ("econometrics", "Econometrics", "quant", "econometrics", ["econometrie", "time series", "serii de timp", "panel data", "arima", "forecasting", "prognoza", "prognoză"], ["statistics", "r", "python"]),
    ("r", "R", "programming", "R", ["r language", "rstudio", "tidyverse", "ggplot"], ["statistics", "econometrics"]),
    ("spss", "SPSS / Stata", "quant", "", ["spss", "stata", "eviews"], ["statistics", "econometrics"]),
    # --- programming & software
    ("python", "Python", "programming", "Python (computer programming)", ["python3", "pandas", "numpy", "jupyter"], ["data_analysis", "machine_learning", "web_scraping", "process_automation"]),
    ("javascript", "JavaScript / TypeScript", "programming", "JavaScript", ["js", "typescript", "ts", "node", "nodejs", "node.js"], ["react", "web_development"]),
    ("react", "React", "web", "", ["reactjs", "react.js", "next.js", "nextjs"], ["javascript", "web_development", "ui_design"]),
    ("web_development", "Web Development", "web", "develop websites", ["website", "site web", "website-uri", "web app", "aplicatie web", "aplicație web", "html", "css", "frontend", "front-end", "landing page"], ["javascript", "react", "wordpress", "ui_design"]),
    ("wordpress", "WordPress", "web", "", ["wordpress", "woocommerce", "cms"], ["web_development"]),
    ("backend_api", "Backend & APIs", "web", "", ["api", "rest api", "backend", "back-end", "fastapi", "django", "flask", "express"], ["python", "javascript", "database_design"]),
    ("java", "Java", "programming", "Java (computer programming)", ["java", "spring", "spring boot"], ["backend_api"]),
    ("csharp", "C# / .NET", "programming", "C#", ["c#", ".net", "dotnet", "asp.net"], ["backend_api"]),
    ("mobile_development", "Mobile Development", "web", "", ["android", "ios", "flutter", "react native", "aplicatie mobila", "aplicație mobilă", "mobile app"], ["javascript", "ui_design"]),
    ("git", "Git", "tools", "", ["github", "gitlab", "version control"], ["python", "javascript"]),
    # --- automation, scraping, AI
    ("process_automation", "Process Automation", "automation", "automate tasks", ["automatizare", "automatizarea", "automation", "automate", "automatizari", "automatizări", "rpa", "scripting", "power automate"], ["python", "vba", "excel"]),
    ("web_scraping", "Web Scraping", "automation", "", ["scraping", "scraper", "crawler", "crawling", "beautifulsoup", "selenium", "extragere date de pe site", "colectare date online"], ["python", "data_cleaning"]),
    ("machine_learning", "Machine Learning", "ai", "machine learning", ["ml", "invatare automata", "învățare automată", "scikit-learn", "sklearn", "classification", "clasificare", "clustering", "predictive model", "model predictiv", "segmentare clienti"], ["python", "statistics", "deep_learning"]),
    ("deep_learning", "Deep Learning", "ai", "", ["neural network", "retele neuronale", "rețele neuronale", "pytorch", "tensorflow", "computer vision"], ["machine_learning", "python"]),
    ("nlp_llm", "NLP / LLMs", "ai", "", ["nlp", "llm", "chatbot", "gpt", "rag", "text mining", "sentiment analysis", "analiza sentimentului", "procesare limbaj natural"], ["machine_learning", "python"]),
    # --- business & research
    ("market_research", "Market Research", "business", "perform market research", ["analiza de piata", "analiză de piață", "analize de piata", "studiu de piata", "market analysis", "competitor analysis", "analiza concurentei", "analiza concurenței"], ["survey_design", "data_analysis"]),
    ("survey_design", "Survey Design & Analysis", "business", "design questionnaires", ["chestionar", "chestionare", "questionnaire", "survey", "surveys", "sondaj", "google forms"], ["statistics", "market_research", "spss"]),
    ("financial_analysis", "Financial Analysis", "business", "perform financial analysis", ["analiza financiara", "analiză financiară", "financial modeling", "modelare financiara", "budgeting", "cash flow", "bilant", "bilanț"], ["excel", "accounting"]),
    ("accounting", "Accounting", "business", "", ["contabilitate", "bookkeeping", "saga", "facturi", "invoices"], ["financial_analysis", "excel"]),
    ("digital_marketing", "Digital Marketing", "business", "digital marketing techniques", ["marketing digital", "social media", "seo", "sem", "google ads", "facebook ads", "campanii"], ["google_analytics", "copywriting"]),
    ("google_analytics", "Google Analytics", "business", "", ["ga4", "google analytics", "web analytics", "trafic site"], ["digital_marketing", "looker_studio"]),
    ("copywriting", "Copywriting & Content", "business", "", ["content", "continut", "conținut", "articole", "blog", "texte"], ["digital_marketing"]),
    ("project_management", "Project Management", "business", "perform project management", ["managementul proiectelor", "scrum", "agile", "jira", "trello"], []),
    ("erp_crm", "ERP / CRM Systems", "business", "", ["erp", "crm", "sap", "hubspot", "salesforce", "odoo"], ["database_design", "process_automation"]),
    # --- design
    ("ui_design", "UI/UX Design", "design", "", ["ui", "ux", "ui/ux", "figma", "wireframe", "prototip", "user experience"], ["web_development", "graphic_design"]),
    ("graphic_design", "Graphic Design", "design", "", ["design grafic", "photoshop", "illustrator", "canva", "logo", "branding"], ["ui_design"]),
    # --- languages & soft
    ("english", "English (professional)", "language", "English", ["engleza", "engleză", "english"], []),
    ("communication", "Business Communication", "soft", "", ["comunicare", "presentation", "prezentare", "client communication"], []),
]

DOMAINS = [
    "retail", "e-commerce", "finance", "banking", "manufacturing", "logistics", "healthcare", "education",
    "tourism", "agriculture", "real-estate", "marketing", "public-sector", "energy", "it-services", "hr",
]


def _norm(text: str) -> str:
    text = unicodedata.normalize("NFKD", text.lower())
    text = "".join(ch for ch in text if not unicodedata.combining(ch))
    return re.sub(r"\s+", " ", text).strip()


SKILLS: list[dict] = [
    {"id": sid, "name": name, "category": cat, "esco_hint": esco, "synonyms": syns, "related": rel}
    for sid, name, cat, esco, syns, rel in _RAW
]
SKILL_BY_ID: dict[str, dict] = {s["id"]: s for s in SKILLS}

# alias (normalised, diacritics removed) -> skill id
_ALIASES: dict[str, str] = {}
for _s in SKILLS:
    for _alias in [_s["id"].replace("_", " "), _s["name"], *_s["synonyms"]]:
        _ALIASES.setdefault(_norm(_alias), _s["id"])


def related_skills(skill_id: str) -> set[str]:
    """Undirected relation: A related to B if either lists the other."""
    out = set(SKILL_BY_ID.get(skill_id, {}).get("related", []))
    out |= {s["id"] for s in SKILLS if skill_id in s["related"]}
    out.discard(skill_id)
    return out


def normalize_skill(label: str) -> str | None:
    """Map a free-text skill label (EN/RO, any casing/diacritics) to a canonical id, or None."""
    key = _norm(label)
    if not key:
        return None
    if key in _ALIASES:
        return _ALIASES[key]
    # "Power BI (DAX)" -> try the part before parentheses / slashes
    for part in re.split(r"[()/,;]", key):
        part = part.strip()
        if part in _ALIASES:
            return _ALIASES[part]
    close = difflib.get_close_matches(key, _ALIASES.keys(), n=1, cutoff=0.86)
    return _ALIASES[close[0]] if close else None


_ALIAS_PATTERNS = sorted(_ALIASES.items(), key=lambda kv: -len(kv[0]))


def find_skill_mentions(text: str) -> list[tuple[str, str]]:
    """Return (skill_id, matched alias) for every catalog alias that occurs as a whole word in text.

    Longest aliases win and their span is consumed, so "google analytics" does not also count as "analytics".
    """
    norm = _norm(text)
    found: dict[str, str] = {}
    for alias, sid in _ALIAS_PATTERNS:
        if alias == "r":
            # the language R needs strict context to avoid false positives
            pattern = r"(?<![\w.])r(?=\s*(?:,|\)|\s+(?:si|and|or|sau)\b|$))"
        elif len(alias) < 2:
            continue
        else:
            pattern = r"(?<![\w])" + re.escape(alias) + r"(?![\w])"
        match = re.search(pattern, norm)
        if not match:
            continue
        found.setdefault(sid, alias)
        norm = re.sub(pattern, lambda m: " " * len(m.group(0)), norm)
    return list(found.items())
