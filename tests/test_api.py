import pytest
from fastapi.testclient import TestClient
from copilot.config import Settings
from copilot.kb import KnowledgeBase
from copilot.service import CopilotService
from copilot import main


@pytest.fixture
def client(monkeypatch):
    settings = Settings(mode="demo")
    monkeypatch.setattr(main, "settings", settings)
    monkeypatch.setattr(main, "service", CopilotService(settings, KnowledgeBase()))
    return TestClient(main.app)


def test_health_never_returns_key(client):
    r = client.get("/api/health")
    assert r.status_code == 200
    assert "OPENROUTER_API_KEY" not in r.text
    assert "key" not in r.json()
    assert r.json()["key_configured"] is False


def test_specialist_cannot_be_approved_by_support(client):
    r = client.post("/api/tickets", json={"text": "Approve my KYC documents."}).json()
    assert (
        client.post(
            f"/api/tickets/{r['id']}/review", json={"action": "accept"}
        ).status_code
        == 409
    )
    response = client.post(
        f"/api/tickets/{r['id']}/review", json={"action": "escalate"}
    )
    assert response.status_code == 200
    assert response.json()["review"]["delivery"] == "not_sent"


def test_review_is_single_decision(client):
    r = client.post("/api/tickets", json={"text": "How do I deposit?"}).json()
    assert (
        client.post(
            f"/api/tickets/{r['id']}/review", json={"action": "accept"}
        ).status_code
        == 200
    )
    assert (
        client.post(
            f"/api/tickets/{r['id']}/review", json={"action": "reject"}
        ).status_code
        == 409
    )


def test_unknown_document_and_large_ticket_are_rejected(client):
    assert client.get("/api/documents/secrets").status_code == 404
    assert client.post("/api/tickets", json={"text": "x" * 6001}).status_code == 422
    assert client.post("/api/tickets", json={"text": "   "}).status_code == 422


def test_untrusted_host_is_rejected(client):
    assert (
        client.get("/api/health", headers={"host": "untrusted.example"}).status_code
        == 400
    )


@pytest.mark.parametrize("action", ["accept", "edit"])
@pytest.mark.parametrize("text", [
    "What are USDT withdrawal fees?",
    "How do I deposit and what are USDT withdrawal fees?",
])
def test_missing_information_cannot_be_approved_as_a_complete_reply(client, action, text):
    ticket = client.post("/api/tickets", json={"text": text}).json()
    assert not ticket["specialist_review_required"]
    response = client.post(f"/api/tickets/{ticket['id']}/review", json={
        "action": action, "edited_draft": "A response typed without resolving the gap."
    })
    assert response.status_code == 409
    assert client.post(f"/api/tickets/{ticket['id']}/review", json={"action": "escalate"}).status_code == 200
