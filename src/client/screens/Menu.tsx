import { useEffect, useMemo, useState } from "react";
import type { GameMeta, ServerConfig } from "../../shared/api";
import { api } from "../api";
import type { MapData } from "../game/mapdata";
import type { Difficulty, GameState, Scenario } from "../game/types";
import { defaultSettings, formatDate, newGame } from "../game/engine";
import { SCENARIOS } from "../game/scenarios";
import { DIFFICULTY_LABEL } from "../game/prompts";
import { AiSettingsFields, defaultAi } from "../components/AiSettingsFields";
import { persistGame, persistSnapshot } from "../game/persist";

interface Props {
  config: ServerConfig | null;
  getMap: (scenarioId: string) => Promise<MapData>;
  onOpen: (game: GameState, map: MapData) => void;
  onLogout: () => void;
}

export function Menu({ config, getMap, onOpen, onLogout }: Props) {
  const [games, setGames] = useState<GameMeta[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState<Scenario | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    api.listGames().then(setGames, (e) => setError(e.message));
  }, []);

  async function open(id: string) {
    setBusy(id);
    try {
      const game = await api.loadGame<GameState>(id);
      onOpen(game, await getMap(game.scenario));
    } catch (e) {
      setError((e as Error).message);
      setBusy(null);
    }
  }

  async function remove(g: GameMeta) {
    if (!confirm(`Удалить партию «${g.name}»? Это нельзя отменить.`)) return;
    await api.deleteGame(g.id);
    setGames((list) => list?.filter((x) => x.id !== g.id) ?? null);
  }

  const ready = !!config;

  return (
    <div className="menu-screen title-bg">
      <header className="menu-header">
        <h1 className="brand">Strategia</h1>
        <button className="btn ghost" onClick={onLogout}>
          Выйти
        </button>
      </header>

      <div className="menu-body">
        <div className="scenario-column">
          {SCENARIOS.map((sc) => (
            <section key={sc.id} className="menu-card scenario-card">
              <div className="scenario-year">{sc.year}</div>
              <h2>{sc.title}</h2>
              <p>{sc.intro}</p>
              <button className="btn primary big" disabled={!ready} onClick={() => setCreating(sc)}>
                Новая партия
              </button>
            </section>
          ))}
        </div>

        <section className="menu-card">
          <h2>Сохранённые партии</h2>
          {error && <div className="error-text">{error}</div>}
          {!games && !error && <div className="muted">Загрузка...</div>}
          {games?.length === 0 && <div className="muted">Пока нет ни одной партии.</div>}
          <ul className="save-list">
            {games?.map((g) => (
              <li key={g.id}>
                <div>
                  <div className="save-name">{g.name}</div>
                  <div className="muted small">
                    {g.country}, {formatDate(g.gameDate)}, ход {g.turn}
                  </div>
                </div>
                <div className="row">
                  <button className="btn" disabled={!ready || busy === g.id} onClick={() => open(g.id)}>
                    {busy === g.id ? "Загрузка..." : "Продолжить"}
                  </button>
                  <button className="btn ghost danger" onClick={() => remove(g)}>
                    Удалить
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>

      {creating && config && (
        <NewGameDialog
          scenario={creating}
          getMap={getMap}
          config={config}
          onCancel={() => setCreating(null)}
          onCreate={async (game, map) => {
            await persistGame(game);
            await persistSnapshot(game);
            onOpen(game, map);
          }}
        />
      )}
    </div>
  );
}

function NewGameDialog({
  scenario,
  getMap,
  config,
  onCancel,
  onCreate,
}: {
  scenario: Scenario;
  getMap: (scenarioId: string) => Promise<MapData>;
  config: ServerConfig;
  onCancel: () => void;
  onCreate: (g: GameState, map: MapData) => Promise<void>;
}) {
  const COUNTRIES = scenario.countries;
  const [player, setPlayer] = useState(scenario.defaultPlayer);
  const [name, setName] = useState(`${COUNTRIES[scenario.defaultPlayer].name}, ${scenario.year}`);
  const [difficulty, setDifficulty] = useState<Difficulty>("normal");
  const [ai, setAi] = useState(() => defaultAi(config));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const countries = useMemo(
    () =>
      Object.entries(COUNTRIES).sort(([, a], [, b]) => Number(b.major) - Number(a.major) || a.name.localeCompare(b.name, "ru")),
    [COUNTRIES],
  );

  async function create() {
    setBusy(true);
    setError(null);
    try {
      const settings = { ...defaultSettings(), difficulty, ai };
      const map = await getMap(scenario.id);
      await onCreate(newGame(map, scenario, player, name.trim() || "Партия", settings), map);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="modal-backdrop">
      <div className="modal">
        <h2>Новая партия: {formatDate(scenario.startDate)}</h2>
        <div className="form-grid">
          <label>
            Страна
            <select
              value={player}
              onChange={(e) => {
                setPlayer(e.target.value);
                setName(`${COUNTRIES[e.target.value].name}, ${scenario.year}`);
              }}
            >
              <optgroup label="Великие державы">
                {countries.filter(([, c]) => c.major).map(([id, c]) => (
                  <option key={id} value={id}>
                    {c.name}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Другие государства">
                {countries.filter(([, c]) => !c.major).map(([id, c]) => (
                  <option key={id} value={id}>
                    {c.name}
                  </option>
                ))}
              </optgroup>
            </select>
          </label>
          <p className="muted small">{COUNTRIES[player].description}</p>
          <label>
            Название партии
            <input value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label>
            Сложность
            <select value={difficulty} onChange={(e) => setDifficulty(e.target.value as Difficulty)}>
              {Object.entries(DIFFICULTY_LABEL).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </label>
        </div>
        <h3>Искусственный интеллект</h3>
        <AiSettingsFields value={ai} onChange={setAi} config={config} />
        {error && <div className="error-text">{error}</div>}
        <div className="modal-actions">
          <button className="btn ghost" onClick={onCancel} disabled={busy}>
            Отмена
          </button>
          <button className="btn primary" onClick={create} disabled={busy || !ai.model}>
            {busy ? "Загрузка карты..." : "Начать"}
          </button>
        </div>
      </div>
    </div>
  );
}
