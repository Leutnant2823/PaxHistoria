import type { ProviderId } from "../../shared/api";

export type RelationStatus = "alliance" | "entente" | "war" | "rival" | "truce" | "dominion" | "puppet";

export interface Country {
  id: string;
  name: string;
  color: string;
  leader: string;
  government: string;
  description: string;
  major: boolean;
  capital?: string;
  alive: boolean;
}

export interface Relation {
  a: string;
  b: string;
  status: RelationStatus;
  since: string;
  note?: string;
}

export interface Army {
  id: string;
  owner: string;
  name: string;
  region: string;
  /** thousands of men for armies, capital ships for fleets */
  size: number;
  kind: "army" | "fleet";
}

export type EventKind =
  | "war"
  | "diplomacy"
  | "politics"
  | "economy"
  | "territory"
  | "military"
  | "society"
  | "disaster"
  | "science"
  | "other";

export type ChangeType =
  | "transfer"
  | "annex"
  | "create_country"
  | "relation"
  | "leader"
  | "government"
  | "rename"
  | "description"
  | "army_create"
  | "army_move"
  | "army_size"
  | "army_destroy"
  | "message";

/** One machine-readable consequence of an event. Fields depend on `type`. */
export interface Change {
  type: ChangeType;
  regions?: string[];
  to?: string;
  country?: string;
  a?: string;
  b?: string;
  status?: RelationStatus | "neutral";
  name?: string;
  color?: string;
  leader?: string;
  government?: string;
  text?: string;
  army?: string;
  region?: string;
  size?: number;
  kind?: "army" | "fleet";
}

export interface GameEvent {
  id: string;
  turn: number;
  date: string;
  title: string;
  text: string;
  kind: EventKind;
  countries: string[];
  changes: Change[];
  /** Human-readable notes produced when the changes were applied. */
  applied?: string[];
}

export interface PlayerAction {
  id: string;
  text: string;
}

export interface TurnRecord {
  turn: number;
  from: string;
  to: string;
  actions: PlayerAction[];
  mode: string;
  intervened?: boolean;
}

export interface ChatMessage {
  id: string;
  /** "player", a country id, or "system" */
  from: string;
  text: string;
  date: string;
  /** which AI model wrote the message (shown to the player) */
  by?: string;
}

export interface Chat {
  id: string;
  participants: string[];
  messages: ChatMessage[];
  unread: boolean;
}

export interface AdvisorMessage {
  role: "user" | "advisor";
  text: string;
  date: string;
  /** which AI model wrote the answer (shown to the player) */
  by?: string;
}

export type Difficulty = "very_easy" | "easy" | "normal" | "hard" | "very_hard" | "impossible";

export interface AiSettings {
  provider: ProviderId;
  model: string;
  effort: string;
}

export interface Settings {
  ai: AiSettings;
  difficulty: Difficulty;
  /** show generated events one by one with the option to intervene */
  stepEvents: boolean;
  /** cheat: player's actions always succeed */
  actionsAlwaysSucceed: boolean;
  /** cheat: clicking the map reassigns provinces */
  mapEditor: boolean;
}

export type PromptKey =
  | "jump"
  | "jump_auto"
  | "chat"
  | "next_speaker"
  | "advisor"
  | "brainstorm"
  | "enhance"
  | "describe_action"
  | "chronicle";

export interface Summary {
  fromTurn: number;
  toTurn: number;
  text: string;
}

export interface GameState {
  version: 1;
  id: string;
  name: string;
  scenario: string;
  player: string;
  date: string;
  turn: number;
  settings: Settings;
  countries: Record<string, Country>;
  /** province owners that differ from the scenario start */
  owners: Record<string, string>;
  relations: Relation[];
  armies: Army[];
  events: GameEvent[];
  turns: TurnRecord[];
  pending: PlayerAction[];
  chats: Chat[];
  advisor: AdvisorMessage[];
  /** narrative chronicle shown to the player */
  lore: string;
  /** consolidated summaries of older turns, used as AI context */
  summaries: Summary[];
  prompts: Partial<Record<PromptKey, string>>;
  nextId: number;
}

// ---------------------------------------------------------------------------
// Scenarios

export type CountrySeed = Omit<Country, "id" | "alive">;

export interface ArmySeed {
  owner: string;
  name: string;
  city: string;
  /** thousands of men for armies, capital ships for fleets */
  size: number;
  kind: "army" | "fleet";
}

export interface Scenario {
  id: string;
  /** short headline shown on the scenario card */
  title: string;
  year: string;
  startDate: string;
  defaultPlayer: string;
  intro: string;
  /** URL of the province map built by scripts/build-map.mjs */
  map: string;
  countries: Record<string, CountrySeed>;
  relations: Relation[];
  armies: ArmySeed[];
  /** short names for map labels (used while a country keeps its original name) */
  shortNames: Record<string, string>;
}
