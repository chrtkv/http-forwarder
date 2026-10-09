import type { FastifyInstance } from 'fastify';
import type { AppConfig } from '../config.js';

function targetHostFromRequest(
  request: { headers: Record<string, string | string[] | undefined> },
  forwardHeaderLower: string,
): string | undefined {
  const raw = request.headers[forwardHeaderLower];
  const s = (Array.isArray(raw) ? raw[0] : raw)?.trim();
  if (!s) return undefined;
  try {
    return new URL(s).hostname;
  } catch {
    return undefined;
  }
}

/**
 * Hooks go on the root instance, like the whitelist: as a registered plugin they were encapsulated
 * and never ran for the routes, so no request was ever logged.
 */
export function registerRequestLogging(app: FastifyInstance, config: AppConfig): void {
  const forwardHeaderLower = config.FORWARD_TARGET_HEADER.toLowerCase();

  app.addHook('onRequest', async (request) => {
    request.forwarderStartMs = Date.now();
  });

  app.addHook('onResponse', async (request, reply) => {
    // Docker's healthcheck hits the heartbeat every 30 s; logging it would bury the relays.
    if (request.routeOptions.url === config.HEARTBEAT_PATH) return;

    const path = request.url.split('?')[0];
    const ms = Date.now() - (request.forwarderStartMs ?? Date.now());
    const targetHost = targetHostFromRequest(request, forwardHeaderLower);
    request.log.info(
      {
        event: 'request_complete',
        method: request.method,
        path,
        sourceIp: request.ip,
        statusCode: reply.statusCode,
        responseTimeMs: ms,
        ...(targetHost ? { targetHost } : {}),
      },
      'request complete',
    );
  });
}
