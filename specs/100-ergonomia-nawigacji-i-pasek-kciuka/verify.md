# Weryfikacja: Ergonomia nawigacji — paski filtrów i pasek kciuka

- **Spec:** ./spec.md · **Plan:** ./plan.md · **Zadania:** ./tasks.md
- **Data:** 2026-08-25
- **Środowisko:** lokalny Postgres 16 (`omnia_dev`), build produkcyjny, Chromium headless (klikacz)

---

## 1. Bramki

| Komenda | Wynik |
|---------|-------|
| `npm run check:migrations` | ✅ numeracja OK (następny wolny: 0261) |
| `npm run check:actions` | ✅ 161 akcji, wszystkie z egzekutorem i kontraktem |
| `npm run check:schema-drift` | ✅ brak rozjazdu (migracje odtwarzają `schema.prisma`) |
| `npm run check:ui-contract` | ✅ 22/22 modułów na `ModuleView` |
| `npm run check:i18n` | ✅ zero tekstów zaszytych w komponentach |
| `npm run check:client-safe` | ✅ |
| `npm run check:logs` | ✅ 728 plików serwerowych bez `console.*` |
| `npm run check:tailwind` | ✅ 172 katalogi objęte `content` |
| `npm run check:boundaries` | ✅ granice modułów egzekwowane |
| `npm run check:module-registry` | ✅ |
| `npm run check:owner-columns` | ✅ 2373 wywołania Prismy czyste |
| `npm run check:route-gating` | ✅ 19/19 tras sprawdza uprawnienie |
| `npm run check:e2e-waits` | ✅ |
| `npx next lint --dir src` | ✅ zero błędów (tylko wcześniej istniejące ostrzeżenia `exhaustive-deps` / `no-img-element`) |
| `npx tsc --noEmit -p tsconfig.json` · `-p tsconfig.test.json` | ✅ |
| `npx next build` | ✅ przechodzi (lokalny Postgres; `scripts/migrate.js` **nie** uruchamiany — C-13) |
| `npm run check:perf` | ✅ 1172 kB najcięższa trasa, suma 65748 kB — **w paśmie ±5 %** |
| Klikacz `e2e/specs/ergonomia-nawigacji.spec.ts` | ✅ **14/14** |

---

## 2. Kryteria akceptacji

### A. Wiadomości — przełącznik segmentowy

| AC | Werdykt | Dowód |
|----|---------|-------|
| **AC-1** trzy listy w pasku, bez menu | ✅ | Klikacz `[100-AC1]`: `role="tablist"` o nazwie „Listy tematów" z trzema `role="tab"` — Proponowane / Monitorowane / Odrzucone. `HotTopics.tsx:181-201`. |
| **AC-2** wybrany segment widoczny i ogłaszany | ✅ | Klikacz `[100-AC2]`: `aria-selected="true"` na wybranym. Wyróżnienie wizualne: `bg-[var(--bg-elevated)]` + `shadow-[inset_0_0_0_1px_var(--accent-blue)]` (`PrzelacznikSegmentowy.tsx:74-76`). |
| **AC-3** menu ⋮ zniknęło | ✅ | Klikacz `[100-AC3]`: zero przycisków o nazwie dokładnie „Więcej działań". `grep MenuProponowanych\|MoreVertical HotTopics.tsx` → 0 trafień. Menu **tematu** z 087 („Więcej działań tematu…") celowo zostaje. |
| **AC-4** licznik 0 → widoczny, wyłączony | ✅ | Klikacz `[100-AC4]`: segment „Odrzucone" obecny i `disabled` na świeżym koncie. `PrzelacznikSegmentowy.tsx:62` (`wylaczona ?? licznik === 0`). |
| **AC-5** jeden wiersz przy 360 px | ✅ | **Pomiar:** wysokość przyklejonego nagłówka **49 px**, trzy segmenty, **jedna** współrzędna górna (brak zawijania). Próg AC ≤ 60 px. |

### B. Zadania — filtr etykiet

| AC | Werdykt | Dowód |
|----|---------|-------|
| **AC-6** wysokość niezależna od liczby etykiet | ✅ | **Pomiar** przy **18** etykietach: wiersz filtru **42 px**, **0 chipsów** bez wyboru. Struktura nie zawiera już `allTags.map` (`TaskFilters.tsx`), więc liczba chipsów zależy od WYBORU, nie od słownika. |
| **AC-7** wyszukiwanie + wielokrotny wybór, ta sama semantyka | ✅ | Klikacz `[100-AC7/AC9]`: pole „Szukaj etykiety…" + pozycja „Wszystkie tagi". Filtrowanie po frazie: `FiltrTagow.tsx:45-49`. Semantyka **nietknięta** — `TasksPage` nadal robi `selectedTagIds.every(...)`; `onTagToggle` przekazany bez zmian. |
| **AC-8** „3 z 18" + usuwalne chipy | ✅ | `FiltrTagow.tsx:52` (`t("zIlu", …)`), chipy `TaskTagBadge … onRemove={() => onPrzelacz(tag.id)}` — zdejmuje **jeden** tag (`:148`). |
| **AC-9** pusty wybór = wszystkie | ✅ | `bezFiltru = wybrane.length === 0`; `TasksPage` przy pustej liście zwraca komplet (`:357`, `:415`, `:424` bez zmian). Klikacz potwierdza etykietę „Wszystkie". |
| **AC-10** brak zahardkodowanego koloru | ✅ | `grep '#fff' TaskFilters.tsx` → 0. Licznik aktywnej zakładki: `var(--on-accent)`. |

### C. Telefon — pasek kciuka

| AC | Werdykt | Dowód |
|----|---------|-------|
| **AC-11** ustawienie ręki per użytkownik, domyślnie prawa | ✅ | Migracja `0260` (`DEFAULT 'right'`), `MenuPrefs.handedness`, `czytajReke()` zawęża do unii; przełącznik w `MenuPrefsEditor` → `updateMenuPrefs({handedness})` → `revalidatePath("/", "layout")` + `router.refresh()`. Przeżywa przeładowanie (zapis w bazie, nie w przeglądarce). |
| **AC-12** gwiazdka i robaczek po stronie ręki | ❌ | **Robaczek: tak** — `FeedbackInspector` na `.omnia-plywajacy`, mechanizm potwierdzony klikaczem `[100-AC12]` (`right: 20px` → `left: 20px`). **Gwiazdka ulubionych na telefonie: NIE.** Grupa chromu w górnym pasku (`AppShell.tsx:202`) ma `ml-auto` i **nie** dostała lustrzenia — na komputerze rząd chromu je ma (`ModuleSidebar.tsx:321`), na telefonie nie. To jest wprost wymienione w zgłoszeniu właściciela („Ma to dotyczyć także ikon dotyczących »ulubionych«"). |
| **AC-13** magiczna ikona na środku, wyeksponowana, jedyna | ✅ | **Pomiar:** 52 px, wystaje **13 px** ponad pasek, odchylenie od środka **0 px**. Klikacz potwierdza **jedną** kopię (`toHaveCount(1)`) — pływający wariant istnieje od `md` (`.omnia-fab-asystent`). |
| **AC-14** lustrzana kolejność, większe cele przy kciuku, min. 44 px | ✅ | **Pomiar:** Zakupy 81×55, Zadania 81×55, Asystent AI 52×52, **Strona główna 161×55** — najważniejsza pozycja sama w prawej połowie, więc najszersza i w rogu kciuka. Wszystkie ≥ 44×44. |
| **AC-15** gest: przytrzymaj → wachlarz → przeciągnij → drugi poziom | ❌ | Logika jest kompletna i poprawna w `WachlarzNawigacji.tsx`, **ale `PasekKciuka` ją unieważnia**: `Pozycja` jest zadeklarowana **wewnątrz** ciała `PasekKciuka` (`PasekKciuka.tsx:69`), więc przy każdym renderze powstaje **nowy typ komponentu**. Otwarcie wachlarza zmienia wartość kontekstu → `PasekKciuka` się przerenderowuje → React **odmontowuje i montuje na nowo** przyciski paska → przechwycony wskaźnik przepada razem ze starym węzłem i `pointerup` nigdy nie dociera do uchwytu. Gest z paska nie domknie się. (Na pozycjach nawigacji bocznej problem nie występuje — `NavItem` jest komponentem najwyższego poziomu.) |
| **AC-16** puszczenie poza / `Escape` zamyka bez nawigacji | ⚠️ | Kod poprawny (`onPointerUp` bez trafienia → `zamknij()` bez `push`; nasłuch `keydown` na `Escape`, `WachlarzNawigacji.tsx`), ale **zablokowane przez AC-15** dla paska. |
| **AC-17** krótkie tapnięcie nadal nawiguje | ⚠️ | `router.push(wlasnyHref)` przy braku otwarcia. **Ryzyko z AC-15 tu nie występuje** (bez otwarcia wachlarza nie ma przerenderowania), ale weryfikacja ręczna wymaga naprawy AC-15, żeby oba warianty sprawdzić razem. |
| **AC-18** `prefers-reduced-motion` bez animacji | ✅ | `@media (prefers-reduced-motion: reduce) { .wachlarz-podpowiedz { transition: none } }` — gest nie zależy od animacji (pozycje liczone geometrycznie, nie z przejść). |
| **AC-19** wystająca ikona nie zasłania treści | ✅ | **Pomiar:** dolne wypełnienie obszaru głównego **64 px** przy pasku 56 px + 13 px wystawania; `env(safe-area-inset-bottom)` zachowane w `<nav>`. |

### D. Komputer

| AC | Werdykt | Dowód |
|----|---------|-------|
| **AC-20** ten sam kształt/kolor, jedno miejsce po stronie ręki | ✅ z uwagą | Kształt i kolor identyczne (52 px, koło, `--accent-blue` / `--on-accent`). Strona wg ręki przez `.omnia-plywajacy`, z odsunięciem o `--sidebar-width`, żeby nie wjechać pod panel. **Uwaga kosmetyczna:** ikona ma 22 px na komputerze i 24 px na telefonie — różnica nie wynika z żadnej decyzji, po prostu została z poprzedniego kodu. |
| **AC-21** ten sam gest na pozycjach nawigacji bocznej | ✅ | `NavItem` rozsypuje `uchwytyLinku()` (`ModuleSidebar.tsx`); wariant linkowy zostawia kliknięcie odnośnikowi i **zjada** kliknięcie po wyborze z wachlarza, żeby nie było dwóch nawigacji. |
| **AC-22** te same ikony w tej samej relacji do ręki | ❌ | Konsekwencja AC-12: na komputerze rząd chromu (gwiazdka, tryb admina, dzwonek) idzie za ręką, na telefonie **nie** — czyli dokładnie ta relacja, którą to AC ma gwarantować, jest różna na obu urządzeniach. |

### E. Zgodność ogólna

| AC | Werdykt | Dowód |
|----|---------|-------|
| **AC-23** build i bramki | ✅ | Tabela §1 — wszystko zielone. |
| **AC-24** zero literałów w JSX | ✅ | `check:i18n` zielone; nowe teksty w `messages/pl.json` (`modules.tasks.FiltrTagow`, `components.shell.PasekKciuka`, `components.shell.WachlarzNawigacji`, `modules.news.HotTopics.listyTematow`, `MenuPrefsEditor`). |

**Bilans: 19 ✅ · 2 ⚠️ (zablokowane) · 3 ❌**

---

## 3. Zgodność z konstytucją

- **C-10..C-15** ✅ — ręczna migracja `0260`, numer z `next:migration`, `String` + union (bez enuma),
  `DEFAULT` wymagany przy `NOT NULL` na niepustej tabeli, plik zawiera **wyłącznie** własne DDL
  (`grep -E "^(DROP|ALTER TABLE .* DROP)"` pusty), brak builda/migracji przeciw prod DB.
- **C-20/C-21** ✅ — zapis przez istniejącą Server Action z `revalidatePath("/", "layout")`;
  `UserMenuPref` jest kluczowany `userId` z sesji, więc nie ma cudzego zasobu do autoryzowania.
- **C-22** ✅ — bez nowego sluga; wachlarz karmi się `resolveMenu` (już po uprawnieniach) i
  `filterAccessibleFavorites`, nie buduje własnego filtru RBAC.
- **C-23** ✅ nie dotyczy — zero nowych `AIAction`; `check:actions` zielone.
- **C-30** ✅ — wszystkie nowe kolory ze zmiennych; dodatkowo **usunięty** istniejący `#fff`.
- **C-31** ⚠️ — cele dotyku i `safe-area` ✅ (pomiar), ale **AC-12 na telefonie niespełnione**.
- **C-32** ✅ — `check:i18n` zielone.
- **C-33** ✅ — rama nietknięta poza dopuszczonym rozszerzeniem `NaglowekSekcji`; przyklejony nagłówek
  zmierzony (49 px), zasłona nadal wyrażona w CSS.
- **C-35** ✅ — `PrzelacznikSegmentowy` dowieziony **z konsumentem** (Wiadomości).
- **C-36** ✅ — brak nowej równoległej listy modułów; `MobileModuleSubNav` nietknięty; `FiltrTagow`
  w module, bo tam są jego konsumenci; powłoka nie importuje wnętrza żadnego modułu.
- **C-51** ✅ — dwie lekcje w `doświadczenia.md`.
- **C-53** ✅ — **zero nowych zależności**; gest na gołym `PointerEvent`; `TasksPage` i logika
  filtrowania nietknięte.
- **C-54** ✅ — plan poprawiony (`dynamic(ssr:false)` niemożliwy dla dostawcy kontekstu), spec
  doprecyzowany (AC-14 kłóciło się z AC-13).

---

## 4. Regresje

- **Migracja** — addytywna, z domyślnikiem; starszy kod ignoruje kolumnę. `check:schema-drift` zielone.
- **Wspólne komponenty** — `NaglowekSekcji` ma nowy prop **opcjonalny**; wywołania bez niego rysują się
  jak dotąd (`SekcjaTematu` niezmieniona). `TaskTagBadge` bez zmian.
- **`TaskFilters`** — nowy **wymagany** prop `onTagsClear`; jedyne wywołanie (`TasksPage.tsx:848`)
  zaktualizowane, `tsc` potwierdza brak innych.
- **Asystent** — `AICommandSheet` zmienił wyłącznie klasę i `display` FAB-a; logika arkusza nietknięta,
  wejście z paska idzie przez istniejącą magistralę `openAssistant()` (bez drugiego montażu).
- **Naprawiony błąd pre-istniejący**: wyścig `ensureNewsSetup` (`count === 0` → `createMany` bez
  `skipDuplicates`) kładł **całą stronę Wiadomości na 500** przy dwóch równoległych kartach.
  Nie pochodzi z tego przebiegu; naprawiony, bo blokował weryfikację AC-1..AC-5.
- **Klikacz** — nowy spec + dwie podkładki (`e2e/fixtures/zadania.ts`); pozostałe specy nietknięte.

---

## 5. Werdykt końcowy

### DO POPRAWY

Wszystkie bramki są zielone, a 19 z 24 kryteriów spełnionych i **zmierzonych**. Nie zaliczam całości,
bo dwa braki są realne i oba dotyczą rzeczy, o które właściciel poprosił wprost.

**Braki (dopisane do `tasks.md` jako T-32 i T-33):**

1. **T-32 — gest z dolnego paska nie domknie się** (AC-15, odblokowuje AC-16 i AC-17).
   `Pozycja` jest zadeklarowana wewnątrz ciała `PasekKciuka`, więc każdy render tworzy nowy typ
   komponentu. Otwarcie wachlarza zmienia kontekst → `PasekKciuka` się przerenderowuje → React
   odmontowuje przyciski i montuje nowe → przechwycony wskaźnik przepada, `pointerup` nie dochodzi.
   Wynieść `Pozycja` na poziom modułu (jak `NavItem` w `ModuleSidebar`).
   *Źródłem jest kod, nie spec ani plan.*

2. **T-33 — gwiazdka ulubionych na telefonie nie idzie za ręką** (AC-12, a przez to AC-22).
   Grupa chromu w górnym pasku (`AppShell.tsx:202`) ma `ml-auto` i nie dostała lustrzenia, choć
   odpowiedni rząd na komputerze je ma. Reguła `.omnia-chrom-konta` już istnieje — brakuje jej
   zastosowania. *Źródłem jest kod, nie spec ani plan.*

**Uwaga kosmetyczna (nie blokuje):** ikona asystenta ma 22 px na komputerze i 24 px na telefonie —
różnica bez decyzji za nią. Do rozważenia przy T-32/T-33.

Wracam do `/implement`.
