"""Structured output contract for requirement extraction (shared by every LLM provider)."""

from pydantic import BaseModel, Field


class ExtractedSkill(BaseModel):
    skill: str = Field(description="Skill name as written or implied, e.g. 'Power BI'")
    min_level: int = Field(default=1, ge=1, le=3, description="1 beginner, 2 intermediate, 3 advanced")
    mandatory: bool = False
    evidence: str = Field(default="", description="Exact short quote from the text that mentions this skill")


class SuggestedSkill(BaseModel):
    skill: str
    min_level: int = Field(default=1, ge=1, le=3)
    reason: str = ""


class Extraction(BaseModel):
    summary: str = ""
    type_guess: str = Field(default="project", description="project | internship | job")
    domain: str = ""
    difficulty: int = Field(default=2, ge=1, le=3)
    tasks: list[str] = Field(default_factory=list)
    skills_explicit: list[ExtractedSkill] = Field(default_factory=list)
    skills_suggested: list[SuggestedSkill] = Field(default_factory=list)
    missing_info: list[str] = Field(default_factory=list)


# JSON schema passed to Ollama's `format` parameter (structured outputs).
EXTRACTION_JSON_SCHEMA = Extraction.model_json_schema()


SYSTEM_PROMPT = """You extract requirements from a company's description of a small project, internship or job
on a platform that matches university students with SMEs. The text may be in Romanian or English.
Return ONLY JSON matching the schema. Rules:
- summary, tasks, missing_info and reasons: write them in {language}.
- tasks: concrete, short work items (max 6). Only what the text implies; no generic filler.
- skills_explicit: only skills/tools the text actually mentions. evidence must be an exact quote from the text.
  mandatory=true only if the text says it is required/obligatoriu/must.
- skills_suggested: skills that are clearly useful but NOT mentioned. Never mark them mandatory.
  Do not invent technologies the company did not ask for (e.g. do not add Python if only Excel is mentioned
  unless it is genuinely necessary; then put it here with a reason).
- min_level: 1 beginner, 2 intermediate, 3 advanced; infer from wording, default 1.
- missing_info: questions a student would need answered (data access, deadline, budget, tools, format of delivery...).
- domain: one word industry such as retail, finance, logistics, marketing, healthcare, education, e-commerce.
- difficulty: 1 easy, 2 medium, 3 hard.
- type_guess: project, internship or job."""
