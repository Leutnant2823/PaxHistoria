import { useEffect, useMemo, useState } from "react";
import type { GameMeta, ServerConfig } from "../../shared/api";
import { api } from "../api";
import type { MapData } from "../game/mapdata";
import type { Difficulty, GameState } from "../game/types";
import { defaultSettings, formatDate, newGame } from "../game/engine";
import { COUNTRIES, DEFAULT_PLAYER, INTRO } from "../game/scenario1911";
import { DIFFICULTY_LABEL } from "../game/prompts";
import { AiSettingsFields, defaultAi } from "../components/AiSettingsFields";
import { persistGame, persistSnapshot } from "../game/persist";

interface Props {
  map: MapData | null;
  config: ServerConfig | null;
  onOpen: (game: GameState) => void;
  onLogout: () => void;
}

export function Menu({ map, config, onOpen, onLogout }: Props) {
  const [games, setGames] = useState<GameMeta[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    api.listGames().then(setGames, (e) => setError(e.message));
  }, []);

  async function open(id: string) {
    setBusy(id);
    try {
      onOpen(await api.loadGame<GameState>(id));
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

  const ready = !!map && !!config;

  return (
    <div className="menu-screen title-bg">
      <header className="menu-header">
        <h1 className="brand">Strategia</h1>
        <button className="btn ghost" onClick={onLogout}>
          Выйти
        </button>
      </header>

      <div className="menu-body">
        <section className="menu-card scenario-card">
          <div className="scenario-year">1911</div>
          <h2>Мир накануне бури</h2>
          <p>{INTRO}</p>
          <button className="btn primary big" disabled={!ready} onClick={() => setCreating(true)}>
            {ready ? "Новая партия" : "Загрузка карты..."}
          </button>
        </section>

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

      {creating && map && config && (
        <NewGameDialog
          map={map}
          config={config}
          onCancel={() => setCreating(false)}
          onCreate={async (game) => {
            await persistGame(game);
            await persistSnapshot(game);
            onOpen(game);
          }}
        />
      )}
    </div>
  );
}

function NewGameDialog({
  map,
  config,
  onCancel,
  onCreate,
}: {
  map: MapData;
  config: ServerConfig;
  onCancel: () => void;
  onCreate: (g: GameState) => Promise<void>;
}) {
  const [player, setPlayer] = useState(DEFAULT_PLAYER);
  const [name, setName] = useState("Германия, 1911");
  const [difficulty, setDifficulty] = useState<Difficulty>("normal");
  const [ai, setAi] = useState(() => defaultAi(config));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const countries = useMemo(
    () =>
      Object.entries(COUNTRIES).sort(([, a], [, b]) => Number(b.major) - Number(a.major) || a.name.localeCompare(b.name, "ru")),
    [],
  );

  async function create() {
    setBusy(true);
    setError(null);
    try {
      const settings = { ...defaultSettings(), difficulty, ai };
      await onCreate(newGame(map, player, name.trim() || "Партия", settings));
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="modal-backdrop">
      <div className="modal">
        <h2>Новая партия: 1 января 1911 года</h2>
        <div className="form-grid">
          <label>
            Страна
            <select
              value={player}
              onChange={(e) => {
                setPlayer(e.target.value);
                setName(`${COUNTRIES[e.target.value].name}, 1911`);
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
            {busy ? "Создание..." : "Начать"}
          </button>
        </div>
      </div>
    </div>
  );
}
