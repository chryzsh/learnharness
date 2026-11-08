/**
 * Claude Code provider catalog (src/agent/claude-code/provider.ts).
 *
 * Registered on a fresh pi model collection with a stub stream function, so
 * only the catalog and auth surface are under test here.
 */
import assert from "node:assert/strict";
import test from "node:test";

import { clampThinkingLevel, createAssistantMessageEventStream, createModels, getSupportedThinkingLevels } from "@earendil-works/pi-ai";

import { CLAUDE_CODE_PROVIDER } from "../src/agent/claude-code/constants.ts";
import { createClaudeCodeProvider } from "../src/agent/claude-code/provider.ts";

function createCollection() {
	const collection = createModels();
	collection.setProvider(createClaudeCodeProvider(() => createAssistantMessageEventStream()));
	return collection;
}

test("lists the aliases followed by the exact model IDs", () => {
	const models = createCollection().getModels(CLAUDE_CODE_PROVIDER);
	assert.deepEqual(
		models.map((m) => m.id),
		[
			"opus", "sonnet", "haiku", "fable",
			"claude-fable-5-1", "claude-opus-5-5", "claude-sonnet-5-5", "claude-haiku-5-5",
			"claude-opus-4-8", "claude-opus-4-6",
		],
	);
	assert.deepEqual(
		models.map((m) => m.name),
		[
			"Claude Opus", "Claude Sonnet", "Claude Haiku", "Claude Fable",
			"Claude Fable 5.1", "Claude Opus 5.5", "Claude Sonnet 5.5", "Claude Haiku 5.5",
			"Claude Opus 4.8", "Claude Opus 4.6",
		],
	);
});

test("supports low through max thinking and clamps off to low", () => {
	for (const model of createCollection().getModels(CLAUDE_CODE_PROVIDER)) {
		assert.deepEqual(getSupportedThinkingLevels(model), ["low", "medium", "high", "xhigh", "max"]);
		assert.equal(clampThinkingLevel(model, "off"), "low");
		assert.equal(clampThinkingLevel(model, "minimal"), "low");
	}
});

test("accepts text and image input", () => {
	for (const model of createCollection().getModels(CLAUDE_CODE_PROVIDER)) {
		assert.deepEqual(model.input, ["text", "image"]);
	}
});

test("every cost field is zero", () => {
	for (const model of createCollection().getModels(CLAUDE_CODE_PROVIDER)) {
		assert.deepEqual(model.cost, { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 });
	}
});

test("auth resolves as configured without any key", async () => {
	const collection = createCollection();
	assert.ok(await collection.checkAuth(CLAUDE_CODE_PROVIDER));
	assert.equal((await collection.getAvailable(CLAUDE_CODE_PROVIDER)).length, 10);
});
