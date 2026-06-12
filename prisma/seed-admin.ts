// Seeds the admin User record from env vars. Safe to run multiple times (upsert).
// Usage: tsx prisma/seed-admin.ts
// Requires: ADMIN_USERNAME set in environment (the username IS the email for lookup)

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface AdminSeedPayload {
  email: string;
  name: string;
  role: string;
}

/**
 * Builds the upsert payload for the admin user from an email string.
 * Throws if the email is empty.
 */
export function buildAdminSeedPayload(email: string): AdminSeedPayload {
  if (!email) {
    throw new Error('email must be a non-empty string');
  }
  return { email, name: 'Admin', role: 'admin' };
}

async function main(): Promise<void> {
  const email = process.env.ADMIN_USERNAME;

  if (!email) {
    console.error('Error: ADMIN_USERNAME environment variable is not set.');
    console.error('Please set ADMIN_USERNAME to the admin email address and retry.');
    process.exit(1);
  }

  let payload: AdminSeedPayload;
  try {
    payload = buildAdminSeedPayload(email);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`Error building admin seed payload: ${message}`);
    process.exit(1);
  }

  try {
    await prisma.user.upsert({
      where: { email: payload.email },
      update: { role: 'admin' },
      create: payload,
    });
    console.log(`✓ Admin user ensured: ${payload.email} (role: admin)`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`Error upserting admin user: ${message}`);
    process.exit(1);
  }
}

// Only run when executed directly (not when imported by tests or other modules).
const isMain =
  typeof process.argv[1] !== 'undefined' &&
  (process.argv[1].endsWith('seed-admin.ts') || process.argv[1].endsWith('seed-admin.js'));

if (isMain) {
  main()
    .catch((err: unknown) => {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`Unexpected error: ${message}`);
      process.exit(1);
    })
    .finally(() => {
      prisma.$disconnect().catch(() => undefined);
    });
}
