-- Deleta duplicatas antes de criar o unique constraint
DELETE FROM external_partners a
  USING external_partners b
  WHERE a.id > b.id
    AND a."externalId" = b."externalId"
    AND a.source = b.source
    AND a."externalId" IS NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "external_partners_externalId_source_key"
  ON "external_partners"("externalId", source)
  WHERE "externalId" IS NOT NULL AND source IS NOT NULL;
