import { defineConfig } from "prisma/config";

// Load .env in development; in Docker, DATABASE_URL is passed via -e flag
try { await import("dotenv/config"); } catch {}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "npx tsx prisma/seed.ts",
  },
  datasource: {
    url: process.env.DATABASE_URL!,
  },
});
