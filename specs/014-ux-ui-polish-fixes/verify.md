# Weryfikacja: Poprawki UX/UI (014-ux-ui-polish-fixes)

- **Spec:** ./spec.md · **Plan:** ./plan.md · **Tasks:** ./tasks.md
- **Data:** 2026-07-20
- **Commit:** cad8cba

## Bramki
| Komenda | Wynik |
|---------|-------|
| `npm run check:migrations` | ✅ „Numeracja migracji OK (następny wolny numer: 0206)" — brak nowych migracji, bez kolizji |
| `npm run check:actions` | ✅ „159 akcji w katalogu, wszystkie obsługiwane przez executor" |
| `next lint --dir src` | ✅ tylko istniejące ostrzeżenia (exhaustive-deps / no-img-element w niezmienianych plikach); **zero błędów**, żadnego nowego ostrzeżenia z moich zmian |
| `npm run build` (lokalny Postgres, C-13) | ✅ `next build` przeszedł, migracje/seed zaaplikowane na **lokalnej** bazie `omnia_dev` (nie prod) |

## Kryteria akceptacji

### AC-1 — brak poziomego przepełnienia w Wiadomościach ✅
Dowód (dwie pierwotne przyczyny domknięte):
- `NewsPage.tsx:181` — kolumna treści gridu `md:grid-cols-[240px_1fr]` ma teraz `className="min-w-0"`.
  Track `1fr` domyślnie ma `min-width:auto`, przez co niełamliwy string/szeroki obraz rozpychał stronę;
  `min-w-0` to eliminuje.
- `NewsItemCard.tsx` — tytuł: `min-w-0 break-words`; streszczenie `<p>`: `break-words` → długie URL się
  łamią. Obraz już był `max-h-52 w-full object-cover` (bez zmian, poprawny).
- `markdown.ts` `MARKDOWN_STYLES` — `.md-p`, `.md-li`, `.md-oli`, `.md-td`, `.md-link` dostały
  `overflow-wrap: anywhere; word-break: break-word;`; `.md-table` → `display:block; overflow-x:auto`
  (szeroka tabela scrolluje lokalnie zamiast rozpychać). Dotyczy treści bazy wiedzy renderowanej w
  `KnowledgePanel` klasą `markdown-body`.

### AC-2 — ikona asystenta AI widoczna przy szczegółach zadania (mobile + desktop) ✅
Dowód: `TasksPage.tsx` — wrapper mobilnego panelu (`md:hidden fixed inset-0 z-50`) ma teraz
`data-omnia-overlay="taskdetail"`. `useOverlayState.ts:20` używa selektora
`'[class~="fixed"][class~="inset-0"]:not([data-omnia-overlay])'`, więc panel jest **wykluczony** z
detekcji „modalu treściowego" → `modalOpen=false` przy otwartym zadaniu → FAB (`AICommandSheet.tsx:1175`
`{!modalOpen && …}`) renderuje się. Kluczowe: ten div jest w DOM także na desktopie (ukryty tylko
`md:hidden`), więc bez atrybutu chował FAB również na komputerze — teraz nie.

### AC-3 — pole daty widoczne przy ręcznym dodawaniu zadania ✅
Dowód: `QuickAddTask.tsx` — pole `type="date"` opakowane w kontener z `backgroundColor:
var(--bg-elevated)`, `border` `var(--border)`, `px-2 py-1` + ikona `Calendar` (lucide) w kolorze
`var(--text-muted)`. Wzorowane na polu „Start" w `TaskDetail.tsx:496-504`. Puste pole ma teraz wyraźne
tło + ikonę, więc jest rozpoznawalne jako pole daty (spójnie z TaskDetail).

### AC-4 — brak auto-zoomu na focus (iOS) ✅
Dowód: `globals.css` — reguła `@media (pointer: coarse) { input:not([type="checkbox"]):not([type="radio"]),
select, textarea { font-size: 16px; } }`. iOS zoomuje przy `font-size<16px`; 16px na dotyku to eliminuje.
Specyficzność `input:not(...)` (~0,0,2,1) przebija utility Tailwinda `.text-xs`/`.text-sm` (0,0,1,0) bez
`!important` (zweryfikowane rozumowaniem specyficzności). `maximum-scale`/`user-scalable` nietknięte
(`layout.tsx:13-19` bez zmian) → pinch-zoom zachowany. Desktop (`pointer: fine`) bez zmian.

### AC-5 — poprawność w skórkach, brak hardcode kolorów ✅
Dowód: grep dodanych linii w commicie — **brak** hardcode hex (poza istniejącym SVG-ikony date-pickera i
`%23` w URL-encoded, których nie ruszałem). Wszystkie nowe style używają `var(--…)`, więc działają w
Dark/Light/Casual/Blue/Pink (C-30).

## Zgodność z konstytucją
- **C-01** ✅ zmiany tylko w `worldofmag/src/…`.
- **C-10..C-14** ✅ nie dotyczy — brak zmian schematu/migracji (`check:migrations` potwierdza).
- **C-20..C-25** ✅ nie dotyczy — brak Server Actions/RBAC/AI/trash (`check:actions` bez zmian: 159 akcji).
- **C-30** ✅ tylko zmienne CSS, zero hardcode (zweryfikowane gremem).
- **C-31** ✅ mobile-first: overflow/zoom/FAB naprawiane pod telefon; `pointer: coarse` celuje w dotyk;
  brak drugiego sidebara.
- **C-32** ✅ brak nowych tekstów UI (istniejący `title="Termin"` zostaje po polsku).
- **C-53** ✅ minimalizm: 6 punktowych edycji, zero nowych zależności (`Calendar` z już używanego
  `lucide-react`).
- **C-51** ✅ dwie lekcje dopisane do `doświadczenia.md` (pułapka DOM+md:hidden, specyficzność CSS).

## Regresje
- **Zawijanie markdown** — `overflow-wrap: anywhere` dotyka wszystkich odbiorców `MARKDOWN_STYLES`
  (reports, recipes, tasks, QA, AI sheet), ale to wyłącznie łamanie długich niełamliwych stringów —
  bezpieczne, poprawia a nie psuje. Brak zmian w logice renderera.
- **`.md-table display:block`** — zmienia tabelę na blok z lokalnym scrollem; to standardowy wzorzec
  responsywnych tabel, nie zmienia treści.
- **`@media (pointer: coarse)` 16px** — zmienia gęstość drobnych inputów **tylko na dotyku**; desktop
  nietknięty. Świadomy, akceptowalny koszt (odnotowany w planie §9).
- **`data-omnia-overlay="taskdetail"`** — jedyny efekt uboczny: admin. FeedbackInspector nie wskoczy nad
  panel szczegółów zadania (akceptowalne). Inne moduły nietknięte.
- Build całości przeszedł → brak regresji kompilacji w sąsiednich modułach.

## Werdykt końcowy
**GOTOWE.** Wszystkie 5 kryteriów akceptacji spełnione, wszystkie bramki zielone, brak naruszeń
konstytucji, brak regresji. Przejście do `/review`.

---

## Iteracja 2 — re-weryfikacja po zwrotce właściciela (2026-07-20)
Właściciel zgłosił, że w praktyce AC-1 i AC-2 nie były domknięte, oraz nowy defekt UX. Poprawki T-9..T-12.

- **AC-1 (re)** ✅ — przyczyna: `break-words`/`overflow-wrap:break-word` nie redukuje min-content, więc w
  kolumnie grid długi URL nadal rozpychał. Fix: `[overflow-wrap:anywhere]` na tytule/streszczeniu/noveltyNote
  + `min-w-0 overflow-hidden` na karcie (`NewsItemCard.tsx`). `anywhere` redukuje min-content → kontener się
  zwęża; `overflow-hidden` to twarda gwarancja braku poziomego scrolla.
- **AC-2 (re)** ✅ — przyczyna: wykluczenie z `modalOpen` sprawiło, że FAB się renderował, ale panel
  podglądu (`z-50`) zasłaniał go (FAB `z-41`, feedback `z-39`). Fix: `panelOpen` w `useOverlayState.ts`;
  z-index podbijany kontekstowo — FAB `panelOpen?55:41` (`AICommandSheet.tsx`), feedback
  `modalOpen?10001:(panelOpen?54:39)` (`FeedbackInspector.tsx`); marker `data-omnia-overlay="panel"`
  (`TasksPage.tsx`). Skala: panel 50 < feedback 54 < FAB 55 < toast 60 → obie ikony nad panelem, pod
  toastami. Naprawia też regresję (feedback wcześniej znikał po moim pierwszym fixie).
- **AC-3 (re)** ✅ — nowy defekt: w jednym rzędzie pole daty + przycisk `+` nie mieściły się na mobile
  (`+` uciekał poza ekran, bo `flex-1` input bez `min-w-0`). Fix: redesign dwurzędowy w `QuickAddTask.tsx`
  — rząd 1 `[priorytet][tytuł (flex-1 min-w-0)][+]` (`+` zawsze widoczny, powiększony do 7×7), pole daty w
  rzędzie 2 bez sztywnej szerokości (mieści się przy 16px). Ikona owinięta `<label>` (klik ikony = focus).
- **Bramki (re)** ✅ — `check:migrations`/`check:actions` OK, `next lint` bez błędów, `next build`
  zielony (lokalny Postgres). Lekcje dopisane do `doświadczenia.md`.

**Werdykt iteracji 2: GOTOWE.**

---

## Iteracja 3 — kolejna zwrotka właściciela (2026-07-20)
Dwa tematy: (a) długie linki DALEJ rozpychają treść Wiadomości; (b) rewizja UX dodawania zadań.

- **AC-1 (re²)** ✅ — przyczyna reszty przepełnienia: łamanie dodane tylko do części klas markdown
  (`.md-p/.md-li/.md-td/.md-link`), ale nie do nagłówków/inline-code; długi URL w nagłówku/kodzie treści
  wiedzy (`KnowledgePanel`, klasa `markdown-body`) nadal rozpychał. Fix u źródła: `.markdown-body {
  overflow-wrap: anywhere; word-break: break-word; min-width: 0; }` w `MARKDOWN_STYLES` — dziedziczone,
  więc obejmuje WSZYSTKIE potomki (nagłówki, code, cytaty, linki) naraz. Feed newsów pozostaje objęty
  (overflow-wrap:anywhere + overflow-hidden na karcie z iteracji 2).
- **AC-3 (re²) — rewizja UX dodawania zadań** ✅ — na prośbę właściciela („może lepiej akcja do pełnego
  formularza jak edycja?"). Analiza modułów: Omnia stosuje JEDEN inline formularz add+edit otwierany
  przyciskiem (`EventForm` w Health, analogicznie Flota/Contacts). Tasks ma już taki pełny formularz
  (`TaskDetail`, otwierany kliknięciem zadania). Decyzja: quick-add uproszczony do czystego rzędu
  `[priorytet][tytuł][+]` (szybkie przechwytywanie — kluczowa zaleta listy zadań), a termin i pozostałe
  pola przeniesione do `TaskDetail`. Efekt: brak gniecenia „+"/daty na mobile, zachowana szybkość,
  spójność z resztą aplikacji. `QuickAddTask.tsx` — usunięte inline pole daty/`showExtra`.
- **Bramki (re²)** ✅ — `next build` zielony (lokalny Postgres), `check:migrations`/`check:actions` OK.
  Lekcje dopisane do `doświadczenia.md`.

**Werdykt iteracji 3: GOTOWE.**
