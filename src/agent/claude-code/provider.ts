import { createProvider, type Api, type Model, type Provider, type SimpleStreamOptions, type StreamFunction } from "@earendil-works/pi-ai";

import { CLAUDE_CODE_API, CLAUDE_CODE_PROVIDER } from "./constants.ts";

const SHARED_MODEL_FIELDS = {
	api: CLAUDE_CODE_API,
	provider: CLAUDE_CODE_PROVIDER,
	baseUrl: "",
	input: ["text", "image"],
	// Pi-required placeholders, not prices: the CLI's own auth/routing
	// determines charges. Server pricing and the client catalog report unpriced.
	cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
	reasoning: true,
	// The CLI has no thinking-off switch; effort low is the floor.
	thinkingLevelMap: { off: null, minimal: null, low: "low", medium: "medium", high: "high", xhigh: "xhigh", max: "max" },
	contextWindow: 1_000_000,
	maxTokens: 128_000,
} satisfies Omit<Model<Api>, "id" | "name">;

export const CLAUDE_CODE_MODELS: readonly Model<Api>[] = [
	{ ...SHARED_MODEL_FIELDS, id: "opus", name: "Claude Opus" },
	{ ...SHARED_MODEL_FIELDS, id: "sonnet", name: "Claude Sonnet" },
	{ ...SHARED_MODEL_FIELDS, id: "haiku", name: "Claude Haiku" },
	{ ...SHARED_MODEL_FIELDS, id: "fable", name: "Claude Fable" },
	// Exact model IDs, for when you want a specific version instead of the
	// newest model behind an alias.
	{ ...SHARED_MODEL_FIELDS, id: "claude-fable-5-1", name: "Claude Fable 5.1" },
	{ ...SHARED_MODEL_FIELDS, id: "claude-opus-5-5", name: "Claude Opus 5.5" },
	{ ...SHARED_MODEL_FIELDS, id: "claude-sonnet-5-5", name: "Claude Sonnet 5.5" },
	{ ...SHARED_MODEL_FIELDS, id: "claude-haiku-5-5", name: "Claude Haiku 5.5" },
	{ ...SHARED_MODEL_FIELDS, id: "claude-opus-4-8", name: "Claude Opus 4.8" },
	{ ...SHARED_MODEL_FIELDS, id: "claude-opus-4-6", name: "Claude Opus 4.6" },
];

export function createClaudeCodeProvider(streamSimple: StreamFunction<Api, SimpleStreamOptions>): Provider {
	return createProvider({
		id: CLAUDE_CODE_PROVIDER,
		name: "Claude Code",
		auth: { apiKey: { name: "Claude Code CLI", resolve: async () => ({ auth: {}, source: "claude CLI" }) } },
		models: CLAUDE_CODE_MODELS,
		api: { stream: streamSimple, streamSimple },
	});
}
