-- Z-194 (T-12): granularne role rodzic/dziecko w rodzinie/zespole.
-- Per-członek lista modułów, do których ma dostęp do WSPÓŁDZIELONYCH zasobów zespołu.
-- Semantyka kolumny `moduleAccess` (TEXT, JSON string[] lub NULL):
--   * NULL          → brak ograniczeń = pełny dostęp ("rodzic" lub niezredukowane "dziecko") — wstecznie zgodne,
--   * "[]"          → dostęp do ŻADNEGO współdzielonego modułu,
--   * '["tasks",…]' → dostęp tylko do wymienionych modułów (id zgodne z mapą współdzielenia).
-- „Rodzice" (role OWNER/ADMIN) mają pełny dostęp niezależnie od tej kolumny (egzekwowane w kodzie).
-- Nullable + IF NOT EXISTS — idempotentnie, zero zmian dla istniejących wierszy (konwencja projektu).
ALTER TABLE "TeamMember" ADD COLUMN IF NOT EXISTS "moduleAccess" TEXT;
