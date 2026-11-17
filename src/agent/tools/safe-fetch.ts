import { lookup as dnsLookup } from "node:dns/promises";
import { BlockList, isIP } from "node:net";
import { Agent, buildConnector, ProxyAgent, fetch as undiciFetch } from "undici";

/**
 * Fetch for model-chosen URLs (research web_fetch / web_fetch_pdf): only
 * public internet addresses. A fetched page can steer the researcher, so
 * without this it could read loopback services, the LAN, or cloud metadata
 * (169.254.169.254) and hand the response back to the model.
 *
 * The check runs on the address each connection actually reaches, after DNS
 * and before any request bytes are sent, so redirects, IP-literal URLs and
 * DNS rebinding all go through it.
 *
 * Behind an HTTP proxy (http_proxy / https_proxy, for example on a company
 * VPN) the connection reaches the proxy, not the site, so that check cannot
 * run. There, every hop's hostname is resolved and checked before the request
 * goes to the proxy, and redirects are followed here so each one is checked.
 * The proxy resolves the name again, so this path does not stop DNS
 * rebinding; it still stops named, literal and redirected local targets.
 */

const NON_PUBLIC = new BlockList();
for (const [network, prefix] of [
	["0.0.0.0", 8], // "this network"
	["10.0.0.0", 8], // private
	["100.64.0.0", 10], // carrier-grade NAT
	["127.0.0.0", 8], // loopback
	["169.254.0.0", 16], // link-local, cloud metadata
	["172.16.0.0", 12], // private
	["192.0.0.0", 24], // IETF protocol assignments
	["192.0.2.0", 24], // documentation
	["192.88.99.0", 24], // 6to4 relay anycast
	["192.168.0.0", 16], // private
	["198.18.0.0", 15], // benchmarking
	["198.51.100.0", 24], // documentation
	["203.0.113.0", 24], // documentation
	["224.0.0.0", 4], // multicast
	["240.0.0.0", 4], // reserved, broadcast
] as const) NON_PUBLIC.addSubnet(network, prefix, "ipv4");
for (const [network, prefix] of [
	["::", 128], // unspecified
	["::1", 128], // loopback
	["64:ff9b::", 96], // NAT64
	["64:ff9b:1::", 48], // local-use NAT64
	["100::", 64], // discard-only
	["2001:db8::", 32], // documentation
	["2002::", 16], // 6to4
	["fc00::", 7], // unique local
	["fe80::", 10], // link-local
	["ff00::", 8], // multicast
] as const) NON_PUBLIC.addSubnet(network, prefix, "ipv6");

/** True when an IP address is on the public internet. IPv4-mapped IPv6
 *  (::ffff:a.b.c.d) is judged as the IPv4 address it carries. */
export function isPublicAddress(address: string): boolean {
	const unbracketed = address.replace(/^\[|\]$/g, "");
	const mapped = unbracketed.match(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i)?.[1];
	const ip = mapped ?? unbracketed;
	const family = isIP(ip);
	if (family === 4) return !NON_PUBLIC.check(ip, "ipv4");
	if (family === 6) return !NON_PUBLIC.check(ip, "ipv6");
	return false;
}

export class BlockedAddressError extends Error {}

/** An undici Agent whose connections may only reach addresses `allowed`
 *  accepts (exported with the check injectable, for tests). */
export function createAddressCheckedAgent(
	allowed: (address: string) => boolean = isPublicAddress,
	connectorOptions: Parameters<typeof buildConnector>[0] = {},
): Agent {
	// Optional connector settings let offline tests supply deterministic DNS and
	// a synthetic TLS CA. Production uses the standard connector unchanged.
	const connect = buildConnector(connectorOptions);
	return new Agent({
		connect: (options, callback) => {
			connect(options, (error, socket) => {
				if (error || !socket) {
					callback(error ?? new Error("connection failed"), null);
					return;
				}
				const peer = socket.remoteAddress ?? "";
				if (!peer || !allowed(peer)) {
					socket.destroy();
					callback(new BlockedAddressError(`refusing to connect to a private or local address (${options.hostname})`), null);
					return;
				}
				callback(null, socket);
			});
		},
	});
}

const publicOnly = createAddressCheckedAgent();

/** Test seam — undefined in production. Tests that drive the research tools
 *  offline set a canned responder here (stubbing globalThis.fetch no longer
 *  reaches these tools, which use undici's own fetch). */
export const safeFetchOverride: { current?: (url: string, init: RequestInit) => Promise<Response> } = {};

/** The proxy URL that applies to `url`, or undefined for a direct connection.
 *  Reads http_proxy / https_proxy / no_proxy like curl: a no_proxy entry
 *  matches the host and its subdomains, and "*" turns the proxy off. */
export function proxyFor(url: URL, env: NodeJS.ProcessEnv = process.env): string | undefined {
	const proxy = url.protocol === "https:"
		? env.https_proxy ?? env.HTTPS_PROXY ?? env.http_proxy ?? env.HTTP_PROXY
		: env.http_proxy ?? env.HTTP_PROXY;
	if (!proxy) return undefined;
	const host = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
	const skip = (env.no_proxy ?? env.NO_PROXY ?? "").split(",").map(entry => entry.trim().toLowerCase().replace(/^\*?\./, "")).filter(Boolean);
	if (skip.some(entry => entry === "*" || host === entry || host.endsWith(`.${entry}`))) return undefined;
	return proxy;
}

type Lookup = (hostname: string) => Promise<string[]>;
const systemLookup: Lookup = async hostname => (await dnsLookup(hostname, { all: true })).map(entry => entry.address);

async function assertPublicHost(hostname: string, allowed: (address: string) => boolean, lookup: Lookup): Promise<void> {
	const host = hostname.replace(/^\[|\]$/g, "");
	const addresses = isIP(host) ? [host] : await lookup(host);
	if (addresses.length === 0 || !addresses.every(allowed)) {
		throw new BlockedAddressError(`refusing to connect to a private or local address (${host})`);
	}
}

const proxyAgents = new Map<string, ProxyAgent>();
const MAX_REDIRECTS = 20;

/** fetch() through an HTTP proxy, limited to hosts that resolve to public
 *  addresses. Exported with the check and DNS injectable, for tests. */
export async function fetchThroughProxy(
	url: string,
	init: RequestInit,
	proxy: string,
	{ allowed = isPublicAddress, lookup = systemLookup }: { allowed?: (address: string) => boolean; lookup?: Lookup } = {},
): Promise<Response> {
	let agent = proxyAgents.get(proxy);
	if (!agent) proxyAgents.set(proxy, agent = new ProxyAgent(proxy));
	let current = url;
	for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
		await assertPublicHost(new URL(current).hostname, allowed, lookup);
		const response = (await undiciFetch(current, { ...(init as object), redirect: "manual", dispatcher: agent })) as unknown as Response;
		const location = response.headers.get("location");
		if (response.status < 300 || response.status > 399 || !location) return response;
		await response.body?.cancel();
		current = new URL(location, current).href;
	}
	throw new Error(`too many redirects (${url})`);
}

/** fetch() limited to public addresses. A refusal surfaces as its own
 *  message instead of undici's generic "fetch failed". An explicit
 *  dispatcher (tests) always connects directly. */
export async function safeFetch(url: string, init: RequestInit = {}, dispatcher?: Agent): Promise<Response> {
	if (safeFetchOverride.current) return safeFetchOverride.current(url, init);
	const proxy = dispatcher ? undefined : proxyFor(new URL(url));
	try {
		if (proxy) return await fetchThroughProxy(url, init, proxy);
		return (await undiciFetch(url, { ...(init as object), dispatcher: dispatcher ?? publicOnly })) as unknown as Response;
	} catch (err) {
		if (err instanceof BlockedAddressError) throw new Error(err.message);
		const cause = (err as { cause?: unknown }).cause;
		if (cause instanceof BlockedAddressError) throw new Error(cause.message);
		throw err;
	}
}
