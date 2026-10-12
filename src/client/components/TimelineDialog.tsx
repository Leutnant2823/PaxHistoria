import { useEffect, useState } from "react";
import type { SnapshotMeta } from "../../shared/api";
import { api } from "../api";
import type { GameState } from "../game/types";
import { formatDate } from "../game/engine";

interface Props {
  state: GameState;
  onClose: () => void;
  onRewind: (turn: number) => Promise<void>;
}

export function TimelineDialog({ state, onClose, onRewind }: Props) {
  const [snapshots, setSnapshots] = useState<SnapshotMeta[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<number | null>(null);

  useEffect(() => {
    api.listSnapshots(state.id).then(setSnapshots, (e) => setError(e.message));
  }, [state.id]);

  async function rewind(turn: number) {
    if (!confirm(`Вернуться к началу хода ${turn}? Все последующие ходы будут удалены.`)) return;
    setBusy(turn);
    try {
      await onRewind(turn);
      onClose();
    } catch (e) {
      setError((e as Error).message);
      setBusy(null);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Хронология партии</h2>
        <p className="muted small">Можно вернуться к началу любого прошлого хода и сыграть его иначе.</p>
        {error && <div className="error-text">{error}</div>}
        {!snapshots && !error && <div className="muted">Загрузка...</div>}
        <ul className="timeline">
          {snapshots?.map((s) => {
            const record = state.turns.find((t) => t.turn === s.turn);
            const current = s.turn === state.turn;
            return (
              <li key={s.turn} className={current ? "current" : ""}>
                <div>
                  <b>Ход {s.turn}</b>, {formatDate(s.gameDate)}
                  {record && (
                    <div className="muted small">
                      Перемотка: {record.mode}
                      {record.intervened ? " (с вмешательством)" : ""}. Приказов: {record.actions.length}.
                    </div>
                  )}
                  {current && <div className="muted small">текущий ход</div>}
                </div>
                {!current && (
                  <button className="btn small" disabled={busy !== null} onClick={() => rewind(s.turn)}>
                    {busy === s.turn ? "Загрузка..." : "Вернуться"}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
        <div className="modal-actions">
          <button className="btn" onClick={onClose}>
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
}
