# Weryfikacja: Log diagnostyki AI w zgłoszeniu błędu z czatu asystenta

- **Spec:** ./spec.md · **Plan:** ./plan.md · **Tasks:** ./tasks.md
- **Data:** 2026-07-23

## Bramki techniczne (C-50)
| Komenda | Wynik |
|--------|-------|
| `npm run check:migrations` | ✅ „Numeracja migracji OK (następny wolny numer: 0209)". Brak nowej migracji (feature bez zmian schematu) — zgodnie z planem. |
| `npm run check:actions` | ✅ „159 akcji w katalogu, wszystkie obsługiwane przez executor". Brak nowej `AIAction`. |
| `npm run lint` (`next lint`) | ✅ Tylko istniejące ostrzeżenia (img/exhaustive-deps) w niepowiązanych plikach; **zero** ostrzeżeń/błędów w `aiCallLog.ts`, `AiCallsPage.tsx`, `AICommandSheet.tsx`. |
| `next build` (lokalny Postgres, C-13) | ✅ „Compiled successfully" — pełna lista tras wygenerowana; typy przeszły (import `AiCallLogRow`/`getRecentAiCalls` w komponencie klienta OK). Prod DB nietknięta. |

## Kryteria akceptacji
- **AC-1 (log dołączony)** — ✅. `submitProblemReport` (`AICommandSheet.tsx:719–724`): gdy jest
  `conversationId`, woła `getRecentAiCalls({ conversationId, limit: 200 })` i przekazuje `aiCalls` do
  `buildChatProblemReport`. Builder dokłada sekcję „## Diagnostyka AI (log wywołań modelu)" z blokiem
  kodu (`AICommandSheet.tsx`, sekcja przed stopką `---`).
- **AC-2 (te same pola co panel)** — ✅. Format pochodzi ze **wspólnego** `aiCallsToText`
  (`src/lib/ai/aiCallLog.ts`), używanego zarówno przez zgłoszenie, jak i przez „Kopiuj" w
  `AiCallsPage.tsx` (`copyAll` → `aiCallsToText(rows)`). Nagłówek + kolumny identyczne (czas | źródło |
  op | dostawca | model | ok | status | próby | tokeny | latency | conversationId | błąd), w tym
  wywołania nieudane (`ok=FAIL`, `status`, `errorText`).
- **AC-3 (brak danych / brak id / błąd pobrania)** — ✅. Trzy jawne gałęzie w builderze: `aiCallsError`
  → „_(nie udało się pobrać logu diagnostyki)_"; `!conversationId` → „_(rozmowa niezapisana…)_";
  pusty log → „_(brak zarejestrowanych wywołań modelu dla tej rozmowy)_". Pobranie owinięte w
  try/catch (`aiCallsError=true`), a `createTask` wykonuje się niezależnie — zgłoszenie nie pada.
- **AC-4 (dotychczasowa treść nietknięta)** — ✅. Zmiana wyłącznie **dodaje** sekcję przed `out.push("\n---")`;
  sekcje „## Opis problemu", „## Ostatni błąd", „## Zrzut rozmowy", „## Logi połączeń z backendem"
  i stopka pozostały bez modyfikacji (diff dotyka tylko nagłówka funkcji, sygnatury `opts` i wstawki).
- **AC-5 (skrócenie długiego logu)** — ✅. `trunc(aiCallsToText(aiCalls), 8000)` — istniejący helper
  `trunc` dokleja „…(ucięto)" po przekroczeniu limitu.

## Zgodność z konstytucją
- **C-10..C-14** — nie dotyczy (brak zmian schematu/migracji), świadomie.
- **C-20** — brak nowej mutacji; reużyty admin-gated **odczyt** `getRecentAiCalls` (bez `revalidatePath`,
  bo nic nie mutujemy poza istniejącym `createTask`).
- **C-22** — reżim admin-only zachowany (panel zgłoszenia admin-only + `requireAdmin()` w akcji).
- **C-23** — nie dotyczy (brak nowej `AIAction`).
- **C-30/C-32** — teksty PL, brak hardcoded hexów; zmiana głównie w treści opisu zadania.
- **C-53** — minimalizm: 1 nowy mały plik (formatter, uzasadniony spójnością AC-2) + edycje 2 plików,
  bez nowych zależności/abstrakcji.

## Regresje
- **`/admin/ai-calls`** — panel dalej działa: `copyAll` używa `aiCallsToText`, komórki czasu używają
  `fmtTime` (alias `fmtAiCallTime`); oba zaimportowane z libа, lokalne kopie usunięte. Build/typy
  potwierdzają brak zerwanych referencji. Wygląd i zachowanie bez zmian (funkcje przeniesione 1:1).
- **Zgłaszanie błędów z czatu** — pozostała ścieżka (`ensureOmniaProject` → `createTask`) niezmieniona.
- Brak wpływu na inne moduły (zmiana lokalna, brak wspólnej migracji/RBAC).

## Werdykt końcowy
**GOTOWE.** Wszystkie AC spełnione z dowodem w kodzie, wszystkie bramki zielone, brak regresji.
