import type { FastifyInstance } from 'fastify';
import ipaddr from 'ipaddr.js';
import type { AppConfig } from '../config.js';
export declare function parseClientIp(ip: string | undefined): ipaddr.IPv4 | ipaddr.IPv6 | null;
export declare function isIpWhitelisted(clientAddr: ipaddr.IPv4 | ipaddr.IPv6 | null, trustedEntries: string[]): boolean;
export declare function registerIpWhitelist(app: FastifyInstance, config: AppConfig): void;
//# sourceMappingURL=ipWhitelist.d.ts.map