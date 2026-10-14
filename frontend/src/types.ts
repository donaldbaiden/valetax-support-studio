export type Health = {
  mode: string;
  model: string;
  provider: string;
  key_configured: boolean;
  kb_version: string;
  sources: number;
  input_price: number;
  output_price: number;
};
export type Claim = {
  text: string;
  source_id: string;
  chunk_id: string;
  evidence: string;
};
export type TicketResult = {
  id: string;
  ticket: string;
  created_at: string;
  queue: string;
  review_required: boolean;
  specialist_review_required: boolean;
  output: {
    category: string;
    secondary_categories: string[];
    urgency: string;
    language: string;
    sentiment: string;
    disposition: string;
    draft: string;
    claims: Claim[];
    unknowns: string[];
    rationale: string;
  };
  sources: { id: string; title: string; url: string }[];
  flags: string[];
  checks: {
    schema: boolean;
    evidence_membership: boolean;
    semantic_support: string;
    errors: { code: string; message: string }[];
  };
  trace: {
    mode: string;
    model: string;
    kb_version: string;
    prompt_version: string;
    latency_ms: number;
    usage: {
      input_tokens: number;
      output_tokens: number;
      attempts: number;
    } | null;
    cost_usd: number | null;
    cost_basis: string;
    redacted: boolean;
  };
  review: {
    action: string;
    note: string;
    edited_draft: string | null;
    delivery: string;
  } | null;
};
export type KB = {
  version: string;
  extraction: string;
  documents: {
    id: string;
    title: string;
    url: string;
    sha256: string;
    fetched_at: string;
    text: string;
    issues: { code: string; title: string; description: string }[];
    chunks: { id: string; text: string }[];
  }[];
};
export type EvalCase = {
  id: string;
  title: string;
  text: string;
  split: string;
  smoke: boolean;
  expected: { categories: string[]; queues: string[]; dispositions: string[] };
};
export type EvalReport = {
  run_at: string;
  mode: string;
  model: string;
  subset: string;
  total: number;
  passed: number;
  category_correct: number;
  route_correct: number;
  cost_usd: number;
  cost_complete: boolean;
  p50_latency_ms: number;
  p95_latency_ms: number;
  semantic_quality: string;
  note: string;
  rows: {
    id: string;
    title: string;
    passed: boolean;
    checks: Record<string, boolean>;
    errors: { code: string; message: string }[];
  }[];
};
export async function api<T>(path: string, body?: unknown): Promise<T> {
  const r = await fetch(
    "/api" + path,
    body === undefined
      ? {}
      : {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
  );
  if (!r.ok) {
    const data = await r.json().catch(() => ({}));
    throw new Error(
      typeof data.detail === "string"
        ? data.detail
        : "Не удалось выполнить запрос. Проверьте данные и соединение.",
    );
  }
  return r.json();
}
export const categoryNames: Record<string, string> = {
  deposit: "Пополнение",
  withdrawal: "Вывод",
  account_opening: "Открытие счёта",
  verification: "Верификация",
  complaint: "Жалоба",
  aml: "AML",
  trading_advice: "Торговый совет",
  other: "Другое",
};
export const queueNames: Record<string, string> = {
  support: "Поддержка",
  payments: "Платежи",
  compliance: "KYC / AML",
  complaints: "Жалобы",
};
export const dispositionNames: Record<string, string> = {
  draft: "Черновик",
  partial: "Частичный ответ",
  refuse: "Совет отклонён",
  abstain: "Нужен человек",
};
