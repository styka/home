-- Raport implementacji 2026-06-14: pełna aktualizacja CLAUDE.md do stanu repo.
-- Idempotentny INSERT z dollar-quoting (jak pozostałe raporty w projekcie).

INSERT INTO "Report" ("id", "title", "slug", "content", "category", "authorId", "createdAt", "updatedAt")
VALUES (
  gen_random_uuid()::text,
  'Omnia — Raport implementacji 2026-06-14',
  'omnia-implementacja-2026-06-14',
  $omnia_impl_20260614$# Omnia — Raport implementacji 2026-06-14

Sesja jednozadaniowa: aktualizacja głównego pliku `CLAUDE.md` (instrukcje dla
Claude Code) do faktycznego stanu projektu.

---

## Zaktualizuj CLAUDE.md

**Diagnoza:** `CLAUDE.md` rozjechał się z kodem o ~60 commitów (ostatnia
merytoryczna aktualizacja 2026-06-03). Brakowało całych modułów (Usługi /
marketplace, Kalendarz, Powiadomienia), modeli DB (`Service*` ×9, `Notification`,
`UserMenuPref`) oraz faktów o workflow. Część treści była wprost błędna:
„local dev = SQLite" jest nieaktualne (schema ma `provider = "postgresql"`),
opis asystenta wskazywał usuniętą trasę `home/interpret` i nieaktualne miejsce
typu `AIAction`, lista namespace'ów `llm-client.ts` zawierała nieistniejący
namespace `home`, a typy operacji LLM były wymienione błędnie. Status `Calendar`
był „stub", choć moduł jest wdrożony i ma uprawnienie `module.calendar`.

**Rozwiązanie:** Pełna redakcja `CLAUDE.md` **w całości po angielsku** (wybór
właściciela), kompletna ale czytelniejsza. Zachowano strukturę sprawdzonego
pliku zamiast wymyślać nową — żeby nie utracić „honest module table", na której
właściciel polega. **Wszystkie instrukcje user-intent przeniesiono z zachowaniem
mocy** (przetłumaczone, nie osłabione): zasada Lessons Learned → dopisywanie do
`doświadczenia.md` (nazwa pliku i polskie etykiety szablonu zachowane, bo log jest
po polsku), STAŁA ZGODA na merge `claude/*` → `develop`, 8 „AI Assistant Gotchas",
sekcja E2E i wskaźnik do `CONTEXT.md`. Dodano nową sekcję **„Database &
migrations"** z wnioskami z `doświadczenia.md` (Postgres-only lokalnie; sama edycja
`schema.prisma` nie tworzy tabel na prodzie — trzeba pliku migracji; nigdy
`npm run build`/migrate.js lokalnie na prod-bazie). Zsynchronizowano: tabelę
modułów (Usługi, Kalendarz; Work jako wyłączony stub), Route Structure, sloty
uprawnień (`module.services`, `module.calendar`), listę Server Actions
(`calendar`/`notifications`/`menuPrefs`/`services`/`medications`/`skins`/`news`/
`weather`), komponenty, pełną listę modeli schematu, sekcję LLM (poprawne
namespace'y + 4 typy operacji `dispatch`/`reasoning`/`vision`/`generation` +
biblioteki integracji ORS/Overpass/GoogleMaps/groqVision/openMeteo), nową sekcję
„Notifications & menu customization", podstrony admina (`/admin/docs`,
`/admin/skins`), build pipeline (`copy-docs.js` + `check-action-coverage.js`) i
odświeżono roadmapę.

**Zmienione pliki:**
- `CLAUDE.md` — pełna redakcja do stanu repo (EN, kompletna, user-intent zachowane).
- `prisma/migrations/0109_omnia_implementacja_raport_2026_06_14/migration.sql` — ten raport.

## Podsumowanie
Jedno zadanie, obszar: dokładność dokumentacji. Weryfikacja przez porównanie
tras (`src/app`), modeli (`schema.prisma`) i uprawnień (`lib/permissions.ts`) z
treścią pliku. Nie zmieniano kodu aplikacji (tylko dokumentacja + idempotentna
migracja-raport), więc świadomie pominięto `npm run build` — build odpala
`migrate.js` na produkcyjnej bazie Neon i jest zbędny dla zmiany markdown.
$omnia_impl_20260614$,
  'general',
  NULL,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("slug") DO NOTHING;
