import type { FastifyPluginAsync } from 'fastify';
import type { AppConfig } from '../config.js';
type LoggingOpts = {
    config: AppConfig;
};
export declare const loggingPlugin: FastifyPluginAsync<LoggingOpts>;
export {};
//# sourceMappingURL=logging.d.ts.map