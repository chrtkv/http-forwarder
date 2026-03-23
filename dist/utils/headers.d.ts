import type { IncomingHttpHeaders } from 'node:http';
import type { FastifyReply } from 'fastify';
export declare function buildUpstreamRequestHeaders(incoming: IncomingHttpHeaders, targetUrl: URL, forwardHeaderLower: string): Record<string, string | string[] | undefined>;
export declare function applyUpstreamResponseHeaders(upstreamHeaders: IncomingHttpHeaders, reply: FastifyReply): void;
//# sourceMappingURL=headers.d.ts.map