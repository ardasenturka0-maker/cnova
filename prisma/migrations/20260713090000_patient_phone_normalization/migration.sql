ALTER TABLE "Patient" ADD COLUMN "phoneNormalized" TEXT;

UPDATE "Patient"
SET "phoneNormalized" = RIGHT(REGEXP_REPLACE("phone", '[^0-9]', '', 'g'), 10)
WHERE LENGTH(REGEXP_REPLACE("phone", '[^0-9]', '', 'g')) >= 7;

CREATE INDEX "Patient_organizationId_phoneNormalized_idx" ON "Patient"("organizationId", "phoneNormalized");
