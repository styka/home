# Recenzja: Rozmowa głosowa działa na Safari/iPhone

- **Spec/Plan/Verify:** ./spec.md · ./plan.md · ./verify.md (007-voice-safari-ios)
- **Data:** 2026-07-16
- **Zakres diffa (feature, 007-only, `4a1b66e..HEAD`):** `src/lib/tts.ts` (+38),
  `src/components/home/AICommandSheet.tsx` (+17→+~24 po poprawce), `doświadczenia.md`, artefakty `specs/007-*`.

## Ustalenia (od najpoważniejszego)

### 1. [correctness/UX] Opóźniony restart (250ms) ubijał nasłuch przy barge-in — **NAPRAWIONE w recenzji**
- **Plik:** `AICommandSheet.tsx` — `onEnd` w `voiceAnnounce` i w sterowniku pętli (speak).
- **Opis:** Barge-in („Przerwij") wywołuje synchronicznie `startListening()` **i** `stopSpeaking()`;
  anulowanie wypowiedzi odpala `onEnd` mowy, który planował **kolejny** restart (`scheduleListen`,
  250ms) — a ten po 250ms przerywał mikrofon, do którego użytkownik już mówił.
- **Scenariusz awarii:** Asystent mówi → użytkownik dotyka „Przerwij" i zaczyna mówić → po ~250ms
  nasłuch restartuje, gubiąc początek wypowiedzi (trzeba powtarzać).
- **Poprawka (naniesiona):** oba `onEnd` wznawiają nasłuch **tylko** gdy stan to nadal `"speaking"`
  (naturalny koniec mowy); po barge-in stan jest już `"listening"` → pomijamy zbędny restart. Kontekst
  clarify (`pendingClarifyRef`) zachowany także po barge-in. Build/lint zielone.

### 2. [minor] `speak()` `resume()` po `speak()` — wpływ na inne użycia
- **Plik:** `tts.ts` — `speak()` dodaje `warmVoices()` + `resume()`.
- **Opis:** `@/lib/tts` `speak()` jest też używane przez odczyt pojedynczych postów (spec 004). `resume()`
  jest **idempotentne** (no-op gdy nie „paused"), `warmVoices()` jednorazowe i guardowane — brak wpływu na
  odczyt na Chrome/desktop; na iOS wręcz pomaga. **Werdykt:** bezpieczne; bez zmian.

### 3. [minor/known-risk] Gest per-wypowiedź na części wersji iOS
- **Opis:** Priming odblokowuje syntezę na sesję na większości aktualnych iOS; skrajne wersje bywają
  surowsze (mogą chcieć gestu przy każdej wypowiedzi) → wtedy odpowiedzi po pierwszej turze mogłyby
  zamilknąć. To znany, wąski limit platformy (odnotowany w spec §9), nie „Chrome-only". **Werdykt:**
  poza zakresem kodu; weryfikacja na realnym iPhone.

## Zgodność z konwencjami Omnia
- **C-01/C-02** — ✅ praca w `worldofmag/`, importy `@/*`.
- **C-12** — ✅ brak enumów; `VoiceState` String-union.
- **C-20..C-23** — ✅ brak mutacji/akcji/`AIAction`; `check:actions` zielone.
- **C-30/C-31/C-32** — ✅ brak nowych elementów UI; teksty/komentarze PL; mobile-first (iPhone celem).
- **C-40/C-41** — ✅ bez zmian w routingu modeli/kluczach; brak logowania czegokolwiek wrażliwego.
- **C-53** — ✅ 2 pliki + drobna poprawka; reuse pętli/helpera STT z 005/006; **zero** nowych zależności;
  **bez UA-sniffingu** (grep potwierdza: tylko komentarze „iOS/Safari", zero logiki `navigator.*`) —
  wykrywanie po istnieniu API.
- **C-54** — ✅ 007 koryguje błędne założenie 005/006 („tylko Chrome"); artefakty spójne.
- **Bezpieczeństwo** — ✅ brak kluczy/logów; brak nowego renderu HTML; mowa przez `speechTextFromMarkdown`.

## Regresje
- **`@/lib/tts` `speak()`** — publiczne API bez zmian; `warmVoices`/`resume` bezpieczne (idempotentne).
  Odczyt pojedynczych postów (004) i pętla głosowa (005/006) działają jak dotąd.
- **Pętla głosowa** — pierwszy start i barge-in synchroniczne (gest); tylko programowe restarty +250ms,
  a po poprawce nr 1 nie kolidują z barge-in. Logika kart/korekty (006) nietknięta.
- **Ścieżka pisana / Chrome** — bez regresu; build (128 stron) + type-check zielone.

## Werdykt
**APPROVE Z UWAGAMI.** Jedna realna usterka (nr 1 — barge-in vs opóźniony restart) znaleziona i
**naprawiona w recenzji**; build/lint/type-check zielone po poprawce. Uwagi nr 2–3 bezpieczne/znane.
Wszystkie 8 AC pokryte. Faktyczne działanie mowy na iPhone (Safari) do potwierdzenia **na urządzeniu**
(Web Speech poza CI) — jak w `verify.md`.
