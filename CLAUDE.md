@AGENTS.md

# Environment variables

Never access `process.env` directly. Use the validated helpers in `lib/env.ts`:

- `env()` — for server-only code (API routes, server components). Includes DATABASE_URL, DIRECT_URL, etc.
- `publicEnv()` — for client code, Edge middleware, and anywhere that only needs public vars (NEXT_PUBLIC_*).

This ensures all env vars are validated at startup via Zod and provides type safety.

# Architecture docs

See `docs/auth-flow-diagram.md` for a detailed walkthrough of the auth system — how SSR cookies work, the proxy/middleware, token refresh, and the request lifecycle.
