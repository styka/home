# Weryfikacja: Ergonomia nawigacji — paski filtrów i pasek kciuka

- **Spec:** ./spec.md · **Plan:** ./plan.md · **Zadania:** ./tasks.md
- **Data:** 2026-08-25 (przebieg 1: DO POPRAWY · **przebieg 2 po nawrocie: GOTOWE**)
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
| Klikacz `e2e/specs/ergonomia-nawigacji.spec.ts` | ✅ **15/15** (po nawrocie; +pomiar gwiazdki) |

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
| **AC-12** gwiazdka i robaczek po stronie ręki | ✅ *(naprawione w T-33)* | Robaczek: `.omnia-plywajacy`, `right: 20px` → `left: 20px`. Gwiazdka: **pomiar pozycji** przy oknie 390 px — środek **296 px** (ręka prawa) → **173 px** (lewa), czyli przechodzi przez połowę ekranu. Górny pasek telefonu dostał `.omnia-chrom-konta` — tę samą regułę, której używa rząd chromu na komputerze. |
| **AC-13** magiczna ikona na środku, wyeksponowana, jedyna | ✅ | **Pomiar:** 52 px, wystaje **13 px** ponad pasek, odchylenie od środka **0 px**. Klikacz potwierdza **jedną** kopię (`toHaveCount(1)`) — pływający wariant istnieje od `md` (`.omnia-fab-asystent`). |
| **AC-14** lustrzana kolejność, większe cele przy kciuku, min. 44 px | ✅ | **Pomiar:** Zakupy 81×55, Zadania 81×55, Asystent AI 52×52, **Strona główna 161×55** — najważniejsza pozycja sama w prawej połowie, więc najszersza i w rogu kciuka. Wszystkie ≥ 44×44. |
| **AC-15** gest: przytrzymaj → wachlarz → przeciągnij → drugi poziom | ✅ *(naprawione w T-32)* | `Pozycja` wyniesiona na **poziom modułu** (`PasekKciuka.tsx:136`), więc przerenderowanie paska po otwarciu wachlarza nie odmontowuje już przycisków i przechwycony wskaźnik przeżywa gest. Logika sekwencji w `WachlarzNawigacji.tsx`: próg 350 ms → `setPointerCapture` → trafienie liczone odległością od środka podpowiedzi → zatrzymanie 400 ms otwiera poziom 2 z `glebiej(id)`. |
| **AC-16** puszczenie poza / `Escape` zamyka bez nawigacji | ✅ | `onPointerUp` bez trafienia → `zamknij()` **bez** `router.push`; nasłuch `keydown` na `Escape` aktywny tylko przy otwartym wachlarzu; `onPointerCancel` → `zamknij()`. Odblokowane przez T-32. |
| **AC-17** krótkie tapnięcie nadal nawiguje | ✅ | Brak przekroczenia progu → `router.push(wlasnyHref)` (przycisk paska) albo zwykłe kliknięcie `<Link>` (nawigacja boczna). Odblokowane przez T-32. |
| **AC-18** `prefers-reduced-motion` bez animacji | ✅ | `@media (prefers-reduced-motion: reduce) { .wachlarz-podpowiedz { transition: none } }` — gest nie zależy od animacji (pozycje liczone geometrycznie, nie z przejść). |
| **AC-19** wystająca ikona nie zasłania treści | ✅ | **Pomiar:** dolne wypełnienie obszaru głównego **64 px** przy pasku 56 px + 13 px wystawania; `env(safe-area-inset-bottom)` zachowane w `<nav>`. |

### D. Komputer

| AC | Werdykt | Dowód |
|----|---------|-------|
| **AC-20** ten sam kształt/kolor, jedno miejsce po stronie ręki | ✅ | Kształt, kolor **i wielkość ikony** identyczne (52 px koło, `--accent-blue` / `--on-accent`, `Sparkles` 24 px — ujednolicone w T-34). Strona wg ręki przez `.omnia-plywajacy`, z odsunięciem o `--sidebar-width`, żeby nie wjechać pod panel boczny. |
| **AC-21** ten sam gest na pozycjach nawigacji bocznej | ✅ | `NavItem` rozsypuje `uchwytyLinku()` (`ModuleSidebar.tsx`); wariant linkowy zostawia kliknięcie odnośnikowi i **zjada** kliknięcie po wyborze z wachlarza, żeby nie było dwóch nawigacji. |
| **AC-22** te same ikony w tej samej relacji do ręki | ✅ *(naprawione w T-33)* | Obie powierzchnie stoją na tej samej regule `.omnia-chrom-konta` + `html[data-reka]`; gest przytrzymania działa i na pasku, i na pozycjach nawigacji bocznej; magiczna ikona ma tę samą postać. |

### E. Zgodność ogólna

| AC | Werdykt | Dowód |
|----|---------|-------|
| **AC-23** build i bramki | ✅ | Tabela §1 — wszystko zielone. |
| **AC-24** zero literałów w JSX | ✅ | `check:i18n` zielone; nowe teksty w `messages/pl.json` (`modules.tasks.FiltrTagow`, `components.shell.PasekKciuka`, `components.shell.WachlarzNawigacji`, `modules.news.HotTopics.listyTematow`, `MenuPrefsEditor`). |

**Bilans przebiegu 1: 19 ✅ · 2 ⚠️ · 3 ❌ → przebieg 2 po nawrocie: 24 ✅ · 0 ⚠️ · 0 ❌**

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
- **C-31** ✅ — cele dotyku i `safe-area` potwierdzone pomiarem; AC-12 na telefonie domknięte w T-33.
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

### Przebieg 1 — DO POPRAWY

19/24 kryteriów spełnionych i zmierzonych, wszystkie bramki zielone, ale dwa braki realne i oba
dotyczące rzeczy, o które właściciel poprosił wprost:

1. **T-32 (AC-15, blokujące AC-16 i AC-17)** — `Pozycja` zadeklarowana wewnątrz ciała `PasekKciuka`.
   Każdy render tworzył nowy typ komponentu, więc otwarcie wachlarza (zmiana kontekstu →
   przerenderowanie paska) kazało Reactowi odmontować przyciski. Razem ze starym węzłem przepadał
   przechwycony wskaźnik i `pointerup` nie dochodził — gest się nie domykał.
2. **T-33 (AC-12, a przez to AC-22)** — górny pasek telefonu nie używał `.omnia-chrom-konta`, więc
   gwiazdka ulubionych zostawała po prawej u osoby leworęcznej.

Plus drobiazg kosmetyczny (T-34): ikona asystenta 22 px na komputerze vs 24 px na telefonie.

### Przebieg 2 (po nawrocie do `/implement`) — GOTOWE

**24/24 kryteriów spełnionych.** Klikacz **15/15**, `next lint` bez błędów, `next build` przechodzi,
wszystkie bramki zielone (tabela §1), budżet wydajnościowy w paśmie ±5 %.

Obie usterki miały źródło w **kodzie**, nie w specu ani planie — artefakty nie wymagały korekty poza
tą, którą `/implement` zrobił wcześniej z własnej inicjatywy (AC-14 i `dynamic(ssr:false)`, C-54).

Dwie lekcje dopisane do `doświadczenia.md` (C-51):
- komponent zadeklarowany w ciele innego komponentu gubi stan przywiązany do węzła DOM,
- test czytający regułę CSS przepuszcza brak jej **zastosowania** — dlatego pomiar dotyczy teraz
  prawdziwej gwiazdki na prawdziwej stronie, a nie wstrzykniętego węzła zastępczego.

Przechodzę do `/review`.
