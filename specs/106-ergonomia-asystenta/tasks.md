# Zadania: Ergonomia asystenta AI — chrom, sesje i tryb dokowania

- **Plan:** ./plan.md (106-ergonomia-asystenta)
- **Status:** zrobione (po nawrocie z recenzji)
- **Data:** 2026-08-26

> Kolejność: od najłatwiejszego do najtrudniejszego i zgodnie z zależnościami
> (dane → serwer → UI → bramki). `[P]` = niezależne od poprzedniego.

## Legenda
- `[ ]` do zrobienia · `[x]` zrobione · `[~]` w trakcie · `[!]` zablokowane (patrz notatka)
- `[P]` — można zrównoleglić

## Faza 0 — Fundament danych

- [x] **T-1** — Migracja `prisma/migrations/0267_asystent_zapisane_i_prezentacja/migration.sql`
      wg planu §2: `AiConversation.saved` (BOOLEAN NOT NULL DEFAULT false), indeks
      `AiConversation_userId_saved_updatedAt_idx`, `AssistantPref.presentation`
      (TEXT NOT NULL DEFAULT 'window'). Wszystko `IF NOT EXISTS`.
      **Gotowe, gdy:** `npm run check:migrations` zielone, a `grep -E "^(DROP|ALTER TABLE .* DROP)"`
      na nowym pliku nie zwraca nic (C-15).

- [x] **T-2** — `prisma/schema.prisma`: te same dwa pola + `@@index([userId, saved, updatedAt])`
      na `AiConversation`. Komentarze po polsku w stylu sąsiadów (dlaczego `String`, nie enum;
      dlaczego domyślna wartość odtwarza dzisiejsze zachowanie).
      **Gotowe, gdy:** `npx prisma generate` czysto **i** `npm run check:schema-drift` zielone
      na lokalnej bazie z zaaplikowaną migracją (C-13 — nigdy prod).

## Faza 1 — Warstwa serwera

- [x] **T-3** — Typ `AssistantPresentation = "window" | "content"` obok istniejących
      `AssistantLevel`/`AssistantVoiceKind` (C-12) + `presentation` w `AssistantPrefsDTO`,
      `AssistantPrefsInput` i wartościach domyślnych w `src/actions/assistantPrefs.ts`;
      w `updateAssistantPrefs` gałąź walidująca wartość do unii (wzorzec istniejącej walidacji
      `level`/`voiceKind` — wartość spoza unii jest **ignorowana**, nie zapisywana).
      **Gotowe, gdy:** `tsc --noEmit` czysto, odczyt zwraca `"window"` dla konta bez preferencji.

- [x] **T-4** — `src/actions/aiConversations.ts`: `listAiConversations()` zwraca
      `{ zapisane, historia }` — dwa rozłączne zapytania (`saved: true` / `saved: false`),
      każde z jawnym `take: 50` i `orderBy: { updatedAt: "desc" }`; `ConversationMeta` zyskuje
      `saved: boolean`. Komentarz przy zapytaniach: **dlaczego dwa, a nie podział po stronie
      klienta** (wspólne `take: 50` wycinałoby starą rozmowę zapisaną — czyli wadę, którą feature
      usuwa).
      **Przed zmianą:** `grep -rn "listAiConversations" src/` i zaktualizuj wszystkich konsumentów.
      **Gotowe, gdy:** `tsc --noEmit` czysto, `npm run check:pagination` zielone.

- [x] **T-5** — Nowa akcja `setAiConversationSaved(id, saved)` w tym samym pliku, wzorzec
      jeden do jednego z `renameAiConversation`: `requireAuth()` → `updateMany({ where: { id,
      userId } })` → `revalidatePath("/")`. Filtr `userId` **jest** guardem własności (C-21).
      **Gotowe, gdy:** akcja istnieje i jest typowana; próba zapisu cudzej rozmowy nic nie zmienia.

- [x] **T-6** `[P]` — Wpis dla `setAiConversationSaved` w `src/lib/ai/action-coverage.json`:
      ekspozycja `excluded` + powód („czynność człowieka w interfejsie — asystent nie zarządza
      własną historią"), `access: "self"`, guard = filtr `userId`. Wzorzec: sąsiednie wpisy
      `renameAiConversation` / `deleteAiConversation`.
      **Gotowe, gdy:** `npm run check:ai-coverage` i `npm run check:actions` zielone.

## Faza 2 — UI: teksty i drobne części

- [x] **T-7** `[P]` — `useIsWideScreen()` (`min-width: 1024px`) obok `useIsNarrowScreen()`
      w `src/hooks/useVisualViewport.ts` — ten sam wzorzec `matchMedia` + `addEventListener("change")`,
      start od `false` (SSR nie zna szerokości).
      **Gotowe, gdy:** hook eksportowany, `tsc` czysto.

- [x] **T-8** `[P]` — Nowe teksty do `messages/pl.json`, przestrzeń
      `components.assistant.AICommandSheet`: „Więcej", „Zapisz rozmowę", „Usuń z zapisanych",
      „Zmień nazwę", „Usuń rozmowę", „Zapisane", „Historia", „Pokaż w obszarze treści",
      „Pokaż w oknie", stan pusty listy zapisanych, tytuł potwierdzenia usunięcia, etykiety
      dostępności znacznika trybu automatycznego.
      **Gotowe, gdy:** `npm run check:i18n` zielone (bramka sprawdza też, czy każde `t("klucz")`
      ma wpis — klucz bez wartości wywala build).

## Faza 3 — UI: asystent

- [x] **T-9** — **Menu poziomu pracy na `AnchoredLayer`** (plan §5.2, AC-5…AC-7).
      Podmiana pojemnika: `position: absolute; bottom: calc(100% + 6px)` → `AnchoredLayer`
      (`role="menu"`, `side="gora"`, `align="end"`, kotwica = przycisk poziomu, `open` =
      `showLevelMenu`). **Treść przenoszona bez zmian** — te same poziomy, `changeLevel`,
      ikona konfiguracji przy „Własnym" i przełącznik auto-zatwierdzania. Usuń gałąź
      `if (showLevelMenu)` z handlera `Esc` asystenta (obsługuje go teraz warstwa).
      **Gotowe, gdy:** menu widoczne w całości przy oknie 1280×600, `Esc` zamyka je, a arkusz
      zostaje otwarty; wybór poziomu działa jak dotąd.

- [x] **T-10** — **Przebudowa górnego paska** (plan §5.1, AC-1…AC-4).
      Lewa strefa: Sparkles + nazwa (`minWidth: 0` + ellipsis) + znacznik `auto` z tekstem
      `hidden sm:inline` (poniżej `sm` sama ikona; `title`/`aria-label` niosą pełną treść).
      Prawa strefa: Nowa rozmowa · Historia · ⋮ · [dokowanie, `hidden lg:flex`] · Zamknij,
      każdy przycisk `minWidth: 44, minHeight: 44` (C-31).
      Menu ⋮ = `AnchoredLayer` (`role="menu"`, `align="end"`) z: akcjami bieżącej rozmowy
      (zapisz/odznacz, zmień nazwę, usuń — wyłączone przy pustej rozmowie), separatorem,
      Ustawieniami, Zgłoś problem i `PrzelacznikTrybuAdmina` (tylko `isAdmin`).
      **Pod ⋮ wyłącznie czynności — żadnych wskaźników stanu** (lekcja z przebiegu 100; komentarz
      w kodzie).
      **Gotowe, gdy:** przy 360 px żadne dwa prostokąty paska się nie przecinają, pasek nie
      przewija się w poziomie, a każda dzisiejsza funkcja ma dokładnie jedno miejsce.

- [x] **T-11** — **Zapisane / Historia** (plan §5.3, AC-8…AC-13).
      Nad listą w szufladzie historii `PrzelacznikSegmentowy` z segmentami `zapisane`/`historia`,
      **oba z `wylaczona: false` jawnie** (pusta lista zapisanych musi dać się otworzyć, bo tam
      stoi wyjaśnienie, jak coś na nią trafia). Domyślnie wybrana `historia` (stan `useState`,
      nie utrwalany). Wiersz listy dostaje ikonę zapisania (`Bookmark`/`BookmarkX`) wołającą
      `setAiConversationSaved`. Stan pusty listy zapisanych = tekst wyjaśniający.
      **`removeConversation` przez `confirmDialog({ destructive: true })`** — dziś kasuje bez
      potwierdzenia, co narusza C-34; ta sama akcja w dwóch miejscach nie może mieć dwóch zachowań.
      **Gotowe, gdy:** zapisanie i odznaczenie przenosi rozmowę między listami, liczniki się
      zgadzają, przeżywa przeładowanie, usuwanie pyta skórkowanym oknem.

- [x] **T-12** — **Tryb pracy w obszarze treści — powłoka** (plan §5.4, AC-14, AC-20).
      W `AppShell`: opakowanie `<div className="relative flex flex-1 min-w-0">` obejmujące
      `<main>` (bez `flex-1 min-w-0` — przechodzą na opakowanie) i `<AICommandSheet>` przeniesiony
      do środka. Opakowanie **nie dostaje** `transform`/`filter`/`contain` (zepsułyby układ
      odniesienia dla `position: fixed`, czyli tryb okna i arkusz na telefonie) — komentarz w kodzie.
      Stan `przykryte` ustawiany callbackiem `onPrzykrycie` z asystenta; `mainRef` dostaje
      `inert` + `aria-hidden="true"` **przez `setAttribute` w `useEffect`**, nie propem JSX
      (React 18 nie zna propa `inert` — cicha porażka).
      **Gotowe, gdy:** szerokość `<main>` przed i po zmianie identyczna na szerokim i wąskim
      ekranie; nawigacja modułów działa przy otwartym asystencie.

- [x] **T-13** — **Tryb pracy w obszarze treści — asystent** (plan §5.4, AC-15…AC-19).
      Warunek `presentation === "content" && useIsWideScreen() && isOpen` → panel renderuje się
      jako `position: absolute; inset: 0` w opakowaniu (bez przyciemnionego tła, bez zamykania
      kliknięciem w tło, `borderRadius: 0`, `role="region"` + `aria-label` zamiast
      `role="dialog" aria-modal="true"` — to nie jest modal, skoro nawigacja obok działa).
      Przełącznik trybu w pasku (`hidden lg:flex`, `aria-pressed`) zapisujący
      `updateAssistantPrefs({ presentation })`; `presentation` czytane razem z resztą preferencji
      przy otwarciu. Treść **przykryta, nie `display: none`** — komentarz w kodzie z powodem
      (`display: none` niszczy pudełko układu i gubi `scrollTop`).
      **Gotowe, gdy:** URL bez zmian, `scrollTop` modułu zachowany po wyjściu, przy 360 px
      asystent otwiera się jako arkusz mimo zapisanego `content`, a wyjście z trybu jest widoczne
      bez otwierania żadnego menu.

## Faza 4 — Bramki i domknięcie

- [x] **T-14** — Komplet bramek lokalnie (plan §8), na **lokalnym** Postgresie (C-13):
      `check:migrations`, `check:schema-drift`, `check:pagination`, `check:i18n`,
      `check:ui-contract`, `check:owner-columns`, `check:client-safe`, `check:logs`,
      `check:ai-coverage`, `check:actions`, `tsc --noEmit -p tsconfig.test.json`,
      `next lint --dir src`, `next build`. **Nie odpalamy `npm run build`** (ostatni krok rusza
      prod DB).
      **Gotowe, gdy:** wszystko zielone do `next build` włącznie.

- [x] **T-15** — Klikacze Playwright wg `docs/e2e/uruchamianie-e2e-claude.md`
      (`nohup bash scripts/e2e-web.sh > /tmp/e2e.log 2>&1 &`), **bez `networkidle`**
      (`check:e2e-waits`). Sprawdź, czy zmiana nie wywróciła istniejących scenariuszy asystenta
      i powłoki.
      **Gotowe, gdy:** brak nowych regresji względem stanu sprzed zmiany.

- [x] **T-16** — Aktualizacja dokumentacji: `worldofmag/CLAUDE.md` (opis asystenta — dwie listy
      rozmów, tryb prezentacji, menu ⋮) oraz wpisy do `doświadczenia.md` (C-51, po polsku):
      `display: none` gubi pozycję przewijania; `inert` przez `ref`, nie prop (React 18);
      wspólne `take: 50` na jednej liście chowa rekordy wyróżnione.
      **Gotowe, gdy:** oba pliki opisują stan po zmianie.

## Faza 5 — poprawki po recenzji (nawrót z `/review`)

- [x] **T-17** — **Opakowanie obszaru treści musi mieć `min-h-0`.** Korzeń powłoki jest
      `flex-col` poniżej `md`, a nowe opakowanie ma `overflow: visible`, więc jego
      `min-height: auto` rozwiązuje się do **wysokości treści**: `<main>` przestaje być
      ograniczony ekranem i wewnętrzny kontener przestaje być kontenerem przewijania.
      Zmierzone: `/tasks` przy 360 × 640 — `main` **2028 px** zamiast 595, `scrollTop` stoi na 0.
      Skutek: **na telefonie w każdym module widać tylko pierwszy ekran listy.**
      Wcześniej działało, bo `<main>` ma `overflow-hidden`, przy którym automatyczny rozmiar
      minimalny wynosi 0 — opakowanie tej własności nie odziedziczyło.
      **Gotowe, gdy:** klikacz przy 360 px przewija listę modułu o > 300 px.

- [x] **T-18** — **Przełącznik dokowania jest widoczny na telefonie.** `headerBtn` dziedziczy
      z `iconBtn` `display: "flex"`, a styl w atrybucie wygrywa z klasą `.hidden` — dokładnie ta
      pułapka jest opisana 160 linii wyżej w tym samym pliku (przebieg 100). Dotknięcie zapisuje
      `presentation="content"` **na koncie**, na telefonie nic nie robi, a przy następnym wejściu
      na komputerze asystent otwiera się zadokowany — czyli łamie AC-18 („nie da się trafić
      przypadkiem"). **Gotowe, gdy:** przy 360 px przycisku nie ma w drzewie.

- [x] **T-19** — **Pływająca ikona zasłania kompozytor w trybie treści.** FAB ma `zIndex: 41`
      (a przy otwartym panelu roboczym 55), zadokowany panel — 30. Zmierzone: `elementFromPoint`
      w środku przycisku „Wyślij" zwraca FAB, więc **wiadomości nie da się wysłać kliknięciem**.
      Ta sama warstwa 30 leży poniżej `fixed z-40/z-50` z modułów (pasek akcji zbiorczych Zadań,
      wskaźnik offline Zakupów), które po zadokowaniu rysowałyby się na asystencie, a będąc
      w `inert` treści nie dałyby się już zamknąć.
      **Gotowe, gdy:** warstwa trybu treści stoi ponad chromem modułów i poniżej `Modal` (50),
      a pływająca ikona nie renderuje się przy otwartym asystencie.

- [x] **T-20** `[P]` — Drobne z recenzji: `role="img"` na znaczniku „auto" (bez roli `aria-label`
      nie jest wystawiane — AC-2); wycofanie `togglePresentation` przez zapamiętaną wartość, nie
      przez domknięcie; pozycja „Zapisz rozmowę" wyłączona do czasu wczytania list (inaczej
      pierwszy klik może pójść w złą stronę); komentarz `deleteAiConversation` wrócić nad właściwą
      funkcję.

- [x] **T-21** — Lekcje do `doświadczenia.md`: `min-h-0` na opakowaniu w kolumnowym flexboksie;
      `display` w atrybucie `style` unieważnia `hidden`/`lg:flex`.

## Mapowanie kryteriów akceptacji → zadania

| AC | Zadanie(a) |
|---|---|
| AC-1 — brak nakładania w pasku przy 360 px, cele ≥ 44 px | T-10 |
| AC-2 — znacznik `auto` responsywny, z dostępną nazwą | T-8, T-10 |
| AC-3 — komplet funkcji drugiego planu pod ⋮ | T-10 |
| AC-4 — `Esc` zamyka tylko menu | T-9, T-10 |
| AC-5 — menu poziomu widoczne w całości | T-9 |
| AC-6 — niskie okno: przewijanie wewnątrz, nie poza ekran | T-9 |
| AC-7 — zachowanie wyboru poziomu bez zmian | T-9 |
| AC-8 — zapisanie rozmowy trwałe, na koncie | T-1, T-4, T-5, T-11 |
| AC-9 — dwie listy z licznikami, rozłączne | T-4, T-11 |
| AC-10 — odwracalność, rozmowa nie znika | T-5, T-11 |
| AC-11 — stan pusty listy zapisanych wyjaśnia, jak zapisać | T-8, T-11 |
| AC-12 — komplet akcji rozmowy w ⋮ + potwierdzenie niszczące | T-10, T-11 |
| AC-13 — istniejące rozmowy na liście historycznej, zapisane puste | T-1, T-2 |
| AC-14 — tryb treści bez zmiany adresu | T-12, T-13 |
| AC-15 — stan modułu zachowany (przewinięcie, wpisany tekst) | T-12, T-13 |
| AC-16 — kontekst strony dostępny jak w trybie okna | T-12, T-13 |
| AC-17 — wybór trybu zapamiętany na koncie | T-3, T-13 |
| AC-18 — telefon bez zmian | T-7, T-13 |
| AC-19 — zawsze widoczne wyjście z trybu | T-10, T-13 |
| AC-20 — nawigacja działa, treść niedostępna dla fokusu | T-12 |
| AC-21 — komplet bramek | T-14 |

## Ścieżka krytyczna

`T-1 → T-2 → T-4 → T-11` (dane → zapytania → listy) oraz
`T-3 → T-13` (typ + preferencja → tryb treści), przy czym `T-13` czeka też na `T-7` (hook)
i `T-12` (opakowanie w powłoce). `T-9`, `T-10` i `T-11` dotykają tego samego pliku
(`AICommandSheet.tsx`), więc idą **po kolei**, nie równolegle — mimo że logicznie są niezależne.
Zrównoleglić da się `T-6`, `T-7` i `T-8`.

## Notatki / blokady

**T-15 — wynik klikaczy, z ustaloną bazą odniesienia.** Pełny zestaw na tej gałęzi: **215 przeszło,
14 padło**. Na commicie sprzed zmiany (`745175e`): **216 przeszło, 13 padło**. Różnicę stanowi
dokładnie jeden test — `[vs-AC4] ulubiony zapisany z filtrami wraca z filtrami`. Uruchomiony
**sam, w izolacji**, pada **tak samo na bazie** (9 przeszło / 1 padł, ten sam błąd: dialog ulubionych
nie zawiera zapisanego widoku). Czyli nie jest to regresja tej zmiany, tylko zależność od stanu
ulubionych zostawionego przez wcześniejszy przebieg — nazywa ją wprost drugi test padający **także
w bazie**: „Nie udało się wyczyścić ulubionych w 40 iteracjach".

Pozostałe 13 to znane porażki specyfikacji funkcjonalnych, o których mówi `scripts/e2e-web.sh`
i `docs/e2e/uruchamianie-e2e-claude.md`. **Regresji wprowadzonych przez 106: zero.**
