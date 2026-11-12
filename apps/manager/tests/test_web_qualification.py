"""The customer chat stays independent from submissions, operator tools and OpenAI."""
from fastapi.testclient import TestClient

from flemme_manager.main import app
from flemme_manager.routes import qualification
from flemme_manager.settings import settings


def test_customer_conversation_boundary(tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "qualification_database_path", str(tmp_path / "conversations.db"))
    monkeypatch.setattr(settings, "qualification_service_key", "test-proxy-key")
    calls = []

    async def analyze(history, previous):
        calls.append((history, previous))
        return qualification.QualificationAssessment.model_validate({
            "service_category": "other",
            "expected_result": {"description": "Une terrasse nettoyée."},
            "selected_workflow": {"workflow_id": None, "reason": "Hors catalogue."},
            "missing_information": [], "qualification_questions": [],
            "mission_status": "out_of_catalog", "human_intervention_required": False,
            "user_response": {"message": "Tu peux reprendre la description dans le formulaire."},
            "facts": {"scope": "Nettoyer une terrasse."},
        })

    monkeypatch.setattr(qualification.agent, "analyze_conversation", analyze)
    with TestClient(app) as client:
        root = "/api/qualification/conversations"
        headers = {"X-Flemme-Service-Key": "test-proxy-key"}
        task = {"task": "Nettoyer une terrasse.", "consent": True}
        assert client.post(root, json=task).status_code == 401
        assert client.post(root, headers=headers, json={**task, "consent": False}).status_code == 422
        response = client.post(root, headers=headers, json=task)
        assert response.status_code == 201
        started = response.json()
        path = f"{root}/{started['id']}"
        assert client.get(path, headers=headers).status_code == 404
        auth = {**headers, "Authorization": f"Bearer {started['token']}"}
        message = {"message": task["task"], "version": 0, "request_id": "test-request"}
        response = client.post(path + "/messages", headers=auth, json=message)
        assert response.status_code == 200
        summary = response.json()["summary"]
        assert summary["human_required"] and not summary["external_actions_authorized"]
        assert len(calls[0][0]) == 1
        retry = client.post(path + "/messages", headers=auth, json=message)
        assert retry.json() == response.json() and len(calls) == 1
        assert client.post(path + "/confirm", headers=auth, json={}).status_code == 404
        assert client.delete(path, headers=auth).status_code == 204
        assert client.get(path, headers=auth).status_code == 404
