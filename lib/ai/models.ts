export const DEFAULT_CHAT_MODEL = "openrouter/anthropic/claude-haiku-4-5-20251001";
export const isDemo = false;

export const titleModel = {
  id: "openrouter/anthropic/claude-haiku-4-5-20251001",
  name: "Claude Haiku 4.5",
  provider: "anthropic",
  description: "Fast model for title generation",
  gatewayOrder: ["anthropic", "openrouter", "fireworks"] as string[],
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
  // Anthropic
  {
    id: "anthropic/claude-haiku-4-5-20251001",
    name: "Claude Haiku 4.5",
    provider: "anthropic",
    description: "Fast and efficient — default for daily use",
    gatewayOrder: ["anthropic", "openrouter"],
    capabilities: { tools: true, vision: false, reasoning: false },
  },
  {
    id: "anthropic/claude-3-5-haiku-20241022",
    name: "Claude Haiku 3.5",
    provider: "anthropic",
    description: "Fast model",
    gatewayOrder: ["anthropic", "openrouter"],
    capabilities: { tools: true, vision: false, reasoning: false },
  },
  {
    id: "anthropic/claude-sonnet-4-20250514",
    name: "Claude Sonnet 4",
    provider: "anthropic",
    description: "Latest Sonnet — best overall quality",
    gatewayOrder: ["anthropic", "openrouter"],
    capabilities: { tools: true, vision: true, reasoning: true },
    reasoningEffort: "medium",
  },
  // OpenAI
  {
    id: "openai/gpt-4o",
    name: "GPT-4o",
    provider: "openai",
    description: "OpenAI's flagship multimodal model",
    gatewayOrder: ["openai", "openrouter"],
    capabilities: { tools: true, vision: true, reasoning: false },
  },
  {
    id: "openai/gpt-4.1",
    name: "GPT-4.1",
    provider: "openai",
    description: "Latest GPT-4.1 — excellent reasoning",
    gatewayOrder: ["openai", "openrouter"],
    capabilities: { tools: true, vision: true, reasoning: true },
    reasoningEffort: "medium",
  },
  // Google
  {
    id: "google/gemini-2.5-flash",
    name: "Gemini 2.5 Flash",
    provider: "google",
    description: "Fast Gemini with thinking capabilities",
    gatewayOrder: ["google", "openrouter", "fireworks"],
    capabilities: { tools: true, vision: true, reasoning: true },
    reasoningEffort: "low",
  },
  {
    id: "google/gemini-2.5-pro",
    name: "Gemini 2.5 Pro",
    provider: "google",
    description: "Top-tier Gemini for complex reasoning",
    gatewayOrder: ["google", "openrouter"],
    capabilities: { tools: true, vision: true, reasoning: true },
    reasoningEffort: "high",
  },
  // xAI
  {
    id: "xai/grok-4",
    name: "Grok 4",
    provider: "xai",
    description: "xAI's latest model — fast and capable",
    gatewayOrder: ["xai", "openrouter"],
    capabilities: { tools: true, vision: true, reasoning: false },
  },
];

export async function getCapabilities(): Promise<
  Record<string, ModelCapabilities>
> {
  const results = await Promise.all(
    chatModels.map(async (model) => {
      try {
        const res = await fetch(
          `https://ai-gateway.vercel.sh/v1/models/${model.id}/endpoints`
        );
        if (!res.ok) {
          return [model.id, { tools: false, vision: false, reasoning: false }];
        }

        const json = await res.json();
        const endpoints = json.data?.endpoints ?? [];
        const params = new Set(
          endpoints.flatMap(
            (e: { supported_parameters?: string[] }) =>
              e.supported_parameters ?? []
          )
        );
        const inputModalities = new Set(
          json.data?.architecture?.input_modalities ?? []
        );

        return [
          model.id,
          {
            tools: params.has("tools"),
            vision: inputModalities.has("image"),
            reasoning: params.has("reasoning"),
          },
        ];
      } catch {
        return [model.id, { tools: false, vision: false, reasoning: false }];
      }
    })
  );

  return Object.fromEntries(results);
}

export const allowedModelIds = new Set(chatModels.map((m) => m.id));

type GatewayModel = {
  id: string;
  name: string;
  type?: string;
  tags?: string[];
};

export type GatewayModelWithCapabilities = ChatModel & {
  capabilities: ModelCapabilities;
};

const emptyCapabilities: ModelCapabilities = {
  tools: false,
  vision: false,
  reasoning: false,
};

export async function getAllGatewayModels(): Promise<GatewayModelWithCapabilities[]> {
  const modelIdSet = new Set(chatModels.map((m) => m.id));
  const results: GatewayModelWithCapabilities[] = [];

  for (const model of chatModels) {
    results.push({
      ...model,
      capabilities: model.capabilities ?? emptyCapabilities,
    });
  }

  try {
    const res = await fetch("https://ai-gateway.vercel.sh/v1/models");
    if (!res.ok) return results;

    const json: { data: { models: GatewayModel[] } } = await res.json();
    const models = json.data?.models ?? [];

    for (const model of models) {
      if (!model.id) continue;
      
      // Check if model id matches any of our chatModels
      const matches = chatModels.find(
        (chatModel) => model.id === chatModel.id || model.id?.endsWith(`/${chatModel.id.split("/").pop()}`)
      );

      if (matches && !modelIdSet.has(model.id)) {
        results.push({
          ...matches,
          id: model.id,
          capabilities: matches.capabilities ?? emptyCapabilities,
        });
        modelIdSet.add(model.id);
      }
    }
  } catch {
    // Fallback to our hardcoded models
  }

  return results;
}
