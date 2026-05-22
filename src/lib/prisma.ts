import { PrismaClient } from '@prisma/client';

// Avoid creating multiple PrismaClient instances in development.  In
// production the module is only loaded once so this will effectively be a
// singleton.  See https://www.prisma.io/docs/guides/database/troubleshooting-orm/help-articles/nextjs-prisma-client for context.
declare global {
  var prisma: PrismaClient | undefined;
}

const prisma = global.prisma || new PrismaClient();

if (process.env.NODE_ENV !== 'production') global.prisma = prisma;

export default prisma;