import Fastify, { type FastifyInstance } from 'fastify';
import { randomUUID } from 'node:crypto';
import type { AppConfig } from './config.js';
import { registerRequestLogging } from './plugins/logging.js';
import { registerIpWhitelist } from './middleware/ipWhitelist.js';
import { registerForwardRoutes } from './routes/forward.js';

const ALLOWED_METHODS = new Set(['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE']);

/** `logStream` replaces stdout for the logger (tests read the log lines from it). */
export async function buildApp(
  config: AppConfig,
  logStream?: { write: (msg: string) => void },
): Promise<FastifyInstance> {
  const app = Fastify({
    logger: { level: process.env.LOG_LEVEL ?? 'info', ...(logStream ? { stream: logStream } : {}) },
    disableRequestLogging: true,
    trustProxy: config.TRUST_PROXY,
    bodyLimit: config.MAX_BODY_BYTES,
    exposeHeadRoutes: false,
    genReqId: (req) => {
      const raw = req.headers['x-request-id'] ?? req.headers['x-correlation-id'];
      const id = Array.isArray(raw) ? raw[0] : raw;
      if (typeof id === 'string' && id.trim()) return id.trim();
      return randomUUID();
    },
  }) as FastifyInstance;

  registerRequestLogging(app, config);

  app.addHook('onRequest', async (request, reply) => {
    if (!ALLOWED_METHODS.has(request.method)) {
      return reply.code(405).send({ error: 'Method Not Allowed' });
    }
  });

  registerIpWhitelist(app, config);

  app.removeAllContentTypeParsers();
  app.addContentTypeParser(
    '*',
    { parseAs: 'buffer', bodyLimit: config.MAX_BODY_BYTES },
    (_req, body, done) => {
      done(null, body);
    },
  );

  app.get(config.HEARTBEAT_PATH, async (_request, reply) => {
    return reply.code(200).send({ status: 'ok' });
  });

  registerForwardRoutes(app, config);

  return app;
}
