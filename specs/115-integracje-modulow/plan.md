# Plan techniczny: Integracje międzymodułowe (Z-INT-01…19)

- **Spec:** ./spec.md (115-integracje-modulow) · **Analiza/zakres:** ./analiza.md rozdz. 6
- **Status:** draft
- **Data:** 2026-08-29

> Plan pisany po rekonesansie kodu (kontrakty-zlewnie, punkty wpięcia UI, pulpit/bramki —
> fakty niżej cytowane z plików). Wzorce do naśladowania: **Flota→Portfel** (auto-księgowanie),
> **Magazyn→Zakupy** (uzupełnienie braków), **Rośliny→Kuchnia** (kontraktowe „wyślij do…"),
> **Pogoda→Zadania** (pre-check uprawnienia przed `createTask`), **languages/dashboard.ts**
> (kształt wkładu pulpitu).

## 1. Podejście

Wszystkie mosty idą przez **kontrakty modułów** i **Server Actions modułu, w którego widoku
stoi przycisk** (akcja-nakładka robi guard własnego zasobu i woła kontrakt cudzy — wzorzec
`rosliny/actions/zbiory.ts`). Zero zapisów do cudzych tabel, zero nowych zależności npm.
Fundament kładziemy raz: `bookAutoExpense` uczy się przychodu i **zwraca wynik** (dziś cicho
nic nie robi bez skonfigurowanego konta — przy jawnych przyciskach to wygląda jak awaria).

## 2. Model danych (Prisma) — C-10/C-11/C-12

Cztery małe migracje (numery z `npm run next:migration` w chwili tworzenia; dziś wolny 0280):

| Nr (plan) | Katalog | DDL |
|---|---|---|
| 0280 | `0280_health_event_cost` | `ALTER TABLE "HealthEvent" ADD COLUMN "cost" DOUBLE PRECISION;` |
| 0281 | `0281_workshop_project_cost` | `ALTER TABLE "WorkshopProject" ADD COLUMN "cost" DOUBLE PRECISION;` |
| 0282 | `0282_weather_pref_kalendarz` | `ALTER TABLE "WeatherPref" ADD COLUMN "kalendarzPrognoza" BOOLEAN NOT NULL DEFAULT true;` |
| 0283 | `0283_raport_integracje` | idempotentny seed raportu (C-14, wzorzec 0279) |

`schema.prisma`: te same trzy kolumny (`cost Float?`, `cost Float?`, `kalendarzPrognoza Boolean
@default(true)`). Żadnych enumów; `kind` wpisów portfela pozostaje `String` ("income"|"expense").
`check:schema-drift` pilnuje zgodności.

**Bez zmian schematu:** wszystkie pozostałe zlecenia (PetVetVisit.cost i PetSale.price już są;
YoutubeVideo.transkrypcja jest; WeatherLocation.isDefault jest).

## 3. Warstwa serwera (Server Actions — C-20) per zlecenie

Fakty z rekonesansu, na których stoi plan: `bookAutoExpense(userId, {module,sourceId,amount,
category,note?,date?,force?})` — tylko wydatek, idempotencja po (sourceModule,sourceId), cichy
no-op bez `autoExpenseElementId`; `addItemStructured(listId,name,qty,unit,category?)`;
`addPantryItem({name,quantity,unit,expiresAt,...})`; `createTask({title,description?,dueDate?,...})`
(wzorzec pre-checku: `hasPermission(session, tasksModule.permission)` jak w Pogodzie);
`createNote({title,content,...})`; `createContact/getContacts` w kontrakcie Kontaktów;
`bulkAddWords(deckId, words[])` + trasa `/api/llm/languages/extract` (op `generation`, zwraca
`words[]+usage`); magazyn: `adjustStorageQuantity(id,delta,reason?,note?)` w kontrakcie,
`getStorageItems` POZA kontraktem (dodamy); flota: `getVehicles()` zwraca pełne `fuelLogs`,
`computeConsumption` w `lib/flota.ts` POZA kontraktem (dodamy re-eksport), średnia cena litra
= `totalCost/totalLiters` (funkcji brak — dodamy czysty helper).

**Fundament (Portfel):** `lib/autoExpense.ts` — `AutoExpenseInput += kind?: "income"|"expense"`
(domyślnie expense; income → `delta:+amount`, `kind:"income"`); zwrot `Promise<WynikKsiegowania>`
= `{ zaksiegowano: boolean; powod?: "brak-konta" | "kwota-zero" }` (dotychczasowi konsumenci
ignorują wynik — zgodne wstecz). Nowe przyciski pokazują toast „Skonfiguruj konto
auto-księgowania w Portfelu" przy `brak-konta`.

Nowe akcje (wszystkie: `requireAuth` + guard własnego zasobu + `revalidatePath`; wpisy
w `action-coverage.json` jako `excluded/interactive`, `access:"owner"`, `guardedVia` gdzie
nakładka):

- **Z-01** `modules/calendar/actions/doZadan.ts` → `dodajPozycjeDoZadan({title,date,at,href,
  moduleLabel})`: pre-check `hasPermission(tasksModule.permission)` → `createTask({title,
  dueDate: at ?? date+12:00, description: "Z kalendarza (<label>): <href>"})`.
- **Z-02** `health/actions/health.ts`: `createHealthEvent/updateHealthEvent` + pole `cost`;
  nowa `bookHealthEventCost(id)` → guard wpisu → `bookAutoExpense(user.id,{module:"health",
  sourceId:id, amount:cost, category:"Zdrowie", note:title, date:scheduledAt, force:true})`.
- **Z-03** `pets/actions/petCare.ts` (lub plik wizyt): `bookVetVisitCost(visitId)` (wydatek,
  kategoria "Zwierzęta"); `pets/actions/petBreeding.ts`: `bookSaleIncome(saleId)`
  (`kind:"income"`, kategoria "Zwierzęta — sprzedaż").
- **Z-04** `warsztaty/actions/warsztat.ts`: `addWorkshopLowStockToShoppingList(listId)` —
  `assertListAccess` + pętla `addItemStructured(listId, name, max(min−qty, 0)||min, unit)`
  po pozycjach `quantity<minQuantity` w moich warsztatach; zwraca liczbę dodanych.
- **Z-05** `warsztaty/actions/warsztat.ts`: projekt przyjmuje `cost`; `bookProjectCost(projectId)`
  (kategoria "Warsztat").
- **Z-06** `services/actions/parts/providers.ts` (barrel `services.ts` re-eksportuje): `saveProviderToContacts(providerId)` — czyta
  `displayName/phone/area/slug`; dedup: `getContacts(displayName)` → dokładna nazwa = komunikat
  `{istnial:true}`; inaczej `createContact({name, phone, company:area, tags:["wykonawca"],
  notes:"Profil: /services/providers/<id>"})`.
- **Z-07** `health/...`: `saveDoctorToContacts(eventId)` (name=doctorName, company=facility,
  tag "lekarz"); `pets/...`: `saveVetToContacts(visitId)` (vetName/clinic, tag "weterynarz");
  wspólna czysta funkcja dedup/kształtu w `src/lib/kontaktZWpisu.ts` (helper współdzielony —
  konsumenci: 3 moduły ⇒ zostaje w `src/lib`, reguła przynależności).
- **Z-08** `contacts/actions/contacts.ts`: `createTaskFromContact(id)` → zadanie
  „Skontaktuj się: <name>" (opis: tel/e-mail + `/contacts`).
- **Z-09** `notes/actions/notes.ts`: `createTaskFromNote(noteId)` → tytuł notatki, opis
  z pierwszym akapitem + `/notes` (kotwica wg konwencji listy).
- **Z-10** `czat/actions/wiadomosci.ts`: `zadanieZWiadomosci(messageId)` — guard uczestnictwa
  rozmowy; tytuł = pierwsze ~80 znaków treści, opis = pełna treść + autor +
  `/czat?r=<convId>#w-<msgId>`.
- **Z-11** `news/actions/news.ts`: `saveItemAsNote(itemId)` — guard własności itemu;
  `createNote({title, content: summary + "\n\nŹródło: <sourceName>\n<url>", isMarkdown:true})`.
- **Z-12** `youtube/actions/filmy.ts`: `zapiszFilmJakoNotatke(videoId)` — treść: zapamiętane
  streszczenie (odczyt istniejącego `AiContent` przez funkcję streszczenia w trybie
  bez generacji; fallback: `description`) + kanał + `adresYoutube`.
- **Z-13** bez nowej akcji zapisu: UI YouTube woła istniejącą trasę
  `/api/llm/languages/extract` (`sourceText`=transkrypcja przycięta, `targetLang` z talii)
  i po przeglądzie `bulkAddWords(deckId, wybrane)` z kontraktu Języków.
- **Z-14** `truck/actions/truck.ts`: `zaksiegujKosztTrasy({opis, kwota, dzien})` — sourceId =
  stabilny skrót `sha1(start|cel|dzien)`, kategoria "Transport". Flota: kontrakt +=
  `computeConsumption` (czysta) i nowy czysty helper `avgFuelPrice(logs)` w `lib/flota.ts`
  (Σcost/Σlitry po logach z totalCost) + test jednostkowy.
- **Z-15** `weather/actions/weather.ts`: `getKalendarzPrognoza()` → `{wlaczona, dni:
  Array<{date,tMax,tMin,emoji,opis}>}` (domyślna lokalizacja → `fetchForecast` → `daily`
  zmapowane przez `wmo()`; brak lokalizacji/awaria → `{wlaczona, dni: []}`);
  `setKalendarzPrognoza(on)` (upsert WeatherPref). Oba w kontrakcie Pogody.
- **Z-16** `shopping/actions/lists.ts`: `completeShopping(id, opts += {doSpizarni?: boolean})` —
  po archiwizacji, dla pozycji `DONE`: `addPantryItem({name, quantity, unit})` przez kontrakt
  Kuchni (pętla poza transakcją listy; błąd spiżarni nie cofa zakończenia — log + wynik
  `{dodanoDoSpizarni}`).
- **Z-17** wkłady: `habits/dashboard.ts` (`habitsTodayDone/habitsTodayTotal` — licz jak
  loader: `dataWStrefie`), `warsztaty/dashboard.ts` (`workshopDue: {id,name,workshopName,
  dueAt,overdue}[]`, `workshopLowStock: number` — zapytania z `getMaintenanceOverview`),
  `contacts/dashboard.ts` (`upcomingBirthdays: {id,name,date}[]` ≤30 dni),
  `weather/dashboard.ts` (`weatherToday: {temp,opis,emoji,label} | null` — domyślna
  lokalizacja, twardy timeout `Promise.race` 3 s → null). + pola w `DashboardSnapshot`,
  `EMPTY_SNAPSHOT`, `DASHBOARD_CONTRIBUTORS`, propsy `HomePage`.
- **Z-18** kontrakt Magazynu += `getStorageItems`; trasa `/rosliny/ewidencja/page.tsx` pobiera
  pozycje (tylko gdy `hasPermission(module.magazynowanie)`, w try/catch → pusta lista);
  `Ewidencja` dostaje prop `pozycjeMagazynu`; po udanym `recordTreatment` z wybraną pozycją
  i ilością UI woła `adjustStorageQuantity(itemId, −ilosc, "wydanie",
  "ewidencja zabiegu <data>")`; błąd stanu → toast, wpis zostaje (AC-14).
- **Z-19** migracja-seed raportu (treść = analiza.md rozdz. 1–6) + aktualizacja
  `CLAUDE.md`/tracker po realizacji.

## 4. RBAC / rejestr (C-22)

Żadnych nowych slugów i wpisów rejestru — wszystkie operacje żyją w istniejących modułach pod
ich uprawnieniami. Pre-check cudzego modułu tam, gdzie zapis przekracza granicę widoczną dla
użytkownika (wzorzec Pogody): kalendarz→zadania, kontakty/notatki/czat→zadania (hasPermission
`module.tasks`), zakupy→spiżarnia (`module.kitchen`), rośliny→magazyn (`module.magazynowanie`
sprawdzane na trasie), youtube→języki (UI pokazuje sekcję tylko przy dostępnych taliach).

## 5. UI (C-30/31/32/33/34/35)

Punkty wpięcia (z rekonesansu, plik → miejsce):

| Zlec. | Plik UI | Wpięcie |
|---|---|---|
| 01 | `calendar/ui/CalendarPage.tsx` (lista dnia ~163-199) | wiersz `<Link>` → wrapper z przyciskiem `CalendarPlus` obok |
| 02 | `health/ui/HealthHomePage.tsx` (`EventForm` 65-169, `EventCard` 193-201) | pole „Koszt" w formularzu; przyciski `Wallet`/`UserPlus` w akcjach karty |
| 03/07 | `pets/ui/PetSections.tsx` (`VetSection` 330-347), `pets/ui/PetBreeding.tsx` (230-247) | akcje w wierszu wizyty (rozszerzenie `Row` o `actions`) i wierszu sprzedaży |
| 04 | `warsztaty/ui/MaintenanceAgenda.tsx` (sekcja braków 45-71) | przycisk sekcyjny + prosty wybór listy (`getLists` przez kontrakt Zakupów, select) |
| 05 | `warsztaty/ui/WorkshopDetail.tsx` (`ProjectsTab` 446-501) | pole kosztu w formularzu/wierszu + przycisk księgowania |
| 06 | `services/ui/ProviderPublicPage.tsx` (headerAction) | „Zapisz w kontaktach" — TYLKO profil publiczny: `RequestDTO` niesie `providerName` bez id wykonawcy, więc karta zlecenia nie ma czego przekazać (odnotowane, C-54) |
| 08 | `contacts/ui/ContactsPage.tsx` (`ContactRow` 261-264) | ikona `ListTodo` |
| 09 | `notes/ui/NoteRow.tsx` (pasek akcji 543-595) | ikona `ListTodo` |
| 10 | `czat/ui/WatekRozmowy.tsx` (pasek akcji dymka 267-299) | ikona `ListTodo` |
| 11 | `news/ui/NewsItemCard.tsx` (stopka 221-251) | „Zapisz jako notatkę" |
| 12/13 | `youtube/ui/FilmSzczegol.tsx` (sekcja akcji 65-75 + nowa sekcja) | „Zapisz jako notatkę"; sekcja „Fiszki z filmu": select talii → propozycje z checkboxami → „Dodaj (N)" + `AiCostBadge` |
| 14 | `truck/ui/TruckPlannerPage.tsx` (blok wyniku 245-295) | select pojazdu (flota contract `getVehicles`) + `Metric` kosztu + „Zaksięguj" |
| 15 | `calendar/ui/CalendarPage.tsx` (komórki siatki) + ustawienia Pogody (obok przełącznika układu obserwatorów) | emoji+`tMax°` w komórkach ≤7 dni; checkbox w Pogodzie |
| 16 | `shopping/ui/ShoppingPage.tsx` (`CompleteShoppingModal` 506-516) | drugi checkbox „Dodaj kupione do spiżarni" (stan startowy z `localStorage` `wom_shopping_pantry`, wzorzec `wom_shopping_sort`) |
| 17 | `home/ui/HomePage.tsx` + komponenty sekcji | wiersze/kafelki w ISTNIEJĄCYCH sekcjach `today` i `modules` (bez nowych kluczy `DashboardPref`) |
| 18 | `rosliny/ui/Ewidencja.tsx` (formularz) | select „Środek z magazynu" + pole „zdejmij ze stanu (ilość)" — sekcja widoczna tylko przy niepustych `pozycjeMagazynu` |

Wszystkie teksty → `messages/pl.json` w namespace'ach `modules.<moduł>.<Komponent>` (bramka
`check:i18n`); kolory tylko tokenami; przyciski 44 px na mobile; potwierdzeń destrukcyjnych
brak (operacje addytywne — bez `confirmDialog`), komunikaty sukcesu wg lokalnego wzorca
komponentu (toast/`setKomunikat`).

## 6. AI / integracje (C-23, C-40)

- **Zero nowych `AIAction`** — asystent już tworzy zadania/notatki/kontakty/wydatki; nowe
  akcje serwerowe klasyfikujemy w `action-coverage.json` jako `excluded/"interactive"`
  (`access:"owner"`, `guardedVia` przy nakładkach). `check:ai-coverage` wymusza komplet.
- **Fiszki z filmu**: istniejąca trasa `languages/extract` (op `generation`, DB-driven C-40,
  `usageField` już zwracany) — UI pokazuje `AiCostBadge` (`akcja:"Fiszki z filmu"`); model
  tylko PROPONUJE, zapis po zatwierdzeniu (`bulkAddWords`). Bez wpisów w manifestach kosztu
  (nowe pliki nie wołają `chatComplete`).
- Kalendarz: wkłady bez zmian; nowa akcja „Do zadań" + opcjonalny pasek prognozy.
- Powiadomienia/trash: bez zmian.

## 7. Pliki do utworzenia / zmiany (skrót — pełne rozbicie w tasks.md)

Nowe: `calendar/actions/doZadan.ts`, `habits|warsztaty|contacts|weather/dashboard.ts`,
`src/lib/kontaktZWpisu.ts` (+test), `prisma/migrations/028{0,1,2,3}_*`, sekcja fiszek w UI
YouTube. Zmiany: `portfel/lib/autoExpense.ts` (+kontrakt typu wyniku), akcje i UI wymienione
w §3/§5, `flota/contract.ts` (+`computeConsumption`), `flota/lib/flota.ts` (+`avgFuelPrice`
+test), `magazynowanie/contract.ts` (+`getStorageItems`), `weather/contract.ts`
(+`getKalendarzPrognoza`/`setKalendarzPrognoza`), `home/contract.ts` + `dashboardContributors`
+ `HomePage`, `messages/pl.json`, `src/lib/ai/action-coverage.json`, `schema.prisma`,
`CLAUDE.md` + tracker (na końcu).

## 8. Bramki i weryfikacja (C-50)

Lokalnie: Postgres 127.0.0.1 (`omnia_dev`, już stoi), `npx prisma migrate deploy` po każdej
migracji; po każdej PARTII zadań: `tsc -p tsconfig.test.json`, `next lint`, celowane testy;
na końcu pełny `npm run build` (wszystkie bramki, C-13 — lokalna baza) + pełna suita.

Mapowanie AC → weryfikacja: AC-1 przegląd `analiza.md` (verify liczy statusy); AC-2/3/5 —
test ręczny przez akcję + asercja wpisu `WalletEntry` (DB) / przegląd kodu idempotencji;
AC-4 — wywołanie akcji na fixturze (DB-test lub ręcznie) + pozycje na liście; AC-6/7/8 —
przegląd kodu + wywołania akcji na lokalnej bazie; AC-9 — przegląd UI + trasa extract (mock
niepotrzebny: weryfikacja kształtu odpowiedzi istniejącej trasy); AC-10 — test jednostkowy
`avgFuelPrice` + przeliczenie ręczne; AC-11 — przełącznik + render warunkowy (przegląd);
AC-12 — wywołanie `completeShopping` z `doSpizarni` na fixturze; AC-13 — snapshot lokalnie
(wkłady zwracają wartości) + render sekcji; AC-14 — wywołanie `adjustStorageQuantity` po
`recordTreatment` na fixturze; AC-15 — migracja seed na lokalnej bazie (wiersz `Report`);
AC-16 — pełny `npm run build`.

## 9. Ryzyka techniczne i wycofanie

- **Zewnętrzne API na pulpicie/kalendarzu** (Open-Meteo bez cache'u) → twardy `Promise.race`
  3 s + `null`/pusta lista; pulpit i tak jest w cache'u agregatu (TTL), kalendarz pobiera raz
  na wejście. Rollback: wyłączenie sekcji = usunięcie wkładu (kod), przełącznik Z-15 w danych.
- **Cichy no-op księgowania** → rozwiązany fundamentem (wynik `zaksiegowano/powod`); ryzyko
  regresji u 4 istniejących konsumentów mitigowane tym, że wynik był `void` (nikt nie czyta).
- **`getVehicles` z pełnymi logami w UI Trucka** → dane już tak płyną do Floty (ten sam koszt);
  liczenie po stronie klienta czystą funkcją.
- **Rozjazd artefaktów przy 19 zleceniach** → realizacja partiami (tasks.md), po partii bramki;
  odkrycia niezgodne ze specem → aktualizacja spec/analiza przed kodem (C-54).
- Rollback: zmiany kodu = revert commita partii; migracje addytywne (nullable/default) —
  bez procedury cofania (runbook: kolumny zostają, kod ich nie czyta).

## 10. Zgodność z konstytucją — checklista

- [x] C-10..C-14: 4 migracje ręczne, sekwencyjne, idempotentny seed, bez enumów, lokalna baza.
- [x] C-20..C-25: Server Actions + revalidate, guardy własne + kontrakty, zero nowych slugów,
  manifest AI, bez zmian trash/audit.
- [x] C-30..C-35: tokeny motywu, mobile, `t()`/pl.json, ModuleView nietknięty (wpięcia w
  istniejące widoki), komponenty wspólne tylko z konsumentem (`kontaktZWpisu` — 3 konsumentów).
- [x] C-36: wyłącznie kontrakty; platforma nie poznaje modułów; wkłady pulpitu przez korzeń.
- [x] C-40/C-41: fiszki przez istniejącą trasę z DB-routingiem; zero kluczy w kodzie.
- [x] C-53: minimalizm — fundament portfela to jedyne „poszerzenie wspólnego", reszta to
  przyciski + cztery kolumny nullable.

### Decyzje domyślne odnotowane (C-55 — bez pytań)

1. Zapamiętanie checkboxa spiżarni: `localStorage` (wzorzec `wom_shopping_sort`) — wygoda
   per przeglądarka; sama operacja i tak jest jawna przy każdym zakończeniu zakupów.
2. Wkłady pulpitu wchodzą do ISTNIEJĄCYCH sekcji (`today`, `modules`) — bez nowych kluczy
   personalizacji (7 kluczy sekcji zostaje; AC-13 spełnione przez personalizację tych sekcji).
3. Prognoza w kalendarzu domyślnie WŁĄCZONA (czysty odczyt, zero kosztu AI), wyłączalna
   w ustawieniach Pogody (`WeatherPref.kalendarzPrognoza`).
4. Idempotencja kosztu trasy Trucka: skrót (start, cel, dzień) jako `sourceId`.
