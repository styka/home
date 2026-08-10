# Zadania: Granice modułów — Faza 1, fala 3 (domknięcie zadania 5)

- **Plan:** ./plan.md (048-granice-modulow-fala-3)
- **Status:** w trakcie
- **Data:** 2026-08-05

> **Zasada listy zadań:** kolejność **od najłatwiejszego do najtrudniejszego** i **zgodna
> z zależnościami**. `[P]` = można zrównoleglić.
>
> **Zasada nadrzędna (z 046/047):** commit przenoszący zawiera **wyłącznie** przenosiny i przepisane
> importy. Zmiany zachowania — **osobnym** commitem.
>
> **Rytuał po każdym module** (T-2…T-11), bez wyjątku: `tsc --noEmit` · `check:ai-coverage` (**bez
> spadku**, dziś 551) · **`next lint --dir src`** · `check:module-registry` · `check:ui-contract` ·
> commit. Lint jest w rytuale od 047: `check:boundaries` sprawdza swoje sondy, **nie kod repozytorium**
> — realne naruszenie granicy pokazuje dopiero lint.
>
> **Nigdy `next build` równolegle z klikaczami** — walczą o `.next` (lekcja z 047).

## Legenda
- `[ ]` do zrobienia · `[x]` zrobione · `[~]` w trakcie · `[!]` zablokowane
- `[P]` — niezależne, można zrównoleglić

---

## Faza 0 — Punkt wyjścia

- [x] **T-1** — Potwierdzić stan startowy: `check:schema-drift` zielony, `check:ai-coverage` = 551,
      `check:module-registry` = 11 modułów, lista przejściowa = 10.
      **Gotowe, gdy:** liczby zapisane jako punkt odniesienia dla całej fali.

## Faza A — Rozdzielenie asystenta od pulpitu (przygotowanie pod AC-6)

- [x] **T-2** — **Klaster asystenta → `src/components/assistant/`.** `AICommandSheet`, `ActionDrawer`,
      `AssistantLevelSettings` (i to, czego używają wyłącznie one) wychodzą z `components/home/`.
      Asystent jest **globalnym elementem powłoki** montowanym na każdej stronie — to nie jest pulpit.
      Bez tego kroku moduł Strona główna nie da się zamknąć bez importu z powłoki (AC-6).
      Czysta przenosina, zero zmian treści.
      **Gotowe, gdy:** `AppShell` importuje z `@/components/assistant`, rytuał przechodzi.
- [x] **T-3** `[P]` — **`ActivityFeed` → `src/components/settings/`.** Jedyny konsument to
      `app/settings/page.tsx`; do pulpitu nie należy.
      **Gotowe, gdy:** `components/home/` nie ma już konsumentów spoza pulpitu poza `HomePage`.

## Faza B — Przenoszenie modułów (osobny commit na moduł)

> Kolejność od najmniejszego promienia rażenia. Kalendarz i pulpit **na końcu** — zastaną gotowe
> kontrakty zamiast tymczasowych.

- [x] **T-4** — **Wiadomości** → `src/modules/news/`. Konsumenci: `newsExecutor`, `agentTools`.
      **(AC-1, AC-2, AC-3)**
- [x] **T-5** — **Pogoda** → `src/modules/weather/`. Konsumenci: `weatherExecutor`, `agentTools`.
      Sama woła Zadania (`createTask`) — do czasu T-11 przez `@/actions/tasks`, potem przez kontrakt.
      **(AC-1, AC-2, AC-3)**
- [x] **T-6** — **Usługi** → `src/modules/services/`. Akcje `services.ts` + katalog `actions/services/`;
      własne `lib/{services,serviceSlots,serviceGeo}.ts`. Sama woła Portfel (`addEntry`).
      **(AC-1, AC-2, AC-3, AC-4)**
- [x] **T-7** — **Kuchnia** → `src/modules/kitchen/`. Cztery pliki akcji, 28 komponentów, zero
      konsumentów zewnętrznych. Woła Zakupy (`assertListAccess`) i tagi (zostają w `src/actions`).
      **(AC-1, AC-3, AC-4)**
- [x] **T-8** — **Zwierzęta** → `src/modules/pets/`. Cztery pliki akcji. Konsumenci: `petExecutor`,
      `agentTools`, powłoka (nawigacja — rozwiązana w T-13). **(AC-1, AC-2, AC-3)**
- [x] **T-9** — **Portfel** → `src/modules/portfel/`. Pięć plików akcji. Konsumenci: `portfelExecutor`,
      `agentTools`, pulpit **oraz Usługi** — `addEntry` przechodzi na kontrakt Portfela.
      **(AC-1, AC-2, AC-3, AC-4)**
- [x] **T-10** — **Zakupy** → `src/modules/shopping/`. Akcje list/pozycji/sklepów **oraz słowniki
      zakupowe** (`categories`, `units`, `products`, `categoryIcons`) — rekonesans potwierdził, że mają
      wyłącznie konsumentów zakupowych (plan §1.2). Konsumenci: paleta poleceń, Kuchnia,
      Magazynowanie (`assertListAccess` przez kontrakt). **`actions/tags.ts` ZOSTAJE.**
      **(AC-1, AC-2, AC-3, AC-4, AC-7)**
- [x] **T-11** — **Zadania** → `src/modules/tasks/`. Cztery pliki akcji. Konsumenci: `tasksExecutor`,
      **Pogoda** i **Nawyki** (`createTask` przez kontrakt). **(AC-1, AC-2, AC-3, AC-4)**
- [x] **T-12** — **Kalendarz** → `src/modules/calendar/`. `actions/calendar.ts` + `lib/calendar/`.
      Kontrakt musi wystawić także `isoDay`, `MODULE_META` i typy — używa ich `NotificationBell`
      (powłoka) i `actions/notifications`, oba **spoza** `src/platform`, więc import kontraktu jest
      legalny. **Agregat ma zwracać identyczny wynik** — to najostrzejszy test tej fali.
      **Gotowe, gdy:** rytuał + porównanie wyniku agregatu przed/po na tej samej bazie.
      **(AC-1, AC-2, AC-3)**
- [x] **T-13** — **Strona główna** → `src/modules/home/`. Same widoki pulpitu (po T-2 i T-3 nie ma
      w nich już asystenta ani feedu aktywności). **(AC-1, AC-3)**
- [x] **T-14** — Jeśli którykolwiek moduł nie dał się przenieść bez zmiany zachowania — zostawić go
      na liście i **zapisać powód**. **Gotowe, gdy:** jawna lista albo „wszystkie dziesięć przeszło".
      **(AC-1)**

## Faza C — Powłoka bez wiedzy o wnętrzach (zmiana zachowania — osobny commit)

- [x] **T-15** — **Pole `sideNav` w deklaracji** (`ModuleDeclaration`), ładowane **leniwie**
      (`() => Promise<{default: ComponentType}>` + `next/dynamic`). Leniwość nie jest kosmetyką:
      `module.ts` jest importowany przez kod serwerowy, więc statyczny import komponentu klienckiego
      wciągnąłby go do każdego takiego grafu.
      **Gotowe, gdy:** typ i mechanizm gotowe, `tsc` czysty.
- [x] **T-16** — **`ModuleSidebar` czyta nawigację z rejestru** zamiast `switch` po `id` z sześcioma
      importami wnętrz. Zachowujemy SSR — nawigacja ma być widoczna od pierwszej klatki.
      **Gotowe, gdy:** `grep` po `src/components/shell/` nie zwraca **żadnego** `@/modules/*/ui`,
      a klikacz po zmianie jest zielony. **(AC-5, AC-6)**

## Faza D — Dług testowy (osobny commit)

- [ ] **T-17** — **Diagnoza ośmiu zastanych porażek klikaczy.** Dla każdej: odtworzyć, ustalić
      przyczynę, rozstrzygnąć **błąd testu** (naprawiamy) czy **brak funkcji w aplikacji** (backlog —
      opisujemy, nie dorabiamy funkcji w fali refaktorującej).
      **Gotowe, gdy:** każda z ośmiu ma zapisaną przyczynę i decyzję. **(AC-8)**

## Faza E — Domknięcie fazy (tylko przy pustej liście przejściowej)

- [x] **T-18** — **Czwarta kontrola w `check-module-registry.js`:** identyfikator obecny w rejestrze
      nie może mieć kodu poza `src/modules/` (`src/actions/<x>.ts`, `src/components/<x>/`).
      **Warunek:** włączamy **tylko** gdy lista przejściowa jest pusta — przy niepustej bramka
      blokowałaby pracę, a pierwszym odruchem byłoby jej wyłączenie.
      **Gotowe, gdy:** test negatywny (podłożony `src/actions/<moduł>.ts`) czerwieni bramkę. **(AC-11)**
- [x] **T-19** — **Usunięcie martwego kodu przejściowego:** `LEGACY`, `legacyPermissionForPath`,
      uproszczenie `pathPermissions.ts` do deklaracji + powierzchni spoza rejestru.
      **Gotowe, gdy:** `tsc` czysty, testy rejestru zielone.

## Faza F — Bramki i dokumentacja

- [ ] **T-20** — Komplet bramek: `check:actions` (**=160**), `check:ai-coverage` (**≥551**),
      `check:cost-badge`, `check:content-memory`, `check:migrations`, `check:ui-contract`,
      `check:schema-drift`, `check:boundaries`, `check:module-registry`, `check:test-types`,
      `next lint`, `next build`, `test:unit`. **(AC-10)**
- [ ] **T-21** — Klikacz ścieżki szczęśliwej **22/22** + pełny zestaw; porównanie liczby czerwonych
      z 16 sprzed fali. **(AC-9, AC-12)**
- [ ] **T-22** — Rozdz. 15 dziennika: wpis 048, statusy zadań 4–8, **czy Faza 1 jest domknięta**,
      co zostaje na Fazę 2, pierwszy krok Fazy 2. **(AC-13)**
- [ ] **T-23** `[P]` — `CLAUDE.md` + konstytucja: stan `platform/`+`modules/`, `sideNav` w C-36.
- [ ] **T-24** — Wpisy do `doświadczenia.md` (C-51).

---

## Mapowanie kryteriów akceptacji → zadania

| AC | Zadania |
|----|---------|
| AC-1 — kod modułu w katalogu modułu albo jawnie na liście | T-4…T-14 |
| AC-2 — konsumenci danych przez kontrakt | T-4…T-13 |
| AC-3 — wpis usunięty z listy i z uprawnień | T-4…T-13 |
| AC-4 — sprzężenia międzymodułowe przez kontrakt, koszt widoczny | T-6, T-7, T-9, T-10, T-11 |
| AC-5 — nawigacja boczna z deklaracji | T-15, T-16 |
| AC-6 — powłoka bez importu wnętrza modułu | T-2, T-3, T-16 |
| AC-7 — słowniki rozstrzygnięte po konsumentach | T-10 |
| AC-8 — osiem porażek klikaczy ma diagnozę | T-17 |
| AC-9 — klikacz 21/21 modułów | T-21 |
| AC-10 — komplet bramek, liczby bez spadku | T-1, T-20 |
| AC-11 — bramka wykrywa moduł „po staremu" | T-18 |
| AC-12 — przenosiny oddzielone od zmian zachowania | T-4…T-13 (dyscyplina), T-21 |
| AC-13 — dziennik mówi, czy Faza 1 domknięta | T-22 |

**Żaden AC nie został bez pokrycia.**

---

## Ścieżka krytyczna

```
T-1
 ↓
T-2, T-3   (rozdzielenie asystenta — WARUNEK dla T-13 i AC-6)
 ↓
T-4 → T-5 → T-6 → T-7 → T-8 → T-9 → T-10 → T-11 → T-12 → T-13   (moduły, commit każdy)
 ↓
T-14  (jawne pominięcia, jeśli będą)
 ↓
T-15 → T-16   (nawigacja z deklaracji — po przeniesieniu WSZYSTKICH modułów z nawigacją)
 ↓
T-17  (dług testowy — niezależny [P] od T-15/T-16)
 ↓
T-18 → T-19   (domknięcie fazy — TYLKO przy pustej liście)
 ↓
T-20 → T-21 → T-22 → T-23 → T-24
```

- **T-2 blokuje T-13.** Dopóki asystent siedzi w `components/home`, moduł Strona główna nie da się
  zamknąć bez importu z powłoki.
- **T-16 po T-13, nie wcześniej.** Nawigacja z deklaracji ma sens, gdy wszystkie sześć modułów
  z boczną nawigacją jest już za granicą — inaczej trzeba by utrzymywać dwie drogi naraz.
- **T-18 jest warunkowe.** Przy niepustej liście przejściowej **nie włączamy** zaostrzonej bramki
  i mówimy to wprost — zaostrzenie, które blokuje pracę, zostaje wyłączone przy pierwszej okazji.
- **T-12 (Kalendarz) to najostrzejszy test fali** — agregat czyta dane sześciu modułów; jego wynik
  musi być identyczny przed i po.

## Notatki / blokady

- **Poza zakresem** (spec §5): zdolności platformy `ai`/`llm`/`jobs`, zadanie 8 (asystent z deklaracji),
  pola `dashboard`/`calendar`/`resources` w deklaracji, cała Faza 2.
- **Bez migracji** — potwierdza `check:schema-drift` (T-1, T-20).
- **Przy utracie kontroli nad wielkością fali:** zatrzymujemy się z częścią modułów przeniesionych
  i raportujemy jawnie — spec to dopuszcza (§9). Lepiej sześć modułów sprawdzonych niż dziesięć
  wepchniętych.
