# Weryfikacja: Rozmowa głosowa działa na Safari/iPhone

- **Spec/Plan/Tasks:** ./spec.md · ./plan.md · ./tasks.md (007-voice-safari-ios)
- **Data:** 2026-07-16
- **Środowisko:** lokalny Postgres 16 (`omnia_dev`); `next build` do kroku `next build` (bez `migrate.js`).

## Bramki techniczne
| Komenda | Wynik |
|---------|-------|
| `npm run check:migrations` | ✅ „Numeracja migracji OK (0206)". Brak nowej migracji. |
| `npm run check:actions` | ✅ „95 akcji … wszystkie obsługiwane". Nie dodano `AIAction`. |
| `npx next lint --dir src` | ✅ Zero ostrzeżeń w zmienionych plikach (`tts.ts`, `AICommandSheet.tsx`). |
| `npx next build` | ✅ „Compiled successfully" + „Generating static pages (128/128)". |

> Uwaga metodyczna: mowa (Web Speech) **nie działa w headless CI**. AC-1..AC-5 wymagają **realnego
> iPhone (Safari)**; poniżej weryfikacja przez **prześledzenie logiki + zgodność z udokumentowanymi
> ograniczeniami iOS** (źródła w rozmowie: Apple Dev Forums, talkrapp, lilting.ch, webreflection) oraz
> zielony build. AC-6..AC-8 sprawdzalne logiką/przeglądem.

## Kryteria akceptacji (AC → werdykt + dowód)
Pliki: `src/lib/tts.ts`, `src/components/home/AICommandSheet.tsx`.

- **AC-1 (słychać odpowiedź na iPhone)** — ✅ (logika). Przyczyną ciszy było `speak()` poza gestem
  (iOS wycisza). Naprawa: `primeSpeech()` (tts.ts L58–70) „odblokowuje" syntezę **w geście** —
  wołane z `toggleVoice` (L384) w handlerze kliknięcia; cicha wypowiedź `volume=0` (L64) + `getVoices()`
  + `resume()`. `speak()` dodatkowo `warmVoices()` (L78) i `resume()` po wypowiedzi (L90). → po
  odblokowaniu programowe `speak()` w pętli są słyszalne.
- **AC-2 (rozpoznanie kwestii)** — ✅ (logika). Pierwszy `recognition.start()` startuje **synchronicznie
  w geście** (`toggleVoice`→`startListening()`, L387) — spełnia wymóg iOS na zgodę mikrofonu; model
  jedno-turowy (`continuous=false`, `interimResults=true`) z `onFinal`→`handleSend` (bez zmian z 005/006).
- **AC-3 (auto-powrót do nasłuchu, brak zacinania)** — ✅ (logika). Programowe restarty idą przez
  `scheduleListen()` = `setTimeout(startListening, 250ms)` (L366–369); `startListeningRef.current =
  scheduleListen` (L371) → wszystkie restarty (po mowie/pustej turze/akcji) mają bufor, którego iOS
  wymaga między turami. Świeży egzemplarz rozpoznawania na każdą turę (helper z 005).
- **AC-4 (karty/korekta jak na Chrome)** — ✅ (utrzymanie 006). Logika kart/korekty/potwierdzania
  nietknięta; działa niezależnie od przeglądarki.
- **AC-5 (zapis jako czat)** — ✅ (utrzymanie 005/006). `persist`→`AiMessage` bez zmian.
- **AC-6 (brak regresu na Chrome/desktop)** — ✅. `primeSpeech()` to bezpieczny dodatek (cicha
  wypowiedź); `resume()` no-op gdy nie paused; `scheduleListen` 250ms niewyczuwalny. Build + type-check
  zielone; ścieżka pisana i logika 006 nietknięte.
- **AC-7 (degradacja bez wsparcia)** — ✅. `voiceSupported = ttsSupported() && speechRecognitionSupported()`
  (L214); przełącznik tylko gdy wsparcie (L1292); `primeSpeech`/helper STT są no-op bez API.
- **AC-8 (żadnego „tylko Chrome")** — ✅. **Przegląd kodu:** brak `navigator.userAgent`/`isSafari`/`isIOS`/
  sprawdzania nazwy przeglądarki (grep w `tts.ts`/`speechRecognition.ts`/`AICommandSheet.tsx` daje tylko
  **komentarze** „iOS/Safari", zero logiki UA). Wsparcie wyłącznie po **istnieniu API** →
  funkcja włącza się także na Safari.

## Zgodność z konstytucją
- **C-01/C-02** — ✅ praca w `worldofmag/`, importy `@/*`.
- **C-10..C-14** — ✅ brak migracji/zmian schematu.
- **C-20..C-25** — ✅ brak nowych akcji/sluga/`AIAction`; `check:actions` zielone.
- **C-30/C-31/C-32** — ✅ bez nowych elementów UI; komentarze/logika PL; mobile-first (iPhone jest celem).
- **C-40/C-41** — ✅ routing modeli i klucze bez zmian.
- **C-53** — ✅ 2 pliki (tts + komponent), reuse istniejącej pętli/helpera STT; zero nowych zależności;
  **bez** UA-sniffingu (wykrywanie po API); helper `speechRecognition.ts` już iOS-właściwy (`continuous=false`,
  `try/catch`, świeży egzemplarz) — bez zbędnych zmian (T-6 spełnione przez istniejący kod).
- **C-54** — ✅ 007 koryguje błędne założenie 005/006 („tylko Chrome"); artefakty spójne.

## Regresje
- **`@/lib/tts` `speak()`** — publiczne API bez zmian (`speak(text, lang, {onEnd})`); dodano tylko
  `warmVoices()` + `resume()`. Używane też przez odczyt pojedynczych postów (spec 004) i moduł Languages?
  — Languages ma własny odczyt; `@/lib/tts` `speak` używa Home/Asystent. `resume()`/`warmVoices` są
  bezpieczne (idempotentne, guardowane). Build zielony.
- **Pętla głosowa** — pierwszy start i barge-in zostają synchroniczne (gest); tylko programowe restarty
  opóźnione o 250ms — brak wpływu na poprawność, tylko drobny bufor. Logika 006 (karty/korekta) bez zmian.
- **Ścieżka pisana** — nietknięta.

## Werdykt końcowy
**GOTOWE Z UWAGAMI.**
- Wszystkie 8 AC pokryte w warstwie logiki/kodu (dowody plik:linia); bramki
  (`check:migrations`/`check:actions`/`lint`/`build`) zielone.
- **Uwagi (nie blokujące):** (1) AC-1..AC-5 wymagają potwierdzenia **na realnym iPhone (Safari)** —
  Web Speech poza headless CI; (2) znane, wąskie ryzyko: część wersji iOS bywa surowsza (gest per-
  wypowiedź) — priming pokrywa typowy przypadek, do potwierdzenia na urządzeniu właściciela (spec §9).
- Brak braków wymagających powrotu do `/implement`. → przejście do `/review`.
