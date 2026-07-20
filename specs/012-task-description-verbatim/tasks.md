# Zadania: Asystent AI nie redaguje treści opisu zadania

- **Plan:** ./plan.md (012-task-description-verbatim)
- **Status:** todo
- **Data:** 2026-07-20

> **Zasada listy zadań:** zmiana jest prompt-only (dwa stringi w `.ts`), bez migracji/akcji/UI-komponentów.
> Kolejność: rekonesans → prompt agenta → prompt zgłoszenia → bramki/domknięcie. Każde zadanie małe,
> samodzielne i weryfikowalne. `[P]` = można zrównoleglić.

## Legenda
- `[ ]` do zrobienia · `[x]` zrobione · `[~]` w trakcie · `[!]` zablokowane
- `[P]` — niezależne od poprzedniego, można robić równolegle

## Faza 0 — Rekonesans (potwierdzenie źródeł redakcji)
- [x] **T-1** — Potwierdź, że warstwa danych **nie** redaguje opisu: `executeTasksAction` (`create_task`)
  → `createTask` przekazuje `description` wiernie (`tasksExecutor.ts`), a `createTask`/`updateTask` w
  `actions/tasks.ts` nie transformują treści. Sprawdź też skróconą ścieżkę **`src/lib/ai/fastPath.ts`**
  (czy tworzy zadanie i czy redaguje opis). Gotowe, gdy: znasz komplet miejsc, gdzie prompt/kod ustala
  `description` przy tworzeniu zadania (jeśli fastPath redaguje → dopisz T do tej listy i uzupełnij
  `plan.md` §7 wg C-54).
  → **Ustalono:** kod akcji zapisuje `description` wiernie (bez redakcji). LLM redaguje w **trzech**
  promptach: agent `create_task` (route.ts), reguła bulk-add (route.ts), prompt zgłoszenia admina
  (AICommandSheet.tsx). Dodatkowo **fast-path** `create_task` (fastPath.ts) buduje `description` przez
  LLM bez wymuszonej redakcji — dla spójności dodano tam klauzulę verbatim (patrz **T-4b**, plan §7).

## Faza 1 — Prompt agenta (główna ścieżka „dodaj zadanie")
- [x] **T-2** — W `src/app/api/llm/home/agent/route.ts`, sekcja `create_task` (~linia 83–84):
  **zastąp** instrukcję o „lekkiej redakcji" (forma bezosobowa / popraw gramatykę) dobitną instrukcją
  **verbatim**: opis = oryginalny tekst użytkownika słowo w słowo, bez zmian formy/gramatyki/interpunkcji,
  bez streszczania/skracania/pomijania faktów; zachować oryginalne słowa, ton, literówki. **Zostaw**
  regułę „TYTUŁ vs TREŚĆ" (title generowany z treści; sam krótki tytuł → title). Gotowe, gdy: w prompcie
  nie ma już zgody na redakcję opisu, a reguła generowania tytułu została nienaruszona. (AC-1, AC-2, AC-3)
- [x] **T-3** — W tym samym pliku, reguła **BULK DODAWANIE ZADAŃ** (~linia 309): dopisz, że treść każdej
  pozycji przepisujemy **bez przeredagowania** (verbatim per pozycja), zachowując mapowanie
  „pozycja → osobne zadanie". Gotowe, gdy: reguła bulk wprost wymaga verbatim treści pozycji. (AC-6)

## Faza 2 — Prompt ścieżki zgłoszenia admina + fast-path
- [x] **T-4** — W `src/components/home/AICommandSheet.tsx`, prompt „[ZGŁOSZENIE ADMINA — TRYB
  WSKAZYWANIA]" (~linia 975–981): zmień punkt `params.description` na **opis admina verbatim (nie
  przeredagowuj, nie poprawiaj) ORAZ** doklejony poniżej kontekst wskazanego miejsca (kolejność
  opis→kontekst zachowana). Punkt `params.title` (zwięzły wygenerowany tytuł) **bez zmian**. Gotowe, gdy:
  prompt wymusza obie części opisu (verbatim + kontekst) i nie zmienia generowania tytułu. (AC-4, AC-5)
- [x] **T-4b** `[C-54]` — W `src/lib/ai/fastPath.ts` (SYSTEM_PROMPT, `tasks / create_task`): dopisz, że
  `description` = oryginalny tekst użytkownika **verbatim** (bez przeredagowania), title może być krótką
  etykietą z treści. Spójność ze zmianą w prompcie agenta. Gotowe, gdy: fast-path nie zachęca do redakcji
  opisu. (AC-1, AC-2 na skróconej ścieżce)

## Faza 3 — Bramki i domknięcie
- [x] **T-5** — Bramki spójności: `npm run check:migrations` ✔ (następny wolny numer 0206, brak nowej
  migracji) i `npm run check:actions` ✔ (159 akcji, wszystkie z egzekutorem — brak nowej akcji). Zielone.
- [x] **T-6** — `next lint` + `typecheck` w `worldofmag/` (po `npm install` + `prisma generate`).
  `tsc --noEmit` = **0 błędów**; `next lint` = tylko wcześniejsze kosmetyczne ostrzeżenia
  (exhaustive-deps / no-img-element w niepowiązanych plikach), **żadne w edytowanych plikach**, brak
  errorów. Pełnego `next build` świadomie nie odpalono — ostatni krok `migrate.js` rusza prod DB (C-13);
  zmiana to literały stringów, więc tsc+lint w pełni pokrywają kompilację.
- [x] **T-7** — Mapowanie AC → wynik (input do `/verify`): AC-1/2/3 i AC-6 = inspekcja finalnego promptu
  `route.ts`; AC-4/5 = inspekcja promptu `AICommandSheet.tsx`; AC-1/2 (skrócona ścieżka) = `fastPath.ts`.
  Wszystkie miejsca potwierdzenia wskazane w kodzie.
- [x] **T-8** — Wpis-lekcja do `doświadczenia.md` (C-51) dopisany: źródło redakcji = prompty LLM (agent +
  fast-path + zgłoszenie), nie kod akcji; naprawa = instrukcja verbatim w obu ścieżkach.

## Mapa pokrycia AC
| AC | Zadanie(a) |
|----|-----------|
| AC-1 (opis verbatim, bez formy bezosobowej/gramatyki) | T-2 |
| AC-2 (literówki/styl potoczny nienaruszone) | T-2 |
| AC-3 (tytuł nadal generowany z treści) | T-2 |
| AC-4 (zgłoszenie admina: opis verbatim + kontekst) | T-4 |
| AC-5 (zgłoszenie admina: tytuł nadal generowany) | T-4 |
| AC-6 (bulk add: verbatim treści pozycji) | T-3 |

## Ścieżka krytyczna
T-1 (rekonesans) → {T-2, T-3, T-4 — niezależne pliki/sekcje, `[P]` względem siebie} → T-5 → T-6 → T-7 → T-8.

## Notatki / blokady
- Brak migracji i brak nowej `AIAction` — bramki `check:migrations`/`check:actions` są formalnością.
- Jeśli T-1 ujawni redakcję w `fastPath.ts` (lub innej ścieżce) — dopisz zadanie „napraw verbatim w
  fastPath", zaktualizuj `plan.md` §7 i tę mapę AC (C-54), zanim domkniesz build.
