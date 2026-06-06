import { NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { getSessionOptions } from '@/lib/session';
import type { AppSession } from '@/lib/session';

export const dynamic = 'force-dynamic';

export async function POST() {
  const session = await getIronSession<AppSession>(cookies(), getSessionOptions());
  session.destroy();
  return NextResponse.json({ ok: true });
}
