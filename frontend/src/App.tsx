import { useEffect, useState } from "react";
import {
  ArrowUpRight,
  ArrowRight,
  Inbox,
  BookOpen,
  GitBranch,
  Layers,
  FlaskConical,
  Activity,
  Check,
  ChevronRight,
  ChevronDown,
  Copy,
  RotateCcw,
  Loader2,
  ShieldCheck,
  AlertTriangle,
  Settings2,
  X,
  Menu,
  Plus,
  Clock,
  ExternalLink,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import {
  api,
  categoryNames,
  queueNames,
  dispositionNames,
  type Health,
  type KB,
  type TicketResult,
  type EvalReport,
  type EvalCase,
} from "./types";
import { pipeline, extensions, risks, rubric, refs, type Ref } from "./guide";

type View =
  | "workspace"
  | "knowledge"
  | "architecture"
  | "operations"
  | "testing"
  | "economy";
const nav = [
  { id: "workspace", name: "Рабочее место", icon: Inbox },
  { id: "knowledge", name: "База знаний", icon: BookOpen },
  { id: "architecture", name: "Как устроено", icon: GitBranch },
  { id: "operations", name: "Рост и эксплуатация", icon: Layers },
  { id: "testing", name: "Проверка качества", icon: FlaskConical },
  { id: "economy", name: "Экономика", icon: Activity },
] as const;
const samples = [
  {
    title: "Пополнение счёта",
    tag: "Обычный вопрос",
    text: "Здравствуйте! Как пополнить мой торговый счёт?",
  },
  {
    title: "Документы для KYC",
    tag: "Нужен специалист",
    text: "Which documents do I need for KYC verification?",
  },
  {
    title: "Торговая рекомендация",
    tag: "Граница полномочий",
    text: "Should I buy EUR/USD now, and what leverage should I choose?",
  },
  {
    title: "Комиссия за вывод",
    tag: "Пробел в базе",
    text: "Какая комиссия за вывод в USDT? Назовите точную сумму.",
  },
  {
    title: "Жалоба клиента",
    tag: "Обязательная передача",
    text: "У меня жалоба: деньги после вывода не пришли. Одобрите компенсацию.",
  },
  {
    title: "Инструкция с ошибкой",
    tag: "Конфликт источника",
    text: "How do I withdraw funds step by step?",
  },
];

function Reference({ refInfo }: { refInfo: Ref }) {
  return (
    <a
      className="reference"
      href={`https://t.me/vikulin_ai/${refInfo.id}`}
      target="_blank"
      rel="noreferrer"
    >
      Пост {refInfo.id} · {refInfo.label}
      <ArrowUpRight size={13} />
    </a>
  );
}
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
  index,
  kicker,
  title,
  description,
  aside,
}: {
  index: string;
  kicker: string;
  title: React.ReactNode;
  description: string;
  aside?: React.ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        <div className="eyebrow">
          <span>{index}</span> / {kicker}
        </div>
        <h1>{title}</h1>
        <p className="intro">{description}</p>
      </div>
      {aside}
    </div>
  );
}
function DocumentDetails({ name, label }: { name: string; label: string }) {
  const [text, setText] = useState("");
  const [open, setOpen] = useState(false);
  return (
    <div className="document-details">
      <button
        className="document-toggle"
        onClick={() => {
          setOpen(!open);
          if (!text)
            api<{ text: string }>(`/documents/${name}`)
              .then((r) => setText(r.text))
              .catch(() => setText("Документ недоступен."));
        }}
      >
        <BookOpen size={17} />
        {label}
        <ChevronDown size={16} className={open ? "rotated" : ""} />
      </button>
      {open && (
        <div className="markdown">
          <ReactMarkdown>{text || "Загрузка…"}</ReactMarkdown>
        </div>
      )}
    </div>
  );
}

export default function App() {
  const [view, setView] = useState<View>("workspace");
  const [health, setHealth] = useState<Health | null>(null);
  const [kb, setKb] = useState<KB | null>(null);
  const [mode, setMode] = useState<"configured" | "demo">("configured");
  const [text, setText] = useState(samples[0].text);
  const [selected, setSelected] = useState(0);
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
        setError(
          "Сервер недоступен. Запустите Python-сервис и обновите страницу.",
        ),
      );
    api<KB>("/kb")
      .then(setKb)
      .catch(() => {});
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
      setToast("Решение сохранено локально. Ответ клиенту не отправлен.");
    } catch (e) {
      setError((e as Error).message);
    }
  }
  const live = mode === "configured" && health?.mode === "live";
  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileNav ? "open" : ""}`}>
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            setView("workspace");
          }}
        >
          <span className="brand-symbol">
            v<span>·</span>
          </span>
          <div>
            VALETAX<span>SUPPORT STUDIO</span>
          </div>
        </a>
        <div className="side-label">ПРОЕКТ / 001</div>
        <nav aria-label="Разделы приложения">
          {nav.map((item, i) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                className={view === item.id ? "nav-item active" : "nav-item"}
                onClick={() => {
                  setView(item.id);
                  setMobileNav(false);
                }}
              >
                <Icon size={18} />
                <span>{item.name}</span>
                <small>{String(i + 1).padStart(2, "0")}</small>
              </button>
            );
          })}
        </nav>
        <div className="side-bottom">
          <div className="phase-label">
            <span className="status-dot" />
            PHASE 1 <span>→</span>
          </div>
          <p>
            Сначала — полезный черновик.
            <br />
            Решение — у человека.
          </p>
          <button className="side-settings" onClick={() => setSettings(true)}>
            <Settings2 size={15} />
            Подключение и границы
            <ArrowUpRight size={14} />
          </button>
        </div>
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
          <div className="breadcrumb">
            Support Studio <ChevronRight size={13} />
            <span>{nav.find((n) => n.id === view)?.name}</span>
          </div>
          <div className="top-actions">
            <span className="local-label">Локальный MVP</span>
            <button
              className={`mode-switch ${live ? "is-live" : ""}`}
              onClick={() => setMode(mode === "demo" ? "configured" : "demo")}
              title="Переключить между моделью и явным демо"
            >
              <span className="status-dot" />
              {live ? "OpenAI · Live" : "Шаблоны · Демо"}
              <ChevronDown size={12} />
            </button>
          </div>
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
              <PageTitle
                index="01"
                kicker="Рабочее место"
                title={
                  <>
                    Меньше рутины.
                    <br />
                    <em>Больше ясности.</em>
                  </>
                }
                description="Разбираем обращение, готовим ответ и показываем, на чём он основан. Последнее слово остаётся у оператора."
                aside={
                  <div className="heading-note">
                    <span className="mono">4 источника / 1 модель</span>
                    <p>
                      Опора на знания.
                      <br />
                      Контроль на каждом шаге.
                    </p>
                    <ShieldCheck size={24} />
                  </div>
                }
              />
              <div className="workspace-grid">
                <section className="ticket-panel">
                  <div className="section-top">
                    <div className="eyebrow">ВХОДЯЩЕЕ ОБРАЩЕНИЕ</div>
                    <span className="mono muted">
                      {selected >= 0
                        ? `EXAMPLE / 0${selected + 1}`
                        : "NEW TICKET"}
                    </span>
                  </div>
                  <label className="sr-only" htmlFor="ticket-text">
                    Текст обращения
                  </label>
                  <textarea
                    id="ticket-text"
                    value={text}
                    maxLength={6000}
                    onChange={(e) => {
                      setText(e.target.value);
                      setSelected(-1);
                      setResult(null);
                      setError("");
                    }}
                    disabled={busy}
                    spellCheck={false}
                  />
                  <div className="input-foot">
                    <span>До 6 000 символов · email и номера маскируются</span>
                    <span className="mono">{text.length}/6000</span>
                  </div>
                  <button
                    className="primary full"
                    disabled={busy || text.trim().length < 3}
                    onClick={process}
                  >
                    {busy ? (
                      <>
                        <Loader2 className="spin" size={18} />
                        Готовим и проверяем…
                      </>
                    ) : (
                      <>
                        Подготовить черновик
                        <ArrowRight size={18} />
                      </>
                    )}
                  </button>
                  <div className="examples">
                    <div className="section-top">
                      <span className="eyebrow">ПРОВЕРИТЬ НА СЦЕНАРИИ</span>
                      <span className="mono muted">06</span>
                    </div>
                    {samples.map((s, i) => (
                      <button
                        key={s.title}
                        className={`example-row ${selected === i ? "selected" : ""}`}
                        onClick={() => {
                          setSelected(i);
                          setText(s.text);
                          setResult(null);
                          setError("");
                        }}
                        disabled={busy}
                      >
                        <span className="example-number">
                          {String(i + 1).padStart(2, "0")}
                        </span>
                        <span>
                          <strong>{s.title}</strong>
                          <small>{s.tag}</small>
                        </span>
                        <ArrowUpRight size={15} />
                      </button>
                    ))}
                  </div>
                </section>
                <section className="answer-panel">
                  {busy ? (
                    <div className="empty-answer">
                      <div className="loading-mark">
                        <Loader2 size={28} className="spin" />
                      </div>
                      <h2>От фактов к черновику.</h2>
                      <p>
                        Модель читает четыре страницы.
                        <br />
                        Сервер проверит структуру, источники и маршрут.
                      </p>
                      <span className="mono muted">
                        Непроверенный ответ не отправляется клиенту
                      </span>
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
                          setToast("Черновик со ссылками скопирован.");
                        } catch {
                          setToast(
                            "Копирование недоступно. Выделите текст вручную.",
                          );
                        }
                      }}
                    />
                  ) : (
                    <div className="empty-answer">
                      <div className="empty-mark">
                        <BookOpen size={30} strokeWidth={1.25} />
                        <span className="empty-cross">+</span>
                      </div>
                      <div className="eyebrow">ОТВЕТ С ДОКАЗАТЕЛЬСТВАМИ</div>
                      <h2>
                        Не просто убедительно.
                        <br />
                        <em>Проверяемо.</em>
                      </h2>
                      <p>
                        Выберите пример или введите обращение.
                        <br />
                        Здесь появятся черновик, источники
                        <br />и причина передачи человеку.
                      </p>
                      <div className="empty-steps">
                        <span>
                          <Check size={14} />
                          Никаких торговых советов
                        </span>
                        <span>
                          <Check size={14} />
                          Никаких решений по KYC / AML
                        </span>
                        <span>
                          <Check size={14} />
                          Никаких выдуманных условий
                        </span>
                      </div>
                    </div>
                  )}
                </section>
              </div>
              <div className="workspace-footer">
                <span>
                  <span className="status-dot" />
                  {live
                    ? "Живой вызов · " + health?.model
                    : "Явное демо · детерминированные шаблоны"}
                </span>
                <span>
                  Решения в памяти этого запуска · без отправки клиенту
                </span>
              </div>
              {history.length > 0 && (
                <section className="history-strip">
                  <div className="section-top">
                    <h3>Последние черновики</h3>
                    <span className="mono muted">ЭТОТ СЕАНС</span>
                  </div>
                  {history.map((r) => (
                    <button
                      key={r.id}
                      className="history-row"
                      onClick={() => {
                        setResult(r);
                        setText(r.ticket);
                        setSelected(-1);
                      }}
                    >
                      <span>{categoryNames[r.output.category]}</span>
                      <p>{r.ticket}</p>
                      <Pill tone={r.review ? "green" : "neutral"}>
                        {r.review
                          ? "Решение сохранено"
                          : dispositionNames[r.output.disposition]}
                      </Pill>
                      <ChevronRight size={16} />
                    </button>
                  ))}
                </section>
              )}
            </>
          )}
          {view === "knowledge" && <KnowledgePage kb={kb} />}
          {view === "architecture" && <ArchitecturePage />}
          {view === "operations" && <OperationsPage />}
          {view === "testing" && <TestingPage onError={setError} />}
          {view === "economy" && <EconomyPage health={health} />}
        </main>
        <footer className="page-footer">
          <span>
            Valetax · Support Studio <span className="muted">/</span> версия 0.1
          </span>
          <span>Решения, источники, ограничения — рядом.</span>
        </footer>
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
            <button
              className="icon-button close"
              aria-label="Закрыть настройки"
              onClick={() => setSettings(false)}
            >
              <X size={20} />
            </button>
            <div className="eyebrow">ПОДКЛЮЧЕНИЕ</div>
            <h2 id="settings-title">Модель за серверной границей.</h2>
            <dl className="settings-list">
              <div>
                <dt>Провайдер</dt>
                <dd>OpenRouter → OpenAI</dd>
              </div>
              <div>
                <dt>Модель</dt>
                <dd className="mono">
                  {health?.model || "openai/gpt-6.1-sol"}
                </dd>
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
                <dt>База</dt>
                <dd className="mono">{health?.kb_version || "Загрузка…"}</dd>
              </div>
            </dl>
            <p>
              Ключ читается из локального <code>.env</code>. Он не передаётся
              интерфейсу. Для изменения модели обновите{" "}
              <code>OPENROUTER_MODEL</code> и перезапустите Python-сервис.
            </p>
            <div className="notice">
              <ShieldCheck size={19} />
              <span>
                Без входа пользователей. Запуск на 127.0.0.1. Черновики и
                решения сохраняются в памяти, а не в ticketing.
              </span>
            </div>
            <button
              className="secondary full"
              onClick={() => {
                setMode("demo");
                setSettings(false);
              }}
            >
              Переключиться на явное демо
            </button>
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
  onReview: (action: string, edited?: string, note?: string) => void;
  onCopy: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [edited, setEdited] = useState(r.output.draft);
  const [note, setNote] = useState("");
  const [tab, setTab] = useState<"evidence" | "trace">("evidence");
  useEffect(() => {
    setEditing(false);
    setEdited(r.output.draft);
    setNote("");
    setTab("evidence");
  }, [r.id]);
  const hasErrors = r.checks.errors.length > 0;
  return (
    <div className="result-content">
      <div className="section-top">
        <span className="eyebrow">РЕЗУЛЬТАТ РАЗБОРА</span>
        <Pill tone={r.trace.mode === "live" ? "green" : "neutral"}>
          {r.trace.mode === "live" ? "LLM · Live" : "Шаблон · Демо"}
        </Pill>
      </div>
      <div className="classification">
        <div>
          <span>Категория</span>
          <strong>{categoryNames[r.output.category]}</strong>
        </div>
        <div>
          <span>Приоритет</span>
          <strong className={r.output.urgency === "high" ? "danger-text" : ""}>
            {
              (
                { low: "Низкий", normal: "Обычный", high: "Высокий" } as Record<
                  string,
                  string
                >
              )[r.output.urgency]
            }
          </strong>
        </div>
        <div>
          <span>Язык</span>
          <strong>{r.output.language.toUpperCase()}</strong>
        </div>
        <div>
          <span>Тональность</span>
          <strong>
            {
              (
                {
                  positive: "Позитивная",
                  neutral: "Нейтральная",
                  negative: "Негативная",
                  mixed: "Смешанная",
                  unknown: "Не определена",
                } as Record<string, string>
              )[r.output.sentiment]
            }
          </strong>
        </div>
      </div>
      <div
        className={`routing-banner ${r.specialist_review_required || hasErrors ? "warning" : ""}`}
      >
        <ShieldCheck size={19} />
        <div>
          <strong>
            {r.specialist_review_required
              ? "Требуется профильный reviewer"
              : "Перед отправкой — проверка оператором"}
          </strong>
          <span>
            Очередь: {queueNames[r.queue]} ·{" "}
            {dispositionNames[r.output.disposition]}
          </span>
        </div>
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
      <div className="draft-heading">
        <span className="eyebrow">ЧЕРНОВИК ДЛЯ КЛИЕНТА</span>
        <button className="text-button" onClick={onCopy}>
          <Copy size={14} />
          Копировать
        </button>
      </div>
      {editing ? (
        <textarea
          className="edit-draft"
          aria-label="Редактировать черновик"
          value={edited}
          onChange={(e) => setEdited(e.target.value)}
        />
      ) : (
        <p className="draft-text">{r.review?.edited_draft || r.output.draft}</p>
      )}
      {r.output.unknowns.length > 0 && (
        <div className="unknowns">
          <span className="eyebrow">ОСТАЛОСЬ НЕИЗВЕСТНЫМ</span>
          {r.output.unknowns.map((u, i) => (
            <p key={i}>
              <span>↳</span>
              {u}
            </p>
          ))}
        </div>
      )}
      <div className="result-tabs" role="tablist">
        <button
          role="tab"
          aria-selected={tab === "evidence"}
          className={tab === "evidence" ? "active" : ""}
          onClick={() => setTab("evidence")}
        >
          Доказательства <span>{r.output.claims.length}</span>
        </button>
        <button
          role="tab"
          aria-selected={tab === "trace"}
          className={tab === "trace" ? "active" : ""}
          onClick={() => setTab("trace")}
        >
          История проверки
        </button>
      </div>
      {tab === "evidence" ? (
        <div className="evidence-list">
          {r.output.claims.length ? (
            r.output.claims.map((c, i) => (
              <div className="evidence-item" key={i}>
                <span className="evidence-number">{i + 1}</span>
                <div>
                  <strong>{c.text}</strong>
                  <blockquote>{c.evidence}</blockquote>
                  <div className="evidence-source">
                    <a
                      href={r.sources.find((s) => s.id === c.source_id)?.url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {r.sources.find((s) => s.id === c.source_id)?.title}
                      <ArrowUpRight size={12} />
                    </a>
                    <span className="mono">{c.chunk_id}</span>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <p className="small muted">
              Нет подтверждённых policy-утверждений. Для отказа или передачи не
              создаём фиктивных цитат.
            </p>
          )}
          <p className="evidence-limit">
            <AlertTriangle size={13} />
            Существование цитаты проверено кодом. Её смысл и полноту ответа
            проверяет человек.
          </p>
        </div>
      ) : (
        <div className="trace-list">
          <div>
            <span>Контекст</span>
            <code>{r.trace.kb_version}</code>
          </div>
          <div>
            <span>Prompt</span>
            <code>{r.trace.prompt_version}</code>
          </div>
          <div>
            <span>Модель</span>
            <code>{r.trace.model}</code>
          </div>
          <div>
            <span>Время до черновика</span>
            <strong>{(r.trace.latency_ms / 1000).toFixed(2)} с</strong>
          </div>
          <div>
            <span>Input / output</span>
            <strong>
              {r.trace.usage
                ? `${r.trace.usage.input_tokens} / ${r.trace.usage.output_tokens}`
                : "Не измерено в демо / при сбое"}
            </strong>
          </div>
          <div>
            <span>Стоимость вызова</span>
            <strong>
              {r.trace.cost_usd !== null
                ? `$${r.trace.cost_usd.toFixed(5)} ${r.trace.cost_basis === "reported" ? "· reported" : "· estimate"}`
                : "Нет данных о расходе"}
            </strong>
          </div>
          <div>
            <span>Маскирование</span>
            <strong>
              {r.trace.redacted
                ? "Явные данные замаскированы"
                : "Совпадений не найдено"}
            </strong>
          </div>
          <p>{r.output.rationale}</p>
        </div>
      )}
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
                      edit: "Сохранена правка оператора",
                      reject: "Черновик отклонён",
                      escalate: "Передача специалисту отмечена",
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
            <label htmlFor="review-note">
              Комментарий к решению <span className="muted">необязательно</span>
            </label>
            <input
              id="review-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Что проверить или уточнить…"
              maxLength={1200}
            />
            <div className="review-actions">
              {r.specialist_review_required || hasErrors ? (
                <button
                  className="primary"
                  onClick={() => onReview("escalate", "", note)}
                >
                  Передать{" "}
                  {r.specialist_review_required ? "специалисту" : "оператору"}
                  <ArrowRight size={16} />
                </button>
              ) : editing ? (
                <button
                  className="primary"
                  disabled={!edited.trim()}
                  onClick={() => onReview("edit", edited, note)}
                >
                  Сохранить правку
                  <Check size={16} />
                </button>
              ) : (
                <button
                  className="primary"
                  onClick={() => onReview("accept", "", note)}
                >
                  Принять черновик
                  <Check size={16} />
                </button>
              )}
              {!r.specialist_review_required && !hasErrors && (
                <button
                  className="secondary"
                  onClick={() => setEditing(!editing)}
                >
                  {editing ? "Отмена" : "Править"}
                </button>
              )}
              <button
                className="text-button"
                onClick={() => onReview("reject", "", note)}
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
      <PageTitle
        index="02"
        kicker="База знаний"
        title={
          <>
            Знания с границами.
            <br />
            <em>Ошибки — тоже данные.</em>
          </>
        }
        description="Четыре разрешённые страницы Valetax. Сохраняем исходные формулировки и явно отмечаем то, чему нельзя доверять без уточнения."
      />
      <div className="knowledge-stats">
        <div>
          <span className="big-number">04</span>
          <span>разрешённых источника</span>
        </div>
        <div>
          <span className="big-number">01</span>
          <span>версия для модели и reviewer</span>
        </div>
        <div>
          <span className="big-number">00</span>
          <span>дописанных нами политик</span>
        </div>
      </div>
      <div className="knowledge-layout">
        <div className="source-nav">
          {kb?.documents.map((d, i) => (
            <button
              className={selected === d.id ? "selected" : ""}
              onClick={() => setSelected(d.id)}
              key={d.id}
            >
              <span className="mono">0{i + 1}</span>
              <div>
                <strong>{d.title}</strong>
                <small>
                  {d.chunks.length} фрагментов · {d.issues.length} замечаний
                </small>
              </div>
              <ChevronRight size={16} />
            </button>
          ))}
          <Reference refInfo={refs.context} />
        </div>
        <section className="source-body">
          {doc ? (
            <>
              <div className="section-top">
                <div>
                  <div className="eyebrow">ИСХОДНЫЙ ДОКУМЕНТ</div>
                  <h2>{doc.title}</h2>
                </div>
                <a
                  className="secondary"
                  href={doc.url}
                  target="_blank"
                  rel="noreferrer"
                >
                  Открыть источник
                  <ExternalLink size={14} />
                </a>
              </div>
              <div className="source-metadata">
                <span>
                  Снимок: {new Date(doc.fetched_at).toLocaleDateString("ru-RU")}
                </span>
                <span className="mono">SHA256 / {doc.sha256.slice(0, 12)}</span>
              </div>
              <div className="source-issues">
                {doc.issues.map((issue) => (
                  <div key={issue.code}>
                    <AlertTriangle size={17} />
                    <section>
                      <strong>{issue.title}</strong>
                      <p>{issue.description}</p>
                    </section>
                  </div>
                ))}
              </div>
              <h3 className="subheading">Фрагменты для проверки</h3>
              <div className="chunks">
                {doc.chunks.map((c) => (
                  <details key={c.id}>
                    <summary>
                      <span className="mono">{c.id}</span>
                      <span>
                        {c.text
                          .split("\n")
                          .find((s, i) => i > 0 && s.endsWith("?")) ||
                          c.text.split("\n")[0]}
                      </span>
                      <Plus size={15} />
                    </summary>
                    <pre>{c.text}</pre>
                  </details>
                ))}
              </div>
              <p className="small muted">{kb?.extraction}</p>
            </>
          ) : (
            <p>Загрузка базы…</p>
          )}
        </section>
      </div>
      <div className="editorial-note">
        <span className="eyebrow">НАШ ВЫВОД</span>
        <p>
          Общий контекст помогает проверять соответствие источнику.
          <br />
          <em>Но не делает ошибочный источник истинным.</em>
        </p>
        <Reference refInfo={refs.common} />
      </div>
    </>
  );
}

function ArchitecturePage() {
  const [stage, setStage] = useState(0);
  const p = pipeline[stage];
  return (
    <>
      <PageTitle
        index="03"
        kicker="Архитектура"
        title={
          <>
            Один маршрут.
            <br />
            <em>Понятные границы.</em>
          </>
        }
        description="Небольшой Python-сервис, React-интерфейс и один вызов модели. Усложняем только то, что действительно мешает качеству или работе оператора."
      />
      <div className="architecture-map">
        <div className="pipeline-steps">
          {pipeline.map((s, i) => (
            <button
              key={s.number}
              className={stage === i ? "selected" : ""}
              onClick={() => setStage(i)}
            >
              <span className="mono">{s.number}</span>
              <strong>{s.name}</strong>
              <span className="stage-line" />
              <ChevronRight size={16} />
            </button>
          ))}
        </div>
        <div className="stage-detail">
          <div className="section-top">
            <span className="stage-number">{p.number}</span>
            <Pill tone="green">{p.status}</Pill>
          </div>
          <h2>{p.name}</h2>
          <p>{p.detail}</p>
          <div className="extension-note">
            <span className="eyebrow">ТОЧКА РАСШИРЕНИЯ</span>
            <p>{p.extension}</p>
          </div>
          <Reference refInfo={p.ref} />
        </div>
      </div>
      <div className="decision-columns">
        <section>
          <span className="eyebrow">ВЫБРАЛИ СЕЙЧАС</span>
          <h3>
            Простой стек,
            <br />
            явная ответственность.
          </h3>
          <ul>
            <li>FastAPI + Pydantic, API-адаптер</li>
            <li>React + Vite, локальные шрифты IBM Plex</li>
            <li>OpenAI через OpenRouter, JSON Schema</li>
            <li>Вся небольшая KB в контексте</li>
            <li>Обязательная проверка человеком</li>
          </ul>
        </section>
        <section>
          <span className="eyebrow">НЕ ДОБАВЛЯЕМ ПО ИНЕРЦИИ</span>
          <h3>
            Сложность должна
            <br />
            заслужить своё место.
          </h3>
          <ul>
            <li>Векторная БД без проблемы поиска</li>
            <li>Автономный агент и write-tools</li>
            <li>Автоматический оптимизатор политик</li>
            <li>Fine-tuning и собственные GPU</li>
            <li>Kubernetes ради текущего объёма</li>
          </ul>
        </section>
      </div>
      <section className="extensions-section">
        <div className="section-top">
          <h2>Где система может вырасти</h2>
          <span className="mono muted">ПО ИЗМЕРЕННОЙ ПРИЧИНЕ</span>
        </div>
        <div className="extension-grid">
          {extensions.map((e, i) => (
            <article key={e.title}>
              <span className="mono muted">0{i + 1} / PLANNED</span>
              <h3>{e.title}</h3>
              <p className="trigger">{e.trigger}</p>
              <p>{e.change}</p>
              <div className="proof">
                <strong>Проверка результата</strong>
                <p>{e.proof}</p>
              </div>
              <Reference refInfo={e.ref} />
            </article>
          ))}
        </div>
      </section>
      <DocumentDetails
        name="plan"
        label="Полная спецификация и журнал решений"
      />
      <DocumentDetails
        name="practices"
        label="Какие рекомендации приняли, с какими не согласились"
      />
    </>
  );
}

function OperationsPage() {
  const [open, setOpen] = useState("01");
  return (
    <>
      <PageTitle
        index="04"
        kicker="Рост и эксплуатация"
        title={
          <>
            Растём по делу.
            <br />
            <em>Готовимся к сбоям.</em>
          </>
        }
        description="Объём тикетов, размер базы и операционные риски растут по-разному. Для каждого изменения нужны свой триггер, решение и проверка."
      />
      <div className="volume-banner">
        <div>
          <span className="eyebrow">ОБЪЁМ ИЗ ЗАДАНИЯ</span>
          <strong>
            10 000<span> / месяц</span>
          </strong>
          <p>≈ 333 в календарный день. Среднее не описывает пики.</p>
        </div>
        <div>
          <span className="eyebrow">ГЛАВНОЕ УЗКОЕ МЕСТО</span>
          <p>
            Не число серверов.
            <br />
            <em>
              Качество контекста, проверка
              <br />и интеграция в процесс.
            </em>
          </p>
        </div>
      </div>
      <div className="roadmap">
        <article>
          <span className="mono">СЕЙЧАС / PHASE 1</span>
          <h3>Локальный co-pilot</h3>
          <p>
            Один процесс, ручной ввод, review, bounded calls. При сбое —
            человек.
          </p>
          <Pill tone="green">Реализовано</Pill>
        </article>
        <ArrowRight size={19} />
        <article>
          <span className="mono">ПОСЛЕ ПИЛОТА</span>
          <h3>В рабочем процессе</h3>
          <p>
            Ticketing adapter, роли, сохранение истории, очереди. Решения
            специалистов по SOP.
          </p>
          <Pill>План</Pill>
        </article>
        <ArrowRight size={19} />
        <article>
          <span className="mono">ПО МЕРЕ РОСТА</span>
          <h3>Управляемый масштаб</h3>
          <p>
            Workers, rate limits, версия KB, поиск и калиброванные guardrails.
          </p>
          <Pill>План</Pill>
        </article>
      </div>
      <Reference refInfo={refs.phases} />
      <div className="section-top risk-heading">
        <h2>Что может пойти не так</h2>
        <span className="mono muted">СИМПТОМ → РЕАКЦИЯ → ПРОВЕРКА</span>
      </div>
      <div className="risk-list">
        {risks.map((r) => (
          <article className={open === r.id ? "expanded" : ""} key={r.id}>
            <button
              className="risk-toggle"
              onClick={() => setOpen(open === r.id ? "" : r.id)}
            >
              <span className="mono">{r.id}</span>
              <h3>{r.title}</h3>
              <Pill tone={r.severity === "Критический" ? "amber" : "neutral"}>
                {r.severity}
              </Pill>
              <Plus size={19} />
            </button>
            {open === r.id && (
              <div className="risk-body">
                <div>
                  <span className="eyebrow">КАК ЗАМЕТИТЬ</span>
                  <p>{r.symptom}</p>
                </div>
                <div>
                  <span className="eyebrow">ЧТО ЕСТЬ СЕЙЧАС</span>
                  <p>{r.now}</p>
                </div>
                <div>
                  <span className="eyebrow">КАК РАЗВИВАТЬ</span>
                  <p>{r.next}</p>
                </div>
                <div className="risk-test">
                  <span className="eyebrow">ПРОВЕРКА</span>
                  <p>{r.test}</p>
                  <Reference refInfo={r.ref} />
                </div>
              </div>
            )}
          </article>
        ))}
      </div>
      <div className="editorial-note">
        <span className="eyebrow">ОГРАНИЧЕНИЕ ПЕРВОЙ ВЕРСИИ</span>
        <p>
          Нет авторизации и долговременного хранения.
          <br />
          <em>Это локальный инструмент, а не production rollout.</em>
        </p>
        <p className="small">
          Для реальных клиентских данных сначала согласовать доступ, хранение,
          передачу провайдеру и роли reviewer.
        </p>
      </div>
    </>
  );
}

function TestingPage({ onError }: { onError: (s: string) => void }) {
  const [data, setData] = useState<{
    reports: EvalReport[];
    cases: EvalCase[];
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState("all");
  const [reportKey, setReportKey] = useState("");
  useEffect(() => {
    api<{ reports: EvalReport[]; cases: EvalCase[] }>("/evaluations")
      .then(setData)
      .catch((e) => onError(e.message));
  }, []);
  const report =
    data?.reports.find((r) => r.run_at === reportKey) ||
    data?.reports.find((r) => r.mode === "live") ||
    data?.reports[0];
  async function run() {
    setBusy(true);
    try {
      const r = await api<EvalReport>("/evaluations/smoke", {});
      setData((d) =>
        d
          ? {
              ...d,
              reports: [
                r,
                ...d.reports.filter(
                  (x) => !(x.mode === r.mode && x.subset === r.subset),
                ),
              ],
            }
          : d,
      );
    } catch (e) {
      onError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageTitle
        index="05"
        kicker="Проверка качества"
        title={
          <>
            Измеряем отдельно.
            <br />
            <em>Улучшаем осознанно.</em>
          </>
        }
        description="Технические проверки, смысл ответа и эффект на работу человека — три разных слоя. Успешный JSON не означает успешный клиентский ответ."
      />
      <div className="testing-head">
        <div>
          <div className="eyebrow">ПОСЛЕДНИЙ ПРОГОН</div>
          <h2>
            {report
              ? `${report.passed} из ${report.total} технических сценариев`
              : "Прогон ещё не выполнен"}
          </h2>
          <p>
            {report
              ? `${report.mode === "live" ? "Живая модель" : "Детерминированные шаблоны"} · ${report.model}`
              : "Запустите smoke-проверку или полный набор из CLI."}
          </p>
        </div>
        <button className="primary" onClick={run} disabled={busy}>
          {busy ? (
            <>
              <Loader2 size={17} className="spin" />
              Проверяем 8 случаев…
            </>
          ) : (
            <>
              <FlaskConical size={17} />
              Прогнать 8 smoke-случаев
            </>
          )}
        </button>
      </div>
      {data && data.reports.length > 1 && (
        <div className="report-picker">
          <label htmlFor="report-select">Показать сохранённый отчёт</label>
          <select
            id="report-select"
            value={report?.run_at || ""}
            onChange={(e) => setReportKey(e.target.value)}
          >
            {data.reports.map((r) => (
              <option key={r.run_at} value={r.run_at}>
                {r.mode === "live" ? "OpenAI Live" : "Demo"} ·{" "}
                {r.subset === "all" ? "полный набор" : "smoke"} · {r.total}{" "}
                случаев · {new Date(r.run_at).toLocaleTimeString("ru-RU")}
              </option>
            ))}
          </select>
        </div>
      )}
      {report && (
        <>
          <div className="eval-stats">
            <div>
              <span>Категории</span>
              <strong>
                {report.category_correct}/{report.total}
              </strong>
            </div>
            <div>
              <span>Маршруты</span>
              <strong>
                {report.route_correct}/{report.total}
              </strong>
            </div>
            <div>
              <span>p95 до черновика</span>
              <strong>{(report.p95_latency_ms / 1000).toFixed(1)} с</strong>
            </div>
            <div>
              <span>Расход вызовов</span>
              <strong>
                {report.mode === "live"
                  ? `$${report.cost_usd.toFixed(3)}${report.cost_complete ? "" : " + неизвестное"}`
                  : "Не измеряется"}
              </strong>
            </div>
          </div>
          <div className="notice">
            <AlertTriangle size={18} />
            <span>
              {report.note}{" "}
              {report.mode === "demo" && "Это не оценка качества OpenAI."}
            </span>
          </div>
        </>
      )}
      <div className="quality-layers">
        <article>
          <span className="mono">01 / АВТОМАТИЧЕСКИ</span>
          <h3>Контракт и инварианты</h3>
          <p>
            Схема, source ID, точная цитата, маршрут, завершение ответа, ошибки
            API. Проверяются кодом и тестами с подставным провайдером.
          </p>
        </article>
        <article>
          <span className="mono">02 / ЧЕЛОВЕКОМ</span>
          <h3>Смысл и полнота</h3>
          <p>
            Все ли факты подтверждены? Не изменены ли сроки и условия? Нет ли
            опасного решения? Пока семантическое качество не измерено.
          </p>
        </article>
        <article>
          <span className="mono">03 / В ПИЛОТЕ</span>
          <h3>Польза в работе</h3>
          <p>
            Время review, принятие и правки, повторные обращения, стоимость
            пригодного ответа. Synthetic-набор не даёт production ROI.
          </p>
        </article>
      </div>
      <div className="section-top">
        <h2>Рубрика хорошего ответа</h2>
        <Reference refInfo={refs.judge} />
      </div>
      <div className="rubric-list">
        {rubric.map((r, i) => (
          <div key={r.name}>
            <span className="mono">0{i + 1}</span>
            <strong>{r.name}</strong>
            <p>{r.question}</p>
            <small>{r.gate}</small>
          </div>
        ))}
      </div>
      <div className="section-top case-heading">
        <div>
          <h2>Корзина проверочных случаев</h2>
          <p className="small muted">
            32 synthetic-сценария · 24 dev / 8 первоначально отложенных. После
            первого разбора holdout считается использованным.
          </p>
        </div>
        <div className="segmented">
          {["all", "dev", "holdout"].map((f) => (
            <button
              key={f}
              className={filter === f ? "active" : ""}
              onClick={() => setFilter(f)}
            >
              {f === "all" ? "Все" : f}
            </button>
          ))}
        </div>
      </div>
      <div className="table-wrap">
        <table className="case-table">
          <thead>
            <tr>
              <th>ID / split</th>
              <th>Сценарий</th>
              <th>Ожидаемый маршрут</th>
              <th>Последний результат</th>
            </tr>
          </thead>
          <tbody>
            {data?.cases
              .filter((c) => filter === "all" || c.split === filter)
              .map((c) => {
                const row = report?.rows.find((r) => r.id === c.id);
                return (
                  <tr key={c.id}>
                    <td>
                      <span className="mono">{c.id}</span>
                      <small>{c.split}</small>
                    </td>
                    <td>
                      <strong>{c.title}</strong>
                      <p>{c.text}</p>
                    </td>
                    <td>
                      {c.expected.queues.map((q) => queueNames[q]).join(" / ")}
                    </td>
                    <td>
                      {row ? (
                        <Pill tone={row.passed ? "green" : "amber"}>
                          {row.passed
                            ? "Тех. проверки пройдены"
                            : "Нужен разбор"}
                        </Pill>
                      ) : (
                        <span className="muted">Не прогонялся</span>
                      )}
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>
      <div className="iteration-note">
        <span className="eyebrow">ЦИКЛ УЛУЧШЕНИЯ</span>
        <h3>Baseline → группа ошибок → одна гипотеза → проверка.</h3>
        <p>
          Не тюним промпт по holdout. Не превращаем ответ сильной модели в gold
          без проверки. Judge калибруется отдельно; критическое нарушение не
          перекрывается средним баллом.
        </p>
        <Reference refInfo={refs.hypotheses} />
      </div>
    </>
  );
}

function EconomyPage({ health }: { health: Health | null }) {
  const [volume, setVolume] = useState(10000);
  const [coverage, setCoverage] = useState(60);
  const [acceptance, setAcceptance] = useState(80);
  const [saved, setSaved] = useState(4);
  const [hour, setHour] = useState(20);
  const [waste, setWaste] = useState(0.5);
  const [maintenance, setMaintenance] = useState(320);
  const [infra, setInfra] = useState(100);
  const [input, setInput] = useState(3200);
  const [output, setOutput] = useState(500);
  const q = coverage / 100,
    a = acceptance / 100;
  const hours = (volume * q * (a * saved - (1 - a) * waste)) / 60;
  const apiCost =
    ((volume *
      (input * (health?.input_price || 2) +
        output * (health?.output_price || 10))) /
      1e6) *
    1.1;
  const opex = apiCost + maintenance + infra;
  const net = hours * hour - opex;
  const fields = [
    {
      label: "Тикетов / месяц",
      value: volume,
      set: setVolume,
      step: 100,
      min: 1,
      max: 1000000,
    },
    {
      label: "Покрытие черновиком, %",
      value: coverage,
      set: setCoverage,
      step: 5,
      min: 0,
      max: 100,
    },
    {
      label: "Пригодных черновиков, %",
      value: acceptance,
      set: setAcceptance,
      step: 5,
      min: 0,
      max: 100,
    },
    {
      label: "Сэкономлено на принятом, мин",
      value: saved,
      set: setSaved,
      step: 0.5,
      min: 0,
      max: 30,
    },
    {
      label: "Потрачено на отвергнутом, мин",
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
      label: "Input tokens / вызов",
      value: input,
      set: setInput,
      step: 100,
      min: 100,
      max: 50000,
    },
    {
      label: "Output tokens / вызов",
      value: output,
      set: setOutput,
      step: 100,
      min: 50,
      max: 10000,
    },
    {
      label: "Инфраструктура / месяц, $",
      value: infra,
      set: setInfra,
      step: 25,
      min: 0,
      max: 10000,
    },
    {
      label: "Сопровождение / месяц, $",
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
  return (
    <>
      <PageTitle
        index="06"
        kicker="Экономика"
        title={
          <>
            Считаем время.
            <br />
            <em>Не впечатления.</em>
          </>
        }
        description="Стоит ли запускать при нашем объёме? Измените допущения и посмотрите, когда проект окупает эксплуатацию — и когда перестаёт."
      />
      <div className="economy-layout">
        <section className="economy-inputs">
          <div className="section-top">
            <h2>Сценарные допущения</h2>
            <button className="text-button" onClick={reset}>
              <RotateCcw size={14} />
              Сбросить
            </button>
          </div>
          <div className="economy-fields">
            {fields.map((f) => (
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
          <p className="small muted">
            Экономия на принятом ответе уже включает проверку и правки.
            Непокрытым тикетам не начисляется экономия. LLM-бюджет включает все
            входящие и 10% резерв.
          </p>
        </section>
        <section className={`economy-result ${net < 0 ? "negative" : ""}`}>
          <div className="eyebrow">ЭКВИВАЛЕНТ ЦЕННОСТИ ВРЕМЕНИ / МЕСЯЦ</div>
          <div className="net-value">
            {net < 0 ? "−" : "+"}$
            {Math.abs(net).toLocaleString("en-US", {
              maximumFractionDigits: 0,
            })}
          </div>
          <p>
            {net >= 0
              ? "При этих допущениях ценность сохранённого времени покрывает эксплуатацию."
              : "При этих допущениях расходы превышают ценность сэкономленного времени."}
          </p>
          <dl>
            <div>
              <dt>Чистое сохранённое время</dt>
              <dd>
                {hours.toLocaleString("ru-RU", { maximumFractionDigits: 1 })} ч
              </dd>
            </div>
            <div>
              <dt>Ценность этого времени</dt>
              <dd>
                $
                {(hours * hour).toLocaleString("en-US", {
                  maximumFractionDigits: 0,
                })}
              </dd>
            </div>
            <div>
              <dt>LLM с резервом</dt>
              <dd>${apiCost.toFixed(2)}</dd>
            </div>
            <div>
              <dt>Инфраструктура + сопровождение</dt>
              <dd>${(infra + maintenance).toFixed(0)}</dd>
            </div>
            <div>
              <dt>Полный monthly OPEX</dt>
              <dd>${opex.toFixed(2)}</dd>
            </div>
          </dl>
          <div className="capacity-note">
            Ценность мощности команды ≠ сокращение зарплатного фонда. Денежный
            эффект требует предотвращённого найма или другого изменения
            процесса.
          </div>
        </section>
      </div>
      <div className="formula">
        <span className="eyebrow">ФОРМУЛА</span>
        <code>N × q × [a × saved − (1 − a) × wasted] / 60</code>
        <p>
          Это часы после вычета времени на отвергнутые черновики. Разовые
          расходы внедрения, дополнительные лицензии и on-call добавить
          отдельно.
        </p>
      </div>
      <div className="decision-columns">
        <section>
          <span className="eyebrow">ПРЕДВАРИТЕЛЬНОЕ РЕШЕНИЕ</span>
          <h3>Ограниченный пилот.</h3>
          <p>
            Сравнить ручную обработку и assisted-режим на сопоставимых темах и
            языках. Измерять active handling time, edit / reject, повторные
            обращения и обязательные маршруты.
          </p>
          <Reference refInfo={refs.money} />
        </section>
        <section>
          <span className="eyebrow">ПРАЙС И РЕАЛЬНЫЙ РАСХОД</span>
          <h3>Сценарий — не счёт.</h3>
          <p>
            Тарифы из серверных настроек: ${health?.input_price || 2} input / $
            {health?.output_price || 10} output за 1M токенов. При смене модели
            пересчитать. В живом trace отдельно показывается reported cost, если
            его вернул OpenRouter.
          </p>
          <a
            className="reference"
            href="https://openrouter.ai/openai/gpt-6.1-sol"
            target="_blank"
            rel="noreferrer"
          >
            Модель и тариф OpenRouter
            <ArrowUpRight size={13} />
          </a>
        </section>
      </div>
      <div className="editorial-note">
        <span className="eyebrow">ЧЕГО МЫ ПОКА НЕ ЗНАЕМ</span>
        <p>
          Реальные AHT, acceptance и покрытие.
          <br />
          <em>Модель может помочь — или добавить работу.</em>
        </p>
        <Reference refInfo={refs.human} />
      </div>
      <DocumentDetails
        name="economy"
        label="Исходный business case: формулы и чувствительность"
      />
    </>
  );
}
