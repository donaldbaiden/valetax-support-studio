# Valetax support co-pilot: should we run it?

**Recommendation:** a limited, human-reviewed pilot. Start with the user-selected **GPT-6.1 Sol via OpenRouter**. Optimize the model only after comparing safety, useful drafts and actual operator time. The first implementation is local, without automatic customer delivery.

| Evidence from the implementation | Result / limit |
|---|---|
| Full synthetic live baseline | 28/32 technical checks; 32/32 primary categories; 30/32 routes |
| Reported cost of that baseline | $0.329390 for 32 requests; not a production cost estimate |
| After a lexical refusal-guard fix | 8/8 dev smoke checks; not a new independent full-set score |
| Semantic quality / real AHT savings | Not measured; needs expert rubric and support pilot |

The full baseline includes two false-positive output blocks and two routing-taxonomy mismatches. Its original report is preserved. The initially held-out set has been inspected and needs replacement before the next independent comparison.

**Planning assumptions:** 10,000 tickets/month; 60% attempted with a draft; 80% of those accepted; 4 minutes saved per accepted draft including review/editing; rejected drafts add 0.5 minutes; operator hour $20. Uncovered tickets receive no savings credit.

```text
Net capacity = 10,000 × 0.60 × [0.80 × 4 − 0.20 × 0.5] / 60
             = 310 hours/month = $6,200/month capacity value
```

Budget one call on every ticket at 3,200 input + 500 output tokens, scenario prices $2/$10 per million tokens, plus a 10% usage reserve. LLM **$125.40/month**; infrastructure allowance **$100**; maintenance 8h × $40 = **$320**. Full monthly OPEX **$545.40**; scenario net capacity value **$5,654.60/month**. Add one-time integration, incremental licenses, compliance and on-call costs. Price settings are estimates; actual reported costs, caching and reasoning usage can differ.

**Sensitivity:** at 30% attempted, 60% accepted and only one minute saved, capacity value is $400/month; net is **−$145.40/month**. The business case depends more on useful time saved than on cheap tokens. Saved capacity is not an automatic payroll reduction: cash value requires avoided hiring or another operational change.

**Pilot decision:** measure assisted vs manual active handling time on comparable topics/languages, acceptance/edit/reject, repeat contacts, mandatory routing and actual usage. Go only with positive measured value and no observed critical failures in the agreed evaluation. Keep all drafts human reviewed; never provide trading advice or decide complaint/KYC/AML outcomes. Introduce ticketing integration, durable queues, versioned SOPs and retrieval only when the corresponding need is measured.

Principles: [106: measurable iterations](https://t.me/vikulin_ai/106), [81: productivity is a process outcome](https://t.me/vikulin_ai/81), [112: economic evidence](https://t.me/vikulin_ai/112). Pricing basis: [OpenRouter model catalogue](https://openrouter.ai/openai/gpt-6.1-sol), checked 14.10.2026. Volume and hard rules: supplied assignment; other operational values are assumptions.
