import Anthropic from "@anthropic-ai/sdk";
import type { Env } from "./env";
import type { AiRequest, ProviderId, StreamFormat } from "../shared/api";
import { mockStream } from "./mock";

// The Worker only builds the provider request and pipes the provider's event
// stream back unchanged; the browser parses it. This keeps Worker CPU time
// tiny (the free plan allows 10 ms per request).

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

// Gemini's native API. New AI Studio keys (prefix "AQ.") only work when sent in
// the x-goog-api-key header, not as a Bearer token on the OpenAI-compatible route.
const geminiUrl = (model: string) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:streamGenerateContent?alt=sse`;

// A war game trips the default safety filters too easily.
const GEMINI_SAFETY = ["HARM_CATEGORY_HARASSMENT", "HARM_CATEGORY_HATE_SPEECH", "HARM_CATEGORY_SEXUALLY_EXPLICIT", "HARM_CATEGORY_DANGEROUS_CONTENT"].map(
  (category) => ({ category, threshold: "BLOCK_ONLY_HIGH" }),
);

function geminiRequest(key: string, req: AiRequest, maxTokens: number, limitThinking: boolean): Promise<Response> {
  return fetch(geminiUrl(req.model), {
    method: "POST",
    headers: { "x-goog-api-key": key, "content-type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemWithSchema(req) }] },
      contents: req.messages.map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] })),
      safetySettings: GEMINI_SAFETY,
      generationConfig: {
        maxOutputTokens: maxTokens,
        ...(req.schema ? { responseMimeType: "application/json" } : {}),
        // Hidden reasoning counts against maxOutputTokens; keep it short so the answer fits.
        ...(limitThinking ? { thinkingConfig: { thinkingBudget: 1024 } } : {}),
      },
    }),
  });
}

/** Free fallback when Gemini's free quota runs out or no Gemini key is set. */
const WORKERS_AI_FALLBACK = "@cf/meta/llama-4-scout-17b-16e-instruct";

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

      case "gemini": {
        const key = env.GEMINI_API_KEY;
        const fallback = async (reason: string) =>
          streamResponse(await runWorkersAi(env, req, WORKERS_AI_FALLBACK, maxTokens), "workersai", {
            "x-provider-fallback": "workersai",
            "x-fallback-reason": reason.replace(/[^\x20-\x7e]/g, " ").slice(0, 300),
          });
        if (!key) {
          if (env.AI) return fallback("GEMINI_API_KEY not set");
          return errorResponse(400, "Не задан ключ GEMINI_API_KEY");
        }
        let res = await geminiRequest(key, req, maxTokens, true);
        // Some models reject the thinking budget; try once more without it.
        if (res.status === 400) res = await geminiRequest(key, req, maxTokens, false);
        // Any Gemini failure (exhausted quota, bad key, unsupported region, overload) falls back
        // to Workers AI so the game keeps going; the reason travels in a response header.
        if (!res.ok) {
          const reason = `gemini ${res.status}: ${(await res.text()).slice(0, 250)}`;
          if (env.AI) return fallback(reason);
          return errorResponse(res.status, reason);
        }
        return streamResponse(res.body, "gemini", { "x-ai-provider": "gemini" });
      }

      case "openrouter": {
        const key = env.OPENROUTER_API_KEY;
        if (!key) return errorResponse(400, "Не задан ключ OPENROUTER_API_KEY");
        const res = await fetch(OPENROUTER_URL, {
          method: "POST",
          headers: { authorization: `Bearer ${key}`, "content-type": "application/json", "x-title": "Strategia" },
          body: JSON.stringify({
            model: req.model,
            max_tokens: maxTokens,
            stream: true,
            messages: [{ role: "system", content: systemWithSchema(req) }, ...req.messages],
          }),
        });
        if (!res.ok) return errorResponse(res.status, `openrouter: ${(await res.text()).slice(0, 600)}`);
        return streamResponse(res.body, "openai", { "x-ai-provider": "openrouter" });
      }

      case "workersai": {
        if (!env.AI) return errorResponse(400, "Workers AI не подключён");
        return streamResponse(await runWorkersAi(env, req, req.model, maxTokens), "workersai", { "x-ai-provider": "workersai" });
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
