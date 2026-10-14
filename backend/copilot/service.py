import asyncio
from collections import OrderedDict
from datetime import datetime, timezone
import time
from uuid import uuid4
from .demo import demo_output
from .models import ModelOutput
from .prompt import PROMPT_VERSION
from .provider import OpenRouterProvider, ProviderError
from .safety import redact, scan_risks, route, validate_evidence

ERROR_TEXT = {
    "provider_auth": "OpenRouter отклонил ключ. Проверьте серверную настройку.",
    "provider_credit": "OpenRouter сообщил о недостаточном балансе.",
    "provider_timeout": "Модель не ответила в пределах таймаута.",
    "provider_rate_limit": "Лимит провайдера исчерпан; нужна ручная обработка.",
    "provider_truncated": "Ответ модели оборван. Черновик не показан.",
    "provider_refusal": "Провайдер отказался генерировать ответ.",
    "invalid_output": "Ответ не прошёл проверку схемы.",
    "provider_error": "Запрос к провайдеру завершился ошибкой.",
    "provider_region": "Endpoint OpenAI отклонил текущий регион. Нужна ручная обработка или согласованное изменение среды запуска.",
    "provider_forbidden": "Endpoint провайдера отклонил доступ. Проверьте условия аккаунта и поддерживаемые регионы.",
    "provider_network": "Провайдер недоступен.",
    "missing_key": "Ключ OpenRouter не настроен.",
    "non_openai_model": "Разрешены только модели OpenAI.",
    "unknown_source": "Неизвестная ссылка или chunk ID.",
    "unsupported_evidence": "Доказательство не найдено в указанном источнике.",
    "missing_evidence": "Черновик не содержит проверяемых источников.",
    "missing_unknowns": "Не указаны неотвеченные части вопроса.",
    "unsafe_draft": "В черновике найден возможный запрещённый совет или решение.",
    "unvalidated_url": "Модель вставила непроверенную ссылку.",
    "oversized_draft": "Черновик превысил ограничение длины.",
}


class CopilotService:
    def __init__(self, settings, kb, provider=None):
        self.settings = settings
        self.kb = kb
        self.provider = provider or OpenRouterProvider(settings)
        self.records = OrderedDict()
        self.semaphore = asyncio.Semaphore(2)

    async def process(self, text, mode="configured", store=True):
        start = time.perf_counter()
        ticket = redact(text)
        demo = (
            mode == "demo"
            or self.settings.mode == "demo"
            or (self.settings.mode == "auto" and not self.settings.key)
        )
        flags = scan_risks(ticket)
        usage = None
        errors = []
        queue_wait_ms = 0
        provider_latency_ms = 0
        try:
            if demo:
                output = demo_output(ticket, self.kb)
            else:
                async with self.semaphore:
                    provider_start = time.perf_counter()
                    queue_wait_ms = round((provider_start - start) * 1000)
                    try:
                        output, usage = await self.provider.generate(ticket, self.kb)
                    finally:
                        provider_latency_ms = round(
                            (time.perf_counter() - provider_start) * 1000
                        )
            flags.update(output.risk_flags)
            errors = validate_evidence(output, self.kb)
        except ProviderError as e:
            errors = [e.code]
            output = self.fallback(ticket)
        except (ValueError, KeyError):
            errors = ["invalid_output"]
            output = self.fallback(ticket)
        if errors:
            output = self.fallback(ticket)
        if output.category.value == "trading_advice":
            flags.add("trading_advice")
        if output.category.value in ("verification", "aml"):
            flags.add("kyc_aml")
        queue, specialist = route(output, flags)
        sources = []
        for sid in dict.fromkeys(c.source_id for c in output.claims):
            d = self.kb.documents[sid]
            sources.append({"id": sid, "title": d["title"], "url": d["url"]})
        cost = None
        if usage:
            reported = usage.get("reported_cost_usd")
            cost = (
                reported
                if isinstance(reported, (float, int))
                else (
                    usage["input_tokens"] * self.settings.input_price
                    + usage["output_tokens"] * self.settings.output_price
                )
                / 1_000_000
            )
        result = {
            "id": str(uuid4()),
            "created_at": datetime.now(timezone.utc).isoformat(),
            "ticket": ticket,
            "output": output.model_dump(mode="json"),
            "queue": queue,
            "review_required": True,
            "specialist_review_required": specialist,
            "review": None,
            "sources": sources,
            "flags": sorted(flags),
            "checks": {
                "schema": not errors,
                "evidence_membership": not errors,
                "semantic_support": "human_review_required",
                "errors": [
                    {"code": e, "message": ERROR_TEXT.get(e, e)} for e in errors
                ],
            },
            "trace": {
                "mode": "demo" if demo else "live",
                "model": "deterministic-demo" if demo else self.settings.model,
                "kb_version": self.kb.version,
                "prompt_version": PROMPT_VERSION,
                "latency_ms": round((time.perf_counter() - start) * 1000),
                "queue_wait_ms": queue_wait_ms,
                "provider_latency_ms": provider_latency_ms,
                "usage": usage,
                "cost_usd": cost,
                "cost_basis": "reported"
                if usage and usage.get("reported_cost_usd") is not None
                else "estimate"
                if cost is not None
                else "not_available",
                "redacted": ticket != text,
            },
        }
        if store:
            self.records[result["id"]] = result
            while len(self.records) > 200:
                self.records.popitem(last=False)
        return result

    def fallback(self, text):
        ru = any("\u0400" <= c <= "\u04ff" for c in text)
        flags = scan_risks(text)
        category = (
            "complaint"
            if "complaint" in flags
            else "verification"
            if "kyc_aml" in flags
            else "trading_advice"
            if "trading_advice" in flags
            else "other"
        )
        return ModelOutput(
            category=category,
            secondary_categories=[],
            urgency="normal",
            language="ru" if ru else "en",
            sentiment="unknown",
            disposition="abstain",
            draft="Не удалось подготовить проверяемый ответ. Обращение требует проверки оператором."
            if ru
            else "A verified reply could not be prepared. This ticket requires a human review.",
            claims=[],
            unknowns=[
                "Ответ не подтверждён доступными данными."
                if ru
                else "The reply is not verified against available information."
            ],
            risk_flags=sorted(flags),
            rationale="Безопасная передача человеку вместо непроверенного ответа.",
        )
