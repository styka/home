# Zadania: Zgłoszenia bez czekania i pakiet poprawek UX

- **Plan:** ./plan.md (099-zgloszenia-i-poprawki-ux)
- **Status:** todo
- **Data:** 2026-08-24

> Kolejność: **od najłatwiejszego do najtrudniejszego** i zgodna z zależnościami. Trzy poprawki UI
> (T-1..T-3) są niezależne od reszty i idą pierwsze — dają szybki, sprawdzalny efekt i nie blokują
> nikogo. Potem fundament danych, serwer, zadanie w tle, UI zgłoszenia, na końcu bramki.

## Legenda
- `[ ]` do zrobienia · `[x]` zrobione · `[~]` w trakcie · `[!]` zablokowane (patrz notatka)
- `[P]` — niezależne od poprzedniego, można robić równolegle

## Faza 0 — Trzy poprawki UI (niezależne od reszty)

- [x] **T-1** `[P]` — **Kropka osi czasu wraca do kolumny treści** (plan §5.5).
  `src/modules/news/ui/NewsTimeline.tsx`: `ol` dostaje lewy margines równy połowie kropki, tak by
  jej skrajny piksel nie wychodził poza lewą krawędź kolumny; kropka zostaje **wyśrodkowana na
  linii**. Komentarz „dlaczego" przy zmianie (przyklejone paski zasłaniają tylko kolumnę).
  *Gotowe, gdy:* przy przewijaniu nic nie przesuwa się obok przyklejonych pasków, a kropki nadal
  leżą na linii osi (AC-12, AC-13).

- [x] **T-2** `[P]` — **Koniec pustego wiersza w pasku widoku na telefonie** (plan §5.4).
  `src/components/ui/view/ViewBar.tsx`: gdy widok nie ma ani `actions`, ani `settings`, wrapper
  pierwszego wiersza renderuje się jako `hidden md:contents` i bez `minHeight`. Komentarz
  z przyczyną (tytuł jest poniżej `md` ukryty, więc wiersz zostawał pusty przy `density="compact"`).
  *Gotowe, gdy:* `/tasks/<projectId>` przy 360 px nie ma pustej listwy pod nazwą modułu, a widoki
  z akcjami wyglądają identycznie jak przed zmianą — na telefonie i na komputerze (AC-14, AC-15).

- [x] **T-3** `[P]` — **„Proponowane" + menu ⋮ w gorących tematach** (plan §5.6).
  `src/modules/news/ui/HotTopics.tsx`: nagłówek sekcji czyta „Proponowane"; „Monitorowane (n)"
  i „Odrzucone (n)" przenoszą się do **istniejącego** komponentu menu trzykropkowego (tego samego,
  którym 087 schowało edycję/usuwanie tematu — nie piszemy drugiego). Pozycja z zerowym licznikiem
  nie jest renderowana; gdy obie puste — nie ma przycisku ⋮. Teksty do `messages/pl.json`
  (namespace `modules.news.HotTopics`).
  *Gotowe, gdy:* przy 360 px nagłówek mieści się w jednym wierszu, oba przełączniki działają z menu,
  `npm run check:i18n` zielone (AC-16, AC-17, AC-18).

## Faza 1 — Fundament danych

- [x] **T-4** — **Migracja `0259_task_attachment`** (plan §2). Ręcznie pisany `migration.sql`:
  tabela `TaskAttachment` (`id`, `taskId`, `name`, `kind` DEFAULT `'screenshot'`, `url`, `createdAt`),
  indeks po `taskId`, FK do `Task` `ON DELETE CASCADE`. Bez `migrate diff` (C-15).
  *Gotowe, gdy:* `npm run check:migrations` zielone, a `migrate deploy` przechodzi na lokalnym
  Postgresie (C-13).

- [x] **T-5** — **`schema.prisma` zgodne z migracją**: model `TaskAttachment` (rodzaj jako `String`,
  **bez enuma** — C-12; bez `workspaceId`/`ownerId`, właściciela daje rodzic) + `attachments
  TaskAttachment[]` w `Task`. Typ TS `TaskAttachmentKind = "screenshot" | "file"`.
  *Gotowe, gdy:* `npx prisma generate` czysto i `npm run check:schema-drift` zielone.

## Faza 2 — Warstwa serwera

- [x] **T-6** — **`getTaskAttachments`** w `src/modules/tasks/actions/tasks.ts` (plan §3.2):
  guard `assertTaskAccess`, jawne `take: SUFIT_LISTY`, DTO `{ id, name, kind, url, createdAt }`.
  Wpis w `src/lib/ai/action-coverage.json` (`kind: "read"`, `status: "excluded"`,
  `reason: "internal"`, `access: "shared"`).
  *Gotowe, gdy:* `npm run check:ai-coverage` i `npm run check:pagination` zielone.

- [x] **T-7** — **`submitFeedbackTask` przyjmuje priorytet i zrzut** (plan §3.1):
  opcjonalne `priority` (domyślnie `"MEDIUM"`) i `screenshotDataUrl`; walidacja zrzutu
  (`data:image/` + limit 1,5 MB) — **niepoprawny/za duży zrzut jest pomijany po cichu, zgłoszenie
  powstaje zawsze**; zapis `TaskAttachment` po utworzeniu zadania; `revalidatePath` bez zmian.
  Zwracany wynik dostaje `title`.
  *Gotowe, gdy:* zgłoszenie z zrzutem tworzy zadanie **i** załącznik, a zgłoszenie z uszkodzonym
  zrzutem tworzy samo zadanie bez błędu (AC-6, AC-8, AC-9, AC-11).

- [x] **T-8** — **Reguły zgłoszenia jako czysty moduł**: `src/lib/ai/zgloszenie.ts` — `roboczyTytul(opis)`
  (`🐛 ` + pierwsze zdanie/≤80 znaków), `czyTytulRoboczy`, `poprawnyZrzut`, `MAX_ZRZUT_ZNAKOW`
  + testy jednostkowe. **Korekta wobec planu (C-54):** walidacja zrzutu miała być prywatnym helperem
  w `src/actions/feedback.ts`; `check:domain` słusznie to odrzuciło — reguła w pliku `"use server"`
  jest niesprawdzalna, bo taki plik nie eksportuje funkcji synchronicznej. Przy okazji limit zrzutu
  ma teraz JEDNO miejsce, wspólne dla klienta i serwera.
  *Gotowe, gdy:* testy przechodzą, `check:domain` zielone, funkcje nie dotykają bazy ani Reacta.

- [x] **T-9** — **Zadanie w tle `tasks.feedbackTitle`** (plan §3.3):
  `src/modules/tasks/jobs/feedbackTitle.ts` + `src/modules/tasks/jobs/index.ts`, wpięcie **leniwym**
  polem `jobs` w `src/modules/tasks/module.server.ts`. Handler: pomija zadanie, którego tytuł nie jest
  roboczy (idempotencja); **jedno** `chatComplete` na typie `dispatch`; zapis przez `updateWithVersion`
  (`Task` ma `version` — zwykły `update` wywali `check:versioning`); konflikt = nie nadpisujemy;
  zwraca `usage` przez `usageFromChat`; logi wyłącznie `logEvent`. Wpis
  `on-demand` w `src/lib/ai/content-memory-coverage.json`.
  *Gotowe, gdy:* `check:content-memory`, `check:cost-badge`, `check:versioning`, `check:logs`
  i `check:module-registry` zielone, a zadanie w kolejce podmienia tytuł (AC-3, AC-4).

- [x] **T-10** — **Kolejkowanie tytułu z akcji zgłoszenia**: `submitFeedbackTask` po utworzeniu
  zadania woła `enqueueJob("tasks.feedbackTitle", { taskId }, { ownerId, dedupeKey })` **w try/catch** —
  awaria kolejki nie może wywrócić zgłoszenia.
  *Gotowe, gdy:* zgłoszenie wraca natychmiast, w kolejce jest jedno zadanie, a przy wyłączonej
  kolejce zgłoszenie nadal powstaje z tytułem roboczym (AC-1, AC-3).

## Faza 3 — UI zgłoszenia

- [x] **T-11** — **Zrzut wskazanego elementu** (plan §5.1): zależność `html-to-image` (leniwy
  `import()` **wyłącznie** w `FeedbackInspector`), zdjęcie robione **po** zdjęciu podświetlenia,
  tło z `--bg-base`, `pixelRatio` ograniczony, limit czasu ~4 s, degradacja PNG → JPEG → brak zrzutu,
  całość w `try/catch`. `AssistantOpenDetail` dostaje `feedbackShot?: string`.
  *Gotowe, gdy:* wskazanie elementu daje obraz **tego** elementu, a wymuszony błąd rasteryzacji nie
  blokuje otwarcia asystenta (AC-6, AC-8, AC-9).

- [x] **T-12** — **Wybór priorytetu w trybie zgłoszenia** (plan §5.2): rząd chipów
  Niski/Normalny/Wysoki/Pilny nad polem wiadomości, domyślnie **Normalny**, widoczny wyłącznie
  w trybie zgłoszenia i zerowany razem z nim. Kolory ze zmiennych CSS, cel dotyku `py-3`, teksty przez `t()`.
  *Gotowe, gdy:* chipy widać bez dodatkowego kliknięcia, a wybór trafia do utworzonego zadania
  (AC-10, AC-11).

- [x] **T-13** — **Zgłoszenie bez pętli agenta** (plan §5.2, najtrudniejsze):
  `handleSend` w trybie zgłoszenia woła `submitFeedbackTask` **wprost** (tytuł roboczy, opis
  *verbatim* + blok kontekstu UI — dokładnie jak dziś, priorytet, zrzut) i dokłada turę
  `answer` z potwierdzeniem „✅ Utworzono zgłoszenie: <tytuł>" (+ odnośnik, gdy `canRead`).
  Bez `callAgent`, bez planu, bez `/execute`, bez stanu „myślę". `feedbackPrefixRef` zostaje
  wyłącznie dla zgłoszeń ze zwykłej rozmowy (agent nadal potrafi `submit_feedback`).
  *Gotowe, gdy:* potwierdzenie pojawia się natychmiast, zamknięcie asystenta zaraz po wysyłce **nie
  kasuje** zgłoszenia, a opis w zadaniu jest słowo w słowo (AC-1, AC-2, AC-4, AC-5).

- [x] **T-14** `[P]` — **Załącznik widoczny w zadaniu** (plan §5.3): sekcja „Załączniki"
  w `src/modules/tasks/ui/TaskDetail.tsx` wzorowana na `NoteAttachments` — miniatura + podgląd
  w istniejącym `Modal`; brak załączników = brak sekcji.
  *Gotowe, gdy:* zadanie ze zrzutem pokazuje miniaturę i powiększenie, a usunięcie zadania usuwa
  załącznik (kaskada) (AC-7).

## Faza 4 — Bramki i domknięcie

- [x] **T-15** — **Klikacze (e2e)**: scenariusz zgłoszenia (tryb wskazywania → opis → priorytet →
  natychmiastowe potwierdzenie → zadanie w skrzynce, także po natychmiastowym zamknięciu asystenta)
  oraz pomiary układu: brak pustego wiersza przy 360 px, kropka osi wewnątrz kolumny, nagłówek
  „Proponowane" w jednym wierszu. Bez `networkidle` (`check:e2e-waits`).
  *Gotowe, gdy:* `bash scripts/e2e-web.sh` zielone.

- [x] **T-16** — **Pełny `npm run build` do kroku `next build`** na lokalnym Postgresie (C-13),
  wszystkie bramki zielone; po buildzie `npm run check:perf` — gdy poza pasmem ±5 %, najpierw
  szukamy przecieku `html-to-image` do wspólnego grafu, dopiero potem aktualizujemy próg z powodem.
  *Gotowe, gdy:* build i wszystkie bramki przechodzą.

- [ ] **T-17** — **Mapowanie AC → dowód** (wejście dla `/verify`): dla każdego z AC-1..AC-18 wpisz,
  czym został potwierdzony (test, klikacz, pomiar, przegląd kodu).

- [ ] **T-18** — **Wpis do `doświadczenia.md`** (C-51), po polsku: zamknięcie asystenta przerywa
  trwające żądanie (`abort()` w `handleClose`), więc „zapisz najpierw, model potem" jest wymogiem
  poprawności, a nie oszczędnością; plus lekcja o `minHeight` na wierszu, który na telefonie bywa pusty.

## Mapowanie kryteriów akceptacji

| AC | Zadania |
|----|---------|
| AC-1 | T-10, T-13, T-15 |
| AC-2 | T-13, T-15 |
| AC-3 | T-9, T-10 |
| AC-4 | T-9, T-13 |
| AC-5 | T-13 |
| AC-6 | T-7, T-11 |
| AC-7 | T-14 |
| AC-8 | T-7, T-11 |
| AC-9 | T-7, T-11 |
| AC-10 | T-12 |
| AC-11 | T-7, T-12 |
| AC-12 | T-1, T-15 |
| AC-13 | T-1, T-15 |
| AC-14 | T-2, T-15 |
| AC-15 | T-2, T-15 |
| AC-16 | T-3 |
| AC-17 | T-3, T-15 |
| AC-18 | T-3 |

## Ścieżka krytyczna

`T-4 → T-5 → T-7 → T-10 → T-13 → T-15 → T-16`.
T-1..T-3 i T-8 nie blokują niczego. T-6 i T-14 stoją obok siebie (odczyt → widok) i wchodzą po T-5.
T-11 i T-12 muszą być przed T-13 (ich dane wchodzą do wywołania akcji).

## Notatki / blokady

- **11 klikaczy było czerwonych PRZED tą zmianą** i takie zostaje — wszystkie zależą od danych
  Wiadomości, których świeża baza sandboxa nie ma (pomiary wracają `null`). Sprawdzone wprost:
  te same pliki uruchomione na commicie bazowym `bf79221` dają ten sam zestaw porażek. Lista:
  `084-AC2`, `084-AC4/AC-5`, `085-AC4`, `086-AC20`, `087-AC2`, `087-AC9`, `087-AC10`, `087-AC11`,
  `087-AC15`, `scenario-news-observer-remount`, `scenario-news-stream-scroll`.
- **`favorites.spec.ts` bywa czerwony pod obciążeniem** — w pełnym przebiegu padł `fav-AC4`,
  w węższym `fav-AC5`, a na bazie (lekki przebieg) cały plik był zielony. Za każdym razem pada
  pomocnik sprzątający ulubione (`clearFavorites`) po ~30 s. Inny test przy każdym przebiegu =
  zależność od czasu, nie od tej zmiany; ulubione żyją w chromie konta, którego 099 nie dotyka.
