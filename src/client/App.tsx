import { useCallback, useEffect, useRef, useState } from "react";
import type { ServerConfig } from "../shared/api";
import { api, ApiError } from "./api";
import { loadMap, type MapData } from "./game/mapdata";
import type { GameState } from "./game/types";
import { getScenario } from "./game/scenarios";
import { Login } from "./screens/Login";
import { Menu } from "./screens/Menu";
import { Game } from "./screens/Game";

type Screen = { kind: "loading" } | { kind: "login" } | { kind: "menu" } | { kind: "game"; game: GameState; map: MapData };

export function App() {
  const [screen, setScreen] = useState<Screen>({ kind: "loading" });
  const [config, setConfig] = useState<ServerConfig | null>(null);
  const [error, setError] = useState<string | null>(null);
  const maps = useRef(new Map<string, Promise<MapData>>());

  /** Each scenario has its own province map; it is downloaded once and cached. */
  const getMap = useCallback((scenarioId: string) => {
    const url = getScenario(scenarioId).map;
    let p = maps.current.get(url);
    if (!p) {
      p = loadMap(url);
      p.catch(() => maps.current.delete(url));
      maps.current.set(url, p);
    }
    return p;
  }, []);

  const enter = useCallback(async () => {
    try {
      setConfig(await api.config());
      setScreen({ kind: "menu" });
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) setScreen({ kind: "login" });
      else setError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    enter();
  }, [enter]);

  if (error) return <div className="center-screen error-text">Ошибка: {error}</div>;
  if (screen.kind === "loading") return <div className="center-screen muted">Загрузка...</div>;
  if (screen.kind === "login") return <Login onLogin={enter} />;
  if (screen.kind === "menu" || !config)
    return (
      <Menu
        config={config}
        getMap={getMap}
        onOpen={(game, map) => setScreen({ kind: "game", game, map })}
        onLogout={async () => {
          await api.logout().catch(() => undefined);
          setScreen({ kind: "login" });
        }}
      />
    );
  return <Game initial={screen.game} map={screen.map} config={config} onExit={() => setScreen({ kind: "menu" })} />;
}
