# Weryfikacja: Odporność asystenta AI na limity szybkości (rate limit / 429)

- **Spec:** ./spec.md · **Plan:** ./plan.md · **Tasks:** ./tasks.md
- **Data:** 2026-07-19

## Bramki techniczne
| Komenda | Wynik |
|---------|-------|
| `npm run check:migrations` | ✅ „Numeracja migracji OK (następny wolny numer: 0206)." (brak nowych migracji) |
| `npm run check:actions` | ✅ „95 akcji w katalogu, wszystkie obsługiwane przez executor." |
| `npx next lint --dir src` (pliki zmienione) | ✅ exit 0 — brak błędów/ostrzeżeń w `chat.ts` i `agent/route.ts` (widoczne tylko wcześniej istniejące, kosmetyczne warny w innych plikach) |
| `next build` | ✅ exit 0 (uruchomione z placeholder `DATABASE_URL`, bez `migrate.js`/prod DB — C-13) |
| `tsc --noEmit` | ✅ exit 0 (po `npm install` + `prisma generate`) |

> C-13: nie uruchamiano `npm run build` w całości (jego ostatni krok `migrate.js` rusza prod DB). Weryfikacja
> do kroku `next build`, który przeszedł.

## Kryteria akceptacji
- **AC-1** — auto-retry przy 429 → sukces po ponowieniu.
  ✅ Dowód: `chat.ts:116-138` — przy 429 (przejściowy) i `attempt < LLM_MAX_RETRIES` pętla odczekuje i
  ponawia ten sam request; kolejna próba z 200 trafia w `res.ok` (`:130`) → zwrot sukcesu. Ścieżka
  „429 raz, potem 200" kończy się poprawną odpowiedzią bez błędu do UI.
- **AC-2** — respekt `Retry-After` + ograniczone próby.
  ✅ Dowód: `retryAfterMs` (`chat.ts:89-103`) czyta nagłówek (sekundy lub data HTTP), waliduje na
  rozsądny dodatni zakres (≤300 s), inaczej `null` → backoff wykładniczy z jitterem (`:106-110`).
  Oczekiwanie capowane: pętla `for attempt 0..LLM_MAX_RETRIES` (max 3 próby), a `wait > LLM_RETRY_CAP_MS`
  (8 s) przerywa ponawianie tego modelu (`:135`). Nie zapętla się.
- **AC-3** — łagodny komunikat, brak surowego tekstu dostawcy.
  ✅ Dowód: `agent/route.ts` (`runAgentLoop` catch) — `status === 429` → stały polski komunikat
  „Asystent jest teraz przeciążony (chwilowy limit zapytań do modelu). Spróbuj ponownie za chwilę."
  Surowa treść dostawcy nie trafia do `body.error`. (Grep: brak „Rate limit reached" w kodzie.)
- **AC-4** — spójność w trybie strumieniowym (SSE).
  ✅ Dowód: oba tryby route’a wołają `runAgentLoop`; ten sam `result.body.error` idzie do
  `NextResponse.json` (zwykły) oraz `send({ type:"final", status, body })` (SSE). Klient
  `AICommandSheet` renderuje `body.error`/`data.error` identycznie (≈`:821`/`:830`). Jedno miejsce
  mapowania → spójność.
- **AC-5** — brak ponawiania błędów nieprzejściowych (4xx ≠ 429).
  ✅ Dowód: `isRetryableLlmStatus` = `429 || ≥500` (`chat.ts:11-13`); dla 400/401/403 warunek
  `!isRetryableLlmStatus(res.status)` w `:130` powoduje natychmiastowy zwrot (bez zwłoki/ponawiania).
- **AC-6** — fallback bez regresji.
  ✅ Dowód: retry jest zagnieżdżony w `fetchWithRetry` wewnątrz pojedynczego wywołania modelu; po jego
  wyczerpaniu funkcja dostawcy zwraca `{ok:false,status:429}`, a `chatComplete`/`chatStream` nadal
  iterują po `chain` (`:102-131` / `:301-312`) i próbują kolejnego modelu — jak wcześniej. Retry jest
  uzupełnieniem, nie zamiennikiem łańcucha.

## Zgodność z konstytucją
- **C-01** ✅ zmiana wyłącznie w `worldofmag/`.
- **C-40** ✅ retry/fallback operują na `cfg` z `resolveLlmChain` — bez hardcode providera/modelu.
- **C-41** ✅ komunikat użytkownika to nasz stały tekst po polsku; surowa treść dostawcy nie jest
  przepisywana (brak ryzyka wycieku klucza/szczegółów).
- **C-32** ✅ komunikat po polsku.
- **C-53** ✅ minimalizm: jeden helper + jedno mapowanie komunikatu; zero nowych zależności; brak
  refaktorów „przy okazji".
- **C-10..C-12** ✅ nie dotyczy (brak zmian schematu/migracji).
- **C-51** ✅ wpis w `doświadczenia.md`.

## Regresje
- `chat.ts` używany przez wszystkie typowane wywołania LLM (notes/tasks/kitchen…). `fetchWithRetry`
  **nie zmienia** ścieżki sukcesu (zwraca `res` natychmiast gdy `res.ok`) ani błędów nieprzejściowych
  (zwrot natychmiastowy) — dokłada wyłącznie ponawianie dla 429/5xx/sieci. Brak regresji funkcjonalnej.
- Strumień: dla odpowiedzi 200 `fetchWithRetry` zwraca się bez konsumpcji `body` → streaming działa jak
  dotąd; dla 429 status sprawdzany **przed** czytaniem body, więc retry nie psuje strumienia.
- Bramki AI (`checkAiBudget`, `checkRateLimit`) i `revalidatePath`/RBAC nietknięte.

## Werdykt końcowy
**GOTOWE.** Wszystkie AC-1..AC-6 spełnione, bramki (check:migrations, check:actions, lint, next build,
tsc) zielone, brak wykrytych regresji. Przechodzę do `/review`.
