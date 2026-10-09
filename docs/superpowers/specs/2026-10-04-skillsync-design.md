# SkillSync (formerly SkillSync): design spec (prototype v0.1, swipe matching added in v0.2)

Date: 2026-10-04 · Status: approved (with changes) · UI language: English

## 1. Product

SkillSync connects **student skills** with **real company problems**. It is not a job board:
companies (mostly SMEs) post small, well-bounded work, students build verified experience.

Three opportunity tabs, each side declares what it is interested in:

| Tab | Typical use |
|---|---|
| **Projects** | micro-projects (dashboard, scraping, Excel/Python automation, survey analysis, small ML, simple websites); can double as course project / thesis starting point |
| **Internships** | practice / internship (e.g. mandatory year-2 practice) |
| **Jobs** | part-time / full-time / junior employment |

Roles: **Student**, **Company**, **University** (mentor / validator / aggregated insights).
No real authentication in the prototype: a persona switcher sends `X-User-Id`.

Core flow:
`Company publishes problem → LLM extracts requirements → company confirms → platform recommends students
→ company invites / student applies → selection → work → delivery → payment (simulated status) → mutual
review → verified portfolio`.

Matching is a **recommendation, never a decision**: students can apply to anything, companies can search
and invite anyone. "Apply" + "Invite" + "AI Match" coexist.

## 2. Constraints

* **Open source only, no paid services, no logins to third-party sites.**
* Must run on: i5-9400F, 16 GB DDR4, GTX 1050 Ti (4 GB VRAM).

## 3. Architecture

```
frontend  React 18 + Vite + TypeScript + Tailwind v4 + React Router + TanStack Query + Recharts + lucide-react
   │  same origin in Docker (FastAPI serves the built UI), Vite proxy in dev
backend   FastAPI + SQLAlchemy 2 + Pydantic v2 (Python 3.12)
   ├── MySQL 8.4 (system of record; SQLite fallback for local dev/tests)
   ├── Ollama  → qwen3:1.7b default (Apache-2.0, ~1.4 GB, fully on a 4 GB GPU); qwen3:4b optional: requirement extraction
   ├── sentence-transformers → paraphrase-multilingual-MiniLM-L12-v2 (Apache-2.0, 384-d, RO+EN)
   └── Neo4j 5 Community (optional, compose profile `graph`): skill knowledge graph
```

All orchestrated by `docker-compose.yml`; GPU passthrough for Ollama is a separate override file
(`docker-compose.gpu.yml`) so the stack still runs on machines without NVIDIA runtime.

### LLM layer
`LLMProvider` interface, two implementations, selected by `LLM_PROVIDER`:
* `ollama` (default): `/api/chat` with a JSON-Schema `format` (structured outputs), `temperature 0`, `think: false`.
* `heuristic`: dictionary + synonym + regex extractor. Automatic fallback when Ollama is unreachable or returns invalid JSON.

Extraction output (validated with Pydantic): `summary, tasks[], skills_explicit[{skill,min_level,mandatory,evidence}],
skills_suggested[{skill,min_level,reason}], missing_info[], domain, difficulty, type_guess`.
Post-processing rules (from the design discussion):
1. Skill names are normalised to the canonical catalog (ESCO-inspired ids, synonyms, fuzzy match).
2. An "explicit" skill whose evidence is not found in the text is downgraded to "suggested".
3. Suggested skills are **never** mandatory automatically. The company confirms level / mandatory / learnable.
4. Fields the company already filled in the form are stored directly, not re-interpreted.

## 4. Matching engine (content-based recommender)

Per (student, opportunity):

1. **Hard filters** → `incompatible` / `to_clarify` / `evaluated`
   * opportunity type ∈ student's accepted types
   * student hours/week ≥ required hours
   * availability period overlaps (when both declared)
   * work mode compatible (remote-only student vs on-site role → incompatible; hybrid in another city → to clarify)
   * mandatory skill declared below the minimum → incompatible, **unless** the company marked it *learnable with guidance*
     and the student marked *want to learn* (partial credit)
   * mandatory skill not declared at all → `to_clarify`
2. **Score** (weights configurable, defaults from the design discussion):
   `score = 100 × (0.50·skills + 0.25·experience + 0.15·interests + 0.10·semantic)`
   * *skills*: weighted requirement coverage (mandatory ×2). Met = 1, learnable+wants-to-learn = 0.5,
     related skill at the required level (knowledge graph / catalog relations) = 0.3.
   * *experience*: verified completed SkillSync projects with overlapping skills/domain (1.0 each) + self-declared
     projects (0.5 each), saturating at 2; scaled by average rating when present.
   * *interests*: domain match + goal match (course credit, thesis, mandatory practice, paid project, job).
   * *semantic*: cosine similarity of embeddings. Texts are chunked (model limit 128 tokens): opportunity
     tasks/description chunks vs student bio/projects/courses chunks; score = mean over opportunity chunks of the
     best student chunk. Vectors cached in DB with a hash of text + model id; recomputed only on change.
     Fallback backend: hashed bag-of-words cosine.
3. **Explanation**: ✓/✗/~ per skill, availability ✓, similar experience ✓, *to clarify* list.
   The UI states that the score is a ranking aid, not a probability of success.

**Evaluation** (`backend/scripts/evaluate_matching.py`): precision@5 against manually labelled relevant students per
opportunity, comparing full engine vs skills-only baseline vs semantic-only.

**Learning later**: every apply / invite / accept / decline / select / complete / rating is logged to
`interaction_events`: the training data for a future learned ranker (cold-start avoided by starting rule-based).

## 5. Reputation & education
* After completion: company rates student (quality, deadline, communication); student rates company
  (clarity, collaboration, payment). Completed project enters the **verified portfolio**
  ("4 completed · 2 Power BI · rating 4.8/5").
* Opportunities can be marked suitable for course credit / practice / thesis; a university can mark them
  **University Verified**; students can request **mentorship** for an opportunity.
* University dashboard: opportunities by type, average compensation, most requested skills, skill gap
  (demand vs student supply), domains in demand, verification queue, mentorship requests, co-demanded skills
  (Neo4j when enabled, SQL fallback).

## 6. Screens
Home · Explore (Projects/Internships/Jobs tabs, filters, match badges) · Opportunity detail (match breakdown, apply,
mentorship, candidates & pipeline for owner, messages, reviews) · Student dashboard · Student profile editor (skills
level 0-3 + want-to-learn, interests/goals, availability, courses, projects, CV upload) · Public student profile ·
Company dashboard · Post-opportunity wizard (describe → AI extraction → confirm skills → details → publish → instant
recommendations) · Talent search + invite · Messages · University dashboard · System status (LLM / embeddings / graph).

Visual: design-system/skillsync/MASTER.md: brand blues from the logo (`#0E2A47`, `#1D4E89`, `#4A9BD4`; v0.1 used trust blue `#2563EB`), CTA orange `#EA580C`, Plus Jakarta Sans (self-hosted),
light/dark toggle (light default), subtle glass on nav/modals only, lucide icons, AA contrast, visible focus,
reduced-motion respected.

## 7. Testing
* pytest: hard filters, scoring, explanation, extraction normalisation & heuristic provider, API happy path
  (SQLite + hashing embeddings, no network).
* TypeScript type-check + production build of the frontend.
* Manual run of all three roles in the browser.

## 8. Out of scope
Real payments, real auth, cloud file storage, learned ranking model, notifications/e-mail.


## v0.2 (2026-10-09): SkillSync name and swipe matching

* Name **SkillSync**, slogan **"Match făcut. Proiect început."**, logo from the brand file (two sync arrows + three growth bars).
* **Swipe matching** (Tinder-style). Students get a deck of open opportunities ranked by the matching engine, companies get a deck of
  students per open opportunity (or all of them). Clear mismatches (status `incompatible`) are not shown.
  * Right = interested, left = skip. A right swipe stays private until the other side also swipes right.
  * A pending application counts as the student's right swipe and a pending invitation as the company's, so the classic
    buttons and the decks stay consistent (apply after a company's right swipe = instant match, and the other way round).
  * Match = `Application(kind="match", status="accepted")`: it opens the chat (listed in Messages even before the first
    message) and the company can select the student like any accepted application.
  * Undo removes your last swipe unless it already produced a match.
  * Swipes are stored in `swipes` (one row per side) and logged as interaction events (`swipe_right`, `swipe_left`, `match`).
