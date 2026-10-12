import type { AiRequest } from "../shared/api";

// Offline provider for local testing (MOCK_AI=1). Emits the Anthropic SSE
// format so the browser exercises the same parsing path as the real thing.

function cannedText(req: AiRequest): string {
  const prompt = req.messages.map((m) => m.content).join("\n");
  switch (req.task) {
    case "jump": {
      const from = /ТЕКУЩАЯ ДАТА: (\d{4}-\d{2}-\d{2})/.exec(prompt)?.[1] ?? "1911-01-01";
      const to = /ЦЕЛЕВАЯ ДАТА: (\d{4}-\d{2}-\d{2})/.exec(prompt)?.[1] ?? from;
      const ids = [...prompt.matchAll(/\[([A-Z]{3}\d+)\]/g)].map((m) => m[1]);
      const region = ids[ids.length - 1];
      const mid = new Date((Date.parse(from) + Date.parse(to)) / 2).toISOString().slice(0, 10);
      return JSON.stringify({
        events: [
          {
            date: mid,
            title: "Тестовое событие: переговоры в Берлине",
            text: "Это тестовый ответ без настоящего ИИ. Канцлер Бетман-Гольвег принимает послов и обсуждает морскую гонку.",
            kind: "diplomacy",
            countries: ["GER", "GBR"],
            changes: [{ type: "relation", a: "GER", b: "GBR", status: "rival" }],
          },
          {
            date: to,
            title: "Тестовое событие: пограничный инцидент",
            text: "Тестовая передача провинции, чтобы проверить перекраску карты.",
            kind: "territory",
            countries: ["GER"],
            changes: region ? [{ type: "transfer", regions: [region], to: "GER" }] : [],
          },
        ],
      });
    }
    case "brainstorm":
      return JSON.stringify({
        ideas: [
          "Предложить Великобритании морское соглашение об ограничении строительства дредноутов",
          "Увеличить военный бюджет и провести манёвры в Восточной Пруссии",
          "Отправить канонерку в Агадир, чтобы надавить на Францию в марокканском вопросе",
        ],
      });
    case "next_speaker":
      return JSON.stringify({ speaker: null });
    case "chronicle":
      return JSON.stringify({
        summary: "Тестовая сводка: несколько ходов прошли без потрясений.",
        lore: "Тестовая летопись. Подключите настоящего провайдера ИИ, чтобы получить связный рассказ о партии.",
      });
    case "describe_action":
      return "Заключить с собеседником соглашение, о котором договорились в переписке.";
    default:
      return `Тестовый ответ (${req.task}). Подключите настоящего провайдера ИИ в настройках, чтобы получить осмысленный текст.`;
  }
}

export function mockStream(req: AiRequest): ReadableStream {
  const text = cannedText(req);
  const enc = new TextEncoder();
  const chunks = text.match(/[\s\S]{1,40}/g) ?? [];
  return new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) =>
        controller.enqueue(enc.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      send("message_start", { type: "message_start" });
      send("content_block_start", { type: "content_block_start", index: 0, content_block: { type: "text", text: "" } });
      for (const c of chunks) {
        send("content_block_delta", { type: "content_block_delta", index: 0, delta: { type: "text_delta", text: c } });
        await new Promise((r) => setTimeout(r, 15));
      }
      send("message_delta", { type: "message_delta", delta: { stop_reason: "end_turn" }, usage: { output_tokens: chunks.length } });
      send("message_stop", { type: "message_stop" });
      controller.close();
    },
  });
}
