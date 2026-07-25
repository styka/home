# Review: Niezawodność i efektywność kosztowa asystenta AI

- **Spec:** ./spec.md (030-assistant-reliability-cost)
- **Data:** 2026-07-25
- **Zakres:** diff `origin/develop..HEAD` — 10 plików, +456/−41 (agent route, `lib/ai/agentProtocol`
  [nowy], `agentContext`, `agentTools`, `fastPath`, `recurrence` + testy + `doświadczenia.md`).

## Ustalenia (od najpoważniejszego)

1. **`route.ts` (klasyfikacja prostej tury) — simplification — POPRAWIONE w review.**
   `SIMPLE_READ_ANALYTIC_RE` była definiowana wewnątrz `POST` (rekompilacja przy każdym requeście,
   niezgodnie ze stylem pliku, gdzie stałe regexy żyją na poziomie modułu — por. `KEYWORD_ROUTES`).
   Przeniesiona na poziom modułu; `tsc --noEmit` czysty. Skutek przed poprawką: pomijalny
   wydajnościowo, czysto stylistyczny.

2. **`route.ts:877` (READ_INTENT_RE zawiera „przypomnij") — observation, bez zmiany.**
   Polecenie typu „przypomnij mi jutro o X" (intencja: utworzenie przypomnienia, czyli krok `plan`)
   klasyfikuje się jako prosta tura odczytowa i pójdzie na model dispatch. Scenariusz awarii:
   słabszy model może zbudować gorszy plan akcji — ale plan i tak przechodzi przez panel
   potwierdzenia użytkownika (ActionDrawer), a porażka formatu/limitu uruchamia fallback do
   reasoning. Ryzyko niskie, koszt złego wyboru ograniczony potwierdzeniem — zostawiam,
   do obserwacji na env testowym (spójne z uwagami w verify.md).

3. **`agentContext.ts` (marker skrótu wskazuje get_task/get_note) — observation, bez zmiany.**
   Marker `…[SKRÓCONO … pełna treść: get_task/get_note po id]` dokleja się także do wyników innych
   narzędzi (np. `get_recipe`), gdzie wskazówka jest nie wprost. Skutek: co najwyżej neutralna
   podpowiedź; pełne narzędzia „get_*" i tak są właściwą drogą po całość. Zgodne z minimalizmem
   (C-53) — jeden marker zamiast mapy per narzędzie.

Poza tym: guardy dostępu read-tooli nietknięte (C-21), zero nowych `AIAction` (C-23 — bramka
zielona), zero migracji (C-10..C-14 n/d), zero zmian UI (C-30/C-31 n/d), wszystkie nowe teksty PL
(C-32), routing modeli DB-driven przez op-type (C-40), błędy dostawcy nadal nie przeciekają do UI
(C-41), brak nowych zależności (C-53). Salvage/degradacja nie omija potwierdzania akcji — krok
`answer` z definicji nie niesie akcji mutujących (zgodnie z decyzją właściciela w spec §8).
Deduplikacja żyje wyłącznie w obrębie jednej tury, więc nie maskuje świeżości danych po mutacjach.

## Werdykt

**APPROVE** (ustalenie 1 poprawione w ramach review; 2–3 to obserwacje bez ryzyka blokującego).
Zgodnie z C-52: merge do `develop` → push → automatyczna promocja `develop → master` po kontroli
integralności.
