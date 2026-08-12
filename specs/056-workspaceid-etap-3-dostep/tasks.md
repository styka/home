# Zadania: rozstrzyganie dostępu czyta przestrzeń — etap 3A

Spec: `spec.md` · Plan: `plan.md` · Gałąź: `claude/omnia-architecture-skins-qlv2ew`

Ścieżka krytyczna liniowa: **T-1 → T-2 → T-3 → T-4 → T-5 → T-6**. T-4 (tabela prawdy) jest tu
bramką merytoryczną — dopóki nie zgadza się z punktem odniesienia, reszta nie ma znaczenia.

## Faza 1 — słownik pojęć

- [x] **T-1** — `ResourceFacts.workspaceId` + `AccessContext` z rolami przestrzeni.
      Pole **opcjonalne** (18 przyszłych deklaracji nie musi go podawać, a `tasks.task` nie ma go
      z czego wziąć). Kontekst dostaje `personalWorkspaceId` i `workspaceRoles`.
      *Gotowe, gdy:* `tsc --noEmit` czysty, nic jeszcze nie czyta nowych pól.

- [x] **T-2** — Kontekst czyta role przestrzeni **tym samym zapytaniem**.
      `cache.ts`: `workspaceMember.findMany` rozszerzone o `role` i złączenie po
      `workspace.personalUserId`. Przestrzeń osobista rozpoznawana po `personalUserId === userId`,
      nie po `kind`.
      *Gotowe, gdy:* liczba zapytań w `getAccessContext` **bez zmian** (trzy równoległe, jak dziś).

## Faza 2 — przełączenie

- [x] **T-3** — `rolaZWlasnosci` rozstrzyga po przestrzeni; `tasks.project` podaje kolumnę.
      Sześć przypadków z tabeli w planie §4.3, w tym jawne **nic** dla `guest` i gałąź „bez
      przestrzeni" (para kolumn jak dotąd). `tasks.task` bez zmian.
      *Gotowe, gdy:* zmiana mieści się w jednej funkcji platformy + jednym `select` modułu.

## Faza 3 — dowód

- [x] **T-4** — Tabela prawdy: 24 komórki bez ruchu, jedna zmieniona, nowy wiersz i kolumna.
      *(Skorygowane w trakcie, C-54: pierwotne brzmienie zakładało, że przypadek „właściciel zespołu
      bez wiersza `TeamMember`" trzeba **dopisać** jako nowy wiersz. Nieprawda — macierz już go
      zawierała, bo `wlasciciel` jest w fixture właścicielem zespołu i nie ma wiersza członkostwa.
      Świadoma zmiana ze speca §5 objawiła się więc jako **jedna zmieniona wartość** wśród
      dotychczasowych 25, a nie jako nowy wiersz. To lepszy dowód: zmiana wyszła tam, gdzie tabela
      już patrzyła.)*
      Dochodzą: kolumna **„projekt bez przestrzeni (sierota)"** i wiersz **„wlasciciel bez
      przestrzeni"** (AC-4). Punkt odniesienia zostaje w katalogu 052.
      *Gotowe, gdy:* test zielony, a `diff` punktu odniesienia pokazuje **dokładnie jedną** zmienioną
      wartość — tę ze speca §5 — i nic poza tym prócz dopisanych pozycji.

- [x] **T-5** — Licznik zapytań bez wzrostu.
      `queryCount.integration.test.ts` — liczby bez zmian.
      *Gotowe, gdy:* test zielony bez korekty oczekiwań.

## Faza 4 — domknięcie

- [ ] **T-6** — Bramki, build, dziennik, lekcja.
      Komplet bramek, `test:unit`, `npx tsc --noEmit`, `next lint`, `npm run build` (lokalny
      Postgres). Dziennik: wpis 056 + co zostaje na 3B i etap 4. `doświadczenia.md` — jeśli będzie
      czego (C-51).
      *Gotowe, gdy:* build **exit 0**, liczniki **160 / 551 / 35 / 35** bez spadku.

## Pokrycie kryteriów akceptacji

| AC | Zadanie | Sposób sprawdzenia |
|----|---------|--------------------|
| AC-1 przestrzeń osobista = jak dotąd, bez dodatkowego zapytania | T-2, T-3, T-4 | wiersz „właściciel projektu" + licznik zapytań |
| AC-2 zespół tylko przy zadeklarowanym `teamOwnership` | T-3, T-4 | wiersze zespołowe; brak deklaracji → odmowa |
| AC-3 25 komórek identycznych | T-4 | porównanie z `baseline-dostep.json` |
| AC-4 zasób bez przestrzeni | T-3, T-4 | wiersz „sierota" |
| AC-5 liczba zapytań nie rośnie | T-2, T-5 | `queryCount.integration.test.ts` |
| AC-6 bramki, build, zero zmian dla użytkownika | T-6 | tabela bramek + `git diff` |
| AC-7 dziennik | T-6 | wpis w rozdz. 15 |
