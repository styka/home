# Weryfikacja: Tryb rozmowy głosowej z Asystentem

- **Spec/Plan/Tasks:** ./spec.md · ./plan.md · ./tasks.md (005-assistant-voice-conversation)
- **Data:** 2026-07-15
- **Środowisko:** lokalny Postgres 16 (`omnia_dev`, 127.0.0.1:5432); `next build` do kroku `next
  build` (bez `migrate.js` — C-13, nigdy prod DB).

## Bramki techniczne
| Komenda | Wynik |
|---------|-------|
| `npm run check:migrations` | ✅ „Numeracja migracji OK (następny wolny numer: 0206)". Brak nowej migracji (feature bezschematowy). |
| `npm run check:actions` | ✅ „95 akcji w katalogu, wszystkie obsługiwane przez executor". Nie dodano `AIAction` — bramka zielona bez zmian. |
| `npx next lint --dir src` | ✅ Brak błędów; w **zmienionych** plikach (`speechRecognition.ts`, `AICommandSheet.tsx`) **zero** ostrzeżeń (po poprawieniu cudzysłowu `„…”`). Pozostałe warningi to istniejące ~64 kosmetyczne (poza zakresem). |
| `npx next build` | ✅ „Compiled successfully", „Checking validity of types" OK, „Generating static pages (128/128)". |

> Uwaga metodyczna: **samej pętli głosowej nie da się zweryfikować automatycznie** — Web Speech API
> (`SpeechRecognition`/`SpeechSynthesis`) nie działa wiarygodnie w headless Chromium. Poniższe AC
> zweryfikowano przez **prześledzenie logiki w kodzie** (ścieżki wykonania, stany, cykl życia) oraz
> zielone bramki; finalne potwierdzenie „na żywo" wymaga Chrome desktop (środowisko testowe `develop`).

## Kryteria akceptacji (AC → werdykt + dowód)
Plik: `worldofmag/src/components/home/AICommandSheet.tsx` (o ile nie podano innego).

- **AC-1 (przełącznik „Rozmowa głosowa")** — ✅. Przycisk w composerze `onClick={toggleVoice}` z
  etykietą/aria „Rozmowa głosowa" i ikoną `Mic`/`MicOff` (L1163–1172); renderowany tylko gdy
  `voiceSupported` (L1164). Etykiety po polsku (C-32).
- **AC-2 (wskaźnik stanu)** — ✅. Pasek stanu widoczny gdy `voiceState !== "off"` (L1125), pokazuje
  „Słucham… / Myślę… / Mówię… / Do zatwierdzenia" z ikoną i kolorem z tokenów CSS (L1127–1134),
  `aria-live="polite"`.
- **AC-3 (wypowiedź → tura użytkownika + auto-wysyłka bez klik)** — ✅. `startListening` tworzy
  listener (`createSpeechListener`, L300); w `onFinal` niepusty transkrypt → `handleSend(text)` (przez
  `handleSendRef`, L313) albo `submitClarify` (L312). `handleSend` dopisuje turę użytkownika i `persist`
  (L664–666 istniejące) — bez dodatkowego kliknięcia. Puste/śmieciowe → ponowny nasłuch bez wysyłki (L308).
- **AC-4 (auto-odczyt odpowiedzi)** — ✅. Sterownik-`useEffect` (L344–375): po `busy===false` i nowej
  turze asystenta (kind `answer|report|navigate|clarify`) → `voiceState="speaking"` + `speak(text,"pl",…)`
  (L364–367). `text` z `voiceSpeakText` przez `speechTextFromMarkdown` (L272–278). Bez klikania ikony odczytu.
- **AC-5 (auto-powrót do nasłuchu)** — ✅. W `onEnd` mowy, jeśli tryb wciąż on → `startListeningRef.current()`
  (L371). Pusta treść mowy też wraca do nasłuchu (L363).
- **AC-6 (barge-in)** — ✅. W stanie `speaking` przycisk „Przerwij" `onClick={() => startListening()}`
  (L1140–1143); `startListening` na wejściu robi `stopSpeaking()` (L295) → mowa ucięta, nasłuch startuje.
  Zgodne z AC „lub gestem" (świadoma decyzja techniczna anty-echo, plan §5.3 pkt 5).
- **AC-7 (akcja → podgląd planu, pauza, niszczące odznaczone)** — ✅. Sterownik: gdy nowa tura to
  `kind==="plan"` → `voiceState="review"` + `setPlanTurnId` (auto-otwarcie, L352–358), bez czytania mowy.
  `ActionDrawer` renderowany po `planTurnId` (L1210+) z istniejącą logiką „niszczące odznaczone" (bez zmian).
- **AC-8 (powrót po podglądzie)** — ✅. Zatwierdzenie: koniec `handleExecute` → `if review:
  startListening()` (L849). Anulowanie: `onClose={handlePlanClose}` (L1218) → `handlePlanClose`
  wznawia nasłuch, gdy `review` (L339–342).
- **AC-9 (zapis jako czat tekstowy)** — ✅. Tryb głosowy nie ma własnego magazynu; wypowiedzi i
  odpowiedzi idą przez istniejące `handleSend`/`submitClarify`/`applyResponse` → `persist` →
  `appendAiMessage` (`AiConversation`/`AiMessage`). Brak zmian w schemacie (T-0) → tury odtwarzają się
  z historii jak w czacie pisanym.
- **AC-10 (twarde zatrzymanie)** — ✅. `stopVoice` = `listener.abort()` + `stopSpeaking()` +
  `voiceState="off"` (L280–288). Wpięte w: przełącznik OFF (`toggleVoice`, L331), `useEffect` na `!isOpen`
  (L385), na zmianę `conversationId` (L389) i unmount (L391, `listenerRef.current?.abort()`). Mikrofon
  zwalniany, brak mowy w tle.
- **AC-11 (degradacja bez wsparcia)** — ✅. `voiceSupported = ttsSupported() && speechRecognitionSupported()`
  (L208); przełącznik renderowany tylko gdy `voiceSupported` (L1164) → ukryty bez wsparcia. Helper
  `createSpeechListener` jest bezpiecznym no-op bez wsparcia (`speechRecognition.ts` L67–69). Ścieżka
  pisana/dyktowanie/odczyt pojedynczych postów bez zmian.
- **AC-12 (clarify głosem)** — ✅. `clarify` jest wypowiadane (kind objęty `voiceSpeakText`, L274) i po
  mowie ustawia `pendingClarifyRef` (L370); kolejna wypowiedź w `onFinal` trafia do `submitClarify`
  (L312) → rozmowa się nie wiesza. Dodatkowo: błąd agenta w „myślę" wraca do nasłuchu (L378–380),
  anulowanie generowania też (L631).

## Zgodność z konstytucją
- **C-01/C-02** — ✅ całość w `worldofmag/`, importy przez `@/*` (`@/lib/speechRecognition`, `@/lib/tts`).
- **C-10..C-14 (migracje)** — ✅ brak zmian w schemacie i migracji; `check:migrations` zielone.
- **C-12 (bez enumów)** — ✅ `VoiceState` to String-union, nie enum.
- **C-20..C-25** — ✅ brak nowych akcji/sluga/`AIAction`; persystencja i akcje przez istniejące ścieżki;
  soft-delete/audit/RBAC nietknięte; `check:actions` zielone.
- **C-30 (motyw CSS-vars)** — ✅ kolory z `var(--accent-*)`/`var(--text-*)`/`var(--on-accent)`, brak hexów.
- **C-31/C-32** — ✅ pasek w composerze (brak drugiego sidebaru na mobile), cele dotyku 42×42,
  teksty/aria po polsku, STT `pl-PL`.
- **C-53 (minimalizm)** — ✅ jeden mały helper + zmiany w jednym komponencie; reużycie TTS/agenta/
  `ActionDrawer`/persystencji; **zero** nowych zależności; `SmartTextarea` nietknięty.
- **C-51** — ✅ nieoczywisty problem builda (kolizja `declare global { Window }`) zalogowany w `doświadczenia.md`.

## Regresje
- **Ścieżka pisana** (composer, wysyłka, plan, historia, odczyt pojedynczych postów) — bez zmian;
  cała logika głosowa jest bramkowana `voiceState !== "off"`, więc przy wyłączonym trybie (domyślnie)
  zachowanie jest identyczne jak dotąd. `next build` (128 stron) i type-check zielone → brak regresji
  typów/kompilacji w sąsiednich modułach.
- **Globalne typy** — poprawiona kolizja augmentacji `Window` (helper czyta konstruktor lokalnym
  rzutem), więc `SmartTextarea.tsx`/`AITaskInput.tsx` (własne deklaracje) budują się bez zmian.
- **`handleExecute`/`stopGeneration`** — dołożone wywołania są bramkowane `voiceStateRef.current` →
  no-op poza trybem głosowym; brak wpływu na czat pisany.

## Werdykt końcowy
**GOTOWE Z UWAGAMI.**
- Wszystkie 12 AC spełnione w warstwie logiki (prześledzone w kodzie z dowodami plik:linia); wszystkie
  bramki techniczne (`check:migrations`, `check:actions`, `lint`, `build`) zielone.
- **Uwaga (nie blokująca):** faktyczne działanie pętli mowy (mikrofon + synteza) potwierdzalne tylko
  ręcznie w Chrome desktop — Web Speech API nie działa w headless CI. To ograniczenie środowiska, nie
  brak w implementacji; zgodne z ryzykiem odnotowanym w specu (§9) i planie (§8). Zalecane sprawdzenie
  „na żywo" po deployu na `develop`.
- Brak braków wymagających powrotu do `/implement`. → przejście do `/review`.
