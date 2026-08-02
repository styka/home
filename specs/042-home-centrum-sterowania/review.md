# Recenzja: 042 — Strona główna jako centrum sterowania

- **Spec:** ./spec.md · **Plan:** ./plan.md · **Weryfikacja:** ./verify.md
- **Data:** 2026-08-02
- **Zakres diffa:** `origin/develop...HEAD` — 55 plików, +3522 / −81
  (z czego `src/generated/admin-docs.ts` to **artefakt generowany** przez `copy-docs.js`, który
  re-osadza `CLAUDE.md` i `doświadczenia.md` — stąd większość objętości diffa)

---

## Ustalenia (od najpoważniejszego)

### 1. `ShoppingPage.tsx` — błędna odmiana liczebnika w oknie potwierdzenia · **convention (C-32)** · ✅ NAPRAWIONE w recenzji
**Było:** `{counts.DONE === 1 ? "kupiona pozycja" : "kupionych pozycji"}`
**Skutek:** dla 2, 3 i 4 pozycji okno mówiło *„2 kupionych pozycji"* zamiast *„2 kupione pozycje"* —
w oknie potwierdzającym **nieodwracalne** kasowanie, czyli dokładnie tam, gdzie tekst musi być
zrozumiały od pierwszego czytania. Polski ma trzy formy (1 / 2–4 / reszta), a dwuargumentowy warunek
obsługuje tylko dwie.
**Poprawka:** użyty `pluralizePolish(n, one, few, many)` — lokalna kopia helpera, dokładnie jak
w `ShoppingHomePage.tsx` i `KitchenHomePage.tsx` (styl otoczenia, C-53). Zweryfikowane:
1 → „kupiona pozycja", 2–4 → „kupione pozycje", 5 i 12 → „kupionych pozycji", 22 → „kupione pozycje".

### 2. `actions/favoriteViews.ts:88` — wyścig przy równoczesnym zapisie tej samej ścieżki · **correctness (drobne)** · ⏸️ świadomie zostawione
**Scenariusz:** dwa równoległe kliknięcia gwiazdki na tym samym adresie (np. podwójne kliknięcie
albo dwie karty przeglądarki) — obie akcje przechodzą sprawdzenie `findUnique`, obie wołają `create`,
druga dostaje naruszenie unikalności (P2002) i użytkownik widzi ogólny błąd zamiast „już zapisane".
**Dlaczego nie naprawiam:** integralność danych jest zapewniona przez `@@unique([ownerId, path])` —
duplikat **nie powstanie** w żadnym scenariuszu. To wyłącznie kosmetyka komunikatu w bardzo wąskim
oknie czasowym; przycisk i tak jest blokowany na czas `isPending`. Naprawa (upsert albo łapanie P2002)
to zmiana o wartości niewspółmiernej do ryzyka na tym etapie.

### 3. `FavoritesSidebarSection.tsx:44` — podświetlenie aktywnej pozycji ignoruje filtry · **convention (kosmetyka)** · ⏸️
`pathname === f.path.split("?")[0]` — dwie zakładki na ten sam moduł, różniące się tylko parametrami
(np. „Zadania: w toku" i „Zadania: zrobione"), podświetlą się **obie** przy wejściu w którąkolwiek.
Nie wpływa na nawigację ani na dane; poprawa wymagałaby czytania `search` w komponencie serwerowej
powłoki, czego świadomie unikamy (patrz `doświadczenia.md` — `useSearchParams` w powłoce).

### 4. `FavoriteStarButton.tsx:121` — etykieta przycisku przy pierwszym renderze · **convention (kosmetyka)** · ⏸️
`isSaved` pochodzi ze stanu ustawianego w efekcie, więc przez pierwszą klatkę tytuł brzmi „Zapisz to
miejsce…", nawet gdy widok już jest w ulubionych. Wygląd wyrównuje się natychmiast po hydratacji.
Świadomy kompromis z T-22: **poprawność** kliknięcia liczona jest synchronicznie (`currentPath()`),
więc żaden zapis ani usunięcie nie zależy od tego stanu — dotyczy to wyłącznie ikony i etykiety.

---

## Sprawdzone i **bez zastrzeżeń**

| Obszar | Ocena |
|---|---|
| **Kontrola dostępu (C-21)** | ✅ każda mutacja przez `where: { id, ownerId }` w `updateMany`/`deleteMany`; **zweryfikowane na bazie**, że cudze `id` nie rusza cudzego wiersza |
| **RBAC (C-22)** | ✅ `filterAccessibleFavorites` oparte o istniejące `isPathLocked`, wpięte we **wszystkich 4** miejscach renderowania (karty, pasek boczny, przełącznik, skróty) |
| **`revalidatePath` (C-20)** | ✅ każda mutacja kończy `revalidatePath("/", "layout")` — poprawnie „layout", bo ulubione są w powłoce, nie tylko na `/` |
| **Migracja (C-10..C-12)** | ✅ ręczny plik `0221`, numer zweryfikowany, zero enumów, brak rozjazdu ze `schema.prisma` (`prisma migrate diff` czysty dla nowego modelu) |
| **`AIAction` (C-23)** | ✅ brak nowych akcji AI; manifest pokrycia uzupełniony, `check:actions` i `check:ai-coverage` zielone |
| **Bezpieczeństwo — otwarte przekierowanie** | ✅ `normalizeFavoritePath` odrzuca `//host`, `/\host`, schematy (`javascript:`, `data:`) i znaki sterujące; egzekwowane **po stronie serwera** przy zapisie, więc nie da się tego obejść z klienta. Pokryte testem jednostkowym na prawdziwym module |
| **XSS** | ✅ jedyne nowe `dangerouslySetInnerHTML` to `MARKDOWN_STYLES` — **statyczna stała autorstwa dewelopera**, bez danych użytkownika. Etykiety i ścieżki ulubionych renderowane jako tekst |
| **Motyw (C-30)** | ✅ zero hexów w nowych plikach; kolory z `var(--*)` i `color-mix`; jedyne `rgba(0,0,0,…)` to przyciemnienie tła nakładki — wzorzec z `Modal.tsx` |
| **Mobile (C-31)** | ✅ kolumna asystenta `hidden xl:block`, brak drugiego paska; cele dotyku ≥32 px; `Alt+1..9` z wykluczeniem AltGr |
| **Reuse (C-53)** | ✅ asystent nietknięty poza ~10 liniami w istniejącym handlerze; gwiazdka montowana raz w powłoce zamiast w kilkunastu nagłówkach; magistrala zdarzeń skopiowana z istniejącego `assistantBus` |

---

## Uwaga procesowa (nie blokująca)

**Rozszerzenie zakresu o naprawę hydratacji (15 plików)** jest jedynym odstępstwem od planu.
Uzasadnienie i dowód przyczynowości są w `verify.md` §5 oraz `plan.md` §9a: bez tej poprawki cztery
kryteria akceptacji nie przechodzą, a po niej `Alt+1` zaczął działać bez żadnej zmiany w kodzie
skrótu. Zmiana jest mechaniczna (`<style>{X}</style>` → `dangerouslySetInnerHTML`) i nie zmienia
zachowania, ale **dotyka plików spoza tego feature'a** (Kuchnia, Raporty, Pogoda, QA, Admin) — warto,
żeby właściciel o tym wiedział, bo zysk (odzyskane renderowanie serwerowe całej aplikacji) wykracza
poza 042.

---

## Werdykt

## ✅ APPROVE Z UWAGAMI

Jedno realne ustalenie (odmiana liczebnika) **naprawione w trakcie recenzji**. Trzy pozostałe to
świadomie zaakceptowana kosmetyka o znikomym wpływie, każde z uzasadnieniem, dlaczego naprawa byłaby
niewspółmierna. Poprawność, kontrola dostępu, RBAC, migracja i bezpieczeństwo — bez zastrzeżeń,
w większości potwierdzone wykonaniem, a nie samym przeglądem.

Domknięcie zgodnie ze standing authorization: merge do `develop`, następnie automatyczna promocja
`develop → master` (C-52) po kontroli integralności.
