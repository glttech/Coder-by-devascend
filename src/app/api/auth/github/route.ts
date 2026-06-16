import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getIronSession } from 'iron-session';
import { getSessionOptions } from '@/lib/session';
import { getGithubAuthUrl } from '@/lib/oauth/github';
import crypto from 'node:crypto';

export async function GET() {
  // Check if GitHub OAuth is configured
  if (!process.env.GITHUB_CLIENT_ID) {
    return NextResponse.json({ error: 'GitHub OAuth not configured. Set GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET.' }, { status: 501 });
  }

  const state = crypto.randomBytes(16).toString('hex');

  // Store state in session to verify on callback
  const session = await getIronSession<{ userId?: string; username?: string; oauthState?: string }>(
    cookies(),
    getSessionOptions()
  );
  session.oauthState = state;
  await session.save();

  return NextResponse.redirect(getGithubAuthUrl(state));
}
