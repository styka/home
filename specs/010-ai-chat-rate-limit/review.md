# Recenzja: Odporność asystenta AI na limity szybkości (rate limit / 429)

- **Spec:** ./spec.md · **Plan:** ./plan.md · **Verify:** ./verify.md
- **Data:** 2026-07-19
- **Zakres diffa:** `worldofmag/src/lib/llm/chat.ts` (+76), `worldofmag/src/app/api/llm/home/agent/route.ts`
  (+12/-1), `doświadczenia.md`, `specs/010-ai-chat-rate-limit/*`.

## Ustalenia (od najpoważniejszego)

Brak ustaleń correctness/security/convention wymagających zmian. Poniżej obserwacje (nie-blokujące):

1. **`chat.ts:139-141` — martwy kod domykający pętlę** · kategoria: simplification.
   Ostatni `if (netErr) throw netErr; return fetch(url, init);` jest nieosiągalny (pętla
   `for attempt 0..LLM_MAX_RETRIES` zawsze zwraca przy `attempt === LLM_MAX_RETRIES` w `:130` albo
   rzuca w `:128`). Skutek: żaden — TS wymaga domknięcia funkcji zwracającej `Promise<Response>`.
   Komentarz to wyjaśnia. Zostawiam bez zmian (bezpieczniejsze niż `throw new Error("unreachable")`).

2. **Kumulacja opóźnień pod trwałym limitem** · kategoria: correctness (rozważone, brak defektu).
   Scenariusz: dostawca zwraca 429 na wszystkie próby. `fetchWithRetry` odczeka do 2× (cap 8 s każde) =
   ~16 s dla jednego modelu, potem funkcja dostawcy zwraca `{ok:false,status:429}`. W pętli agenta
   `callAgent` **rzuca** przy 429 → `runAgentLoop` łapie i **od razu kończy** (nie przechodzi do kolejnej
   iteracji), więc opóźnienie NIE mnoży się przez `MAX_ITERATIONS`. Górne ograniczenie na żądanie jest
   więc rozsądne (retry jednego modelu + ewentualny fallback na kolejny). Render to długo-żyjący Node
   (nie serverless z krótkim timeoutem) — zgodne z założeniem planu §9. Brak zmiany.

## Poprawność (przelot)
- ✅ `init` (RequestInit) reużywany między próbami jest bezpieczny — `body` to **string** (JSON), nie
  strumień; brak problemu „body already consumed".
- ✅ Ponawianie tylko dla `isRetryableLlmStatus` (429/≥500) i rzuconego `fetch`; 4xx≠429 zwracane
  natychmiast (AC-5).
- ✅ Łańcuch fallbacku (`chatComplete`/`chatStream` pętla po `chain`) nietknięty — retry zagnieżdżony
  w pojedynczym wywołaniu (AC-6).
- ✅ Streaming: status sprawdzany **przed** konsumpcją `body`; sukces (200) zwracany od razu bez
  dotykania strumienia.
- ✅ `res.body?.cancel()` zwalnia ciało odrzuconej odpowiedzi przed ponowieniem (brak wycieku).

## Konwencje Omnia
- ✅ C-01 (praca w `worldofmag/`), C-40 (brak hardcode providera/modelu — działa na `cfg` z resolvera),
  C-41 (komunikat użytkownika to nasz polski tekst, surowa treść dostawcy nie przepisywana), C-32
  (polski komunikat), C-53 (minimalizm — jeden helper + jedno mapowanie, zero nowych zależności).
- ✅ Brak enumów Prisma, brak zmian schematu/RBAC/UI — nie dotyczą.

## Bezpieczeństwo
- ✅ Brak logowania/zwracania klucza API. Komunikat 429 dla użytkownika nie zawiera treści dostawcy.
- ✅ Brak nowych ścieżek uprawnień; bramki `checkRateLimit`/`checkAiBudget` w route nietknięte.

## Werdykt
**APPROVE.** Zmiana poprawna, minimalna, zgodna z konstytucją; wszystkie AC pokryte (patrz `verify.md`),
bramki zielone. Obserwacje 1–2 są nie-blokujące i świadomie zaakceptowane. Domykam: merge do `develop`.
