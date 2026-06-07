-- Raport implementacyjny: moduł „Warsztaty".
-- Idempotentny INSERT z dollar-quoting (jak pozostałe raporty w projekcie).

INSERT INTO "Report" ("id", "title", "slug", "content", "category", "authorId", "createdAt", "updatedAt")
VALUES (
  gen_random_uuid()::text,
  'Omnia — Raport implementacji 2026-06-07',
  'omnia-implementacja-2026-06-07',
  $omnia_warsztaty$# Omnia — Raport implementacji 2026-06-07

Sesja realizuje jedno zgłoszenie: **nowy dział „Warsztaty"** — do zarządzania
przydomowym warsztatem/pracownią **dowolnego typu** (nie tylko samochodowym:
stolarski, malarski, elektroniczny, ślusarski, ceramiczny, krawiecki, jubilerski,
ogólny DIY). Ma trzymać wyposażenie pod kontrolą i **podpowiadać, jaki sprzęt warto
mieć** zależnie od profilu pracowni, a także oferować **tryb zaawansowany** dla
1–kilkuosobowych firm/kolektywów/zespołów.

## Warsztaty — nowy moduł (`/warsztaty`)

**Diagnoza:** W aplikacji brakowało działu do ewidencji wyposażenia warsztatu/
pracowni. Wymagania: uniwersalność (różne profile warsztatów), podpowiedzi sprzętu
zależne od profilu oraz tryb dla zespołów/firm.

**Rozwiązanie:** Moduł zbudowano wg sprawdzonego wzorca **Magazynowania** — dwa
tryby per-user (Dom/Pro) z sub-nawigacją filtrowaną trybem oraz własnością
`ownerId`/`ownerTeamId` (prywatna lub zespołowa). Kluczowe decyzje:

- **Katalog podpowiedzi trzymany statycznie w TS** (`src/lib/warsztat/catalog.ts`),
  nie w bazie — to treść tylko-do-odczytu (jak `categorize.ts`), więc zero migracji/
  seedu i łatwa rozbudowa. 9 profili warsztatów, każdy z listą sprzętu w 3 poziomach
  (podstawowe / zalecane / zaawansowane). Na checkliście „Podpowiedzi" pozycje już
  posiadane są wyszarzone (dopasowanie po `WorkshopItem.suggestionKey`), a braki
  dodaje się zbiorczo jednym kliknięciem.
- **Wyposażenie i materiały w jednym modelu** (`WorkshopItem`) z polem `kind`
  (narzędzie/maszyna/materiał/BHP), `condition`, `minQuantity` (low-stock dla
  materiałów) i `nextServiceAt` (przegląd) — zamiast mnożyć tabele. Dostęp pozycji
  i projektów dziedziczy z warsztatu (brak własnego ownera), co upraszcza guardy.
- **Tryb Pro** odblokowuje: własność zespołową przy tworzeniu, przypisanie narzędzi
  do osób/stanowisk (`assignedTo`/`station`), agendę przeglądów + materiałów
  na wyczerpaniu (`/warsztaty/przeglady`, horyzont 30 dni + zaległe) oraz dziennik
  projektów/zleceń (`WorkshopProject`).
- **Integracja z asystentem AI:** read-tool `list_workshops` oraz akcje
  `create_workshop` / `add_workshop_item` (z rozpoznaniem warsztatu po nazwie) —
  spójność katalog↔executor potwierdza `check-action-coverage.js` w buildzie.

**Zmienione/nowe pliki:**
- `prisma/schema.prisma` — modele `WarsztatSettings`, `Workshop`, `WorkshopItem`,
  `WorkshopProject` + relacje na `User`/`Team`.
- `prisma/migrations/0095_warsztaty/migration.sql` — tabele + indeksy + FK
  (idempotentnie, wzór 0082).
- `src/lib/warsztat/catalog.ts` — profile warsztatów + katalog podpowiedzi sprzętu.
- `src/actions/warsztat.ts` — Server Actions (CRUD warsztatów/wyposażenia/projektów,
  tryb Dom/Pro, `addSuggestedItems`, `getMaintenanceOverview`) z guardami dostępu.
- `src/app/warsztaty/**` — `layout.tsx` (auth+perm+tryb), lista, szczegół
  `[workshopId]`, `przeglady`, `ustawienia`.
- `src/components/warsztaty/**` — `WarsztatNav`, `WorkshopsList`, `WorkshopDetail`
  (zakładki Wyposażenie/Podpowiedzi/Projekty), `MaintenanceAgenda`,
  `WarsztatSettingsForm`.
- `src/lib/permissions.ts`, `src/lib/modules.tsx`, `scripts/migrate.js` — rejestracja
  modułu + uprawnienia `module.warsztaty` (ikona Wrench, seed na deployu).
- `src/lib/ai/aiAction.ts`, `src/lib/ai/agentTools.ts`,
  `src/app/api/llm/home/agent/route.ts`, `src/app/api/llm/home/execute/route.ts` —
  integracja z asystentem AI (read-tool + akcje + routing słów-kluczy).
- `src/actions/activity.ts` — moduł `warsztaty` w `trackActivity`.
- `CLAUDE.md` — aktualizacja tabeli modułów, tras, uprawnień, schematu i listy akcji.

## Podsumowanie

Zrealizowano **1 zgłoszenie** — pełny, nowy moduł **Warsztaty** w wariancie
MVP + tryb Pro + materiały eksploatacyjne. Główne obszary zmian: nowy model danych
(4 modele + migracja), statyczny katalog podpowiedzi sprzętu, komplet tras i
komponentów (lista / szczegół z 3 zakładkami / przeglądy / ustawienia) oraz pełna
rejestracja modułu (nawigacja, RBAC, asystent AI). `next build` przechodzi; guard
spójności akcji asystenta zielony. Wzorzec celowo skopiowano z Magazynowania, żeby
zachować spójność UX i obniżyć ryzyko regresji.
$omnia_warsztaty$,
  'general',
  NULL,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("slug") DO NOTHING;
