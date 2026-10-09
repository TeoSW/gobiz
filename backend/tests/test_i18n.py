from conftest import as_user

RO = {"Accept-Language": "ro"}


def test_errors_follow_the_request_language(client):
    bad = {"username": "teststudent", "password": "wrong"}
    assert client.post("/api/auth/login", json=bad).json()["detail"] == "Wrong username or password"
    assert client.post("/api/auth/login", json=bad, headers=RO).json()["detail"] == "Utilizator sau parolă greșită"
    assert client.post("/api/auth/login", json=bad, headers={"Accept-Language": "ro-RO,ro;q=0.9,en;q=0.8"}).json()["detail"].startswith("Utilizator")
    assert client.get("/api/opportunities/99999", headers=RO).json()["detail"] == "Oportunitatea nu a fost găsită"
    # dynamic messages are translated too
    prof = client.get("/api/personas").json()
    uni = next(p["id"] for p in prof if p["role"] == "university")
    r = client.post("/api/ai/extract", json={"title": "x", "description": "y"}, headers={**as_user(uni), **RO})
    assert r.status_code == 403 and r.json()["detail"] == "Doar conturile de tip companie pot face asta"


def test_match_explanations_and_skill_names_in_romanian(client, personas):
    h = as_user(personas["Test Student"])
    en = client.get("/api/students/me/recommendations?type=project", headers=h).json()
    ro = client.get("/api/students/me/recommendations?type=project", headers={**h, **RO}).json()
    assert [o["id"] for o in en] == [o["id"] for o in ro]  # same ranking, only the words change
    assert en[0]["match"]["summary"].startswith("Meets ")
    assert ro[0]["match"]["summary"].startswith("Îndeplinește ")
    assert {c["code"] for c in ro[0]["match"]["checks"]} >= {"type", "availability", "mode", "experience"}
    names_ro = {s["skill_id"]: s["name"] for o in ro for s in o["skills"]}
    names_en = {s["skill_id"]: s["name"] for o in en for s in o["skills"]}
    assert names_en["data_visualization"] == "Data Visualization"
    assert names_ro["data_visualization"] == "Vizualizarea datelor"
    meta = client.get("/api/meta", headers=RO).json()
    assert meta["domain_names"]["logistics"] == "logistică"
    assert next(s for s in meta["skills"] if s["id"] == "data_cleaning")["name"] == "Curățarea datelor"


def test_ai_extraction_questions_in_romanian(client, personas):
    body = {"title": "Dashboard", "description": "Avem date de vanzari in Excel. Vrem un dashboard Power BI."}
    out = client.post("/api/ai/extract", json=body, headers={**as_user(personas["Test SRL"]), **RO}).json()
    assert "Care este bugetul / plata?" in out["missing_info"]
    assert any(s["skill_id"] == "power_bi" and s["name"] == "Power BI" for s in out["skills"])


def test_unknown_language_falls_back_to_english(client):
    r = client.post("/api/auth/login", json={"username": "x", "password": "y"}, headers={"Accept-Language": "de"})
    assert r.json()["detail"] == "Wrong username or password"
