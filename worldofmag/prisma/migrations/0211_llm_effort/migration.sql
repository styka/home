-- 033: poziom „wysiłku" (effort) modelu LLM.
--
-- `LlmAssignment.effort` — ustawiany przez admina per typ operacji. Wspólna, opisowa skala
-- (none|low|medium|high) tłumaczona na parametr WŁAŚCIWY dla dostawcy w src/lib/llm/effort.ts
-- (Anthropic → budżet rozszerzonego myślenia, OpenAI-compatible z rodziny rozumującej →
-- reasoning_effort, pozostałe → parametr pomijany). NULL = „brak" → zachowanie jak przed zmianą.
--
-- `AiCall.effort` — diagnostyka: z jakim poziomem wysiłku FAKTYCZNIE wykonano wywołanie
-- (po ewentualnej degradacji), żeby admin mógł to potwierdzić w logu wywołań modelu.
--
-- Kolumny TEXT + typ TS (union `LlmEffort`) — bez enumów Prisma (C-12).
-- Migracja addytywna i nullable: istniejące wiersze dostają NULL, zero backfillu.

ALTER TABLE "LlmAssignment" ADD COLUMN IF NOT EXISTS "effort" TEXT;
ALTER TABLE "AiCall"        ADD COLUMN IF NOT EXISTS "effort" TEXT;
