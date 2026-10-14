# Version 0.1: decisions, evidence and limits

Implemented locally on 14 October 2026 using Codex as the agentic coding tool. All examples and evaluation tickets are synthetic. No client messages are sent and no account outcome is decided.

## Approved architecture

The user explicitly selected a web MVP, no Model Context Protocol server; Python/FastAPI + React; local-only operation without authentication; OpenAI models through OpenRouter; GPT-6.1 Sol as the baseline. These supersede the earlier research recommendation of Claude. The provider model is configured on the Python server, not in the browser.

One model call returns a strict structured output. The server validates its schema, finish reason, citation source and excerpt membership. Business routing is code-owned; every reply requires review and specialist queues cannot be approved by the ordinary reviewer action. A small adapter controls model configuration, timeout and a maximum of one retry for selected transient HTTP errors. The model has no tools or write permissions.

The React app exposes six surfaces: ticket workbench, original KB and defects, architecture and extension points, scale/operations, evaluation, and an interactive economic scenario. Architecture and operations distinguish implemented functionality from proposed extensions. The information design follows IBM Carbon principles and uses locally packaged IBM Plex fonts, with a restrained editorial treatment. It is an adaptation, not a claim of Carbon certification or an exact copy of its components.

## Telegram practices applied

| Source | Implementation | Boundaries |
|---|---|---|
| [106: iterate from errors](https://t.me/vikulin_ai/106) | Baseline, failure groups and a bounded guardrail fix | No autonomous editing of policy or repeated prompt tuning against holdout |
| [124: minimum autonomy](https://t.me/vikulin_ai/124) | One LLM call; server routing; human decision | No agent framework, transactions or customer send action |
| [136: search only when needed](https://t.me/vikulin_ai/136) | All four short pages in context | Retrieval is an extension with its own recall/quality test |
| [145: shared context](https://t.me/vikulin_ai/145) | Snapshot IDs, hashes, chunks; source text visible to reviewer | Shared bad data is still bad data; defects are annotations, not silently repaired policies |
| [125: abstention](https://t.me/vikulin_ai/125) | Partial/abstain/refuse states, explicit unknowns | Runtime semantic validity is not proven by citation membership |
| [144: calibrate the judge](https://t.me/vikulin_ai/144) | Separate automated checks and human semantic rubric | No uncalibrated LLM judge presented as truth |
| [115: observability](https://t.me/vikulin_ai/115) | Request ID, versions, tokens, reported cost, latency, queue wait, provider latency | Ticket history is bounded memory; no raw-client production log store |
| [81: actual productivity](https://t.me/vikulin_ai/81) | Review actions and economic calculator including rejected drafts | User-time savings and production ROI have not been measured |
| [164: accept agent work](https://t.me/vikulin_ai/164) | Tests with hostile outputs, failed providers and API review invariants | Generated code and generated tests alone are not semantic evaluation |

See the research review for disagreements with the channel's more categorical recommendations. Safety and cost were not deferred to Phase 2.

## Observed provider failure

Authentication with OpenRouter succeeded. The initial OpenAI inference request returned HTTP 403 with provider code `unsupported_country_region_territory`. After the user requested a retry, the same model/endpoint/key succeeded. The adapter retains a specific safe error for this case, with no region workaround or silent model substitution. Future changes in the network or provider policy may reintroduce this failure.

## Evaluation and failure analysis

The original full live baseline is preserved in `reports/eval_live_baseline.json`: 28/32 technical scenarios passed, 32/32 primary categories matched, and 30/32 routes matched the provisional gold. Reported total API cost was $0.329390. A batch of 32 tasks ran with concurrency 2, so its end-to-end p95 includes queue wait and must not be mistaken for isolated model latency.

Two failures were false positives in a lexical output guard: a polite refusal mentioning buying EUR/USD was treated as trading advice. The guard now distinguishes common explicit refusal clauses and affirmative directives, with regression checks including a refusal followed by an unsafe “but” clause. The signal remains an imperfect supplementary heuristic, not proof of safety.

Two other baseline mismatches routed an account-specific minimum or exchange-rate question to payments rather than ordinary support. This is an unresolved routing-taxonomy issue; it is not hidden by editing the gold. The route requires clarification with the process owner before expanding production use.

After the guard change, eight live development smoke scenarios passed 8/8 technical checks. That small repeated dev run is not a new independent 32-case score. The initially held-out part was inspected during failure analysis, so it is now consumed and is not described as pristine. A genuinely new held-out set is needed for the next model/prompt comparison.

The report does not claim measured semantic correctness, advice-violation frequency, claim completeness or real-world ROI. Automated tests check format, source membership, routing and fail-closed behavior. The source evidence and complete draft must still be reviewed with the rubric.

## Important limits

- Local service, no users/SSO, bounded in-memory records, no durable ticketing or actual specialist dispatch.
- Basic pattern-based masking is not full anonymization. Real documents/payment information require approved data handling and access controls.
- The model and lexical guards can miss unfamiliar languages, indirect advice, implied policy or unsupported claims omitted from the claims list.
- A correct excerpt can be paired with a wrong statement. Review the whole draft; evidence membership is not entailment.
- Gold is preliminary and author-labelled against the assignment/KB, not calibrated with an actual broker support/compliance expert.
- English, Russian, Indonesian and Malay are schema languages; no production multilingual-quality claim is made. Demo language/intent recognition is deliberately limited.
- A failed schema/refusal call can be billed. When usage cannot be recovered the UI says cost unknown, not zero.
- Trace records queue wait separately from provider latency; evaluation load may be heavier than normal single-ticket use.
- Input/output price settings are scenario rates. Reported API cost is displayed separately when supplied. Changing model requires updating scenario prices.

## Next extension, only with a measured reason

Ticketing/auth/persistence → event idempotency and roles; growing KB → applicability-aware hybrid retrieval; observed semantic misses → calibrated guardrail; observed traffic peaks → durable queue/workers/backoff; model cost optimization → same eval plus measured operator review time. Each extension is described inside the web application with its trigger, verification and Telegram source.

No remote deployment or GitHub publication was requested for this locally approved version. The repository is initialized locally and ready for an approved remote destination.
