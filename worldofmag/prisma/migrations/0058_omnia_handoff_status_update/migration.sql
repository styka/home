-- Aktualizacja statusu w raporcie-handoff: oznaczenie V4 (Marketplace) i NM1
-- (Kalendarz) jako ZREALIZOWANYCH po sesji 2026-05-31 (v3). Dopisuje sekcję
-- statusu na początek treści; idempotentnie (zastępuje całość przez DO UPDATE
-- przy ponownym uruchomieniu nie jest groźne — sekcja jest stała).

UPDATE "Report"
SET "content" =
$handoff_status$# ✅ Status realizacji (aktualizacja 2026-05-31, sesja v3)

Z backlogu poniżej zrealizowano dotąd:
- **V4 — Marketplace „Usługi"** (Fixly/Booksy) — ZROBIONE. Pełny moduł: profile
  wykonawców, oferty, zlecenia ze strażnikiem przejść statusu, oceny po COMPLETED,
  katalog z filtrem/wyszukiwarką, publiczny profil z opiniami. Migracja 0056.
- **NM1 — Kalendarz** (warstwa spinająca) — ZROBIONE. Read-only agregacja terminów z
  Zadań/Kuchni/Zdrowia/Floty; siatka miesiąca + lista dnia z deep-linkami. Bez nowej
  tabeli. Uprawnienie module.calendar.

Pozostałe pozycje (Fazy 1–4) — jak niżej, kolejność wg priorytetów i zależności.
Reguła sesji: nie próbować wszystkiego naraz — brać pozycje P0/P1, każda z zielonym
buildem, klikaniem (gdy zmiana widoczna) i commitem, a status odhaczać w tym raporcie.

---

$handoff_status$ || "content"
WHERE "slug" = 'omnia-handoff-prompt-2026-05-31'
  AND "content" NOT LIKE '%Status realizacji (aktualizacja 2026-05-31, sesja v3)%';
