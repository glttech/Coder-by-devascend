import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET() {
  let dbStatus: 'ok' | 'error' = 'ok';

  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    dbStatus = 'error';
  }

  const body = {
    status: dbStatus === 'ok' ? ('ok' as const) : ('error' as const),
    db: dbStatus,
    version: process.env.npm_package_version,
    uptime: process.uptime(),
  };

  const httpStatus = body.status === 'ok' ? 200 : 503;
  return NextResponse.json(body, { status: httpStatus });
}
