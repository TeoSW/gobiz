from conftest import as_user, new_opportunity


def _deck_ids(client, student: int) -> list[int]:
    return [c["id"] for c in client.get("/api/swipe/student/deck", headers=as_user(student)).json()]


def test_student_right_swipe_on_a_company_like_is_an_instant_match(client, personas):
    student, company = personas["Test Student"], personas["Test SRL"]
    h = as_user(student)
    deck = client.get("/api/swipe/student/deck", headers=h).json()
    assert deck and all(c["match"]["status"] != "incompatible" for c in deck)
    scores = [c["match"]["score"] for c in deck]
    assert scores == sorted(scores, reverse=True)
    pbi = next(c for c in deck if c["title"] == "Sales dashboard in Power BI")  # Test SRL liked her in the seed

    r = client.post("/api/swipe", json={"opportunity_id": pbi["id"], "liked": True}, headers=h).json()
    assert r["matched"] is True and r["match"]["company"]["id"] == company
    assert pbi["id"] not in _deck_ids(client, student)
    assert any(m["opportunity"]["id"] == pbi["id"] for m in client.get("/api/swipe/matches", headers=as_user(company)).json())
    # the match is a conversation before anyone writes, and messaging is allowed
    threads = client.get("/api/messages/threads", headers=h).json()
    assert any(t["opportunity"]["id"] == pbi["id"] and t.get("new_match") for t in threads)
    sent = client.post("/api/messages", json={"opportunity_id": pbi["id"], "recipient_id": company, "body": "Hi!"}, headers=h)
    assert sent.status_code == 201
    # a match is final
    assert client.post("/api/swipe", json={"opportunity_id": pbi["id"], "liked": False}, headers=h).status_code == 409
    assert client.post("/api/swipe/undo", json={"opportunity_id": pbi["id"]}, headers=h).status_code == 409


def test_company_right_swipe_on_an_applicant_is_a_match(client, personas):
    company, maria = personas["Test SRL"], personas["Maria Ionescu"]
    h = as_user(company)
    deck = client.get("/api/swipe/company/deck", headers=h).json()
    card = next(c for c in deck if c["student"]["id"] == maria and c["opportunity"]["title"] == "New design for our online shop")
    assert card["applied"] is True and card["application_message"]
    opp_id = card["opportunity"]["id"]
    assert all(c["opportunity"]["id"] == opp_id for c in client.get(f"/api/swipe/company/deck?opportunity_id={opp_id}", headers=h).json())

    r = client.post("/api/swipe", json={"opportunity_id": opp_id, "student_id": maria, "liked": True}, headers=h).json()
    assert r["matched"] is True and r["match"]["student"]["id"] == maria
    cands = client.get(f"/api/opportunities/{opp_id}/candidates", headers=h).json()
    assert [c["student"]["id"] for c in cands["matches"]] == [maria]
    assert not any(c["student"]["id"] == maria and c["opportunity"]["id"] == opp_id
                   for c in client.get("/api/swipe/company/deck", headers=h).json())


def test_one_right_swipe_waits_for_the_other_side(client, personas):
    company, student = personas["Test SRL"], personas["Test Student"]
    hc, hs = as_user(company), as_user(student)
    opp = new_opportunity(client, company)

    # the company likes first: nothing happens yet and the student cannot see the like
    r = client.post("/api/swipe", json={"opportunity_id": opp["id"], "student_id": student, "liked": True}, headers=hc)
    assert r.json() == {"matched": False}
    card = next(c for c in client.get("/api/swipe/student/deck", headers=hs).json() if c["id"] == opp["id"])
    assert card["invited"] is False

    # a left swipe hides the card, undo brings it back
    assert client.post("/api/swipe", json={"opportunity_id": opp["id"], "liked": False}, headers=hs).json() == {"matched": False}
    assert opp["id"] not in _deck_ids(client, student)
    assert client.post("/api/swipe/undo", json={"opportunity_id": opp["id"]}, headers=hs).json() == {"ok": True}
    assert opp["id"] in _deck_ids(client, student)

    # applying the classic way counts as the student's right swipe
    a = client.post(f"/api/opportunities/{opp['id']}/apply", json={"message": "Hi"}, headers=hs).json()
    assert (a["kind"], a["status"]) == ("match", "accepted")
    # and a match can be selected like an accepted application
    sel = client.post(f"/api/opportunities/{opp['id']}/select", json={"student_id": student}, headers=hc)
    assert sel.status_code == 200 and sel.json()["status"] == "in_progress"


def test_swipe_permissions(client, personas):
    opp = new_opportunity(client, personas["Test SRL"])
    maria = personas["Maria Ionescu"]
    body = {"opportunity_id": opp["id"], "student_id": maria, "liked": True}
    assert client.post("/api/swipe", json=body, headers=as_user(personas["Demo Logistics SRL"])).status_code == 403
    assert client.post("/api/swipe", json=body, headers=as_user(personas["Test Professor"])).status_code == 403
    no_student = {"opportunity_id": opp["id"], "liked": True}
    assert client.post("/api/swipe", json=no_student, headers=as_user(personas["Test SRL"])).status_code == 404
    assert client.post("/api/swipe/undo", json={"opportunity_id": opp["id"]}, headers=as_user(maria)).status_code == 404
