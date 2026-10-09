import { z } from 'zod';

const envSchema = z.object({
  /** Bind port for the HTTP server (`0` = ephemeral; used in tests). Default 3000 for production. */
  PORT: z.coerce.number().int().min(0).max(65535).default(3000),
  HEARTBEAT_PATH: z.string().default('/health'),
  FORWARD_TARGET_HEADER: z.string().min(1).default('x-forward-url'),
  TRUSTED_IPS: z
    .string()
    .default('')
    .transform((s) =>
      s
        .split(',')
        .map((x) => x.trim())
        .filter(Boolean),
    ),
  /**
   * `true` trusts X-Forwarded-For from anyone; a comma-separated list of proxy addresses/CIDRs trusts it
   * only from those (Fastify validates the entries at startup).
   */
  TRUST_PROXY: z
    .string()
    .default('false')
    .transform((v): boolean | string[] => {
      if (v === 'true' || v === '1' || v === 'yes') return true;
      if (v === 'false' || v === '0' || v === 'no') return false;
      return v
        .split(',')
        .map((x) => x.trim())
        .filter(Boolean);
    }),
  UPSTREAM_TIMEOUT_MS: z.coerce.number().int().positive().default(30_000),
  MAX_BODY_BYTES: z.coerce.number().int().positive().default(10_485_760),
});

export type AppConfig = z.output<typeof envSchema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = envSchema.safeParse(env);
  if (!parsed.success) {
    const msg = parsed.error.issues.map((e) => `${e.path.join('.')}: ${e.message}`).join('; ');
    throw new Error(`Invalid configuration: ${msg}`);
  }
  return parsed.data;
}
