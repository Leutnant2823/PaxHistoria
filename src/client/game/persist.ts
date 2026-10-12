import { api } from "../api";
import type { GameState } from "./types";
import { countryName } from "./engine";

export async function persistGame(state: GameState) {
  await api.saveGame(
    {
      id: state.id,
      name: state.name,
      country: countryName(state, state.player),
      gameDate: state.date,
      turn: state.turn,
    },
    state,
  );
}

/** Snapshot N is the state at the start of turn N (used by the timeline rewind). */
export async function persistSnapshot(state: GameState) {
  await api.saveSnapshot(state.id, state.turn, state.date, state);
}
