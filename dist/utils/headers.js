const HOP_BY_HOP_REQUEST = new Set([
    'connection',
    'keep-alive',
    'proxy-authenticate',
    'proxy-authorization',
    'te',
    'trailer',
    'transfer-encoding',
    'upgrade',
]);
const HOP_BY_HOP_RESPONSE = new Set([
    'connection',
    'keep-alive',
    'proxy-authenticate',
    'proxy-authorization',
    'te',
    'trailer',
    'transfer-encoding',
    'upgrade',
]);
function parseConnectionTokens(value) {
    if (!value || typeof value !== 'string')
        return [];
    return value.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean);
}
export function buildUpstreamRequestHeaders(incoming, targetUrl, forwardHeaderLower) {
    const out = {};
    const connectionTokens = new Set(parseConnectionTokens(incoming.connection));
    for (const [key, rawVal] of Object.entries(incoming)) {
        if (rawVal === undefined)
            continue;
        const lower = key.toLowerCase();
        if (lower === forwardHeaderLower)
            continue;
        if (lower === 'host')
            continue;
        if (HOP_BY_HOP_REQUEST.has(lower))
            continue;
        if (connectionTokens.has(lower))
            continue;
        out[key] = rawVal;
    }
    out.host = targetUrl.host;
    return out;
}
export function applyUpstreamResponseHeaders(upstreamHeaders, reply) {
    const connectionTokens = new Set(parseConnectionTokens(upstreamHeaders.connection));
    for (const [key, rawVal] of Object.entries(upstreamHeaders)) {
        if (rawVal === undefined)
            continue;
        const lower = key.toLowerCase();
        if (lower === 'content-length')
            continue;
        if (HOP_BY_HOP_RESPONSE.has(lower))
            continue;
        if (connectionTokens.has(lower))
            continue;
        reply.header(key, rawVal);
    }
}
//# sourceMappingURL=headers.js.map