-- CreateEnum (idempotent)
DO $$ BEGIN
  CREATE TYPE "IntegrationType" AS ENUM ('AFFILIATE', 'API_DIRECT', 'WIDGET', 'QR_VOUCHER', 'POSTBACK');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- CreateTable external_partners (idempotent)
CREATE TABLE IF NOT EXISTS "external_partners" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT,
    "logo" TEXT,
    "image" TEXT,
    "discount" INTEGER NOT NULL DEFAULT 0,
    "integrationType" "IntegrationType" NOT NULL,
    "affiliateUrl" TEXT,
    "apiEndpoint" TEXT,
    "apiKey" TEXT,
    "widgetUrl" TEXT,
    "voucherCode" TEXT,
    "webhookSecret" TEXT,
    "source" TEXT DEFAULT 'manual',
    "externalId" TEXT,
    "clickCount" INTEGER NOT NULL DEFAULT 0,
    "conversionCount" INTEGER NOT NULL DEFAULT 0,
    "totalSavings" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'active',
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "external_partners_pkey" PRIMARY KEY ("id")
);

-- CreateTable external_clicks (idempotent)
CREATE TABLE IF NOT EXISTS "external_clicks" (
    "id" TEXT NOT NULL,
    "externalPartnerId" TEXT NOT NULL,
    "userId" TEXT,
    "sessionId" TEXT,
    "savingsAmount" DECIMAL(10,2),
    "converted" BOOLEAN NOT NULL DEFAULT false,
    "convertedAt" TIMESTAMP(3),
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "external_clicks_pkey" PRIMARY KEY ("id")
);

-- Indexes (idempotent)
CREATE INDEX IF NOT EXISTS "external_partners_category_idx" ON "external_partners"("category");
CREATE INDEX IF NOT EXISTS "external_partners_integrationType_idx" ON "external_partners"("integrationType");
CREATE INDEX IF NOT EXISTS "external_partners_source_idx" ON "external_partners"("source");
CREATE INDEX IF NOT EXISTS "external_partners_status_idx" ON "external_partners"("status");
CREATE INDEX IF NOT EXISTS "external_clicks_externalPartnerId_idx" ON "external_clicks"("externalPartnerId");
CREATE INDEX IF NOT EXISTS "external_clicks_userId_idx" ON "external_clicks"("userId");
CREATE INDEX IF NOT EXISTS "external_clicks_converted_idx" ON "external_clicks"("converted");

-- Unique index (idempotent)
CREATE UNIQUE INDEX IF NOT EXISTS "external_partners_externalId_source_key"
  ON "external_partners"("externalId", source)
  WHERE "externalId" IS NOT NULL AND source IS NOT NULL;

-- Foreign key (idempotent)
DO $$ BEGIN
  ALTER TABLE "external_clicks" ADD CONSTRAINT "external_clicks_externalPartnerId_fkey"
    FOREIGN KEY ("externalPartnerId") REFERENCES "external_partners"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
