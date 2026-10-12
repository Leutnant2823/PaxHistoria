import { useState } from "react";
import type { GameEvent, GameState } from "../game/types";
import { formatDate } from "../game/engine";
import { jumpTarget, type JumpPlan } from "../game/aitasks";
import { KIND_LABEL } from "./SidePanel";

const OPTIONS: { label: string; plan: JumpPlan }[] = [
  { label: "До следующего важного события", plan: { mode: "auto" } },
  { label: "1 неделя", plan: { mode: "days", days: 7 } },
  { label: "2 недели", plan: { mode: "days", days: 14 } },
  { label: "1 месяц", plan: { mode: "months", months: 1 } },
  { label: "3 месяца", plan: { mode: "months", months: 3 } },
  { label: "6 месяцев", plan: { mode: "months", months: 6 } },
  { label: "1 год", plan: { mode: "months", months: 12 } },
];

export function JumpDialog({ state, onCancel, onJump }: { state: GameState; onCancel: () => void; onJump: (p: JumpPlan) => void }) {
  const [custom, setCustom] = useState(30);
  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal jump-dialog" onClick={(e) => e.stopPropagation()}>
        <h2>Перемотка времени</h2>
        <p className="muted small">
          Сейчас {formatDate(state.date)}. Приказов на этот ход: {state.pending.length}. Чем длиннее период, тем больше событий и тем менее
          точен ИИ.
        </p>
        <div className="jump-options">
          {OPTIONS.map((o) => (
            <button key={o.label} className="btn" onClick={() => onJump(o.plan)}>
              <span>{o.label}</span>
              <span className="muted small">
                {o.plan.mode === "auto" ? "не дальше полугода" : `до ${formatDate(jumpTarget(state.date, o.plan))}`}
              </span>
            </button>
          ))}
        </div>
        <div className="row">
          <label className="inline">
            Своё число дней
            <input type="number" min={1} max={730} value={custom} onChange={(e) => setCustom(Number(e.target.value))} />
          </label>
          <button className="btn" disabled={!(custom >= 1 && custom <= 730)} onClick={() => onJump({ mode: "days", days: custom })}>
            Перемотать на {custom} дн.
          </button>
        </div>
        <div className="modal-actions">
          <button className="btn ghost" onClick={onCancel}>
            Отмена
          </button>
        </div>
      </div>
    </div>
  );
}

export type JumpPhase =
  | { stage: "generating"; chars: number; thinking: boolean; abort: AbortController }
  | { stage: "error"; message: string }
  | { stage: "playback"; events: GameEvent[]; index: number; list: boolean };

interface OverlayProps {
  phase: JumpPhase;
  onCancel: () => void;
  onRetry: () => void;
  onNext: () => void;
  onIntervene: () => void;
  onShowAll: () => void;
  onFinish: () => void;
}

export function JumpOverlay({ phase, onCancel, onRetry, onNext, onIntervene, onShowAll, onFinish }: OverlayProps) {
  if (phase.stage === "generating") {
    return (
      <div className="jump-overlay">
        <div className="jump-card center">
          <div className="spinner" />
          <h3>Мир живёт своей жизнью...</h3>
          <p className="muted small">
            {phase.thinking && phase.chars === 0 ? "ИИ обдумывает ход событий" : `ИИ записывает события: ${phase.chars} символов`}
          </p>
          <button className="btn ghost" onClick={onCancel}>
            Отменить
          </button>
        </div>
      </div>
    );
  }
  if (phase.stage === "error") {
    return (
      <div className="jump-overlay">
        <div className="jump-card center">
          <h3>Не получилось</h3>
          <p className="error-text">{phase.message}</p>
          <div className="row center">
            <button className="btn ghost" onClick={onCancel}>
              Закрыть
            </button>
            <button className="btn primary" onClick={onRetry}>
              Попробовать снова
            </button>
          </div>
        </div>
      </div>
    );
  }

  const { events, index, list } = phase;
  if (list) {
    return (
      <div className="jump-overlay">
        <div className="jump-card wide">
          <h3>События периода</h3>
          <div className="event-list scroll">
            {events.map((e, i) => (
              <EventView key={i} e={e} />
            ))}
          </div>
          <div className="row end">
            <button className="btn primary" onClick={onFinish}>
              Продолжить
            </button>
          </div>
        </div>
      </div>
    );
  }
  const e = events[index];
  const last = index === events.length - 1;
  return (
    <div className="jump-overlay transparent">
      <div className="jump-card event-step">
        <div className="muted small">
          Событие {index + 1} из {events.length}
        </div>
        <EventView e={e} />
        <div className="row wrap end">
          {!last && (
            <button className="btn ghost small" onClick={onIntervene} title="Остановить время на этом событии, остальные события отменяются">
              Вмешаться здесь
            </button>
          )}
          {!last && (
            <button className="btn small" onClick={onShowAll}>
              Показать все
            </button>
          )}
          {last ? (
            <button className="btn primary" onClick={onFinish}>
              Завершить ход
            </button>
          ) : (
            <button className="btn primary" onClick={onNext}>
              Далее
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function EventView({ e }: { e: GameEvent }) {
  return (
    <article className={`event big kind-${e.kind}`}>
      <div className="event-meta">
        {formatDate(e.date)} · {KIND_LABEL[e.kind]}
      </div>
      <h4>{e.title}</h4>
      <p>{e.text}</p>
      {e.applied && e.applied.length > 0 && (
        <ul className="applied">
          {e.applied.map((a, i) => (
            <li key={i}>{a}</li>
          ))}
        </ul>
      )}
    </article>
  );
}
