/**
 * sessionStore.ts — DB-backed session allowlist helpers.
 *
 * The iron-session cookie alone is stateless; a stolen cookie stays valid
 * until it expires. These helpers back every session with an `ActiveSession`
 * row so that logout and admin revocation immediately invalidate the session.
 *
 * Security note: sessionId values are UUIDs generated at login and stored
 * only inside the sealed iron-session cookie and in this table.
 * They are NEVER logged.
 */

import prisma from '@/lib/prisma';

/**
 * Inserts a new `ActiveSession` row for the given user.
 *
 * @param userId    The User.id from the DB (or 'admin-unseed' when unseeded).
 * @param sessionId A UUID generated at login time.
 * @param ttlHours  How long (in hours) the session should live — matches the
 *                  iron-session cookie TTL so both expire at the same time.
 */
export async function createActiveSession(
  userId: string,
  sessionId: string,
  ttlHours: number,
): Promise<void> {
  const expiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000);
  await prisma.activeSession.create({
    data: { sessionId, userId, expiresAt },
  });
}

/**
 * Returns `true` when the session exists, is not revoked, and has not expired.
 * Returns `false` otherwise (missing, revoked, or expired).
 *
 * Callers must treat `false` as "not authenticated" regardless of what the
 * iron-session cookie says.
 */
export async function validateActiveSession(sessionId: string): Promise<boolean> {
  try {
    const row = await prisma.activeSession.findFirst({
      where: {
        sessionId,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
    });
    return row !== null;
  } catch {
    // DB error → conservative: treat as invalid.
    return false;
  }
}

/**
 * Marks a single session as revoked by setting `revokedAt` to now.
 * Called on logout so the iron-session cookie, even if replayed, is rejected.
 */
export async function revokeActiveSession(sessionId: string): Promise<void> {
  await prisma.activeSession.updateMany({
    where: { sessionId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

/**
 * Revokes ALL non-revoked sessions for a given user.
 * Useful for admin "force-logout" flows or password changes.
 */
export async function revokeAllUserSessions(userId: string): Promise<void> {
  await prisma.activeSession.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}
