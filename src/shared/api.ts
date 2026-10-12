// Types shared by the browser and the Worker.

export type ProviderId = "anthropic" | "gemini" | "openrouter" | "workersai" | "mock";

export interface AiMessage {
  role: "user" | "assistant";
  content: string;
}

export interface AiRequest {
  provider: ProviderId;
  model: string;
  system: string;
  messages: AiMessage[];
  maxTokens: number;
  /** Anthropic only: low | medium | high | xhigh | max */
  effort?: string;
  /** JSON schema of the expected answer; providers without native support get it in the prompt. */
  schema?: Record<string, unknown>;
  /** What the request is for (used by the mock provider and for logs). */
  task: string;
}

/** Format of the event stream the Worker passes through unchanged. */
export type StreamFormat = "anthropic" | "openai" | "workersai";

export interface ServerConfig {
  providers: Record<ProviderId, boolean>;
  user: string;
}

export interface GameMeta {
  id: string;
  name: string;
  country: string;
  gameDate: string;
  turn: number;
  createdAt: number;
  updatedAt: number;
}

export interface SnapshotMeta {
  turn: number;
  gameDate: string;
  createdAt: number;
}
