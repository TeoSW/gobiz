from conftest import as_user


def _new_opportunity(client, company_id: int) -> dict:
    body = {
        "type": "project", "title": "Inventory dashboard test", "domain": "retail",
        "description": "Build an inventory dashboard in Power BI from our weekly Excel stock exports.",
        "tasks": ["Model the stock data", "Build the dashboard"], "hours_per_week": 8, "duration_weeks": 2,
        "compensation_type": "fixed", "compensation_amount": 1000,
        "requirements": [{"skill_id": "power_bi", "min_level": 2, "mandatory": True},
                         {"skill_id": "excel", "min_level": 1}],
    }
    r = client.post("/api/opportunities", json=body, headers=as_user(company_id))
    assert r.status_code == 201, r.text
    return r.json()


def test_personas_cover_three_roles(client):
    roles = {p["role"] for p in client.get("/api/personas").json()}
    assert roles == {"student", "company", "university"}


def test_explore_tabs_and_student_match(client, personas):
    andrei = personas["Andrei Popescu"]
    for t in ("project", "internship", "job"):
        items = client.get(f"/api/opportunities?type={t}", headers=as_user(andrei)).json()
        assert items and all(o["type"] == t for o in items)
        assert all(o["match"] is not None for o in items)


def test_only_companies_publish(client, personas):
    r = client.post("/api/opportunities", json={}, headers=as_user(personas["Andrei Popescu"]))
    assert r.status_code in (403, 422)


def test_full_collaboration_flow_builds_verified_portfolio(client, personas):
    company, student = personas["Carpathia Retail SRL"], personas["Andrei Popescu"]
    before = client.get("/api/students/me", headers=as_user(student)).json()["portfolio"]["completed"]
    opp = _new_opportunity(client, company)

    cands = client.get(f"/api/opportunities/{opp['id']}/candidates", headers=as_user(company)).json()
    assert cands["ai_matches"][0]["student"]["name"] == "Andrei Popescu"

    # cannot select someone who did not apply / accept
    assert client.post(f"/api/opportunities/{opp['id']}/select", json={"student_id": student},
                       headers=as_user(company)).status_code == 409

    assert client.post(f"/api/opportunities/{opp['id']}/apply", json={"message": "Hi"}, headers=as_user(student)).status_code == 201
    assert client.post(f"/api/opportunities/{opp['id']}/apply", json={}, headers=as_user(student)).status_code == 409

    r = client.post(f"/api/opportunities/{opp['id']}/select", json={"student_id": student}, headers=as_user(company))
    assert r.json()["status"] == "in_progress"

    # wrong actor for "delivered"
    assert client.post(f"/api/opportunities/{opp['id']}/status", json={"status": "delivered"},
                       headers=as_user(company)).status_code == 403
    assert client.post(f"/api/opportunities/{opp['id']}/status", json={"status": "delivered"},
                       headers=as_user(student)).status_code == 200
    assert client.post(f"/api/opportunities/{opp['id']}/status", json={"status": "paid"},
                       headers=as_user(company)).status_code == 200

    bad = client.post(f"/api/opportunities/{opp['id']}/reviews", json={"ratings": {"quality": 5}}, headers=as_user(company))
    assert bad.status_code == 422
    r = client.post(f"/api/opportunities/{opp['id']}/reviews",
                    json={"ratings": {"quality": 5, "deadline": 4, "communication": 5}, "comment": "Great"},
                    headers=as_user(company))
    assert r.json()["status"] == "completed"
    r = client.post(f"/api/opportunities/{opp['id']}/reviews",
                    json={"ratings": {"clarity": 5, "collaboration": 5, "payment": 5}}, headers=as_user(student))
    assert r.status_code == 201

    after = client.get("/api/students/me", headers=as_user(student)).json()["portfolio"]
    assert after["completed"] == before + 1
    assert any(i["title"] == "Inventory dashboard test" for i in after["items"])


def test_invitation_accept_and_messaging_scope(client, personas):
    company, student = personas["PixelHaus Studio"], personas["Larisa Enache"]
    opp = _new_opportunity(client, company)
    r = client.post(f"/api/opportunities/{opp['id']}/invite", json={"student_id": student}, headers=as_user(company))
    assert r.status_code == 201
    apps = client.get("/api/applications/mine", headers=as_user(student)).json()
    inv = next(a for a in apps if a["opportunity"]["id"] == opp["id"])
    assert inv["kind"] == "invitation"
    assert client.post(f"/api/applications/{inv['id']}/respond", json={"action": "accept"},
                       headers=as_user(student)).json()["status"] == "accepted"
    ok = client.post("/api/messages", json={"opportunity_id": opp["id"], "recipient_id": company, "body": "Thanks!"},
                     headers=as_user(student))
    assert ok.status_code == 201
    outsider = personas["Teodor Rusu"]
    denied = client.post("/api/messages", json={"opportunity_id": opp["id"], "recipient_id": company, "body": "Hi"},
                         headers=as_user(outsider))
    assert denied.status_code == 403


def test_university_dashboard_and_verification(client, personas):
    uni = personas["Prof. Elena Marin"]
    dash = client.get("/api/university/dashboard", headers=as_user(uni)).json()
    assert dash["kpis"]["students"] >= 14
    assert dash["top_skills"] and dash["skill_gap"]
    queue = client.get("/api/university/verification-queue", headers=as_user(uni)).json()
    assert queue
    r = client.post(f"/api/university/opportunities/{queue[0]['id']}/verify", json={"approve": True}, headers=as_user(uni))
    assert r.json()["university_verified"] is True
    assert client.get("/api/university/dashboard", headers=as_user(personas["Andrei Popescu"])).status_code == 403


def test_ai_extract_endpoint(client, personas):
    r = client.post("/api/ai/extract", headers=as_user(personas["NordLogix Transport"]),
                    json={"title": "Raport", "description": "Vrem automatizarea raportului zilnic din Excel cu Python. Python obligatoriu."})
    assert r.status_code == 200
    data = r.json()
    assert data["provider"] == "heuristic"
    assert any(s["skill_id"] == "python" and s["mandatory"] for s in data["skills"])


def test_graph_sync_is_a_silent_noop_without_neo4j(client, caplog):
    from app import graph
    from app.db import SessionLocal

    with SessionLocal() as db, caplog.at_level("WARNING"):
        graph.safe_sync(db)
        assert graph.sync_all(db) is False
    assert "Neo4j sync failed" not in caplog.text
    assert graph.co_demand(SessionLocal(), 3)["source"] == "sql"
