/**
 * The research fetch behind an HTTP proxy (company VPN): requests go through
 * the proxy, and every hop is still limited to public addresses. All servers
 * here are local; nothing touches the network.
 */
import assert from "node:assert/strict";
import http from "node:http";
import net, { type AddressInfo } from "node:net";
import { describe, it } from "node:test";
import { fetchThroughProxy, proxyFor } from "../src/agent/tools/safe-fetch.ts";

function listen(srv: http.Server, host = "127.0.0.1"): Promise<number> {
	return new Promise(resolve => srv.listen(0, host, () => resolve((srv.address() as AddressInfo).port)));
}

/** A minimal CONNECT proxy that counts the tunnels it opens. */
async function connectProxy() {
	const state = { tunnels: 0, url: "", close: () => {} };
	const srv = http.createServer((_req, res) => { res.writeHead(405); res.end(); });
	srv.on("connect", (req, client, head) => {
		state.tunnels++;
		const [host, port] = (req.url ?? "").split(/:(?=\d+$)/);
		const upstream = net.connect(Number(port), host.replace(/^\[|\]$/g, ""), () => {
			client.write("HTTP/1.1 200 Connection Established\r\n\r\n");
			upstream.write(head);
			upstream.pipe(client);
			client.pipe(upstream);
		});
		upstream.on("error", () => client.destroy());
	});
	state.url = `http://127.0.0.1:${await listen(srv)}`;
	state.close = () => { srv.closeAllConnections(); srv.close(); };
	return state;
}

async function site(handler: http.RequestListener, host = "127.0.0.1") {
	const state = { hits: 0, port: 0, close: () => {} };
	const srv = http.createServer((req, res) => { state.hits++; handler(req, res); });
	state.port = await listen(srv, host);
	state.close = () => { srv.closeAllConnections(); srv.close(); };
	return state;
}

describe("proxyFor", () => {
	const env = { https_proxy: "http://127.0.0.1:3128", http_proxy: "http://127.0.0.1:3129", no_proxy: "localhost, .corp.example,10.0.0.5" };
	it("picks the proxy for the URL's scheme", () => {
		assert.equal(proxyFor(new URL("https://example.com/"), env), "http://127.0.0.1:3128");
		assert.equal(proxyFor(new URL("http://example.com/"), env), "http://127.0.0.1:3129");
	});
	it("skips hosts in no_proxy and their subdomains", () => {
		assert.equal(proxyFor(new URL("http://localhost/"), env), undefined);
		assert.equal(proxyFor(new URL("https://wiki.corp.example/"), env), undefined);
		assert.equal(proxyFor(new URL("https://corp.example/"), env), undefined);
		assert.equal(proxyFor(new URL("http://10.0.0.5/"), env), undefined);
		assert.equal(proxyFor(new URL("https://notcorp.example/"), env), "http://127.0.0.1:3128");
	});
	it("connects directly when no proxy is set or no_proxy is *", () => {
		assert.equal(proxyFor(new URL("https://example.com/"), {}), undefined);
		assert.equal(proxyFor(new URL("https://example.com/"), { ...env, no_proxy: "*" }), undefined);
	});
});

describe("fetchThroughProxy", () => {
	it("sends an allowed request through the proxy", async () => {
		const proxy = await connectProxy();
		const ok = await site((_req, res) => res.end("hello"));
		try {
			const response = await fetchThroughProxy(`http://127.0.0.1:${ok.port}/`, {}, proxy.url, { allowed: () => true });
			assert.equal(await response.text(), "hello");
			assert.equal(proxy.tunnels, 1);
		} finally { ok.close(); proxy.close(); }
	});

	it("refuses a hostname that resolves to a private address before the proxy sees it", async () => {
		const proxy = await connectProxy();
		try {
			await assert.rejects(
				fetchThroughProxy("http://internal.example/", {}, proxy.url, { lookup: async () => ["10.1.2.3"] }),
				/refusing to connect to a private or local address/,
			);
			assert.equal(proxy.tunnels, 0);
		} finally { proxy.close(); }
	});

	it("checks every redirect hop and stops before a refused one", async () => {
		const proxy = await connectProxy();
		const secret = await site((_req, res) => res.end("internal secret"));
		const bounce = await site((_req, res) => {
			res.writeHead(302, { location: `http://127.0.0.1:${secret.port}/secret` });
			res.end();
		}, "::1");
		try {
			await assert.rejects(
				fetchThroughProxy(`http://[::1]:${bounce.port}/start`, {}, proxy.url, { allowed: address => address === "::1" }),
				/refusing to connect to a private or local address/,
			);
			assert.equal(bounce.hits, 1);
			assert.equal(secret.hits, 0);
		} finally { bounce.close(); secret.close(); proxy.close(); }
	});

	it("follows an allowed redirect and reports the final URL", async () => {
		const proxy = await connectProxy();
		const target = await site((_req, res) => res.end("moved here"));
		const bounce = await site((_req, res) => {
			res.writeHead(301, { location: `http://127.0.0.1:${target.port}/final` });
			res.end();
		});
		try {
			const response = await fetchThroughProxy(`http://127.0.0.1:${bounce.port}/start`, {}, proxy.url, { allowed: () => true });
			assert.equal(await response.text(), "moved here");
			assert.equal(response.url, `http://127.0.0.1:${target.port}/final`);
		} finally { bounce.close(); target.close(); proxy.close(); }
	});
});
