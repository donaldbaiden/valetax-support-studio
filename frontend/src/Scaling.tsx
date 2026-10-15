import { Diagram } from "./Architecture";
import { scaleDiagram, scalingSteps } from "./scalingData";

export function ScalingPlan() {
  return (
    <section className="section-block scaling-plan">
      <div className="panel scaling-overview">
        <h2>Масштабирование</h2>
        <p className="section-description">
          Сейчас — 10 000 обращений в месяц. Число обработчиков определяется
          пиковым потоком, временем LLM и лимитами провайдера.
        </p>
        <dl className="scaling-stats">
          <div>
            <dt>Объём</dt>
            <dd>≈ 333 в день</dd>
            <span>Среднее за 30 дней; пики неизвестны</span>
          </div>
          <div>
            <dt>Сейчас в MVP</dt>
            <dd>2 вызова одновременно</dd>
            <span>Лимит и история в памяти одного процесса</span>
          </div>
          <div>
            <dt>Следующий этап · план</dt>
            <dd>БД + очередь + обработчики</dd>
            <span>Отдельно от API и открытой вкладки</span>
          </div>
        </dl>
        <p className="sop-definition">
          <strong>SOP — Standard Operating Procedure:</strong> внутренняя
          пошаговая инструкция сотруднику. Например, что проверить при задержке
          вывода и когда передать вопрос специалисту. Публичная база объясняет
          условия клиенту, SOP — порядок действий поддержки.
        </p>
        <details className="scaling-diagram" open>
          <summary>
            Схема рабочего пилота <span className="pill">План</span>
          </summary>
          <p className="section-description">{scaleDiagram.description}</p>
          <Diagram diagram={scaleDiagram} initialNode="jobs" />
          <p className="small muted">
            Предложение для пилота: FastAPI, PostgreSQL с таблицей заданий и
            отдельные обработчики. Это план; текущий MVP продолжает работать
            локально с хранением в памяти.
          </p>
        </details>
      </div>
      <h3 className="scaling-steps-title">Порядок расширения</h3>
      <div className="risk-list scaling-steps">
        {scalingSteps.map((step, index) => (
          <details key={step.id}>
            <summary>
              <span className="scaling-step-number">{index + 1}.</span>{" "}
              {step.title}
            </summary>
            <p className="scaling-trigger">
              <strong>Когда:</strong> {step.trigger}
            </p>
            <ul>
              {step.changes.map((change) => (
                <li key={change}>{change}</li>
              ))}
            </ul>
            {step.id === "capacity" && (
              <div className="capacity-example">
                <h4>Как оценить параллельность</h4>
                <p>
                  Одновременные вызовы ≈ пик обращений/с × средняя сумма секунд
                  всех LLM-вызовов на обращение ÷ целевая загрузка.
                </p>
                <p>
                  <strong>Расчётный пример:</strong> 20 обращений/мин × 15
                  секунд ÷ 60 ÷ 0,7 = 7,14 → 8 одновременных вызовов. 70% —
                  допущение для запаса; это не замер MVP и не гарантия p95.
                </p>
                <p>
                  При добавлении классификатора, проверяющего и повторов сумма
                  секунд растёт. Итог ограничивают также квоты запросов и
                  токенов; задержку очереди подтверждает нагрузочный тест.
                </p>
              </div>
            )}
            <div className="risk-verification">
              <h4>Как проверить</h4>
              <p>{step.test}</p>
            </div>
          </details>
        ))}
      </div>
    </section>
  );
}
