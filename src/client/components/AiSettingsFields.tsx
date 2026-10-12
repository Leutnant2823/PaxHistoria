import type { ProviderId, ServerConfig } from "../../shared/api";
import { MODEL_PRESETS, PROVIDER_LABEL } from "../game/aitasks";
import type { AiSettings } from "../game/types";

// Free providers first: Gemini (free daily quota), then Workers AI (no key needed).
const PROVIDERS: ProviderId[] = ["gemini", "workersai", "anthropic", "openrouter", "mock"];

export function defaultAi(config: ServerConfig): AiSettings {
  const provider = PROVIDERS.find((p) => config.providers[p]) ?? "anthropic";
  const model = provider === "anthropic" ? "claude-opus-5-5" : MODEL_PRESETS[provider][0].id;
  return { provider, model, effort: "medium" };
}

export function AiSettingsFields({
  value,
  onChange,
  config,
}: {
  value: AiSettings;
  onChange: (v: AiSettings) => void;
  config: ServerConfig;
}) {
  const presets = MODEL_PRESETS[value.provider];
  const custom = !presets.some((p) => p.id === value.model);
  return (
    <div className="form-grid">
      <label>
        Провайдер ИИ
        <select
          value={value.provider}
          onChange={(e) => {
            const provider = e.target.value as ProviderId;
            onChange({ ...value, provider, model: MODEL_PRESETS[provider][0].id });
          }}
        >
          {PROVIDERS.filter((p) => p !== "mock" || config.providers.mock).map((p) => (
            <option key={p} value={p}>
              {PROVIDER_LABEL[p]}
              {config.providers[p] ? "" : " (ключ не задан)"}
            </option>
          ))}
        </select>
      </label>
      <label>
        Модель
        <select
          value={custom ? "__custom" : value.model}
          onChange={(e) => onChange({ ...value, model: e.target.value === "__custom" ? "" : e.target.value })}
        >
          {presets.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
          <option value="__custom">Другая модель...</option>
        </select>
      </label>
      {custom && (
        <label>
          Идентификатор модели
          <input value={value.model} onChange={(e) => onChange({ ...value, model: e.target.value.trim() })} placeholder="например, gemini-2.5-flash" />
        </label>
      )}
      {value.provider === "anthropic" && (
        <label>
          Глубина размышлений (effort) для перемотки времени
          <select value={value.effort} onChange={(e) => onChange({ ...value, effort: e.target.value })}>
            <option value="low">Низкая (быстрее и дешевле)</option>
            <option value="medium">Средняя</option>
            <option value="high">Высокая</option>
            <option value="xhigh">Очень высокая (дороже)</option>
          </select>
        </label>
      )}
      {value.provider === "gemini" && config.providers.workersai && (
        <div className="muted small">Когда бесплатный лимит Gemini закончится, запросы автоматически уйдут в Cloudflare Workers AI.</div>
      )}
      {!config.providers[value.provider] && !(value.provider === "gemini" && config.providers.workersai) && (
        <div className="warn-text">Для этого провайдера на сервере не задан ключ API. См. README, раздел про ключи.</div>
      )}
    </div>
  );
}
