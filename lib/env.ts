import { z } from "zod";

// Public env vars — available in both browser and Edge middleware.
// NEXT_PUBLIC_ prefix means Next.js bundles these into client-side JS,
// so they're visible in the browser. Only put non-secret values here.
const publicEnvSchema = z.object({
  // The URL of our Supabase project. The browser needs this to know
  // where to send auth requests (sign in, sign up, sign out).
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  // The publishable (anon) key for our Supabase project. Safe to expose
  // in the browser — it identifies the project but doesn't grant any
  // special access. Operations are still gated by Row Level Security.
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
});

// Server-only env vars — only available in Node.js runtime (API routes,
// server components), NOT in Edge middleware or the browser.
const serverEnvSchema = publicEnvSchema.extend({
  DATABASE_URL: z.string().url(),
  DIRECT_URL: z.string().url(),
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
});

export type PublicEnv = z.infer<typeof publicEnvSchema>;
export type ServerEnv = z.infer<typeof serverEnvSchema>;

let _publicEnv: PublicEnv | undefined;
let _serverEnv: ServerEnv | undefined;

// Safe to call from Edge middleware and client code.
export function publicEnv(): PublicEnv {
  if (!_publicEnv) {
    _publicEnv = publicEnvSchema.parse(process.env);
  }
  return _publicEnv;
}

// Only call from Node.js server code (API routes, server components).
export function env(): ServerEnv {
  if (!_serverEnv) {
    _serverEnv = serverEnvSchema.parse(process.env);
  }
  return _serverEnv;
}
