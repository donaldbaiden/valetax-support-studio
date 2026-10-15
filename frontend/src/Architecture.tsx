import { useId, useState } from "react";
import {
  architectureScenarios,
  failoverDiagram,
  type ProcessDiagram,
} from "./architectureData";
import { extensions } from "./guide";

function wrapHint(text: string, width: number) {
  const limit = Math.floor((width - 18) / 5.7);
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(" ")) {
    if (line && (line + " " + word).length > limit) {
      lines.push(line);
      line = word;
    } else line = line ? line + " " + word : word;
  }
  if (line) lines.push(line);
  return lines;
}

export function Diagram({
  diagram,
  initialNode,
}: {
  diagram: ProcessDiagram;
  initialNode: string;
}) {
  const [selected, setSelected] = useState(initialNode);
  const active =
    diagram.nodes.find((n) => n.id === selected) || diagram.nodes[0];
  const uid = useId().replace(/:/g, "");
  const arrow = `arrow-${uid}`,
    warningArrow = `warning-arrow-${uid}`;
  return (
    <>
      <div
        className="diagram-scroll"
        tabIndex={0}
        aria-label={`Схема: ${diagram.title}`}
      >
        <svg
          className="process-diagram"
          viewBox={`0 0 ${diagram.width} ${diagram.height}`}
          role="group"
          aria-label={diagram.title}
        >
          <desc>{diagram.description}</desc>
          <defs>
            <marker
              id={arrow}
              markerWidth="8"
              markerHeight="8"
              refX="7"
              refY="4"
              orient="auto"
              markerUnits="userSpaceOnUse"
            >
              <path d="M0 0 L8 4 L0 8 Z" fill="#789080" />
            </marker>
            <marker
              id={warningArrow}
              markerWidth="8"
              markerHeight="8"
              refX="7"
              refY="4"
              orient="auto"
              markerUnits="userSpaceOnUse"
            >
              <path d="M0 0 L8 4 L0 8 Z" fill="#b18755" />
            </marker>
          </defs>
          {diagram.groups?.map((g) => (
            <g key={g.title} aria-hidden="true">
              <rect
                className="diagram-group"
                x={g.x}
                y={g.y}
                width={g.width}
                height={g.height}
                rx="12"
              />
              <text className="diagram-group-title" x={g.x + 19} y={g.y + 27}>
                {g.title}
              </text>
            </g>
          ))}
          {diagram.edges.map((e, i) => (
            <g key={i} aria-hidden="true">
              <path
                className={`diagram-edge ${e.warning ? "warning" : ""}`}
                d={e.path}
                markerEnd={`url(#${e.warning ? warningArrow : arrow})`}
              />
              {e.label && (
                <g
                  className={`diagram-edge-label ${e.warning ? "warning" : ""}`}
                >
                  <rect
                    x={(e.labelX || 0) - (e.label.length * 6 + 12) / 2}
                    y={(e.labelY || 0) - 12}
                    width={e.label.length * 6 + 12}
                    height="17"
                    rx="3"
                  />
                  <text x={e.labelX} y={e.labelY} textAnchor="middle">
                    {e.label}
                  </text>
                </g>
              )}
            </g>
          ))}
          {diagram.nodes.map((n) => {
            const hint = n.hint ? wrapHint(n.hint, n.width) : [];
            const textHeight =
              n.title.length * 19 + (hint.length ? 7 + hint.length * 14 : 0);
            const firstY = n.y + (n.height - textHeight) / 2 + 14;
            return (
              <g
                key={n.id}
                className={`diagram-node ${n.tone || ""} ${selected === n.id ? "selected" : ""}`}
                role="button"
                tabIndex={0}
                aria-label={[n.title.join(" "), n.hint]
                  .filter(Boolean)
                  .join(" · ")}
                aria-pressed={selected === n.id}
                onClick={() => setSelected(n.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setSelected(n.id);
                  }
                }}
              >
                {n.shape === "decision" ? (
                  <polygon
                    points={`${n.x + n.width / 2},${n.y} ${n.x + n.width},${n.y + n.height / 2} ${n.x + n.width / 2},${n.y + n.height} ${n.x},${n.y + n.height / 2}`}
                  />
                ) : (
                  <rect
                    x={n.x}
                    y={n.y}
                    width={n.width}
                    height={n.height}
                    rx="8"
                  />
                )}
                <text
                  x={n.x + n.width / 2}
                  y={firstY}
                  textAnchor="middle"
                  aria-hidden="true"
                >
                  {n.title.map((line, i) => (
                    <tspan key={i} x={n.x + n.width / 2} dy={i ? 19 : 0}>
                      {line}
                    </tspan>
                  ))}
                </text>
                {hint.length > 0 && (
                  <text
                    className="diagram-hint"
                    x={n.x + n.width / 2}
                    y={firstY + n.title.length * 19 + 3}
                    textAnchor="middle"
                    aria-hidden="true"
                  >
                    {hint.map((line, i) => (
                      <tspan key={i} x={n.x + n.width / 2} dy={i ? 14 : 0}>
                        {line}
                      </tspan>
                    ))}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>
      <div className="diagram-detail" aria-live="polite">
        <strong>{active.title.join(" ")}</strong>
        <p>{active.detail}</p>
      </div>
    </>
  );
}

export function ArchitectureContent() {
  const [tab, setTab] = useState("current");
  const scenario =
    architectureScenarios.find((s) => s.id === tab) || architectureScenarios[0];
  const defaults: Record<string, string> = {
    current: "llm",
    precheck: "triage",
    retrieval: "fusion",
    review: "verifier",
  };
  return (
    <>
      <section className="panel architecture-section">
        <div
          className="architecture-tabs"
          role="tablist"
          aria-label="Вариант архитектуры"
        >
          {architectureScenarios.map((s) => (
            <button
              key={s.id}
              id={`architecture-tab-${s.id}`}
              role="tab"
              aria-selected={tab === s.id}
              aria-controls={`architecture-panel-${s.id}`}
              className={tab === s.id ? "active" : ""}
              onClick={() => setTab(s.id)}
            >
              {s.tab}
            </button>
          ))}
        </div>
        <div
          className="architecture-body"
          id={`architecture-panel-${scenario.id}`}
          role="tabpanel"
          aria-labelledby={`architecture-tab-${scenario.id}`}
        >
          <div className="section-top">
            <h2>{scenario.diagram.title}</h2>
            <span
              className={`pill ${scenario.id === "current" ? "green" : ""}`}
            >
              {scenario.status}
            </span>
          </div>
          <p className="section-description">{scenario.diagram.description}</p>
          <Diagram
            key={scenario.id}
            diagram={scenario.diagram}
            initialNode={defaults[scenario.id]}
          />
          <dl className="scenario-facts">
            {scenario.facts.map((f) => (
              <div key={f.title}>
                <dt>{f.title}</dt>
                <dd>{f.text}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>
      <div className="two-columns architecture-summary">
        <section className="panel section-block">
          <h2>Стек</h2>
          <dl className="data-list">
            <div>
              <dt>Интерфейс</dt>
              <dd>React + Vite</dd>
            </div>
            <div>
              <dt>Сервис</dt>
              <dd>Python · FastAPI · Pydantic</dd>
            </div>
            <div>
              <dt>LLM</dt>
              <dd>OpenAI через OpenRouter</dd>
            </div>
            <div>
              <dt>Решения</dt>
              <dd>Память процесса</dd>
            </div>
          </dl>
        </section>
        <section className="panel section-block">
          <h2>Правила ответа</h2>
          <ul className="plain-list">
            <li>Торговые рекомендации отклоняются.</li>
            <li>Жалобы, KYC и AML передаются специалисту.</li>
            <li>Условия, комиссии и сроки — только из базы.</li>
            <li>Если данных нет — ответ сообщает об этом.</li>
          </ul>
        </section>
      </div>
      <section className="section-block">
        <h2>Другие расширения</h2>
        <div className="risk-list">
          {extensions.map((e) => (
            <details key={e.title}>
              <summary>
                {e.title}
                <span className="pill">План</span>
              </summary>
              <dl className="risk-body">
                <div>
                  <dt>Когда</dt>
                  <dd>{e.trigger}</dd>
                </div>
                <div>
                  <dt>Изменение</dt>
                  <dd>{e.change}</dd>
                </div>
                <div>
                  <dt>Проверка</dt>
                  <dd>{e.proof}</dd>
                </div>
              </dl>
            </details>
          ))}
        </div>
      </section>
    </>
  );
}

export function FailoverPlan() {
  return (
    <div className="failover-plan">
      <div className="section-top">
        <h3>Резервные модели и откат</h3>
        <span className="pill">План</span>
      </div>
      <p className="section-description">{failoverDiagram.description}</p>
      <Diagram diagram={failoverDiagram} initialNode="gateway" />
      <dl className="scenario-facts">
        <div>
          <dt>Переключение при сбое</dt>
          <dd>
            Основная модель → резерв того же провайдера → проверенный резерв
            другого провайдера → ручная обработка. При массовом сбое провайдер
            временно исключается из маршрута.
          </dd>
        </div>
        <div>
          <dt>Откат после релиза</dt>
          <dd>
            Если новая модель ухудшила качество, ошибки или задержку, вернуть
            последнюю доступную конфигурацию модели и промпта, прошедшую оценку.
            Использовать актуальную утверждённую базу и повторно проверить
            совместимость.
          </dd>
        </div>
        <div>
          <dt>Ограничения</dt>
          <dd>
            Общий лимит времени, попыток и расходов; одинаковые запреты и
            проверка цитат для каждого резерва. Отказы по безопасности и ошибки
            ключа, баланса или доступа не маскировать перебором моделей.
          </dd>
        </div>
        <div>
          <dt>Сбой OpenRouter</dt>
          <dd>
            Резерв другого провайдера внутри OpenRouter не устраняет сбой самого
            OpenRouter. Для этого нужен отдельный адаптер резервного API с
            согласованной моделью и правилами передачи данных.
          </dd>
        </div>
      </dl>
      <p className="small muted">
        Конкретные резервные модели, провайдеры и пороги переключения выбираются
        после проверки качества, цены, схемы ответа и условий работы с данными.
      </p>
    </div>
  );
}
