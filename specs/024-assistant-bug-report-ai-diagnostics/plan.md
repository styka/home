# Plan techniczny: Log diagnostyki AI w zgłoszeniu błędu z czatu asystenta

- **Spec:** ./spec.md (024-assistant-bug-report-ai-diagnostics)
- **Status:** draft
- **Data:** 2026-07-23

> **Zasada planu:** to jest **JAK**, pod istniejący kod. Wzorzec do naśladowania: istniejące zgłaszanie
> błędów z czatu (`AICommandSheet.submitProblemReport` + `buildChatProblemReport`) oraz panel
> „Diagnostyka asystenta AI" (`AiCallsPage` + `getRecentAiCalls`).

## 1. Podejście (2–4 zdania)
Zgłaszanie błędu z czatu już buduje markdown-owy opis zadania (`buildChatProblemReport`) i tworzy z niego
zadanie w projekcie „Omnia" (`submitProblemReport`, admin-only). Dokładamy jedną rzecz: w
`submitProblemReport` **pobieramy serwerowy log wywołań modelu** dla bieżącej rozmowy przez istniejący,
admin-gated Server Action `getRecentAiCalls({ conversationId })` i dołączamy go jako nową sekcję opisu.
Żeby format sekcji był identyczny z tym, co widzi admin w panelu (AC-2), **wyodrębniamy współdzielony
formatter** logu z `AiCallsPage.tsx` do `src/lib/ai/aiCallLog.ts` i używamy go w obu miejscach. Zero
zmian schematu, zero nowych zależności, zero nowej `AIAction`.

## 2. Model danych (Prisma)
**Bez zmian w schemacie.** Feature korzysta wyłącznie z istniejącej tabeli `AiCall` (log wywołań LLM)
przez istniejącą akcję odczytu. Brak migracji.

## 3. Warstwa serwera (Server Actions — C-20)
- **Bez nowej akcji.** Reużywamy `getRecentAiCalls({ conversationId?, limit? }): Promise<AiCallLogRow[]>`
  z `src/actions/llmConfig.ts` — już `requireAdmin()`-gated, zwraca też wywołania nieudane
  (`status`/`errorText`/`attempts`). To odczyt, więc brak `revalidatePath` (nic nie mutujemy poza
  istniejącym `createTask` w zgłoszeniu, które już robi swoje `revalidatePath`).
- Wywołanie z klienta: `getRecentAiCalls({ conversationId, limit: 200 })` — filtr po rozmowie, spójnie z
  panelem diagnostyki (limit jak „Odśwież" w panelu).

## 4. RBAC / rejestr modułu (C-22)
- **Slug bez zmian.** Zgłaszanie błędów z czatu (`showReport`/ikona `Bug`) jest już admin-only
  (`AICommandSheet` renderuje panel tylko dla `isAdmin`), a `getRecentAiCalls` wymusza `requireAdmin()`.
  Reżim dostępu bez zmian — brak wpięć w `permissions.ts`/`modules.tsx`/`ModuleSidebar`.

## 5. UI (C-30, C-31, C-32)
- Brak nowych tras/stron/komponentów. Zmiana w istniejącym `src/components/home/AICommandSheet.tsx`:
  - `submitProblemReport()` (async) — **przed** złożeniem opisu pobiera log diagnostyki:
    `let aiCalls: AiCallLogRow[] = []; try { if (conversationId) aiCalls = await getRecentAiCalls({ conversationId, limit: 200 }); } catch { /* brak — anotacja w raporcie */ }`
    a `hadFetchError` odróżnia „brak danych" od „nie udało się pobrać".
  - `buildChatProblemReport(opts)` — nowy opcjonalny wkład `aiCalls` (+ flaga błędu pobrania). Dokłada
    sekcję **„## Diagnostyka AI (log wywołań modelu)"** po istniejącej „## Logi połączeń z backendem",
    a przed stopką `---`. Zawartość: krótkie zdanie kontekstu + blok ```` ``` ```` z tekstem z
    współdzielonego formattera. Gdy `conversationId == null` → adnotacja „_(rozmowa niezapisana — brak
    identyfikatora; log diagnostyki niedostępny)_"; gdy pusto → „_(brak zarejestrowanych wywołań modelu
    dla tej rozmowy)_"; gdy błąd pobrania → „_(nie udało się pobrać logu diagnostyki)_". (AC-3, AC-4)
  - Skrócenie długiego logu: formatter zwraca tekst, który przepuszczamy przez istniejące `trunc(...)`
    (z wyraźnym „…(ucięto)") przed wstawieniem do bloku kodu. (AC-5)
- **Współdzielony formatter** `src/lib/ai/aiCallLog.ts`:
  - `export function aiCallsToText(rows: AiCallLogRow[]): string` — przeniesiony 1:1 z `rowsToText`
    w `AiCallsPage.tsx` (nagłówek + wiersze pipe-delimited: czas | źródło | op | dostawca | model | ok |
    status | próby | prompt+compl=total | latency | conversationId | błąd). (AC-2)
  - `export function fmtAiCallTime(iso: string): string` — przeniesiony `fmtTime`.
  - `AiCallsPage.tsx` importuje oba i usuwa lokalne kopie (bez zmiany wyglądu panelu).
- Teksty PL, brak nowych kolorów/hexów (zmiana głównie w treści opisu zadania). Bez wpływu na mobile.

## 6. AI / integracje (C-23, C-40)
- **Nie dotyczy.** Brak nowej `AIAction` (zgłoszenie tworzone bezpośrednio przez `createTask`, nie przez
  pętlę agenta) → `check:actions` nie dotyczy. Bez zmian w routingu modeli. Bez kalendarza/powiadomień.

## 7. Pliki do utworzenia / zmiany
| Plik | Akcja | Po co |
|------|-------|-------|
| `worldofmag/src/lib/ai/aiCallLog.ts` | nowy | Współdzielony formatter logu `AiCall` (`aiCallsToText`, `fmtAiCallTime`) — jedno źródło formatu dla panelu i zgłoszenia (AC-2). |
| `worldofmag/src/components/admin/AiCallsPage.tsx` | edycja | Import `aiCallsToText`/`fmtAiCallTime` z libа; usunięcie lokalnych `rowsToText`/`fmtTime` (bez zmiany UI). |
| `worldofmag/src/components/home/AICommandSheet.tsx` | edycja | `submitProblemReport` pobiera `getRecentAiCalls({conversationId})`; `buildChatProblemReport` dokłada sekcję diagnostyki AI; import `getRecentAiCalls`/`AiCallLogRow` i formattera. |

## 8. Bramki i weryfikacja (C-50)
- Lokalna weryfikacja przez `next build` (lokalny Postgres, C-13 — nigdy prod DB). Brak migracji, więc
  `check:migrations` bez nowego wpisu; brak nowej `AIAction`, więc `check:actions` bez zmian.
- `next lint` + `next build` muszą przejść (typy: `AiCallLogRow` import w komponencie klienta jest OK —
  to tylko typ + wywołanie server action).
- Mapowanie AC → weryfikacja:
  - **AC-1/AC-2** — po rozmowie z wywołaniami: kliknij ikonę robaczka → utwórz zgłoszenie → opis zadania
    zawiera sekcję „Diagnostyka AI (log wywołań modelu)" z polami jak w panelu `/admin/ai-calls`.
    Kontrolnie: porównaj z panelem po wklejeniu tego `conversationId`.
  - **AC-3** — zgłoszenie ze świeżej rozmowy bez `conversationId` oraz rozmowy bez wywołań → zadanie
    powstaje, sekcja z adnotacją o braku danych; brak wyjątku.
  - **AC-4** — istniejące sekcje (opis/zrzut/log klienta/stopka) niezmienione; nowa sekcja dodana.
  - **AC-5** — sztucznie długi log → widoczne „…(ucięto)"; opis pozostaje czytelny.

## 9. Ryzyka techniczne i plan wycofania
- **Wywołanie server action z klienta w bloku try/catch** — jeśli `requireAdmin()` odrzuci (teoretycznie),
  łapiemy błąd i wstawiamy adnotację; zgłoszenie nie pada (AC-3). Mitygacja: panel i tak admin-only.
- **Drift formatu panel↔zgłoszenie** — wyeliminowany współdzielonym formatterem (jedno źródło). 
- **Rozmiar opisu zadania** — ograniczony `trunc()` (AC-5).
- **Rollback:** czysto kodowy (brak migracji) — rewert 3 plików przywraca stan sprzed zmiany.

## 10. Zgodność z konstytucją — checklista
- [x] C-10..C-14 (migracje) — **nie dotyczy** (brak zmian schematu), świadomie odnotowane.
- [x] C-20..C-25 — reużycie istniejącej admin-gated akcji odczytu; brak nowej mutacji/AIAction/trash/audit.
- [x] C-30..C-32 — teksty PL, brak hardcoded hexów, brak wpływu na mobile/sidebar.
- [x] C-53 — minimalizm: 1 nowy mały plik-formatter (uzasadniony spójnością AC-2) + edycja 2 plików; bez nowych zależności/abstrakcji.
