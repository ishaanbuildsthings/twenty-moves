// One-time seed script for public race rooms.
// Run with: npx tsx prisma/seed-public-rooms.ts
//
// Requires DATABASE_URL in .env or .env.local

import { PrismaClient } from "../app/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL not set. Add it to .env.local or .env.");
  process.exit(1);
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

// Inline scramble + code generation so we don't need @/ path aliases

const CODE_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
function generateRoomCode(): string {
  let code = "";
  for (let i = 0; i < 5; i++) {
    code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  }
  return code;
}

function generateScramble333(): string {
  const faces = ["R", "L", "U", "D", "F", "B"];
  const modifiers = ["", "'", "2"];
  const axes = [["R", "L"], ["U", "D"], ["F", "B"]];
  const moves: string[] = [];
  let lastFace = "";
  let lastAxis = -1;

  for (let i = 0; i < 20; i++) {
    let face: string;
    let axis: number;
    do {
      face = faces[Math.floor(Math.random() * faces.length)];
      axis = axes.findIndex((a) => a.includes(face));
    } while (face === lastFace || axis === lastAxis);
    const mod = modifiers[Math.floor(Math.random() * modifiers.length)];
    moves.push(face + mod);
    lastFace = face;
    lastAxis = axis;
  }
  return moves.join(" ");
}

const PUBLIC_ROOMS = [
  {
    name: "Sub-8 3x3",
    description: "For cubers with an official WCA 3x3 average under 8 seconds.",
    eventName: "333",
    maxTimeMs: 800,
    maxTimeEvent: "333",
  },
  {
    name: "Sub-12 3x3",
    description: "For cubers with an official WCA 3x3 average under 12 seconds.",
    eventName: "333",
    maxTimeMs: 1200,
    maxTimeEvent: "333",
  },
  {
    name: "Sub-20 3x3",
    description: "For cubers with an official WCA 3x3 average under 20 seconds.",
    eventName: "333",
    maxTimeMs: 2000,
    maxTimeEvent: "333",
  },
  {
    name: "Sub-30 3BLD",
    description: "For cubers with an official WCA 3BLD average under 30 seconds.",
    eventName: "333bf",
    maxTimeMs: 3000,
    maxTimeEvent: "333bf",
  },
  {
    name: "Sub-1:00 3BLD",
    description: "For cubers with an official WCA 3BLD average under 1 minute.",
    eventName: "333bf",
    maxTimeMs: 6000,
    maxTimeEvent: "333bf",
  },
];

async function main() {
  const host = await prisma.user.findFirst({ orderBy: { createdAt: "asc" } });
  if (!host) {
    console.error("No users in DB. Create an account first, then run this script.");
    process.exit(1);
  }

  for (const room of PUBLIC_ROOMS) {
    const existing = await prisma.raceRoom.findFirst({
      where: { name: room.name, public: true },
    });
    if (existing) {
      console.log(`Skipping "${room.name}" — already exists (code: ${existing.code})`);
      continue;
    }

    const event = await prisma.event.findUnique({ where: { name: room.eventName } });
    if (!event) {
      console.error(`Event "${room.eventName}" not found in DB. Skipping "${room.name}".`);
      continue;
    }

    const scrambles = Array.from({ length: 200 }, () => generateScramble333());

    const scrambleSet = await prisma.scrambleSet.create({
      data: { eventId: event.id, scrambles },
    });

    const code = generateRoomCode();
    const created = await prisma.raceRoom.create({
      data: {
        code,
        hostId: host.id,
        eventId: event.id,
        scrambleSetId: scrambleSet.id,
        public: true,
        name: room.name,
        description: room.description,
        maxTimeMs: room.maxTimeMs,
        maxTimeEvent: room.maxTimeEvent,
      },
    });

    console.log(`Created "${room.name}" — code: ${created.code}`);
  }

  console.log("Done.");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
