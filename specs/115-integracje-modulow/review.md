# 115 — review (etap 6)

Recenzja świeżym okiem: subagent **omnia-reviewer** na pełnym diffie feature'a
(`d10799e3…HEAD`, ~80 plików) + własny przelot po miejscach wrażliwych (dane z klienta w mostach
do Zadań, render markdown, guardy cross-module). Ustalenia poniżej od najpoważniejszego; wszystkie
**naprawione w tym przebiegu** (T-23…T-25, faza 8 w `tasks.md`) i ponownie zweryfikowane
(tsc, boundaries, ai-coverage, i18n, lint, `test:unit` 1483/1483, pełny `npm run build`).

## Ustalenia

1. **`truck/actions/truck.ts` · security/correctness · NAPRAWIONE (T-23)** —
   `sourceId = sha1(start|cel|dzień)` bez `user.id`, a idempotencja `bookAutoExpense` szuka po
   samym `(sourceModule, sourceId)`. Scenariusz: użytkownicy A i B księgują tę samą trasę tego
   samego dnia → wpis A zostaje nadpisany saldem konta B — obustronna korupcja portfeli. To
   pierwszy `sourceId` liczony z danych (nie cuid rekordu), więc kolizja stała się osiągalna.
   Fix: `user.id` w hashu **oraz** obrona w głąb — `findFirst` w `bookAutoExpense` zawężony do
   `elementId` konta użytkownika (świadomy koszt odnotowany w komentarzu: po zmianie konta
   auto-księgowania stare źródło dostaje nowy wpis zamiast korekty — duplikat widać, korupcji nie).
2. **`truck/actions/truck.ts` · convention C-20 · NAPRAWIONE (T-23)** — jedyna akcja księgująca
   bez `revalidatePath("/portfel")`; wejście do Portfela po kliknięciu pokazywało stare saldo.
3. **`lib/kontaktZWpisu.ts` · convention/correctness · NAPRAWIONE (T-24)** — trzy akcje „zapisz
   do Kontaktów" nie robiły pre-checku `module.contacts` (wzorzec wszystkich pozostałych mostów):
   konto bez dostępu do `/contacts` tworzyło rekord-widmo. Fix w helperze (jedno miejsce dla
   trzech wołaczy); kontrakt Kontaktów eksportuje `contactsModule`.
4. **delete akcje źródeł księgowań · correctness · NAPRAWIONE (T-25)** — `deleteHealthEvent`,
   `deleteVetVisit`, `deleteSale`, `deleteWorkshopProject` nie odwracały auto-wpisu; po skasowaniu
   źródła w Portfelu zostawał fantomowy wydatek/przychód bez przycisku-korektora. Fix:
   `removeAutoExpense(...)` w każdej z czterech (precedens Floty) + `revalidatePath("/portfel")`.
5. **4 widoki (truck/warsztaty/health/services) · convention · NAPRAWIONE (T-25)** — komunikat
   z gałęzi `catch` (i „brak-konta") renderowany kolorem sukcesu; stan komunikatu niesie teraz
   `{tekst, blad}` i błąd jest czerwony.
6. **`calendar/actions/doZadan.ts:36` · correctness (niski) · ODNOTOWANE, bez zmiany** — fallback
   `T12:00:00` parsowany w strefie serwera; dla stref ≤UTC−9 zadanie może wylądować dzień
   wcześniej. Bufor południa jest świadomy (komentarz w kodzie); poprawka przez `userTime.ts`
   zasadna, gdy aplikacja wyjdzie poza jedną strefę — dziś jeden użytkownik w CET.

Reviewer potwierdził też wprost: dane z klienta w `dodajPozycjeDoZadan` niczego nie autoryzują
(tekst do zadania wołającego, markdown escapuje HTML); `WynikKsiegowania`/`kind: income` poprawne;
`completeShopping doSpizarni` poza transakcją i za pre-checkiem; wkłady pulpitu odporne na wyjątki
i bramkowane uprawnieniem; `getKalendarzPrognoza` nie wywraca agendy; migracja 0283 idempotentna,
bez sekretów; naprawa seedu `LlmAssignment` usuwa realny cichy błąd.

## Weryfikacja po poprawkach

tsc ✅ · check:boundaries ✅ · check:ai-coverage ✅ (676 akcji) · check:i18n ✅ · lint (7 katalogów
dotkniętych poprawkami) ✅ · `test:unit` **1483/1483** ✅ · pełny `npm run build` (lokalny Postgres) ✅.

## Werdykt

**APPROVE Z UWAGAMI** — uwaga nr 6 (strefa czasowa fallbacku południa) świadomie pozostawiona
z komentarzem; wszystkie pozostałe ustalenia naprawione i zweryfikowane. Feature idzie do
`develop` i — zgodnie ze standing authorization (C-52, `--ff-only` + tag) — na `master`.
