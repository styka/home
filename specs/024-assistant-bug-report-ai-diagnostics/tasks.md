# Zadania: Log diagnostyki AI w zgłoszeniu błędu z czatu asystenta

- **Plan:** ./plan.md (024-assistant-bug-report-ai-diagnostics)
- **Status:** todo
- **Data:** 2026-07-23

> Kolejność wg zależności. Brak fazy danych (bez zmian schematu) i AI (bez nowej `AIAction`) — patrz plan.

## Legenda
- `[ ]` do zrobienia · `[x]` zrobione · `[~]` w trakcie · `[!]` zablokowane
- `[P]` — niezależne, można zrównoleglić

## Faza 0 — Fundament danych
- Brak. Feature nie rusza schematu Prisma ani migracji (plan §2). `check:migrations` bez nowego wpisu.

## Faza 1 — Warstwa serwera
- Brak nowej akcji. Reużywamy `getRecentAiCalls` z `src/actions/llmConfig.ts` (admin-gated, plan §3).

## Faza 2 — Współdzielony formatter + zgłoszenie
- [x] **T-1** — Nowy `worldofmag/src/lib/ai/aiCallLog.ts`: `export function fmtAiCallTime(iso)` i
  `export function aiCallsToText(rows: AiCallLogRow[])` — przeniesione 1:1 z `rowsToText`/`fmtTime`
  w `AiCallsPage.tsx` (import typu `AiCallLogRow` z `@/actions/llmConfig`).
  _Gotowe, gdy:_ plik istnieje, eksportuje obie funkcje, format nagłówka+wierszy identyczny jak dotychczas.
- [x] **T-2** — `AiCallsPage.tsx`: podmień lokalne `rowsToText`/`fmtTime` na import z `@/lib/ai/aiCallLog`;
  usuń lokalne kopie. Panel bez zmian wizualnych.
  _Gotowe, gdy:_ panel `/admin/ai-calls` kompiluje się i renderuje tak samo (kopiowanie działa jak wcześniej).
- [x] **T-3** — `AICommandSheet.tsx` — `buildChatProblemReport`: dodaj do `opts` opcjonalne
  `aiCalls?: AiCallLogRow[]` i `aiCallsError?: boolean`; dołóż sekcję **„## Diagnostyka AI (log wywołań
  modelu)"** po „## Logi połączeń z backendem", przed stopką `---`. Zawartość: zdanie kontekstu + blok
  ```` ``` ```` z `trunc(aiCallsToText(rows))`. Adnotacje: `conversationId==null` → „_(rozmowa
  niezapisana — brak identyfikatora; log diagnostyki niedostępny)_"; pusto → „_(brak zarejestrowanych
  wywołań modelu dla tej rozmowy)_"; `aiCallsError` → „_(nie udało się pobrać logu diagnostyki)_".
  (Realizuje AC-2, AC-3, AC-4, AC-5)
  _Gotowe, gdy:_ funkcja przyjmuje log i renderuje sekcję/adnotację; istniejące sekcje nietknięte.
- [x] **T-4** — `AICommandSheet.tsx` — `submitProblemReport`: przed `buildChatProblemReport` pobierz log
  `let aiCalls: AiCallLogRow[] = []; let aiCallsError = false; try { if (conversationId) aiCalls = await
  getRecentAiCalls({ conversationId, limit: 200 }); } catch { aiCallsError = true; }` i przekaż
  `aiCalls`/`aiCallsError` do buildera. Import `getRecentAiCalls`, `type AiCallLogRow` z
  `@/actions/llmConfig`. (Realizuje AC-1)
  _Gotowe, gdy:_ zgłoszenie zawiera pobrany log; wyjątek pobrania nie wywraca tworzenia zadania (AC-3).

## Faza 3 — AI / integracje
- Nie dotyczy (brak nowej `AIAction`/read-toola; `check:actions` bez zmian).

## Faza 4 — Bramki i domknięcie
- [x] **T-5** — Bramki zielone: `check:migrations` (następny wolny 0209), `check:actions` (159 akcji,
  wszystkie obsłużone), `next lint` (tylko istniejące ostrzeżenia, brak w zmienianych plikach),
  `next build` skompilował się poprawnie (lokalny Postgres, C-13 — nie ruszaliśmy prod DB).
- [x] **T-6** — Mapowanie AC → wynik (input do `/verify`), patrz niżej.
- [~] **T-7** — Wpis do `doświadczenia.md` — pominięty: implementacja przebiegła bez nieoczywistego
  problemu/buga (C-51 wymaga wpisu tylko przy takim). Nie ma czego opisać.

## Mapowanie kryteriów akceptacji
| AC | Zadanie(a) | Sposób weryfikacji |
|----|-----------|--------------------|
| AC-1 (log dołączony) | T-4 | Rozmowa z wywołaniami → zgłoszenie → sekcja diagnostyki w opisie zadania. |
| AC-2 (te same pola co panel) | T-1, T-3 | Wspólny formatter; porównanie z `/admin/ai-calls` po `conversationId`. |
| AC-3 (brak danych / brak id / błąd) | T-3, T-4 | Zgłoszenie ze świeżej rozmowy/bez wywołań → adnotacja, brak wyjątku. |
| AC-4 (dotychczasowa treść nietknięta) | T-3 | Sekcje opis/zrzut/log klienta/stopka bez zmian. |
| AC-5 (skrócenie długiego logu) | T-3 | Długi log → widoczne „…(ucięto)". |

## Ścieżka krytyczna
T-1 → T-2 (formatter musi istnieć, zanim panel go zaimportuje) oraz T-1 → T-3 → T-4 (builder używa
formattera; `submitProblemReport` woła builder). T-2 i (T-3→T-4) są względem siebie niezależne po T-1.
T-5..T-7 na końcu.

## Notatki / blokady
- Brak.
