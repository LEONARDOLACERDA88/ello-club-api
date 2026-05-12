-- CreateEnum
CREATE TYPE "IntegrationType" AS ENUM ('AFFILIATE', 'API_DIRECT', 'WIDGET', 'QR_VOUCHER', 'POSTBACK');

-- AlterTable
ALTER TABLE "partners" ADD COLUMN     "photos" TEXT[];

-- CreateTable
CREATE TABLE "external_partners" (
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
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "external_partners_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "external_clicks" (
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

-- CreateIndex
CREATE INDEX "external_partners_category_idx" ON "external_partners"("category");

-- CreateIndex
CREATE INDEX "external_partners_integrationType_idx" ON "external_partners"("integrationType");

-- CreateIndex
CREATE INDEX "external_partners_source_idx" ON "external_partners"("source");

-- CreateIndex
CREATE INDEX "external_partners_status_idx" ON "external_partners"("status");

-- CreateIndex
CREATE INDEX "external_clicks_externalPartnerId_idx" ON "external_clicks"("externalPartnerId");

-- CreateIndex
CREATE INDEX "external_clicks_userId_idx" ON "external_clicks"("userId");

-- CreateIndex
CREATE INDEX "external_clicks_converted_idx" ON "external_clicks"("converted");

-- AddForeignKey
ALTER TABLE "external_clicks" ADD CONSTRAINT "external_clicks_externalPartnerId_fkey" FOREIGN KEY ("externalPartnerId") REFERENCES "external_partners"("id") ON DELETE CASCADE ON UPDATE CASCADE;
