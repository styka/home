-- Z-055: opcja wyłączenia dostępu asystenta AI do danych finansowych (opt-out).
-- Domyślnie włączone (true) — zachowuje dotychczasowe zachowanie; użytkownik
-- może wyłączyć, by saldo/długi nie trafiały do promptu LLM. IF NOT EXISTS — idempotentnie.
ALTER TABLE "FinanceSettings" ADD COLUMN IF NOT EXISTS "aiAccessEnabled" BOOLEAN NOT NULL DEFAULT true;
