export const DEFAULT_CHAT_MODEL = "anthropic/claude-3-5-haiku-20241022";
export const isDemo = false;

export const titleModel = {
  id: "anthropic/claude-3-5-haiku-20241022",
  name: "Claude Haiku 3.5",
  provider: "anthropic",
  description: "Fast model for title generation",
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
  capabilities?: ModelCapabilities;
  reasoningEffort?: "none" | "minimal" | "low" | "medium" | "high";
};

export const chatModels: ChatModel[] = [
  {
    id: "anthropic/claude-haiku-4-5-20251001",
    name: "Claude Haiku 4.5",
    provider: "anthropic",
    description: "Fast and efficient",
  },
  {
    id: "anthropic/claude-3-5-haiku-20241022",
    name: "Claude Haiku 3.5",
    provider: "anthropic",
    description: "Fast model",
  },
  {
    id: "anthropic/claude-3-5-sonnet-20241022",
    name: "Claude Sonnet 3.5",
    provider: "anthropic",
    description: "Balanced model",
  },
];

export const allowedModelIds = new Set(chatModels.map((m) => m.id));

export async function getAllGatewayModels(): Promise<ChatModel[]> {
  return chatModels;
}

export async function getCapabilities(): Promise<Record<string, ModelCapabilities>> {
  return Object.fromEntries(
    chatModels.map((m) => [m.id, { tools: true, vision: true, reasoning: false }])
  );
}
