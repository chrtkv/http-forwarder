import { request as undiciRequest, Agent, interceptors } from 'undici';
import { buildUpstreamRequestHeaders, applyUpstreamResponseHeaders } from '../utils/headers.js';
/** No automatic redirects (caller-controlled URL must be final). */
const forwardDispatcher = new Agent().compose(interceptors.redirect({ maxRedirections: 0 }));
function readForwardTargetHeader(headers, headerNameLower) {
    const raw = headers[headerNameLower];
    if (raw === undefined)
        return '';
    return Array.isArray(raw) ? (raw[0] ?? '') : raw;
}
function isNodeError(err) {
    return typeof err === 'object' && err !== null && 'code' in err;
}
export async function forwardRequest(fastifyRequest, fastifyReply, config) {
    const headerNameLower = config.FORWARD_TARGET_HEADER.toLowerCase();
    const targetStr = readForwardTargetHeader(fastifyRequest.headers, headerNameLower).trim();
    if (!targetStr) {
        return fastifyReply.code(400).send({
            error: 'Bad Request',
            reason: `missing header ${config.FORWARD_TARGET_HEADER}`,
        });
    }
    let targetUrl;
    try {
        targetUrl = new URL(targetStr);
    }
    catch {
        return fastifyReply.code(400).send({ error: 'Bad Request', reason: 'invalid forward URL' });
    }
    if (targetUrl.protocol !== 'http:' && targetUrl.protocol !== 'https:') {
        return fastifyReply.code(400).send({
            error: 'Bad Request',
            reason: 'forward URL must be http or https',
        });
    }
    const outgoingHeaders = buildUpstreamRequestHeaders(fastifyRequest.headers, targetUrl, headerNameLower);
    const method = fastifyRequest.method;
    const rawBody = fastifyRequest.body;
    const body = method === 'GET' || method === 'HEAD'
        ? undefined
        : Buffer.isBuffer(rawBody) && rawBody.length > 0
            ? rawBody
            : undefined;
    const signal = AbortSignal.timeout(config.UPSTREAM_TIMEOUT_MS);
    try {
        const res = await undiciRequest(targetUrl, {
            method,
            headers: outgoingHeaders,
            body,
            signal,
            dispatcher: forwardDispatcher,
        });
        fastifyReply.code(res.statusCode);
        applyUpstreamResponseHeaders(res.headers, fastifyReply);
        return fastifyReply.send(res.body);
    }
    catch (err) {
        const name = err instanceof Error ? err.name : '';
        const code = isNodeError(err) ? err.code : undefined;
        if (name === 'AbortError' || name === 'TimeoutError' || code === 'UND_ERR_ABORTED') {
            return fastifyReply.code(504).send({
                error: 'Gateway Timeout',
                reason: 'upstream request timed out',
            });
        }
        fastifyRequest.log.error({ err }, 'upstream request failed');
        return fastifyReply.code(502).send({
            error: 'Bad Gateway',
            reason: 'upstream request failed',
        });
    }
}
//# sourceMappingURL=forwarder.js.map