/**
 * Re-export the shared Prisma client under the canonical `@/lib/db` alias.
 * Both `@/lib/prisma` and `@/lib/db` refer to the same singleton instance.
 */
export { default } from './prisma';
