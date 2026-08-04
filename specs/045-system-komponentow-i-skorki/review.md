# Recenzja: System komponentów, kontrakt widoku i profesjonalny silnik skórek

- **Spec:** ./spec.md · **Plan:** ./plan.md · **Weryfikacja:** ./verify.md
- **Data:** 2026-08-04
- **Zakres diffa:** `origin/develop...HEAD` — 88 plików, +1163 / −984, 3 nowe pliki, 83 zmienione

---

## Ustalenia

### 1. `ConfirmProvider` gubił obietnicę przy dwóch wywołaniach pod rząd — **naprawione w recenzji**

- **Plik:** `src/components/ui/ConfirmProvider.tsx:40`
- **Kategoria:** correctness
- **Opis:** Drugie wywołanie `confirm()`, zanim pierwsze zostało rozstrzygnięte, nadpisywało
  `resolveRef.current`, przez co **pierwsza obietnica nigdy się nie domykała**.
- **Scenariusz awarii:** Użytkownik klika „Usuń" przy pozycji A, okno się otwiera. Zanim odpowie,
  jakiś kod (np. skrót klawiszowy `d` z `useKeyboardShortcuts`, wciąż aktywny pod modalem) wywołuje
  potwierdzenie dla pozycji B. Handler A zostaje na `await` **na zawsze** — razem z otwartym
  `startTransition`, więc widok zostaje w stanie oczekiwania do przeładowania strony.
- **Poprawka:** przed nadpisaniem referencji poprzednia obietnica jest domykana odmową
  (`resolveRef.current?.(false)`). Użytkownik i tak widzi już inne pytanie, więc „nie" jest jedyną
  bezpieczną odpowiedzią dla porzuconego wywołania.
- **Status:** naniesione w tej recenzji (drobna, bezpieczna poprawka).

### 2. `useConfirm()` poza providerem tworzy nową funkcję przy każdym renderze — **zostawione**

- **Plik:** `src/components/ui/ConfirmProvider.tsx:76`
- **Kategoria:** simplification
- **Opis:** Gałąź zapasowa (degradacja do `window.confirm`) zwraca świeżą funkcję, więc referencja
  jest niestabilna między renderami.
- **Skutek:** Gdyby ta funkcja trafiła do tablicy zależności `useEffect`/`useMemo`, efekt uruchamiałby
  się co render. **Dziś nie trafia** — wszystkie 52 miejsca wołają ją bezpośrednio w handlerze.
- **Decyzja:** zostawione. Gałąź działa wyłącznie poza powłoką (test, playground), a jej celem jest to,
  żeby komponent w oderwaniu od `AppShell` nie wywalał aplikacji przy kliknięciu „Usuń".
  Memoizacja tu byłaby optymalizacją ścieżki, która w produkcji nie istnieje (C-53).

### 3. Trasa generowania skórki bez własnego limitu wywołań — **zostawione, zgodne z repo**

- **Plik:** `src/app/api/llm/skins/generate/route.ts`
- **Kategoria:** security (odporność na nadużycie)
- **Opis:** Trasa sprawdza sesję, ale nie ma własnego ograniczenia częstości; użytkownik może
  generować skórki w pętli, płacąc tokenami.
- **Skutek:** koszt modelu, nie wyciek danych. Ograniczony przez `maxTokens: 3000` i limit 600 znaków
  opisu.
- **Decyzja:** zostawione. **Wszystkie** istniejące trasy `/api/llm/*` w repo działają tak samo,
  a współdzielony limit to zadanie 26 z Fazy 5 przebudowy (rozdz. 11.2). Dokładanie tu punktowego
  rozwiązania byłoby szóstym mechanizmem obok pięciu, które ta przebudowa ma scalić.

### 4. Brak potwierdzenia zachowania klikaczami — **znane ograniczenie przebiegu**

- **Kategoria:** correctness (ryzyko, nie defekt)
- **Opis:** 21 zmigrowanych widoków przeszło kontrolę typów, lint i `next build`, ale **nie ma
  klikaczy** potwierdzających, że zachowanie się nie zmieniło.
- **Skutek:** ewentualna regresja w układzie wyjdzie u właściciela, nie w bramce.
- **Decyzja:** ograniczenie zapisane wprost w `verify.md` i w rozdz. 15 dokumentu architektury.
  Siatka bezpieczeństwa to **Faza 0**, wskazana jako następny przebieg. Ryzyko jest świadomie
  przyjęte i ograniczone tym, że migracja była mechaniczna (`ModuleView` renderuje wewnętrznie
  ten sam `PageHeader`, `contentGap` = dawne 24 px).

---

## Sprawdzone i czyste

| Obszar | Wynik |
|--------|-------|
| `await` przy `confirmDialog` | ✅ zero wywołań bez `await`; zero pozostałych `window.confirm(` w modułach |
| Reguła hooków (`rules-of-hooks`) | ✅ lint nie zgłasza; `useConfirm()` zawsze na górze komponentu |
| Handlery `onClick` z `await` bez `async` | ✅ brak |
| Spójność `schema.prisma` ↔ migracje | ✅ schemat **nietknięty**; obie migracje to wyłącznie `INSERT … ON CONFLICT DO NOTHING` |
| `AIAction` bez egzekutora (C-23) | ✅ `check:actions` zielony; feature nie dodaje akcji asystenta |
| Guardy dostępu (C-21) | ✅ `importSkin` tworzy wyłącznie skórkę użytkownika; `exportSkin` przez `guardedVia` |
| `revalidatePath` (C-20) | ✅ obie nowe akcje kończą się rewalidacją |
| Enumy Prisma (C-12) | ✅ zero; nowe rodzaje jako `String` + unia |
| Zaszyte kolory (C-30) | ✅ 73 podmiany; 29 plików z zadeklarowaną rolą, **0 „do poprawy"** |
| Teksty PL (C-32) | ✅ wszystkie nowe etykiety po polsku |
| Praca w `worldofmag/` (C-01) | ✅ diff nie dotyka legacy `src/`, `_old/`, `pom.xml` |
| XSS w nowych renderach | ✅ feature nie dotyka `markdownToHtml`; `dangerouslySetInnerHTML` w `ScenarioPage` przeniesione bez zmiany treści |
| Martwy kod (C-53) | ✅ `DataList` i wspólny `BulkActionBar` usunięte jako pozbawione konsumenta; zdublowane `EmptyState` i `Field` scalone w jedną implementację |

## Bramki po naniesionej poprawce

`tsc` czysty · `next lint` 0 błędów · `next build` ✓ Compiled successfully · `test:unit` 645/645 ·
wszystkie bramki `check:*` zielone (w tym `check:ui-contract`: **21/21 modułów**).

---

## Werdykt

### ✅ APPROVE Z UWAGAMI

Feature realizuje wszystkie 24 kryteria akceptacji i przechodzi komplet bramek. Jedna realna usterka
(gubiona obietnica w `ConfirmProvider`) znaleziona i naprawiona w recenzji. Pozostałe trzy ustalenia
to świadomie przyjęte kompromisy, każdy z uzasadnieniem i przypisany do właściwej fazy przebudowy.

**Uwagi do zapamiętania na kolejny przebieg:**
1. **Faza 0 (siatka bezpieczeństwa) jest teraz pilniejsza niż przed tym przebiegiem** — 21 widoków
   zmieniło opakowanie bez klikaczy potwierdzających zachowanie.
2. Wspólny limit wywołań modelu (zadanie 26) obejmie też trasę generowania skórki.
3. Pasek akcji zbiorczych z rozdz. 10.6 zostaje otwarty — wyprowadzenie go z Zadań ma sens dopiero,
   gdy drugi moduł będzie go potrzebował.
