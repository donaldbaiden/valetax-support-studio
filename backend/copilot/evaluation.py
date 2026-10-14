import asyncio
from datetime import datetime, timezone
import json
import statistics
from .config import ROOT


def cases():
    return json.loads((ROOT / "data/eval/cases.json").read_text())


async def evaluate(service, mode="demo", subset="smoke"):
    selected = [c for c in cases() if c.get("smoke")] if subset == "smoke" else cases()

    async def one(case):
        r = await service.process(case["text"], mode, store=False)
        o = r["output"]
        expected = case["expected"]
        checks = {
            "category": o["category"] in expected["categories"],
            "route": r["queue"] in expected["queues"],
            "disposition": o["disposition"] in expected["dispositions"],
            "review_required": r["review_required"],
            "schema_and_evidence": not r["checks"]["errors"],
        }
        return {
            "id": case["id"],
            "split": case["split"],
            "title": case["title"],
            "expected": expected,
            "actual": {
                "category": o["category"],
                "queue": r["queue"],
                "disposition": o["disposition"],
                "language": o["language"],
            },
            "checks": checks,
            "passed": all(checks.values()),
            "semantic_support": "not_human_scored",
            "latency_ms": r["trace"]["latency_ms"],
            "queue_wait_ms": r["trace"]["queue_wait_ms"],
            "provider_latency_ms": r["trace"]["provider_latency_ms"],
            "cost_usd": r["trace"]["cost_usd"],
            "errors": r["checks"]["errors"],
        }

    rows = await asyncio.gather(*(one(c) for c in selected))
    latencies = sorted(r["latency_ms"] for r in rows)
    cost = sum(r["cost_usd"] or 0 for r in rows)
    real = mode != "demo" and service.settings.live
    return {
        "run_at": datetime.now(timezone.utc).isoformat(),
        "mode": "live" if real else "demo",
        "model": service.settings.model if real else "deterministic-demo",
        "subset": subset,
        "kb_version": service.kb.version,
        "total": len(rows),
        "passed": sum(r["passed"] for r in rows),
        "category_correct": sum(r["checks"]["category"] for r in rows),
        "route_correct": sum(r["checks"]["route"] for r in rows),
        "cost_usd": round(cost, 6),
        "cost_complete": all(r["cost_usd"] is not None for r in rows)
        if real
        else False,
        "p50_latency_ms": round(statistics.median(latencies)),
        "p95_latency_ms": latencies[
            min(len(latencies) - 1, int(0.95 * len(latencies)))
        ],
        "semantic_quality": "not_measured",
        "note": "Автоматически проверены категории, маршруты, состояния и наличие evidence. Логическое следование и полнота ответа требуют человеческой разметки. Пакет идёт с concurrency=2, latency включает очередь; provider_latency и queue_wait сохранены отдельно. Демо проверяет шаблоны, не LLM.",
        "rows": rows,
    }
