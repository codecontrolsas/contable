-- Agrega flag para forzar wizard de onboarding en empresas nuevas
ALTER TABLE "companies" ADD COLUMN "onboarding_completed" BOOLEAN NOT NULL DEFAULT false;

-- Marcar como completed las companies existentes para que no muestren el wizard
UPDATE "companies" SET "onboarding_completed" = true WHERE "created_at" < NOW();
