import { ModelConfig, AiProvider } from "./base-provider";
import { MercuryProvider } from "./mercury-provider";
import { GeminiProvider } from "./gemini-provider";
import { OpenAIProvider } from "./openai-provider";
import { AnthropicProvider } from "./anthropic-provider";
import { OpenRouterProvider } from "./openrouter-provider";

export const SYSTEM_MODELS: ModelConfig[] = [
  { model: "mercury-2", maxContextTokens: 80000, supportsTools: false, supportsStreaming: false }
];

export const GEMINI_MODELS: ModelConfig[] = [
  { model: "gemini-2.5-pro", maxContextTokens: 1000000, supportsTools: true, supportsStreaming: true },
  { model: "gemini-2.5-flash", maxContextTokens: 1000000, supportsTools: true, supportsStreaming: true }
];

export const OPENAI_MODELS: ModelConfig[] = [
  { model: "gpt-4o", maxContextTokens: 128000, supportsTools: true, supportsStreaming: true },
  { model: "gpt-4o-mini", maxContextTokens: 128000, supportsTools: true, supportsStreaming: true }
];

export const ANTHROPIC_MODELS: ModelConfig[] = [
  { model: "claude-3-5-sonnet-latest", maxContextTokens: 200000, supportsTools: true, supportsStreaming: true },
  { model: "claude-3-5-haiku-latest", maxContextTokens: 200000, supportsTools: true, supportsStreaming: true }
];

export function getProvider(provider: string, apiKey: string, model: string): AiProvider {
  const normProvider = provider.toLowerCase();
  switch (normProvider) {
    case "system":
    case "mercury":
      return new MercuryProvider(apiKey);
    case "gemini":
      return new GeminiProvider(apiKey, model);
    case "openai":
      return new OpenAIProvider(apiKey, model);
    case "anthropic":
      return new AnthropicProvider(apiKey, model);
    case "openrouter":
      return new OpenRouterProvider(apiKey, model);
    default:
      throw new Error(`Unsupported provider: ${provider}`);
  }
}

export function getModelConfig(provider: string, model: string): ModelConfig {
  const normProvider = provider.toLowerCase();
  let list: ModelConfig[] = [];

  if (normProvider === "system" || normProvider === "mercury") {
    list = SYSTEM_MODELS;
  } else if (normProvider === "gemini") {
    list = GEMINI_MODELS;
  } else if (normProvider === "openai") {
    list = OPENAI_MODELS;
  } else if (normProvider === "anthropic") {
    list = ANTHROPIC_MODELS;
  } else if (normProvider === "openrouter") {
    return { model, maxContextTokens: 128000, supportsTools: true, supportsStreaming: true };
  }

  const found = list.find((m) => m.model === model);
  if (found) return found;

  // Fallback defaults
  return { model, maxContextTokens: 80000, supportsTools: false, supportsStreaming: false };
}
