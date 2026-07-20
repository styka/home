# Zadania: Zgłaszanie problemu z czatem asystenta AI (admin) → zadanie w Omnia

- **Plan:** ./plan.md (002-assistant-chat-problem-report)
- **Status:** todo
- **Data:** 2026-07-19

> Kolejność wg zależności. Bez faz danych/serwera/RBAC/AI (plan §2–§4/§6: reuse istniejących akcji,
> brak schematu/AIAction/slug'a). `[x]` odhaczane w `/implement`.

## Legenda
- `[ ]` do zrobienia · `[x]` zrobione · `[~]` w trakcie · `[!]` zablokowane
- `[P]` — niezależne, można zrównoleglić

## Faza 0–1 — Dane / Server Actions / RBAC
- **Nie dotyczy.** Brak migracji (plan §2), brak nowych Server Actions/slug'a (plan §3–§4) — reuse
  `ensureOmniaProject` + `createTask`. `check:migrations`/`check:actions` przechodzą trywialnie.

## Faza 2 — UI (przewlekanie admina)
- [x] **T-1** — `AppShell.tsx`: przekazać `isAdmin` do asystenta — `<AICommandSheet isAdmin={isAdmin} />`
  (:258). **Gotowe, gdy:** komponent dostaje prop, `tsc` czysto.
- [x] **T-2** — `AICommandSheet.tsx`: sygnatura `export function AICommandSheet({ isAdmin = false }: { isAdmin?: boolean })`.
  Import `Bug` z `lucide-react`. **Gotowe, gdy:** kompiluje się, prop dostępny w komponencie.

## Faza 3 — UI (ikona + panel + składanie treści + utworzenie zadania)
- [x] **T-3** — Funkcja modułowa `buildChatProblemReport(turns, error, desc)` (obok
  `deriveContextFromPath`): markdown = „## Opis problemu" (opis lub „_(brak opisu)_") + „## Ostatni
  błąd (backend)" (jeśli `error`) + „## Zrzut rozmowy" (numerowane tury: rola/kind/treść) + „## Logi
  połączeń z backendem" (per-tura asystenta: `meta` model/tokeny + wpisy `log` iter/step/thought,
  `tools`/`results` w blokach ```json```, pojedynczy ogromny wynik przycięty do ~4000 zn.) + stopka
  (route, conversationId, ISO timestamp). **Gotowe, gdy:** funkcja zwraca kompletny markdown dla
  przykładowego `turns`. Pokrywa **AC-5**.
- [x] **T-4** — Nagłówek: **usunąć** przycisk zębatki `Settings` z rzędu akcji (dodany w 001) i — tylko
  gdy `isAdmin` — wstawić przycisk `Bug` „Zgłoś problem z czatem" (`title`/`aria-label` PL,
  `aria-expanded`, kolor ze zmiennych: `var(--accent-purple)` gdy panel otwarty, inaczej `var(--text-muted)`),
  togglujący `showReport`. **Gotowe, gdy:** admin widzi `Bug`, zębatki nie ma. Pokrywa **AC-1/AC-2/AC-7**.
- [x] **T-5** — Stany: `showReport`, `reportDesc`, `reportBusy`, `reportDone`. Panel pod nagłówkiem
  (wzorzec `{showPrefs && …}`): tytuł, **opcjonalny** `textarea` opisu (placeholder „np. spodziewałem
  się odpowiedzi: …"), przyciski „Zgłoś problem"/„Anuluj". Blokada „Zgłoś", gdy
  `turns.length===0 && !error && !reportDesc.trim()`. **Gotowe, gdy:** panel się otwiera/zamyka, pole
  opcjonalne, przycisk blokowany bez kontekstu. Pokrywa **AC-3/AC-6**.
- [x] **T-6** — Handler „Zgłoś": `setReportBusy(true)`; `const p = await ensureOmniaProject();`
  `await createTask({ title, projectId: p.id, description: buildChatProblemReport(...) })`; po sukcesie
  `setReportDone({projectId:p.id})` + komunikat „Utworzono zadanie w projekcie Omnia" z linkiem do
  `/tasks` (SPA `router.push`/`<a>`), wyczyścić `reportDesc`; obsłużyć błąd (`try/catch`, komunikat).
  Import `ensureOmniaProject` z `@/actions/taskProjects`, `createTask` z `@/actions/tasks`. **Gotowe,
  gdy:** klik tworzy zadanie i pokazuje potwierdzenie. Pokrywa **AC-4**.

## Faza 4 — Bramki i domknięcie
- [x] **T-7** — `npx tsc --noEmit` + `npx next lint --dir src` + `npx next build` (dummy/lokalny
  `DATABASE_URL`, **nie** prod — C-13/C-50) zielone. `check:migrations`/`check:actions` OK.
- [x] **T-8** — Mapowanie każdego AC → wynik (input do `/verify`).
- [x] **T-9** — Brak nieoczywistego problemu (spójna zmiana UI wg planu) → wpisu do `doświadczenia.md` nie dodajemy (C-51: tylko przy realnym bugu/lekcji).

## Mapowanie kryteriów akceptacji
| AC | Zadanie | Jak weryfikujemy |
|----|---------|------------------|
| AC-1 — ikona zgłaszania w nagłówku | T-4 | inspekcja: `Bug` w rzędzie akcji (admin) |
| AC-2 — nie-admin nie widzi ikony | T-1, T-4 | render za `isAdmin`; AppShell przekazuje |
| AC-3 — pole opcjonalnego opisu + akcje | T-5 | panel z `textarea` + „Zgłoś"/„Anuluj" |
| AC-4 — powstaje zadanie w „Omnia" + potwierdzenie | T-6 | `ensureOmniaProject`+`createTask`; `reportDone` |
| AC-5 — treść: opis+zrzut+logi+błąd | T-3 | output `buildChatProblemReport` |
| AC-6 — blokada bez kontekstu | T-5 | `disabled` przycisku „Zgłoś" |
| AC-7 — brak zębatki z 001 | T-4 | inspekcja nagłówka: `Settings` usunięty z rzędu akcji |

## Ścieżka krytyczna
`T-1`→`T-2` (prop admina) → `T-3` (helper treści) → `T-4` (ikona) → `T-5` (panel) → `T-6` (utworzenie
zadania) → `T-7` (bramki) → `T-8` (AC) → `T-9` (opcjonalna lekcja). T-3 można robić równolegle do T-1/T-2
(niezależne), ale całość i tak ląduje w jednym pliku → jeden commit.

## Notatki / blokady
- `Settings` **zostaje w imporcie** — jest używany w menu „+" (:1344); usuwamy tylko przycisk zębatki z nagłówka.
