import type { FastifyInstance } from 'fastify';
import ipaddr from 'ipaddr.js';
import type { AppConfig } from '../config.js';

type Matcher = { match: (addr: ipaddr.IPv4 | ipaddr.IPv6) => boolean };

function parseTrustedRanges(entries: string[]): Matcher[] {
  const ranges: Matcher[] = [];
  for (const raw of entries) {
    const s = raw.trim();
    if (!s) continue;
    if (s.includes('/')) {
      try {
        const [network, prefixLen] = ipaddr.parseCIDR(s);
        ranges.push({
          match: (client) => {
            try {
              if (client.kind() !== network.kind()) return false;
              return client.match(network, prefixLen);
            } catch {
              return false;
            }
          },
        });
      } catch {
        throw new Error(`Invalid CIDR in TRUSTED_IPS: ${raw}`);
      }
    } else {
      try {
        const addr = ipaddr.parse(s);
        ranges.push({
          match: (client) => {
            try {
              return client.kind() === addr.kind() && client.toString() === addr.toString();
            } catch {
              return false;
            }
          },
        });
      } catch {
        throw new Error(`Invalid IP in TRUSTED_IPS: ${raw}`);
      }
    }
  }
  return ranges;
}

function buildWhitelistCheck(entries: string[]): (clientAddr: ipaddr.IPv4 | ipaddr.IPv6) => boolean {
  const ranges = parseTrustedRanges(entries);
  return (clientAddr) => {
    if (entries.length === 0) return false;
    for (const r of ranges) {
      if (r.match(clientAddr)) return true;
    }
    return false;
  };
}

export function parseClientIp(ip: string | undefined): ipaddr.IPv4 | ipaddr.IPv6 | null {
  if (!ip) return null;
  const trimmed = ip.replace(/^::ffff:/, '');
  try {
    return ipaddr.parse(trimmed);
  } catch {
    return null;
  }
}

export function isIpWhitelisted(
  clientAddr: ipaddr.IPv4 | ipaddr.IPv6 | null,
  trustedEntries: string[],
): boolean {
  if (!clientAddr || trustedEntries.length === 0) return false;
  const ranges = parseTrustedRanges(trustedEntries);
  for (const r of ranges) {
    if (r.match(clientAddr)) return true;
  }
  return false;
}

export function registerIpWhitelist(app: FastifyInstance, config: AppConfig): void {
  const heartbeatPath = config.HEARTBEAT_PATH;
  const check = buildWhitelistCheck(config.TRUSTED_IPS);

  app.addHook('onRequest', async (request, reply) => {
    // Exempt only requests routed to the heartbeat handler (GET). Matching the raw path also exempted
    // POST/PUT/PATCH/DELETE/HEAD on it, which the catch-all forward route serves.
    if (request.routeOptions.url === heartbeatPath) return;

    const path = request.url.split('?')[0];
    const rawIp = request.ip;
    const clientAddr = parseClientIp(rawIp);
    if (!clientAddr || !check(clientAddr)) {
      request.log.warn(
        { event: 'access_denied', sourceIp: rawIp, path },
        'request blocked: source IP not whitelisted',
      );
      return reply.code(403).send({ error: 'Forbidden', reason: 'source IP not allowed' });
    }
  });
}
