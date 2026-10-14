"""Fetch only the four assignment URLs; retain original wording and defects."""

from pathlib import Path
from datetime import datetime, timezone
import hashlib
import json
import httpx
from bs4 import BeautifulSoup

ROOT = Path(__file__).resolve().parents[1]
SOURCES = {
    "deposit": ("How to Deposit", "how-to-deposit"),
    "withdraw": ("How to Withdraw", "how-to-withdraw"),
    "open_account": ("How to Open an Account", "how-to-open-an-account"),
    "verify": ("How to Verify Account", "how-to-verify-account"),
}
ISSUES = {
    "deposit": [
        {
            "code": "ambiguous_timing",
            "title": "«Мгновенно» и до 60 минут",
            "description": "Не превращать маркетинговую формулировку в гарантию конкретной операции.",
        }
    ],
    "withdraw": [
        {
            "code": "withdraw_steps",
            "title": "В инструкции вывода — шаги пополнения",
            "description": "Шаг 3 содержит deposit, шаг 4 — Start Trading. Не исправляем исходную политику самостоятельно.",
        },
        {
            "code": "withdraw_timing",
            "title": "24 часа — порог обращения",
            "description": "Это инструкция связаться с поддержкой, а не гарантированный срок вывода.",
        },
    ],
    "open_account": [
        {
            "code": "advice_in_kb",
            "title": "В KB есть вопрос о leverage",
            "description": "Правила задания запрещают рекомендации по плечу даже при наличии такого FAQ.",
        },
        {
            "code": "step_count",
            "title": "Заявлены 3 шага, перечислены 4",
            "description": "Исходное несоответствие сохраняется.",
        },
    ],
    "verify": [
        {
            "code": "cross_page",
            "title": "Документы и сроки — на другой странице",
            "description": "Информацию о KYC нужно искать также в How to Open an Account.",
        }
    ],
}


def snapshot():
    out = ROOT / "data/kb"
    out.mkdir(parents=True, exist_ok=True)
    documents = []
    for sid, (title, slug) in SOURCES.items():
        url = f"https://valetax.com/{slug}/"
        r = httpx.get(url, timeout=30, follow_redirects=True)
        r.raise_for_status()
        soup = BeautifulSoup(r.text, "html.parser")
        for tag in soup(["script", "style", "noscript"]):
            tag.decompose()
        h1 = soup.find("h1")
        if not h1:
            raise ValueError(f"Missing heading: {sid}")
        lines = []
        for node in h1.find_all_next(string=True):
            value = str(node).strip()
            if not value:
                continue
            if value in (
                "Payment Channels",
                "Social Links",
                "All set to trade?",
                "All set to get started?",
            ):
                break
            lines.append(value)
        text = "\n".join([h1.get_text(" ", strip=True)] + lines)
        chunks = []
        block = []
        # Preserve neighboring question/answer text; no semantic rewriting.
        for line in text.splitlines():
            if line.endswith("?") and block:
                chunks.append("\n".join(block))
                block = []
            block.append(line)
        if block:
            chunks.append("\n".join(block))
        doc = {
            "id": sid,
            "title": title,
            "url": url,
            "fetched_at": datetime.now(timezone.utc).isoformat(),
            "sha256": hashlib.sha256(text.encode()).hexdigest(),
            "raw_html_sha256": hashlib.sha256(r.content).hexdigest(),
            "text": text,
            "issues": ISSUES[sid],
            "chunks": [
                {"id": f"{sid}:{i + 1:02d}", "text": c} for i, c in enumerate(chunks)
            ],
        }
        (out / f"{sid}.html").write_text(r.text)
        documents.append(doc)
    (out / "corpus.json").write_text(
        json.dumps(
            {
                "version": "valetax-2026-10-14-v1",
                "extraction": "Main help text; navigation, social links, promotional footer omitted. Original HTML retained. Images not OCRed.",
                "documents": documents,
            },
            ensure_ascii=False,
            indent=2,
        )
    )
    print(
        {
            d["id"]: {"characters": len(d["text"]), "chunks": len(d["chunks"])}
            for d in documents
        }
    )


if __name__ == "__main__":
    snapshot()
