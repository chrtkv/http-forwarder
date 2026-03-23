import type { FastifyInstance } from 'fastify';
import { forwardRequest } from '../services/forwarder.js';
import type { AppConfig } from '../config.js';

const FORWARD_METHODS = ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE'] as const;

export function registerForwardRoutes(app: FastifyInstance, config: AppConfig): void {
  app.route({
    method: [...FORWARD_METHODS],
    url: '/*',
    handler: async (request, reply) => forwardRequest(request, reply, config),
  });
}
