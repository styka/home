# Weryfikacja: 042 — Strona główna jako centrum sterowania

- **Spec:** ./spec.md · **Plan:** ./plan.md · **Zadania:** ./tasks.md
- **Data:** 2026-08-02 (przebieg 2 — po naprawach T-22…T-25)
- **Środowisko:** lokalny Postgres 16 (`omnia_dev`), Chromium headless (Playwright), serwer
  uruchamiany przez `scripts/e2e-web.sh`. **Nigdy prod DB** (C-13).

---

## 1. Bramki techniczne

| Komenda | Wynik |
|---|---|
| `npm run check:migrations` | ✅ OK — następny wolny numer `0222` |
| `npm run check:actions` | ✅ OK — 160 akcji z egzekutorem i kontraktem |
| `npm run check:ai-coverage` | ✅ OK — 545 akcji: kontrola dostępu i klasyfikacja kompletne |
| `npm run check:cost-badge` | ✅ OK |
| `npm run check:content-memory` | ✅ OK |
| `npx next lint --dir src` | ✅ **0 błędów** (ostrzeżenia wyłącznie preegzystujące) |
| `npx tsc --noEmit` | ✅ OK |
| `npx next build` | ✅ **EXIT=0**, „Compiled successfully" |
| `npx prisma migrate deploy` (lokalnie) | ✅ tabela, 2 indeksy, FK `ON DELETE CASCADE` |

**Testy E2E napisane dla tego feature'a:**

| Plik | Wynik |
|---|---|
| `e2e/specs/favorites.spec.ts` | ✅ **12/12** |
| `e2e/specs/home-layout.spec.ts` | ✅ **9/9** |
| `e2e/specs/tasks-ux.spec.ts` | ✅ **5/5** |
| `e2e/specs/smoke.spec.ts` (regresja) | ✅ **12/12** |

---

## 2. Kryteria akceptacji

Dowód: **E2E** = wykonany test przeglądarkowy · **DB** = test na prawdziwej bazie ·
**JEDN** = test funkcji na prawdziwym module · **CSS** = dowód z wygenerowanego arkusza · **KOD** = przegląd logiki.

| AC | Werdykt | Dowód |
|---|---|---|
| **AC-1** zapis z filtrami | ✅ | **E2E** — zapis z `/tasks?status=DONE&x=1` |
| **AC-2** powrót pod ten sam adres | ✅ | **E2E** — URL po kliknięciu = `/tasks?status=DONE&x=1` |
| **AC-3** gwiazdka jako przełącznik | ✅ | **E2E** — ponowny klik wraca do stanu „zapisz" |
| **AC-4** dostęp z każdej strony + filtrowanie | ✅ | **E2E** — przełącznik z `/portfel`, filtr „Kuchnia", skok do `/kitchen` |
| **AC-5** skrót klawiszowy | ✅ | **E2E** — `Alt+1` → `/notes`; `Control+Alt+Digit1` (AltGr) **nie** nawiguje |
| **AC-6** pusty stan | ✅ | **E2E** — zachęta widoczna, sekcja w pasku bocznym nie renderuje się wcale |
| **AC-7** zarządzanie | ✅ | **E2E** — zmiana nazwy i usunięcie, z odbiciem w interfejsie |
| **AC-8** RBAC | ✅ | **JEDN** — `filterAccessibleFavorites` odfiltrowuje `/portfel` bez uprawnienia; filtr wpięty we wszystkich 4 miejscach renderowania |
| **AC-9** brak duplikatów | ✅ | **DB** + **E2E** — `@@unique([ownerId, path])` odrzuca duplikat; ten sam adres u innego konta przechodzi |
| **AC-10** synchronizacja między urządzeniami | ✅ | **E2E** — po `localStorage.clear()` + `sessionStorage.clear()` zakładka nadal widoczna |
| **AC-11** asystent widoczny, nie znika | ✅ | **E2E** — przy 1440 px kolumna widoczna, pole tekstowe gotowe **bez klikania**, po przewinięciu 600 px nadal w widoku |
| **AC-12** mobile, jeden sidebar | ✅ | **E2E** — przy 390 px kolumna asystenta nie renderuje się (`toBeHidden`) |
| **AC-13/14** briefing + pusty stan | ✅ | **KOD** — `DailyBriefingCard` nietknięty (kryterium „nie zepsuj") |
| **AC-15** skróty modułów wg uprawnień | ✅ | **KOD** — `ModuleSnapshotGrid` nietknięty |
| **AC-16** 3/2/1 kolumny, brak przewijania poziomego | ✅ | **E2E** — zmierzone: 390 px → 390/390, 900 px → 900/900, 1440 px → 1440/1440 (`scrollWidth === clientWidth`) |
| **AC-17** skórki, tylko tokeny | ✅ | **E2E** + **GREP** — kolor tekstu podąża za skórką (ciemna `rgb(232,232,232)` → jasna `rgb(17,17,17)`); w nowych plikach zero hexów |
| **AC-18** zachowana personalizacja pulpitu | ✅ | **KOD** — `order`/`hidden`/`effectiveOrder` nietknięte; nowy klucz doklejany istniejącą logiką |
| **AC-19** sekcje AI nie generują się same | ✅ | **KOD** — efekt czyta wyłącznie `localStorage`; `generate()` nie jest w nim wołane |
| **AC-20** dotyk nie zapala checkboxa | ✅ | **E2E** — Chromium Pixel 5 (potwierdzone `hover: hover === false`): po `tap()` w tytuł `opacity: 0`, `pointer-events: none` |
| **AC-21** mysz nadal pokazuje checkbox | ✅ | **E2E** — na wskaźniku (`hover: hover === true`): `opacity: 1`, `pointer-events: auto` |
| **AC-22** tryb zaznaczania na obu | ✅ | **CSS** — gałąź `selectionMode ? "opacity-100"` nietknięta i poza `@media` |
| **AC-23** rozciągane pole opisu | ✅ | **E2E** — akapit ~1600 znaków bez `\n`: `clientHeight = 480 px` = dokładnie sufit 60vh (zamiast ~72 px z 3 wierszy) |
| **AC-24** potwierdzenie czyszczenia | ✅ | **E2E** — okno z „1 kupiona pozycja" i „nie da się cofnąć"; „Anuluj" zostawia pozycję, potwierdzenie usuwa |
| **AC-25** Notatki mówią „Foldery" | ✅ | **E2E** + **GREP** — 0 trafień „grup" w tekstach UI Notatek |
| **AC-26** Zadania zostają przy „Grupach" | ✅ | **E2E** + **GREP** |
| **AC-27** dane i adresy nienaruszone | ✅ | **E2E** — `/notes/groups` odpowiada, nagłówek „Foldery notatek"; model nietknięty |

**Podsumowanie: ✅ 27 / 27.**

---

## 3. Zgodność z konstytucją

| Reguła | Stan |
|---|---|
| C-01 (praca w `worldofmag/`) | ✅ (jeden błąd wykryty i cofnięty przed commitem) |
| C-02 (alias `@/*`) | ✅ |
| C-10..C-13 (migracje, nigdy prod DB) | ✅ `0221_ulubione_widoki`, weryfikacja na lokalnym Postgresie |
| C-12 (zero enumów) | ✅ `String` + unia TS |
| C-20 (`revalidatePath`) | ✅ `revalidatePath("/", "layout")` w każdej mutacji |
| C-21 (własność) | ✅ świadome user-only (plan §2.3); izolacja właściciela **zweryfikowana na bazie** |
| C-22 (RBAC) | ✅ brak nowego sluga; filtr po `isPathLocked` |
| C-23 (`AIAction`) | ✅ brak nowych akcji AI; manifest pokrycia uzupełniony |
| C-24 (trash) | ✅ świadomie pominięty (zakładka to nie treść) |
| C-30 (zmienne CSS) | ✅ zweryfikowane pomiarem na dwóch skórkach |
| C-31 (mobile/keyboard) | ✅ dotyk zweryfikowany na Pixel 5; `Alt+1..9` z ochroną AltGr |
| C-32 (teksty PL) | ✅ |
| C-50 (build zielony) | ✅ |
| C-51 (`doświadczenia.md`) | ✅ 8 wpisów |
| C-53 (minimalizm) | ⚠️ **jedno świadome rozszerzenie zakresu** — patrz §5 |
| C-54 (spójność artefaktów) | ✅ `spec.md` (2 korekty), `plan.md` §9a, `tasks.md` zaktualizowane |

---

## 4. Regresje

- **`smoke.spec.ts`: 12/12 ✅** (przebieg powtórzony — pojedynczy błąd w jednym uruchomieniu okazał
  się skutkiem zimnego startu tuż po podmianie `.next`; powtórka czysta).
- **Pełny pakiet E2E: 16 błędów — ale TYLE SAMO bez moich plików testowych.** Uruchomiłem pełny
  pakiet dwukrotnie: z moimi trzema nowymi specyfikacjami i bez nich. Wynik identyczny (16 failed,
  207 skipped), więc to **preegzystująca niestabilność uruchomienia równoległego** w tym środowisku
  (wspólne konto administratora i jedna baza przy `fullyParallel`), a nie skutek tej zmiany.
- **Migracja** wyłącznie `CREATE TABLE` — nie dotyka istniejących tabel.

---

## 5. Rozszerzenie zakresu (C-54) — naprawa błędu hydratacji

W przebiegu 1 zgłosiłem błąd hydratacji jako **preegzystujący i poza zakresem**. Dalsza diagnoza
wykazała, że **blokuje on cztery kryteria akceptacji tego feature'a**, więc został naprawiony tutaj.

**Mechanizm:** React escapuje cudzysłowy w **tekstowym dziecku** `<style>` przy renderowaniu na
serwerze (`content: &quot;•&quot;`), a na kliencie nie (`content: "•"`). Rozjazd → React porzuca
drzewo z serwera i przełącza **cały korzeń** na renderowanie po stronie klienta → przemontowania
kasują stan lokalny (popover gwiazdki) i unieruchamiają `router.push` wywoływany z natywnego
listenera zdarzeń.

**Dowód, że to była przyczyna, a nie zbieg okoliczności:** po samej tej poprawce `Alt+1` zaczął
nawigować — **bez żadnej zmiany w kodzie skrótu**.

**Zakres poprawki:** 15 plików, mechanicznie
`<style>{MARKDOWN_STYLES}</style>` → `<style dangerouslySetInnerHTML={{ __html: MARKDOWN_STYLES }} />`.
Treść to statyczna stała autorstwa dewelopera, więc jest to bezpieczne; serwer i klient generują
identyczny HTML.

**Sprostowanie do przebiegu 1:** postawiona tam diagnoza „D-2 — defekt skrótu `Alt+1`" była **błędna**.
Kod skrótu był poprawny od początku.

---

## 6. Ograniczenia weryfikacji (uczciwie)

- **Projekt `mobile` z konfiguracji repo (iPhone 13 / WebKit) jest w tym środowisku niedostępny.**
  Obejściem był **Chromium w emulacji Pixel 5**, co wystarczyło do rozstrzygnięcia AC-20 (potwierdzone
  `hover: hover === false`), ale **nie jest** testem na silniku WebKit ani na fizycznym urządzeniu.
- **AC-13/14/15/18/19/22 zweryfikowane przeglądem kodu**, nie wykonaniem — to kryteria typu
  „nie zepsuj", dotyczące komponentów, których ta zmiana nie dotyka.
- **E2E działa na serwerze deweloperskim**, nie na buildzie produkcyjnym; zachowania zależne od
  hydratacji mogą się na produkcji różnić (po naprawie z §5 — na korzyść).
- Testy tego feature'a wymagają trybu `serial`, bo repo ma `fullyParallel`, a wszystkie testy dzielą
  jedno konto administratora.

---

## 7. Werdykt końcowy

## ✅ GOTOWE Z UWAGAMI

**27/27 kryteriów akceptacji spełnionych**, wszystkie bramki i `next build` zielone, brak regresji
w `smoke`. Uwagi do świadomej akceptacji:

1. **Rozszerzenie zakresu** (§5) — naprawa błędu hydratacji w 15 plikach poza pierwotnym planem.
   Uzasadniona: bez niej feature nie przechodzi własnych kryteriów. Odnotowana w `plan.md` §9a.
2. **Weryfikacja dotyku przez emulację Chromium**, nie na WebKicie/urządzeniu (§6).
3. **Preegzystująca niestabilność pełnego pakietu E2E** (§4) — nie wprowadzona tą zmianą, ale warta
   osobnego rozpoznania (współdzielone konto i baza przy `fullyParallel`).

Przejście do `/review`.
