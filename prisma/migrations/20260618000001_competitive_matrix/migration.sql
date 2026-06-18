-- PR 116: Competitive Feature Matrix
-- Tracks Coder vs competitors across capability dimensions.

CREATE TABLE IF NOT EXISTS "CompetitorFeature" (
  "id"          TEXT        NOT NULL DEFAULT gen_random_uuid()::text,
  "competitor"  TEXT        NOT NULL,
  "featureKey"  TEXT        NOT NULL,
  "status"      TEXT        NOT NULL DEFAULT 'unknown',
  "notes"       TEXT,
  "updatedBy"   TEXT,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "CompetitorFeature_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "CompetitorFeature_competitor_featureKey_key"
  ON "CompetitorFeature"("competitor", "featureKey");

CREATE INDEX IF NOT EXISTS "CompetitorFeature_competitor_idx"
  ON "CompetitorFeature"("competitor");

CREATE INDEX IF NOT EXISTS "CompetitorFeature_featureKey_idx"
  ON "CompetitorFeature"("featureKey");
