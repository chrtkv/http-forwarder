import { loadConfig } from './config.js';
import { buildApp } from './app.js';
const config = loadConfig();
const app = await buildApp(config);
async function shutdown(signal) {
    app.log.info({ signal }, 'shutting down');
    try {
        await app.close();
        process.exit(0);
    }
    catch (err) {
        app.log.error({ err }, 'shutdown error');
        process.exit(1);
    }
}
process.once('SIGTERM', () => void shutdown('SIGTERM'));
process.once('SIGINT', () => void shutdown('SIGINT'));
try {
    await app.listen({ port: config.PORT, host: '0.0.0.0' });
    app.log.info({ port: config.PORT }, 'server listening');
}
catch (err) {
    app.log.error({ err }, 'listen failed');
    process.exit(1);
}
//# sourceMappingURL=server.js.map