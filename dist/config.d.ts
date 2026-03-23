import { z } from 'zod';
declare const envSchema: z.ZodObject<{
    PORT: z.ZodDefault<z.ZodNumber>;
    HEARTBEAT_PATH: z.ZodDefault<z.ZodString>;
    FORWARD_TARGET_HEADER: z.ZodDefault<z.ZodString>;
    TRUSTED_IPS: z.ZodEffects<z.ZodDefault<z.ZodString>, string[], string | undefined>;
    TRUST_PROXY: z.ZodEffects<z.ZodDefault<z.ZodEnum<["true", "false", "1", "0", "yes", "no"]>>, boolean, "0" | "true" | "false" | "1" | "yes" | "no" | undefined>;
    UPSTREAM_TIMEOUT_MS: z.ZodDefault<z.ZodNumber>;
    MAX_BODY_BYTES: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    PORT: number;
    HEARTBEAT_PATH: string;
    FORWARD_TARGET_HEADER: string;
    TRUSTED_IPS: string[];
    TRUST_PROXY: boolean;
    UPSTREAM_TIMEOUT_MS: number;
    MAX_BODY_BYTES: number;
}, {
    PORT?: number | undefined;
    HEARTBEAT_PATH?: string | undefined;
    FORWARD_TARGET_HEADER?: string | undefined;
    TRUSTED_IPS?: string | undefined;
    TRUST_PROXY?: "0" | "true" | "false" | "1" | "yes" | "no" | undefined;
    UPSTREAM_TIMEOUT_MS?: number | undefined;
    MAX_BODY_BYTES?: number | undefined;
}>;
export type AppConfig = z.output<typeof envSchema>;
export declare function loadConfig(env?: NodeJS.ProcessEnv): AppConfig;
export {};
//# sourceMappingURL=config.d.ts.map