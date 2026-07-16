# Zadania: Tryb rozmowy głosowej z Asystentem

- **Plan:** ./plan.md (005-assistant-voice-conversation)
- **Status:** done
- **Data:** 2026-07-15

> **Zasada listy zadań:** kolejność od najłatwiejszego do najtrudniejszego i zgodna z zależnościami.
> Feature jest **czysto kliencki** — brak migracji, Server Actions, RBAC i nowej `AIAction`
> (patrz plan §2–§6), więc Fazy „Fundament danych / Warstwa serwera / AI-akcje" **odpadają
> świadomie** (C-53). Zamiast nich: helper STT → pętla w komponencie → bramki.

## Legenda
- `[ ]` do zrobienia · `[x]` zrobione · `[~]` w trakcie · `[!]` zablokowane
- `[P]` — niezależne od poprzedniego, można robić równolegle

## Faza 0 — Dane / schemat
- [x] **T-0** — **Brak zmian w schemacie** (potwierdzenie): żadnej migracji ani edycji
  `schema.prisma`; rozmowa zapisuje się istniejącym `persist`→`AiMessage`. *Gotowe, gdy:* nic nie
  dodano w `prisma/migrations/`, a `npm run check:migrations` przechodzi bez nowych wpisów.

## Faza 1 — Helper rozpoznawania mowy (STT)
- [x] **T-1** — Utwórz `worldofmag/src/lib/speechRecognition.ts` (klient) wg planu §5.1: typy
  `ISpeechRecognition` (skopiowane z `SmartTextarea`), `speechRecognitionSupported()`,
  `createSpeechListener({ lang?, onResult, onEnd?, onError? }) → { start, stop, abort }`
  (`lang="pl-PL"`, `interimResults=true`, `continuous=false`, zbiera finalny transcript, bezpieczny
  no-op bez wsparcia). *Gotowe, gdy:* moduł kompiluje się (`tsc`/`next build`), `SmartTextarea`
  **nietknięty**, brak nowych zależności. **(pokrywa fundament AC-3/AC-11)**

## Faza 2 — Pętla i UI w `AICommandSheet.tsx`
> Wszystko w `worldofmag/src/components/home/AICommandSheet.tsx`. Zadania T-2..T-6 dotykają tego
> samego pliku — robimy je **sekwencyjnie** (nie `[P]`), jednym spójnym ciągiem, commit po fazie.

- [x] **T-2** — **Stan i cykl życia trybu**: `voiceState: "off"|"listening"|"thinking"|"speaking"|
  "review"` (String-union, nie enum), refy `listenerRef`/`spokenIdRef`/`voiceStateRef`/
  `pendingClarifyRef`; funkcje `startListening()` i `stopVoice()` (abort listenera + `stopSpeaking()`).
  Wepnij `stopVoice()` w istniejące `useEffect` sprzątające: `!isOpen`, zmiana `conversationId`,
  unmount. *Gotowe, gdy:* włączenie/wyłączenie trybu startuje/zwalnia mikrofon, a zamknięcie okna /
  zmiana rozmowy / odmontowanie twardo zatrzymują nasłuch i mowę. **(AC-10)**
- [x] **T-3** — **Nasłuch → agent**: w `startListening()` na finalnym transkrypcie: pusty/śmieciowy →
  ponów nasłuch bez wysyłki; niepusty → `voiceState="thinking"` i routing: jeśli `pendingClarifyRef`
  ustawione → `submitClarify(turn, text)`, inaczej `handleSend(text)`. *Gotowe, gdy:* wypowiedź
  pojawia się jako tura użytkownika i leci do agenta **bez klikania**, a puste wypowiedzi nie są
  wysyłane. **(AC-3, AC-12 część 2)**
- [x] **T-4** — **Auto-odczyt odpowiedzi + powrót do nasłuchu**: `useEffect` na `[turns, busy]` — gdy
  `busy===false` i ostatnia tura jest asystenta oraz `turn.id !== spokenIdRef.current`: dla
  `answer|report|navigate|clarify` → `voiceState="speaking"`, `speak(speakText(turn), "pl", { onEnd })`,
  a w `onEnd` (jeśli tryb on): `clarify` ⇒ ustaw `pendingClarifyRef` + `startListening()`; inaczej
  `startListening()`; ustaw `spokenIdRef`. `speakText(turn)` = jak w `SpeakButton`, przez
  `speechTextFromMarkdown`. *Gotowe, gdy:* odpowiedź czytana automatycznie, po niej auto-nasłuch;
  `clarify` czytane, a kolejna wypowiedź trafia do `submitClarify`. **(AC-4, AC-5, AC-12)**
- [x] **T-5** — **Podgląd planu w trybie głosowym**: gdy ostatnia tura to `kind==="plan"` →
  `voiceState="review"` + `setPlanTurnId(turn.id)` (auto-otwarcie `ActionDrawer`), bez auto-czytania
  całej treści (ew. krótka zapowiedź głosem). Po zamknięciu drawera (`onClose`) i po `handleExecute`
  → jeśli tryb on: `startListening()`. *Gotowe, gdy:* polecenie akcji pauzuje pętlę i pokazuje
  `ActionDrawer` (niszczące odznaczone — istniejące), a po decyzji rozmowa wraca do nasłuchu. **(AC-7, AC-8)**
- [x] **T-6** — **Przełącznik + wskaźnik stanu + barge-in** w composerze: przycisk „Rozmowa głosowa"
  (`Mic`, podświetlenie `--accent-blue`), ukryty/nieaktywny gdy `!(speechRecognitionSupported() &&
  ttsSupported())` z polskim `title`; pasek stanu „Słucham/Myślę/Mówię/Do zatwierdzenia" (kolory z
  tokenów), przycisk **„Przerwij"** w stanie `speaking` (`stopSpeaking()`+`startListening()`) i
  **„Zakończ rozmowę"** (`stopVoice()`). Motyw tylko CSS-vars, teksty/aria PL, cele dotyku jak ikony
  composerra. *Gotowe, gdy:* widać przełącznik i stan; „Przerwij" ucina mowę i wznawia nasłuch;
  degradacja bez wsparcia bez błędu. **(AC-1, AC-2, AC-6, AC-11)**

## Faza 3 — Bramki i domknięcie
- [x] **T-7** — Bramki (lokalny Postgres, C-13, **do `next build`**, bez `migrate.js`):
  `npm run check:migrations`, `npm run check:actions`, `npx next lint`, `npx next build` — wszystkie
  zielone; potwierdź brak regresu ścieżki pisanej (composer/wysyłka/plan działają jak dotąd). *Gotowe,
  gdy:* build przechodzi, lint bez nowych błędów.
- [x] **T-8** — Aktualizacja `spec.md`/`plan.md`, jeśli implementacja wymusiła zmianę (spójność
  artefaktów C-54); w przeciwnym razie potwierdź zgodność. Zaznacz status w `tasks.md`.
- [x] **T-9** — Wpis-lekcja do `doświadczenia.md` **jeśli** po drodze był nieoczywisty problem
  (np. echo/sprzężenie, cykl życia mikrofonu, degradacja Safari) — po polsku, format C-51.

## Mapowanie kryteriów akceptacji → zadania
| AC | Zadanie(a) | Sposób weryfikacji |
|----|-----------|--------------------|
| AC-1 (przełącznik) | T-6 | wizualnie w composerze |
| AC-2 (wskaźnik stanu) | T-6 | słucham/myślę/mówię/do zatwierdzenia |
| AC-3 (wypowiedź→tura, auto-wysyłka) | T-1, T-3 | tura użytkownika + wywołanie agenta bez klik |
| AC-4 (auto-odczyt odpowiedzi) | T-4 | odpowiedź czytana bez klikania |
| AC-5 (auto-powrót do nasłuchu) | T-4 | po mowie znów „słucham" |
| AC-6 (barge-in) | T-6 | „Przerwij" ucina mowę → nasłuch |
| AC-7 (akcja → podgląd planu, pauza) | T-5 | `ActionDrawer`, niszczące odznaczone |
| AC-8 (powrót po podglądzie) | T-5 | po zamknięciu drawera znów nasłuch |
| AC-9 (zapis jako czat tekstowy) | T-3, T-0 | tury widoczne po ponownym otwarciu/z historii |
| AC-10 (twarde zatrzymanie) | T-2 | OFF/zamknięcie ⇒ mikrofon zwolniony |
| AC-11 (degradacja bez wsparcia) | T-1, T-6 | przełącznik ukryty/nieaktywny, reszta działa |
| AC-12 (clarify głosem) | T-3, T-4 | pytanie czytane, odpowiedź przez `submitClarify` |

## Ścieżka krytyczna / zależności
- **T-1 (helper STT)** blokuje całą Fazę 2 (pętla nie ma czym słuchać).
- **T-2 → T-3 → T-4 → T-5 → T-6** — sekwencyjnie (ten sam plik, narastający stan pętli):
  stan/cykl życia → nasłuch→agent → auto-odczyt→nasłuch → podgląd planu → UI/przełącznik/barge-in.
- **T-7 (bramki)** po całej Fazie 2. T-8/T-9 domykają (spójność + lekcja).
- Brak zadań `[P]` w Fazie 2 (jeden plik). T-1 można pisać niezależnie od reszty.

## Notatki / blokady
- Brak. Weryfikacja samej pętli głosowej jest **ręczna** (Chrome desktop) — Web Speech API nie działa
  wiarygodnie w headless Chromium; bramka automatyczna to `next build` + brak regresu ścieżki pisanej.
