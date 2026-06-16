CREATE TABLE "Invitation" (
  "id" TEXT NOT NULL,
  "orgId" TEXT NOT NULL DEFAULT 'org_default',
  "email" TEXT NOT NULL,
  "role" TEXT NOT NULL DEFAULT 'reviewer',
  "token" TEXT NOT NULL,
  "invitedBy" TEXT NOT NULL DEFAULT 'system',
  "status" TEXT NOT NULL DEFAULT 'pending',
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Invitation_token_key" ON "Invitation"("token");
CREATE INDEX "Invitation_orgId_idx" ON "Invitation"("orgId");
CREATE INDEX "Invitation_email_idx" ON "Invitation"("email");
