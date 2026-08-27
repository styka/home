# Plan techniczny: Profesjonalny system przewodników użytkownika (pierwszy: Notatki)

- **Spec:** ./spec.md (108-system-przewodnikow)
- **Status:** draft
- **Data:** 2026-08-27

> **Zasada planu:** to jest **JAK**. Plan pisze się pod istniejący kod — najpierw czytamy sąsiedni
> moduł i naśladujemy jego wzorzec (C-53), potem projektujemy.

## 1. Podejście

Wzorcem jest **książka audytu** (`/admin/audyt`): treść żyje jako markdown w `content/`, skrypt
`scripts/copy-*.js` piecze ją do `src/generated/*.ts` na starcie `npm run build`, a strona renderuje
ją przez `markdownToHtml`. Powielamy dokładnie ten łańcuch dla przewodników użytkownika — z jedną
świadomą różnicą: **nie reużywamy `AudytBookReader`**. Ten komponent (638 linii) jest ściśle
związany z semantyką książki administracyjnej (status rozdziału `done|draft|planned`, licznik słów,
data audytu, „kopiuj jako prompt dla Claude Code") i renderuje **jeden rozdział na trasę**.
Przewodnik użytkownika to inny produkt: jeden dokument z kotwicami, spisem treści śledzącym pozycję
i wyszukiwarką. Nakładka na tamten komponent (C-35) kosztowałaby więcej niż mniejszy, własny czytnik
i wciągnęłaby admin-semantykę do widoku użytkownika. Reużywamy natomiast to, co naprawdę wspólne:
`markdownToHtml` + `MARKDOWN_STYLES` (`src/lib/markdown.ts`), ramę `ModuleView` i zmienne motywu.

Dział mieszka pod istniejącym `/guide` (spec §8): hub z kafelkami wszystkich modułów +
`/guide/[slug]` jako czytnik jednego przewodnika. Dotychczasowa treść `/guide` (przykłady komend
asystenta) przenosi się do markdownu jako przewodnik „Asystent AI" — dzięki temu hub od pierwszego
dnia ma **dwa** wpisy, a nie jeden i dwadzieścia zapowiedzi.

Wejście z modułu to **poszerzenie kontraktu widoku** o slot `help` — dokładnie tak, jak 087 dołożyło
slot `settings` (C-33). Notatki są pierwszym i jedynym konsumentem (C-35: komponent dowozimy razem
z konsumentem).

## 2. Model danych (Prisma)

**Bez zmian w schemacie. Bez migracji.** Feature nie tworzy danych użytkownika — treść jest
dokumentem w repozytorium, wersjonowanym gitem. C-10..C-14 nie mają tu zastosowania i to jest
świadome: przewodnik trzymany w bazie wymagałby migracji seedującej wielotysięczny markdown,
a jego historia przestałaby być widoczna w diffie.

`npm run next:migration` **nie jest uruchamiany** — nie ma czego numerować.

## 3. Warstwa serwera (Server Actions — C-20)

**Bez nowych Server Actions.** Nie ma mutacji: przewodnik jest tylko czytany, a jego źródło to
statyczny moduł wygenerowany w czasie builda. Nie ma więc `revalidatePath`, guardów własności ani
`ownerId`/`ownerTeamId` (C-21 nie dotyczy — brak zasobu użytkownika).

Trasy są serwerowe i czytają wyłącznie sesję (`auth()`), żeby:
- odrzucić niezalogowanego (konwencja: wszystko poza `/auth/signin` wymaga sesji),
- policzyć, do których modułów użytkownik ma uprawnienie (AC-12).

### Źródło treści — kontrakt wygenerowanego modułu

`content/przewodniki/manifest.json`:

```jsonc
{
  "przewodniki": [
    {
      "slug": "notatki",
      "moduleId": "notes",          // null dla przewodników niemodułowych
      "title": "Notatki",
      "subtitle": "Wszystko, co potrafi moduł notatek",
      "summary": "…jedno zdanie na kafelek…",
      "rozdzialy": [
        { "slug": "01-czym-sa-notatki", "title": "Czym są notatki w Omnii", "summary": "…" }
      ]
    },
    { "slug": "asystent", "moduleId": null, "title": "Asystent AI", "…": "…" }
  ]
}
```

`scripts/copy-przewodniki.js` → `src/generated/przewodniki.ts`:

```ts
export interface RozdzialPrzewodnika { slug: string; title: string; summary: string; markdown: string; tekst: string }
export interface Przewodnik { slug: string; moduleId: string | null; title: string; subtitle: string;
  summary: string; rozdzialy: RozdzialPrzewodnika[]; updatedAt: string | null; words: number }
export const PRZEWODNIKI: Przewodnik[]
export const PRZEWODNIKI_GENERATED_AT: string
```

- `tekst` = markdown pozbawiony składni (do wyszukiwania) — liczony **w czasie builda**, żeby
  przeglądarka nie parsowała markdownu tylko po to, by w nim szukać.
- `updatedAt` = `mtime` najnowszego pliku rozdziału (spec §9: rozjazd ma być widoczny).
- Rozdział bez pliku albo z pustym plikiem = **błąd builda** (inaczej brak rozdziału objawiałby się
  dziurą w spisie treści, a nie komunikatem). To różnica wobec `copy-audyt.js`, gdzie brak pliku jest
  legalnym stanem „rozdział zaplanowany" — tam książka rośnie w czasie, tu przewodnik albo jest
  kompletny, albo go nie ma.
- Wygenerowany plik **jest commitowany** (konwencja `copy-audyt.js`: `npm run dev` na świeżym klonie).

`src/lib/przewodniki.ts` — cienka warstwa odpytywania (bez Reacta, bez Prismy):

```ts
export function wszystkiePrzewodniki(): Przewodnik[]
export function przewodnikPoSlugu(slug: string): Przewodnik | null
export function hrefPrzewodnikaModulu(moduleId: string): string | undefined  // undefined ⇒ brak ikony pomocy (AC-2)
export function szukajWPrzewodnikach(fraza: string): WynikSzukania[]         // { przewodnik, rozdzial, fragment }
```

`hrefPrzewodnikaModulu` jest **jedynym** miejscem wiążącym moduł z przewodnikiem. Kolejny moduł
włącza ikonę pomocy dopisaniem treści + jednej linii w swoim widoku — bez ruszania ramy.

## 4. RBAC / rejestr modułu (C-22)

- **Bez nowego sluga `module.*`** i bez wpisu w `MODULES`. Dział przewodników to powierzchnia
  ogólnodostępna dla zalogowanych — jak `/trash` i `/reports`. Nie dopisujemy go do rejestru modułów
  ani do `ModuleSidebar`: rejestr jest listą modułów produktu, a pomoc nim nie jest, i nowy slug
  oznaczałby uprawnienie, którego administrator nie może nikomu odebrać bez odcięcia pomocy.
- `permissions.ts` / `pathPermissions.ts` — **bez zmian**; `/guide` nie ma uprawnienia dziś i nie
  dostaje go teraz. `check:route-gating` czyta `src/modules/*`, więc trasy niemodułowej nie dotyczy.
- Hub **czyta** uprawnienia sesji (`session.user.permissions`) i przez `isPathLocked`
  (`src/lib/pathPermissions.ts`) wygasza kafelek modułu, do którego użytkownik nie ma dostępu (AC-12)
  — tą samą funkcją, której używa `ModuleSidebar`, żeby obie powierzchnie nie mogły się rozjechać.

## 5. UI (C-30, C-31, C-32)

### 5.1 Slot `help` w kontrakcie widoku (AC-1, AC-2)

`src/components/ui/view/ModuleView.tsx` + `ViewBar.tsx`:

```ts
help?: { href: string; label?: string };
```

- `ViewBar` rysuje `HelpCircle` **przed** kołem zębatym ustawień (pomoc czyta się częściej niż
  konfigurację, a ustawienia mają być ostatnie — 087). Ten sam kształt przycisku co
  `PrzyciskUstawien`: 36×36 px w pasku, `title`/`aria-label` z etykiety, `Link` (nawigacja SPA).
- **Trzy warunki widoczności trzeba poszerzyć razem** (inaczej pasek Notatek nie narysuje ikony, bo
  ten widok nie ma ani `actions`, ani `settings`):
  - `ModuleView`: `pasekMaTresc = !chromeless && (compact || !!filters || !!actions || !!settings || !!help)`
  - `ViewBar`: warunek wczesnego `return null` oraz oba warunki `(actions || settings)` sterujące
    wierszem akcji.
- Brak `help` ⇒ brak ikony. AC-2 wynika z typu, nie z gałęzi w kodzie.

### 5.2 Trasy

| Trasa | Rodzaj | Co robi |
|---|---|---|
| `src/app/guide/page.tsx` | server | sesja → uprawnienia → `PrzewodnikiHub` (kafelki + indeks wyszukiwania) |
| `src/app/guide/[slug]/page.tsx` | server | znajduje przewodnik, `markdownToHtml` per rozdział → `PrzewodnikReader`; brak sluga → `notFound()` |

Trasy są **cienkie** (C-36): sesja → uprawnienie → dane → render.

### 5.3 Komponenty (`src/components/guide/`)

**`PrzewodnikiHub.tsx`** (klient)
- Rama `ModuleView`: `icon={<BookOpen/>}`, `title="Przewodniki"`, `state="ready"`, `width="narrow"`.
- Pole wyszukiwania w `filters`; wpisanie frazy przełącza treść na **wyniki** (przewodnik → rozdział
  → fragment z podświetleniem), klik prowadzi do `/guide/<slug>#<rozdział>` (AC-6).
- Kafelki w dwóch grupach: **„Gotowe przewodniki"** i **„Wkrótce"**. Grupa „wkrótce" powstaje
  z `MODULES` minus moduły mające przewodnik — więc nowy moduł pojawia się tam **sam**, bez
  dopisywania go do drugiej listy (C-36: żadnych równoległych list).
- Kafelek modułu bez uprawnienia: wygaszony, z kłódką i wyjaśnieniem; nie jest linkiem (AC-12).
- Pusty wynik wyszukiwania → `state="empty"` z podpowiedzią (C-33: stany brzegowe tylko przez `state`).

**`PrzewodnikReader.tsx`** (klient)
- Rama `ModuleView`: `breadcrumb` „‹ Przewodniki", tytuł przewodnika, `width="narrow"`
  (kolumna czytelnicza), `state="ready"`.
- Treść: wszystkie rozdziały w jednym dokumencie, każdy w `<section id={slug}>` z nagłówkiem —
  dzięki temu `Ctrl+F` przeglądarki działa na całości, a odnośnik `#rozdzial` prowadzi wprost do
  fragmentu.
- **Spis treści**: na `lg` przyklejona kolumna boczna, poniżej — przycisk otwierający panel
  (`AnchoredLayer` już istnieje w `components/ui`; jeżeli okaże się nietrafiony, prosty panel
  z `Esc` i celami ≥44 px). Aktywny rozdział wskazuje `IntersectionObserver` (AC-5). Bez JS spis
  nadal działa — to zwykłe kotwice.
- Filtr w spisie treści (te same dane co wyszukiwarka huba, zawężone do jednego przewodnika).
- Odnośniki w treści: jeden `onClick` na kontenerze, wzorzec z `AICommandSheet.handleBubbleClick`
  (wewnętrzny `/…` → `router.push`, zewnętrzny `http(s)` → nowa karta) — AC-11.
- Stopka rozdziału: „Ostatnia aktualizacja: <data>" z `updatedAt`.
- **Zero hexów** — kolory z `var(--…)`, tekst na akcentach `var(--on-accent)` (C-30, wymusza
  `check:ui-contract`). Nie dokładamy własnych motywów czytania (dark/light/sepia z książki audytu):
  skórka użytkownika jest już wyborem motywu, a drugi przełącznik obok niej to dwa źródła prawdy.

**Teksty (C-32):** wszystkie etykiety interfejsu przez `useTranslations` — namespace z drogi pliku
(`components.guide.PrzewodnikiHub`, `components.guide.PrzewodnikReader`, `app.guide.page`), wpisy
w `messages/pl.json`. **Treść przewodnika NIE idzie przez `t()`** — to dokument, nie interfejs;
bramka `check:i18n` skanuje wyłącznie `.tsx` (i pomija `src/generated`), więc markdown jest poza jej
zasięgiem z definicji, a nie przez wyjątek.

### 5.4 Wejście z Ustawień (AC-4)

`src/app/settings/page.tsx`: nowa sekcja **„Pomoc i przewodniki"** tuż nad „Prywatność i dane"
(sąsiaduje z „Dokumenty prawne" — to samo miejsce psychiczne: rzeczy do przeczytania), z linkiem do
`/guide`. Wzorzec 1:1 z istniejącego linku `/legal`, tekst przez `t()`.

Istniejące odnośniki `/guide` na Stronie głównej (`src/modules/home/ui/HomePage.tsx`, 2 miejsca)
zostają bez zmian — po przebudowie prowadzą do huba.

### 5.5 Treść przewodnika po Notatkach

`content/przewodniki/notatki/*.md`, 12 rozdziałów. Zakres wynika wprost z AC-7/8/9 i musi być
**sprawdzony w kodzie**, nie napisany z pamięci (etap `/implement` czyta pliki wskazane w nawiasach):

1. `01-czym-sa-notatki` — po co, gdzie ich szukać, pierwsza notatka, pasek szybkiej notatki
   (`QuickNoteBar.tsx`), widoki `/notes`, `/notes/all`, `/notes/groups`, `/notes/tags`.
2. `02-pisanie-markdown` — edytor z podglądem na żywo; **co dokładnie działa** (`src/lib/markdown.ts`:
   nagłówki, tabele, listy zagnieżdżone, cytaty, kod, obrazki http(s)) i **co nie** (surowy HTML jest
   ekranowany — corner case).
3. `03-porzadek` — folder (`NoteGroup`) vs tag (`Tag`), przypinanie (`toggleNotePin`), lista/siatka,
   filtry, licznik „widoczne / wszystkie".
4. `04-wikilinki` — `[[Tytuł]]`, odnośniki zwrotne (`lib/wikilinks.ts`), link do nieistniejącej
   notatki, **wielkość liter nie ma znaczenia**, **dwie notatki o tym samym tytule → trafia pierwsza**,
   zmiana tytułu zrywa istniejące linki (AC-8).
5. `05-szukanie` — wyszukiwanie ważone (`lib/searchRank.ts`, `pg_trgm`), „Pytaj AI" (`NotesQA.tsx`).
6. `06-zalaczniki-i-wersje` — `NoteAttachment`, `NoteRevision`, przywracanie wersji
   (`getNoteRevisions`/`restoreNoteRevision`), Dysk Google jako miejsce plików.
7. `07-wspolpraca` — udostępnianie notatki (`modules/notes/sharing.ts`, `ShareDialog`), role
   viewer/editor, notatki zespołu, `/udostepnione`; co widzi osoba obdarowana (AC-8).
8. `08-asystent-ai` — tworzenie/edycja notatek głosem i czatem (`modules/notes/ai/*`), co asystent
   umie odczytać.
9. `09-kosz` — usuwanie do `/trash`, retencja, co dzieje się z odnośnikami do usuniętej notatki (AC-8).
10. `10-skroty` — `j/k`, `e`, `d`, `a/n`, `/`, `Esc`, `Ctrl+K`; zachowanie na telefonie.
11. `11-pomysly` — **≥10 zastosowań** (AC-9), od „hasło do wifi" i listy prezentów po dziennik decyzji
    z wikilinkami, notatki-osoby jako lekki CRM spięty z Kontaktami, dziennik projektu linkowany
    z Zadaniami, baza przepisów-notatek obok Kuchni, „notatka-koncentrator" jako spis treści przez
    odnośniki zwrotne.
12. `12-pytania` — FAQ zbierające pozostałe zachowania brzegowe.

`content/przewodniki/asystent/*.md` — przeniesiona treść dzisiejszej strony `/guide`
(4 kategorie przykładów komend), 1 rozdział.

## 6. AI / integracje

**Nie dotyczy.** Bez nowej `AIAction` (więc `check:actions` nie ma czego sprawdzać), bez read-toola,
bez wpięcia w kalendarz, powiadomienia i kosz. C-23 i C-40 nie są w tym feature ruszane.

## 7. Pliki do utworzenia / zmiany

| Plik | Akcja | Po co |
|------|-------|-------|
| `content/przewodniki/manifest.json` | nowy | rejestr przewodników i ich rozdziałów |
| `content/przewodniki/notatki/*.md` (12) | nowe | treść przewodnika po Notatkach |
| `content/przewodniki/asystent/*.md` (1) | nowy | przeniesiona treść dzisiejszego `/guide` |
| `scripts/copy-przewodniki.js` | nowy | pieczenie treści → `src/generated/przewodniki.ts` |
| `src/generated/przewodniki.ts` | nowy (generowany, commitowany) | źródło dla stron |
| `src/lib/przewodniki.ts` | nowy | odpytywanie: lista, po slugu, po module, wyszukiwanie |
| `src/components/guide/PrzewodnikiHub.tsx` | nowy | hub: kafelki + wyszukiwarka |
| `src/components/guide/PrzewodnikReader.tsx` | nowy | czytnik: spis treści, kotwice, SPA-linki |
| `src/app/guide/page.tsx` | przepisany | hub zamiast statycznej strony przykładów |
| `src/app/guide/[slug]/page.tsx` | nowy | czytnik jednego przewodnika |
| `src/components/ui/view/ModuleView.tsx` | edycja | prop `help` + warunek `pasekMaTresc` |
| `src/components/ui/view/ViewBar.tsx` | edycja | rysowanie ikony pomocy + trzy warunki widoczności |
| `src/modules/notes/ui/NotesPage.tsx` | edycja | `help={…}` z `hrefPrzewodnikaModulu("notes")` |
| `src/app/settings/page.tsx` | edycja | sekcja „Pomoc i przewodniki" → `/guide` |
| `messages/pl.json` | edycja | teksty interfejsu działu |
| `package.json` | edycja | `copy-przewodniki.js` w `build` (za `copy-docs.js`) |
| `src/lib/ui/view-contract.json` | edycja | uaktualniony powód wyjątku dla `guide` |
| `src/lib/ui/perf-baseline.json` | edycja *(warunkowo)* | nowe trasy podnoszą sumę bajtów — patrz §8 |
| `doświadczenia.md` | edycja *(warunkowo)* | wpis, jeśli po drodze wyjdzie nieoczywisty problem (C-51) |

## 8. Bramki i weryfikacja (C-50)

Lokalnie: Postgres z obrazu (`pg_ctlcluster 16 main start`), `.env.local` na `127.0.0.1:5432`,
`npx prisma migrate deploy`. **Nigdy prod `DATABASE_URL`** (C-13) — weryfikujemy **do kroku
`next build`**, bez `scripts/migrate.js`.

Kolejność: `node scripts/copy-przewodniki.js` → `npm run check:ui-contract` → `npm run check:i18n` →
`npm run check:tailwind` → `tsc --noEmit -p tsconfig.test.json` → `next lint --dir src` →
`next build` → `npm run check:perf`.

**Budżet wydajnościowy.** Dwie nowe trasy podnoszą `sumaB` w `src/lib/ui/perf-baseline.json`.
Pasmo to ±5 %, więc wzrost może się w nim zmieścić albo nie — decyduje pomiar, nie założenie. Jeśli
wypadnie poza pasmo: aktualizujemy próg i **dopisujemy notatkę `_zmiana_108`** z powodem (tak jak
`_zmiana_080`/`_zmiana_107`), bo próg podniesiony bez śladu przestaje być budżetem. Jeśli
`najciezszaTrasaB` urośnie — to sygnał, że treść trafiła do paczki najcięższej trasy i wtedy
przenosimy indeks wyszukiwania na serwer, zamiast podnosić próg.

### Mapowanie AC → sposób weryfikacji

| AC | Jak sprawdzamy |
|---|---|
| AC-1 | `/notes` → ikona pomocy w pasku → ląduje na `/guide/notatki` |
| AC-2 | dowolny inny moduł (np. `/habits`) → w pasku **nie ma** ikony pomocy; `hrefPrzewodnikaModulu("habits") === undefined` (test jednostkowy) |
| AC-3 | `/guide` → kafelki „gotowe" (Notatki, Asystent) i „wkrótce" (reszta `MODULES`); klik w gotowy otwiera treść |
| AC-4 | `/settings` → sekcja „Pomoc i przewodniki" → link prowadzi do `/guide` |
| AC-5 | klik w pozycję spisu treści → przewinięcie do sekcji; przewijanie ręczne → podświetlenie wędruje (`IntersectionObserver`) |
| AC-6 | `/guide`, fraza „wikilink" → wynik wskazuje rozdział `04-wikilinki`; test jednostkowy `szukajWPrzewodnikach` |
| AC-7 | lista kontrolna funkcji z §5.5 odhaczona rozdział po rozdziale w `verify.md` |
| AC-8 | pięć wymienionych zachowań brzegowych obecnych w treści (grep po frazach kluczowych) |
| AC-9 | policzone pomysły w `11-pomysly` ≥ 10 |
| AC-10 | Playwright/przeglądarka przy 360 px: brak przewijania w poziomie, spis treści dostępny z przycisku |
| AC-11 | klik w odnośnik `/notes` wewnątrz treści → nawigacja bez pełnego przeładowania |
| AC-12 | konto bez `module.notes` → kafelek Notatek wygaszony, nie jest linkiem |
| AC-13 | zielone bramki z listy powyżej |

Testy jednostkowe (`src/lib/__tests__/przewodniki.test.ts`): `hrefPrzewodnikaModulu` (jest / brak),
`szukajWPrzewodnikach` (trafienie w treści rozdziału, brak trafienia, niewrażliwość na wielkość
liter i polskie znaki).

## 9. Ryzyka techniczne i plan wycofania

- **Nowy prop w kontrakcie widoku dotyka wszystkich 21 modułów.** *Mitygacja:* prop opcjonalny,
  a zmiany w `ViewBar` sprowadzają się do dołożenia `|| !!help` w trzech warunkach — widok bez
  `help` renderuje się bajt w bajt jak dziś. Weryfikacja wzrokowa na module bez akcji (Pogoda)
  i z akcjami (Wiadomości).
- **Trzy warunki widoczności paska łatwo rozjechać.** Zapomniany warunek w `ModuleView` da ikonę
  w `ViewBar`, którego rama w ogóle nie narysuje — objaw: „ikona pomocy nie działa w Notatkach"
  bez żadnego błędu. *Mitygacja:* zmieniamy je jedną zmianą i sprawdzamy właśnie na Notatkach, bo
  ten widok nie ma ani akcji, ani ustawień (czyli jest przypadkiem granicznym).
- **Treść w paczce klienta.** Markdown przewodnika w komponencie klienckim to bajty do pobrania.
  *Mitygacja:* HTML rozdziałów powstaje **na serwerze**; do klienta idzie gotowy HTML i wyciąg
  tekstowy do wyszukiwania. Przy >10 przewodnikach indeks przenosimy na serwer (§8).
- **Przewodnik rozjedzie się z aplikacją.** *Mitygacja:* `updatedAt` z `mtime` widoczne w stopce;
  treść leży w repo, więc zmiana funkcji i opisu może jechać jednym commitem.
- **Rollback:** czysto kodowy — rewert commita. Brak migracji, brak danych do odtwarzania, brak
  zmiany schematu. To najtańszy możliwy rollback i jest to argument za trzymaniem treści w repo.

## 10. Zgodność z konstytucją — checklista

- [x] **C-10..C-14 (migracje)** — nie dotyczy, uzasadnione w §2 (brak zmian schematu, brak migracji).
- [x] **C-20** — brak mutacji, więc brak Server Actions i `revalidatePath`; uzasadnione w §3.
- [x] **C-21** — brak zasobu użytkownika, brak własności; hub czyta uprawnienia przez `isPathLocked`.
- [x] **C-22** — bez nowego sluga i bez wpisu w rejestrze modułów; uzasadnione w §4.
- [x] **C-23 / C-40** — nie dotyczy (§6).
- [x] **C-24 / C-25** — nie dotyczy (nie ma czego usuwać ani audytować).
- [x] **C-30** — wyłącznie zmienne CSS; brak własnego przełącznika motywu czytania (§5.3).
- [x] **C-31** — spis treści ma wariant mobilny, cele dotyku ≥44 px, `Esc` zamyka panel.
- [x] **C-32** — etykiety przez `t()` w `messages/pl.json`; granica „interfejs vs dokument" nazwana.
- [x] **C-33** — oba widoki przez `ModuleView` ze `state`; wejście z modułu jako **poszerzenie ramy**,
      nie wyjątek w Notatkach.
- [x] **C-35** — slot `help` dowieziony razem z pierwszym konsumentem (Notatki).
- [x] **C-36** — trasy cienkie; `src/lib/przewodniki.ts` nie sięga do wnętrza żadnego modułu; grupa
      „wkrótce" liczona z `MODULES`, więc nie powstaje żadna równoległa lista modułów.
- [x] **C-50** — definicja „gotowe" i kolejność bramek w §8; `check:perf` z jawną decyzją o progu.
- [x] **C-51** — wpis do `doświadczenia.md`, jeśli po drodze wyjdzie nieoczywisty problem.
- [x] **C-53** — brak nowych zależności; reużyte `markdownToHtml`, `MARKDOWN_STYLES`, `ModuleView`;
      świadoma decyzja **przeciw** reużyciu `AudytBookReader` uzasadniona w §1.
