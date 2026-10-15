from enum import Enum
from pydantic import BaseModel, ConfigDict, Field
from typing import Literal


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class Category(str, Enum):
    deposit = "deposit"
    withdrawal = "withdrawal"
    account_opening = "account_opening"
    verification = "verification"
    complaint = "complaint"
    aml = "aml"
    trading_advice = "trading_advice"
    other = "other"


class Claim(StrictModel):
    text: str
    source_id: Literal["deposit", "withdraw", "open_account", "verify"]
    chunk_id: str
    evidence: str


class ModelOutput(StrictModel):
    category: Category
    secondary_categories: list[Category]
    urgency: Literal["low", "normal", "high"]
    language: Literal["ru", "en", "id", "ms", "und"]
    sentiment: Literal["positive", "neutral", "negative", "mixed", "unknown"]
    disposition: Literal["draft", "partial", "refuse", "abstain"]
    draft: str
    operator_note: str
    claims: list[Claim]
    unknowns: list[str]
    risk_flags: list[
        Literal[
            "trading_advice",
            "complaint",
            "kyc_aml",
            "account_specific",
            "kb_conflict",
            "prompt_injection",
        ]
    ]
    rationale: str


class TicketRequest(StrictModel):
    text: str = Field(min_length=3, max_length=6000)
    mode: Literal["configured", "demo"] = "configured"


class ReviewRequest(StrictModel):
    action: Literal["accept", "edit", "reject", "escalate"]
    edited_draft: str = Field(default="", max_length=8000)
    note: str = Field(default="", max_length=1200)


def strict_schema():
    schema = ModelOutput.model_json_schema()

    def visit(node):
        if isinstance(node, dict):
            node.pop("default", None)
            if node.get("type") == "object":
                node["additionalProperties"] = False
                node["required"] = list(node.get("properties", {}))
            for value in node.values():
                visit(value)
        elif isinstance(node, list):
            for value in node:
                visit(value)

    visit(schema)
    return schema
