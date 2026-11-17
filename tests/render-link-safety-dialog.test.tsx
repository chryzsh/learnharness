/**
 * SSR pins: the link prompt for chat messages. Streamdown's own prompt
 * renders inside the paragraph that holds the link (invalid HTML), so
 * chat messages hand Streamdown a host dialog instead.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { LinkSafetyBody, messageLinkSafety } from "@/components/link-safety-dialog";

describe("link safety dialog", () => {
	it("shows the URL with Cancel and Open link", () => {
		const html = renderToStaticMarkup(
			<LinkSafetyBody url="https://example.com/a" onClose={() => {}} onConfirm={() => {}} />,
		);
		assert.match(html, /Open external link\?/);
		assert.match(html, /data-testid="link-safety-url"[^>]*>https:\/\/example\.com\/a</);
		assert.match(html, /Cancel/);
		assert.match(html, /Open link/);
	});

	it("keeps the prompt on and replaces Streamdown's inline modal", () => {
		assert.equal(messageLinkSafety.enabled, true);
		assert.equal(typeof messageLinkSafety.renderModal, "function");
	});

	it("renders nothing while closed", () => {
		const html = renderToStaticMarkup(
			<>{messageLinkSafety.renderModal!({ isOpen: false, url: "https://example.com", onClose() {}, onConfirm() {} })}</>,
		);
		assert.equal(html, "");
	});
});
