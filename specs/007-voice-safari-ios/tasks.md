# Zadania: Rozmowa głosowa działa na Safari/iPhone

- **Plan:** ./plan.md (007-voice-safari-ios)
- **Status:** done
- **Data:** 2026-07-16

> **Zasada listy:** od najłatwiejszego do najtrudniejszego, zgodnie z zależnościami. Feature jest
> **czysto kliencki (warstwa mowy)** — brak migracji, Server Actions, RBAC, nowej `AIAction`
> (plan §2–§6). Fazy danych/serwera/AI-akcji **odpadają świadomie** (C-53).

## Legenda
- `[ ]` do zrobienia · `[x]` zrobione · `[~]` w trakcie · `[!]` zablokowane
- `[P]` — niezależne od poprzedniego, można robić równolegle

## Faza 0 — Dane / schemat
- [x] **T-0** — **Brak zmian w schemacie** (potwierdzenie): żadnej migracji ani edycji `schema.prisma`.
  *Gotowe, gdy:* `npm run check:migrations` przechodzi bez nowych wpisów.

## Faza 1 — TTS słyszalne na iOS Safari (`src/lib/tts.ts`)
- [x] **T-1** — Dodaj **`primeSpeech()`** (eksport): odblokowanie syntezy na iOS — cicha/pusta
  wypowiedź (`volume=0`) przez `speechSynthesis` + `getVoices()` + `resume()`; idempotentna, bezpieczna
  bez wsparcia (`ttsSupported()` guard). *Gotowe, gdy:* funkcja istnieje, `tsc`/`next build` czyste. **(AC-1)**
- [x] **T-2** `[P]` — **Rozgrzewka głosów**: jednorazowa obsługa `voiceschanged` (leniwe wypełnienie
  listy głosów), by `speak()` nie startował „w próżni" przy pierwszym użyciu na iOS. *Gotowe, gdy:*
  głosy się ładują; brak regresu `speak()`. **(AC-1)**
- [x] **T-3** — **`speak()` — `resume()` po wypowiedzi** (iOS/Safari „paused"): dołóż `resume()` bez
  zmiany publicznego API `speak(text, lang, {onEnd})`. *Gotowe, gdy:* sygnatura bez zmian, build czysty,
  Chrome bez regresu. **(AC-1, AC-6)**

## Faza 2 — Restart rozpoznawania pod iOS (`AICommandSheet.tsx` + `speechRecognition.ts`)
- [x] **T-4** — **Priming w geście**: w `toggleVoice` (handler kliknięcia) wywołaj `primeSpeech()` i
  **synchronicznie** `startListening()` (pierwszy `recognition.start()` w geście — zgoda na mikrofon na
  iOS). *Gotowe, gdy:* włączenie trybu odblokowuje TTS i startuje nasłuch w obrębie dotknięcia. **(AC-1, AC-2)**
- [x] **T-5** — **`scheduleListen()` (opóźniony restart)**: nowy pomocnik `setTimeout(startListening,
  ~250ms)`; podmień restart nasłuchu (w `speak().onEnd` oraz po pustym `onFinal`) na `scheduleListen()`.
  **Pierwsze** uruchomienie z `toggleVoice` zostaje **bez** opóźnienia (gest). *Gotowe, gdy:* po
  wypowiedzi Asystenta pętla wraca do nasłuchu bez zacinania (iOS), Chrome niewyczuwalnie. **(AC-3, AC-6)**
- [x] **T-6** `[P]` — **Utwardzenie `speechRecognition.ts` pod iOS** (jeśli potrzeba): pewne odpięcie
  handlerów poprzedniego egzemplarza i `start()` w `try/catch` (bez UA-sniffingu; helper uniwersalny,
  `continuous=false`). *Gotowe, gdy:* brak „already started"/wycieków; wykrywanie tylko po API. **(AC-3, AC-8)**

## Faza 3 — Bramki i domknięcie
- [x] **T-7** — Bramki (lokalny Postgres, C-13, **do `next build`**, bez `migrate.js`):
  `npm run check:migrations`, `npm run check:actions`, `npx next lint --dir src`, `npx next build` —
  zielone; potwierdź brak regresu ścieżki pisanej i trybu głosowego na Chrome. *Gotowe, gdy:* build
  przechodzi, lint bez nowych błędów.
- [x] **T-8** — **Przegląd „brak bramki Chrome-only" (AC-8)**: potwierdź, że wsparcie wykrywane jest
  wyłącznie po istnieniu API (`ttsSupported`/`speechRecognitionSupported`), bez sprawdzania nazwy/UA.
  *Gotowe, gdy:* przegląd kodu potwierdza brak UA-sniffingu.
- [x] **T-9** — Spójność artefaktów (C-54) + wpis-lekcja do `doświadczenia.md` (C-51): iOS Safari —
  priming TTS w geście + opóźniony restart STT. *Gotowe, gdy:* lekcja dopisana, artefakty spójne.

## Mapowanie kryteriów akceptacji → zadania
| AC | Zadanie(a) | Weryfikacja |
|----|-----------|-------------|
| AC-1 (słychać odpowiedź na iPhone) | T-1, T-2, T-3, T-4 | ręcznie iPhone/Safari |
| AC-2 (rozpoznanie kwestii) | T-4 | ręcznie iPhone/Safari |
| AC-3 (auto-powrót do nasłuchu, brak zacinania) | T-5, T-6 | ręcznie iPhone/Safari |
| AC-4 (karty/korekta jak na Chrome) | — (utrzymanie 006) | ręcznie iPhone |
| AC-5 (zapis jako czat) | — (utrzymanie 005/006) | ręcznie iPhone |
| AC-6 (brak regresu na Chrome/desktop) | T-3, T-5, T-7 | ręcznie Chrome + build |
| AC-7 (degradacja bez wsparcia) | T-1, T-6 | prześledzenie logiki |
| AC-8 (żadnego „tylko Chrome") | T-6, T-8 | przegląd kodu (brak UA) |

## Ścieżka krytyczna / zależności
- **T-1** (primeSpeech) blokuje **T-4** (priming w geście). **T-2/T-3** `[P]` względem T-1.
- **T-4 → T-5** (priming → opóźniony restart). **T-6** `[P]`.
- **T-7** (bramki) po Fazie 1–2. T-8/T-9 domykają.

## Notatki / blokady
- Weryfikacja końcowa AC-1..AC-5 jest **ręczna na realnym iPhone (Safari)** — Web Speech nie działa w
  headless CI. Bramka automatyczna to `next build` + brak regresu na Chrome. Ryzyko „gest per-wypowiedź"
  na części wersji iOS odnotowane w specu/planie (§9).
