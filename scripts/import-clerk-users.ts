#!/usr/bin/env npx tsx
/**
 * Import users exported from Clerk into the Better Auth tables.
 *
 * Reads a CSV (Clerk's standard "Export all users" format) from a path
 * passed as the first arg (defaults to ./exported_users.csv).
 *
 * Per row, inserts:
 *   - "user" row with email, name, firstName, lastName, emailVerified,
 *     legacyClerkId = the Clerk user_xxx ID
 *   - "account" row with providerId='credential', password=<bcrypt hash from Clerk>
 *
 * Idempotent: re-running on the same CSV won't duplicate (matches by email).
 *
 * Usage:
 *   npx tsx scripts/import-clerk-users.ts [csv-path]
 *
 * Env vars required:
 *   - DATABASE_URL (loaded from .env)
 */

import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import { parse } from 'csv-parse/sync';
import { prisma } from '../src/shared/lib/prisma';

interface ClerkRow {
  id: string;
  first_name: string;
  last_name: string;
  username: string;
  primary_email_address: string;
  verified_email_addresses: string;
  password_digest: string;
  password_hasher: string;
  totp_secret: string;
  image_url: string;
}

async function main() {
  const csvPath = process.argv[2] ?? path.resolve(process.cwd(), 'exported_users.csv');
  if (!fs.existsSync(csvPath)) {
    console.error(`No se encontró el CSV en: ${csvPath}`);
    process.exit(1);
  }

  console.log(`Leyendo: ${csvPath}`);
  const content = fs.readFileSync(csvPath, 'utf-8');
  const rows: ClerkRow[] = parse(content, {
    columns: true,
    skip_empty_lines: true,
    bom: true,
  });

  console.log(`${rows.length} filas en el CSV`);

  let inserted = 0;
  let skipped = 0;
  let errors = 0;

  for (const row of rows) {
    const email = row.primary_email_address?.trim().toLowerCase();
    if (!email) {
      console.warn(`Skip: fila sin primary_email_address`, { id: row.id });
      skipped++;
      continue;
    }

    const verifiedList = (row.verified_email_addresses ?? '').trim();
    const emailVerified = verifiedList.length > 0;

    const fullName =
      `${row.first_name ?? ''} ${row.last_name ?? ''}`.trim() || email;

    try {
      const result = await prisma.$transaction(async (tx) => {
        // Upsert user (idempotente vs email)
        const existing = await tx.$queryRawUnsafe<{ id: string }[]>(
          `SELECT id FROM "user" WHERE email = $1`,
          email,
        );
        let userId: string;
        if (existing.length > 0) {
          userId = existing[0].id;
          await tx.$executeRawUnsafe(
            `UPDATE "user" SET legacy_clerk_id = $1 WHERE id = $2 AND (legacy_clerk_id IS NULL OR legacy_clerk_id = $1)`,
            row.id,
            userId,
          );
        } else {
          const insertedRows = await tx.$queryRawUnsafe<{ id: string }[]>(
            `INSERT INTO "user" (id, email, email_verified, name, image, created_at, updated_at, first_name, last_name, image_key, legacy_clerk_id)
             VALUES (gen_random_uuid(), $1, $2, $3, $4, NOW(), NOW(), $5, $6, NULL, $7)
             RETURNING id`,
            email,
            emailVerified,
            fullName,
            row.image_url || null,
            row.first_name || null,
            row.last_name || null,
            row.id,
          );
          userId = insertedRows[0].id;
        }

        // Upsert credential account (solo si hay password_digest bcrypt)
        if (row.password_digest && row.password_digest.startsWith('$2')) {
          const existingAccount = await tx.$queryRawUnsafe<{ id: string }[]>(
            `SELECT id FROM account WHERE user_id::text = $1 AND provider_id = 'credential'`,
            userId,
          );
          if (existingAccount.length === 0) {
            await tx.$executeRawUnsafe(
              `INSERT INTO account (id, account_id, provider_id, user_id, password, created_at, updated_at)
               VALUES (gen_random_uuid(), $1, 'credential', $2::uuid, $3, NOW(), NOW())`,
              userId,
              userId,
              row.password_digest,
            );
          }
        }

        return { userId, hadPassword: !!row.password_digest };
      });

      console.log(
        `OK ${email} (${result.userId}) ${result.hadPassword ? '+ password' : '(sin password)'}`,
      );
      inserted++;
    } catch (err) {
      console.error(`ERR ${email}:`, err instanceof Error ? err.message : err);
      errors++;
    }
  }

  console.log('');
  console.log(`Resumen: ${inserted} ok | ${skipped} skipped | ${errors} errores`);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
