# Weryfikacja: Poprawki UI na mobile — zadania + asystent AI

- **Spec:** ./spec.md (018-mobile-ui-bugs)
- **Data:** 2026-07-22
- **Weryfikujący:** Claude Code (spec-driven pipeline, etap /verify)

## Bramki techniczne
| Komenda | Wynik |
|---------|-------|
| `npm run check:migrations` | ✅ `Numeracja migracji OK (następny wolny numer: 0207)` — brak nowych migracji |
| `npm run check:actions` | ✅ `159 akcji w katalogu, wszystkie obsługiwane przez executor` |
| `next lint --dir src` | ✅ tylko wcześniej istniejące kosmetyczne warningi (unescaped-entities, exhaustive-deps, no-img-element); **zero błędów**, żadnego nowego warninga z tych zmian |
| `next build` (lokalny Postgres, C-13) | ✅ `Compiled successfully` + `Generating static pages (130/130)` |

Weryfikacja przeciw **lokalnemu** Postgresowi (`omnia_dev` na 127.0.0.1); `scripts/migrate.js`
świadomie nie uruchamiany (dotyka prod DB — C-13). Zmiany są czysto klienckie/CSS.

## Kryteria akceptacji
| AC | Werdykt | Dowód / jak sprawdzono |
|----|---------|------------------------|
| **AC-1** — pasek akcji masowych osiągalny na mobile | ✅ spełnione | `BulkActionBar.tsx:187` — główny rząd akcji ma `overflow-x-auto [&>*]:flex-shrink-0`. Na mobile pill jest `w-full` (`:88`), więc rząd 7 akcji + licznik + „X" jest przewijalny poziomo → każda akcja osiągalna. Desktop `md:w-auto` mieści się bez zmian. Popovery paneli są rodzeństwem rzędu (dziećmi `relative` pigułki, `:87-90`), a **nie** dziećmi przewijanego rzędu — `overflow-x-auto` ich nie przycina. |
| **AC-2** — brak auto-zoomu iOS na polach (w tym asystent) | ✅ spełnione | `globals.css:135` — reguła `@media (pointer: coarse){ input/select/textarea{ font-size: 16px !important } }`. `!important` w arkuszu bije deklarację inline bez `!important` (kaskada CSS), więc inline `fontSize:15` kompozytora (`AICommandSheet.tsx:1502`) i `fontSize:14` `SmartTextarea` (`SmartTextarea.tsx:195`) dają efektywnie 16px na urządzeniach dotykowych → iOS nie przybliża. Pinch-zoom nietknięty (brak `maximum-scale`/`user-scalable`). |
| **AC-3** — widoczne sortowanie „zrobionych" + stan przycisku | ✅ spełnione | `CompletedSection.tsx:34,37` — `<TaskGroup key={sortBy} defaultOpen={sortBy === "completedAt"} …>`. Przełączenie sortu (`TasksPage.tsx:578` toggluje `sortBy`) zmienia `key` → remount grupy → włączenie sortu **rozwija** sekcję z listą posortowaną po `completedAt` malejąco (`:20-26`); wyłączenie wraca do zwiniętej domyślnej. Stan aktywny przycisku (kolor `accent-blue`) istnieje w `TasksPage.tsx:580`. |
| **AC-4** — kompozytor asystenta nad kreską iOS | ✅ spełnione | `AICommandSheet.tsx:1423` — stopka kompozytora ma `paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))"` (nadpisuje dolny `py-3`). Sheet jest dolny (`items-end`, `height:85vh`, `inset-0`, `:1192/1202`), więc dolny padding odsuwa pole nad home indicator. Desktop: `inset-bottom`=0 → 0.75rem = bez zmian. |
| **AC-5** — brak regresji na desktopie | ✅ spełnione | AC-2: reguła tylko `pointer: coarse` → desktop (`pointer: fine`) zachowuje inline `fontSize:15/14` (gęstość bez zmian). AC-1: `overflow-x-auto` nieszkodliwe na `md:w-auto` (treść i tak się mieści). AC-4: `env(...)`=0 na desktopie. `next build` zielony. |

## Zgodność z konstytucją
- **C-30 (kolory przez zmienne CSS):** ✅ żaden hardcode koloru; zmiany to layout/font-size/padding.
- **C-31 (mobile-first, `safe-area-inset-bottom`):** ✅ AC-1/AC-2/AC-4 realizują wprost.
- **C-32 (teksty PL):** ✅ bez zmian tekstów; nowe komentarze po polsku.
- **C-50 (build zielony):** ✅ do `next build`.
- **C-51 (wpis do `doświadczenia.md`):** ✅ dopisany wpis 2026-07-22 (inline font-size vs reguła
  anty-zoom; zwinięta grupa maskująca sort).
- **C-53 (minimalizm):** ✅ 4 punktowe zmiany + CSS, zero nowych zależności/abstrakcji.
- **C-10..C-14 / C-20..C-25 / C-23 / C-40:** ✅ nie dotyczą (brak schematu/akcji/RBAC/AI) — zgodnie z planem.

## Regresje
- **Popovery paska akcji:** bez regresji — są rodzeństwem przewijanego rzędu (patrz AC-1), więc
  `overflow-x-auto` ich nie przycina; kotwiczą się `absolute bottom-full` do pigułki.
- **`SmartTextarea` (komponent współdzielony):** reguła coarse wymusza 16px na mobile globalnie —
  efekt pozytywny (brak zoomu wszędzie), brak zmiany funkcjonalnej; na desktopie inline 14px zostaje.
- **`!important` klamruje pola z inline `fontSize > 16` do 16px na mobile:** przegląd nie wykazał pól
  wprowadzania danych celowo większych na mobile; skutek nieszkodliwy (czytelne, brak zoomu).
- Brak zmian migracji/Server Actions/RBAC → brak wpływu na sąsiednie moduły.

## Werdykt końcowy
**GOTOWE.** Wszystkie AC-1..AC-5 spełnione z dowodem w kodzie; wszystkie bramki (`check:migrations`,
`check:actions`, `next lint`, `next build`) zielone; brak wykrytych regresji. Przejście do `/review`.
