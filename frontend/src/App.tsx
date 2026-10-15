import { useEffect, useState } from "react";
import {
  ArrowUpRight,
  ArrowRight,
  MessageSquare,
  BookOpen,
  GitBranch,
  Layers,
  FlaskConical,
  Activity,
  Check,
  ChevronRight,
  Copy,
  RotateCcw,
  Loader2,
  AlertTriangle,
  Settings2,
  X,
  Menu,
  ExternalLink,
} from "lucide-react";
import {
  api,
  categoryNames,
  queueNames,
  dispositionNames,
  type Health,
  type KB,
  type TicketResult,
} from "./types";
import { risks } from "./guide";
import { TestingPage } from "./Testing";
import { ArchitectureContent, FailoverPlan } from "./Architecture";
import { ScalingPlan } from "./Scaling";

type View =
  | "workspace"
  | "knowledge"
  | "architecture"
  | "operations"
  | "testing"
  | "economy";
const nav = [
  { id: "workspace", name: "Чат", icon: MessageSquare },
  { id: "knowledge", name: "База знаний", icon: BookOpen },
  { id: "architecture", name: "Как устроено", icon: GitBranch },
  { id: "operations", name: "Эксплуатация", icon: Layers },
  { id: "testing", name: "Тестирование", icon: FlaskConical },
  { id: "economy", name: "Экономика", icon: Activity },
] as const;
const samples = [
  {
    title: "Пополнение счёта",
    text: "Здравствуйте! Как пополнить мой торговый счёт?",
  },
  {
    title: "Документы для KYC",
    text: "Which documents do I need for KYC verification?",
  },
  {
    title: "Торговая рекомендация",
    text: "Should I buy EUR/USD now, and what leverage should I choose?",
  },
  {
    title: "Комиссия за вывод",
    text: "Какая комиссия за вывод в USDT? Назовите точную сумму.",
  },
  {
    title: "Жалоба клиента",
    text: "У меня жалоба: деньги после вывода не пришли. Одобрите компенсацию.",
  },
  {
    title: "Инструкция по выводу",
    text: "How do I withdraw funds step by step?",
  },
];

function Pill({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: string;
}) {
  return <span className={`pill ${tone}`}>{children}</span>;
}
function PageTitle({
  title,
  children,
}: {
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="page-heading">
      <h1>{title}</h1>
      {children}
    </div>
  );
}

export default function App() {
  const [view, setView] = useState<View>("workspace");
  const [health, setHealth] = useState<Health | null>(null);
  const [kb, setKb] = useState<KB | null>(null);
  const [mode, setMode] = useState<"configured" | "demo">("configured");
  const [text, setText] = useState("");
  const [selected, setSelected] = useState(-1);
  const [result, setResult] = useState<TicketResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [history, setHistory] = useState<TicketResult[]>([]);
  const [toast, setToast] = useState("");
  const [settings, setSettings] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);
  useEffect(() => {
    api<Health>("/health")
      .then(setHealth)
      .catch(() =>
        setError("Сервер недоступен. Обновите страницу после запуска сервиса."),
      );
    api<KB>("/kb")
      .then(setKb)
      .catch(() => setError("Не удалось загрузить базу знаний."));
  }, []);
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "auto" });
  }, [view]);
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(""), 4000);
      return () => clearTimeout(timer);
    }
  }, [toast]);
  async function process() {
    setError("");
    setBusy(true);
    setResult(null);
    try {
      const r = await api<TicketResult>("/tickets", { text, mode });
      setResult(r);
      setHistory((h) => [r, ...h].slice(0, 12));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function review(action: string, edited_draft = "", note = "") {
    if (!result) return;
    try {
      const r = await api<TicketResult>(`/tickets/${result.id}/review`, {
        action,
        edited_draft,
        note,
      });
      setResult(r);
      setHistory((h) => h.map((x) => (x.id === r.id ? r : x)));
      setToast("Решение сохранено. Ответ клиенту не отправлен.");
    } catch (e) {
      setError((e as Error).message);
    }
  }
  const live = mode === "configured" && health?.mode === "live";
  return (
    <div className="app-shell">
      {mobileNav && (
        <button
          className="nav-backdrop"
          aria-label="Закрыть меню"
          onClick={() => setMobileNav(false)}
        />
      )}
      <aside className={`sidebar ${mobileNav ? "open" : ""}`}>
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            setView("workspace");
            setMobileNav(false);
          }}
        >
          <span className="brand-mark">v</span>
          <span>
            Valetax<small>Поддержка</small>
          </span>
        </a>
        <nav aria-label="Разделы приложения">
          {nav.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                className={`nav-item ${view === item.id ? "active" : ""}`}
                aria-current={view === item.id ? "page" : undefined}
                onClick={() => {
                  setView(item.id);
                  setMobileNav(false);
                }}
              >
                <Icon size={18} />
                <span>{item.name}</span>
              </button>
            );
          })}
        </nav>
        <button
          className="side-settings"
          onClick={() => {
            setSettings(true);
            setMobileNav(false);
          }}
        >
          <Settings2 size={17} />
          Подключение
        </button>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <button
            className="mobile-menu icon-button"
            aria-label="Открыть меню"
            onClick={() => setMobileNav(!mobileNav)}
          >
            <Menu size={20} />
          </button>
          <span className="app-label">Поддержка Valetax</span>
          <label className="mode-select">
            <span className={`status-dot ${live ? "live" : ""}`} />
            <span className="sr-only">Режим обработки</span>
            <select
              value={mode}
              onChange={(e) => setMode(e.target.value as "configured" | "demo")}
              disabled={busy}
            >
              <option value="configured">
                {health
                  ? health.mode === "live"
                    ? "OpenAI"
                    : "Демо · ключ не настроен"
                  : "Подключение…"}
              </option>
              <option value="demo">Демо · шаблоны</option>
            </select>
          </label>
        </header>
        <main>
          {error && (
            <div className="notice error" role="alert">
              <AlertTriangle size={17} />
              <span>{error}</span>
              <button
                className="icon-button"
                aria-label="Закрыть ошибку"
                onClick={() => setError("")}
              >
                <X size={16} />
              </button>
            </div>
          )}
          {view === "workspace" && (
            <>
              <PageTitle title="Чат" />
              <div className="workspace-grid">
                <section className="ticket-panel panel">
                  <div className="section-top">
                    <h2>Обращение</h2>
                  </div>
                  <label className="sample-select" htmlFor="sample-select">
                    Пример обращения
                    <select
                      id="sample-select"
                      value={selected}
                      disabled={busy}
                      onChange={(e) => {
                        const i = Number(e.target.value);
                        setSelected(i);
                        setText(i >= 0 ? samples[i].text : "");
                        setResult(null);
                        setError("");
                      }}
                    >
                      <option value={-1}>Выбрать пример</option>
                      {samples.map((s, i) => (
                        <option key={s.title} value={i}>
                          {s.title}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="sr-only" htmlFor="ticket-text">
                    Текст обращения
                  </label>
                  <textarea
                    id="ticket-text"
                    value={text}
                    maxLength={6000}
                    placeholder="Введите обращение клиента…"
                    onChange={(e) => {
                      setText(e.target.value);
                      setSelected(-1);
                      setResult(null);
                      setError("");
                    }}
                    disabled={busy}
                  />
                  <div className="input-foot">
                    <span>{text.length.toLocaleString("ru-RU")} / 6 000</span>
                  </div>
                  <button
                    className="primary full"
                    disabled={busy || text.trim().length < 3}
                    onClick={process}
                  >
                    {busy ? (
                      <>
                        <Loader2 className="spin" size={17} />
                        Подготовка…
                      </>
                    ) : (
                      <>
                        Подготовить ответ
                        <ArrowRight size={17} />
                      </>
                    )}
                  </button>
                  {history.length > 0 && (
                    <details className="history-list">
                      <summary>
                        История сеанса{" "}
                        <span className="muted">{history.length}</span>
                      </summary>
                      {history.map((r) => (
                        <button
                          key={r.id}
                          className={`history-row ${result?.id === r.id ? "selected" : ""}`}
                          disabled={busy}
                          onClick={() => {
                            setResult(r);
                            setText(r.ticket);
                            setSelected(-1);
                          }}
                        >
                          <span>{r.ticket}</span>
                          <ChevronRight size={14} />
                        </button>
                      ))}
                    </details>
                  )}
                </section>
                <section
                  className={`answer-panel panel ${!result ? "no-result" : ""}`}
                  aria-label="Ответ"
                  aria-busy={busy}
                >
                  {busy ? (
                    <div className="empty-answer" role="status">
                      <Loader2 size={22} className="spin" />
                      <p>Готовим ответ…</p>
                    </div>
                  ) : result ? (
                    <ResultPanel
                      result={result}
                      onReview={review}
                      onCopy={async () => {
                        const value =
                          (result.review?.edited_draft || result.output.draft) +
                          (result.sources.length
                            ? "\n\n" +
                              result.sources
                                .map((s) => `${s.title}: ${s.url}`)
                                .join("\n")
                            : "");
                        try {
                          await navigator.clipboard.writeText(value);
                          setToast("Ответ со ссылками скопирован.");
                        } catch {
                          setToast(
                            "Копирование недоступно. Выделите текст вручную.",
                          );
                        }
                      }}
                    />
                  ) : (
                    <div className="empty-answer">
                      <MessageSquare size={24} strokeWidth={1.5} />
                      <p>Здесь появится ответ или информация для поддержки.</p>
                    </div>
                  )}
                </section>
              </div>
              <p className="workspace-note">
                Черновики проверяет оператор. Отправка клиенту не подключена.
              </p>
            </>
          )}
          {view === "knowledge" && <KnowledgePage kb={kb} />}
          {view === "architecture" && <ArchitecturePage />}
          {view === "operations" && <OperationsPage />}
          {view === "testing" && (
            <TestingPage onError={setError} health={health} />
          )}
          {view === "economy" && <EconomyPage health={health} />}
        </main>
      </div>
      {toast && (
        <div className="toast" role="status">
          <Check size={16} />
          {toast}
        </div>
      )}
      {settings && (
        <div className="modal-backdrop" onClick={() => setSettings(false)}>
          <div
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="settings-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="section-top">
              <h2 id="settings-title">Подключение</h2>
              <button
                className="icon-button"
                aria-label="Закрыть настройки"
                onClick={() => setSettings(false)}
              >
                <X size={20} />
              </button>
            </div>
            <dl className="data-list">
              <div>
                <dt>Провайдер</dt>
                <dd>OpenAI через OpenRouter</dd>
              </div>
              <div>
                <dt>Модель</dt>
                <dd>{health?.model || "Загрузка…"}</dd>
              </div>
              <div>
                <dt>Ключ</dt>
                <dd>
                  {health?.key_configured
                    ? "Настроен на сервере"
                    : "Не настроен"}
                </dd>
              </div>
              <div>
                <dt>База знаний</dt>
                <dd>{health?.kb_version || "Загрузка…"}</dd>
              </div>
            </dl>
            <p className="small muted">
              Локальный запуск без авторизации. Обращения и решения хранятся в
              памяти до перезапуска сервера.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function ResultPanel({
  result: r,
  onReview,
  onCopy,
}: {
  result: TicketResult;
  onReview: (action: string, edited?: string, note?: string) => Promise<void>;
  onCopy: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [edited, setEdited] = useState(r.output.draft);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    setEditing(false);
    setEdited(r.output.draft);
    setNote("");
  }, [r.id]);
  async function save(action: string, draft = "") {
    setSaving(true);
    try {
      await onReview(action, draft, note);
    } finally {
      setSaving(false);
    }
  }
  const hasErrors = r.checks.errors.length > 0;
  const hasDraft =
    r.output.disposition !== "abstain" && !!r.output.draft.trim() && !hasErrors;
  const needsInformation =
    ["partial", "abstain"].includes(r.output.disposition) ||
    r.output.unknowns.length > 0;
  const needsHandoff =
    r.specialist_review_required || hasErrors || needsInformation;
  const operatorNote =
    r.output.operator_note || (needsHandoff ? r.output.rationale : "");
  const urgency: Record<string, string> = {
    low: "Низкий",
    normal: "Обычный",
    high: "Высокий",
  };
  const sentiment: Record<string, string> = {
    positive: "Позитивная",
    neutral: "Нейтральная",
    negative: "Негативная",
    mixed: "Смешанная",
    unknown: "Не определена",
  };
  return (
    <div className="result-content">
      <div className="section-top">
        <h2>{hasDraft ? "Ответ" : "Нужен ответ специалиста"}</h2>
        <Pill tone={r.trace.mode === "live" ? "green" : "neutral"}>
          {r.trace.mode === "live" ? "OpenAI" : "Демо"}
        </Pill>
      </div>
      <dl className="classification">
        <div>
          <dt>Категория</dt>
          <dd>{categoryNames[r.output.category] || r.output.category}</dd>
        </div>
        <div>
          <dt>Приоритет</dt>
          <dd className={r.output.urgency === "high" ? "danger-text" : ""}>
            {urgency[r.output.urgency]}
          </dd>
        </div>
        <div>
          <dt>Язык</dt>
          <dd>{r.output.language.toUpperCase()}</dd>
        </div>
        <div>
          <dt>Тональность</dt>
          <dd>{sentiment[r.output.sentiment]}</dd>
        </div>
      </dl>
      <div className={`routing-banner ${needsHandoff ? "warning" : ""}`}>
        <strong>
          {queueNames[r.queue]} ·{" "}
          {r.specialist_review_required
            ? "Проверка специалистом"
            : "Проверка оператором"}
        </strong>
        <span>{dispositionNames[r.output.disposition]}</span>
      </div>
      {hasErrors && (
        <div className="check-errors">
          {r.checks.errors.map((e) => (
            <p key={e.code}>
              <AlertTriangle size={14} />
              {e.message}
            </p>
          ))}
        </div>
      )}
      {hasDraft && (
        <section className="customer-reply" aria-label="Ответ клиенту">
          <h3>
            {r.output.disposition === "partial"
              ? "Подтверждённая часть ответа"
              : "Ответ клиенту"}
          </h3>
          {r.output.disposition === "partial" && (
            <p className="small muted">
              Перед отправкой оператору нужно дополнить ответ по пунктам ниже.
            </p>
          )}
          {editing && !r.review ? (
            <textarea
              className="edit-draft"
              aria-label="Редактировать черновик"
              value={edited}
              onChange={(e) => setEdited(e.target.value)}
            />
          ) : (
            <p className="draft-text">
              {r.review?.edited_draft || r.output.draft}
            </p>
          )}
          <button className="text-button copy-button" onClick={onCopy}>
            <Copy size={14} />
            {r.output.disposition === "partial"
              ? "Копировать часть ответа"
              : "Копировать ответ"}
          </button>
        </section>
      )}
      {(operatorNote || r.output.unknowns.length > 0) && (
        <section
          className="operator-note"
          aria-label="Для специалиста поддержки"
        >
          <h3>Для специалиста поддержки</h3>
          {operatorNote && <p>{operatorNote}</p>}
          {r.output.unknowns.length > 0 && (
            <>
              <h4>Чего не хватает</h4>
              <ul>
                {r.output.unknowns.map((u, i) => (
                  <li key={i}>{u}</li>
                ))}
              </ul>
            </>
          )}
        </section>
      )}
      {r.output.claims.length > 0 && (
        <div className="evidence-list">
          <h3>Источники</h3>
          <div className="source-links">
            {r.sources.map((s) => (
              <a key={s.id} href={s.url} target="_blank" rel="noreferrer">
                {s.title}
                <ArrowUpRight size={12} />
              </a>
            ))}
          </div>
          {r.output.claims.map((c, i) => {
            const source = r.sources.find((s) => s.id === c.source_id);
            return (
              <details className="evidence-item" key={`${r.id}-${i}`}>
                <summary>
                  <span className="evidence-number">{i + 1}</span>
                  <span>{c.text}</span>
                </summary>
                <blockquote>{c.evidence}</blockquote>
                {source && (
                  <a href={source.url} target="_blank" rel="noreferrer">
                    {source.title}
                    <ArrowUpRight size={13} />
                  </a>
                )}
              </details>
            );
          })}
        </div>
      )}
      <details className="technical-details">
        <summary>Данные обработки</summary>
        <dl className="data-list">
          <div>
            <dt>Модель</dt>
            <dd>{r.trace.model}</dd>
          </div>
          <div>
            <dt>База</dt>
            <dd>{r.trace.kb_version}</dd>
          </div>
          <div>
            <dt>Версия инструкций</dt>
            <dd>{r.trace.prompt_version}</dd>
          </div>
          <div>
            <dt>Время до ответа</dt>
            <dd>{(r.trace.latency_ms / 1000).toFixed(2)} с</dd>
          </div>
          <div>
            <dt>Входные / выходные токены</dt>
            <dd>
              {r.trace.usage
                ? `${r.trace.usage.input_tokens ?? "—"} / ${r.trace.usage.output_tokens ?? "—"}`
                : "Нет данных"}
            </dd>
          </div>
          <div>
            <dt>Расход API</dt>
            <dd>
              {r.trace.cost_usd !== null
                ? `$${r.trace.cost_usd.toFixed(5)} · ${r.trace.cost_basis === "reported" ? "от провайдера" : "расчёт"}`
                : "Нет данных"}
            </dd>
          </div>
          <div>
            <dt>Цитаты присутствуют в базе</dt>
            <dd>
              {r.checks.evidence_membership ? "Да" : "Проверка не пройдена"}
            </dd>
          </div>
          <div>
            <dt>Смысловая проверка</dt>
            <dd>Оператором</dd>
          </div>
          <div>
            <dt>Маскирование данных</dt>
            <dd>
              {r.trace.redacted
                ? "Есть замаскированные данные"
                : "Совпадений не найдено"}
            </dd>
          </div>
        </dl>
        <p className="small">{r.output.rationale}</p>
      </details>
      <div className="review-area">
        {r.review ? (
          <div className="review-saved">
            <Check size={18} />
            <div>
              <strong>
                {
                  (
                    {
                      accept: "Черновик принят",
                      edit: "Правка сохранена",
                      reject: "Результат отклонён",
                      escalate: r.specialist_review_required
                        ? "Передача специалисту отмечена"
                        : "Передача оператору отмечена",
                    } as Record<string, string>
                  )[r.review.action]
                }
              </strong>
              <span>Локальная запись · клиенту не отправлено</span>
              {r.review.note && <p>{r.review.note}</p>}
            </div>
          </div>
        ) : (
          <>
            <label className="review-note" htmlFor="review-note">
              Комментарий <span className="muted">· необязательно</span>
              <input
                id="review-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Что проверить или уточнить"
                maxLength={1200}
                disabled={saving}
              />
            </label>
            <div className="review-actions">
              {needsHandoff ? (
                <button
                  className="primary"
                  disabled={saving}
                  onClick={() => save("escalate")}
                >
                  Передать{" "}
                  {r.specialist_review_required ? "специалисту" : "оператору"}
                  <ArrowRight size={16} />
                </button>
              ) : editing ? (
                <button
                  className="primary"
                  disabled={saving || !edited.trim()}
                  onClick={() => save("edit", edited)}
                >
                  Сохранить правку
                  <Check size={16} />
                </button>
              ) : (
                <button
                  className="primary"
                  disabled={saving}
                  onClick={() => save("accept")}
                >
                  Принять
                  <Check size={16} />
                </button>
              )}
              {!needsHandoff && hasDraft && (
                <button
                  className="secondary"
                  disabled={saving}
                  onClick={() => setEditing(!editing)}
                >
                  {editing ? "Отмена" : "Править"}
                </button>
              )}
              <button
                className="text-button"
                disabled={saving}
                onClick={() => save("reject")}
              >
                Отклонить
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function KnowledgePage({ kb }: { kb: KB | null }) {
  const [selected, setSelected] = useState("deposit");
  const doc = kb?.documents.find((d) => d.id === selected);
  return (
    <>
      <PageTitle title="База знаний">
        <span className="muted small">4 страницы Valetax</span>
      </PageTitle>
      <div className="knowledge-layout">
        <nav className="source-nav" aria-label="Источники базы знаний">
          {kb?.documents.map((d) => (
            <button
              className={selected === d.id ? "selected" : ""}
              onClick={() => setSelected(d.id)}
              key={d.id}
            >
              <BookOpen size={17} />
              <span>{d.title}</span>
              <ChevronRight size={15} />
            </button>
          ))}
        </nav>
        <section className="source-body panel">
          {doc ? (
            <>
              <div className="section-top">
                <h2>{doc.title}</h2>
                <a
                  className="text-button"
                  href={doc.url}
                  target="_blank"
                  rel="noreferrer"
                >
                  Оригинал
                  <ExternalLink size={14} />
                </a>
              </div>
              {doc.issues.length > 0 && (
                <div className="source-issues">
                  <h3>Замечания к источнику</h3>
                  {doc.issues.map((issue) => (
                    <div key={issue.code}>
                      <AlertTriangle size={16} />
                      <div>
                        <strong>{issue.title}</strong>
                        <p>{issue.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <div className="chunks">
                {doc.chunks.map((c) => (
                  <details key={c.id}>
                    <summary>
                      {c.text
                        .split("\n")
                        .find((s, i) => i > 0 && s.endsWith("?")) ||
                        c.text.split("\n")[0]}
                    </summary>
                    <pre>{c.text}</pre>
                  </details>
                ))}
              </div>
              <details className="technical-details">
                <summary>Данные снимка</summary>
                <dl className="data-list">
                  <div>
                    <dt>Дата</dt>
                    <dd>
                      {new Date(doc.fetched_at).toLocaleDateString("ru-RU")}
                    </dd>
                  </div>
                  <div>
                    <dt>Версия базы</dt>
                    <dd>{kb?.version}</dd>
                  </div>
                  <div>
                    <dt>SHA256</dt>
                    <dd className="hash">{doc.sha256}</dd>
                  </div>
                </dl>
                <p className="small muted">{kb?.extraction}</p>
              </details>
            </>
          ) : (
            <p className="muted">Загрузка базы…</p>
          )}
        </section>
      </div>
    </>
  );
}

function ArchitecturePage() {
  return (
    <>
      <PageTitle title="Как устроено" />
      <ArchitectureContent />
    </>
  );
}

function OperationsPage() {
  return (
    <>
      <PageTitle title="Эксплуатация" />
      <ScalingPlan />
      <section className="section-block">
        <h2>Проблемы и действия</h2>
        <div className="risk-list">
          {risks.map((r) => (
            <details key={r.id}>
              <summary>{r.title}</summary>
              <div className="risk-incident">
                <h3>Что происходит</h3>
                <p>{r.symptom}</p>
              </div>
              <div className="table-wrap risk-causes">
                <table className="risk-causes-table">
                  <thead>
                    <tr>
                      <th>Возможная причина</th>
                      <th>Что делать</th>
                    </tr>
                  </thead>
                  <tbody>
                    {r.causes.map((c) => (
                      <tr key={c.reason}>
                        <td>
                          <span className="risk-mobile-label">
                            Возможная причина
                          </span>
                          {c.reason}
                        </td>
                        <td>
                          <span className="risk-mobile-label">Что делать</span>
                          {c.action}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <dl className="risk-body risk-implementation">
                <div>
                  <dt>Уже есть в MVP</dt>
                  <dd>{r.implemented}</dd>
                </div>
                <div>
                  <dt>Нужно добавить</dt>
                  <dd>{r.missing}</dd>
                </div>
              </dl>
              <div className="risk-verification">
                <h3>Как проверить</h3>
                <p>{r.test}</p>
              </div>
              {r.id === "provider" && (
                <details className="technical-details risk-failover">
                  <summary>Схема резервов и отката</summary>
                  <FailoverPlan />
                </details>
              )}
            </details>
          ))}
        </div>
      </section>
      <p className="small muted">
        MVP работает локально, без авторизации и постоянного хранения. Перед
        внедрением нужны правила доступа, хранения и передачи клиентских данных
        провайдеру.
      </p>
    </>
  );
}

function EconomyPage({ health }: { health: Health | null }) {
  const [volume, setVolume] = useState(10000),
    [coverage, setCoverage] = useState(60),
    [acceptance, setAcceptance] = useState(80),
    [saved, setSaved] = useState(4),
    [hour, setHour] = useState(20),
    [waste, setWaste] = useState(0.5),
    [maintenance, setMaintenance] = useState(320),
    [infra, setInfra] = useState(100),
    [input, setInput] = useState(3200),
    [output, setOutput] = useState(500);
  const q = coverage / 100,
    a = acceptance / 100;
  const hours = (volume * q * (a * saved - (1 - a) * waste)) / 60;
  const inputPrice = health?.input_price ?? 2,
    outputPrice = health?.output_price ?? 10;
  const apiCost =
    ((volume * (input * inputPrice + output * outputPrice)) / 1e6) * 1.1;
  const opex = apiCost + maintenance + infra,
    net = hours * hour - opex;
  const fields = [
    {
      label: "Обращений в месяц",
      value: volume,
      set: setVolume,
      step: 100,
      min: 1,
      max: 1000000,
    },
    {
      label: "Покрытие базой, %",
      value: coverage,
      set: setCoverage,
      step: 5,
      min: 0,
      max: 100,
    },
    {
      label: "Принятых черновиков, %",
      value: acceptance,
      set: setAcceptance,
      step: 5,
      min: 0,
      max: 100,
    },
    {
      label: "Экономия на принятом, мин",
      value: saved,
      set: setSaved,
      step: 0.5,
      min: 0,
      max: 30,
    },
    {
      label: "Время на отклонённый, мин",
      value: waste,
      set: setWaste,
      step: 0.1,
      min: 0,
      max: 30,
    },
    {
      label: "Стоимость часа оператора, $",
      value: hour,
      set: setHour,
      step: 5,
      min: 0,
      max: 500,
    },
    {
      label: "Входные токены на вызов",
      value: input,
      set: setInput,
      step: 100,
      min: 100,
      max: 50000,
    },
    {
      label: "Выходные токены на вызов",
      value: output,
      set: setOutput,
      step: 100,
      min: 50,
      max: 10000,
    },
    {
      label: "Инфраструктура в месяц, $",
      value: infra,
      set: setInfra,
      step: 25,
      min: 0,
      max: 10000,
    },
    {
      label: "Сопровождение в месяц, $",
      value: maintenance,
      set: setMaintenance,
      step: 40,
      min: 0,
      max: 20000,
    },
  ];
  function reset() {
    setVolume(10000);
    setCoverage(60);
    setAcceptance(80);
    setSaved(4);
    setWaste(0.5);
    setHour(20);
    setInput(3200);
    setOutput(500);
    setInfra(100);
    setMaintenance(320);
  }
  const renderFields = (items: typeof fields) => (
    <div className="economy-fields">
      {items.map((f) => (
        <label key={f.label}>
          {f.label}
          <input
            type="number"
            value={f.value}
            min={f.min}
            max={f.max}
            step={f.step}
            onChange={(e) => {
              const n = Number(e.target.value);
              if (Number.isFinite(n))
                f.set(Math.max(f.min, Math.min(f.max, n)));
            }}
          />
        </label>
      ))}
    </div>
  );
  return (
    <>
      <PageTitle title="Экономика" />
      <p className="section-description">
        Сценарный расчёт для {health?.model || "openai/gpt-6.1-sol"}. Время,
        покрытие и принятие ещё не измерены в работе поддержки.
      </p>
      <div className="economy-layout">
        <section className="panel economy-inputs">
          <div className="section-top">
            <h2>Допущения</h2>
            <button className="text-button" onClick={reset}>
              <RotateCcw size={14} />
              Сбросить
            </button>
          </div>
          {renderFields(fields.slice(0, 6))}
          <details className="technical-details" open>
            <summary>Расходы и токены</summary>
            {renderFields(fields.slice(6))}
          </details>
          <p className="small muted">
            Экономия включает проверку и правки. API рассчитывается на все
            обращения с резервом 10%. Тариф за 1 млн токенов: ${inputPrice} вход
            / ${outputPrice} выход.
          </p>
        </section>
        <section
          className={`panel economy-result ${net < 0 ? "negative" : ""}`}
        >
          <h2>Результат за месяц</h2>
          <div className="net-value">
            {net < 0 ? "−" : "+"}$
            {Math.abs(net).toLocaleString("en-US", {
              maximumFractionDigits: 0,
            })}
          </div>
          <p className="net-label">Ценность времени за вычетом расходов</p>
          <dl className="data-list">
            <div>
              <dt>Сэкономлено времени</dt>
              <dd>
                {hours.toLocaleString("ru-RU", { maximumFractionDigits: 1 })} ч
              </dd>
            </div>
            <div>
              <dt>Ценность времени</dt>
              <dd>
                $
                {(hours * hour).toLocaleString("en-US", {
                  maximumFractionDigits: 0,
                })}
              </dd>
            </div>
            <div>
              <dt>API с резервом</dt>
              <dd>${apiCost.toFixed(2)}</dd>
            </div>
            <div>
              <dt>Инфраструктура и сопровождение</dt>
              <dd>${(infra + maintenance).toFixed(0)}</dd>
            </div>
            <div>
              <dt>Всего расходов</dt>
              <dd>${opex.toFixed(2)}</dd>
            </div>
          </dl>
          <p>
            {net >= 0
              ? "При этих допущениях эксплуатация окупается за счёт времени команды."
              : "При этих допущениях эксплуатация не окупается."}
          </p>
          <p className="small muted">
            Это высвобождённое время, а не подтверждённая денежная экономия.
            Разовые расходы внедрения не учтены.
          </p>
        </section>
      </div>
      <section className="panel section-block recommendation">
        <h2>Рекомендация</h2>
        <p>
          Пилот с выбранной моделью OpenAI и обязательной проверкой оператором.
          Сравнить с ручной обработкой на сопоставимых обращениях; затем
          проверить более дешёвую модель по качеству и общей стоимости.
        </p>
      </section>
      <details className="technical-details">
        <summary>Формула расчёта</summary>
        <p>
          Часы = обращения × покрытие × [принятие × экономия − (1 − принятие) ×
          время на отклонённый] / 60.
        </p>
        <a
          href={`https://openrouter.ai/${health?.model || "openai/gpt-6.1-sol"}`}
          target="_blank"
          rel="noreferrer"
        >
          Модель и тариф OpenRouter
          <ArrowUpRight size={13} />
        </a>
      </details>
    </>
  );
}
