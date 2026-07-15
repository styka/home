# Plan techniczny: Tryb rozmowy głosowej z Asystentem

- **Spec:** ./spec.md (005-assistant-voice-conversation)
- **Status:** draft
- **Data:** 2026-07-15

> **Zasada planu:** to jest **JAK**, pod istniejący kod Asystenta (`home/AICommandSheet.tsx`).
> Naśladujemy istniejące wzorce z tego samego pliku (odczyt na głos spec 004, dyktowanie w
> `SmartTextarea`, bramka `ActionDrawer`) — C-53.

## 1. Podejście (2–4 zdania)
Tryb rozmowy głosowej to **cienka warstwa kliencka** nad istniejącym Asystentem: pętla stanów
**słucham → myślę → mówię → (ew. podgląd planu) → słucham**, spinająca **istniejące** klocki —
rozpoznawanie mowy (jak w `SmartTextarea`), agenta (`callAgent`/`handleSend`/`submitClarify`),
odczyt na głos (`@/lib/tts` `speak`/`stopSpeaking`, spec 004) i bramkę akcji (`ActionDrawer` przez
`planTurnId`/`handleExecute`). **Bez zmian w schemacie, bez nowej `AIAction`, bez nowego sluga** —
rozmowa zapisuje się tą samą ścieżką co czat pisany (`persist` → `AiConversation`/`AiMessage`).
Wzorzec do naśladowania: sam `AICommandSheet.tsx` (współistniejący odczyt `speakingId` + cykl życia
lektora w `useEffect`) i `SmartTextarea.tsx` (cykl życia `SpeechRecognition`, `pl-PL`).

## 2. Model danych (Prisma)
**Bez zmian w schemacie.** Rozmowa głosowa nie wprowadza nowej encji — tury (posty użytkownika i
Asystenta) lecą przez **istniejący** `persist(...)` → `appendAiMessage` → `AiMessage` w bieżącej
`AiConversation`. Stan trybu (`off/listening/thinking/speaking/review`) jest **ulotny, kliencki**
(React state), nic nie utrwalamy do DB. → **brak migracji** (C-10/C-11/C-12 nie dotyczą; `npm run
check:migrations` przechodzi bez zmian).

*(Preferencja „ostatnio używany tryb" świadomie pominięta — domyślnie tryb startuje **wyłączony**
przy każdym otwarciu okna, by nie przejmować mikrofonu bez wyraźnej akcji użytkownika. Decyzja
zgodna z sekcją 6/8 speca.)*

## 3. Warstwa serwera (Server Actions — C-20)
**Brak nowych ani zmienionych Server Actions.** Cała logika jest kliencka + reużywa istniejących
tras: `/api/llm/home/agent` (agent), `/api/llm/home/execute` (akcje). Persystencja przez istniejącą
akcję `appendAiMessage`/`createAiConversation` (`src/actions/aiConversations.ts`) — bez zmian.
`revalidatePath`/`router.refresh()` po wykonaniu akcji już są w `handleExecute` (C-20 spełnione bez
dokładania czegokolwiek).

## 4. RBAC / rejestr modułu (C-22)
**Bez zmian.** Funkcja żyje w istniejącym Asystencie (`module.home`), w oknie renderowanym przez
`AppShell`. Brak nowego sluga, brak wpięć w `permissions.ts`/`modules.tsx`/`ModuleSidebar`. Strona
i tak wymaga sesji (brak trybu anonimowego).

## 5. UI (C-30, C-31, C-32)
Wszystko w obrębie `src/components/home/AICommandSheet.tsx` + jeden nowy helper w `src/lib/`.

### 5.1 Nowy helper rozpoznawania mowy — `src/lib/speechRecognition.ts` (klient)
Mały moduł **na wzór `@/lib/tts`** (żeby nie „refaktorować przy okazji" działającego
`SmartTextarea` — C-53), udostępnia:
- `speechRecognitionSupported(): boolean` — `("SpeechRecognition" in window) || ("webkitSpeechRecognition" in window)`.
- `createSpeechListener(opts: { lang?: string; onInterim?: (text: string) => void; onFinal: (text: string) => void; onError?: (err: string) => void }): { start(): void; stop(): void; abort(): void }`
  — tworzy `SpeechRecognition` (`lang="pl-PL"`, `interimResults=true`, `continuous=false` dla trybu
  „jedna wypowiedź → cisza kończy"), zbiera finalny transcript i po `onend` oddaje go przez `onFinal`
  (`abort()` odrzuca wynik — bez `onFinal`). Typy
  `ISpeechRecognition` skopiowane 1:1 z `SmartTextarea` (kilka linii; świadomie nie ruszamy tamtego
  pliku).
- Cały moduł jest `no-op`/bezpieczny bez wsparcia (zwraca puste `start/stop`), analogicznie do
  `ttsSupported()`.

### 5.2 Pętla i stan w `AICommandSheet.tsx`
- Nowy stan: `const [voiceState, setVoiceState] = useState<VoiceState>("off")` gdzie
  `type VoiceState = "off" | "listening" | "thinking" | "speaking" | "review"` (String-union, **nie
  enum** — spójnie z C-12 nawet po stronie klienta).
- Refy: `listenerRef` (bieżący listener), `spokenIdRef` (id ostatnio wypowiedzianej tury — anty-dubel),
  `voiceStateRef` (aktualny stan bez stale-closure), `pendingClarifyRef` (jeśli ostatnia tura to
  `clarify` — kolejna wypowiedź idzie przez `submitClarify`, nie `handleSend`).
- **Przełącznik** „Rozmowa głosowa" w composerze (obok przycisku zdjęcia / wysyłki): ikona `Mic`
  (Lucide, już używana), po włączeniu podświetlona `var(--accent-blue)`; ukryty/nieaktywny gdy
  `!(speechRecognitionSupported() && ttsSupported())` z `title` po polsku (AC-11).
- **Wskaźnik stanu** (AC-2): pasek nad composerem widoczny tylko w trybie ≠ `off` — „🎙 Słucham…",
  „💭 Myślę…", „🔊 Mówię…", „📋 Do zatwierdzenia" — kolory z tokenów CSS (`--accent-blue/amber/
  green`, `--text-muted`); w stanie `speaking` przycisk **„Przerwij"** (barge-in gestem), a zawsze
  przycisk **„Zakończ rozmowę"** (wyłącza tryb).
- Motyw wyłącznie przez zmienne CSS (C-30), teksty PL (C-32), cele dotyku `≥` istniejących ikon
  composerra 42×42 / `py-3` (C-31). Mobile: pasek stanu to zwykły wiersz w composerze — działa w
  wąskim oknie, nie dokłada drugiego sidebaru.

### 5.3 Przebieg pętli (hands-free, ciągły)
1. **Włączenie** trybu → `startListening()`: `voiceState="listening"`, tworzy listener i `start()`.
2. **Koniec wypowiedzi** (natywne `onend` po ciszy) → finalny transcript:
   - pusty/śmieciowy → zignoruj, `startListening()` ponownie (bez wysyłki; anty-pętla: minimalna
     długość / brak wysyłki pustych).
   - niepusty → `voiceState="thinking"`; jeśli `pendingClarifyRef` ustawione → `submitClarify(turn,
     text)`, w przeciwnym razie `handleSend(text)`. (Obie ścieżki już dopisują turę użytkownika i
     `persist` — AC-3, AC-9.)
3. **Odpowiedź agenta**: `useEffect` obserwujący `[turns, busy, voiceStateRef]` — gdy `busy===false`
   i ostatnia tura jest **asystenta** oraz `turn.id !== spokenIdRef.current`:
   - kind `plan` → `voiceState="review"`, `setPlanTurnId(turn.id)` (auto-otwarcie `ActionDrawer`),
     opcjonalnie krótka zapowiedź głosem („Przygotowałem N akcji do zatwierdzenia") (AC-7).
   - kind `answer|report|navigate|clarify` → `voiceState="speaking"`, `speak(speakText(turn), "pl",
     { onEnd: → po zakończeniu, jeśli tryb wciąż on: `clarify` ⇒ ustaw `pendingClarifyRef` i
     `startListening()`; inaczej `startListening()` })` (AC-4, AC-5, AC-12). `spokenIdRef=turn.id`.
   - `speakText(turn)` = ta sama treść co `SpeakButton` (`turn.content`, dla report `${title}. ${content}`),
     przepuszczona przez `speechTextFromMarkdown`.
4. **Podgląd planu** (`review`): po zamknięciu `ActionDrawer` (`onClose`) lub po `handleExecute`
   (dodać `router.refresh()` już jest) → jeśli tryb wciąż on: `startListening()` (AC-8).
5. **Barge-in** (AC-6): przycisk „Przerwij" w stanie `speaking` → `stopSpeaking()` + `startListening()`.
   *(Świadoma decyzja techniczna, C-53/ryzyko echa: przerwanie realizujemy **gestem/dotykiem** —
   nie detekcją mowy w trakcie odtwarzania (echo z głośnika → sprzężenie). Spec AC-6 dopuszcza „lub
   gestem", więc to spełnia kryterium; automatyczny VAD w trakcie mowy pozostaje poza zakresem.)*
6. **Wyłączenie / zamknięcie** (AC-10): `stopVoice()` = `listenerRef.abort()` + `stopSpeaking()` +
   `voiceState="off"`. Wpięte w: przełącznik OFF, istniejące `useEffect` na `!isOpen` i na zmianę
   `conversationId` (rozszerzamy te, które już zatrzymują lektora), oraz `useEffect` czyszczący na
   unmount. Nigdy nie nasłuchujemy w trakcie mówienia (anty-echo): listener startuje dopiero w
   `onEnd`/po barge-in.

## 6. AI / integracje (C-23, C-40)
- **Brak nowej `AIAction`** i brak zmian w `agentTools.ts` → `npm run check:actions` przechodzi bez
  zmian (C-23 spełnione, bo nie dodajemy akcji). Tryb głosowy wykorzystuje **istniejący** zestaw
  akcji przez `handleExecute` + `ActionDrawer` (akcje niszczące odznaczone domyślnie — bez zmian).
- Routing modeli (C-40) bez zmian — korzystamy z istniejącego `/api/llm/home/agent`.
- Kalendarz/powiadomienia/trash — bez zmian; usuwanie przez akcje nadal przechodzi istniejącym
  soft-delete.

## 7. Pliki do utworzenia / zmiany
| Plik | Akcja | Po co |
|------|-------|-------|
| `worldofmag/src/lib/speechRecognition.ts` | **nowy** | Kliencki helper STT (support + `createSpeechListener`) — warstwa nasłuchu dla pętli; wzorzec `@/lib/tts` |
| `worldofmag/src/components/home/AICommandSheet.tsx` | edycja | Stan `voiceState` + refy, pętla w `useEffect`, `startListening/stopVoice`, routing wypowiedzi (`handleSend`/`submitClarify`), auto-speak odpowiedzi, auto-open `ActionDrawer`, przełącznik + pasek stanu + „Przerwij"/„Zakończ"; rozszerzenie istniejących `useEffect` sprzątających (`!isOpen`, zmiana `conversationId`, unmount) o `stopVoice()` |
| `doświadczenia.md` | edycja (jeśli wypłynie problem) | Wpis-lekcja przy nieoczywistym bugu (C-51) |
| `specs/005-assistant-voice-conversation/{spec,plan,tasks,verify,review}.md` | artefakty | Pipeline (C-03) |

*(Świadomie **nie** ruszamy `SmartTextarea.tsx` — dyktowanie do pola działa i zostaje; C-53.)*

## 8. Bramki i weryfikacja (C-50)
- **Lokalnie:** lokalny Postgres + `npx prisma migrate deploy` (bez nowej migracji nic nie przybywa),
  `npm run check:migrations`, `npm run check:actions`, `next lint`, `next build` — **do kroku `next
  build`**, bez `migrate.js` (C-13, nigdy prod DB). Brak zmian w akcjach/migracjach ⇒ obie bramki
  `check:*` zielone „z definicji".
- **Weryfikacja funkcjonalna jest głównie ręczna** (Chrome desktop — Web Speech API): rozpoznawanie
  i synteza mowy nie działają wiarygodnie w headless Chromium, więc e2e nie pokryje samej pętli
  głosowej; sprawdzamy, że **ścieżka pisana pozostaje nienaruszona** (regres = 0) i że przełącznik
  degraduje się bez błędu tam, gdzie brak wsparcia.
- **Mapowanie AC → sposób sprawdzenia:**
  - AC-1/AC-2 — wizualnie: przełącznik „Rozmowa głosowa" + pasek stanu (słucham/myślę/mówię).
  - AC-3 — wypowiedź trafia jako tura użytkownika i leci do agenta bez klikania (obserwacja wątku).
  - AC-4/AC-5/AC-6 — odpowiedź czytana automatycznie; auto-powrót do nasłuchu; „Przerwij" ucina mowę.
  - AC-7/AC-8 — polecenie akcji ⇒ pauza + `ActionDrawer` (niszczące odznaczone); po zamknięciu powrót.
  - AC-9 — po zamknięciu/otwarciu okna i wejściu z historii wszystkie tury widoczne jako tekst.
  - AC-10 — OFF/zamknięcie okna ⇒ mikrofon zwolniony, brak mowy w tle (sprawdź wskaźnik przeglądarki).
  - AC-11 — w przeglądarce bez STT/TTS przełącznik ukryty/nieaktywny, reszta czatu działa.
  - AC-12 — pytanie `clarify` czytane głosem, kolejna wypowiedź idzie przez `submitClarify`.

## 9. Ryzyka techniczne i plan wycofania
- **Echo/sprzężenie** (mikrofon łapie własny głos Asystenta) → nasłuch **nigdy** w trakcie mowy;
  start dopiero w `onEnd`/po barge-in-gestem. Mitygacja wpięta w architekturę pętli.
- **Niestabilne Web Speech w Safari/iOS** (Szymon: macOS 12 + iPhone) → twarda detekcja wsparcia i
  degradacja (AC-11); pełna funkcja w Chrome. Ryzyko zaakceptowane w specu.
- **Cykl życia mikrofonu** (przełączanie okna/konwersacji/unmount) → `stopVoice()` wpięty we
  wszystkie istniejące punkty sprzątające (są już dla lektora); test: wskaźnik mikrofonu gaśnie.
- **Pętla na pustych/szumowych wypowiedziach** → brak wysyłki pustych; ponowny nasłuch bez wywołania
  agenta; łatwe „Zakończ rozmowę".
- **Rollback:** czysto kodowy (brak migracji) — rewert commita/PR na `develop` cofa całość bez
  śladu w DB (por. runbook devops: rollback kodu ≠ migracji; tu tylko kod).

## 10. Zgodność z konstytucją — checklista
- [x] **C-10..C-14 (migracje)** — brak zmian w schemacie; brak nowej migracji; `check:migrations` zielone.
- [x] **C-20..C-25 (server/RBAC/AI/trash/audit)** — brak nowych akcji/sluga/`AIAction`; persystencja i
  akcje przez istniejące ścieżki (`persist`/`handleExecute`); soft-delete/audit bez zmian; `check:actions` zielone.
- [x] **C-30..C-32 (UX)** — kolory z tokenów CSS, mobile-first (pasek w composerze, brak drugiego
  sidebaru), cele dotyku, teksty/aria po polsku, STT `pl-PL`.
- [x] **C-53 (minimalizm)** — jeden mały helper + zmiany w jednym komponencie; reużycie TTS/STT/agenta/
  `ActionDrawer`/persystencji; **zero** nowych zależności; `SmartTextarea` nietknięty.
- [x] **C-50/C-52** — „gotowe" = zielony `next build`; potem auto-merge do `develop`; na końcu pytanie
  domykające o `master`.
- [x] **C-55** — decyzje zebrane na `/specify`; na `/plan` nie było decyzji spełniającej warunki
  furtki (barge-in-gestem rozstrzygnięty minimalizmem + treścią AC).
