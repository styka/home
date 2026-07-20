# Plan techniczny: Asystent AI nie redaguje treści opisu zadania

- **Spec:** ./spec.md (012-task-description-verbatim)
- **Status:** draft
- **Data:** 2026-07-20

> **Zasada planu:** to jest **JAK**. Zmiana jest prompt-only (instrukcja dla LLM), bez dotykania danych,
> Server Actions ani UI. Wzorzec = istniejące instrukcje w prompcie agenta (`create_task`) i w prompcie
> ścieżki zgłoszenia admina; poprawiamy je punktowo (C-53 — minimalizm).

## 1. Podejście (2–4 zdania)
Redakcja opisu **nie zachodzi w warstwie danych** — `executeTasksAction` (`create_task`) przekazuje
`params.description` do `createTask` **wiernie** (`src/lib/ai/executors/tasksExecutor.ts:42`). Redaguje
**LLM**, bo prompt systemowy agenta wprost mu na to pozwala. Źródła:
1. **Prompt agenta** — `src/app/api/llm/home/agent/route.ts:84` (katalog akcji, sekcja `create_task`):
   „Wolno CIĘ tylko lekko zredagować: zamień na formę bezosobową/rzeczową i popraw
   gramatykę/interpunkcję". To jest instrukcja przeredagowania — do usunięcia/odwrócenia na „verbatim".
2. **Prompt ścieżki zgłoszenia admina** — `src/components/home/AICommandSheet.tsx:975–981`: buduje
   polecenie „params.description: pełny opis admina ORAZ poniższy kontekst" — dopisujemy jawne
   „nie przeredagowuj opisu admina" (kontekst wskazanego miejsca **nadal** doklejany).
Naprawiamy oba prompty, żeby: **opis = oryginalny tekst użytkownika verbatim**, **tytuł nadal
generowany**, a przy zgłoszeniu **kontekst dalej doklejany**.

## 2. Model danych (Prisma)
**Bez zmian w schemacie.** Brak nowych modeli/kolumn, brak migracji. `Task.description` już istnieje i
`createTask`/`updateTask` zapisują je bez transformacji. (C-10/C-11/C-12 — nie dotyczą.)

## 3. Warstwa serwera (Server Actions — C-20)
**Bez zmian.** `createTask`/`updateTask` w `src/actions/tasks.ts` oraz `executeTasksAction`
(`create_task`, `update_task`) przekazują `description` wiernie — nic tu nie redaguje, więc nie ruszamy.
Guard/własność (`ownerId`, C-21) bez zmian. `revalidatePath` już jest w akcjach.

## 4. RBAC / rejestr modułu (C-22)
**Bez zmian.** Brak nowego slug'a; zgłoszenia admina pozostają za istniejącym `isAdmin` (montaż
`FeedbackInspector` w `AppShell`). Żadnych wpięć w `permissions.ts`/`modules.tsx`/`ModuleSidebar`.

## 5. UI (C-30, C-31, C-32)
**Bez nowych komponentów/tras.** Jedyna zmiana w warstwie klienta to **treść stringa promptu** w
`AICommandSheet.tsx` (ścieżka zgłoszenia) — brak zmian wizualnych, layoutu, mobile ani zmiennych CSS.
Teksty promptów po polsku (C-32). Panel potwierdzenia akcji (`ActionDrawer`) i tak pokaże użytkownikowi
finalny opis przed zapisem, więc verbatim jest weryfikowalny wzrokowo.

## 6. AI / integracje (C-23, C-40)
- **Brak nowej `AIAction`** i brak zmian w egzekutorach (`check:actions` nie zagrożone). Używamy
  istniejącego `create_task`/`update_task`.
- **Zmiana instrukcji promptu** (nie kodu routingu). Routing modeli DB-driven bez zmian (C-40).
- **Konkretnie w `route.ts` (sekcja `create_task`, ~linia 83–84):**
  - Zachowaj regułę **TYTUŁ vs TREŚĆ** (title generowany z treści; sam krótki tytuł typu „kup mleko" →
    title). To realizuje AC-3 i „tytuł nadal generowany".
  - **Zastąp** zdanie o „lekkiej redakcji" instrukcją verbatim, np.: *„OPIS (description): wstaw
    DOKŁADNIE oryginalny tekst użytkownika — słowo w słowo, bez zmian. NIE zamieniaj na formę
    bezosobową, NIE poprawiaj gramatyki ani interpunkcji, NIE streszczaj, NIE skracaj, NIE zmieniaj
    znaczenia, NIE pomijaj żadnych faktów/liczb/nazw. Zachowaj oryginalne słowa, ton i literówki. title
    = krótka etykieta (kilka słów) wygenerowana z treści; description = oryginalna treść użytkownika bez
    zmian."* (realizuje AC-1, AC-2).
  - **Bulk add** (sekcja ~linia 309): zostaje mapowanie „jedna pozycja → jedno zadanie"; dopisz, że
    treść pozycji przepisujemy **bez przeredagowania** (realizuje AC-6). Reguła verbatim z sekcji
    `create_task` obowiązuje też per pozycja.
- **W `AICommandSheet.tsx` (prompt zgłoszenia, ~linia 979):** zmień punkt o `params.description` na:
  *„params.description: **oryginalny opis admina bez żadnych zmian** (verbatim — nie przeredagowuj, nie
  poprawiaj), a NASTĘPNIE dołącz poniższy kontekst wskazanego miejsca"*. Punkt o `params.title` (zwięzły
  wygenerowany tytuł) zostaje bez zmian (AC-4, AC-5). Kolejność opis→kontekst zachowana.

## 7. Pliki do utworzenia / zmiany
| Plik | Akcja | Po co |
|------|-------|-------|
| `worldofmag/src/app/api/llm/home/agent/route.ts` | edycja | Sekcja `create_task`: „lekka redakcja" → **verbatim**; zostawić regułę title-z-treści. Dopisać verbatim w regule bulk-add. (AC-1, AC-2, AC-3, AC-6) |
| `worldofmag/src/components/home/AICommandSheet.tsx` | edycja | Prompt zgłoszenia admina: `description` = opis admina **verbatim** + doklejony kontekst; title nadal generowany. (AC-4, AC-5) |
| `worldofmag/src/lib/ai/fastPath.ts` | edycja | **[C-54 — dodane na `/implement`]** Skrócona ścieżka `create_task` też buduje `description` przez LLM (prompt bez wymuszonej redakcji, ale i bez „verbatim"). Dopisana klauzula verbatim dla spójności z promptem agenta. (AC-1, AC-2) |
| `doświadczenia.md` | edycja (append) | Wpis-lekcja wg reguły C-51 (asystent przeredagowywał opis usera — źródło w promptach LLM, nie w kodzie akcji). |

> Uwaga (C-54): jeśli w trakcie implementacji okaże się, że redakcję wymusza jeszcze inne miejsce (np.
> `fastPath.ts` skróconej ścieżki tworzenia zadań), dopisz je do tej tabeli i do `tasks.md`, a w razie
> potrzeby zaktualizuj spec — nie „obchodź" problemu.

## 8. Bramki i weryfikacja (C-50)
- **Zmiana docs/prompt-only w sensie danych, ale dotyka `.ts`** → wykonujemy pełny build lokalnie do
  kroku `next build` (bez `migrate.js` na prod — C-13). Lokalny Postgres wg CLAUDE.md „Database &
  migrations" tylko jeśli build tego wymaga; brak migracji tu nie wymaga zmian w DB.
- `npm run check:migrations` (brak nowej migracji → zielone), `npm run check:actions` (brak nowej akcji
  → zielone), `next lint`, `next build`.
- **Mapowanie AC → weryfikacja** (`/verify`):
  - **AC-1/AC-2/AC-3** — inspekcja finalnego promptu `route.ts`: brak instrukcji „forma
    bezosobowa/popraw gramatykę"; obecna dobitna instrukcja verbatim; **zachowana** reguła generowania
    title z treści. (Weryfikacja treściowa promptu — deterministyczna względem kodu.)
  - **AC-4/AC-5** — inspekcja promptu `AICommandSheet.tsx`: `description` = opis admina verbatim **oraz**
    kontekst wskazanego miejsca (obie części), `title` nadal generowany.
  - **AC-6** — inspekcja reguły bulk-add: mapowanie pozycja→zadanie zachowane + verbatim treści pozycji.
  - (Runtime/LLM: verbatim to zachowanie modelu sterowane promptem; weryfikujemy poprawność **instrukcji**,
    bo to jedyny właściwy punkt kontroli — kod akcji już zapisuje `description` wiernie.)

## 9. Ryzyka techniczne i plan wycofania
- **LLM mimo instrukcji parafrazuje.** Mitygacja: instrukcja dobitna i jednoznaczna (wielkie „NIE",
  słowo „verbatim", „słowo w słowo"). Rollback: zmiana jest w dwóch stringach — rewert commita w pełni
  cofa zachowanie. Brak migracji = brak ryzyka bazodanowego (rollback czysto kodowy).
- **Regresja generowania tytułu** (gdyby przy okazji wyciąć regułę title). Mitygacja: świadomie
  **zostawiamy** regułę TYTUŁ vs TREŚĆ; AC-3/AC-5 to pilnują.
- **Ukryte drugie źródło redakcji** (np. `fastPath`). Mitygacja: `/implement` sprawdza `fastPath.ts` i
  inne ścieżki `create_task`; jeśli redagują — poprawiamy i aktualizujemy artefakty (C-54).

## 10. Zgodność z konstytucją — checklista
- [x] C-10..C-14 (migracje) — **nie dotyczą** (bez zmian w schemacie/DB).
- [x] C-20..C-25 — server/akcje bez zmian; brak nowej `AIAction` (C-23 ok); brak RBAC (C-22 ok); trash/audit nie dotyczą.
- [x] C-30..C-32 — brak zmian wizualnych; teksty promptów po polsku (C-32).
- [x] C-53 — minimalizm: najmniejsza możliwa zmiana (dwa prompty), zero nowych abstrakcji/zależności.
- [x] C-51 — zaplanowany wpis do `doświadczenia.md`.
