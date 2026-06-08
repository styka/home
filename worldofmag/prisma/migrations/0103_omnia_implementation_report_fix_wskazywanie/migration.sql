-- Raport (korekta): pływający przycisk „wskazywania" musi działać nad modalem.
-- Idempotentny INSERT z dollar-quoting (jak pozostałe raporty w projekcie).

INSERT INTO "Report" ("id", "title", "slug", "content", "category", "authorId", "createdAt", "updatedAt")
VALUES (
  gen_random_uuid()::text,
  'Omnia — Korekta: tryb wskazywania nad modalem (2026-06-08)',
  'omnia-implementacja-2026-06-08-fix-wskazywanie',
  $omnia_fix_wskazywanie$# Omnia — Korekta: tryb wskazywania nad modalem (2026-06-08)

Korekta do raportu „omnia-implementacja-2026-06-08" (wyniesienie funkcji z rogu
do chrome). Przeniesienie admińskiego „trybu wskazywania" do chrome okazało się
błędne i zostało częściowo cofnięte.

---

## Tryb wskazywania w chrome — błąd i naprawa
**Diagnoza:** Po przeniesieniu admińskiego triggera „wskaż element → zgłoś" z
pływającego przycisku do chrome ujawniły się dwa błędy: (1) na mobile przycisk w
górnym pasku jest **pod modalem** (`fixed inset-0 z-50`), więc przy otwartym
modalu nie dało się go kliknąć — a wskazanie elementu **w modalu** to główny
przypadek użycia; (2) na desktopie funkcja została bez widocznego wejścia (sam
skrót Ctrl+Shift+B), czyli niewykrywalna.

**Rozwiązanie:** Przywrócono **pływający** przycisk (admin-only) — tylko on może
wynieść się nad modal. Zachowuje świadomość modali (`useOverlayState`): w spoczynku
44 px nad asystentem, `z-index 39` (asystent `41` może go ewentualnie lekko
zasłonić, nigdy odwrotnie); gdy otwarty jest modal treściowy, asystent chowa swój
FAB, a ten wskakuje w jego główne miejsce i na `z-index 10001` (nad modalem
`z-50`), więc jest klikalny i pozwala wskazać element w modalu. Pływający przycisk
jest widoczny jednocześnie na desktopie i mobile (rozwiązuje brak wejścia na
desktopie). Zepsuty przycisk z górnego paska usunięto. Dzwonek powiadomień
**zostaje w chrome** (nie ma wymogu działania nad modalem). Wpis w panelu admina i
skrót Ctrl+Shift+B pozostają jako dodatkowe wejścia.

**Zmienione pliki:**
- `src/components/shell/FeedbackInspector.tsx` — przywrócony pływający FAB ze świadomością modali (`useOverlayState`); pozostały też skrót i wejście przez `feedbackBus`.
- `src/components/shell/AppShell.tsx` — usunięty admiński przycisk z górnego paska (był pod modalem); dzwonek powiadomień bez zmian.
- `prisma/migrations/0103_omnia_implementation_report_fix_wskazywanie/migration.sql` — ten raport.

## Podsumowanie
Lekcja: element, który z definicji musi działać NAD modalem (overlay-owe
„wskaż element"), nie może mieszkać w chrome — chrome renderuje się pod modalem
(`z` < 50). Taki trigger musi być pływający, z `z-index` ponad warstwą modali, i
najlepiej świadomy modali (chować się/relokować). Dzwonek powiadomień takiego
wymogu nie ma, więc został w nawigacji. Weryfikacja: `tsc --noEmit` i `next build`
przechodzą.
$omnia_fix_wskazywanie$,
  'general',
  NULL,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("slug") DO NOTHING;
