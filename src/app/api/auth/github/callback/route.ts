import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getIronSession } from 'iron-session';
import { getSessionOptions } from '@/lib/session';
import { exchangeCodeForToken, getGithubUser } from '@/lib/oauth/github';
import prisma from '@/lib/prisma';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const error = url.searchParams.get('error');

  if (error) {
    return NextResponse.redirect(new URL('/login?error=oauth_denied', url));
  }

  if (!code || !state) {
    return NextResponse.redirect(new URL('/login?error=oauth_invalid', url));
  }

  try {
    const session = await getIronSession<{ userId?: string; username?: string; oauthState?: string }>(
      cookies(),
      getSessionOptions()
    );

    // Verify state to prevent CSRF
    if (session.oauthState !== state) {
      return NextResponse.redirect(new URL('/login?error=oauth_csrf', url));
    }

    const accessToken = await exchangeCodeForToken(code);
    const ghUser = await getGithubUser(accessToken);

    // Upsert user by github login
    const email = ghUser.email ?? `${ghUser.login}@github.oauth`;
    let user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      user = await prisma.user.create({
        data: { email, name: ghUser.name ?? ghUser.login },
      });
    }

    session.userId = user.id;
    session.username = user.name ?? user.email;
    delete session.oauthState;
    await session.save();

    return NextResponse.redirect(new URL('/', url));
  } catch {
    return NextResponse.redirect(new URL('/login?error=oauth_failed', url));
  }
}
