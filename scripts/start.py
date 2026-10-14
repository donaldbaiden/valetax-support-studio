"""Start the built local app; dependencies are installed with uv / npm first."""

from pathlib import Path
import subprocess
import sys

root = Path(__file__).resolve().parents[1]
if not (root / "frontend/node_modules").exists():
    subprocess.run(["npm", "ci"], cwd=root / "frontend", check=True)
sources = [
    *list((root / "frontend/src").rglob("*")),
    root / "frontend/package.json",
    root / "frontend/package-lock.json",
    root / "frontend/index.html",
]
dist = root / "frontend/dist/index.html"
if not dist.exists() or any(
    p.is_file() and p.stat().st_mtime > dist.stat().st_mtime for p in sources
):
    subprocess.run(["npm", "run", "build"], cwd=root / "frontend", check=True)
print("\nSupport Studio: http://127.0.0.1:8000\n", flush=True)
subprocess.run(
    [
        sys.executable,
        "-m",
        "uvicorn",
        "copilot.main:app",
        "--app-dir",
        "backend",
        "--host",
        "127.0.0.1",
        "--port",
        "8000",
    ],
    cwd=root,
    check=True,
)
