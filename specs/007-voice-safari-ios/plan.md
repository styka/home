# Plan techniczny: Rozmowa głosowa działa na Safari/iPhone

- **Spec:** ./spec.md (007-voice-safari-ios)
- **Status:** draft
- **Data:** 2026-07-16

> **Zasada planu:** to jest **JAK**, pod istniejącą warstwę mowy (`@/lib/tts`,
> `@/lib/speechRecognition`, pętla w `home/AICommandSheet.tsx`). Naprawiamy iOS Safari; Chrome bez regresu.

## 1. Podejście (2–4 zdania)
Naprawa jest **kliencka, w warstwie mowy** — nie ruszamy agenta, schematu ani UI-logiki 006. Trzy
dźwignie: (1) **odblokowanie/priming TTS w geście** włączenia trybu (iOS wycisza `speak()` poza
gestem) + rozgrzewka asynchronicznie ładowanych głosów i zabezpieczenie `resume()`; (2) **robustny
restart rozpoznawania** dla iOS — pierwsze uruchomienie **synchronicznie w geście** (dla zgody na
mikrofon), a każdy kolejny nasłuch z **drobnym opóźnieniem** (iOS bywa wrażliwy na natychmiastowy
restart); (3) potwierdzenie, że wsparcie wykrywamy **po istnieniu API, nie po nazwie przeglądarki** —
w kodzie **nie ma** bramki „tylko Chrome" (to była błędna narracja, nie kod), więc AC-8 spełniamy przez
weryfikację + brak UA-sniffingu. Wzorzec do naśladowania: istniejący `@/lib/tts` i pętla z 005/006.

## 2. Model danych (Prisma)
**Bez zmian w schemacie.** Warstwa mowy jest kliencka; rozmowa dalej przez `persist`→`AiMessage`.
→ brak migracji (C-10/C-11/C-12 nie dotyczą; `check:migrations` zielone bez zmian).

## 3. Warstwa serwera (Server Actions — C-20)
**Brak nowych/zmienionych Server Actions.** Zero mutacji danych. Wszystko w kliencie.

## 4. RBAC / rejestr modułu (C-22)
**Bez zmian.** Funkcja w istniejącym Asystencie (`module.home`); brak sluga/wpięć.

## 5. UI / logika (C-30, C-31, C-32)

### 5.1 `src/lib/tts.ts` — TTS słyszalne na iOS Safari
- **`primeSpeech()`** (nowa, eksport): wywoływana **w geście** (kliknięcie przełącznika) „odblokowuje"
  syntezę na iOS — wypowiada **cichą/pustą** wypowiedź (`volume=0`, krótki/pusty tekst) przez
  `speechSynthesis`, dodatkowo `getVoices()` (wyzwolenie ładowania) i `resume()`. Idempotentna,
  bezpieczna bez wsparcia (`ttsSupported()` guard). Po tym programowe `speak()` w pętli są słyszalne.
- **Rozgrzewka głosów:** jednorazowa obsługa `voiceschanged` (leniwe wypełnienie listy głosów), by
  `speak()` nie startował „w próżni", gdy głosy jeszcze się ładują (typowe na iOS przy pierwszym użyciu).
- **`speak()` — zabezpieczenie „zawieszonej" syntezy:** po `speak()` wywołaj `resume()` (iOS/Safari
  potrafi wejść w stan paused). Zachowujemy istniejące `cancel()` przed nową wypowiedzią i `onEnd`.
  Bez zmiany API `speak(text, lang, {onEnd})` używanego w `AICommandSheet` (kompatybilność wstecz).

### 5.2 `src/lib/speechRecognition.ts` — cykl rozpoznawania pod iOS
- **Bez UA-sniffingu.** Wsparcie już wykrywane po `window.SpeechRecognition || webkitSpeechRecognition`
  (istniejące `speechRecognitionSupported()`), `continuous=false`, `interimResults=true` — to właściwy
  model dla iOS (unikamy zawodnego `continuous`). Zostaje.
- **Twardsze sprzątanie/anti-„already started":** `createSpeechListener` już tworzy **nowy** egzemplarz
  na każde `start()` i ma `abort()`. Dokładamy odporność: `start()` w bloku `try/catch` (jest) i
  pewność, że poprzedni egzemplarz jest odpięty (`onend/onerror/onresult = null`) — już jest; ewentualnie
  drobny no-op guard. Samo **opóźnienie restartu** realizujemy w komponencie (5.3), nie tu (helper
  zostaje uniwersalny).

### 5.3 `src/components/home/AICommandSheet.tsx` — priming w geście + opóźniony restart
- **`toggleVoice` (gest):** przy włączaniu trybu wywołaj **`primeSpeech()`** (odblokowanie TTS w
  obrębie dotknięcia) i **synchronicznie** `startListening()` (pierwszy `recognition.start()` w geście —
  potrzebny do zgody na mikrofon na iOS). Kolejność: prime → start, wszystko w handlerze kliknięcia.
- **`scheduleListen()` (nowy pomocnik):** restart nasłuchu (po wypowiedzi Asystenta w `speak().onEnd`
  oraz po pustym `onFinal`) przez **`setTimeout(startListening, ~250ms)`** — bufor czasu, którego iOS
  wymaga między turami; na Chrome niewyczuwalny. **Pierwsze** uruchomienie (z `toggleVoice`) zostaje
  **bez** opóźnienia (gest!). Podmieniamy w miejscach restartu `startListeningRef.current()` na
  `scheduleListen()` — z wyjątkiem startu w geście.
- **Bez zmian** w logice 006 (karty akcji, potwierdzanie/korekta, wskaźnik, composer, zapis czatu).
  Anti-echo (nasłuch nigdy w trakcie mowy) zostaje — wręcz ważniejszy na iOS.
- **Teksty/aria PL (C-32), tokeny CSS (C-30)** — bez nowych elementów UI (ewentualny komunikat błędu
  mikrofonu już istnieje).

## 6. AI / integracje (C-23, C-40)
- **Brak nowej `AIAction`**, brak zmian w agencie/`agentTools`/executorach → `check:actions` zielone bez
  zmian (C-23). Routing modeli bez zmian (C-40).

## 7. Pliki do utworzenia / zmiany
| Plik | Akcja | Po co |
|------|-------|-------|
| `worldofmag/src/lib/tts.ts` | edycja | `primeSpeech()` (odblokowanie w geście) + rozgrzewka głosów (`voiceschanged`/`getVoices`) + `resume()` — TTS słyszalne na iOS |
| `worldofmag/src/components/home/AICommandSheet.tsx` | edycja | `primeSpeech()` w geście `toggleVoice`; `scheduleListen()` (opóźniony restart) w miejscach ponownego nasłuchu; pierwszy start synchroniczny w geście |
| `worldofmag/src/lib/speechRecognition.ts` | edycja (drobna, jeśli potrzeba) | Utwardzenie sprzątania/`start()` pod iOS (bez UA-sniffingu; helper uniwersalny) |
| `doświadczenia.md` | edycja | Lekcja: iOS Safari — priming TTS w geście + opóźniony restart STT (C-51) |
| `specs/007-*/*.md` | artefakty | Pipeline (C-03) |

## 8. Bramki i weryfikacja (C-50)
- **Lokalnie** (lokalny Postgres, C-13, **do `next build`**, bez `migrate.js`): `check:migrations`,
  `check:actions`, `next lint --dir src`, `next build` — zielone (brak migracji/akcji → `check:*` „z
  definicji").
- **Weryfikacja funkcjonalna:**
  - **AC-1..AC-5 (iPhone/Safari):** **ręcznie na realnym iPhone** — Web Speech nie działa w headless CI.
    Sprawdzić: słychać odpowiedź (TTS), rozpoznanie kwestii, auto-powrót do nasłuchu (pętla nie zacina
    się), karty akcji/korekta, zapis czatu.
  - **AC-6 (Chrome/desktop):** brak regresu — priming to no-op-owo bezpieczny dodatek; `scheduleListen`
    z 250ms niewyczuwalny; ręcznie w Chrome.
  - **AC-7 (brak wsparcia):** przełącznik ukryty/nieaktywny; helpery no-op — prześledzenie logiki.
  - **AC-8 (brak bramki „Chrome-only"):** przegląd kodu — wykrywanie tylko po API, zero UA-sniffingu.
- **Mapowanie AC → sposób:** jak wyżej (AC-1..5 iPhone ręcznie; AC-6 Chrome ręcznie; AC-7/8 przegląd+build).

## 9. Ryzyka techniczne i plan wycofania
- **Gest per-wypowiedź na części wersji iOS:** priming odblokowuje syntezę na sesję na większości
  aktualnych iOS; jeśli konkretna wersja wymaga gestu przy KAŻDEJ wypowiedzi, odpowiedzi po pierwszej
  turze mogą zamilknąć — to znany, wąski limit platformy (nie „Chrome-only"). Mitygacja: priming +
  rozgrzewka + `resume()`. Weryfikacja na iPhone właściciela; jeśli wyjdzie ten limit — odnotować i
  ewentualnie rozważyć osobny tryb w kolejnym specu.
- **`start()` „already started" / urwania na iOS:** opóźniony restart (`scheduleListen`) + świeży
  egzemplarz rozpoznawania na każdą turę + `abort()` poprzedniego.
- **Długie wypowiedzi (>~15s) bywają ucinane przez Safari:** `resume()` po `speak()` łagodzi; pełne
  „chunkowanie" długiego tekstu poza zakresem (odnotowane).
- **Brak testu w CI:** weryfikacja końcowa ręczna (iPhone + Chrome). Bramka automatyczna = `next build`
  + brak regresu ścieżki pisanej.
- **Rollback:** czysto kodowy (brak migracji) — rewert commita/PR na `develop` cofa całość bez śladu w DB.

## 10. Zgodność z konstytucją — checklista
- [x] **C-10..C-14 (migracje)** — brak zmian w schemacie; brak migracji.
- [x] **C-20..C-25 (server/RBAC/AI/trash/audit)** — brak nowych akcji/sluga/`AIAction`; `check:actions` zielone.
- [x] **C-30..C-32 (UX)** — bez nowych elementów UI; teksty/aria PL; tokeny CSS; mobile-first (iPhone).
- [x] **C-53 (minimalizm)** — 2 pliki mowy + 1 komponent; reuse istniejącej pętli/`@/lib/tts`; zero
  nowych zależności; **bez** UA-sniffingu (wykrywanie po API).
- [x] **C-54** — 007 koryguje błędne założenie 005/006 (hands-free „tylko Chrome"); artefakty spójne.
- [x] **C-50/C-52** — „gotowe" = zielony build; auto-merge `develop`; pytanie domykające o `master`.
