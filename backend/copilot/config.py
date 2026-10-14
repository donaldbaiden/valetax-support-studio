from dataclasses import dataclass
from pathlib import Path
import os
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[2]
load_dotenv(ROOT / ".env", override=False)


@dataclass(frozen=True)
class Settings:
    key: str = ""
    model: str = "openai/gpt-6.1-sol"
    mode: str = "auto"
    timeout: float = 40
    max_tokens: int = 3000
    input_price: float = 2
    output_price: float = 10

    @classmethod
    def from_env(cls):
        return cls(
            key=os.getenv("OPENROUTER_API_KEY", ""),
            model=os.getenv("OPENROUTER_MODEL", "openai/gpt-6.1-sol"),
            mode=os.getenv("COPILOT_MODE", "auto"),
            timeout=float(os.getenv("LLM_TIMEOUT_SECONDS", "40")),
            max_tokens=int(os.getenv("LLM_MAX_TOKENS", "3000")),
            input_price=float(os.getenv("LLM_INPUT_PRICE", "2")),
            output_price=float(os.getenv("LLM_OUTPUT_PRICE", "10")),
        )

    @property
    def live(self):
        return bool(self.key) and self.mode != "demo"
