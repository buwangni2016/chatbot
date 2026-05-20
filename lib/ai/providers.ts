import { createAnthropic } from "@ai-sdk/anthropic";
import { isTestEnvironment } from "../constants";

let _provider: ReturnType<typeof createAnthropic> | null = null;

function getProvider() {
  if (!_provider) {
    _provider = createAnthropic({
      apiKey: process.env.ANTHROPIC_API_KEY ?? "",
      baseURL: process.env.ANTHROPIC_BASE_URL
        ? `${process.env.ANTHROPIC_BASE_URL}/v1`
        : "https://api.anthropic.com/v1",
    });
  }
  return _provider;
}

export function getLanguageModel(modelId: string) {
  if (isTestEnvironment) {
    // In test environment, return a mock
    const { customProvider } = require("ai");
    const { chatModel } = require("./models.mock");
    return customProvider({ languageModels: { [modelId]: chatModel } }).languageModel(modelId);
  }
  // Strip provider prefix if present (gateway uses "anthropic/model-id" format)
  const id = modelId.includes("/") ? modelId.split("/").slice(1).join("/") : modelId;
  return getProvider()(id);
}

export function getTitleModel() {
  return getProvider()("claude-3-5-haiku-20241022");
}
