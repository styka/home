-- 0182: raport implementacyjny sesji 2026-06-14 — aktualizacja CLAUDE.md do stanu repo.
-- Treść w bazie (storage='db' z domyślnej wartości kolumny dodanej w 0179).
-- Slug rozróżniony od 0180 (omnia-implementacja-2026-06-14), bo ON CONFLICT DO NOTHING
-- po cichu pominąłby duplikat.
INSERT INTO "Report" ("id","title","slug","content","category","authorId","createdAt","updatedAt")
VALUES (gen_random_uuid()::text,
  'Omnia — Raport implementacji 2026-06-14',
  'omnia-implementacja-2026-06-14-claudemd',
  $claudemd0614$# Omnia — Raport implementacji 2026-06-14

Sesja realizuje jedno zgłoszenie administratora: aktualizację pliku `CLAUDE.md` do
aktualnego stanu repozytorium, tak aby Claude Code dysponował kompletną i prawdziwą
mapą projektu.

## Aktualizacja CLAUDE.md do stanu repo

**Diagnoza:** `CLAUDE.md` był przepisany na bieżąco w commicie `11a5d43` (EN, kompletny),
a regułę numerowania migracji dołożył `c7b8a4c`. Od tamtej pory na `develop` wylądowało
kilkadziesiąt commitów funkcjonalnych (schemat doszedł do migracji 0181), więc plik —
mimo że poprawny na wysokim poziomie — był nieaktualny: brakowało całego nowego modułu
(Kontakty), kilku podstron, ~20 modeli Prisma, nowych Server Actions oraz plików w `lib/`.
Konkretnie nieudokumentowane były: moduł **Kontakty/CRM** (`/contacts`, `module.contacts`,
`Contact`), integracja **Dysku Google** (`DriveConnection`/`DriveFile`, `lib/drive/*`,
`/api/drive/*`, raporty `storage=db|drive`), **Kosz / soft-delete** (`TrashItem`,
`/trash`), **dziennik audytu** (`AuditLog`, `/admin/audit`), **panel zdrowia systemu**
(`/admin/health`, liczony na żywo), **szyfrowanie kluczy API** (`lib/crypto/secrets.ts`),
**personalizacja pulpitu Home** (`DashboardPref`), rozbudowa **Portfela** (`Budget`,
`FinanceGoal`, `FinanceSettings`, `ExchangeRate`, podstrony `/portfel/{budzety,raporty,
ustawienia}`, auto-księgowanie), **Notatki** (`NoteRevision`/`NoteAttachment`, wikilinki),
załączniki (`VehicleAttachment`, `HealthAttachment`) oraz rozbudowa **Marketplace**
(`ServicePayment`, `ServiceDispute`, `ServiceStaff`, `ServiceFavorite`, `ServicePromoCode`,
`/services/moderation`).

**Rozwiązanie:** Wybrano aktualizację **w miejscu** (zamiast pełnego przepisania), bo
struktura pliku jest dobra, a kluczowe bloki reguł użytkownika muszą przetrwać 1:1.
Zachowano dotychczasową konwencję językową (angielski w opisach, polskie etykiety w
blokach reguł). Nienaruszone pozostały bloki: „Rule: Lessons Learned", „STANDING
AUTHORIZATION" (workflow git), „AI Assistant Gotchas", reguła numerowania migracji,
„Keep this table honest" oraz zasada „no Prisma enums / PostgreSQL-only". Nazwy modeli
weryfikowano bezpośrednio w `schema.prisma` (a nie po zgadywaniu agentów — np. `AuditLog`,
a nie „AuditEntry"; `Budget`, a nie „PortfelBudget"; brak modelu zdrowia systemu →
`/admin/health` liczony na żywo). Raport zapisano jako migrację SQL (wzorzec repo, kolumna
`authorId`, idempotentny `ON CONFLICT ("slug") DO NOTHING`) z rozróżnionym slugiem, bo
`omnia-implementacja-2026-06-14` było już zajęte przez migrację 0180.

**Zmienione pliki:**
- `CLAUDE.md` — tabela Module Status (nowy wiersz Kontakty + odświeżone statusy Home/Tasks/
  Notes/Kitchen/Pets/Health/Habits/Flota/Portfel/Languages/Usługi/Reports), blok Route
  Structure (`/contacts`, `/trash`, `/portfel/{budzety,raporty,ustawienia}`,
  `/services/moderation`, `/admin/{audit,health}`), Component Organization (`contacts/`,
  `trash/`, nowe komponenty admin + `shell/FeedbackInspector`, rejestr `lib/modules.tsx`),
  lista Server Actions, lista uprawnień (`module.contacts`), blok Database Schema (~20 modeli),
  nowa sekcja „Cross-cutting systems" (Trash/Audit/System health/szyfrowanie kluczy/Dysk
  Google/personalizacja pulpitu), „Other lib helpers", sekcja Admin Panel oraz „Recently shipped".
- `prisma/migrations/0182_omnia_implementacja_claudemd_report/migration.sql` — niniejszy raport.

## Podsumowanie

Zrealizowano 1 zadanie. Główny obszar zmian: dokumentacja projektu (`CLAUDE.md`) doprowadzona
do zgodności z faktycznym stanem repozytorium na `develop` (schemat do migracji 0181) —
nowy moduł Kontakty, integracja Dysku Google, Kosz, audyt i zdrowie systemu, szyfrowanie
kluczy, personalizacja pulpitu oraz rozbudowy Portfela/Notatek/Marketplace/Pets/Health/
Languages/Tasks. Zachowano wszystkie celowe reguły właściciela repo. Zmiana jest
dokumentacyjna + jedna migracja-raport (addytywna, idempotentna), więc nie wymaga builda;
weryfikacja oparta na przeglądzie zgodności oraz `npm run check:migrations`.
$claudemd0614$,
  'general', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("slug") DO NOTHING;
