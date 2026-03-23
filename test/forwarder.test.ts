import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import Fastify from 'fastify';
import { buildApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';
import { isIpWhitelisted, parseClientIp } from '../src/middleware/ipWhitelist.js';

function cfg(overrides: Record<string, string> = {}) {
  return loadConfig({
    TRUST_PROXY: 'false',
    FORWARD_TARGET_HEADER: 'x-forward-url',
    PORT: '0',
    HEARTBEAT_PATH: '/health',
    TRUSTED_IPS: '127.0.0.1',
    UPSTREAM_TIMEOUT_MS: '8000',
    MAX_BODY_BYTES: '1048576',
    ...overrides,
  });
}

const fetchOpts = { signal: AbortSignal.timeout(20_000) };

async function createEchoUpstream() {
  const app = Fastify({ logger: false });
  app.removeAllContentTypeParsers();
  app.addContentTypeParser('*', { parseAs: 'buffer' }, (_req, body, done) => {
    done(null, body);
  });
  app.get('/echo', async (request) => {
    return {
      auth: request.headers.authorization ?? null,
      url: request.url,
    };
  });
  app.post('/echo', async (request) => {
    return {
      auth: request.headers.authorization ?? null,
      body: request.body instanceof Buffer ? request.body.toString('utf8') : '',
    };
  });
  await app.listen({ port: 0, host: '127.0.0.1' });
  const addr = app.server.address();
  const port = typeof addr === 'object' && addr ? addr.port : 0;
  return {
    origin: `http://127.0.0.1:${port}`,
    close: () => app.close(),
  };
}

describe('IP whitelist helpers', () => {
  test('CIDR match', () => {
    const client = parseClientIp('10.1.2.3');
    assert.ok(client);
    assert.ok(isIpWhitelisted(client, ['10.0.0.0/8']));
  });

  test('non-whitelisted IP', () => {
    const client = parseClientIp('192.168.1.99');
    assert.ok(client);
    assert.equal(isIpWhitelisted(client, ['10.0.0.0/8']), false);
  });
});

describe(
  'HTTP forwarder',
  { concurrency: false },
  () => {
    test('heartbeat returns 200 and skips IP whitelist', async () => {
      const config = cfg({ TRUSTED_IPS: '' });
      const app = await buildApp(config);
      await app.listen({ port: 0, host: '127.0.0.1' });
      try {
        const addr = app.server.address();
        const port = typeof addr === 'object' && addr ? addr.port : 0;
        const res = await fetch(`http://127.0.0.1:${port}/health`, fetchOpts);
        assert.equal(res.status, 200);
        const body = (await res.json()) as { status: string };
        assert.equal(body.status, 'ok');
      } finally {
        await app.close();
      }
    });

    test('non-whitelisted IP receives 403 on forward', async () => {
      const config = cfg({ TRUSTED_IPS: '10.0.0.1' });
      const app = await buildApp(config);
      await app.listen({ port: 0, host: '127.0.0.1' });
      try {
        const addr = app.server.address();
        const port = typeof addr === 'object' && addr ? addr.port : 0;
        const res = await fetch(`http://127.0.0.1:${port}/x`, {
          ...fetchOpts,
          headers: { 'x-forward-url': 'http://example.com/' },
        });
        assert.equal(res.status, 403);
      } finally {
        await app.close();
      }
    });

    test('TRUST_PROXY uses X-Forwarded-For for whitelist', async () => {
      const upstream = await createEchoUpstream();
      const config = cfg({ TRUST_PROXY: 'true', TRUSTED_IPS: '10.0.0.1' });
      const app = await buildApp(config);
      await app.listen({ port: 0, host: '127.0.0.1' });
      try {
        const addr = app.server.address();
        const port = typeof addr === 'object' && addr ? addr.port : 0;
        const res = await fetch(`http://127.0.0.1:${port}/x`, {
          ...fetchOpts,
          headers: {
            'x-forward-url': `${upstream.origin}/echo`,
            'x-forwarded-for': '10.0.0.1',
          },
        });
        assert.equal(res.status, 200);
      } finally {
        await app.close();
        await upstream.close();
      }
    });

    test('OPTIONS returns 405', async () => {
      const config = cfg({});
      const app = await buildApp(config);
      await app.listen({ port: 0, host: '127.0.0.1' });
      try {
        const addr = app.server.address();
        const port = typeof addr === 'object' && addr ? addr.port : 0;
        const res = await fetch(`http://127.0.0.1:${port}/x`, {
          ...fetchOpts,
          method: 'OPTIONS',
        });
        assert.equal(res.status, 405);
      } finally {
        await app.close();
      }
    });

    test('GET forwards and passes Authorization', async () => {
      const upstream = await createEchoUpstream();
      const config = cfg({});
      const app = await buildApp(config);
      await app.listen({ port: 0, host: '127.0.0.1' });
      try {
        const addr = app.server.address();
        const fPort = typeof addr === 'object' && addr ? addr.port : 0;
        const res = await fetch(`http://127.0.0.1:${fPort}/ignored-path`, {
          ...fetchOpts,
          headers: {
            'x-forward-url': `${upstream.origin}/echo`,
            Authorization: 'Bearer secret-token',
          },
        });
        assert.equal(res.status, 200);
        const json = (await res.json()) as { auth: string | null };
        assert.equal(json.auth, 'Bearer secret-token');
      } finally {
        await app.close();
        await upstream.close();
      }
    });

    test('POST body is forwarded', async () => {
      const upstream = await createEchoUpstream();
      const config = cfg({});
      const app = await buildApp(config);
      await app.listen({ port: 0, host: '127.0.0.1' });
      try {
        const addr = app.server.address();
        const fPort = typeof addr === 'object' && addr ? addr.port : 0;
        const payload = JSON.stringify({ hello: 'world' });
        const res = await fetch(`http://127.0.0.1:${fPort}/p`, {
          ...fetchOpts,
          method: 'POST',
          headers: {
            'x-forward-url': `${upstream.origin}/echo`,
            'content-type': 'application/json',
          },
          body: payload,
        });
        assert.equal(res.status, 200);
        const json = (await res.json()) as { body: string };
        assert.equal(json.body, payload);
      } finally {
        await app.close();
        await upstream.close();
      }
    });

    test('upstream status and body pass through', async () => {
      const u = Fastify({ logger: false });
      u.get('/teapot', async (_req, reply) => {
        return reply.code(418).send('teapot');
      });
      await u.listen({ port: 0, host: '127.0.0.1' });
      const uAddr = u.server.address();
      const uPort = typeof uAddr === 'object' && uAddr ? uAddr.port : 0;
      const uOrigin = `http://127.0.0.1:${uPort}`;
      const config = cfg({});
      const app = await buildApp(config);
      await app.listen({ port: 0, host: '127.0.0.1' });
      try {
        const addr = app.server.address();
        const fPort = typeof addr === 'object' && addr ? addr.port : 0;
        const res = await fetch(`http://127.0.0.1:${fPort}/x`, {
          ...fetchOpts,
          headers: { 'x-forward-url': `${uOrigin}/teapot` },
        });
        assert.equal(res.status, 418);
        const text = await res.text();
        assert.equal(text, 'teapot');
      } finally {
        await app.close();
        await u.close();
      }
    });

    test('upstream timeout returns 504', async () => {
      const server = createServer(() => {});
      await new Promise<void>((resolve, reject) => {
        server.listen(0, '127.0.0.1', (err) => (err ? reject(err) : resolve()));
      });
      const addr = server.address();
      const hangPort = typeof addr === 'object' && addr ? addr.port : 0;
      const hangUrl = `http://127.0.0.1:${hangPort}/hang`;
      const config = cfg({ UPSTREAM_TIMEOUT_MS: '400' });
      const app = await buildApp(config);
      await app.listen({ port: 0, host: '127.0.0.1' });
      try {
        const appAddr = app.server.address();
        const fPort = typeof appAddr === 'object' && appAddr ? appAddr.port : 0;
        const res = await fetch(`http://127.0.0.1:${fPort}/x`, {
          ...fetchOpts,
          headers: { 'x-forward-url': hangUrl },
        });
        assert.equal(res.status, 504);
      } finally {
        server.closeAllConnections?.();
        server.close();
        await app.close();
      }
    });
  },
);
