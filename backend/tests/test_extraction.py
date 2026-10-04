from app.llm.extraction import extract_requirements, postprocess
from app.llm.providers import HeuristicProvider, OllamaProvider
from app.llm.schema import Extraction, ExtractedSkill, SuggestedSkill
from app.matching.embeddings import chunk_similarity, chunk_text, hashing_embed
from app.skills_catalog import find_skill_mentions, normalize_skill


def test_normalize_skill_handles_synonyms_case_and_diacritics():
    assert normalize_skill("Microsoft Excel") == "excel"
    assert normalize_skill("POWERBI") == "power_bi"
    assert normalize_skill("analiză de date") == "data_analysis"
    assert normalize_skill("Power BI (DAX)") == "power_bi"
    assert normalize_skill("underwater basket weaving") is None


def test_mentions_prefer_longest_alias():
    ids = {sid for sid, _ in find_skill_mentions("We need Google Analytics reports")}
    assert "google_analytics" in ids
    assert "data_analysis" not in ids


def test_heuristic_extracts_mandatory_and_suggestions():
    text = ("Avem datele despre vânzări în mai multe fișiere Excel și vrem un raport lunar automat, cu grafice. "
            "Power BI este obligatoriu.")
    raw = HeuristicProvider().extract("Raport vanzari", text, "project")
    out = postprocess(raw, "Raport vanzari", text)
    by_id = {s["skill_id"]: s for s in out["skills"]}
    assert by_id["power_bi"]["mandatory"] is True
    assert by_id["excel"]["source"] == "explicit"
    assert all(not s["mandatory"] for s in out["skills"] if s["source"] == "suggested")
    assert out["domain"] == "retail"
    assert out["missing_info"]


def test_postprocess_downgrades_ungrounded_explicit_skill():
    text = "We need monthly sales charts in Excel."
    raw = Extraction(skills_explicit=[
        ExtractedSkill(skill="Excel", mandatory=True, evidence="sales charts in Excel"),
        ExtractedSkill(skill="Python", mandatory=True, evidence="must know Python"),  # hallucinated
    ], skills_suggested=[SuggestedSkill(skill="SQL", reason="data in a database")])
    out = postprocess(raw, "", text)
    by_id = {s["skill_id"]: s for s in out["skills"]}
    assert by_id["excel"]["mandatory"] is True
    assert by_id["python"]["source"] == "suggested" and by_id["python"]["mandatory"] is False
    assert by_id["sql"]["mandatory"] is False


def test_ollama_failure_falls_back_to_heuristic(monkeypatch):
    import app.llm.extraction as ex

    monkeypatch.setattr(ex, "get_provider", lambda: OllamaProvider("http://127.0.0.1:9", "qwen3:4b", 1, 2048))
    out = extract_requirements("Scraper", "We need a Python web scraping tool for competitor prices, delivered in 2 weeks.")
    assert out["provider"] == "heuristic"
    assert out["fallback_reason"]
    assert {"python", "web_scraping"} <= {s["skill_id"] for s in out["skills"]}


def test_chunking_respects_word_limit():
    chunks = chunk_text(" ".join(["word"] * 200) + ". Short sentence.")
    assert all(len(c.split()) <= 55 for c in chunks)
    assert len(chunks) >= 4


def test_hashing_embeddings_capture_synonyms_across_languages():
    a = [hashing_embed("Vrem rapoarte vizuale despre vanzari in Power BI")]
    b = [hashing_embed("I built Power BI dashboards for sales reporting")]
    c = [hashing_embed("Responsive bakery website in React")]
    assert chunk_similarity(a, b) > chunk_similarity(a, c)


def test_optional_cue_in_same_sentence_keeps_skill_optional():
    text = "Avem fisiere Excel cu vanzari si dorim un dashboard. Power BI este obligatoriu, SQL este un plus."
    out = postprocess(HeuristicProvider().extract("Dashboard", text, "project"), "Dashboard", text)
    by_id = {s["skill_id"]: s for s in out["skills"]}
    assert by_id["power_bi"]["mandatory"] is True
    assert by_id["sql"]["mandatory"] is False
    assert "database_design" not in by_id


def test_hybrid_merge_fixes_small_model_misses():
    from app.llm.extraction import merge_with_rules

    title = "Dashboard"
    text = "Datele sunt in mai multe fisiere Excel. Vrem un dashboard. Power BI este obligatoriu, SQL este un plus."
    llm = Extraction(  # what qwen3:1.7b actually returned: Power BI not mandatory, Excel missing, no domain
        skills_explicit=[ExtractedSkill(skill="Power BI", evidence="Power BI este obligatoriu"),
                         ExtractedSkill(skill="SQL", mandatory=True, evidence="SQL este un plus")],
        tasks=["Build the dashboard"],
    )
    rules = HeuristicProvider().extract(title, text, "project")
    out = postprocess(merge_with_rules(llm, rules), title, text)
    by_id = {s["skill_id"]: s for s in out["skills"]}
    assert by_id["power_bi"]["mandatory"] is True
    assert by_id["sql"]["mandatory"] is False
    assert by_id["excel"]["source"] == "explicit"
    assert out["tasks"] == ["Build the dashboard"]


def test_startup_pull_downloads_missing_model_once():
    from app.llm import providers

    class FakeOllama:
        model = "qwen3:1.7b"
        pulls = 0

        def status(self):
            return {"reachable": True, "model_pulled": self.pulls > 0}

        def pull(self):
            self.pulls += 1

    fake = FakeOllama()
    providers._pull_worker(fake)
    assert fake.pulls == 1 and providers.pull_state["state"] == "ready"
    providers._pull_worker(fake)  # already present -> no second download
    assert fake.pulls == 1
