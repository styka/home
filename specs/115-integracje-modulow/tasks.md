# Zadania: Integracje międzymodułowe (Z-INT-01…19)

- **Plan:** ./plan.md (115-integracje-modulow)
- **Status:** todo
- **Data:** 2026-08-29

> Kolejność wg zależności: fundament portfela → migracje → mosty kosztów → mosty zadań →
> mosty treści → automaty/odczyty → pulpit → Pro → bramki/domknięcie. `[P]` = niezależne pliki,
> można równolegle. Każde zadanie ≈ jeden commit; po każdej FAZIE: `tsc -p tsconfig.test.json`
> + `next lint` + celowane testy.

## Legenda
- `[ ]` do zrobienia · `[x]` zrobione · `[~]` w trakcie · `[!]` zablokowane
- `[P]` — równoległe względem poprzedniego

## Faza 0 — Fundament
- [x] **T-1** — Portfel: `lib/autoExpense.ts` — `AutoExpenseInput += kind?: "income"|"expense"`
  (income → `delta:+amount`, `kind:"income"`); zwrot `WynikKsiegowania = { zaksiegowano,
  powod?: "brak-konta"|"kwota-zero" }` zamiast `void`; typ wyeksportowany przez kontrakt.
  Gotowe, gdy: tsc czysto, dotychczasowi konsumenci (flota/services/shopping/rosliny) bez zmian
  zachowania, wpis manifestu bez zmian (to lib, nie akcja).
- [x] **T-2** — Migracje `0280_health_event_cost`, `0281_workshop_project_cost`,
  `0282_weather_pref_kalendarz` (DDL wg planu §2) + `schema.prisma` (3 kolumny) +
  `npx prisma migrate deploy` na lokalnej bazie + `prisma generate`.
  Gotowe, gdy: `npm run check:migrations` i `npm run check:schema-drift` zielone.

## Faza 1 — Koszty i kontakty (zlewnie Portfel/Kontakty)
- [x] **T-3** — Z-INT-02 + Z-INT-07(health): pole `cost` w `EventForm`/`createHealthEvent`/
  `updateHealthEvent`; helper `src/lib/kontaktZWpisu.ts` (dedup po nazwie przez
  `getContacts` + kształt kontaktu; test jednostkowy); akcje `bookHealthEventCost(id)`
  i `saveDoctorToContacts(id)`; przyciski w `EventCard` (+ toast `brak-konta`); i18n; wpisy
  `action-coverage.json`. Gotowe, gdy: księgowanie tworzy/koryguje `WalletEntry` na fixturze,
  dedup nie tworzy duplikatu.
- [x] **T-4** `[P]` — Z-INT-03 + Z-INT-07(pets): akcje `bookVetVisitCost`, `bookSaleIncome`
  (kind income), `saveVetToContacts` (reuse `kontaktZWpisu`); UI: akcje w wierszu wizyty
  (`VetSection`/`Row` z `actions`) i sprzedaży (`PetBreeding`); i18n; manifest.
  Gotowe, gdy: przychód ląduje z `kind:"income"` i dodatnią deltą (fixture).
- [ ] **T-5** `[P]` — Z-INT-05: `WorkshopProject.cost` w formularzu/wierszu `ProjectsTab`
  (create/update przyjmują cost); akcja `bookProjectCost(projectId)`; i18n; manifest.
- [ ] **T-6** `[P]` — Z-INT-06: akcja `saveProviderToContacts(providerId)` (reuse
  `kontaktZWpisu`; phone z `ServiceProvider`, notatka z adresem profilu); przyciski:
  `ProviderPublicPage` (headerAction) + karta zlecenia w `MyRequestsPage` (gdy DTO niesie id
  wykonawcy — sprawdzić; brak → tylko profil, odnotować w plan.md); i18n; manifest.
- [ ] **T-7** `[P]` — Z-INT-14: flota — kontrakt += `computeConsumption`; `lib/flota.ts` +=
  `avgFuelPrice(logs)` + test; truck — select pojazdu (`getVehicles`), metryka kosztu
  (dystans × avg/100 × cena; braki danych → komunikat), akcja `zaksiegujKosztTrasy` (sourceId
  = skrót start|cel|dzień); i18n; manifest. Gotowe, gdy: test `avgFuelPrice` zielony,
  księgowanie idempotentne per dzień.

## Faza 2 — Mosty do Zadań
- [ ] **T-8** — Z-INT-01: `calendar/actions/doZadan.ts` (`dodajPozycjeDoZadan`, pre-check
  `hasPermission(tasksModule.permission)`); UI: przycisk przy pozycji listy dnia (wiersz
  `<Link>` → wrapper + przycisk); komunikat sukcesu; i18n; manifest.
  Gotowe, gdy: pozycja dowolnego modułu tworzy zadanie z terminem i linkiem (fixture).
- [ ] **T-9** `[P]` — Z-INT-08: `createTaskFromContact(id)` + ikona w `ContactRow`; i18n; manifest.
- [ ] **T-10** `[P]` — Z-INT-09: `createTaskFromNote(noteId)` + ikona w pasku akcji `NoteRow`;
  i18n; manifest.
- [ ] **T-11** `[P]` — Z-INT-10: `zadanieZWiadomosci(messageId)` (guard uczestnictwa; link
  `/czat?r=<conv>#w-<msg>`) + ikona w pasku akcji dymka `WatekRozmowy`; i18n; manifest.

## Faza 3 — Mosty treści (Notatki/Języki)
- [ ] **T-12** — Z-INT-11: `saveItemAsNote(itemId)` (summary+źródło+URL, markdown) + przycisk
  w stopce `NewsItemCard` (props przez NewsStream/NewsTimeline*); i18n; manifest.
- [ ] **T-13** `[P]` — Z-INT-12: `zapiszFilmJakoNotatke(videoId)` (streszczenie z pamięci treści,
  fallback opis; + kanał + adres) + przycisk w `FilmSzczegol`; i18n; manifest.
- [ ] **T-14** `[P]` — Z-INT-13: sekcja „Fiszki z filmu" w `FilmSzczegol` (tylko gdy
  transkrypcja jest i są talie): select talii (`getDecks`), fetch `/api/llm/languages/extract`
  (sourceText=transkrypcja przycięta, targetLang z talii), lista propozycji z checkboxami,
  „Dodaj (N)" → `bulkAddWords`; `AiCostBadge` (akcja „Fiszki z filmu"); i18n.
  Gotowe, gdy: przepływ działa na lokalnej bazie (extract można zweryfikować kształtem
  odpowiedzi; bez klucza LLM — czytelny błąd trasy pokazany w sekcji).

## Faza 4 — Automaty i odczyty
- [ ] **T-15** — Z-INT-04: `addWorkshopLowStockToShoppingList(listId)` (assertListAccess +
  `addItemStructured`, deficyt do progu) + przycisk sekcyjny z wyborem listy w
  `MaintenanceAgenda`; i18n; manifest. Gotowe, gdy: fixture z brakiem tworzy pozycję listy.
- [ ] **T-16** `[P]` — Z-INT-16: `completeShopping(opts += doSpizarni)` → po archiwizacji
  pozycje DONE do `addPantryItem` (błąd spiżarni nie cofa zakończenia; wynik
  `dodanoDoSpizarni`); checkbox w `CompleteShoppingModal` (localStorage
  `wom_shopping_pantry`, domyślnie odznaczony); pre-check `module.kitchen` dla widoczności
  checkboxa; i18n. Gotowe, gdy: fixture tworzy pozycje spiżarni tylko przy opcji.
- [ ] **T-17** `[P]` — Z-INT-15: weather — `getKalendarzPrognoza()` / `setKalendarzPrognoza(on)`
  (+ kontrakt; eksport meta `wmo` przez kontrakt lub zmapowane pola w zwrotce); checkbox
  w ustawieniach Pogody; calendar — emoji+tMax w komórkach ≤7 dni (render warunkowy);
  i18n; manifest. Gotowe, gdy: wyłączenie chowa pasek bez przeładowania logiki siatki.

## Faza 5 — Pulpit
- [ ] **T-18** — Z-INT-17: pola `habitsTodayDone/habitsTodayTotal`, `workshopDue[]`,
  `workshopLowStock`, `upcomingBirthdays[]`, `weatherToday|null` w `DashboardSnapshot` +
  `EMPTY_SNAPSHOT`; wkłady `habits|warsztaty|contacts|weather/dashboard.ts` (try/catch → zera;
  weather z `Promise.race` 3 s); wpisy `DASHBOARD_CONTRIBUTORS`; propsy `HomePage` + render
  w sekcjach `today`/`modules`; i18n. Gotowe, gdy: `check:module-registry` zielony, snapshot
  na fixturze niesie wartości, pulpit renderuje.

## Faza 6 — Tryb Pro
- [ ] **T-19** — Z-INT-18: kontrakt Magazynu += `getStorageItems`; trasa
  `/rosliny/ewidencja/page.tsx` (pozycje przy `module.magazynowanie`, try/catch); `Ewidencja`:
  select pozycji + ilość zdjęcia; po `recordTreatment` wywołanie `adjustStorageQuantity(−ilosc,
  "wydanie", "ewidencja zabiegu <data>")`; błąd stanu → komunikat, wpis zostaje; i18n.
  Gotowe, gdy: fixture — wpis ewidencji + ruch magazynowy z opisem; bez wyboru zachowanie
  jak dotąd.

## Faza 7 — Bramki i domknięcie
- [ ] **T-20** — Pełny `npm run build` (lokalny Postgres — C-13) + pełna suita `test:unit`
  — zielone; naprawy do skutku.
- [ ] **T-21** — Z-INT-19: migracja-seed raportu „Integracje międzymodułowe — analiza"
  (numer z `next:migration`; treść = analiza.md rozdz. 1–6) + `migrate deploy` lokalnie;
  aktualizacja `CLAUDE.md` (tabela modułów: nowe mosty) i trackera A.16.
- [ ] **T-22** — Mapowanie AC-1…AC-16 → dowody (input do `/verify`); wpis(y) do
  `doświadczenia.md`, jeśli wystąpił nieoczywisty problem (C-51).

## Mapowanie AC → zadania
AC-1→(analiza.md)+T-22 · AC-2→T-3 · AC-3→T-4 · AC-4→T-15 · AC-5→T-5 · AC-6→T-3/T-4/T-6 ·
AC-7→T-8/T-9/T-10/T-11 · AC-8→T-12/T-13 · AC-9→T-14 · AC-10→T-7 · AC-11→T-17 · AC-12→T-16 ·
AC-13→T-18 · AC-14→T-19 · AC-15→T-21 · AC-16→T-20.

## Notatki / blokady
- Ścieżka krytyczna: T-1 → (T-3,T-4,T-5,T-7) · T-2 → (T-3,T-5,T-17) · T-3(helper) → T-4,T-6 ·
  reszta faz niezależna między sobą.
