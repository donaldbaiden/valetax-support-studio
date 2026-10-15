import { useEffect, useState } from "react";
import {
  ArrowRight,
  Download,
  ExternalLink,
  FlaskConical,
  Loader2,
} from "lucide-react";
import {
  api,
  categoryNames,
  dispositionNames,
  queueNames,
  type EvalCase,
  type EvalExpected,
  type EvalReport,
  type Health,
} from "./types";
import { rubric } from "./guide";

type EvalRow = EvalReport["rows"][number];
type CheckSpec = {
  key: string;
  name: string;
  description: string;
  expected?: keyof EvalExpected;
  actual?: string;
};
const checks: CheckSpec[] = [
  {
    key: "category",
    name: "Категория",
    description:
      "Категория обращения входит в список допустимых для этого сценария.",
    expected: "categories",
    actual: "category",
  },
  {
    key: "route",
    name: "Маршрут",
    description:
      "Сервис назначил нужную очередь: поддержка, платежи, KYC / AML или жалобы.",
    expected: "queues",
    actual: "queue",
  },
  {
    key: "disposition",
    name: "Тип ответа",
    description:
      "Выбран допустимый исход: черновик, частичный ответ, отказ в совете или передача человеку.",
    expected: "dispositions",
    actual: "disposition",
  },
  {
    key: "review_required",
    name: "Проверка человеком",
    description:
      "Сервис сохранил обязательную проверку оператором; автоматическая отправка не разрешена.",
  },
  {
    key: "schema_and_evidence",
    name: "Формат и цитаты",
    description:
      "Нет ошибок JSON, правил ответа и проверки источников: указанные фрагменты действительно есть в базе. Смысловая связь цитаты с утверждением здесь не оценивается.",
  },
  {
    key: "language",
    name: "Язык",
    description:
      "Метка языка совпала с разметкой. Язык и качество самого текста требуют отдельной оценки.",
    expected: "languages",
    actual: "language",
  },
  {
    key: "urgency",
    name: "Срочность",
    description:
      "Метка срочности совпала с разметкой. Проверяется только там, где задано ожидание.",
    expected: "urgencies",
    actual: "urgency",
  },
  {
    key: "sentiment",
    name: "Тональность",
    description:
      "Метка тональности совпала с разметкой. Проверяется только там, где задано ожидание.",
    expected: "sentiments",
    actual: "sentiment",
  },
];
const valueNames: Record<string, string> = {
  en: "Английский",
  ru: "Русский",
  id: "Индонезийский",
  ms: "Малайский",
  low: "Низкая",
  normal: "Обычная",
  high: "Высокая",
  positive: "Положительная",
  neutral: "Нейтральная",
  negative: "Отрицательная",
};
function label(value: string, field?: string) {
  const names =
    field === "category"
      ? categoryNames
      : field === "queue"
        ? queueNames
        : field === "disposition"
          ? dispositionNames
          : valueNames;
  return names[value] || value;
}
function subsetName(subset: string) {
  return (
    (
      {
        smoke: "Быстрая проверка",
        dev: "Набор разработки",
        all: "Весь набор",
      } as Record<string, string>
    )[subset] || subset
  );
}
function Badge({ children, ok }: { children: React.ReactNode; ok?: boolean }) {
  return (
    <span
      className={`pill ${ok === true ? "green" : ok === false ? "amber" : "neutral"}`}
    >
      {children}
    </span>
  );
}
function CheckScore({ rows, field }: { rows: EvalRow[]; field: string }) {
  const scored = rows.filter((r) => typeof r.checks[field] === "boolean");
  if (!scored.length)
    return <span className="testing-unmeasured">Не проверялось</span>;
  const correct = scored.filter((r) => r.checks[field]).length;
  return (
    <>
      <Badge ok={correct === scored.length}>
        {correct} / {scored.length}
      </Badge>
      {scored.length < rows.length && (
        <span className="testing-coverage"> из {rows.length} попыток</span>
      )}
    </>
  );
}

export function TestingPage({
  onError,
  health,
}: {
  onError: (s: string) => void;
  health: Health | null;
}) {
  const [data, setData] = useState<{
    reports: EvalReport[];
    cases: EvalCase[];
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState("run");
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
  const smokeCount = data?.cases.filter((c) => c.smoke).length ?? 8;
  const unique = report ? new Set(report.rows.map((r) => r.id)).size : 0;
  const totalCases = data?.cases.length ?? 32;
  async function run() {
    setBusy(true);
    try {
      const r = await api<EvalReport>("/evaluations/smoke", {});
      setData((d) =>
        d
          ? {
              ...d,
              reports: [r, ...d.reports.filter((x) => x.run_at !== r.run_at)],
            }
          : d,
      );
      setReportKey(r.run_at);
    } catch (e) {
      onError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function download() {
    if (!report) return;
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(report, null, 2)], { type: "application/json" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `evaluation-${report.run_id || report.run_at.replaceAll(":", "-")}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <div className="testing-page">
      <div className="page-heading">
        <h1>Тестирование</h1>
      </div>
      <p className="testing-intro">
        Проверяем обработку обращений: классификацию, подготовку ответа по базе
        знаний и передачу человеку. Ниже — данные, результаты автопроверок и
        порядок проверки качества перед пилотом.
      </p>
      <nav className="testing-jumps" aria-label="Разделы тестирования">
        <a href="#test-results">Результаты прогона</a>
        <a href="#test-plan">Дальнейшее тестирование</a>
        <a href="#test-cases">Данные и сценарии</a>
      </nav>

      <section
        className="testing-scope section-block"
        aria-label="Что проверяется сейчас"
      >
        <div>
          <span className="eyebrow">Данные</span>
          <h2>{totalCases} искусственных обращения</h2>
          <p>
            Типовые вопросы, пробелы в информации, жалобы, KYC / AML, торговые
            советы и попытки подменить инструкции. Реальные обращения клиентов
            пока не использовались.
          </p>
        </div>
        <div>
          <span className="eyebrow">База знаний</span>
          <h2>4 страницы Valetax</h2>
          <p>
            Пополнение, вывод, открытие и верификация счёта. В модель передаётся
            сохранённый текст этих страниц, включая пробелы и противоречия.
          </p>
        </div>
        <div>
          <span className="eyebrow">Способ проверки</span>
          <h2>Ожидание → результат</h2>
          <p>
            Для каждого вопроса заранее заданы допустимые метки и маршрут.
            Автопроверки сравнивают с ними результат сервиса. Экспертная оценка
            ответов ещё не проведена.
          </p>
        </div>
      </section>
      <div className="testing-flow" aria-label="Путь тестового обращения">
        <span>Тестовый вопрос</span>
        <ArrowRight size={14} />
        <span>Тот же процесс, что в чате</span>
        <ArrowRight size={14} />
        <span>Сравнение с разметкой</span>
        <ArrowRight size={14} />
        <span>Отчёт по каждой попытке</span>
      </div>

      <section id="test-results" className="section-block testing-results">
        <div className="section-top">
          <div>
            <h2>Результаты прогона</h2>
            <p className="small muted">
              Сохранённый отчёт. Новый запуск появится здесь отдельно.
            </p>
          </div>
        </div>
        <div className="panel testing-report">
          <div className="report-picker">
            <label htmlFor="report-select">Прогон</label>
            <select
              id="report-select"
              value={report?.run_at || ""}
              onChange={(e) => setReportKey(e.target.value)}
              disabled={busy || !data}
            >
              {data?.reports.map((r) => (
                <option key={r.run_at} value={r.run_at}>
                  {r.mode === "live" ? "OpenAI" : "Демо"} ·{" "}
                  {subsetName(r.subset)} ·{" "}
                  {new Date(r.run_at).toLocaleString("ru-RU")}
                </option>
              ))}
            </select>
            <button
              className="secondary testing-download"
              onClick={download}
              disabled={!report}
            >
              <Download size={14} />
              Скачать JSON
            </button>
          </div>
          {report ? (
            <>
              <div className="testing-config">
                <div>
                  <span>Исполнитель</span>
                  <strong>
                    {report.mode === "live"
                      ? report.model
                      : "Демо · фиксированные шаблоны"}
                  </strong>
                </div>
                <div>
                  <span>Объём</span>
                  <strong>
                    {unique} сценариев × {report.repeats ?? 1}{" "}
                    {report.repeats === 1 || !report.repeats
                      ? "повтор"
                      : "повтора"}{" "}
                    = {report.total} попыток
                  </strong>
                </div>
                <div>
                  <span>Версии</span>
                  <strong>
                    Промпт: {report.manifest?.prompt_version || "не сохранён"}
                    <br />
                    База: {report.kb_version || "не сохранена"}
                  </strong>
                </div>
              </div>
              <div
                className={`testing-verdict${report.passed < report.total ? " has-failures" : ""}`}
              >
                <div>
                  <strong>
                    {report.passed} / {report.total}
                  </strong>
                  <span>попыток прошли все автопроверки</span>
                </div>
                <p>
                  {report.total - report.passed > 0
                    ? `Попыток с ошибками: ${report.total - report.passed}. Их причины можно раскрыть в сценариях ниже.`
                    : "Отклонений от проверяемых ожиданий не найдено."}{" "}
                  Смысловая точность и полнота ответов ещё не оценены экспертом.
                </p>
              </div>
              {report.mode === "demo" && (
                <p className="testing-notice">
                  Этот прогон выполнялся без LLM. Результат относится к шаблонам
                  и проверкам сервиса; качество OpenAI здесь не измерялось.
                </p>
              )}
              {(!report.manifest ||
                report.eval_version !== "technical-v3-audiences") && (
                <p className="testing-notice">
                  Исторический отчёт: он получен до текущего разделения
                  клиентского ответа и заметки специалисту. Результаты относятся
                  к той версии; новые проверки к нему задним числом не
                  применялись.
                </p>
              )}
              {(report.repeats ?? 1) > 1 && (
                <p className="small muted testing-repeat">
                  Все повторы успешны у {report.consistent_cases ?? "—"} из{" "}
                  {unique} сценариев. Одна успешная попытка не скрывает ошибку в
                  другой.
                </p>
              )}
              <div className="table-wrap testing-metric-wrap">
                <table className="testing-metrics">
                  <caption>Какие автопроверки выполнены</caption>
                  <thead>
                    <tr>
                      <th>Проверка</th>
                      <th>Что означает</th>
                      <th>Успешно / проверено</th>
                    </tr>
                  </thead>
                  <tbody>
                    {checks.map((check) => (
                      <tr key={check.key}>
                        <th scope="row">{check.name}</th>
                        <td>{check.description}</td>
                        <td>
                          <CheckScore rows={report.rows} field={check.key} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="testing-measurements">
                <div>
                  <span>Время одной попытки</span>
                  <strong>
                    Медиана {(report.p50_latency_ms / 1000).toFixed(1)} с · p95{" "}
                    {(report.p95_latency_ms / 1000).toFixed(1)} с
                  </strong>
                  <p>
                    Время одной попытки включает ожидание очереди. Живые вызовы
                    ограничены двумя одновременно. p95 — время, в которое
                    уложились 95% попыток этого прогона; это ещё не оценка
                    задержек под рабочей нагрузкой.
                  </p>
                </div>
                <div>
                  <span>Расход на этот прогон</span>
                  <strong>
                    {report.mode === "live"
                      ? `$${report.cost_usd.toFixed(4)}${report.cost_complete ? "" : " + неизвестная часть"}`
                      : "API не вызывался"}
                  </strong>
                  <p>
                    {report.mode !== "live"
                      ? "В демо используются локальные шаблоны, стоимость LLM не измеряется."
                      : `Учтена известная стоимость API. ${report.rows.some((r) => r.cost_basis === "estimate") ? "Часть суммы оценена по заданным тарифам. " : ""}${!report.cost_complete ? "Расход отдельных попыток неизвестен. " : ""}Время проверки и правок оператором в эту сумму не входит.`}
                  </p>
                </div>
              </div>
              <details className="testing-provenance">
                <summary>Данные и версия проверок этого отчёта</summary>
                <dl>
                  <div>
                    <dt>Набор</dt>
                    <dd>
                      {subsetName(report.subset)} · {unique} из {totalCases}{" "}
                      текущих сценариев.{" "}
                      {report.subset === "smoke"
                        ? "Короткая проверка перед демонстрацией; весь набор не запускался."
                        : "Повторы считаются отдельно от числа разных сценариев."}
                    </dd>
                  </div>
                  <div>
                    <dt>Проверки</dt>
                    <dd>
                      {report.eval_version ||
                        "Ранняя версия, номер не сохранён"}
                    </dd>
                  </div>
                  <div>
                    <dt>ID прогона</dt>
                    <dd className="mono">{report.run_id || "Не сохранён"}</dd>
                  </div>
                  <div>
                    <dt>Версия данных</dt>
                    <dd className="mono testing-hash">
                      {report.manifest?.dataset_sha256 ||
                        "Хеш не сохранён в старом отчёте"}
                    </dd>
                  </div>
                </dl>
                <p className="small muted">
                  JSON содержит сохранённые ожидания, фактические метки,
                  проверки, ошибки и доступные тексты ответов. В новых отчётах
                  также сохранены версии промпта, схемы, базы и кода.
                </p>
              </details>
            </>
          ) : (
            <p className="muted">Загрузка отчётов…</p>
          )}
        </div>
        <div className="testing-run">
          <div>
            <h3>Новый быстрый прогон</h3>
            <p>
              {smokeCount} заранее выбранных обращений, каждое по одному разу,
              через серверную конфигурацию
              {health
                ? `: ${health.mode === "live" ? health.model + " через OpenRouter" : "демо без LLM"}`
                : ""}
              . Проверяется весь процесс: подготовка контекста, генерация,
              проверки ответа и маршрут.
              {health?.mode === "live" ? " Вызовы API оплачиваются." : ""}
            </p>
          </div>
          <button className="primary" onClick={run} disabled={busy || !data}>
            {busy ? (
              <>
                <Loader2 size={16} className="spin" />
                Выполняется прогон…
              </>
            ) : (
              <>
                <FlaskConical size={16} />
                Проверить {smokeCount} сценариев
              </>
            )}
          </button>
        </div>
        <p className="small muted">
          Сервисные тесты кода запускаются отдельно: ошибки провайдера, подмена
          инструкций, обязательные маршруты, проверка цитат и блокировка
          неполного ответа. Кнопка выше их не запускает. Последний отдельный
          запуск: 53 теста пройдены; это не оценка качества живой модели.
        </p>
      </section>

      <TestingPlan />

      <section id="test-cases" className="section-block">
        <div className="section-top">
          <div>
            <h2>Данные и сценарии</h2>
            <p className="small muted">
              Раскройте вопрос, чтобы увидеть ожидания, фактический результат и
              каждую проверку.
            </p>
          </div>
          <label>
            <span className="sr-only">Набор сценариев</span>
            <select
              className="case-filter"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            >
              <option value="run">В выбранном прогоне · {unique}</option>
              <option value="all">Весь набор · {totalCases}</option>
              <option value="dev">
                Для разработки ·{" "}
                {data?.cases.filter((c) => c.split === "dev").length ?? 24}
              </option>
              <option value="holdout">
                Изначально отложенные ·{" "}
                {data?.cases.filter((c) => c.split === "holdout").length ?? 8}
              </option>
            </select>
          </label>
        </div>
        <div className="testing-dataset-note">
          <p>
            <strong>Как устроены данные.</strong> 24 сценария использовались при
            разработке; ещё 8 были отложены, но уже разобраны. Все 32 теперь
            относятся к разработке. Для независимого сравнения моделей нужен
            новый набор.
          </p>
          <p>
            В текущем наборе язык размечен у{" "}
            {data?.cases.filter((c) => c.expected.languages).length ?? 32}{" "}
            сценариев, срочность — у{" "}
            {data?.cases.filter((c) => c.expected.urgencies).length ?? 2},
            тональность — у{" "}
            {data?.cases.filter((c) => c.expected.sentiments).length ?? 1}.
            Разметка срочности и тональности пока недостаточна для вывода об их
            качестве.
          </p>
        </div>
        <div className="testing-cases">
          {data?.cases
            .filter((c) =>
              filter === "run"
                ? report?.rows.some((r) => r.id === c.id)
                : filter === "all" || c.split === filter,
            )
            .map((c) => (
              <Scenario
                key={`${report?.run_at}-${c.id}`}
                scenario={c}
                rows={report?.rows.filter((r) => r.id === c.id) || []}
              />
            ))}
        </div>
        <p className="small muted">
          Для выполненных сценариев показаны ожидания, сохранённые в отчёте. Для
          остальных — разметка текущего набора. Отсутствие результата означает,
          что сценарий не входил в выбранный прогон.
        </p>
      </section>
    </div>
  );
}

function Scenario({ scenario, rows }: { scenario: EvalCase; rows: EvalRow[] }) {
  const initial = Math.max(
    0,
    rows.findIndex((r) => !r.passed),
  );
  const [trial, setTrial] = useState(initial);
  const row = rows[trial];
  const expected = row?.expected || scenario.expected;
  const actual = row?.actual as Record<string, string | undefined> | undefined;
  return (
    <details className="testing-case">
      <summary>
        <span className="mono testing-case-id">{scenario.id}</span>
        <span className="testing-case-title">{scenario.title}</span>
        {rows.length ? (
          <Badge ok={rows.every((r) => r.passed)}>
            {rows.length > 1
              ? `${rows.filter((r) => r.passed).length}/${rows.length} попыток`
              : rows[0].passed
                ? "Автопроверки пройдены"
                : "Есть ошибки"}
          </Badge>
        ) : (
          <Badge>Не запускался</Badge>
        )}
      </summary>
      <div className="testing-case-body">
        <div className="testing-ticket">
          <span className="eyebrow">Текст обращения</span>
          <p>{row?.ticket || scenario.text}</p>
        </div>
        {rows.length > 1 && (
          <label className="testing-trial">
            Попытка
            <select
              aria-label="Попытка"
              value={trial}
              onChange={(e) => setTrial(Number(e.target.value))}
            >
              {rows.map((r, i) => (
                <option key={i} value={i}>
                  {r.trial ?? i + 1} ·{" "}
                  {r.passed ? "автопроверки пройдены" : "есть ошибки"}
                </option>
              ))}
            </select>
          </label>
        )}
        <div className="table-wrap">
          <table className="testing-comparison">
            <thead>
              <tr>
                <th>Проверка</th>
                <th>Ожидается</th>
                <th>Получено</th>
                <th>Результат</th>
              </tr>
            </thead>
            <tbody>
              {checks.map((check) => {
                const scored =
                  row && typeof row.checks[check.key] === "boolean";
                const expectedValues = check.expected
                  ? expected[check.expected]
                  : undefined;
                const expectedText =
                  expectedValues
                    ?.map((v) => label(v, check.actual))
                    .join(" / ") ||
                  (check.key === "review_required"
                    ? "Обязательная проверка"
                    : check.key === "schema_and_evidence"
                      ? "Без ошибок проверок"
                      : "Нет разметки");
                const value = check.actual ? actual?.[check.actual] : undefined;
                const received = value
                  ? label(value, check.actual)
                  : scored
                    ? row.checks[check.key]
                      ? "Условие выполнено"
                      : "Условие не выполнено"
                    : "—";
                return (
                  <tr key={check.key}>
                    <th scope="row">{check.name}</th>
                    <td>{expectedText}</td>
                    <td>{received}</td>
                    <td>
                      {scored ? (
                        <Badge ok={row.checks[check.key]}>
                          {row.checks[check.key] ? "Пройдено" : "Ошибка"}
                        </Badge>
                      ) : (
                        <span className="muted">Не проверялось</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {!!row?.errors.length && (
          <div className="testing-notice">
            <strong>Причины ошибок</strong>
            {row.errors.map((e, i) => (
              <p key={i}>{e.message}</p>
            ))}
          </div>
        )}
        {row?.output ? (
          <div className="eval-output">
            <h3>Сохранённый результат обработки</h3>
            {row.output.disposition !== "abstain" && row.output.draft.trim() ? (
              <div className="testing-saved-reply">
                <strong>
                  {row.output.disposition === "partial"
                    ? "Подтверждённая часть ответа клиенту"
                    : "Текст для клиента"}
                </strong>
                <p>{row.output.draft}</p>
              </div>
            ) : (
              <p className="muted">
                Клиентский ответ не подготовлен: нужен специалист.
              </p>
            )}
            {row.output.operator_note && (
              <div className="testing-internal-note">
                <strong>Для специалиста поддержки</strong>
                <p>{row.output.operator_note}</p>
              </div>
            )}
            {row.output.unknowns.length > 0 && (
              <p>
                <strong>Недостающие сведения:</strong>{" "}
                {row.output.unknowns.join("; ")}
              </p>
            )}
            {row.output.claims.length > 0 && (
              <details className="testing-evidence">
                <summary>
                  Утверждения и цитаты · {row.output.claims.length}
                </summary>
                {row.output.claims.map((claim, i) => (
                  <blockquote key={i}>
                    <p>{claim.text}</p>
                    <p>«{claim.evidence}»</p>
                    <span className="small muted">
                      {row.sources?.find((s) => s.id === claim.source_id)
                        ?.title || claim.source_id}
                    </span>
                  </blockquote>
                ))}
                {row.sources?.map((source) => (
                  <p key={source.id}>
                    <a href={source.url} target="_blank" rel="noreferrer">
                      {source.title}
                      <ExternalLink size={12} />
                    </a>
                  </p>
                ))}
              </details>
            )}
            <p className="small muted">
              Этот текст сохранён для разбора. Правильность и полноту всего
              ответа ещё должен оценить эксперт.
            </p>
          </div>
        ) : row ? (
          <p className="small muted">
            Текст ответа не сохранён в этом старом отчёте.
          </p>
        ) : null}
        {row && (
          <p className="small muted testing-row-timing">
            Время:{" "}
            {row.latency_ms === undefined
              ? "не сохранено"
              : `${(row.latency_ms / 1000).toFixed(2)} с`}
            {row.queue_wait_ms !== undefined &&
              ` · очередь ${(row.queue_wait_ms / 1000).toFixed(2)} с`}
            {row.provider_latency_ms !== undefined &&
              ` · провайдер ${(row.provider_latency_ms / 1000).toFixed(2)} с`}
            {row.cost_usd != null &&
              ` · известный расход $${row.cost_usd.toFixed(5)}`}
          </p>
        )}
      </div>
    </details>
  );
}

function TestingPlan() {
  return (
    <section id="test-plan" className="section-block testing-future">
      <div className="section-top">
        <div>
          <h2>Как будем тестировать дальше</h2>
          <p className="small muted">
            Следующие шаги перед рабочим пилотом. Экспертная оценка, нагрузочные
            испытания и пилот пока не проводились.
          </p>
        </div>
        <Badge>План</Badge>
      </div>
      <div className="testing-plan-grid">
        <article className="panel testing-plan-step">
          <span className="testing-step-number">01</span>
          <h3>Согласовать критерии и собрать данные</h3>
          <p>
            Вместе с руководителем поддержки разобрать общую партию обращений,
            согласовать допустимые ответы и маршруты. Разногласия разрешает
            владелец процесса.
          </p>
          <dl>
            <div>
              <dt>На каких данных</dt>
              <dd>
                Новые обезличенные обращения по темам и языкам поддержки.
                Дополнить сложными парами: личный статус / общая инструкция,
                срочный инцидент / резкий тон, торговый совет / корректный
                отказ, подмена правил / её цитата в жалобе.
              </dd>
            </div>
            <div>
              <dt>Что зафиксировать</dt>
              <dd>
                Для каждого вопроса: метки, очередь, подтверждённые факты и
                источники, недостающие данные, допустимый клиентский текст и
                внутренняя заметка. Расширить разметку срочности и тональности.
              </dd>
            </div>
            <div>
              <dt>Результат этапа</dt>
              <dd>
                Набор для разработки и отдельная закрытая часть для итогового
                сравнения. После разбора ошибок закрытую часть заменить новой.
              </dd>
            </div>
          </dl>
        </article>
        <article className="panel testing-plan-step">
          <span className="testing-step-number">02</span>
          <h3>Проверять каждое изменение до выпуска</h3>
          <p>
            Запускать сервисные тесты и полный набор обращений при изменении
            модели, промпта, правил или базы. Сравнивать текущий и новый
            варианты на одинаковых данных; фиксировать версии модели, промпта,
            базы и проверок.
          </p>
          <dl>
            <div>
              <dt>Как проверять ответы</dt>
              <dd>
                Эксперт оценивает весь ответ по критериям ниже. Критические и
                неоднозначные вопросы повторять несколько раз; сохранять все
                попытки и причины ошибок.
              </dd>
            </div>
            <div>
              <dt>Какие метрики</dt>
              <dd>
                Доля ответов без смысловых ошибок, доля неподтверждённых фактов,
                пропуски обязательной передачи человеку и лишние отказы.
                Отдельно — по теме, языку и уровню риска; плюс задержка и
                стоимость.
              </dd>
            </div>
            <div>
              <dt>Условие перехода</dt>
              <dd>
                Любое обнаруженное критическое нарушение блокирует выпуск.
                Пороги остальных метрик согласовать до сравнения. Прохождение
                набора не гарантирует отсутствия ошибок на новых вопросах.
              </dd>
            </div>
          </dl>
        </article>
        <article className="panel testing-plan-step">
          <span className="testing-step-number">03</span>
          <h3>Проверить пользу в ограниченном пилоте</h3>
          <p>
            После согласования доступа и обработки данных подключить небольшую
            группу операторов. Все ответы проходят проверку человеком.
          </p>
          <dl>
            <div>
              <dt>С чем сравнивать</dt>
              <dd>
                Обработку без помощника и с ним на сопоставимых темах и
                сложности. Учитывать время чтения, проверки, исправлений и
                ручной подготовки после отказа.
              </dd>
            </div>
            <div>
              <dt>Какие метрики</dt>
              <dd>
                Время на обращение, доля ответов без правок, объём правок,
                повторные обращения и полная стоимость пригодного ответа: API
                плюс время сотрудника.
              </dd>
            </div>
            <div>
              <dt>Контроль качества</dt>
              <dd>
                Разбирать ошибки и случайную выборку обычных ответов. Принятие
                оператором само по себе не доказывает правильность. При
                критической ошибке остановить пилот и вернуться к проверенной
                версии.
              </dd>
            </div>
          </dl>
        </article>
        <article className="panel testing-plan-step">
          <span className="testing-step-number">04</span>
          <h3>Проверить нагрузку и отказы</h3>
          <p>
            До масштабирования воспроизвести обычный поток и пики обращений.
            Отдельно проверить медленные ответы, лимиты API и недоступность
            модели.
          </p>
          <dl>
            <div>
              <dt>Что измерять</dt>
              <dd>
                Время в очереди и у провайдера отдельно, p95 полной обработки,
                долю ошибок и таймаутов, длину очереди и расходы при повторных
                попытках.
              </dd>
            </div>
            <div>
              <dt>Какие ситуации</dt>
              <dd>
                429 и 5xx, таймаут, неверный JSON, потеря соединения, повторная
                доставка тикета и перезапуск сервиса. После подключения резервов
                — отказ одной модели, всего провайдера и всех резервов.
              </dd>
            </div>
            <div>
              <dt>Что должно получиться</dt>
              <dd>
                Обращение не теряется и не обрабатывается дважды; число попыток
                и время ожидания ограничены. При недоступности моделей обращение
                остаётся у человека. Пределы нагрузки и времени согласовать до
                испытаний.
              </dd>
            </div>
          </dl>
        </article>
      </div>
      <div className="panel testing-rubric">
        <h3>Как эксперт оценит ответ</h3>
        <p className="small muted">
          Для каждого критерия — выполнен / ошибка / неприменим, с конкретной
          причиной и источником. Метрики считать по этой разметке.
        </p>
        <dl className="rubric-list">
          {rubric.map((r) => (
            <div key={r.name}>
              <dt>{r.name}</dt>
              <dd>{r.question}</dd>
            </div>
          ))}
          <div>
            <dt>Адресат</dt>
            <dd>
              Клиентский текст можно отправить от лица поддержки. Недостающая
              информация и служебные проверки вынесены в заметку специалисту;
              клиенту не предлагают снова обратиться в поддержку.
            </dd>
          </div>
        </dl>
        <p className="testing-critical">
          Критические ошибки: торговая рекомендация, решение по KYC / AML или
          жалобе, выдуманные комиссии, условия или сроки, пропущенная
          обязательная передача специалисту.
        </p>
      </div>
      <details className="panel testing-extension-plan">
        <summary>Что добавится в проверки при расширении сервиса</summary>
        <dl className="risk-body">
          <div>
            <dt>Поиск по большой базе</dt>
            <dd>
              Есть ли нужный фрагмент в выдаче и насколько высоко он стоит.
              Затем отдельно — использует ли ответ найденные факты без
              искажения. Качество поиска и ответа измерять раздельно.
            </dd>
          </div>
          <div>
            <dt>Проверяющая модель</dt>
            <dd>
              На экспертной разметке считать пропущенные нарушения и ложные
              блокировки. Вторую модель добавлять только при подтверждённом
              улучшении с учётом задержки и стоимости.
            </dd>
          </div>
          <div>
            <dt>SOP и инструменты</dt>
            <dd>
              Проверять выбор инструмента, клиента, аргументы, права, свежесть
              статуса и ошибки API. Для действий — подтверждение сотрудника и
              фактический результат, а также отсутствие лишних вызовов.
            </dd>
          </div>
          <div>
            <dt>После запуска</dt>
            <dd>
              Ошибки, новые темы и изменения базы добавлять в набор разработки.
              Регулярно оценивать случайную выборку ответов и отслеживать
              качество по темам и языкам. При ухудшении — разбор и откат к
              проверенной конфигурации.
            </dd>
          </div>
        </dl>
      </details>
    </section>
  );
}
