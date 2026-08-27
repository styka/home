# Zadania: Profesjonalny system przewodników użytkownika (pierwszy: Notatki)

- **Plan:** ./plan.md (108-system-przewodnikow)
- **Status:** todo
- **Data:** 2026-08-27

> **Zasada listy zadań:** kolejność od najłatwiejszego do najtrudniejszego i zgodna z zależnościami.
> Każde zadanie jest małe, samodzielne i weryfikowalne. `[P]` = można zrównoleglić.
>
> **Uwaga o fazie 0:** ten feature **nie rusza schematu bazy** (plan §2), więc klasyczna faza
> „migracja → `schema.prisma`" nie istnieje. Jej miejsce zajmuje fundament treści: manifest, skrypt
> pieczenia i warstwa odpytywania — bo to one są tutaj „danymi", od których zależy cała reszta.

## Legenda
- `[ ]` do zrobienia · `[x]` zrobione · `[~]` w trakcie · `[!]` zablokowane (patrz notatka)
- `[P]` — niezależne od poprzedniego, można robić równolegle

---

## Faza 0 — Fundament treści (zamiast migracji)

- [x] **T-1** — `content/przewodniki/manifest.json`: rejestr dwóch przewodników (`notatki` →
  `moduleId: "notes"`, `asystent` → `moduleId: null`) z listą rozdziałów wg planu §5.5.
  *Gotowe, gdy:* plik jest poprawnym JSON-em, ma 12 rozdziałów dla Notatek i 1 dla Asystenta,
  a slugi rozdziałów są unikalne w obrębie przewodnika.

- [x] **T-2** — `scripts/copy-przewodniki.js` (wzorzec `scripts/copy-audyt-podsumowanie.js`):
  czyta manifest + pliki `.md`, liczy `tekst` (markdown bez składni, do wyszukiwania), `words`
  i `updatedAt` (`mtime`), zapisuje `src/generated/przewodniki.ts` z typami z planu §3.
  **Brak pliku rozdziału albo pusty plik = wyjście z kodem błędu** (różnica wobec książki audytu,
  gdzie brak pliku jest legalnym „zaplanowane").
  *Gotowe, gdy:* `node scripts/copy-przewodniki.js` na niepełnej treści **pada** z czytelnym
  komunikatem, a na kompletnej wypisuje podsumowanie i generuje plik.

- [x] **T-3** — Wpięcie `copy-przewodniki.js` w `build` w `package.json` (zaraz za `copy-docs.js`)
  oraz skrót `npm run copy:przewodniki`.
  *Gotowe, gdy:* `npm run copy:przewodniki` działa, a `build` zawiera krok przed bramkami.

- [x] **T-4** — `src/lib/przewodniki.ts`: `wszystkiePrzewodniki`, `przewodnikPoSlugu`,
  `hrefPrzewodnikaModulu`, `szukajWPrzewodnikach` (plan §3). Bez Reacta i bez Prismy.
  *Gotowe, gdy:* `tsc` czysto; `hrefPrzewodnikaModulu("habits")` zwraca `undefined`,
  `hrefPrzewodnikaModulu("notes")` → `/guide/notatki`.

- [x] **T-5** `[P]` — `src/lib/__tests__/przewodniki.test.ts`: przewodnik jest / brak (AC-2),
  wyszukiwanie — trafienie w treści rozdziału, brak trafienia, niewrażliwość na wielkość liter
  i polskie znaki (AC-6).
  *Gotowe, gdy:* `npm run test:unit` na tym pliku zielony.

---

## Faza 1 — Treść przewodników

> Treść jest **sprawdzana w kodzie**, nie pisana z pamięci. Każdy rozdział wymaga przeczytania
> plików wskazanych w planie §5.5 — opis funkcji, której nie ma, jest gorszy niż jej brak.

- [x] **T-6** — Rozdziały 1–3 Notatek: `01-czym-sa-notatki`, `02-pisanie-markdown`, `03-porzadek`.
  Źródła do sprawdzenia: `modules/notes/ui/{NotesPage,QuickNoteBar,NoteRow,NoteList}.tsx`,
  `src/lib/markdown.ts`, `modules/notes/actions/{notes,noteGroups}.ts`, `src/app/notes/*`.
  *Gotowe, gdy:* opisane widoki i funkcje zgadzają się z kodem, w tym corner case „surowy HTML jest
  ekranowany" (AC-8).

- [x] **T-7** — Rozdziały 4–6: `04-wikilinki`, `05-szukanie`, `06-zalaczniki-i-wersje`.
  Źródła: `modules/notes/lib/{wikilinks,searchRank}.ts`, `modules/notes/ui/NotesQA.tsx`,
  `actions/notes.ts` (`getNoteRevisions`/`restoreNoteRevision`/`*Attachment`).
  *Gotowe, gdy:* opisane są cztery zachowania brzegowe wikilinków z planu (nieistniejąca notatka,
  wielkość liter, dwie notatki o tym samym tytule → pierwsza, zmiana tytułu zrywa linki) — AC-8.

- [x] **T-8** — Rozdziały 7–10: `07-wspolpraca`, `08-asystent-ai`, `09-kosz`, `10-skroty`.
  Źródła: `modules/notes/sharing.ts`, `components/sharing/ShareDialog.tsx`,
  `platform/sharing/nadaneMi.ts`, `modules/notes/ai/*`, `src/lib/trash.ts`,
  `src/hooks/useKeyboardShortcuts.ts`.
  *Gotowe, gdy:* opisane jest, co widzi osoba obdarowana i co dzieje się z notatką po usunięciu
  oraz po upływie retencji (AC-8); komplet funkcji z AC-7 jest już wtedy pokryty.

- [x] **T-9** — Rozdziały 11–12: `11-pomysly` (**≥10 zastosowań**, od prostych po nieoczywiste,
  z wykorzystaniem wikilinków i integracji z Zadaniami/Kontaktami/Kuchnią) i `12-pytania` (FAQ
  domykające pozostałe zachowania brzegowe).
  *Gotowe, gdy:* policzone pomysły ≥ 10 (AC-9), każdy z konkretnym „jak to zrobić", a nie samą nazwą.

- [x] **T-10** `[P]` — `content/przewodniki/asystent/01-komendy.md`: przeniesiona treść dzisiejszego
  `src/app/guide/page.tsx` (4 kategorie przykładów komend) w formie markdownu.
  *Gotowe, gdy:* wszystkie przykłady z obecnej strony są w pliku — nic nie ginie (spec §5).

---

## Faza 2 — Kontrakt widoku (wejście z modułu)

- [ ] **T-11** — Slot `help` w `src/components/ui/view/ModuleView.tsx` i `ViewBar.tsx`:
  typ `help?: { href: string; label?: string }`, ikona `HelpCircle` **przed** kołem zębatym,
  kształt 1:1 z `PrzyciskUstawien`, `Link` (nawigacja SPA).
  **Trzy warunki widoczności naraz** (plan §5.1): `pasekMaTresc` w `ModuleView` oraz wczesny
  `return null` i oba `(actions || settings)` w `ViewBar`.
  *Gotowe, gdy:* widok bez `help` renderuje się bajt w bajt jak dziś (sprawdzone na Pogodzie —
  bez akcji — i Wiadomościach — z akcjami), a widok z samym `help` i bez akcji pokazuje ikonę.

- [ ] **T-12** — `src/modules/notes/ui/NotesPage.tsx`: `help={…}` z `hrefPrzewodnikaModulu("notes")`.
  *Gotowe, gdy:* `/notes` ma ikonę pomocy prowadzącą do `/guide/notatki` (AC-1), a moduł bez
  przewodnika jej nie ma (AC-2).

---

## Faza 3 — Dział przewodników

- [ ] **T-13** — `src/components/guide/PrzewodnikReader.tsx`: rama `ModuleView`
  (`breadcrumb` „‹ Przewodniki", `width="narrow"`, `state`), rozdziały jako `<section id>`,
  przyklejony spis treści na `lg` + panel na telefonie (cele ≥44 px, `Esc`), aktywny rozdział przez
  `IntersectionObserver`, filtr w spisie, przechwycone odnośniki (wzorzec
  `AICommandSheet.handleBubbleClick`), stopka z `updatedAt`.
  *Gotowe, gdy:* AC-5, AC-10, AC-11 dają się pokazać na żywo; zero hexów (C-30).

- [ ] **T-14** — `src/app/guide/[slug]/page.tsx`: sesja → `przewodnikPoSlugu` → `markdownToHtml`
  per rozdział → `PrzewodnikReader`; nieznany slug → `notFound()`.
  *Gotowe, gdy:* `/guide/notatki` renderuje treść, `/guide/nic-takiego` daje 404.

- [ ] **T-15** — `src/components/guide/PrzewodnikiHub.tsx`: rama `ModuleView`, wyszukiwarka
  w `filters` (wyniki: przewodnik → rozdział → fragment, klik → `/guide/<slug>#<rozdział>`),
  dwie grupy kafelków („Gotowe" / „Wkrótce" liczone z `MODULES` minus mające przewodnik),
  kafelek bez uprawnienia wygaszony i nieklikalny, pusty wynik przez `state="empty"`.
  *Gotowe, gdy:* AC-3, AC-6, AC-12 widoczne na żywo.

- [ ] **T-16** — `src/app/guide/page.tsx` przepisany: sesja → uprawnienia → `PrzewodnikiHub`.
  Stara statyczna treść **usunięta dopiero po** T-10 (przeniesiona do markdownu).
  *Gotowe, gdy:* `/guide` pokazuje hub, a odnośniki ze Strony głównej dalej działają.

- [ ] **T-17** `[P]` — `src/app/settings/page.tsx`: sekcja „Pomoc i przewodniki" nad „Prywatność
  i dane", link do `/guide`, wzorzec 1:1 z linkiem `/legal`, tekst przez `t()`.
  *Gotowe, gdy:* AC-4 spełnione.

- [ ] **T-18** — `messages/pl.json`: komplet tekstów interfejsu działu w namespace'ach
  `app.guide.page`, `components.guide.PrzewodnikiHub`, `components.guide.PrzewodnikReader`
  (+ klucz w `app.settings.page` dla T-17).
  *Gotowe, gdy:* `npm run check:i18n` zielone — zero literałów z polskimi znakami w nowych `.tsx`,
  a każde `t("klucz")` ma wpis.

---

## Faza 4 — Bramki i domknięcie

- [ ] **T-19** — `src/lib/ui/view-contract.json`: uaktualniony powód wyjątku dla `guide`
  (dział przewodników, nie pojedyncza strona pomocy). `npm run check:ui-contract` zielone.

- [ ] **T-20** — Bramki po kolei: `npm run copy:przewodniki`, `check:ui-contract`, `check:i18n`,
  `check:tailwind`, `tsc --noEmit -p tsconfig.test.json`, `next lint --dir src`, `next build`
  (lokalny Postgres — **nigdy prod `DATABASE_URL`**, C-13).
  *Gotowe, gdy:* wszystkie zielone; `migrate.js` **nie** jest uruchamiany.

- [ ] **T-21** — `npm run check:perf` po `next build`. Jeśli poza pasmem ±5 %: aktualizacja
  `src/lib/ui/perf-baseline.json` **z notatką `_zmiana_108`** (powód). Jeśli urosła
  `najciezszaTrasaB` — przenosimy indeks wyszukiwania na serwer zamiast podnosić próg (plan §8).
  *Gotowe, gdy:* bramka zielona, a każda zmiana progu ma uzasadnienie w pliku.

- [ ] **T-22** — Mapowanie AC-1…AC-13 na wynik (wejście do `/verify`), wg tabeli z planu §8.
  *Gotowe, gdy:* każde AC ma wskazane miejsce w kodzie/treści albo sposób pokazania na żywo.

- [ ] **T-23** — Wpis do `doświadczenia.md`, jeśli po drodze wyszedł nieoczywisty problem (C-51).
  *Gotowe, gdy:* wpis dopisany i zacommitowany razem ze zmianą — albo świadomie pominięty, bo nic
  nieoczywistego się nie wydarzyło.

---

## Mapowanie kryteriów akceptacji → zadania

| AC | Zadania |
|---|---|
| AC-1 — ikona pomocy w Notatkach prowadzi do przewodnika | T-11, T-12 |
| AC-2 — moduł bez przewodnika nie ma ikony | T-4, T-5, T-11, T-12 |
| AC-3 — dział z kafelkami „gotowe"/„wkrótce" | T-15, T-16 |
| AC-4 — wejście z Ustawień | T-17 |
| AC-5 — spis treści + wskazanie bieżącego rozdziału | T-13 |
| AC-6 — wyszukiwanie w treści wskazuje rozdział | T-4, T-5, T-15 |
| AC-7 — komplet funkcji Notatek opisany | T-6, T-7, T-8 |
| AC-8 — zachowania brzegowe (≥5) | T-6, T-7, T-8, T-9 |
| AC-9 — ≥10 pomysłów na zastosowania | T-9 |
| AC-10 — czytelność przy 360 px | T-13 |
| AC-11 — odnośniki wewnętrzne bez przeładowania | T-13 |
| AC-12 — moduł bez uprawnienia nie jest podsuwany | T-15 |
| AC-13 — bramki zielone | T-19, T-20, T-21 |

## Ścieżka krytyczna

`T-1 → T-2 → T-4` (manifest → skrypt → warstwa odpytywania) blokuje **wszystko** poniżej: bez
wygenerowanego `src/generated/przewodniki.ts` nie skompiluje się ani `hrefPrzewodnikaModulu`
(T-12), ani czytnik (T-13/T-14), ani hub (T-15/T-16).
Treść (T-6…T-10) blokuje T-2 w tym sensie, że skrypt **pada** na brakującym rozdziale — dlatego
manifest powstaje pierwszy, a skrypt uruchamiamy dopiero po dowiezieniu treści.
`T-11` blokuje `T-12`. `T-13` blokuje `T-14`; `T-15` blokuje `T-16`; `T-10` blokuje `T-16`
(stara treść znika dopiero, gdy jest już przeniesiona).
Równoległe: `T-5` (testy), `T-10` (treść Asystenta), `T-17` (Ustawienia).

## Notatki / blokady
- Brak.
