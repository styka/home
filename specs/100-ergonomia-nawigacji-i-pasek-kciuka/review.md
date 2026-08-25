# Recenzja: Ergonomia nawigacji — paski filtrów i pasek kciuka

- **Spec:** ./spec.md · **Plan:** ./plan.md · **Zadania:** ./tasks.md · **Weryfikacja:** ./verify.md
- **Data:** 2026-08-25
- **Diff:** `origin/develop...HEAD` — 34 pliki, +2708 / −273

---

## 1. Zakres i co już sprawdzono gdzie indziej

`verify.md` przeszedł 24/24 kryteriów z **pomiarami** (nie z lektury) i wszystkie bramki. Recenzja
celuje więc w to, czego weryfikacja z definicji nie widzi: warunki brzegowe nieobjęte kryteriami,
pułapki latentne i zgodność z konwencjami.

Recenzja objęła **cały diff źródłowy**. Poza nim zostają `src/generated/*` (5 plików, ~190 linii) —
to wyjście skryptów `copy-*.js` odpalanych przez `build`; commit odświeża wersje, które były w repo
**przestarzałe** względem `content/` i `.claude/`. Nie jest to zmiana autorska i nie recenzuję jej
treści; odnotowuję tylko, że po tym przebiegu drzewo po `npm run build` jest czyste, a wcześniej nie było.

---

## 2. Ustalenia

### U-1 · correctness · `src/components/shell/PasekKciuka.tsx:45` — **naprawione w recenzji**

`if (pozycje.length === 0) return null;` odbierało magicznej ikonie jej **jedyne** miejsce na telefonie.

**Scenariusz awarii:** konto z bardzo wąskimi uprawnieniami (np. tylko `module.home`) → `resolveMenu`
odsiewa `home` z listy, `resolveTabBar` nie ma czego wybrać i schodzi do pustej tablicy → pasek zwraca
`null` → a pływający wariant asystenta istnieje dopiero od `md` (`.omnia-fab-asystent`). Efekt:
użytkownik bez dostępu do modułów **traci też dostęp do asystenta AI** — czyli do jedynego narzędzia,
które z założenia działa niezależnie od uprawnień modułowych. Przed 100 FAB stał w rogu bezwarunkowo,
więc jest to regresja wprowadzona przez tę zmianę.

**Poprawka (naniesiona):** wczesny `return null` usunięty — pasek rysuje się także pusty, niosąc samą
magiczną ikonę. Uzasadnienie zapisane w komentarzu przy zmianie.

### U-2 · correctness (latentne) · `src/components/shell/AppShell.tsx:122` — **naprawione w recenzji**

Drugi poziom wachlarza dobiera zapisane widoki modułu **dopasowaniem po prefiksie ścieżki**. Moduł
o adresie `/` (Strona główna) jest prefiksem **każdej** ścieżki.

**Scenariusz awarii:** gdyby `home` kiedykolwiek trafił do listy poziomu 1 (dziś odsiewa go
`resolveMenu`, ale to decyzja z zupełnie innego pliku i innego przebiegu — 087), przytrzymanie i
zatrzymanie na nim pokazałoby **wszystkie** zapisane widoki użytkownika jako „widoki Strony głównej".
Bezgłośnie: wynik nadal wygląda sensownie, bo to prawdziwe ulubione, tylko przypisane nie tam.

**Poprawka (naniesiona):** jawny warunek `m.href === "/"` → pusta lista, z komentarzem, że to
zabezpieczenie na wypadek zmiany o piętro wyżej.

### U-3 · observation · `src/components/shell/AppShell.tsx:114-131` — **świadomie zostawione**

`pozycjeWachlarza` i `widokiModulu` powstają na nowo przy każdym renderze `AppShell`, więc wartość
kontekstu wachlarza też zmienia tożsamość i wszyscy konsumenci (pasek + ~20 pozycji nawigacji bocznej)
przerenderowują się razem z powłoką.

**Dlaczego nie zmieniam:** `AppShell` renderuje się przy zmianie ścieżki i przy otwarciu menu — czyli
wtedy, gdy te elementy i tak muszą się przerysować. `useMemo`/`useCallback` dołożyłyby tu dwie
abstrakcje bez mierzalnego zysku (C-53), a **nie** jest to wariant błędu z T-32: tam problemem był
zmieniający się **typ komponentu** (odmontowanie węzła), tu zmienia się tylko tożsamość propsów.

### U-4 · observation · `src/components/shell/WachlarzNawigacji.tsx:180` — **świadomie zostawione**

`start.current` jest jednym refem na cały dostawcę, więc drugi palec położony na innej pozycji w
trakcie gestu nadpisze punkt startu pierwszego.

**Dlaczego nie zmieniam:** gest jest z definicji jednopalcowy (przytrzymaj → przeciągnij → puść), a
`setPointerCapture` po otwarciu kieruje zdarzenia do jednego elementu. Obsługa wielodotyku wymagałaby
mapy per `pointerId` — abstrakcji bez konsumenta (C-53). Najgorszy możliwy skutek to zamknięty wachlarz,
nie zła nawigacja.

---

## 3. Konwencje Omnia — przelot

| Reguła | Ocena |
|--------|-------|
| **C-01** praca tylko w `worldofmag/` | ✅ poza `specs/`, `CLAUDE.md` i `doświadczenia.md` (katalog główny, zgodnie z przeznaczeniem) |
| **C-10..C-12** migracja ręczna, numer, bez enuma | ✅ `0260_reka_dominujaca`, jeden `ADD COLUMN IF NOT EXISTS … TEXT NOT NULL DEFAULT 'right'`; union `Reka` w TS |
| **C-15** migracja zawiera tylko własne DDL | ✅ `grep -E "^(DROP\|ALTER TABLE .* DROP)"` pusty |
| **C-20** mutacja = Server Action + `revalidatePath` | ✅ `updateMenuPrefs` kończy `revalidatePath("/", "layout")` — zasięg **całej powłoki**, co jest tu wymagane, bo ręka zmienia chrom na każdej stronie |
| **C-21** guard dostępu | ✅ `UserMenuPref` kluczowany `userId` z sesji (`requireAuth`), brak cudzego zasobu; wachlarz nie robi własnego RBAC, tylko konsumuje `resolveMenu` + `filterAccessibleFavorites` |
| **C-23** `AIAction` z egzekutorem | ✅ nie dotyczy — zero nowych akcji; `check:actions` zielone |
| **C-30** kolory ze zmiennych CSS | ✅ w nowym kodzie zero hexów; dodatkowo **usunięty** istniejący `#fff` z `TaskFilters`. Jedyne wartości wprost to `rgba(0,0,0,…)` w cieniach i przyciemnieniu — ten sam zapis, co w istniejących FAB-ach |
| **C-31** mobile-first, 44 px, `safe-area` | ✅ potwierdzone pomiarem (81×55, 161×55, 52×52); `env(safe-area-inset-bottom)` zachowane |
| **C-32** teksty przez `t()` | ✅ `check:i18n` zielone; `PrzelacznikSegmentowy` celowo **nie ma** własnego `useTranslations` — bierze `ariaLabel` propsem, bo jest komponentem wspólnym bez własnej treści |
| **C-33** kontrakt widoku nietknięty | ✅ jedyna zmiana to opcjonalny prop `segmenty` w `NaglowekSekcji`; zasłona nadal w CSS |
| **C-35** wspólny komponent z konsumentem | ✅ `PrzelacznikSegmentowy` dowieziony wpięty w Wiadomości |
| **C-36** granice modułów | ✅ zero nowych list modułów; `MobileModuleSubNav` nietknięty; `FiltrTagow` w module (jedyny konsument); powłoka nie importuje wnętrza modułu |
| **C-41** klucze API | ✅ nie dotyczy |
| **C-51** lekcje | ✅ cztery wpisy w `doświadczenia.md` |
| **C-53** minimalizm | ✅ **zero nowych zależności** — gest na gołym `PointerEvent`; `TasksPage` i semantyka filtru nietknięte |
| **C-54** spójność artefaktów | ✅ plan poprawiony (`dynamic(ssr:false)` niemożliwy dla dostawcy kontekstu), spec doprecyzowany (AC-14 kłóciło się z AC-13) — oba z zapisanym uzasadnieniem |

---

## 4. Bezpieczeństwo

- **RBAC wachlarza:** poziom 1 to `resolveMenu(userPermissions, prefs).enabled` — lista **już**
  przefiltrowana po uprawnieniach; poziom 2 przechodzi przez `filterAccessibleFavorites(…, isPathLocked)`.
  Wachlarz nie ma własnej ścieżki decyzyjnej, więc nie może się z RBAC rozjechać. ✅
- **Nawigacja imperatywna:** `router.push` dostaje wyłącznie `href` z tych dwóch przefiltrowanych list
  albo `path` ulubionego, który przy zapisie przeszedł `normalizeFavoritePath` (zabezpieczenie przed
  otwartym przekierowaniem). Brak nowej powierzchni. ✅
- **Bez XSS:** nowy kod nie renderuje HTML-a ani markdownu; wszystko przez tekst Reacta. ✅
- **Bez logów:** `check:logs` zielone; nowy kod nie loguje niczego. ✅

---

## 5. Poza-zakresowa naprawa w tym diffie (świadoma, odnotowana)

`src/modules/news/actions/news.ts` — `ensureNewsSetup` robiło `count === 0` → `createMany` **bez**
`skipDuplicates`. Klasyczne sprawdź-i-działaj: dwie równoległe karty (albo dwaj pracownicy klikacza)
widzą zero, obie wstawiają, `@@unique([workspaceId, key])` odbija drugą i **cała strona Wiadomości
leci na 500**. Błąd **pre-istniejący**, nie z tego przebiegu.

Naprawiony tutaj, bo blokował weryfikację AC-1..AC-5 i jest realną usterką na wdrożeniu. Poprawka to
jedno słowo (`skipDuplicates: true`) — ten sam zapis stoi już obok w `newsRefresh.ts`. Uznaję to za
uzasadnione odstępstwo od „bez refaktorów przy okazji" (C-53): to nie refaktor, to odblokowanie
weryfikacji własnego feature'a.

---

## 6. Werdykt

### APPROVE

Dwa ustalenia (U-1, U-2) były realne i **naniesione w recenzji**; oba to jednolinijkowe warunki
brzegowe z komentarzem, nie zmiany projektowe. Po nich: `tsc` czysty, `next lint` bez błędów,
`next build` przechodzi, `check:perf` w paśmie ±5 %, `check:i18n` zielone, klikacz zielony.

Dwa dalsze (U-3, U-4) świadomie zostawiam z zapisanym uzasadnieniem — obie „poprawki" dołożyłyby
abstrakcję bez konsumenta, a żadna nie ma scenariusza awarii poza tym, który już jest opisany.

Największą wartością tego przebiegu nie są same trzy zgłoszenia, tylko to, że **trzy z czterech
istotnych usterek wyszły z pomiaru, nie z lektury kodu**: ikona 74 px od środka, gest niedomykający
się przez miejsce deklaracji komponentu, gwiazdka ignorująca regułę, która „przecież działa".
Wszystkie trzy wyglądały poprawnie w kodzie.
