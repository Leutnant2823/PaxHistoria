import { useMemo, useState } from "react";
import type { EventKind, GameState } from "../game/types";
import type { MapData } from "../game/mapdata";
import { RELATION_LABEL, atWarWith, formatDate, regionsOf, relationOf } from "../game/engine";
import { Markdown } from "./Markdown";

export const KIND_LABEL: Record<EventKind, string> = {
  war: "Война",
  diplomacy: "Дипломатия",
  politics: "Политика",
  economy: "Экономика",
  territory: "Территория",
  military: "Армия и флот",
  society: "Общество",
  disaster: "Бедствие",
  science: "Наука",
  other: "Разное",
};

interface Props {
  state: GameState;
  map: MapData;
  onSelectCountry: (id: string) => void;
  onRefreshLore: () => void;
  loreBusy: boolean;
}

export function SidePanel({ state, map, onSelectCountry, onRefreshLore, loreBusy }: Props) {
  const [tab, setTab] = useState<"events" | "lore" | "countries">("events");
  const [open, setOpen] = useState(false);
  const [mine, setMine] = useState(false);

  const turns = useMemo(() => {
    const byTurn = new Map<number, typeof state.events>();
    for (const e of state.events) {
      if (mine && !e.countries.includes(state.player)) continue;
      if (!byTurn.has(e.turn)) byTurn.set(e.turn, []);
      byTurn.get(e.turn)!.push(e);
    }
    return [...byTurn.entries()].sort((a, b) => b[0] - a[0]);
  }, [state.events, state.player, mine]);

  const countries = useMemo(
    () =>
      Object.values(state.countries)
        .filter((c) => c.alive)
        .map((c) => ({ c, regions: regionsOf(state, map, c.id) }))
        .map(({ c, regions }) => ({ c, provinces: regions.length, km2: regions.reduce((s, r) => s + map.regions[r].k, 0) }))
        .sort((a, b) => Number(b.c.major) - Number(a.c.major) || b.km2 - a.km2),
    [state, map],
  );

  if (!open) {
    return (
      <div className="side-tabs-collapsed">
        <button className="btn" onClick={() => { setTab("events"); setOpen(true); }}>Хроника</button>
        <button className="btn" onClick={() => { setTab("lore"); setOpen(true); }}>Летопись</button>
        <button className="btn" onClick={() => { setTab("countries"); setOpen(true); }}>Страны</button>
      </div>
    );
  }

  return (
    <div className="panel side-panel">
      <div className="panel-tabs">
        <button className={tab === "events" ? "active" : ""} onClick={() => setTab("events")}>Хроника</button>
        <button className={tab === "lore" ? "active" : ""} onClick={() => setTab("lore")}>Летопись</button>
        <button className={tab === "countries" ? "active" : ""} onClick={() => setTab("countries")}>Страны</button>
        <button className="collapse" onClick={() => setOpen(false)} title="Скрыть">✕</button>
      </div>
      <div className="panel-body scroll">
        {tab === "events" && (
          <>
            <label className="check small">
              <input type="checkbox" checked={mine} onChange={(e) => setMine(e.target.checked)} /> Только события моей страны
            </label>
            {turns.length === 0 && <p className="muted small">Событий пока нет. Отдайте приказы и перемотайте время.</p>}
            {turns.map(([turn, events]) => {
              const record = state.turns.find((t) => t.turn === turn);
              return (
                <div key={turn} className="turn-block">
                  <div className="turn-head">
                    Ход {turn}
                    {record && `: ${formatDate(record.from)} → ${formatDate(record.to)}`}
                  </div>
                  {[...events].reverse().map((e) => (
                    <article key={e.id || e.title} className={`event kind-${e.kind}`}>
                      <div className="event-meta">
                        {formatDate(e.date)} · {KIND_LABEL[e.kind]}
                      </div>
                      <h4>{e.title}</h4>
                      <p>{e.text}</p>
                      {e.applied && e.applied.length > 0 && (
                        <ul className="applied">
                          {e.applied.map((a, i) => <li key={i}>{a}</li>)}
                        </ul>
                      )}
                    </article>
                  ))}
                </div>
              );
            })}
          </>
        )}
        {tab === "lore" && (
          <>
            {state.lore ? <Markdown text={state.lore} /> : <p className="muted small">Летопись появится после пяти ходов. Её пишет ИИ, сжимая историю партии.</p>}
            <button className="btn small" disabled={loreBusy || state.turn < 2} onClick={onRefreshLore}>
              {loreBusy ? "Летописец пишет..." : "Обновить летопись сейчас"}
            </button>
          </>
        )}
        {tab === "countries" && (
          <table className="country-table">
            <thead>
              <tr>
                <th>Страна</th>
                <th>Пров.</th>
                <th>Тыс. км²</th>
                <th>К вам</th>
              </tr>
            </thead>
            <tbody>
              {countries.map(({ c, provinces, km2 }) => {
                const rel = c.id === state.player ? null : relationOf(state, c.id, state.player);
                return (
                  <tr key={c.id} onClick={() => onSelectCountry(c.id)} className={c.id === state.player ? "me" : ""}>
                    <td>
                      <span className="dot" style={{ background: c.color }} />
                      {c.name}
                      {atWarWith(state, c.id).length > 0 && <span className="war-tag">война</span>}
                    </td>
                    <td>{provinces}</td>
                    <td>{Math.round(km2 / 1000)}</td>
                    <td className={rel ? `rel-${rel.status}` : ""}>{c.id === state.player ? "вы" : rel ? RELATION_LABEL[rel.status] : ""}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
