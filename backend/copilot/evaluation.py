import asyncio
from datetime import datetime, timezone
import json
import statistics
import hashlib
from pathlib import Path
from uuid import uuid4
from .config import ROOT
from .models import strict_schema
from .prompt import PROMPT_VERSION, SYSTEM_PROMPT


def digest(value):
    return hashlib.sha256(
        json.dumps(value, sort_keys=True, ensure_ascii=False).encode()
    ).hexdigest()


def cases():
    return json.loads((ROOT / "data/eval/cases.json").read_text())


def save_report(report):
    archive = ROOT / "reports/runs" / f"{report['run_id']}.json"
    archive.parent.mkdir(parents=True, exist_ok=True)
    content = json.dumps(report, ensure_ascii=False, indent=2)
    with archive.open("x") as file:
        file.write(content)
    latest = ROOT / f"reports/eval_{report['mode']}.json"
    temporary = latest.with_suffix(f".{report['run_id']}.tmp")
    temporary.write_text(content)
    temporary.replace(latest)
    return archive


async def evaluate(service, mode="demo", subset="smoke", repeats=1):
    if subset not in ("smoke", "dev", "all") or not 1 <= repeats <= 5:
        raise ValueError("Unsupported evaluation selection")
    dataset = cases()
    selected = [
        c for c in dataset
        if subset == "all"
        or (subset == "smoke" and c.get("smoke"))
        or (subset == "dev" and c["split"] == "dev")
    ]
    if not selected:
        raise ValueError("No evaluation cases selected")

    async def one(case, trial):
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
        for field, expected_key in (
            ("language", "languages"),
            ("urgency", "urgencies"),
            ("sentiment", "sentiments"),
        ):
            if expected_key in expected:
                checks[field] = o[field] in expected[expected_key]
        return {
            "id": case["id"],
            "split": case["split"],
            "title": case["title"],
            "trial": trial,
            "ticket": case["text"],
            "expected": expected,
            "actual": {
                "category": o["category"],
                "queue": r["queue"],
                "disposition": o["disposition"],
                "language": o["language"],
                "urgency": o["urgency"],
                "sentiment": o["sentiment"],
            },
            "output": o,
            "sources": r["sources"],
            "flags": r["flags"],
            "trace": r["trace"],
            "checks": checks,
            "passed": all(checks.values()),
            "semantic_support": "not_human_scored",
            "latency_ms": r["trace"]["latency_ms"],
            "queue_wait_ms": r["trace"]["queue_wait_ms"],
            "provider_latency_ms": r["trace"]["provider_latency_ms"],
            "cost_usd": r["trace"]["cost_usd"],
            "cost_basis": r["trace"]["cost_basis"],
            "cost_complete": r["trace"]["cost_complete"],
            "errors": r["checks"]["errors"],
        }

    rows = await asyncio.gather(*(
        one(c, trial) for c in selected for trial in range(1, repeats + 1)
    ))
    latencies = sorted(r["latency_ms"] for r in rows)
    cost = sum(r["cost_usd"] or 0 for r in rows)
    real = mode != "demo" and service.settings.live
    classification = {
        field: {
            "correct": sum(r["checks"].get(field) is True for r in rows),
            "total": sum(field in r["checks"] for r in rows),
        }
        for field in ("language", "urgency", "sentiment")
    }
    return {
        "run_id": str(uuid4()),
        "eval_version": "technical-v3-audiences",
        "run_at": datetime.now(timezone.utc).isoformat(),
        "mode": "live" if real else "demo",
        "model": service.settings.model if real else "deterministic-demo",
        "subset": subset,
        "repeats": repeats,
        "unique_cases": len(selected),
        "consistent_cases": sum(
            all(r["passed"] for r in rows if r["id"] == c["id"])
            for c in selected
        ),
        "classification_checks": classification,
        "manifest": {
            "dataset_sha256": digest(dataset),
            "selected_case_ids": [c["id"] for c in selected],
            "dataset_status": "development_only_initial_holdout_consumed",
            "prompt_version": PROMPT_VERSION,
            "prompt_sha256": digest(SYSTEM_PROMPT),
            "schema_sha256": digest(strict_schema()),
            "safety_sha256": hashlib.sha256(
                (Path(__file__).parent / "safety.py").read_bytes()
            ).hexdigest(),
            "provider_adapter_sha256": hashlib.sha256(
                (Path(__file__).parent / "provider.py").read_bytes()
            ).hexdigest(),
            "code_sha256": {
                name: hashlib.sha256((Path(__file__).parent / name).read_bytes()).hexdigest()
                for name in ("evaluation.py", "service.py", "demo.py", "kb.py")
            },
            "kb_sha256": digest(service.kb.context()),
            "max_output_tokens": service.settings.max_tokens,
            "provider_timeout_seconds": service.settings.timeout,
            "input_price_per_million": service.settings.input_price,
            "output_price_per_million": service.settings.output_price,
        },
        "kb_version": service.kb.version,
        "total": len(rows),
        "passed": sum(r["passed"] for r in rows),
        "category_correct": sum(r["checks"]["category"] for r in rows),
        "route_correct": sum(r["checks"]["route"] for r in rows),
        "cost_usd": round(cost, 6),
        "cost_complete": all(r["cost_complete"] for r in rows)
        if real
        else False,
        "p50_latency_ms": round(statistics.median(latencies)),
        "p95_latency_ms": latencies[
            min(len(latencies) - 1, int(0.95 * len(latencies)))
        ],
        "semantic_quality": "not_measured",
        "note": "Технические проверки: категория, маршрут, тип ответа, review, наличие evidence; язык, срочность и тональность только в случаях с соответствующей разметкой. Смысл и полнота требуют эксперта. Повторы показывают стабильность технических проверок, не семантическую надёжность. Пакет concurrency=2: latency включает очередь, provider_latency сохранена отдельно. Расход — известная часть, оценка по тарифу помечена отдельно, стоимость ранних повторов может быть неизвестна. Демо проверяет шаблоны, не LLM.",
        "rows": rows,
    }
