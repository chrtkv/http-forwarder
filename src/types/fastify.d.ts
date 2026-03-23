import 'fastify';

declare module 'fastify' {
  interface FastifyRequest {
    forwarderStartMs?: number;
  }
}
