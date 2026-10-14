from pathlib import Path
import json
import time
from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from .config import Settings, ROOT
from .kb import KnowledgeBase
from .models import TicketRequest, ReviewRequest
from .service import CopilotService
from .evaluation import evaluate, cases
from .safety import unsafe_draft

settings = Settings.from_env()
kb = KnowledgeBase()
service = CopilotService(settings, kb)
app = FastAPI(title="Valetax Support Studio", version="0.1.0")
app.add_middleware(
    TrustedHostMiddleware, allowed_hosts=["localhost", "127.0.0.1", "testserver"]
)
eval_busy = False
last_eval = 0


@app.get("/api/health")
def health():
    return {
        "status": "ok",
        "mode": "live" if settings.live else "demo",
        "model": settings.model,
        "provider": "OpenRouter → OpenAI",
        "key_configured": bool(settings.key),
        "kb_version": kb.version,
        "sources": len(kb.documents),
        "review_policy": "all_drafts",
        "storage": "memory_only",
        "input_price": settings.input_price,
        "output_price": settings.output_price,
    }


@app.get("/api/kb")
def knowledge():
    return {**kb.manifest(), "documents": list(kb.documents.values())}


@app.post("/api/tickets")
async def process_ticket(ticket: TicketRequest):
    if not ticket.text.strip():
        raise HTTPException(422, "Введите текст обращения.")
    return await service.process(ticket.text, ticket.mode)


@app.get("/api/tickets")
def history():
    return list(reversed(list(service.records.values())))[:30]


@app.post("/api/tickets/{ticket_id}/review")
def review(ticket_id: str, request: ReviewRequest):
    r = service.records.get(ticket_id)
    if not r:
        raise HTTPException(404, "Черновик не найден в текущем запуске сервера.")
    if r["review"] is not None:
        raise HTTPException(
            409,
            "Решение уже сохранено. Создайте новый черновик для повторной проверки.",
        )
    if request.action in ("accept", "edit") and r["specialist_review_required"]:
        raise HTTPException(
            409, "Нужен профильный reviewer. Передайте обращение специалисту."
        )
    if request.action in ("accept", "edit") and r["checks"]["errors"]:
        raise HTTPException(
            409, "Непроверенный черновик нельзя одобрить; передайте оператору."
        )
    if request.action == "edit" and not request.edited_draft.strip():
        raise HTTPException(422, "Введите отредактированный ответ.")
    if request.action == "edit" and unsafe_draft(request.edited_draft):
        raise HTTPException(
            409, "В изменённом ответе найден возможный запрещённый совет или решение."
        )
    r["review"] = {
        "action": request.action,
        "note": request.note,
        "edited_draft": request.edited_draft if request.action == "edit" else None,
        "saved_at": time.time(),
        "delivery": "not_sent",
    }
    return r


@app.get("/api/evaluations")
def reports():
    files = [
        ROOT / "reports/eval_live.json",
        ROOT / "reports/eval_live_baseline.json",
        ROOT / "reports/eval_demo.json",
    ]
    return {
        "reports": [json.loads(p.read_text()) for p in files if p.exists()],
        "cases": cases(),
    }


@app.post("/api/evaluations/smoke")
async def smoke():
    global eval_busy, last_eval
    if eval_busy:
        raise HTTPException(409, "Проверка уже идёт.")
    if time.monotonic() - last_eval < 30:
        raise HTTPException(429, "Подождите 30 секунд перед повторным прогоном.")
    eval_busy = True
    try:
        report = await evaluate(service, subset="smoke", mode="configured")
        path = ROOT / f"reports/eval_{report['mode']}.json"
        path.parent.mkdir(exist_ok=True)
        path.write_text(json.dumps(report, ensure_ascii=False, indent=2))
        last_eval = time.monotonic()
        return report
    finally:
        eval_busy = False


DOCS = {
    "plan": "03_solution_and_evaluation.md",
    "practices": "06_telegram_practices_review.md",
    "economy": "04_business_case.md",
}


@app.get("/api/documents/{name}")
def document(name: str):
    if name not in DOCS:
        raise HTTPException(404)
    return {"text": (ROOT / "research" / DOCS[name]).read_text()}


dist = ROOT / "frontend/dist"
if dist.exists():
    app.mount("/assets", StaticFiles(directory=dist / "assets"), name="assets")

    @app.get("/favicon.svg")
    def favicon():
        return FileResponse(dist / "favicon.svg")

    @app.get("/")
    def index():
        return FileResponse(dist / "index.html")
