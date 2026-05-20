import { createAnthropic } from "@ai-sdk/anthropic";

const anthropic = createAnthropic({
  apiKey: process.env.ANTHROPIC_API_KEY ?? "",
  baseURL: process.env.ANTHROPIC_BASE_URL
    ? `${process.env.ANTHROPIC_BASE_URL}/v1`
    : "https://api.anthropic.com/v1",
});

export function getLanguageModel(modelId: string) {
  return anthropic(modelId);
}

export function getTitleModel() {
  return anthropic("claude-haiku-4-5-20251001");
}
