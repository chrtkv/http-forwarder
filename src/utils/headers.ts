import type { IncomingHttpHeaders } from 'node:http';
import type { FastifyReply } from 'fastify';

const HOP_BY_HOP_REQUEST = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
]);

const HOP_BY_HOP_RESPONSE = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
]);

/** They describe the hop into the forwarder (the caller's or proxy's address), not the upstream request. */
const PROXY_CHAIN_REQUEST = new Set([
  'forwarded',
  'x-forwarded-for',
  'x-forwarded-host',
  'x-forwarded-proto',
  'x-real-ip',
]);

function parseConnectionTokens(value: IncomingHttpHeaders['connection']): string[] {
  if (!value || typeof value !== 'string') return [];
  return value.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean);
}

export function buildUpstreamRequestHeaders(
  incoming: IncomingHttpHeaders,
  targetUrl: URL,
  forwardHeaderLower: string,
): Record<string, string | string[] | undefined> {
  const out: Record<string, string | string[] | undefined> = {};
  const connectionTokens = new Set(parseConnectionTokens(incoming.connection));

  for (const [key, rawVal] of Object.entries(incoming)) {
    if (rawVal === undefined) continue;
    const lower = key.toLowerCase();
    if (lower === forwardHeaderLower) continue;
    if (lower === 'host') continue;
    if (HOP_BY_HOP_REQUEST.has(lower)) continue;
    if (PROXY_CHAIN_REQUEST.has(lower)) continue;
    if (connectionTokens.has(lower)) continue;
    out[key] = rawVal;
  }

  out.host = targetUrl.host;
  return out;
}

export function applyUpstreamResponseHeaders(
  upstreamHeaders: IncomingHttpHeaders,
  reply: FastifyReply,
): void {
  const connectionTokens = new Set(parseConnectionTokens(upstreamHeaders.connection));

  for (const [key, rawVal] of Object.entries(upstreamHeaders)) {
    if (rawVal === undefined) continue;
    const lower = key.toLowerCase();
    if (lower === 'content-length') continue;
    if (HOP_BY_HOP_RESPONSE.has(lower)) continue;
    if (connectionTokens.has(lower)) continue;
    reply.header(key, rawVal);
  }
}
