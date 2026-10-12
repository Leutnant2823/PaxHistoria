import { useState } from "react";
import type { ServerConfig } from "../../shared/api";
import type { Difficulty, GameState, PromptKey, RelationStatus } from "../game/types";
import { DEFAULT_PROMPTS, DIFFICULTY_LABEL, PROMPT_HELP, PROMPT_TITLES } from "../game/prompts";
import { RELATION_LABEL, applyChange } from "../game/engine";
import type { MapData } from "../game/mapdata";
import { AiSettingsFields } from "./AiSettingsFields";

interface Props {
  state: GameState;
  map: MapData;
  config: ServerConfig;
  update: (fn: (s: GameState) => void) => void;
  onClose: () => void;
  editorCountry: string;
  setEditorCountry: (id: string) => void;
}

export function SettingsDialog({ state, map, config, update, onClose, editorCountry, setEditorCountry }: Props) {
  const [tab, setTab] = useState<"game" | "ai" | "prompts" | "cheats">("game");
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal settings" onClick={(e) => e.stopPropagation()}>
        <div className="panel-tabs">
          <button className={tab === "game" ? "active" : ""} onClick={() => setTab("game")}>Игра</button>
          <button className={tab === "ai" ? "active" : ""} onClick={() => setTab("ai")}>ИИ</button>
          <button className={tab === "prompts" ? "active" : ""} onClick={() => setTab("prompts")}>Промпты</button>
          <button className={tab === "cheats" ? "active" : ""} onClick={() => setTab("cheats")}>Читы</button>
          <button className="collapse" onClick={onClose}>✕</button>
        </div>
        <div className="settings-body">
          {tab === "game" && (
            <div className="form-grid">
              <label>
                Название партии
                <input value={state.name} onChange={(e) => update((s) => { s.name = e.target.value; })} />
              </label>
              <label>
                Сложность
                <select value={state.settings.difficulty} onChange={(e) => update((s) => { s.settings.difficulty = e.target.value as Difficulty; })}>
                  {Object.entries(DIFFICULTY_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </label>
              <label className="check">
                <input type="checkbox" checked={state.settings.stepEvents} onChange={(e) => update((s) => { s.settings.stepEvents = e.target.checked; })} />
                Показывать события по одному (с возможностью вмешаться)
              </label>
            </div>
          )}
          {tab === "ai" && (
            <AiSettingsFields value={state.settings.ai} config={config} onChange={(ai) => update((s) => { s.settings.ai = ai; })} />
          )}
          {tab === "prompts" && <PromptEditor state={state} update={update} />}
          {tab === "cheats" && (
            <Cheats state={state} map={map} update={update} editorCountry={editorCountry} setEditorCountry={setEditorCountry} />
          )}
        </div>
      </div>
    </div>
  );
}

function PromptEditor({ state, update }: { state: GameState; update: Props["update"] }) {
  const [key, setKey] = useState<PromptKey>("jump");
  const custom = state.prompts[key] !== undefined;
  return (
    <div className="form-grid">
      <label>
        Промпт
        <select value={key} onChange={(e) => setKey(e.target.value as PromptKey)}>
          {(Object.keys(PROMPT_TITLES) as PromptKey[]).map((k) => (
            <option key={k} value={k}>
              {PROMPT_TITLES[k]}
              {state.prompts[k] !== undefined ? " (изменён)" : ""}
            </option>
          ))}
        </select>
      </label>
      <p className="muted small">{PROMPT_HELP} Контекст мира (страны, провинции, события, переписка) добавляется автоматически.</p>
      <textarea
        className="prompt-text"
        rows={16}
        value={state.prompts[key] ?? DEFAULT_PROMPTS[key]}
        onChange={(e) => update((s) => { s.prompts[key] = e.target.value; })}
      />
      <div className="row">
        <span className="muted small">{custom ? "Используется изменённая версия для этой партии." : "Используется стандартная версия."}</span>
        <button className="btn small" disabled={!custom} onClick={() => update((s) => { delete s.prompts[key]; })}>
          Вернуть стандартный
        </button>
      </div>
    </div>
  );
}

function Cheats({ state, map, update, editorCountry, setEditorCountry }: Omit<Props, "config" | "onClose">) {
  const alive = Object.values(state.countries).filter((c) => c.alive).sort((a, b) => a.name.localeCompare(b.name, "ru"));
  const [a, setA] = useState(state.player);
  const [b, setB] = useState(alive.find((c) => c.id !== state.player)?.id ?? "");
  const [status, setStatus] = useState<RelationStatus | "neutral">("alliance");
  return (
    <div className="form-grid">
      <p className="muted small">Читы меняют состояние игры напрямую, минуя ИИ.</p>
      <label className="check">
        <input type="checkbox" checked={state.settings.actionsAlwaysSucceed} onChange={(e) => update((s) => { s.settings.actionsAlwaysSucceed = e.target.checked; })} />
        Приказы игрока всегда исполняются успешно
      </label>
      <label className="check">
        <input type="checkbox" checked={state.settings.mapEditor} onChange={(e) => update((s) => { s.settings.mapEditor = e.target.checked; })} />
        Редактор карты: клик по провинции передаёт её выбранной стране
      </label>
      {state.settings.mapEditor && (
        <label>
          Кому передавать провинции
          <select value={editorCountry} onChange={(e) => setEditorCountry(e.target.value)}>
            {alive.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
      )}
      <h4>Изменить отношения</h4>
      <div className="row wrap">
        <select value={a} onChange={(e) => setA(e.target.value)}>
          {alive.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value as RelationStatus | "neutral")}>
          {Object.entries(RELATION_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          <option value="neutral">нет особых отношений</option>
        </select>
        <select value={b} onChange={(e) => setB(e.target.value)}>
          {alive.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <button className="btn small" disabled={a === b} onClick={() => update((s) => { applyChange(s, map, { type: "relation", a, b, status }); })}>
          Применить
        </button>
      </div>
    </div>
  );
}
