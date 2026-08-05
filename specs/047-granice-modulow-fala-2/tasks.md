# Zadania: Granice modułów — Faza 1, fala 2

- **Plan:** ./plan.md (047-granice-modulow-fala-2)
- **Status:** w trakcie
- **Data:** 2026-08-05

> **Zasada listy zadań:** kolejność **od najłatwiejszego do najtrudniejszego** i **zgodna
> z zależnościami**. Każde zadanie jest małe, samodzielne i **weryfikowalne**. `[P]` = można
> zrównoleglić.
>
> **Zasada nadrzędna tej fali (z 046):** commit przenoszący zawiera **wyłącznie** przenosiny
> i przepisane importy. Poprawki i zmiany zachowania — **osobnym** commitem, przed albo po.
>
> **Rytuał po każdym module** (T-2…T-8), bez wyjątku: `tsc --noEmit` czysty · `check:ai-coverage`
> nadal **550** akcji · `check:module-registry` zielony · `check:ui-contract` zielony · commit.
> Liczba 550 to nie ozdoba — jej spadek oznacza, że bramka przestała widzieć przeniesiony plik
> i kontrola dostępu po cichu zrobiła się dziurawa (dokładnie to wykrył przebieg 046).

## Legenda
- `[ ]` do zrobienia · `[x]` zrobione · `[~]` w trakcie · `[!]` zablokowane
- `[P]` — niezależne, można zrównoleglić

---

## Faza 0 — Bez zmian w danych

- [x] **T-1** — Potwierdzić, że fala **nie rusza schematu**: `npm run check:schema-drift` zielony
      na starcie i na końcu. Żadnej migracji nie tworzymy (plan §2).
      **Gotowe, gdy:** bramka zielona, `prisma/migrations/` bez nowego katalogu.

## Faza A — Przenoszenie modułów (osobny commit na moduł)

> Kolejność od najmniejszego promienia rażenia do największego. Każde zadanie obejmuje pełny
> komplet: `git mv` akcji/UI/lib + `contract.ts` + `module.ts` + wpięcie w `DECLARED`, usunięcie
> z `LEGACY` i z `PERMISSIONS`, strażnik trasy z deklaracji, konsumenci przez kontrakt, manifest
> kontraktu widoku.

- [x] **T-2** — **Nawyki** → `src/modules/habits/`. Akcje: `habits.ts`. UI: `components/habits/`
      (3 pliki). **`lib/habitStats.ts` ZOSTAJE** w `src/lib` — używają go `medications`,
      `notifications`, `kitchenExecutor` i `medicationSchedule` (plan §3.1).
      Konsument zewnętrzny: `habitsExecutor` → kontrakt.
      **Gotowe, gdy:** rytuał przechodzi, `/habits` otwiera się w klikaczu. **(AC-1, AC-2, AC-3)**
- [x] **T-3** — **Nauka języków** → `src/modules/languages/`. Akcje: `languageDecks.ts`.
      UI: `components/languages/` (5). Lib: `lib/srs.ts` → `modules/languages/lib/`.
      Konsumenci: `languageExecutor`, `agentTools` (`getDueCards`, `getStudyStreak`),
      **pulpit** `app/page.tsx` (`getDecks`) → wszyscy przez kontrakt.
      **Gotowe, gdy:** rytuał przechodzi; pulpit renderuje kafelek języków. **(AC-1, AC-2, AC-3)**
- [x] **T-4** — **Warsztaty** → `src/modules/warsztaty/`. Akcje: `warsztat.ts` (23 eksporty).
      UI: `components/warsztaty/` (5). Lib: `lib/warsztat/catalog.ts` + jego test →
      `modules/warsztaty/{lib,__tests__}/`.
      Konsumenci: `warsztatExecutor`, `agentTools` (`getMaintenanceOverview`).
      **Gotowe, gdy:** rytuał + `check:test-types` zielone (test katalogu jedzie za kodem).
      **(AC-1, AC-2, AC-3)**
- [x] **T-5** — **Magazynowanie** → `src/modules/magazynowanie/`. Akcje: `storage.ts` (**47**
      eksportów). UI: `components/magazynowanie/` (15).
      Konsumenci: `storageExecutor`, `agentTools` (4 funkcje), **pulpit** (2 funkcje).
      **Kontrakt wystawia kilkanaście funkcji, nie 47** — piszemy go z listy realnych wywołań
      konsumenta, nie z listy eksportów (plan §4).
      **Gotowe, gdy:** rytuał przechodzi; kontrakt ≤ 20 pozycji. **(AC-1, AC-2, AC-3)**
- [x] **T-6** — **Notatki** → `src/modules/notes/`. Akcje: `notes.ts` + `noteGroups.ts`.
      UI: `components/notes/` (11). Lib: `lib/wikilinks.ts`, `lib/notes/searchRank.ts` + ich testy.
      **`actions/tags.ts` ZOSTAJE** w `src/actions` — słownik dzielony z Kuchnią (plan §3.2).
      Konsumenci: `notesExecutor`, `agentTools` (`getNoteGroups`).
      **Gotowe, gdy:** rytuał przechodzi, a Kuchnia nadal importuje tagi z `@/actions/tags`.
      **(AC-1, AC-2, AC-3)**
- [x] **T-7** — **Flota** → `src/modules/flota/`. Akcje: `flota.ts`. UI: `components/flota/` (3).
      Lib: `lib/flota.ts` + testy `flota.test.ts`, `flotaTco.test.ts`.
      Konsumenci: `flotaExecutor`, **pulpit** (`getVehicles`).
      **Gotowe, gdy:** rytuał + `test:unit` bez ubytku testów. **(AC-1, AC-2, AC-3)**
- [ ] **T-8** — **Zdrowie** → `src/modules/health/`. Akcje: `health.ts` + `medications.ts`.
      UI: `components/health/` (4). **`lib/medicationSchedule.ts` i `lib/health/queryDiag.ts`
      ZOSTAJĄ** — pierwszego używa kalendarz i `agentTools`, drugiego `systemHealth` (plan §3.1).
      Konsumenci: `healthExecutor`, `agentTools` (`getTestTrends`), **pulpit** (`getHealthEvents`).
      **Gotowe, gdy:** rytuał przechodzi; agregat kalendarza zwraca to samo. **(AC-1, AC-2, AC-3)**
- [ ] **T-8a** — **Nazwać wyłączenie: nawigacja boczna powłoki.** (Dopisane w trakcie `/implement`
      wg C-54.) `ModuleSidebar` importuje komponenty `*SideNav` wprost z `ui/` czterech modułów tej
      fali. Kontrakt opisuje **dane, nie ekrany**, a właściwym rozwiązaniem jest pole `sideNav`
      w deklaracji, ładowane leniwie (rozdz. 9.3) — czyli zmiana zachowania, która nie może wejść
      do commita przenoszącego. Odnotować w dzienniku jako następny krok.
      **Gotowe, gdy:** wyłączenie opisane w `spec.md`, `plan.md` i rozdz. 15 dziennika. **(AC-2)**
- [ ] **T-9** — Jeśli którykolwiek moduł okazał się zbyt sprzężony, żeby przenieść go **bez zmiany
      zachowania** — zostawić go na liście przejściowej i zapisać powód (do dziennika w T-14).
      **Gotowe, gdy:** decyzja i powód zapisane, albo jawnie: „wszystkie siedem przeszło".
      **(AC-4)**

## Faza B — Spłata długu z 046 (osobne commity)

- [ ] **T-10** — **Panel admina QA przez kontrakt.** `app/admin/qa/page.tsx` woła
      `prisma.qaEpic.findMany` z zagnieżdżonym `include`, mimo że moduł ma `getAllEpics`.
      Sprawdzić kształt danych; jeśli nie pokrywa tego, czego używa `QaAdminTree` — **rozszerzyć
      kontrakt QA**, a nie obchodzić granicę. To zmiana zachowania → osobny commit.
      **Gotowe, gdy:** plik nie zawiera `prisma.`, a klikacz `scenario-qa-admin-create-hierarchy`
      jest zielony. **(AC-5)**
- [ ] **T-11** — **Dane z seeda w środowisku klikaczy.** `scripts/e2e-web.sh` odpala tylko
      `migrate deploy`; przez to 16 testów było czerwonych z pustych tabel, co **psuje wartość
      sygnału**. Dołożyć istniejący `npm run db:seed` (nie pisać drugiego zestawu danych).
      **Gotowe, gdy:** pełny zestaw klikaczy uruchomiony, liczba czerwonych porównana z 19 sprzed
      fali, a każdy pozostały czerwony ma ustaloną przyczynę. **(AC-6)**

## Faza C — Bramki i domknięcie

- [ ] **T-12** — Komplet bramek na lokalnym Postgresie (C-13; `export` **osobnymi instrukcjami** dla
      `DATABASE_URL` i `DIRECT_URL`): `check:actions` (**=160**), `check:ai-coverage` (**=550**),
      `check:cost-badge`, `check:content-memory`, `check:migrations`, `check:ui-contract`,
      `check:schema-drift`, `check:boundaries`, `check:module-registry`, `check:test-types`,
      `next lint`, `next build`, `test:unit`. **(AC-9)**
- [ ] **T-13** — Klikacz ścieżki szczęśliwej **22/22** (21 modułów + odczyt rejestru). To jedyny
      dowód, że przeniesienie siedmiu modułów niczego nie zmieniło dla użytkownika. **(AC-8, AC-10)**
- [ ] **T-14** — Rozdz. 15 dziennika: wpis 047, przestawione statusy zadań 4–5, **jawna lista
      modułów wciąż czekających** (po nazwie, z liczbą), stan zdolności platformy odłożonych oraz
      informacja, czego brakuje do domknięcia AC-6 z 046. **(AC-7)**
- [ ] **T-15** `[P]` — `CLAUDE.md`: aktualizacja liczby przeniesionych modułów i listy przejściowej
      w sekcji „Module boundaries".
- [ ] **T-16** — Wpisy do `doświadczenia.md` (C-51), jeśli po drodze wyszedł nieoczywisty problem.

---

## Mapowanie kryteriów akceptacji → zadania

| AC | Zadania |
|----|---------|
| AC-1 — katalog modułu samowystarczalny, trasy cienkie | T-2…T-8 |
| AC-2 — konsumenci danych wyłącznie przez kontrakt; wyłączenie powłoki nazwane | T-2…T-8, T-8a |
| AC-3 — wpis usunięty z listy przejściowej i z uprawnień | T-2…T-8 |
| AC-4 — moduł pominięty jawnie, z powodem | T-9 |
| AC-5 — panel admina QA przez kontrakt | T-10 |
| AC-6 — klikacze mają dane; czerwony = regresja | T-11 |
| AC-7 — dziennik mówi, ile zostało i dlaczego | T-14 |
| AC-8 — klikacz ścieżki szczęśliwej 21/21 modułów | T-13 |
| AC-9 — komplet bramek, liczby akcji bez spadku | T-1, T-12 |
| AC-10 — przenosiny oddzielone od poprawek | T-2…T-8 (dyscyplina commitów), T-13 |

**Żaden AC nie został bez pokrycia.**

---

## Ścieżka krytyczna

```
T-1 (potwierdzenie: bez migracji)
   ↓
T-2 → T-3 → T-4 → T-5 → T-6 → T-7 → T-8      (moduły, rosnący promień rażenia,
   ↓                                            osobny commit każdy)
T-9 (jawne odnotowanie pominięć, jeśli będą)
   ↓
T-10, T-11  (dług z 046 — osobne commity, niezależne od siebie [P])
   ↓
T-12 → T-13  (bramki, potem klikacz — klikacz na niezielonym buildzie nic nie znaczy)
   ↓
T-14 → T-15 → T-16  (dokumentacja)
```

- **Kolejność T-2…T-8 nie jest przypadkowa.** Nawyki mają jednego konsumenta, Zdrowie trzech
  (w tym pulpit i kalendarz). Wzorzec ma być sprawdzony na najprostszym module, zanim dotknie tego,
  od którego zależy strona główna.
- **T-11 przed T-13.** Klikacz bez danych z seeda daje 19 czerwonych z powodów niezwiązanych z kodem;
  uruchamianie go wcześniej to marnowanie 12 minut na wynik, którego i tak nie da się czytać.
- **T-5 jest miejscem, gdzie zasada kontraktu jest realnie testowana** — 47 eksportów akcji.
  Jeśli kontrakt Magazynowania urośnie do 47 pozycji, granica nic nie znaczy i trzeba to zgłosić,
  a nie przemilczeć.

## Notatki / blokady

- **Poza zakresem** (spec §5): 10 pozostałych modułów, zdolności platformy `ai`/`llm`/`jobs`,
  zadanie 8 (asystent z deklaracji), wyprowadzenie pulpitu i kalendarza z deklaracji, zaostrzenie
  bramki rejestru o wykrywanie modułów „po staremu".
- **Bez migracji** — potwierdza `check:schema-drift` (T-1, T-12).
