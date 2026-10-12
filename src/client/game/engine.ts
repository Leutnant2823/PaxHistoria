import type { MapData } from "./mapdata";
import type {
  Army,
  Change,
  Country,
  GameEvent,
  GameState,
  Relation,
  RelationStatus,
  Settings,
} from "./types";
import { ARMIES, COUNTRIES, RELATIONS, SCENARIO_ID, START_DATE } from "./scenario1911";

// ---------------------------------------------------------------------------
// Basic queries

export function ownerOf(state: GameState, map: MapData, regionId: string): string {
  return state.owners[regionId] ?? map.regions[regionId]?.o ?? "";
}

export function regionsOf(state: GameState, map: MapData, countryId: string): string[] {
  return map.ids.filter((id) => ownerOf(state, map, id) === countryId);
}

export function relationOf(state: GameState, a: string, b: string): Relation | undefined {
  return state.relations.find((r) => (r.a === a && r.b === b) || (r.a === b && r.b === a));
}

export function atWarWith(state: GameState, id: string): string[] {
  return state.relations.filter((r) => r.status === "war" && (r.a === id || r.b === id)).map((r) => (r.a === id ? r.b : r.a));
}

export function countryName(state: GameState, id: string): string {
  return state.countries[id]?.name ?? id;
}

export function newId(state: GameState, prefix: string): string {
  state.nextId += 1;
  return `${prefix}${state.nextId}`;
}

export const RELATION_LABEL: Record<RelationStatus, string> = {
  alliance: "союз",
  entente: "согласие",
  war: "война",
  rival: "соперничество",
  truce: "перемирие",
};

// ---------------------------------------------------------------------------
// New game

export function defaultSettings(): Settings {
  return {
    ai: { provider: "anthropic", model: "claude-opus-5-5", effort: "medium" },
    difficulty: "normal",
    stepEvents: true,
    actionsAlwaysSucceed: false,
    mapEditor: false,
  };
}

export function newGame(map: MapData, player: string, name: string, settings: Settings): GameState {
  const countries: Record<string, Country> = {};
  for (const [id, seed] of Object.entries(COUNTRIES)) countries[id] = { id, alive: true, ...seed };
  const cityRegion = new Map(map.cities.map((c) => [c.n, c.r]));
  const armies: Army[] = ARMIES.flatMap((a, i) => {
    const region = cityRegion.get(a.city);
    return region ? [{ id: `a${i + 1}`, owner: a.owner, name: a.name, region, size: a.size, kind: a.kind }] : [];
  });
  return {
    version: 1,
    id: crypto.randomUUID(),
    name,
    scenario: SCENARIO_ID,
    player,
    date: START_DATE,
    turn: 1,
    settings,
    countries,
    owners: {},
    relations: RELATIONS.map((r) => ({ ...r })),
    armies,
    events: [],
    turns: [],
    pending: [],
    chats: [],
    advisor: [],
    lore: "",
    summaries: [],
    prompts: {},
    nextId: 1000,
  };
}

// ---------------------------------------------------------------------------
// Resolving references written by the AI

const norm = (s: string) => s.toLowerCase().replace(/ё/g, "е").replace(/[^a-zа-я0-9]+/g, " ").trim();

export function resolveCountry(state: GameState, ref: string | undefined): string | null {
  if (!ref) return null;
  const r = ref.trim();
  if (state.countries[r]) return r;
  const up = r.toUpperCase();
  if (state.countries[up]) return up;
  const n = norm(r);
  for (const c of Object.values(state.countries)) {
    if (norm(c.name) === n) return c.id;
  }
  for (const c of Object.values(state.countries)) {
    const cn = norm(c.name);
    if (n.length > 3 && (cn.includes(n) || n.includes(cn))) return c.id;
  }
  return null;
}

/**
 * A territory reference is a province id ("DEU3"), a group "OWNER:ADM0" meaning
 * every province of that modern area currently held by OWNER ("FRA:DZA"), or a
 * province name.
 */
export function resolveRegions(state: GameState, map: MapData, ref: string): string[] {
  const r = ref.trim().replace(/^\[|\]$/g, "");
  if (map.regions[r]) return [r];
  const group = /^([A-Z]{3}):([A-Z]{3})$/.exec(r);
  if (group) {
    const [, owner, adm0] = group;
    return map.ids.filter((id) => map.regions[id].a === adm0 && ownerOf(state, map, id) === owner);
  }
  const n = norm(r);
  const exact = map.ids.filter((id) => norm(map.regions[id].n) === n);
  if (exact.length) return exact;
  const partial = map.ids.filter((id) => {
    const rn = norm(map.regions[id].n);
    return n.length > 3 && (rn.startsWith(n) || rn.includes(`${n} `));
  });
  return partial.length <= 3 ? partial : [];
}

function resolveArmy(state: GameState, ref: string | undefined): Army | undefined {
  if (!ref) return undefined;
  const byId = state.armies.find((a) => a.id === ref);
  if (byId) return byId;
  const n = norm(ref);
  return state.armies.find((a) => norm(a.name) === n);
}

// ---------------------------------------------------------------------------
// Applying changes

const PALETTE = ["#8e6c8a", "#6c8e7a", "#a0785a", "#5a7fa0", "#a05a6c", "#7a9a4a", "#c0905a", "#5aa0a0", "#9a6ac0", "#c06a4a"];

function setRelation(state: GameState, a: string, b: string, status: RelationStatus | "neutral") {
  state.relations = state.relations.filter((r) => !((r.a === a && r.b === b) || (r.a === b && r.b === a)));
  if (status !== "neutral") state.relations.push({ a, b, status, since: state.date });
}

function setOwner(state: GameState, map: MapData, regionId: string, owner: string) {
  if (map.regions[regionId].o === owner) delete state.owners[regionId];
  else state.owners[regionId] = owner;
}

/** Marks countries without provinces as dead and ends their wars and alliances. */
function cleanupDeadCountries(state: GameState, map: MapData): string[] {
  const notes: string[] = [];
  const owned = new Set(map.ids.map((id) => ownerOf(state, map, id)));
  for (const c of Object.values(state.countries)) {
    if (c.alive && !owned.has(c.id)) {
      c.alive = false;
      state.relations = state.relations.filter((r) => r.a !== c.id && r.b !== c.id);
      state.armies = state.armies.filter((a) => a.owner !== c.id);
      notes.push(`${c.name} прекращает существование`);
    }
    if (!c.alive && owned.has(c.id)) c.alive = true;
  }
  return notes;
}

/** Applies one change in place. Returns a note for the player, or null when the change was invalid. */
export function applyChange(state: GameState, map: MapData, ch: Change): string | null {
  switch (ch.type) {
    case "transfer": {
      const to = resolveCountry(state, ch.to);
      if (!to) return null;
      const ids = (ch.regions ?? []).flatMap((r) => resolveRegions(state, map, r));
      const moved = ids.filter((id) => ownerOf(state, map, id) !== to);
      if (!moved.length) return null;
      moved.forEach((id) => setOwner(state, map, id, to));
      // Armies standing in lost provinces retreat to the nearest own province (or are lost).
      for (const army of state.armies) {
        if (moved.includes(army.region) && army.owner !== to) relocateArmy(state, map, army);
      }
      const names = moved.slice(0, 4).map((id) => map.regions[id].n).join(", ");
      return `${countryName(state, to)} получает: ${names}${moved.length > 4 ? ` и ещё ${moved.length - 4}` : ""}`;
    }
    case "annex": {
      const victim = resolveCountry(state, ch.country);
      const to = resolveCountry(state, ch.to);
      if (!victim || !to || victim === to) return null;
      const ids = regionsOf(state, map, victim);
      ids.forEach((id) => setOwner(state, map, id, to));
      state.armies = state.armies.filter((a) => a.owner !== victim);
      return `${countryName(state, to)} присоединяет ${countryName(state, victim)}`;
    }
    case "create_country": {
      if (!ch.name) return null;
      const ids = (ch.regions ?? []).flatMap((r) => resolveRegions(state, map, r));
      if (!ids.length) return null;
      let id = (ch.country || "").toUpperCase();
      if (!/^[A-Z]{3}$/.test(id) || state.countries[id]?.alive) {
        id = "";
        const letters = (ch.name.match(/[A-Za-z]/g) || []).join("").toUpperCase();
        for (let i = 0; i < 100 && !id; i++) {
          const cand = (letters.slice(0, 2) || "NX") + String.fromCharCode(65 + (i % 26));
          if (!state.countries[cand]) id = cand;
        }
        if (!id) id = `N${state.nextId % 100}`;
      }
      const used = new Set(Object.values(state.countries).map((c) => c.color));
      const color = ch.color && /^#[0-9a-f]{6}$/i.test(ch.color) ? ch.color : PALETTE.find((p) => !used.has(p)) ?? PALETTE[0];
      state.countries[id] = {
        id,
        name: ch.name,
        color,
        leader: ch.leader || "неизвестно",
        government: ch.government || "временное правительство",
        description: ch.text || "",
        major: false,
        alive: true,
      };
      ids.forEach((r) => setOwner(state, map, r, id));
      return `Образовано новое государство: ${ch.name}`;
    }
    case "relation": {
      const a = resolveCountry(state, ch.a);
      const b = resolveCountry(state, ch.b);
      const status = ch.status;
      if (!a || !b || a === b || !status) return null;
      if (status !== "neutral" && !RELATION_LABEL[status]) return null;
      setRelation(state, a, b, status);
      if (status === "neutral") return `${countryName(state, a)} и ${countryName(state, b)}: отношения нормализованы`;
      return `${countryName(state, a)} и ${countryName(state, b)}: ${RELATION_LABEL[status]}`;
    }
    case "leader": {
      const c = resolveCountry(state, ch.country);
      if (!c || !ch.leader) return null;
      state.countries[c].leader = ch.leader;
      return `${countryName(state, c)}: новый руководитель (${ch.leader})`;
    }
    case "government": {
      const c = resolveCountry(state, ch.country);
      if (!c || !ch.government) return null;
      state.countries[c].government = ch.government;
      return `${countryName(state, c)}: ${ch.government}`;
    }
    case "rename": {
      const c = resolveCountry(state, ch.country);
      if (!c || !ch.name) return null;
      const old = state.countries[c].name;
      state.countries[c].name = ch.name;
      return `${old} теперь называется ${ch.name}`;
    }
    case "description": {
      const c = resolveCountry(state, ch.country);
      if (!c || !ch.text) return null;
      state.countries[c].description = ch.text;
      return null;
    }
    case "army_create": {
      const owner = resolveCountry(state, ch.country);
      const region = ch.region ? resolveRegions(state, map, ch.region)[0] : undefined;
      if (!owner || !region || !ch.name) return null;
      state.armies.push({
        id: newId(state, "a"),
        owner,
        name: ch.name,
        region,
        size: Math.max(1, Math.round(ch.size ?? 50)),
        kind: ch.kind === "fleet" ? "fleet" : "army",
      });
      return `${countryName(state, owner)} формирует: ${ch.name}`;
    }
    case "army_move": {
      const army = resolveArmy(state, ch.army);
      const region = ch.region ? resolveRegions(state, map, ch.region)[0] : undefined;
      if (!army || !region) return null;
      army.region = region;
      return `${army.name} → ${map.regions[region].n}`;
    }
    case "army_size": {
      const army = resolveArmy(state, ch.army);
      if (!army || typeof ch.size !== "number") return null;
      army.size = Math.max(1, Math.round(ch.size));
      return null;
    }
    case "army_destroy": {
      const army = resolveArmy(state, ch.army);
      if (!army) return null;
      state.armies = state.armies.filter((a) => a !== army);
      return `${army.name} уничтожена или распущена`;
    }
    case "message": {
      const from = resolveCountry(state, ch.country);
      if (!from || from === state.player || !ch.text) return null;
      let chat = state.chats.find((c) => c.participants.length === 1 && c.participants[0] === from);
      if (!chat) {
        chat = { id: newId(state, "c"), participants: [from], messages: [], unread: true };
        state.chats.push(chat);
      }
      chat.messages.push({ id: newId(state, "m"), from, text: ch.text, date: state.date });
      chat.unread = true;
      return `Новое послание: ${countryName(state, from)}`;
    }
    default:
      return null;
  }
}

function relocateArmy(state: GameState, map: MapData, army: Army) {
  const seen = new Set([army.region]);
  let frontier = [army.region];
  for (let depth = 0; depth < 6 && frontier.length; depth++) {
    const next: string[] = [];
    for (const r of frontier) {
      for (const n of map.neighbors[r] ?? []) {
        if (seen.has(n)) continue;
        seen.add(n);
        if (ownerOf(state, map, n) === army.owner) {
          army.region = n;
          return;
        }
        next.push(n);
      }
    }
    frontier = next;
  }
  state.armies = state.armies.filter((a) => a !== army);
}

/** Applies an event: moves the date forward, records it and applies its changes. */
export function applyEvent(state: GameState, map: MapData, ev: GameEvent): GameEvent {
  if (ev.date > state.date) state.date = ev.date;
  const notes: string[] = [];
  for (const ch of ev.changes) {
    try {
      const note = applyChange(state, map, ch);
      if (note) notes.push(note);
    } catch (e) {
      console.warn("change failed", ch, e);
    }
  }
  notes.push(...cleanupDeadCountries(state, map));
  const recorded = { ...ev, applied: notes };
  state.events.push(recorded);
  return recorded;
}

// ---------------------------------------------------------------------------
// Dates

const MONTHS = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];

export function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

export function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function addMonths(iso: string, months: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + months);
  return d.toISOString().slice(0, 10);
}

export function isValidDate(s: unknown): s is string {
  return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));
}
