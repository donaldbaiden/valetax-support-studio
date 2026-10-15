import pytest
from copilot import evaluation
from copilot.config import Settings
from copilot.kb import KnowledgeBase
from copilot.service import CopilotService
from test_pipeline import FakeProvider, valid_output
import json


def sample_case(**expected):
    return {
        "id": "E-test",
        "title": "Classification regression",
        "text": "How do I deposit?",
        "split": "dev",
        "smoke": True,
        "expected": {
            "categories": ["deposit"],
            "queues": ["support"],
            "dispositions": ["draft"],
            **expected,
        },
    }


@pytest.mark.asyncio
async def test_eval_checks_classification_and_keeps_reviewable_output(monkeypatch):
    kb = KnowledgeBase()
    monkeypatch.setattr(evaluation, "cases", lambda: [sample_case(
        languages=["id"], urgencies=["high"], sentiments=["negative"]
    )])
    service = CopilotService(Settings(key="unit"), kb, FakeProvider(valid_output(kb)))
    report = await evaluation.evaluate(service, "configured")
    row = report["rows"][0]
    assert not row["passed"]
    assert all(not row["checks"][k] for k in ("language", "urgency", "sentiment"))
    assert row["output"]["draft"] == valid_output(kb).draft
    assert row["sources"][0]["id"] == "deposit"
    assert report["manifest"]["prompt_version"]
    assert len(report["manifest"]["dataset_sha256"]) == 64
    assert "key" not in str(report["manifest"])
    assert report["semantic_quality"] == "not_measured"
    assert not service.records


@pytest.mark.asyncio
async def test_one_lucky_trial_cannot_hide_a_failure(monkeypatch):
    kb = KnowledgeBase()
    monkeypatch.setattr(evaluation, "cases", lambda: [sample_case(languages=["en"])])

    class AlternatingProvider:
        def __init__(self):
            self.calls = 0

        async def generate(self, text, knowledge):
            self.calls += 1
            output = valid_output(knowledge)
            output.language = "en" if self.calls != 2 else "id"
            return output, {"input_tokens": 10, "output_tokens": 5, "attempts": 1}

    service = CopilotService(Settings(key="unit"), kb, AlternatingProvider())
    report = await evaluation.evaluate(service, "configured", repeats=3)
    assert report["unique_cases"] == 1
    assert report["total"] == 3
    assert report["passed"] == 2
    assert report["consistent_cases"] == 0
    assert report["classification_checks"]["language"] == {"correct": 2, "total": 3}


@pytest.mark.asyncio
async def test_unknown_usage_and_earlier_attempt_costs_stay_unknown(monkeypatch):
    kb = KnowledgeBase()
    monkeypatch.setattr(evaluation, "cases", lambda: [sample_case()])

    class MissingUsageProvider:
        async def generate(self, text, knowledge):
            return valid_output(knowledge), {"attempts": 1}

    service = CopilotService(Settings(key="unit"), kb, MissingUsageProvider())
    report = await evaluation.evaluate(service, "configured")
    assert report["rows"][0]["cost_usd"] is None
    assert report["rows"][0]["cost_basis"] == "not_available"
    assert report["cost_complete"] is False

    class RetriedProvider:
        async def generate(self, text, knowledge):
            return valid_output(knowledge), {"reported_cost_usd": 0.01, "attempts": 2}

    report = await evaluation.evaluate(
        CopilotService(Settings(key="unit"), kb, RetriedProvider()), "configured"
    )
    assert report["cost_usd"] == 0.01
    assert report["cost_complete"] is False


@pytest.mark.asyncio
@pytest.mark.parametrize("reported", [-1, float("nan"), True])
async def test_invalid_cost_is_not_reported_as_a_known_charge(reported):
    kb = KnowledgeBase()

    class Provider:
        async def generate(self, text, knowledge):
            return valid_output(knowledge), {"reported_cost_usd": reported}

    result = await CopilotService(Settings(key="unit"), kb, Provider()).process("How do I deposit?")
    assert result["trace"]["cost_usd"] is None
    assert result["trace"]["cost_basis"] == "not_available"


def test_saved_run_is_not_overwritten_by_the_next_run(monkeypatch, tmp_path):
    monkeypatch.setattr(evaluation, "ROOT", tmp_path)
    first = {"run_id": "first", "mode": "demo", "passed": 1}
    second = {"run_id": "second", "mode": "demo", "passed": 0}
    evaluation.save_report(first)
    evaluation.save_report(second)
    assert json.loads((tmp_path / "reports/runs/first.json").read_text()) == first
    assert json.loads((tmp_path / "reports/eval_demo.json").read_text()) == second
    with pytest.raises(FileExistsError):
        evaluation.save_report(first)
