import type { MapData } from "./mapdata";
import type { Chat, GameState } from "./types";
import { RELATION_LABEL, atWarWith, countryName, formatDate, ownerOf, regionsOf } from "./engine";

// Builds the textual description of the world that goes into AI requests.

const RECENT_TURNS_IN_FULL = 6;

export function countryLine(state: GameState, map: MapData, id: string): string {
  const c = state.countries[id];
  const regions = regionsOf(state, map, id);
  const km2 = regions.reduce((s, r) => s + map.regions[r].k, 0);
  return `${id} ${c.name}. Правитель: ${c.leader}. Строй: ${c.government}. Провинций: ${regions.length}, площадь ~${Math.round(km2 / 1000)} тыс. км².`;
}

export function worldOverview(state: GameState, map: MapData): string {
  const alive = Object.values(state.countries).filter((c) => c.alive);
  const majors = alive.filter((c) => c.major || c.id === state.player);
  const minors = alive.filter((c) => !c.major && c.id !== state.player);
  const lines = [
    "ВЕЛИКИЕ ДЕРЖАВЫ И СТРАНА ИГРОКА:",
    ...majors.map((c) => `- ${countryLine(state, map, c.id)}\n  ${c.description}`),
    "",
    "ПРОЧИЕ ГОСУДАРСТВА:",
    ...minors.map((c) => `- ${countryLine(state, map, c.id)}`),
  ];
  return lines.join("\n");
}

export function relationsText(state: GameState): string {
  if (!state.relations.length) return "Особых отношений нет.";
  return state.relations
    .map((r) => `- ${r.a} (${countryName(state, r.a)}) и ${r.b} (${countryName(state, r.b)}): ${RELATION_LABEL[r.status]} с ${formatDate(r.since)}${r.note ? ` (${r.note})` : ""}`)
    .join("\n");
}

export function armiesText(state: GameState, map: MapData): string {
  if (!state.armies.length) return "Нет.";
  return state.armies
    .map((a) => {
      const unit = a.kind === "fleet" ? `${a.size} линкоров` : `${a.size} тыс. чел.`;
      return `- [${a.id}] ${a.name} (${a.owner}), ${unit}, стоит в ${map.regions[a.region]?.n ?? "?"} [${a.region}]`;
    })
    .join("\n");
}

/**
 * Countries the AI needs province-level detail for: the player, countries at
 * war, and countries the player is currently dealing with.
 */
export function focusCountries(state: GameState, extra: string[] = []): string[] {
  const set = new Set<string>([state.player, ...extra]);
  for (const r of state.relations) if (r.status === "war") set.add(r.a).add(r.b);
  const text = state.pending.map((a) => a.text.toLowerCase()).join(" ");
  for (const c of Object.values(state.countries)) {
    if (!c.alive) continue;
    const stem = c.name.toLowerCase().split(" ").pop()!.slice(0, 6);
    if (stem.length >= 4 && text.includes(stem)) set.add(c.id);
  }
  for (const chat of chatsThisTurn(state)) chat.participants.forEach((p) => set.add(p));
  return [...set].filter((id) => state.countries[id]?.alive);
}

/**
 * Provinces of the focus countries. Provinces near another focus country (two
 * steps over the province graph) are listed one by one; the rest are grouped
 * by modern area so the AI can still refer to them as "OWNER:ADM0".
 */
export function regionsText(state: GameState, map: MapData, focus: string[]): string {
  const focusSet = new Set(focus);
  const out: string[] = [];
  for (const id of focus) {
    const own = regionsOf(state, map, id);
    const detailed = new Set<string>();
    for (const r of own) {
      if (id === state.player) {
        detailed.add(r);
        continue;
      }
      const near = (map.neighbors[r] ?? []).some((n) => {
        const o = ownerOf(state, map, n);
        if (o !== id && focusSet.has(o)) return true;
        return (map.neighbors[n] ?? []).some((m) => {
          const o2 = ownerOf(state, map, m);
          return o2 !== id && focusSet.has(o2);
        });
      });
      if (near) detailed.add(r);
    }
    const groups = new Map<string, string[]>();
    for (const r of own) {
      if (detailed.has(r)) continue;
      const a = map.regions[r].a;
      if (!groups.has(a)) groups.set(a, []);
      groups.get(a)!.push(r);
    }
    out.push(`${id} (${countryName(state, id)}):`);
    if (detailed.size) out.push("  " + [...detailed].map((r) => `[${r}] ${map.regions[r].n}`).join("; "));
    for (const [a, rs] of groups) {
      const sample = rs.slice(0, 3).map((r) => map.regions[r].n).join(", ");
      out.push(`  [${id}:${a}] ${rs.length} пров. (${sample}${rs.length > 3 ? ", ..." : ""})`);
    }
  }
  return out.join("\n");
}

export function chatsThisTurn(state: GameState): Chat[] {
  const since = state.turns.length ? state.turns[state.turns.length - 1].to : "0000";
  return state.chats.filter((c) => c.messages.some((m) => m.date >= since));
}

export function chatTranscript(state: GameState, chat: Chat, limit = 40): string {
  return chat.messages
    .slice(-limit)
    .map((m) => {
      const who = m.from === "player" ? `${countryName(state, state.player)} (игрок)` : countryName(state, m.from);
      return `[${formatDate(m.date)}] ${who}: ${m.text}`;
    })
    .join("\n");
}

export function diplomacyText(state: GameState): string {
  const chats = chatsThisTurn(state);
  if (!chats.length) return "В этом ходу переписки не было.";
  return chats
    .map((c) => `Переписка с ${c.participants.map((p) => countryName(state, p)).join(", ")}:\n${chatTranscript(state, c, 16)}`)
    .join("\n\n");
}

export function historyText(state: GameState): string {
  const parts: string[] = [];
  if (state.summaries.length) {
    parts.push("СЖАТАЯ ИСТОРИЯ ПРЕДЫДУЩИХ ХОДОВ:");
    for (const s of state.summaries) parts.push(`Ходы ${s.fromTurn}-${s.toTurn}: ${s.text}`);
  }
  const summarizedTo = state.summaries.length ? state.summaries[state.summaries.length - 1].toTurn : 0;
  const recent = state.events.filter((e) => e.turn > summarizedTo).slice(-RECENT_TURNS_IN_FULL * 12);
  if (recent.length) {
    parts.push("НЕДАВНИЕ СОБЫТИЯ:");
    for (const e of recent) parts.push(`- ${e.date}: ${e.title}. ${e.text}`);
  }
  const playerActions = state.turns.slice(-3).flatMap((t) => t.actions.map((a) => `- (ход ${t.turn}) ${a.text}`));
  if (playerActions.length) parts.push("ПРОШЛЫЕ ПРИКАЗЫ ИГРОКА:", ...playerActions);
  return parts.length ? parts.join("\n") : "Игра только началась, событий ещё не было.";
}

export function warsText(state: GameState): string {
  const wars = atWarWith(state, state.player);
  return wars.length ? `Игрок воюет с: ${wars.map((w) => countryName(state, w)).join(", ")}.` : "Игрок ни с кем не воюет.";
}

/** Full context block used by jumps and the advisor. */
export function fullContext(state: GameState, map: MapData, extraFocus: string[] = []): string {
  const focus = focusCountries(state, extraFocus);
  return [
    `ТЕКУЩАЯ ДАТА: ${state.date}`,
    `ИГРОК: ${state.player} (${countryName(state, state.player)}). ${warsText(state)}`,
    "",
    worldOverview(state, map),
    "",
    "ОТНОШЕНИЯ:",
    relationsText(state),
    "",
    "АРМИИ И ФЛОТЫ:",
    armiesText(state, map),
    "",
    "ПРОВИНЦИИ (ID в квадратных скобках):",
    regionsText(state, map, focus),
    "",
    historyText(state),
    "",
    "ДИПЛОМАТИЯ ЭТОГО ХОДА:",
    diplomacyText(state),
  ].join("\n");
}
