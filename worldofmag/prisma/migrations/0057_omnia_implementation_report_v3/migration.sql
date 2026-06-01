-- Raport implementacji 2026-05-31 (v3): Marketplace „Usługi" + moduł Kalendarz.
-- Idempotentny upsert po slug (DO UPDATE); slugi -v1/-v2 zajęte przez 0048/0049.

INSERT INTO "Report" ("id", "title", "slug", "content", "category", "authorId", "createdAt", "updatedAt")
VALUES (
  gen_random_uuid()::text,
  'Omnia — Raport implementacji 2026-05-31 (v3)',
  'omnia-implementacja-2026-05-31-v3',
  $omnia_impl_v3$# Omnia — Raport implementacji 2026-05-31 (v3)

Sesja realizująca dwa zgłoszenia administratora: **nowy dział „Usługi"** (marketplace
konkurencyjny dla Fixly/Booksy) oraz **kontynuację realizacji wskazań** z raportu
architektury. Z backlogu handoff (`omnia-handoff-prompt-2026-05-31`, ~70 pozycji)
zrealizowano dwie pozycje o najwyższym priorytecie: **V4 (Marketplace)** i **NM1
(Kalendarz)** — zgodnie z §19 raportu, gdzie Kalendarz jest wskazany jako warstwa
spinająca o najwyższym ROI.

## Wprowadź nowe działy — konkurencja dla Fixly/Booksy
**Diagnoza:** Brakowało działu do nawiązywania współpracy usługowej, w którym ten sam
użytkownik może być klientem (składa zlecenia) i wykonawcą (wystawia oferty, przyjmuje
zlecenia). Wymagany pełny, dwustronny cykl: oferta → zapytanie → akceptacja → realizacja
→ ocena.

**Rozwiązanie (i dlaczego tak):** Zbudowano moduł „Usługi" jako **pionowy wycinek wg
konwencji repo**, nie osobną aplikację — dzięki czemu reużywa modelu własności
user/zespół, RBAC, Server Actions i design systemu. Statusy zlecenia trzymane jako
`String` + unia TS (zasada repo: bez enumów Prisma). Cykl życia chroniony **strażnikiem
dozwolonych przejść** po stronie serwera (`REQUESTED→ACCEPTED→SCHEDULED→IN_PROGRESS→
COMPLETED`, plus `DECLINED`/`CANCELLED`), więc UI nie może wymusić nielegalnego stanu.
Średnia ocen wykonawcy jest **denormalizowana** (`ratingAvg`/`ratingCount`) i przeliczana
transakcyjnie przy dodaniu opinii — szybkie listowanie katalogu bez agregacji per wiersz.
Oceny możliwe wyłącznie przez klienta i tylko po `COMPLETED`. Kategorie usług to słownik
trójpoziomowy (system/user/team) z 10 kategoriami systemowymi zaseedowanymi w migracji.

Nawigacja: moduł zarejestrowany w **jednym źródle** (`MODULES` w `src/lib/modules.tsx`),
które zasila zarówno sidebar, jak i menu mobilne — lekcja z `doświadczenia.md` o dwóch
źródłach nawigacji. Uprawnienie `module.services` (ADMIN, BETA_TESTER) seedowane w
`scripts/migrate.js`.

**Zmienione pliki:**
- `prisma/schema.prisma` — modele `ServiceCategory`, `ServiceProvider`, `ServiceListing`, `ServiceRequest`, `ServiceReview` + relacje w `User`/`Team`.
- `prisma/migrations/0056_services_marketplace/migration.sql` — tabele, indeksy, FK, seed kategorii.
- `src/actions/services.ts` — server actions (profil, oferty, katalog, cykl zlecenia, oceny).
- `src/lib/services.ts` — typy i stałe (plik „use server" eksportuje tylko funkcje).
- `src/app/services/**` — trasy: katalog, szczegóły oferty, panel wykonawcy, moje zlecenia, publiczny profil.
- `src/components/services/**` — komponenty klienckie + helpery UI (statusy, ceny, gwiazdki).
- `src/lib/modules.tsx`, `src/lib/permissions.ts`, `scripts/migrate.js` — rejestracja modułu i uprawnienia.

## Dokończenie wskazań raportu — moduł Kalendarz (NM1)
**Diagnoza:** Raport (§18.5, §19) wskazuje Kalendarz jako **dział o najwyższym
priorytecie** — warstwę spinającą terminy rozproszone po modułach (zadania, posiłki,
zdrowie, przeglądy floty). Dotąd `/calendar` był zablokowanym stubem „wkrótce".

**Rozwiązanie (i dlaczego tak):** Zaimplementowano Kalendarz jako **read-only agregację
bez nowej tabeli** — zgodnie ze specyfikacją handoff. Źródłem są istniejące modele, a
`getCalendarEvents(year, month0)` mapuje je na wspólny typ `CalendarEvent`. To celowo
minimalna, addytywna zmiana: zero migracji danych, zero ryzyka dla istniejących modułów,
a mimo to dostarcza realną wartość spinającą. Zadania ukończone/anulowane są pomijane
(kalendarz = „co przede mną"). Każde zdarzenie ma deep-link do modułu źródłowego.
Odblokowano moduł z „coming soon" (wpis w `MODULES`, uprawnienie `module.calendar`,
usunięcie stuba z sidebara i menu mobilnego).

**Zmienione pliki:**
- `src/actions/calendar.ts` — agregacja zdarzeń z 4 modułów ze scopingiem user/zespół.
- `src/lib/calendar.ts` — typy `CalendarEvent`, metadane modułów, helpery dat.
- `src/app/calendar/**`, `src/components/calendar/CalendarPage.tsx` — siatka miesiąca + lista dnia.
- `src/lib/modules.tsx`, `src/lib/permissions.ts`, `scripts/migrate.js` — rejestracja + uprawnienie.
- `src/components/shell/{ModuleSidebar,AppShell}.tsx` — zdjęcie stuba „coming soon".

## Weryfikacja
- `npx tsc --noEmit` — **0 błędów** (strict).
- `next build` — **Compiled successfully**; wszystkie nowe trasy zbudowane:
  `/services`, `/services/[listingId]`, `/services/provider`, `/services/providers/[id]`,
  `/services/requests`, `/calendar`.
- **Uwaga o weryfikacji:** w tej sesji Docker był niedostępny, więc nie zastosowano
  migracji do efemerycznej bazy ani nie uruchomiono klikania E2E. Poprawność schematu
  potwierdza `prisma generate` (waliduje każde pole/relację) + `tsc` na wygenerowanym
  kliencie. Migracja `0056` i klikanie pozostają do weryfikacji w środowisku z Dockerem
  (`npm run test:e2e:docker`) lub po auto-deployu na `develop`.

## Podsumowanie
Zrealizowano dwa flagowe działy: **Usługi** (pełny dwustronny marketplace klient ↔
wykonawca z cyklem zlecenia i ocenami) oraz **Kalendarz** (warstwa spinająca terminy
wszystkich modułów). Oba wpisują się w strategię raportu: przewaga Omnia nie w głębi
pojedynczego modułu, lecz w integracji całości. Pozostałe pozycje backlogu (Fazy 1–4,
~58 pozycji) pozostają udokumentowane w raporcie `omnia-handoff-prompt-2026-05-31`,
zaktualizowanym o status NM1 i V4 jako zrealizowanych.
$omnia_impl_v3$,
  'general',
  NULL,
  NOW(),
  NOW()
)
ON CONFLICT ("slug") DO UPDATE
  SET "title" = EXCLUDED."title",
      "content" = EXCLUDED."content",
      "category" = EXCLUDED."category",
      "updatedAt" = NOW();
