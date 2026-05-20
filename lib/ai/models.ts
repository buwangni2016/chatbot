export const DEFAULT_CHAT_MODEL = "anthropic/claude-3-5-haiku-20241022";

export const titleModel = {
  id: "anthropic/claude-3-5-haiku-20241022",
  name: "Claude Haiku 3.5",
  provider: "anthropic",
  description: "Fast model for title generation",
  gatewayOrder: ["anthropic"],
};

export type ModelCapabilities = {
  tools: boolean;
  vision: boolean;
  reasoning: boolean;
};

export type ChatModel = {
  id: string;
  name: string;
  provider: string;
  description: string;
  gatewayOrder?: string[];
  reasoningEffort?: "none" | "minimal" | "low" | "medium" | "high";
};

export const chatModels: ChatModel[] = [
  {
    id: "anthropic/claude-3-5-haiku-20241022",
    name: "Claude Haiku 3.5",
    provider: "anthropic",
    description: "Fast and efficient Claude model",
    gatewayOrder: ["anthropic"],
  },
  {
    id: "anthropic/claude-3-5-sonnet-20241022",
    name: "Claude Sonnet 3.5",
    provider: "anthropic",
    description: "Balanced Claude model",
    gatewayOrder: ["anthropic"],
  },
  {
    id: "anthropic/claude-opus-4-5-20251101",
    name: "Claude Opus 4.5",
    provider: "anthropic",
    description: "Most capable Claude model",
    gatewayOrder: ["anthropic"],
  },
];

export const allowedModelIds = chatModels.map((m) => m.id);

export async function getCapabilities(): Promise<
  Record<string, ModelCapabilities>
> {
  return Object.fromEntries(
    chatModels.map((m) => [
      m.id,
      { tools: true, vision: true, reasoning: false },
    ])
  );
}
