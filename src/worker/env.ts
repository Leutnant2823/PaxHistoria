export interface Env {
  DB: D1Database;
  AI?: Ai;
  ASSETS: Fetcher;
  AUTH_USER?: string;
  AUTH_PASSWORD?: string;
  ANTHROPIC_API_KEY?: string;
  GEMINI_API_KEY?: string;
  OPENROUTER_API_KEY?: string;
  /** "1" enables the offline mock provider (local testing only). */
  MOCK_AI?: string;
}
