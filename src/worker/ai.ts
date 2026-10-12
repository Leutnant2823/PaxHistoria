import Anthropic from "@anthropic-ai/sdk";
import type { Env } from "./env";
import type { AiRequest, ProviderId, StreamFormat } from "../shared/api";
import { mockStream } from "./mock";

// The Worker only builds the provider request and pipes the provider's event
// stream back unchanged; the browser parses it. This keeps Worker CPU time
// tiny (the free plan allows 10 ms per request).

const OPENAI_COMPAT: Record<"gemini" | "openrouter", { url: string; key: (env: Env) => string | undefined }> = {
  gemini: {
    url: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
    key: (env) => env.GEMINI_API_KEY,
  },
  openrouter: {
    url: "https://openrouter.ai/api/v1/chat/completions",
    key: (env) => env.OPENROUTER_API_KEY,
  },
};

/** Free fallback when Gemini's free quota runs out or no Gemini key is set. */
const WORKERS_AI_FALLBACK = "@cf/meta/llama-4-scout-17b-16e-instruct";
// Gemini answers 429 on an exhausted quota; 5xx when overloaded.
const FALLBACK_STATUSES = new Set([429, 500, 502, 503, 504]);

// Server-side refusal fallback ("default" routing) exists for these models.
const FALLBACK_MODELS = new Set(["claude-opus-5-5", "claude-sonnet-5-5", "claude-fable-5-1", "claude-opus-5"]);

export function availableProviders(env: Env): Record<ProviderId, boolean> {
  return {
    anthropic: !!env.ANTHROPIC_API_KEY,
    gemini: !!env.GEMINI_API_KEY,
    openrouter: !!env.OPENROUTER_API_KEY,
    workersai: !!env.AI,
    mock: env.MOCK_AI === "1",
  };
}

function streamResponse(body: ReadableStream | null, format: StreamFormat, extra: Record<string, string> = {}): Response {
  return new Response(body, {
    headers: { "content-type": "text/event-stream; charset=utf-8", "x-stream-format": format, "cache-control": "no-store", ...extra },
  });
}

async function runWorkersAi(env: Env, req: AiRequest, model: string, maxTokens: number): Promise<ReadableStream> {
  const run = (limit: number) =>
    env.AI!.run(model as Parameters<Ai["run"]>[0], {
      messages: [{ role: "system", content: systemWithSchema(req) }, ...req.messages],
      max_tokens: limit,
      stream: true,
    } as never) as unknown as Promise<ReadableStream>;
  // Output limits differ per model; retry with a smaller one if the first is rejected.
  try {
    return await run(Math.min(maxTokens, 8192));
  } catch {
    return await run(Math.min(maxTokens, 4096));
  }
}

function errorResponse(status: number, message: string): Response {
  return Response.json({ error: message }, { status });
}

/** Providers without native JSON-schema support get the schema inside the system prompt. */
function systemWithSchema(req: AiRequest): string {
  if (!req.schema) return req.system;
  return `${req.system}\n\nОтветь ТОЛЬКО одним JSON-объектом без пояснений и без markdown, строго по этой JSON-схеме:\n${JSON.stringify(req.schema)}`;
}

export async function handleAi(request: Request, env: Env): Promise<Response> {
  const req = (await request.json()) as AiRequest;
  if (!req || !Array.isArray(req.messages) || typeof req.system !== "string") {
    return errorResponse(400, "Некорректный запрос к ИИ");
  }
  const maxTokens = Math.min(Math.max(Number(req.maxTokens) || 4000, 256), 64000);

  try {
    switch (req.provider) {
      case "anthropic": {
        if (!env.ANTHROPIC_API_KEY) return errorResponse(400, "Не задан ANTHROPIC_API_KEY");
        const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
        const outputConfig: Record<string, unknown> = {};
        if (req.effort) outputConfig.effort = req.effort;
        if (req.schema) outputConfig.format = { type: "json_schema", schema: req.schema };
        const withFallback = FALLBACK_MODELS.has(req.model);
        const params = {
          model: req.model,
          max_tokens: maxTokens,
          system: req.system,
          messages: req.messages,
          stream: true,
          ...(Object.keys(outputConfig).length ? { output_config: outputConfig } : {}),
          ...(withFallback ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" } : {}),
        };
        // `fallbacks` / `output_config.format` may be newer than the SDK's typings.
        const res = await client.beta.messages
          .create(params as unknown as Anthropic.Beta.Messages.MessageCreateParamsStreaming)
          .asResponse();
        return streamResponse(res.body, "anthropic");
      }

      case "gemini":
      case "openrouter": {
        const cfg = OPENAI_COMPAT[req.provider];
        const key = cfg.key(env);
        const canFallback = req.provider === "gemini" && !!env.AI;
        if (!key && canFallback) {
          return streamResponse(await runWorkersAi(env, req, WORKERS_AI_FALLBACK, maxTokens), "workersai", { "x-provider-fallback": "workersai" });
        }
        if (!key) return errorResponse(400, `Не задан ключ для провайдера ${req.provider}`);
        const res = await fetch(cfg.url, {
          method: "POST",
          headers: {
            authorization: `Bearer ${key}`,
            "content-type": "application/json",
            ...(req.provider === "openrouter" ? { "x-title": "Strategia 1911" } : {}),
          },
          body: JSON.stringify({
            model: req.model,
            max_tokens: maxTokens,
            stream: true,
            messages: [{ role: "system", content: systemWithSchema(req) }, ...req.messages],
          }),
        });
        if (!res.ok && canFallback && FALLBACK_STATUSES.has(res.status)) {
          return streamResponse(await runWorkersAi(env, req, WORKERS_AI_FALLBACK, maxTokens), "workersai", { "x-provider-fallback": "workersai" });
        }
        if (!res.ok) return errorResponse(res.status, `${req.provider}: ${(await res.text()).slice(0, 600)}`);
        return streamResponse(res.body, "openai");
      }

      case "workersai": {
        if (!env.AI) return errorResponse(400, "Workers AI не подключён");
        return streamResponse(await runWorkersAi(env, req, req.model, maxTokens), "workersai");
      }

      case "mock": {
        if (env.MOCK_AI !== "1") return errorResponse(400, "Тестовый провайдер выключен");
        return streamResponse(mockStream(req), "anthropic");
      }

      default:
        return errorResponse(400, "Неизвестный провайдер");
    }
  } catch (e) {
    if (e instanceof Anthropic.APIError) {
      return errorResponse(e.status ?? 502, `Anthropic: ${e.message}`);
    }
    return errorResponse(502, `Ошибка ИИ: ${(e as Error).message}`);
  }
}
