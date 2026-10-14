import json
import httpx
import pytest
from copilot.config import Settings
from copilot.kb import KnowledgeBase
from copilot.provider import OpenRouterProvider, ProviderError
from test_pipeline import valid_output


def mock_client(monkeypatch, handler):
    from copilot import provider

    original = httpx.AsyncClient
    monkeypatch.setattr(
        provider.httpx,
        "AsyncClient",
        lambda **kwargs: original(transport=httpx.MockTransport(handler), **kwargs),
    )


@pytest.mark.asyncio
async def test_openrouter_request_uses_native_schema_and_only_openai(monkeypatch):
    kb = KnowledgeBase()
    o = valid_output(kb)

    def handler(request):
        data = json.loads(request.content)
        assert data["model"] == "openai/gpt-6.1-sol"
        assert data["provider"]["only"] == ["OpenAI"]
        assert data["provider"]["allow_fallbacks"] is False
        assert data["response_format"]["json_schema"]["strict"] is True
        assert "key" not in data["messages"][1]["content"]
        return httpx.Response(
            200,
            json={
                "choices": [
                    {
                        "finish_reason": "stop",
                        "message": {"content": o.model_dump_json()},
                    }
                ],
                "usage": {"prompt_tokens": 12, "completion_tokens": 3, "cost": 0.01},
            },
        )

    mock_client(monkeypatch, handler)
    result, usage = await OpenRouterProvider(Settings(key="unit")).generate(
        "How do I deposit?", kb
    )
    assert result.category.value == "deposit"
    assert usage["reported_cost_usd"] == 0.01


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "response,code",
    [
        (
            {
                "choices": [
                    {"finish_reason": "length", "message": {"content": '{"draft":'}}
                ]
            },
            "provider_truncated",
        ),
        (
            {"choices": [{"finish_reason": "stop", "message": {"refusal": "No"}}]},
            "provider_refusal",
        ),
        (
            {
                "choices": [
                    {"finish_reason": "stop", "message": {"content": "not json"}}
                ]
            },
            "invalid_output",
        ),
    ],
)
async def test_response_edge_cases(monkeypatch, response, code):
    mock_client(monkeypatch, lambda r: httpx.Response(200, json=response))
    with pytest.raises(ProviderError, match=code):
        await OpenRouterProvider(Settings(key="unit")).generate(
            "Ticket", KnowledgeBase()
        )


@pytest.mark.asyncio
async def test_region_failure_has_specific_safe_error(monkeypatch):
    mock_client(
        monkeypatch,
        lambda r: httpx.Response(
            403,
            json={
                "error": {
                    "metadata": {
                        "provider_error_code": "unsupported_country_region_territory"
                    }
                }
            },
        ),
    )
    with pytest.raises(ProviderError, match="provider_region"):
        await OpenRouterProvider(Settings(key="unit")).generate(
            "Ticket", KnowledgeBase()
        )
