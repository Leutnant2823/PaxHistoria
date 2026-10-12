import { useCallback, useEffect, useState } from "react";
import type { ServerConfig } from "../shared/api";
import { api, ApiError } from "./api";
import { loadMap, type MapData } from "./game/mapdata";
import type { GameState } from "./game/types";
import { Login } from "./screens/Login";
import { Menu } from "./screens/Menu";
import { Game } from "./screens/Game";

type Screen = { kind: "loading" } | { kind: "login" } | { kind: "menu" } | { kind: "game"; game: GameState };

export function App() {
  const [screen, setScreen] = useState<Screen>({ kind: "loading" });
  const [config, setConfig] = useState<ServerConfig | null>(null);
  const [map, setMap] = useState<MapData | null>(null);
  const [mapError, setMapError] = useState<string | null>(null);

  const enter = useCallback(async () => {
    try {
      setConfig(await api.config());
      setScreen({ kind: "menu" });
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) setScreen({ kind: "login" });
      else setMapError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    enter();
  }, [enter]);

  useEffect(() => {
    if (screen.kind === "menu" && !map) loadMap().then(setMap, (e) => setMapError(e.message));
  }, [screen.kind, map]);

  if (mapError) return <div className="center-screen error-text">Ошибка: {mapError}</div>;
  if (screen.kind === "loading") return <div className="center-screen muted">Загрузка...</div>;
  if (screen.kind === "login") return <Login onLogin={enter} />;
  if (screen.kind === "menu" || !map || !config)
    return (
      <Menu
        map={map}
        config={config}
        onOpen={(game) => setScreen({ kind: "game", game })}
        onLogout={async () => {
          await api.logout().catch(() => undefined);
          setScreen({ kind: "login" });
        }}
      />
    );
  return <Game initial={screen.game} map={map} config={config} onExit={() => setScreen({ kind: "menu" })} />;
}
