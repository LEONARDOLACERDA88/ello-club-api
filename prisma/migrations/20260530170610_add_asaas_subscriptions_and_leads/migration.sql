-- Campos Asaas no User
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "asaasCustomerId" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "planKey" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "planExpiresAt" TIMESTAMP(3);

-- Tabela de assinaturas Asaas
CREATE TABLE IF NOT EXISTS "asaas_subscriptions" (
  "id"          TEXT NOT NULL,
  "userId"      TEXT NOT NULL,
  "asaasId"     TEXT NOT NULL,
  "planKey"     TEXT NOT NULL,
  "status"      TEXT NOT NULL DEFAULT 'PENDING',
  "billingType" TEXT NOT NULL,
  "value"       DECIMAL(10,2) NOT NULL,
  "activatedAt" TIMESTAMP(3),
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "asaas_subscriptions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "asaas_subscriptions_asaasId_key" UNIQUE ("asaasId"),
  CONSTRAINT "asaas_subscriptions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "asaas_subscriptions_userId_idx" ON "asaas_subscriptions"("userId");
CREATE INDEX IF NOT EXISTS "asaas_subscriptions_status_idx" ON "asaas_subscriptions"("status");

-- Tabela de eventos de lead
CREATE TABLE IF NOT EXISTS "lead_events" (
  "id"        TEXT NOT NULL,
  "userId"    TEXT,
  "email"     TEXT,
  "name"      TEXT,
  "event"     TEXT NOT NULL,
  "planKey"   TEXT,
  "metadata"  TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "lead_events_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "lead_events_userId_idx" ON "lead_events"("userId");
CREATE INDEX IF NOT EXISTS "lead_events_email_idx" ON "lead_events"("email");
CREATE INDEX IF NOT EXISTS "lead_events_event_idx" ON "lead_events"("event");
