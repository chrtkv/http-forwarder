import type { FastifyPluginAsync } from 'fastify';
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

type LoggingOpts = { config: AppConfig };

export const loggingPlugin: FastifyPluginAsync<LoggingOpts> = async (app, opts) => {
  const { config } = opts;
  const forwardHeaderLower = config.FORWARD_TARGET_HEADER.toLowerCase();

  app.addHook('onRequest', async (request) => {
    request.forwarderStartMs = Date.now();
  });

  app.addHook('onResponse', async (request, reply) => {
    const path = request.url.split('?')[0];
    const ms = Date.now() - (request.forwarderStartMs ?? Date.now());
    const targetHost = targetHostFromRequest(request, forwardHeaderLower);
    request.log.info(
      {
        event: 'request_complete',
        reqId: request.id,
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
};
