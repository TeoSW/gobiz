from conftest import as_user, new_opportunity as _new_opportunity


def test_demo_has_at_most_two_accounts_per_role(client):
    people = client.get("/api/personas").json()
    for role in ("student", "company", "university"):
        assert 1 <= sum(p["role"] == role for p in people) <= 2


def test_login_with_the_three_test_accounts(client, personas):
    accounts = client.get("/api/auth/demo-accounts").json()
    assert {a["name"] for a in accounts} == {"Test Student", "Test SRL", "Test Professor"}
    for a in accounts:
        r = client.post("/api/auth/login", json={"username": a["username"], "password": a["password"]})
        assert r.status_code == 200 and r.json()["id"] == personas[a["name"]]
    assert client.post("/api/auth/login", json={"username": "teststudent", "password": "wrong"}).status_code == 401
    assert client.post("/api/auth/login", json={"username": "maria", "password": ""}).status_code == 401  # data-only user


def test_cv_upload_replace_and_delete(client, personas):
    h = as_user(personas["Test Student"])
    assert client.post("/api/students/me/cv", files={"file": ("cv.exe", b"x")}, headers=h).status_code == 422
    r = client.post("/api/students/me/cv", files={"file": ("My CV.pdf", b"%PDF-1.4 demo")}, headers=h)
    assert r.status_code == 200 and r.json()["cv_filename"].endswith("My_CV.pdf")
    assert client.get(f"/api/students/{personas['Test Student']}/cv", headers=h).content == b"%PDF-1.4 demo"
    assert client.delete("/api/students/me/cv", headers=h).json() == {"cv_filename": ""}
    assert client.get(f"/api/students/{personas['Test Student']}/cv", headers=h).status_code == 404


def test_explore_tabs_and_student_match(client, personas):
    andrei = personas["Test Student"]
    for t in ("project", "internship", "job"):
        items = client.get(f"/api/opportunities?type={t}", headers=as_user(andrei)).json()
        assert items and all(o["type"] == t for o in items)
        assert all(o["match"] is not None for o in items)


def test_only_companies_publish(client, personas):
    r = client.post("/api/opportunities", json={}, headers=as_user(personas["Test Student"]))
    assert r.status_code in (403, 422)


def test_full_collaboration_flow_builds_verified_portfolio(client, personas):
    company, student = personas["Test SRL"], personas["Test Student"]
    before = client.get("/api/students/me", headers=as_user(student)).json()["portfolio"]["completed"]
    opp = _new_opportunity(client, company)

    cands = client.get(f"/api/opportunities/{opp['id']}/candidates", headers=as_user(company)).json()
    assert cands["ai_matches"][0]["student"]["name"] == "Test Student"

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
    company, student = personas["Demo Logistics SRL"], personas["Maria Ionescu"]
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
    outsider = personas["Test Student"]
    denied = client.post("/api/messages", json={"opportunity_id": opp["id"], "recipient_id": company, "body": "Hi"},
                         headers=as_user(outsider))
    assert denied.status_code == 403


def test_university_dashboard_and_verification(client, personas):
    uni = personas["Test Professor"]
    dash = client.get("/api/university/dashboard", headers=as_user(uni)).json()
    assert dash["kpis"]["students"] == 2
    assert dash["top_skills"] and dash["skill_gap"]
    queue = client.get("/api/university/verification-queue", headers=as_user(uni)).json()
    assert queue
    r = client.post(f"/api/university/opportunities/{queue[0]['id']}/verify", json={"approve": True}, headers=as_user(uni))
    assert r.json()["university_verified"] is True
    assert client.get("/api/university/dashboard", headers=as_user(personas["Test Student"])).status_code == 403


def test_ai_extract_endpoint(client, personas):
    r = client.post("/api/ai/extract", headers=as_user(personas["Demo Logistics SRL"]),
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


def test_single_container_serves_frontend_and_api(client):
    assert "SkillSync" in client.get("/").text
    assert "SkillSync" in client.get("/university").text  # client-side route -> index.html
    assert client.get("/assets/app.js").text == "console.log('skillsync')"
    assert client.get("/favicon.svg").text == "<svg/>"
    assert client.get("/api/does-not-exist").status_code == 404
    assert client.get("/api/health").json() == {"ok": True}
    assert client.get("/openapi.json").status_code == 200
    assert "BACKEND_DIR" not in client.get("/..%2F..%2Fbackend%2Fapp%2Fconfig.py").text  # no path traversal
