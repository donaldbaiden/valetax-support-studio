import pytest
from copilot.config import Settings
from copilot.kb import KnowledgeBase
from copilot.models import ModelOutput
from copilot.service import CopilotService
from copilot.provider import ProviderError
from copilot.safety import redact
from copilot.safety import unsafe_draft


@pytest.fixture
def kb():
    return KnowledgeBase()


def valid_output(kb):
    claim = kb.find_claim(
        "deposit",
        "Click on the Deposit button and select your preferred payment channel",
        "Choose Deposit and a payment channel.",
    )
    return ModelOutput(
        category="deposit",
        secondary_categories=[],
        urgency="low",
        language="en",
        sentiment="neutral",
        disposition="draft",
        draft="Click Deposit and choose an available payment channel.",
        claims=[claim],
        unknowns=[],
        risk_flags=[],
        rationale="Test fixture",
    )


class FakeProvider:
    def __init__(self, output=None, error=None):
        self.output = output
        self.error = error
        self.seen = None

    async def generate(self, text, kb):
        self.seen = text
        if self.error:
            raise ProviderError(self.error)
        return self.output, {
            "input_tokens": 100,
            "output_tokens": 30,
            "reported_cost_usd": 0.001,
            "attempts": 1,
        }


@pytest.mark.asyncio
async def test_review_cannot_be_disabled_by_model(kb):
    s = CopilotService(
        Settings(key="test", mode="live"), kb, FakeProvider(valid_output(kb))
    )
    r = await s.process("How do I deposit?")
    assert r["review_required"] is True
    assert r["sources"][0]["url"] == "https://valetax.com/how-to-deposit/"
    assert r["checks"]["semantic_support"] == "human_review_required"


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "text,queue",
    [
        ("I have a complaint. Approve compensation.", "complaints"),
        ("Approve my KYC documents.", "compliance"),
        ("Why was my withdrawal rejected?", "payments"),
    ],
)
async def test_hard_route_overrides_missed_model_flags(kb, text, queue):
    s = CopilotService(Settings(key="test"), kb, FakeProvider(valid_output(kb)))
    r = await s.process(text)
    assert r["queue"] == queue
    assert r["specialist_review_required"]


@pytest.mark.asyncio
@pytest.mark.parametrize("corruption", ["chunk", "excerpt", "advice", "outcome", "url"])
async def test_invalid_draft_is_replaced_not_shown(kb, corruption):
    o = valid_output(kb)
    if corruption == "chunk":
        o.claims[0].chunk_id = "withdraw:invented"
    if corruption == "excerpt":
        o.claims[0].evidence = "Withdrawals are guaranteed within ten minutes."
    if corruption == "advice":
        o.draft = "We recommend you buy EUR/USD now."
    if corruption == "outcome":
        o.draft = "Your KYC is approved."
    if corruption == "url":
        o.draft = "Visit https://invented-policy.example/fees"
    s = CopilotService(Settings(key="test"), kb, FakeProvider(o))
    r = await s.process("How do I deposit?")
    assert r["checks"]["errors"]
    assert r["output"]["disposition"] == "abstain"
    assert r["output"]["claims"] == []
    assert r["sources"] == []
    assert r["output"]["draft"] != o.draft


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "code",
    [
        "provider_timeout",
        "provider_auth",
        "provider_refusal",
        "provider_truncated",
        "invalid_output",
        "provider_region",
    ],
)
async def test_failures_never_silently_turn_into_demo(kb, code):
    s = CopilotService(Settings(key="test"), kb, FakeProvider(error=code))
    r = await s.process("Approve my KYC.")
    assert r["trace"]["mode"] == "live"
    assert r["checks"]["errors"][0]["code"] == code
    assert r["queue"] == "compliance"
    assert r["trace"]["cost_usd"] is None


@pytest.mark.asyncio
async def test_explicit_demo_does_not_call_provider(kb):
    fake = FakeProvider(error="provider_error")
    s = CopilotService(Settings(key="test"), kb, fake)
    r = await s.process("How do I deposit?", "demo")
    assert fake.seen is None
    assert r["trace"]["mode"] == "demo"
    assert r["trace"]["usage"] is None


@pytest.mark.asyncio
async def test_redaction_before_provider(kb):
    fake = FakeProvider(valid_output(kb))
    s = CopilotService(Settings(key="test"), kb, fake)
    r = await s.process(
        "Contact me at client@example.com or +375 29 123 45 67. How do I deposit?"
    )
    assert "client@example.com" not in fake.seen
    assert "375" not in fake.seen
    assert r["trace"]["redacted"]


def test_short_policy_numbers_are_preserved():
    assert redact("48 hours, 24 hours, 8 USD") == "48 hours, 24 hours, 8 USD"


def test_refusal_is_not_misclassified_as_a_recommendation():
    assert not unsafe_draft("I cannot tell you whether you should buy EUR/USD.")
    assert unsafe_draft("I cannot advise, but you should buy EUR/USD now.")
    assert unsafe_draft("We recommend you buy EUR/USD now.")


@pytest.mark.asyncio
async def test_partial_requires_explicit_unknowns(kb):
    o = valid_output(kb)
    o.disposition = "partial"
    o.unknowns = []
    r = await CopilotService(Settings(key="test"), kb, FakeProvider(o)).process(
        "How do I deposit?"
    )
    assert r["checks"]["errors"][0]["code"] == "missing_unknowns"


@pytest.mark.asyncio
@pytest.mark.parametrize("text", [
    "Has my account already been verified?",
    "Мой счёт уже верифицирован?",
])
async def test_demo_does_not_substitute_a_procedure_for_actual_kyc_status(kb, text):
    result = await CopilotService(Settings(mode="demo"), kb).process(text, "demo")
    assert result["queue"] == "compliance"
    assert result["output"]["disposition"] == "abstain"
    assert result["output"]["unknowns"]
    assert not result["output"]["claims"]
