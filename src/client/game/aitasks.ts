import type { AiMessage, AiRequest, ProviderId } from "../../shared/api";
import { callAi, parseJson, type AiProgress } from "../api";
import type { MapData } from "./mapdata";
import type { Chat, Change, EventKind, GameEvent, GameState, PromptKey } from "./types";
import { addDays, addMonths, countryName, formatDate, isValidDate, relationOf, RELATION_LABEL } from "./engine";
import { chatTranscript, countryLine, fullContext, relationsText, worldOverview } from "./context";
import { DIFFICULTY_TEXT, fill, promptFor } from "./prompts";

export const MODEL_PRESETS: Record<ProviderId, { id: string; label: string }[]> = {
  anthropic: [
    { id: "claude-haiku-5-5", label: "Claude Haiku 5.5 (лёгкая, дешёвая)" },
    { id: "claude-sonnet-5-5", label: "Claude Sonnet 5.5 (средняя)" },
    { id: "claude-opus-5-5", label: "Claude Opus 5.5 (максимальная)" },
  ],
  gemini: [
    { id: "gemini-flash-latest", label: "Gemini Flash (бесплатный дневной лимит)" },
    { id: "gemini-flash-lite-latest", label: "Gemini Flash-Lite (бесплатно, лимит больше, качество ниже)" },
    { id: "gemini-2.5-flash", label: "Gemini 2.5 Flash (бесплатный дневной лимит)" },
  ],
  openrouter: [
    { id: "deepseek/deepseek-chat-v3.1:free", label: "DeepSeek V3.1 (бесплатная версия)" },
    { id: "anthropic/claude-sonnet-5.5", label: "Claude Sonnet 5.5 через OpenRouter" },
    { id: "google/gemini-2.5-flash", label: "Gemini 2.5 Flash через OpenRouter" },
  ],
  workersai: [
    { id: "@cf/meta/llama-4-scout-17b-16e-instruct", label: "Llama 4 Scout (бесплатный лимит Cloudflare)" },
    { id: "@cf/mistralai/mistral-small-3.1-24b-instruct", label: "Mistral Small 3.1 24B" },
    { id: "@cf/meta/llama-3.3-70b-instruct-fp8-fast", label: "Llama 3.3 70B (короткий контекст, для коротких партий)" },
  ],
  mock: [{ id: "mock", label: "Тестовые ответы без ИИ" }],
};

export const PROVIDER_LABEL: Record<ProviderId, string> = {
  anthropic: "Anthropic Claude",
  gemini: "Google Gemini",
  openrouter: "OpenRouter",
  workersai: "Cloudflare Workers AI",
  mock: "Тестовый режим",
};

type Progress = (p: AiProgress) => void;

function baseVars(state: GameState, extra: Record<string, string> = {}): Record<string, string> {
  return {
    PLAYER: `${countryName(state, state.player)} (${state.player})`,
    DATE: formatDate(state.date),
    DIFFICULTY: DIFFICULTY_TEXT[state.settings.difficulty],
    ...extra,
  };
}

function system(state: GameState, key: PromptKey, extra: Record<string, string> = {}): string {
  return fill(promptFor(state, key), baseVars(state, extra));
}

function ai(
  state: GameState,
  task: string,
  sys: string,
  messages: AiMessage[],
  opts: { maxTokens: number; schema?: Record<string, unknown>; effort?: string },
): AiRequest {
  const { provider, model, effort } = state.settings.ai;
  return {
    provider,
    model,
    system: sys,
    messages,
    maxTokens: opts.maxTokens,
    effort: provider === "anthropic" ? opts.effort ?? effort : undefined,
    schema: opts.schema,
    task,
  };
}

// ---------------------------------------------------------------------------
// Jump forward

export type JumpPlan = { mode: "auto" } | { mode: "days"; days: number } | { mode: "months"; months: number };

export function jumpTarget(date: string, plan: JumpPlan): string {
  if (plan.mode === "auto") return addMonths(date, 6);
  if (plan.mode === "days") return addDays(date, Math.max(1, plan.days));
  return addMonths(date, plan.months);
}

export function jumpLabel(plan: JumpPlan): string {
  if (plan.mode === "auto") return "до следующего важного события";
  if (plan.mode === "days") return plan.days === 7 ? "1 неделя" : `${plan.days} дн.`;
  return plan.months === 12 ? "1 год" : `${plan.months} мес.`;
}

const EVENT_KINDS: EventKind[] = ["war", "diplomacy", "politics", "economy", "territory", "military", "society", "disaster", "science", "other"];

const CHANGE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["type"],
  properties: {
    type: {
      type: "string",
      enum: ["transfer", "annex", "create_country", "relation", "leader", "government", "rename", "description", "army_create", "army_move", "army_size", "army_destroy", "message"],
    },
    regions: { type: "array", items: { type: "string" } },
    to: { type: "string" },
    country: { type: "string" },
    a: { type: "string" },
    b: { type: "string" },
    status: { type: "string", enum: ["war", "alliance", "entente", "rival", "truce", "dominion", "neutral"] },
    name: { type: "string" },
    color: { type: "string" },
    leader: { type: "string" },
    government: { type: "string" },
    text: { type: "string" },
    army: { type: "string" },
    region: { type: "string" },
    size: { type: "number" },
    kind: { type: "string", enum: ["army", "fleet"] },
  },
};

const JUMP_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["events"],
  properties: {
    events: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["date", "title", "text", "kind", "countries", "changes"],
        properties: {
          date: { type: "string" },
          title: { type: "string" },
          text: { type: "string" },
          kind: { type: "string", enum: EVENT_KINDS },
          countries: { type: "array", items: { type: "string" } },
          changes: { type: "array", items: CHANGE_SCHEMA },
        },
      },
    },
  },
};

function eventRange(days: number): string {
  if (days <= 10) return "2-4";
  if (days <= 40) return "3-6";
  if (days <= 100) return "5-8";
  if (days <= 200) return "7-11";
  return "10-15";
}

export async function generateJump(
  state: GameState,
  map: MapData,
  plan: JumpPlan,
  onProgress?: Progress,
  signal?: AbortSignal,
): Promise<{ events: GameEvent[]; target: string }> {
  const target = jumpTarget(state.date, plan);
  const days = Math.round((Date.parse(target) - Date.parse(state.date)) / 86400000);
  const key: PromptKey = plan.mode === "auto" ? "jump_auto" : "jump";
  const sys = system(state, key, { TARGET_DATE: formatDate(target), EVENT_RANGE: eventRange(days) });

  const actions = state.pending.length
    ? state.pending.map((a, i) => `${i + 1}. ${a.text}`).join("\n")
    : "Игрок не отдавал приказов в этом ходу.";
  const cheat = state.settings.actionsAlwaysSucceed
    ? "\nОСОБЫЙ РЕЖИМ: приказы игрока исполняются успешно, если они физически возможны."
    : "";
  const user = `${fullContext(state, map)}

ПРИКАЗЫ ИГРОКА НА ЭТОТ ХОД:
${actions}${cheat}

ПЕРИОД: с ${state.date} по ${target}.
ЦЕЛЕВАЯ ДАТА: ${target}`;

  const maxTokens = days > 100 ? 24000 : 14000;
  const request = ai(state, "jump", sys, [{ role: "user", content: user }], { maxTokens, schema: JUMP_SCHEMA });
  // Free models sometimes break the JSON; one silent retry fixes most of those cases.
  let events: GameEvent[] = [];
  for (let attempt = 0; attempt < 2 && !events.length; attempt++) {
    const text = await callAi(request, onProgress, signal);
    try {
      const parsed = parseJson<{ events?: unknown[] } | unknown[]>(text);
      events = sanitizeEvents(state, Array.isArray(parsed) ? parsed : parsed.events ?? [], target);
    } catch (e) {
      if (attempt === 1) throw e;
    }
  }
  if (!events.length) throw new Error("ИИ не вернул ни одного события. Попробуйте ещё раз.");
  return { events, target: plan.mode === "auto" ? events[events.length - 1].date : target };
}

function sanitizeEvents(state: GameState, raw: unknown[], target: string): GameEvent[] {
  const out: GameEvent[] = [];
  for (const item of raw) {
    const e = item as Record<string, unknown>;
    if (!e || typeof e.title !== "string") continue;
    let date = isValidDate(e.date) ? e.date : target;
    if (date < state.date) date = state.date;
    if (date > target) date = target;
    out.push({
      id: "",
      turn: state.turn,
      date,
      title: e.title,
      text: typeof e.text === "string" ? e.text : "",
      kind: EVENT_KINDS.includes(e.kind as EventKind) ? (e.kind as EventKind) : "other",
      countries: Array.isArray(e.countries) ? e.countries.filter((c): c is string => typeof c === "string") : [],
      changes: Array.isArray(e.changes) ? (e.changes.filter((c) => c && typeof (c as Change).type === "string") as Change[]) : [],
    });
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

// ---------------------------------------------------------------------------
// Diplomacy

function speakerContext(state: GameState, map: MapData, speaker: string): string {
  const c = state.countries[speaker];
  const rel = relationOf(state, speaker, state.player);
  const recent = state.events.slice(-15).map((e) => `- ${e.date}: ${e.title}`).join("\n") || "нет";
  return `О твоей стране: ${countryLine(state, map, speaker)}
${c.description}
Отношения с игроком (${countryName(state, state.player)}): ${rel ? RELATION_LABEL[rel.status] : "обычные"}.

Страна игрока: ${countryLine(state, map, state.player)}
${state.countries[state.player].description}

Все особые отношения в мире:
${relationsText(state)}

Последние события:
${recent}`;
}

export async function chatReply(state: GameState, map: MapData, chat: Chat, speaker: string, onProgress?: Progress): Promise<string> {
  const name = countryName(state, speaker);
  const sys = `${system(state, "chat", { SPEAKER: `${name} (${speaker})` })}\n\n${speakerContext(state, map, speaker)}`;
  const others = chat.participants.filter((p) => p !== speaker).map((p) => countryName(state, p));
  const user = `Участники переписки: ${[countryName(state, state.player) + " (игрок)", name, ...others].join(", ")}.

Переписка:
${chatTranscript(state, chat)}

Напиши следующую реплику от лица страны ${name}.`;
  const text = await callAi(ai(state, "chat", sys, [{ role: "user", content: user }], { maxTokens: 3000, effort: "low" }), onProgress);
  return text.trim();
}

export async function nextSpeaker(state: GameState, chat: Chat): Promise<string | null> {
  const options = chat.participants;
  const sys = system(state, "next_speaker");
  const user = `Участники (ID: название): ${options.map((p) => `${p}: ${countryName(state, p)}`).join("; ")}.

Переписка:
${chatTranscript(state, chat, 20)}`;
  const schema = {
    type: "object",
    additionalProperties: false,
    required: ["speaker"],
    properties: { speaker: { type: "string", enum: [...options, "null"] } },
  };
  const text = await callAi(ai(state, "next_speaker", sys, [{ role: "user", content: user }], { maxTokens: 1500, schema, effort: "low" }));
  const { speaker } = parseJson<{ speaker: string | null }>(text);
  return speaker && options.includes(speaker) ? speaker : null;
}

export async function describeAction(state: GameState, chat: Chat): Promise<string> {
  const user = `Переписка с ${chat.participants.map((p) => countryName(state, p)).join(", ")}:\n${chatTranscript(state, chat)}`;
  return (await callAi(ai(state, "describe_action", system(state, "describe_action"), [{ role: "user", content: user }], { maxTokens: 1500, effort: "low" }))).trim();
}

// ---------------------------------------------------------------------------
// Advisor and actions

export async function advisorReply(state: GameState, map: MapData, question: string, onProgress?: Progress): Promise<string> {
  const pending = state.pending.map((a, i) => `${i + 1}. ${a.text}`).join("\n") || "нет";
  const sys = `${system(state, "advisor")}\n\nОБСТАНОВКА:\n${fullContext(state, map)}\n\nПРИКАЗЫ, ПОДГОТОВЛЕННЫЕ НА ЭТОТ ХОД:\n${pending}`;
  const history: AiMessage[] = state.advisor.slice(-12).map((m) => ({ role: m.role === "user" ? "user" : "assistant", content: m.text }));
  const messages: AiMessage[] = [...history, { role: "user", content: question }];
  while (messages.length && messages[0].role !== "user") messages.shift();
  return (await callAi(ai(state, "advisor", sys, messages, { maxTokens: 6000 }), onProgress)).trim();
}

export async function brainstorm(state: GameState, map: MapData): Promise<string[]> {
  const pending = state.pending.map((a) => `- ${a.text}`).join("\n") || "нет";
  const user = `${fullContext(state, map)}\n\nУЖЕ ЗАПЛАНИРОВАНО:\n${pending}`;
  const schema = {
    type: "object",
    additionalProperties: false,
    required: ["ideas"],
    properties: { ideas: { type: "array", items: { type: "string" } } },
  };
  const text = await callAi(ai(state, "brainstorm", system(state, "brainstorm"), [{ role: "user", content: user }], { maxTokens: 4000, schema }));
  const { ideas } = parseJson<{ ideas: string[] }>(text);
  return (ideas ?? []).filter((i) => typeof i === "string" && i.trim()).slice(0, 6);
}

export async function enhanceAction(state: GameState, map: MapData, draft: string): Promise<string> {
  const recent = state.events.slice(-8).map((e) => `- ${e.date}: ${e.title}`).join("\n") || "нет";
  const user = `${countryLine(state, map, state.player)}\nОтношения:\n${relationsText(state)}\nПоследние события:\n${recent}\n\nЧЕРНОВИК ПРИКАЗА:\n${draft}`;
  return (await callAi(ai(state, "enhance", system(state, "enhance"), [{ role: "user", content: user }], { maxTokens: 2000, effort: "low" }))).trim();
}

// ---------------------------------------------------------------------------
// Chronicle: every 5 turns old events are condensed and the lore is rewritten

export const CHRONICLE_EVERY = 5;

export function chronicleDue(state: GameState): { from: number; to: number } | null {
  const last = state.summaries.length ? state.summaries[state.summaries.length - 1].toTurn : 0;
  const completed = state.turn - 1;
  return completed - last >= CHRONICLE_EVERY ? { from: last + 1, to: completed } : null;
}

export async function writeChronicle(state: GameState, map: MapData, range: { from: number; to: number }) {
  const events = state.events.filter((e) => e.turn >= range.from && e.turn <= range.to);
  const actions = state.turns
    .filter((t) => t.turn >= range.from && t.turn <= range.to)
    .flatMap((t) => t.actions.map((a) => `- (ход ${t.turn}) ${a.text}`));
  const user = `ПРЕЖНЯЯ ЛЕТОПИСЬ:
${state.lore || "(пока пусто)"}

КРАТКО О МИРЕ СЕЙЧАС:
${worldOverview(state, map).slice(0, 6000)}

ПРИКАЗЫ ИГРОКА ЗА ХОДЫ ${range.from}-${range.to}:
${actions.join("\n") || "нет"}

НОВЫЕ СОБЫТИЯ (ходы ${range.from}-${range.to}):
${events.map((e) => `- ${e.date}: ${e.title}. ${e.text}${e.applied?.length ? ` [${e.applied.join("; ")}]` : ""}`).join("\n")}`;
  const schema = {
    type: "object",
    additionalProperties: false,
    required: ["summary", "lore"],
    properties: { summary: { type: "string" }, lore: { type: "string" } },
  };
  const text = await callAi(ai(state, "chronicle", system(state, "chronicle"), [{ role: "user", content: user }], { maxTokens: 8000, schema }));
  return parseJson<{ summary: string; lore: string }>(text);
}
