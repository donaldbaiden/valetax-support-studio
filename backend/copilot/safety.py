import re


def normalize(value):
    return " ".join(value.split()).casefold()


def redact(text):
    text = re.sub(r"[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}", "[EMAIL]", text)
    text = re.sub(r"(?<!\w)\+?\d[\d ()-]{8,}\d(?!\w)", "[NUMBER]", text)
    return text


def scan_risks(text):
    t = text.casefold()
    flags = set()
    if re.search(
        r"\b(should i|recommend|suggest|signal|price target)\b.{0,55}\b(buy|sell|trade|leverage|forex|eur|usd)|\b(buy|sell).{0,25}(eur[/ -]?usd|bitcoin|btc)|\b(leverage|плеч[оау])\b|торгов.{0,12}сигнал|купить.{0,20}(eur|usd|биткоин)|стоит.{0,25}(куп|прода)|ценов.{0,10}цел",
        t,
    ):
        flags.add("trading_advice")
    if re.search(
        r"complaint|compensat|refund|жалоб|компенсац|верните.{0,12}деньг|возмест", t
    ):
        flags.add("complaint")
    if re.search(
        r"\b(kyc|aml)\b|верификац|отмыван|провер.{0,15}личност|approve.{0,20}(document|account|verif)|bypass.{0,20}(check|verif)",
        t,
    ):
        flags.add("kyc_aml")
    if re.search(
        r"my (withdrawal|deposit|account).{0,35}(reject|pending|missing|not|status)|мой.{0,20}(отклон|статус)|мне.{0,20}отказ|не приш|не получил",
        t,
    ):
        flags.add("account_specific")
    if re.search(
        r"ignore.{0,20}(instruction|rule)|system prompt|игнорируй|забудь.{0,15}правил|reveal.{0,15}(key|secret)",
        t,
    ):
        flags.add("prompt_injection")
    return flags


def unsafe_draft(text):
    # Supplemental rules, not proof of semantic safety. All drafts still need review.
    t = text.casefold()
    for sentence in re.split(r"[.!?\n;]|\bbut\b|\bhowever\b|\bно\b|\bоднако\b", t):
        refusal = re.search(
            r"cannot (provide|give|advise|tell|recommend)|can[’\x27]t (provide|give|advise|tell|recommend)|do not (provide|give)|unable to (provide|give|advise)|не (могу|даю|предоставляю)",
            sentence,
        )
        if refusal:
            continue
        if re.search(
            r"\b(you should|i recommend|we recommend|recommend you).{0,35}\b(buy|sell|leverage)|рекоменду.{0,25}(куп|прода|плеч)|^\s*(buy|sell) (eur|usd|btc|bitcoin)",
            sentence,
        ):
            return True
        if re.search(
            r"your.{0,20}(kyc|verification|account).{0,18}(is approved|has been approved|is rejected)|we.{0,15}(approve|reject).{0,20}(kyc|verification)|refund.{0,20}(approved|guaranteed)|ваш.{0,20}(провер|верификац|жалоб).{0,20}(одобрен|отклонен)|компенсац.{0,15}одобр",
            sentence,
        ):
            return True
    return False


def route(output, flags):
    categories = {
        output.category.value,
        *[c.value for c in output.secondary_categories],
    }
    if "complaint" in flags or "complaint" in categories:
        return "complaints", True
    if "kyc_aml" in flags or categories & {"verification", "aml"}:
        return "compliance", True
    if "account_specific" in flags:
        return "payments", True
    return "support", False


def validate_evidence(output, kb):
    errors = []
    for claim in output.claims:
        chunk = kb.chunks.get(claim.chunk_id)
        if not chunk or chunk["source_id"] != claim.source_id:
            errors.append("unknown_source")
            continue
        if len(claim.evidence.strip()) < 12 or normalize(
            claim.evidence
        ) not in normalize(chunk["text"]):
            errors.append("unsupported_evidence")
    if output.disposition == "draft" and not output.claims:
        errors.append("missing_evidence")
    if output.disposition in ("partial", "abstain") and not output.unknowns:
        errors.append("missing_unknowns")
    if unsafe_draft(output.draft):
        errors.append("unsafe_draft")
    if re.search(r"https?://", output.draft):
        errors.append("unvalidated_url")
    if len(output.draft) > 8000:
        errors.append("oversized_draft")
    return list(dict.fromkeys(errors))
