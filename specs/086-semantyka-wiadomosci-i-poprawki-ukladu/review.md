# Recenzja: Semantyka akcji w Wiadomościach, świeże gorące tematy i poprawki układu

- **Feature:** 086-semantyka-wiadomosci-i-poprawki-ukladu
- **Data:** 2026-08-24
- **Diff:** `origin/develop...HEAD` — 77 plików, +1661 / −326, siedem commitów
- **Podstawa:** `spec.md`, `plan.md`, `verify.md` (21/21 AC, bramki zielone)

Recenzja celowała w to, czego `verify.md` z definicji nie sprawdza: w **kod**, a nie w zachowanie —
martwy kod po przeniesieniu logiki, rozjazd między komentarzem a stanem faktycznym, duplikaty typów
i miejsca, w których wspólny komponent zmienia zachowanie 54 konsumentom.

---

## Ustalenia

### 1. `NewsPage.tsx:356-372` — *correctness (dokumentacja), naprawione w recenzji*

Komentarz nad pomiarem zasłony powtarzał **wycofaną** diagnozę: „nagłówki przyklejały się na 107 px
zamiast ~49 — czyli 58 px za nisko". Ta liczba została w trakcie implementacji obalona (107 px = 48
paska widoku + 59 paska modułu, wartość poprawna) i z tego powodu poprawiono `spec.md` (AC-20) oraz
`plan.md` (§5) — ale komentarz w kodzie został po staremu.

**Skutek:** następna osoba czytająca ten `useEffect` dostaje jako uzasadnienie fakt, który został
zbadany i odrzucony, i może „naprawiać" nieistniejące 58 px. Łańcuch `spec → plan → kod` z C-54
rozjeżdża się dokładnie w ostatnim ogniwie.

**Poprawka (naniesiona):** komentarz opisuje teraz pułapkę pomiarową (obie formuły dają tę samą
liczbę, dopóki paski przylegają) i różnicę, którą widać dopiero po wstawieniu czegoś nad paskiem
(107 → 147 px ze starą miarą).

### 2. `actions/news.ts` — *simplification: trzy martwe importy, i to one trzymały bramkę na zielono*

Po przeniesieniu rdzenia gorących tematów do `lib/goraceTematy.ts` w akcjach zostały importy, których
nikt już nie woła: `rememberedContent`, `hashInputs`, `resolveSectionMode` (oraz typ `AiSectionMode`,
używany wyłącznie przez skasowany interfejs). ESLint tego nie zgłasza.

**Skutek — poważniejszy niż sam martwy kod:** bramka `check:content-memory` rozpoznaje „plik pamięta
treść" **po imporcie `rememberedContent`**. Dopóki martwy import tam stał, bramka potwierdzała
klasyfikację `remembered` dla pliku, który po 086 niczego już nie pamięta. Zieleń bramki w
`verify.md` była w tym jednym punkcie fałszywa. Po usunięciu importów bramka **zaczerwieniła się** —
i miała rację.

**Poprawka (naniesiona):** importy usunięte; wpis w `src/lib/ai/content-memory-coverage.json`
przeklasyfikowany na `on-demand` (w pliku zostało jedno wywołanie modelu — `resummarizeItem`,
odpalane kliknięciem w inną długość streszczenia), a uzasadnienie przy `newsRefresh.ts` wskazuje
teraz nowy plik rdzenia. `npm run check:content-memory` → 36 plików, 5 z pamięcią treści.
Lekcja dopisana do `doświadczenia.md`.

### 3. `actions/news.ts` — *simplification: dwie deklaracje tego samego kształtu, naprawione*

`HotTopicsResult` (13 pól) powtarzało co do pola `WynikGoracychTematow` z rdzenia, a akcja zwraca
`{ ...wynik, usage }`. Spread **nie podlega** kontroli nadmiarowych właściwości, więc nowe pole
w rdzeniu przeszłoby do klienta bez błędu kompilacji i bez wpisu w DTO — rozjazd, którego `tsc` nie
złapie.

**Poprawka (naniesiona):** `export type HotTopicsResult = WynikGoracychTematow;` — jedno źródło
kształtu, nazwa dla konsumentów zachowana. `tsc --noEmit` czysto.

### 4. `prisma/schema.prisma:2679` — *convention (dokumentacja), naprawione*

Komentarz przy `NewsItem.status` wymieniał `"PENDING" | "ACKNOWLEDGED" | "DISMISSED"`, choć migracja
0258 i typ TS zostawiły dwie wartości. Schemat jest tu jedynym miejscem, gdzie widać dozwolone
wartości kolumny `String` (C-12 zabrania enuma), więc nieaktualna lista jest realnie myląca.
Poprawione; `check:schema-drift` po zmianie zielony.

### 5. `jobs/newsRefresh.ts:753` — *obserwacja, świadomie bez zmiany*

Koszt piątego etapu (gorące tematy) **nie trafia** do `sink`, więc nie wchodzi do `usage` przebiegu
zapisywanego w `NewsRefreshRun` i pokazywanego w historii odświeżeń. Nie jest to jednak koszt
ukryty: `rememberedContent` zapisuje zużycie razem z treścią, a zakładka „Gorące tematy" pokazuje je
przez `AiContentMeta` — czyli **przy treści, za którą zapłacono**. Kontrola budżetu też nie jest
omijana: od 082 `chatComplete` sprawdza limity bezwarunkowo, niezależnie od sesji.

Doliczenie tej kwoty do przebiegu wymagałoby helpera sumującego dwa `UsageMeter`-y (dziś nie ma
takiego) i groziłoby **podwójnym liczeniem** w widoku. Zostawione świadomie, odnotowane tutaj.

### 6. Zmiany o dużym zasięgu — sprawdzone, bez ustaleń

- **`ConfirmProvider` (54 konsumentów).** Odwrócenie domyślności jest bezpieczne w obie strony:
  `destructive={options.destructive === true}` i `confirmLabel ?? (destructive ? "Usuń" : "Potwierdź")`
  nie mają stanu pośredniego. Sprawdziłem, że **żadne** wywołanie nie podaje `confirmLabel: "Usuń"`
  bez `destructive` (jedyne trafienie to galeria komponentów, gdzie oba idą razem) — więc nie
  powstaje przycisk „Usuń" bez czerwieni. 50 wywołań deklaruje usuwanie jawnie, 4 są świadomie
  neutralne (wypisane w `verify.md`).
- **`PageHeader` (wszystkie moduły).** Regresja znaleziona przez klikacza, opisana w `verify.md` §1,
  naprawiona przed recenzją. Sprawdzone przeglądem ramy na dziesięciu trasach.
- **`HotTopics.tsx` importuje typ z `lib/goraceTematy`** — komponent kliencki, plik rdzenia ciągnie
  Prismę i `chatComplete`. To `import type`, kasowany przy kompilacji, więc nie wciąga niczego do
  grafu przeglądarki (lekcja 049); `check:client-safe` i budżet wydajnościowy potwierdzają — suma
  bajtów bez zmian (65 678 kB).
- **Guardy dostępu (C-21).** Rdzeń `przeliczGoraceTematy(ownerId)` przyjmuje właściciela
  **parametrem wymaganym**, bez wartości domyślnej; sesję sprawdza wyłącznie nakładka `getHotTopics`
  (`requireAuth`), a zadanie w tle podaje `ownerId` przebiegu. Zapytania nadal filtrują przez
  `filtrMoichRekordow`. Nie powstała ścieżka czytająca cudze dane.
- **`revalidatePath` (C-20).** Usunięto akcję (`dismissItem`), nie dodano żadnej nowej mutacji;
  pozostałe akcje Wiadomości bez zmian w tym zakresie.
- **Migracja 0258.** Sam `UPDATE` na kolumnie statusu, bez zmiany kształtu tabeli, idempotentna
  (drugi przebieg trafia zero wierszy). `check:migrations` i `check:schema-drift` zielone.

---

## Bramki po poprawkach recenzenckich

| Sprawdzenie | Wynik |
|---|---|
| `tsc --noEmit` | ✅ czysto |
| `npm run check:content-memory` | ✅ 36 plików (5 z pamięcią treści, 31 na żądanie) |
| `npm run check:schema-drift` | ✅ brak rozjazdu |
| `npm run check:cost-badge`, `check:ai-coverage`, `check:actions`, `check:migrations` | ✅ |
| `npm run build` (32 bramki + `next build` + budżet) | ✅ najcięższa trasa 1171 kB, suma 65 678 kB |
| `scripts/migrate.js` na lokalnym Postgresie | ✅ `Migrations applied` |
| Klikacz — specy Wiadomości i potwierdzeń | ✅ 8 zielonych |
| Klikacz — pełna suita (przed poprawkami recenzenckimi, zmiany typo-/komentarzowe) | ✅ 180 zielonych |

---

## Werdykt

**APPROVE Z UWAGAMI.**

Cztery ustalenia naniesione w recenzji (martwe importy + błędna klasyfikacja bramki, zduplikowany
typ wyniku, dwa nieaktualne komentarze opisujące stan sprzed zmiany), jedno odnotowane świadomie bez
zmiany (koszt etapu 5 raportowany przy treści, nie w podsumowaniu przebiegu). Żadne nie dotyczy
poprawności działania dla użytkownika. Realne błędy, brak guardów, naruszenia konstytucji: **brak**.

Uwaga przeniesiona z `verify.md`, ważna dla właściciela: **AC-15** (zapas pod wcięciem aparatu
iPhone'a) jest sprawdzalny wyłącznie na urządzeniu — w sandboxie nie ma WebKita, a w Chromium desktop
`env(safe-area-inset-top)` wynosi zero. Wartość podniesiono z 12 do 28 px ponad tę zmienną;
potwierdzenie należy do właściciela po wdrożeniu.
