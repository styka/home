# Recenzja: 121-ux-skorki-zadania-filtr

- **Data:** 2026-09-02 · **Recenzent:** omnia-reviewer (świeże oko) + dyrygent pipeline'u
- **Diff:** `origin/develop...HEAD` (3 commity; SkinPicker, TaskDetail, ProjectScopeFilter,
  TasksPage, TasksSideNav, TasksRouteView, pl.json, artefakty specs/)

Zakres skórek (`SkinPicker` → `Modal`) i panel zadania (`TaskDetail`) — czyste. Ustalenia dotyczą
trzeciego zgłoszenia (jeden mechanizm zakresu projektów).

## Ustalenia (od najpoważniejszego)

1. **correctness (regresja)** — `TasksSideNav.tsx:40-45` × `ProjectScopeFilter.tsx` (akcje trybu
   zestawu). Nawigacja boczna trzyma grupy w stanie klienckim ładowanym tylko przy montażu i po
   własnych mutacjach projektów; `revalidatePath("/tasks")` odświeża drzewo RSC, nie stan kliencki.
   Przed 121 każda mutacja grupy działa się w sidebarze i kończyła `reload()`; 121 przeniosło je do
   dropdownu **bez sygnału dla sidebara**. Scenariusz: rename w dropdownie → nagłówek widoku ma nową
   nazwę, sidebar starą; usunięcie zestawu → link zostaje w sidebarze i prowadzi do 404 (`notFound`).
   Podważa AC-7. **Poprawka:** lekki sygnał okna (`tasks:groups-changed`) emitowany po mutacji
   zestawu + nasłuch w `TasksSideNav` wołający `reload()`. → **T-10**
2. **correctness (drobne)** — `ProjectScopeFilter.tsx` `zapiszZmiany`. Po udanym zapisie `roboczy`
   nie jest synchronizowany z wartościami znormalizowanymi przez serwer (`trim`, pusty emoji →
   „🗂"), a reset w renderze kluczuje tylko po `id` — przycisk „Zapisz zmiany" potrafi zostać
   aktywny na stałe. **Poprawka:** po sukcesie ustawić `roboczy` z rekordu zwróconego przez
   `updateProjectGroup`. → **T-11**
3. **convention/UX (drobne)** — trzy akcje trybu zestawu mają puste `catch {}` — brak jakiejkolwiek
   informacji o niepowodzeniu (stary edytor pokazywał `groupError`). Realny przypadek: wszystkie
   projekty zestawu odebrane → serwer rzuca → cisza. **Poprawka:** lokalny stan błędu w panelu,
   wzorzec ze skasowanego `groupError`. → **T-12**
4. **convention (niskie, informacyjne)** — kropki koloru 16 px i kosz ~29 px nie trzymają 44 px
   (C-31), ale to kontrolki przeniesione 1:1 (dług zastany, nie nowy); kotwica w trybie zestawu ma
   `aria-label` „Filtr projektów", choć jest też edytorem zestawu. Odnotowane; poprawiamy tylko
   aria-label przy okazji T-10..T-12 (bez ruszania rozmiarów zastanych — C-53).

Nie potwierdzono problemów w: resecie-w-renderze (poprawnie kluczowany po `zestaw.id`), guardach
akcji, `revalidatePath`, namespace'ach i18n, regule 080 (zakres nie degraduje do zera), AC-4/AC-5.

## Werdykt: **ZMIANY WYMAGANE** (runda 1)

Wymagane T-10 (regresja sidebara); T-11/T-12 domykane przy tej samej okazji (ten sam plik).
Po poprawkach: bramki → ponowna weryfikacja → runda 2 recenzji.

## Runda 2 (po poprawkach T-10..T-12)

Diff rundy 2 (jeden commit): emisja `tasks:groups-changed` po wszystkich czterech mutacjach
zestawów + nasłuch w `TasksSideNav` (stabilny `reload` z `useCallback`, cleanup w efekcie),
synchronizacja `roboczy` z rekordem zwróconym przez `updateProjectGroup`, lokalny stan błędu
z `role="alert"` i czyszczeniem przy edycji, `aria-label` kotwicy w trybie zestawu.
Ustalenia 1-3 naprawione zgodnie z sugestiami; ustalenie 4 (rozmiary kropek koloru — dług
zastany) świadomie bez zmian (C-53). Bramki rundy 2 zielone (build EXIT=0, lint 0, i18n 0,
e2e zestawów 6/6). Nowych ustaleń brak.

## Werdykt końcowy: **APPROVE Z UWAGAMI**

Uwagi (nieblokujące): zastany dług e2e po 111-120 (osobna robota, odnotowana przy 116);
zastane rozmiary kontrolek koloru w panelu zestawu.
