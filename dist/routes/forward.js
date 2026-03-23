import { forwardRequest } from '../services/forwarder.js';
const FORWARD_METHODS = ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE'];
export function registerForwardRoutes(app, config) {
    app.route({
        method: [...FORWARD_METHODS],
        url: '/*',
        handler: async (request, reply) => forwardRequest(request, reply, config),
    });
}
//# sourceMappingURL=forward.js.map