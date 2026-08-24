# Recenzja: Tryb czytania, jednolite ustawienia modułu i chrom nawigacji

- **Feature:** 087-tryb-czytania-i-chrom-nawigacji
- **Data:** 2026-08-24
- **Diff:** `origin/develop...HEAD` — 37 plików, +2220 / −733, trzynaście commitów
- **Podstawa:** `spec.md`, `plan.md`, `verify.md` (21/21 AC, bramki zielone, klikacz 194)

Recenzja celowała w to, czego `verify.md` nie sprawdza: w **kod**. Najwięcej uwagi dostały dwa
miejsca, gdzie zmiana była przenosinami istniejącej logiki — bo przenosiny gubią niezmienniki
bezgłośnie — oraz nowa właściwość ramy, która wyłącza całą nawigację.

---

## Ustalenia

### 1. `FavoriteViewForm.tsx` — *correctness, naprawione w recenzji*

Formularz zapisu ulubionego, przeniesiony z gwiazdki do dialogu, brał adres do zapisu **ze stanu
ustawionego przez efekt** (`fullPath`), a nie z `window.location` w momencie kliknięcia. Efekt jest
kluczowany `pathname`.

**Scenariusz awarii:** użytkownik jest na `/tasks/all?layout=kanban`, zmienia układ na listę
(`useViewState` → `router.replace`, **ścieżka bez zmian, zmienia się tylko query**) → efekt się nie
przelicza → klika gwiazdkę → „Dodaj bieżący widok" → zapisany zostaje adres **sprzed** zmiany. Ulubiony
wraca w innym stanie niż ten, który użytkownik widział, klikając. To jest dokładnie ten błąd, który
042 już raz naprawiło i opisało komentarzem — komentarz przy przepisywaniu nie przeszedł razem z kodem.

Drugi wariant tej samej pomyłki: `disabled={!fullPath}` blokował przycisk, dopóki efekt się nie
wykonał (w 042 zapisane jako „T-22: gwiazdka bywała nieklikalna przy pierwszym renderze").

**Poprawka (naniesiona):** `biezacaSciezka()` czytana synchronicznie przy każdym kliknięciu
(`rozwin`, `zapisz`, `usun`); stan z efektu został wyłącznie do wyglądu („czy ten widok jest już
zapisany"); `disabled` usunięty. Lekcja dopisana do `doświadczenia.md`.

### 2. `NewsPage.tsx` — *correctness, naprawione w recenzji*

`chromeless={trybCzytania}` wyłączało nagłówek i pasek widoku **niezależnie od tego, którą zakładkę
modułu pokazujemy**, a przełącznik trybu (jedyne wyjście) mieszka w pasku modułu renderowanym tylko
w widoku wiadomości.

**Scenariusz awarii:** adres `/wiadomosci?widok=hot&czytanie=1` (do zdobycia z ulubionego zapisanego
w trybie czytania, a potem przełączonego, albo wpisany ręcznie) → rama bez nagłówka, bez zakładek
i bez paska modułu → **nie ma żadnego wyjścia** poza edycją adresu. Własna dokumentacja propa
ostrzega przed tym wprost („widok musi mieć zawsze widoczne wyjście").

**Poprawka (naniesiona):** `chromeless={trybCzytania && view === "feed"}`.

### 3. `UserMenuPref.favoritesCollapsed` — *obserwacja, świadomie bez zmiany*

Po usunięciu `FavoritesSidebarSection` kolumna nie ma już czytelnika w interfejsie; zapis i odczyt
w `actions/menuPrefs.ts` działają dalej. Usunięcie wymagałoby migracji na tabeli preferencji, a wartość
nie szkodzi. Zostawione świadomie i odnotowane (także w `verify.md` §6) zamiast po cichu.

### 4. Zmiany o dużym zasięgu — sprawdzone, bez ustaleń

- **`ViewBar`/`ModuleView` (21 modułów).** Odstęp pod nagłówkiem dokładany **wyłącznie** gdy
  `pasekMaTresc === false`, więc widoki z paskiem nie drgają (potwierdzone przeglądem ramy na
  dziesięciu trasach). Zmiana układu akcji jest zamknięta poniżej `md` (`md:flex-none`,
  `md:ml-0`, `md:[&>*]:flex-none`). Slot `settings` jest opcjonalny — brak pola to zachowanie sprzed
  zmiany, a `pasekMaTresc` i wczesny `return null` w `ViewBar` zostały uzgodnione (moduł podający
  wyłącznie ustawienia dostaje pasek, a nie pustkę).
- **`Modal` (wszystkie okna).** Jedyna zmiana to dolne wypełnienie stopki; `padding` rozbity na
  `paddingTop`/`paddingBottom` zachowuje dotychczasowe 12 px u góry.
- **`resolveMenu`.** Filtr `home` siedzi w **jednym** miejscu czytanym przez panel boczny, menu
  telefonu i ekran zarządzania menu — więc pozycja nie może zostać w jednym z nich. `resolveTabBar`
  celowo nietknięty: dolny pasek zakładek jest konfigurowalny przez użytkownika i był poza zakresem.
  `module.home` zachowuje trasę, uprawnienie i wpis w rejestrze (`check:module-registry` zielone).
- **Guardy i akcje (C-20/C-21).** Zero nowych Server Actions; dialog ulubionych woła te same
  `addFavoriteView`/`removeFavoriteViewByPath` z ich guardami i `revalidatePath`.
- **`useReasoningLog`.** Hook wołany **bezwarunkowo** na górze komponentu tury, przed gałęziami
  `if (turn.kind === …)` — kolejność hooków stała. `"log" in turn ? turn.log : undefined` obsługuje
  warianty tury bez logu. Warunek `isAdmin && trybAdmina` dla logu technicznego bez zmian (086).
- **`zaslonaGory` jako funkcja.** `useSekcjeTematow` woła ją w momencie użycia; `zaslonaTeraz` jest
  memoizowana na `pasekH`, więc obserwator sekcji przelicza się przy zmianie wysokości paska modułu,
  a sama pozycja przyklejenia i tak należy już do CSS (`calc`).
- **Bezpieczeństwo.** Brak nowych tras, akcji, kluczy i renderowania HTML. Menu tematu i dialog
  ulubionych operują na danych, które użytkownik i tak widzi.

---

## Bramki po poprawkach recenzenckich

| Sprawdzenie | Wynik |
|---|---|
| `tsc --noEmit` | ✅ czysto |
| `npm run check:i18n` | ✅ zero literałów |
| Klikacz: `favorites`, `rama-i-chrom`, `wiadomosci-tryb-czytania` | ✅ **29 zielonych** |
| `npm run build` (przed poprawkami; poprawki są w tych samych plikach, typy czyste) | ✅ 41 potwierdzeń bramek, budżet w paśmie |
| Klikacz — pełna suita | ✅ 194 zielone |

---

## Werdykt

**APPROVE Z UWAGAMI.**

Dwa realne defekty znalezione i naprawione w recenzji — oba w miejscach, gdzie zmiana była
**przenosinami** istniejącej logiki (zapis ulubionego zgubił niezmiennik z 042; `chromeless` mógł
zostawić ramę bez wyjścia). Jedna obserwacja zostawiona świadomie (`favoritesCollapsed` bez
czytelnika). Naruszeń konstytucji brak.

Uwagi przeniesione z `verify.md`, ważne dla właściciela:
- **AC-14** (przyciski okna nad kreską iPhone'a) sprawdzony jako reguła CSS, nie na urządzeniu —
  w sandboxie nie ma WebKita, a `env(safe-area-inset-bottom)` w Chromium desktop wynosi zero.
- **Boczny prześwit** (druga połowa zgłoszenia 7) **nie dał się odtworzyć** przy 360 ani 1280 px:
  pasek modułu, sekcja i karta mają identyczne krawędzie. Naprawiona i udowodniona jest pionowa
  połowa. Jeśli boczny prześwit utrzyma się po wdrożeniu, potrzebny będzie zrzut ekranu z podaną
  szerokością okna.
