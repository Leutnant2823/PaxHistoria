import type { AiRequest, GameMeta, ServerConfig, SnapshotMeta, StreamFormat } from "../shared/api";

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

async function request(path: string, init: RequestInit = {}): Promise<Response> {
  const res = await fetch(path, { credentials: "same-origin", ...init });
  if (!res.ok) {
    let message = `Ошибка ${res.status}`;
    try {
      const body = await res.clone().json();
      if (body?.error) message = body.error;
    } catch {
      /* not JSON */
    }
    throw new ApiError(message, res.status);
  }
  return res;
}

export const api = {
  login: (username: string, password: string) =>
    request("/api/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username, password }),
    }),
  logout: () => request("/api/logout", { method: "POST" }),
  config: async (): Promise<ServerConfig> => (await request("/api/config")).json(),
  listGames: async (): Promise<GameMeta[]> => (await request("/api/games")).json(),
  loadGame: async <T>(id: string): Promise<T> => decode<T>(await (await request(`/api/games/${id}`)).text()),
  saveGame: async (meta: Omit<GameMeta, "createdAt" | "updatedAt">, state: unknown) =>
    request(`/api/games/${meta.id}`, {
      method: "PUT",
      headers: { "x-game-meta": encodeURIComponent(JSON.stringify(meta)), "content-type": "text/plain" },
      body: await encode(state),
    }),
  deleteGame: (id: string) => request(`/api/games/${id}`, { method: "DELETE" }),
  listSnapshots: async (id: string): Promise<SnapshotMeta[]> => (await request(`/api/games/${id}/snapshots`)).json(),
  loadSnapshot: async <T>(id: string, turn: number): Promise<T> =>
    decode<T>(await (await request(`/api/games/${id}/snapshots/${turn}`)).text()),
  saveSnapshot: async (id: string, turn: number, gameDate: string, state: unknown) =>
    request(`/api/games/${id}/snapshots/${turn}`, {
      method: "PUT",
      headers: { "x-game-meta": encodeURIComponent(JSON.stringify({ gameDate })), "content-type": "text/plain" },
      body: await encode(state),
    }),
  deleteSnapshotsAfter: (id: string, turn: number) =>
    request(`/api/games/${id}/snapshots?after=${turn}`, { method: "DELETE" }),
};

// ---------------------------------------------------------------------------
// gzip + base64 so the Worker can store saves as text without touching them

async function encode(value: unknown): Promise<string> {
  const stream = new Blob([JSON.stringify(value)]).stream().pipeThrough(new CompressionStream("gzip"));
  const bytes = new Uint8Array(await new Response(stream).arrayBuffer());
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

async function decode<T>(text: string): Promise<T> {
  const bin = atob(text);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"));
  return JSON.parse(await new Response(stream).text()) as T;
}

// ---------------------------------------------------------------------------
// AI streaming

export interface AiProgress {
  text: string;
  thinking: boolean;
}

/** Extracts the text delta from one SSE data payload of the given format. */
function deltaOf(format: StreamFormat, data: unknown): { text?: string; thinking?: boolean; error?: string; refusal?: boolean } {
  const d = data as Record<string, any>;
  if (format === "anthropic") {
    if (d.type === "content_block_delta" && d.delta?.type === "text_delta") return { text: d.delta.text };
    if (d.type === "content_block_start" && d.content_block?.type === "thinking") return { thinking: true };
    if (d.type === "error") return { error: d.error?.message ?? "ошибка провайдера" };
    if (d.type === "message_delta" && d.delta?.stop_reason === "refusal") return { refusal: true };
    return {};
  }
  if (format === "openai") {
    if (d.error) return { error: d.error.message ?? String(d.error) };
    return { text: d.choices?.[0]?.delta?.content ?? "" };
  }
  // workersai: {"response": "..."} or OpenAI-style chunks from newer models
  if (typeof d.response === "string") return { text: d.response };
  return { text: d.choices?.[0]?.delta?.content ?? "" };
}

export async function callAi(req: AiRequest, onProgress?: (p: AiProgress) => void, signal?: AbortSignal): Promise<string> {
  const res = await request("/api/ai", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(req),
    signal,
  });
  const format = (res.headers.get("x-stream-format") || "anthropic") as StreamFormat;
  const reader = res.body!.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";
  let text = "";
  let thinking = false;
  let refusal = false;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += value;
    let idx: number;
    while ((idx = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, idx).trim();
      buffer = buffer.slice(idx + 1);
      if (!line.startsWith("data:")) continue;
      const payload = line.slice(5).trim();
      if (!payload || payload === "[DONE]") continue;
      let data: unknown;
      try {
        data = JSON.parse(payload);
      } catch {
        continue;
      }
      const delta = deltaOf(format, data);
      if (delta.error) throw new ApiError(delta.error, 502);
      if (delta.refusal) refusal = true;
      if (delta.thinking) thinking = true;
      if (delta.text) {
        text += delta.text;
        thinking = false;
      }
      onProgress?.({ text, thinking });
    }
  }
  if (refusal && !text.trim()) throw new ApiError("Модель отказалась отвечать на этот запрос. Попробуйте переформулировать.", 422);
  return text;
}

/** Parses JSON from a model answer, tolerating code fences and surrounding text. */
export function parseJson<T>(text: string): T {
  const cleaned = text.replace(/```(?:json)?/gi, "").trim();
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start >= 0 && end > start) return JSON.parse(cleaned.slice(start, end + 1)) as T;
    throw new Error("ИИ вернул ответ не в формате JSON");
  }
}
