import asyncio
import json
import httpx
from .models import ModelOutput, strict_schema
from .prompt import SYSTEM_PROMPT


class ProviderError(Exception):
    def __init__(self, code):
        self.code = code
        super().__init__(code)


class OpenRouterProvider:
    def __init__(self, settings):
        self.settings = settings

    async def generate(self, text, kb):
        if not self.settings.key:
            raise ProviderError("missing_key")
        if not self.settings.model.startswith("openai/"):
            raise ProviderError("non_openai_model")
        payload = {
            "model": self.settings.model,
            "messages": [
                {"role": "system", "content": SYSTEM_PROMPT},
                {
                    "role": "user",
                    "content": json.dumps(
                        {"knowledge_base": kb.context(), "untrusted_ticket": text},
                        ensure_ascii=False,
                    ),
                },
            ],
            "response_format": {
                "type": "json_schema",
                "json_schema": {
                    "name": "support_ticket",
                    "strict": True,
                    "schema": strict_schema(),
                },
            },
            "provider": {
                "only": ["OpenAI"],
                "allow_fallbacks": False,
                "require_parameters": True,
                "data_collection": "deny",
            },
            "max_tokens": self.settings.max_tokens,
            "stream": False,
            "reasoning": {"effort": "low", "exclude": True},
        }
        headers = {
            "Authorization": f"Bearer {self.settings.key}",
            "Content-Type": "application/json",
            "X-Title": "Valetax Support Studio",
        }
        async with httpx.AsyncClient(timeout=self.settings.timeout) as client:
            for attempt in range(2):
                try:
                    r = await client.post(
                        "https://openrouter.ai/api/v1/chat/completions",
                        headers=headers,
                        json=payload,
                    )
                except httpx.TimeoutException:
                    raise ProviderError("provider_timeout") from None
                except httpx.RequestError:
                    raise ProviderError("provider_network") from None
                if r.status_code in (429, 502, 503) and attempt == 0:
                    await asyncio.sleep(0.4)
                    continue
                if r.status_code != 200:
                    code = {
                        401: "provider_auth",
                        402: "provider_credit",
                        403: "provider_forbidden",
                        429: "provider_rate_limit",
                    }.get(r.status_code, "provider_error")
                    try:
                        provider_code = (
                            r.json()
                            .get("error", {})
                            .get("metadata", {})
                            .get("provider_error_code")
                        )
                        if provider_code == "unsupported_country_region_territory":
                            code = "provider_region"
                    except (ValueError, AttributeError):
                        pass
                    raise ProviderError(code)
                break
        try:
            data = r.json()
            if data.get("error"):
                raise ProviderError("provider_error")
            choice = data["choices"][0]
            message = choice["message"]
            if message.get("refusal"):
                raise ProviderError("provider_refusal")
            if choice.get("finish_reason") != "stop":
                raise ProviderError("provider_truncated")
            content = message.get("content")
            if not isinstance(content, str):
                raise ProviderError("provider_empty")
            output = ModelOutput.model_validate_json(content)
            usage = data.get("usage", {})
            return output, {
                "input_tokens": usage.get("prompt_tokens", 0),
                "output_tokens": usage.get("completion_tokens", 0),
                "reported_cost_usd": usage.get("cost"),
                "provider_request_id": data.get("id"),
                "attempts": attempt + 1,
            }
        except ProviderError:
            raise
        except (KeyError, ValueError, TypeError, IndexError):
            raise ProviderError("invalid_output") from None
