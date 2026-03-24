import { PrismaClient } from "@/app/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { env } from "@/lib/env";

// Singleton: reuse the same PrismaClient across warm serverless invocations
// to avoid re-creating the connection pool on every request.
// Each cold start still creates its own instance, but Supabase's PgBouncer
// (configured via ?pgbouncer=true in DATABASE_URL) multiplexes connections
// from all instances into a smaller number of real Postgres connections,
// protecting the database from being overwhelmed.
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export function getPrisma(): PrismaClient {
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = new PrismaClient({
      adapter: new PrismaPg({ connectionString: env().DATABASE_URL }),
    });
  }
  return globalForPrisma.prisma;
}
