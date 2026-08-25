# Zadania: Ergonomia nawigacji — paski filtrów i pasek kciuka

- **Plan:** ./plan.md (100-ergonomia-nawigacji-i-pasek-kciuka)
- **Status:** todo
- **Data:** 2026-08-25

## Legenda
- `[ ]` do zrobienia · `[x]` zrobione · `[~]` w trakcie · `[!]` zablokowane (patrz notatki)
- `[P]` — niezależne od poprzedniego, można robić równolegle

> **Kolejność jest celowa.** Faza A i B nie ruszają schematu ani powłoki, więc idą pierwsze — dowożą
> dwa z trzech zgłoszeń przy zerowym ryzyku dla reszty aplikacji. Dopiero potem wchodzimy w pasek
> kciuka, który dotyka **każdej** trasy.

---

## Faza A — Wiadomości: przełącznik segmentowy (bez schematu)

- [x] **T-1** — Wspólny `src/components/ui/nav/PrzelacznikSegmentowy.tsx`: pozycje
      `{ id, etykieta, licznik, wylaczona? }`, `wybrana`, `onWybor`. Segment nieaktywny renderowany
      jako `<button disabled aria-disabled>` (nie pomijany). Kolory wyłącznie ze zmiennych CSS,
      teksty przez `t()`.
      *Gotowe, gdy:* komponent istnieje, jest typowany, `tsc` czysto; **wpięcie w T-3** (C-35 — nie
      zostawiamy go bez konsumenta).
- [x] **T-2** — `NaglowekSekcji` w `src/modules/news/ui/sekcjeTematow.tsx`: opcjonalny prop
      `segmenty?: ReactNode`, który **zastępuje** grupę „tytuł + licznik". Komentarz z uzasadnieniem
      (przyklejony nagłówek nazywa to, na co patrzysz; przy trzech siostrzanych listach tą nazwą jest
      przełącznik) + dlaczego tutaj, a nie obok (`top: var(--news-pasek-h)` i wysokość zasłony).
      *Gotowe, gdy:* wywołania bez `segmenty` zachowują się identycznie jak dziś.
- [x] **T-3** — `src/modules/news/ui/HotTopics.tsx`: dwa boole `showHidden`/`showMonitorowane` → jeden
      stan `lista: "proponowane" | "monitorowane" | "odrzucone"`; `MenuProponowanych` **skasowane**
      w całości wraz z osieroconymi importami; treść (karty, listy, `AiContentMeta`) renderowana wg
      `lista`, bez zmian w `add`/`hide`/`unhide`/`przestanMonitorowac`.
      *Gotowe, gdy:* `grep -n "MoreVertical\|MenuProponowanych" HotTopics.tsx` nie zwraca nic,
      a każda z trzech list jest osiągalna jednym kliknięciem. **(AC-1, AC-2, AC-3, AC-4)**
- [x] **T-4** — Teksty fazy A do `messages/pl.json` (namespace `components.ui.nav.PrzelacznikSegmentowy`;
      w `modules.news.HotTopics` reużyj istniejących `proponowane`/`monitorowane`/`odrzucone`, usuń
      osierocone `wiecejDzialan`, jeśli nikt go już nie woła).
      *Gotowe, gdy:* `npm run check:i18n` przechodzi. **(AC-24)**
- [ ] **T-5** — Pomiar AC-5: wysokość przyklejonego `NaglowekSekcji` przy 360 px przed i po zmianie;
      zapisz obie liczby w notatkach na dole tego pliku (wejście dla `/verify`). **(AC-5)**

## Faza B — Zadania: filtr tagów o stałej wysokości (bez schematu) `[P]` względem fazy A

- [x] **T-6** — `src/modules/tasks/ui/FiltrTagow.tsx` wzorowany 1:1 na `SourceFilter` (083): przycisk
      `py-3` z ikoną i etykietą „Wszystkie" / „3 z 18" + `AnchoredLayer` (`side="dol"`, `align="start"`,
      `width={300}`) z polem wyszukiwania, pozycją „Wszystkie tagi" i listą `TaskTagBadge`.
      Pusty wybór = wszystkie. Plik mieszka **w module** (jedyny konsument — C-36).
      *Gotowe, gdy:* panel filtruje po frazie i pozwala na wielokrotny wybór. **(AC-7, AC-9)**
- [x] **T-7** — Chipy wybranych tagów obok przycisku: `TaskTagBadge` + „×" zdejmujące **jeden** tag;
      rząd o stałej wysokości z `overflow-x-auto`.
      *Gotowe, gdy:* przy 3 z 18 widać trzy chipy i „×" działa pojedynczo. **(AC-8)**
- [x] **T-8** — `src/modules/tasks/ui/TaskFilters.tsx`: blok `allTags.map(...)` → `<FiltrTagow>`;
      `onTagToggle` i semantyka AND w `TasksPage` **nietknięte**. Przy okazji `color: isActive ? "#fff"`
      w liczniku zakładki statusu → `var(--on-accent)`.
      *Gotowe, gdy:* `grep -n '#fff' TaskFilters.tsx` nic nie zwraca, a filtrowanie daje ten sam wynik
      co przed zmianą. **(AC-6, AC-10)**
- [x] **T-9** — Teksty fazy B do `messages/pl.json` (`modules.tasks.FiltrTagow`).
      *Gotowe, gdy:* `npm run check:i18n` przechodzi. **(AC-24)**
- [ ] **T-10** — Pomiar AC-6: wysokość paska filtrów przy 3 i 18 tagach — obie liczby do notatek.
      **(AC-6)**

## Faza C — Fundament danych dla ręki

- [x] **T-11** — Migracja `prisma/migrations/0260_reka_dominujaca/migration.sql`:
      `ALTER TABLE "UserMenuPref" ADD COLUMN IF NOT EXISTS "handedness" TEXT NOT NULL DEFAULT 'right';`
      — i **nic więcej** (`grep -E "^(DROP|ALTER TABLE .* DROP)"` pusty, C-15).
      *Gotowe, gdy:* `npm run check:migrations` przechodzi.
- [x] **T-12** — `prisma/schema.prisma`: `handedness String @default("right")` w `UserMenuPref`
      (**bez enuma** — C-12); `npx prisma migrate deploy` na lokalnym Postgresie + `prisma generate`.
      *Gotowe, gdy:* `npm run check:schema-drift` przechodzi.
- [x] **T-13** — `src/lib/modules.tsx`: `export type Reka = "right" | "left"`, `MenuPrefs.handedness`,
      `defaultMenuPrefs()` zwraca `"right"`.
- [x] **T-14** — `src/actions/menuPrefs.ts`: odczyt `handedness` z rzutowaniem na `Reka` i zejściem do
      `"right"` przy nieznanej wartości (kolumna jest `String` — walidacja należy do kodu); zapis
      w `updateMenuPrefs`; sprawdź, czy `revalidatePath` obejmuje całą powłokę, a nie tylko ustawienia
      — ręka zmienia chrom na każdej stronie.
      *Gotowe, gdy:* zapis i odczyt działają, `revalidatePath` na miejscu (C-20).
- [x] **T-15** — `src/components/settings/MenuPrefsEditor.tsx`: dwustanowy przełącznik „Dominująca
      ręka: Prawa / Lewa" z `aria-pressed`, zapis wzorcem `persistTabBar` + `router.refresh()`;
      teksty do `messages/pl.json`.
      *Gotowe, gdy:* wybór przeżywa przeładowanie strony. **(AC-11)**
- [x] **T-16** — `src/app/layout.tsx`: `data-reka={menuPrefs.handedness}` na `<html>` (tam, gdzie
      nakładane są inline tokeny skórki) — kanał dla lustrzenia czysto CSS-owego, bez FOUC.

## Faza D — Pasek kciuka i wachlarz (dotyka każdej trasy)

- [x] **T-17** — `src/components/shell/PasekKciuka.tsx`: układ `[poz][poz] [✨] [poz][poz]`, magiczna
      ikona **na środku**, 52 px, okrągła, `translateY(-14px)` z pierścieniem `var(--bg-base)`, klik →
      `openAssistant()` z `@/platform/ai/assistantBus`. Kolejność pozycji lustrzana wg ręki; pozycje
      po stronie dominującej szersze (`flex-grow` 1.35 vs 1) i z większą ikoną — ale **każda**
      z `min-height: 44px` / `min-width: 44px`. `env(safe-area-inset-bottom)` zachowane.
      *Gotowe, gdy:* pomiar `getBoundingClientRect()` każdej pozycji daje ≥ 44×44.
      **(AC-13, AC-14)**
- [x] **T-18** — `src/components/shell/WachlarzNawigacji.tsx`: gest na gołym `PointerEvent` —
      `pointerdown` + `setPointerCapture` + timer 350 ms → wachlarz; `pointermove` podświetla
      **najbliższą** podpowiedź (odległość od środka, nie `elementFromPoint`); `pointerup` na
      podświetlonej → `router.push`, poza → zamknięcie bez nawigacji; `Escape` zamyka; ruch powyżej
      progu przed 350 ms anuluje timer (żeby gest nie kradł przewijania). `touch-action: none`
      i `user-select: none` **tylko** na pozycjach; `onContextMenu` → `preventDefault`.
      Portal do `body`, warstwa **9994**. `prefers-reduced-motion` → `transition: none`.
      *Gotowe, gdy:* gest działa dotykiem i myszą, a zwykłe przewijanie palcem startującym na pasku
      nadal przewija. **(AC-15, AC-16, AC-18)**
- [x] **T-19** — Zawartość wachlarza: poziom 1 = `resolveMenu(userPermissions, prefs).enabled` (już
      po uprawnieniach), rozłożone na łuku ~120 px wychylonym w stronę dominującej ręki, drugi
      pierścień powyżej 8 pozycji; poziom 2 = ulubione widoki tego modułu (`favoriteViews`
      przefiltrowane po prefiksie ścieżki **i** przez `filterAccessibleFavorites`), otwierane po
      zatrzymaniu palca ~400 ms bez puszczania. Moduł bez zapisanych widoków = liść.
      **Żadnej nowej listy modułów** — `MobileModuleSubNav` zostaje nietknięty (C-36).
      *Gotowe, gdy:* wachlarz pokazuje wyłącznie moduły dostępne dla roli. **(AC-15)**
- [x] **T-20** — `src/components/shell/AppShell.tsx`: inline `<nav>` dolnego paska → `<PasekKciuka>`;
      powłoka owinięta dostawcą `<WachlarzNawigacji>` (**nie** `dynamic(ssr:false)` — patrz korekta
      w planie §9: to dostawca kontekstu opakowujący `children`, więc `ssr:false` wyłączyłby
      renderowanie serwerowe całej aplikacji); przekazanie `reka` do
      `FeedbackInspector` i `AICommandSheet`; `<main>` `pb-14` → `pb-16`.
      *Gotowe, gdy:* przewinięta do końca długa lista zadań pokazuje ostatni wiersz w całości.
      **(AC-19)**
- [x] **T-21** — Krótkie tapnięcie bez regresji: brak przekroczenia progu czasu → `router.push` na
      adres pozycji (nawigacja **imperatywna**, bo `setPointerCapture` zmienia cel `pointerup`, więc
      nie liczymy na klik w `<a>`).
      *Gotowe, gdy:* pojedyncze tapnięcie w pozycję nadal nawiguje. **(AC-17)**
- [x] **T-22** — `src/components/assistant/AICommandSheet.tsx`: FAB widoczny wyłącznie od `md:`
      (poniżej jego rolę przejmuje środek paska); przy ręce `left` pozycjonowany
      `left: calc(var(--sidebar-width) + 1.25rem)` zamiast `right-5`, żeby nie wjechał pod panel
      boczny. Reszta komponentu bez zmian.
      *Gotowe, gdy:* na telefonie nie ma drugiego przycisku asystenta. **(AC-13, AC-20)**
- [x] **T-23** `[P]` — `src/components/shell/FeedbackInspector.tsx`: strona robaczka wg ręki tą samą
      regułą; istniejące piętrowanie `z-index` i wariant „nad modalem" zachowane. **(AC-12)**
- [x] **T-24** `[P]` — `src/components/shell/ModuleSidebar.tsx`: rząd chromu konta (gwiazdka, tryb
      admina, dzwonek) wg ręki — czystym CSS-em przez `html[data-reka="left"]`; pozycje nawigacji
      podpięte pod ten sam gest przytrzymania co pasek. **(AC-12, AC-21, AC-22)**
- [x] **T-25** — Teksty fazy D do `messages/pl.json` (`components.shell.PasekKciuka`,
      `components.shell.WachlarzNawigacji`).
      *Gotowe, gdy:* `npm run check:i18n` przechodzi. **(AC-24)**

## Faza E — Bramki i domknięcie

- [ ] **T-26** — Bramki wybiórczo, przed pełnym buildem: `check:migrations`, `check:schema-drift`,
      `check:i18n`, `check:ui-contract`, `check:client-safe`, `check:logs`, `check:tailwind`,
      `check:owner-columns`.
- [ ] **T-27** — `next lint` + `tsc --noEmit -p tsconfig.test.json` + `next build` na **lokalnym**
      Postgresie (C-13 — `scripts/migrate.js` NIE odpalamy). **(AC-23)**
- [ ] **T-28** — `npm run check:perf`. Nowe komponenty powłoki wchodzą do bundla każdej trasy, więc
      to bramka z realnym ryzykiem. Przy pęknięciu pasma ±5 % — sprawdź najpierw, czy nie wjechała
      żadna nowa zależność; podniesienie progu tylko świadomie i w osobnym commicie z uzasadnieniem.
- [ ] **T-29** — Aktualizacja `CLAUDE.md`: opis chromu (dolny pasek, stałe miejsce magicznej ikony,
      ustawienie ręki, wachlarz nawigacji) — obecny opis przestaje być prawdziwy.
- [ ] **T-30** — Wpis do `doświadczenia.md` (C-51) o nieoczywistym problemie z tego przebiegu —
      najpewniej gest kontra przewijanie albo `setPointerCapture` kontra `<a>`.
- [ ] **T-31** — Mapowanie AC → dowód (wejście dla `/verify`), z liczbami z T-5, T-10 i T-17.

---

## Mapowanie kryteriów akceptacji → zadania

| AC | Zadanie(a) |
|----|-----------|
| AC-1, AC-2, AC-3, AC-4 | T-1, T-2, T-3 |
| AC-5 | T-2, T-5 |
| AC-6 | T-8, T-10 |
| AC-7, AC-9 | T-6 |
| AC-8 | T-7 |
| AC-10 | T-8 |
| AC-11 | T-13, T-14, T-15 |
| AC-12 | T-16, T-23, T-24 |
| AC-13 | T-17, T-22 |
| AC-14 | T-17 |
| AC-15 | T-18, T-19 |
| AC-16, AC-18 | T-18 |
| AC-17 | T-21 |
| AC-19 | T-20 |
| AC-20 | T-22 |
| AC-21, AC-22 | T-24 |
| AC-23 | T-26, T-27, T-28 |
| AC-24 | T-4, T-9, T-25 |

Żaden AC nie został bez pokrycia.

## Ścieżka krytyczna

```
T-11 → T-12 → T-13 → T-14 ─┬→ T-15
                           └→ T-16 → T-17 → T-18 → T-19 → T-20 → T-21 → T-22
                                                                          ↓
Faza A (T-1→T-5) ─┐                                          T-23, T-24 [P]
Faza B (T-6→T-10) ┴──────────────────────────────────────────→ T-25 → T-26 → T-27 → T-28 → T-29..31
```

- **Fazy A i B są całkowicie niezależne** od siebie i od reszty — nie ruszają schematu ani powłoki.
- **T-13 blokuje wszystko w fazie D**: bez typu `Reka` w `MenuPrefs` powłoka nie ma czego czytać.
- **T-17 blokuje T-18/T-19**: wachlarz montuje się z pozycji paska.
- **T-28 (`check:perf`) jest ostatnią realną bramką ryzyka** — dopiero po `next build` jest co mierzyć.

## Notatki / blokady

- *(pomiary AC-5, AC-6 i AC-14 wpisujemy tutaj w trakcie `/implement`)*
