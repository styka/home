# Recenzja: Tryb rozmowy głosowej z Asystentem

- **Spec/Plan/Verify:** ./spec.md · ./plan.md · ./verify.md (005-assistant-voice-conversation)
- **Data:** 2026-07-15
- **Zakres diffa (feature):** `f449330..HEAD` — 2 pliki źródłowe (`src/lib/speechRecognition.ts` nowy,
  `src/components/home/AICommandSheet.tsx` edycja) + `doświadczenia.md` + artefakty `specs/005-*`.
  (Trójkropkowy diff do `develop` jest zaśmiecony — baza brancha zawiera już scalone specy 001–004 i
  inne prace nieobecne na `develop`; recenzja celuje w rzeczywisty diff feature'a.)

## Ustalenia (od najpoważniejszego)

### 1. [correctness] Pierwsza wypowiedź głosowa wyłączała tryb — **NAPRAWIONE w recenzji**
- **Plik:** `AICommandSheet.tsx` — efekt `useEffect([conversationId])` (dawniej L388–391).
- **Opis:** Efekt sprzątający po zmianie `conversationId` wołał `stopVoice()` bezwarunkowo. Pierwsza
  wypowiedź w trybie głosowym uruchamia `handleSend`, który przy braku rozmowy tworzy ją
  (`createAiConversation` → `setConversationId(null → id)`). Ta zmiana `conversationId` odpalała efekt
  → `stopVoice()` → tryb głosowy gasł **zanim** agent odpowiedział.
- **Scenariusz awarii:** Włącz „Rozmowę głosową" na świeżym wątku → powiedz „dodaj mleko do zakupów"
  → rozmowa zostaje utworzona → tryb sam się wyłącza; odpowiedź nie jest czytana, pętla nie wraca do
  nasłuchu (łamie AC-3/AC-4/AC-5 dla pierwszej tury).
- **Poprawka (naniesiona):** Wprowadzono `prevConvoIdRef`; `stopVoice()` odpala się tylko przy
  **przełączeniu/zresetowaniu** rozmowy (`prev !== null`), a nie przy pierwszym utworzeniu
  (`null → id`) w trakcie trwającej rozmowy głosowej. `stopSpeaking()`/`setSpeakingId(null)` (odczyt
  pojedynczych postów) zostają bez zmian. Build + type-check zielone po poprawce.

### 2. [minor/robustness] Ciągły nasłuch przy ciszy tworzy nowe sesje rozpoznawania
- **Plik:** `speechRecognition.ts` (`onFinal("")` → ponowny `startListening`) + pętla w komponencie.
- **Opis:** Gdy nic nie zostanie wypowiedziane (`no-speech`), pętla łagodnie wznawia nasłuch. To
  zamierzone (hands-free), ale w skrajnym środowisku (brak audio) generuje cykliczne sesje
  `SpeechRecognition`.
- **Skutek:** Brak realnego ryzyka (każda sesja ma własny timeout ciszy rzędu kilku sekund; nie jest
  to ciasna pętla CPU). Użytkownik zawsze może „Zakończ rozmowę". Ryzyko odnotowane już w planie §9.
- **Werdykt:** akceptowalne dla v1; bez zmian.

### 3. [minor/edge] `submitClarify` wymaga `turn.messages`
- **Plik:** `AICommandSheet.tsx` — `submitClarify` (`if (!v || !turn.messages) return;`).
- **Opis:** W trybie głosowym odpowiedź na `clarify` idzie przez `submitClarify`. W żywym przebiegu
  tura `clarify` zawsze ma `messages` (ustawiane w `applyResponse`), więc ścieżka działa. Gdyby
  kiedyś `clarify` trafiło bez `messages`, głos utknąłby na „myślę".
- **Skutek:** W praktyce niewywoływalne (agent zawsze zwraca `messages`). Bez zmian; odnotowane.

## Zgodność z konwencjami Omnia
- **C-01/C-02** — ✅ praca w `worldofmag/`, importy przez `@/*`.
- **C-12 (bez enumów)** — ✅ `VoiceState` = String-union.
- **C-20..C-23** — ✅ brak nowych mutacji/akcji/`AIAction`; persystencja i akcje przez istniejące
  ścieżki (`persist`, `handleExecute`); `check:actions` zielone.
- **C-30 (CSS-vars)** — ✅ kolory z tokenów (`--accent-*`, `--text-*`, `--on-accent`), zero hexów.
- **C-31/C-32** — ✅ pasek w composerze (brak drugiego sidebaru), cele dotyku 42×42, teksty/aria PL,
  STT `pl-PL`.
- **C-53 (minimalizm/reuse)** — ✅ reużycie `@/lib/tts`, agenta, `ActionDrawer`, persystencji; jeden
  mały helper; zero nowych zależności; `SmartTextarea` nietknięty.
- **Bezpieczeństwo** — ✅ brak kluczy/logów wrażliwych; brak nowego renderu HTML (mowa idzie przez
  `speechTextFromMarkdown`, czysty tekst); brak nowych ścieżek uprawnień.

## Regresje
- Cała logika głosowa bramkowana `voiceState !== "off"` / `voiceStateRef.current` → przy wyłączonym
  trybie (domyślnie) zachowanie identyczne jak dotąd; `handleExecute`/`stopGeneration`/efekty
  sprzątające są no-op poza trybem głosowym. `next build` (128 stron) + type-check zielone.
- Kolizja globalnej augmentacji `Window` (z `abort()`) rozwiązana lokalnym rzutem — `SmartTextarea`/
  `AITaskInput` budują się bez zmian.

## Werdykt
**APPROVE Z UWAGAMI.** Jedna realna usterka (nr 1) znaleziona i **naprawiona w recenzji** (drobna,
bezpieczna poprawka: `prevConvoIdRef`); build/type-check/lint zielone po poprawce. Uwagi nr 2–3 to
akceptowalne skrajne przypadki bez wpływu na normalny przebieg. Wszystkie 12 AC pokryte. Faktyczne
działanie mowy potwierdzalne ręcznie w Chrome (Web Speech API poza headless CI) — jak w `verify.md`.
