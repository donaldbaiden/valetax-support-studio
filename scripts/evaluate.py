"""Explicitly paid live eval; no secrets or raw real-client data in reports."""

import argparse, asyncio, json, sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend"))
from copilot.config import Settings, ROOT
from copilot.kb import KnowledgeBase
from copilot.service import CopilotService
from copilot.evaluation import evaluate, save_report


async def main():
    p = argparse.ArgumentParser()
    p.add_argument("--mode", choices=["demo", "live"], default="demo")
    p.add_argument("--subset", choices=["smoke", "dev", "all"], default="all")
    p.add_argument("--repeats", type=int, choices=range(1, 6), default=1)
    a = p.parse_args()
    settings = Settings.from_env()
    if a.mode == "live" and not settings.key:
        p.error("Live eval requires OPENROUTER_API_KEY.")
    result = await evaluate(
        CopilotService(settings, KnowledgeBase()),
        "demo" if a.mode == "demo" else "configured",
        a.subset,
        repeats=a.repeats,
    )
    save_report(result)
    print(
        json.dumps(
            {k: v for k, v in result.items() if k != "rows"},
            ensure_ascii=False,
            indent=2,
        )
    )


if __name__ == "__main__":
    asyncio.run(main())
