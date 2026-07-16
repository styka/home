# Weryfikacja: Asystent-kompan — rozmowa, dopracowany głos, czysty composer

- **Spec/Plan/Tasks:** ./spec.md · ./plan.md · ./tasks.md (006-assistant-companion-voice-polish)
- **Data:** 2026-07-16
- **Środowisko:** lokalny Postgres 16 (`omnia_dev`); `next build` do kroku `next build` (bez
  `migrate.js` — C-13).

## Bramki techniczne
| Komenda | Wynik |
|---------|-------|
| `npm run check:migrations` | ✅ „Numeracja migracji OK (następny wolny numer: 0206)". Brak nowej migracji. |
| `npm run check:actions` | ✅ „95 akcji w katalogu, wszystkie obsługiwane przez executor". Nie dodano `AIAction`. |
| `npx next lint --dir src` | ✅ Zero ostrzeżeń w **zmienionych** plikach (`AICommandSheet`, `ActionDrawer`, `fastPath`, `agent/route`, `aiAction`). |
| `npx next build` | ✅ „Compiled successfully" + „Generating static pages (128/128)". |

> Uwaga metodyczna: zachowanie **agenta** (obszar 1) zależy od LLM w runtime — weryfikowane przez
> treść instrukcji + logikę, nie deterministyczny test. **Pętla głosowa** (obszary 2) — Web Speech API
> poza headless CI → weryfikacja przez prześledzenie logiki + build; potwierdzenie „na żywo" w Chrome.

## Kryteria akceptacji (AC → werdykt + dowód)

**A. Asystent-kompan (prompt agenta — `src/app/api/llm/home/agent/route.ts`):**
- **AC-1 (pytanie/rozmowa → answer)** — ✅. Prompt: „DOMYŚLNIE ROZMAWIAJ … pytania … → ZAWSZE
  „answer" … NIGDY „plan"" (L243) + persona-kompan (L207–209). „W razie wątpliwości … traktuj to jako
  rozmowę i użyj „answer"".
- **AC-2 (wyraźne polecenie → plan)** — ✅. „„plan" tworzysz WYŁĄCZNIE, gdy użytkownik wyraźnie chce
  ZMIENIĆ dane (dodaj/utwórz/zmień/oznacz/przesuń/usuń…)" (L243). Krok „plan" w protokole bez zmian.
- **AC-3 (clarify przy wieloznaczności)** — ✅. „DOPYTUJ, NIE ZGADUJ: gdy … cel jest NIEJEDNOZNACZNY,
  a istnieje WIELE kandydatów (kilka list/projektów/zwierząt) — NAJPIERW „clarify"…" (L244) +
  `fastPath` oddaje `tasks:create_task` bez nazwanego projektu do agenta (`fastPath.ts` L55), więc
  agent może dopytać zamiast tworzyć w domyślnym projekcie.
- **AC-4 (small-talk/emocje → rozmowa)** — ✅. Prompt wprost wymienia „wypowiedzi towarzyskie/
  emocjonalne (np. „jestem zmęczony") → ZAWSZE „answer"" (L243).
- **AC-5 (brak regresu jednoznacznych)** — ✅. „gdy cel jest jednoznaczny (użytkownik nazwał listę/
  projekt … albo pasuje kontekst) — NIE pytaj zbędnie, od razu „plan"" (L244); `fastPath` zostawia
  jednoznaczne „dodaj X" jako „simple" (L55). Katalog akcji nietknięty.

**B. Dopracowany tryb głosowy (`src/components/home/AICommandSheet.tsx`):**
- **AC-6 (turn-taking po pauzie)** — ✅ (utrzymane z 005): `createSpeechListener` kończy nasłuch na
  ciszy → `onFinal` (L304+); dopracowane stany bez „review".
- **AC-7 (akcje jako karty, przepływ)** — ✅. Driver-effect: dla tury `plan` NIE otwiera drawera i NIE
  pauzuje — `pendingPlanIdRef=last.id`, `voiceAnnounce(...)` i powrót do nasłuchu (L421–427). Karta
  planu renderuje się w wątku (TurnView `kind==="plan"`).
- **AC-8 (korekta głosem)** — ✅. Przy aktywnej karcie wypowiedź spoza confirm/cancel → `handleSend`
  (L323–347) z kontekstem: `buildHistory` niesie treść akcji („(zaproponowane akcje: …)", L~540) →
  agent przeplanowuje (nowa karta). „Popraw" na karcie → `handleRefine`.
- **AC-9 (potwierdzenie; nic „samo"; niszczące ostrożnie)** — ✅. `quickConfirmPlan` wykonuje tylko
  `actions.filter(a => !isDestructiveAction(a))` (L398); sama akcja niszcząca → komunikat „potwierdź
  na karcie", brak wykonania (L400–402). `isDestructiveAction` współdzielony z `ActionDrawer`
  (`@/lib/ai/aiAction`). Nic nie wykonuje się bez confirm (głos „zatwierdź" lub dotyk).
- **AC-10 (nie-zasłaniający wskaźnik)** — ✅. Kluczowa zmiana: **usunięto auto-otwarcie zasłaniającego
  `ActionDrawer`** w trybie głosowym; karty zostają w wątku. Wskaźnik = pasek NAD composerem
  (nie nad wątkiem) z pulsującą kropką `animate-pulse` (L1207–1216), kolory z tokenów. Karty w pełni
  widoczne/klikalne.
- **AC-11 (zapis jako czat)** — ✅ (utrzymane z 005): tury lecą przez `persist`→`AiMessage`; brak
  zmian w schemacie.
- **AC-12 (degradacja bez wsparcia)** — ✅ (utrzymane z 005): przełącznik renderowany tylko przy
  `voiceSupported`; helper STT jest no-op bez wsparcia.

**C. Czysty composer (mobile-first):**
- **AC-13 (szersze pole na mobile)** — ✅. Pole w kontenerze `flex:1; minWidth:0` (L1272), a zdjęcie
  przeniesione z paska do „+" popover → mniej stałych kontrolek obok pola; kontrolki 40px, gap 6,
  wyrównanie do dołu.
- **AC-14 (wszystkie funkcje dostępne)** — ✅. „+" popover: Zdjęcie + Stałe preferencje (L1258+);
  rozmowa głosowa (przełącznik) + Wyślij/Stop po prawej; dyktowanie zostaje w `SmartTextarea`; nic
  nie usunięto (prefs przeniesione z nagłówka do „+", panel prefs bez zmian).
- **AC-15 (desktop spójny)** — ✅. Ten sam układ jednorzędowy skaluje się na desktopie (build 128
  stron OK); tylko zmienne CSS, teksty PL.

## Zgodność z konstytucją
- **C-01/C-02** — ✅ praca w `worldofmag/`, importy `@/*`.
- **C-10..C-14** — ✅ brak migracji/zmian schematu.
- **C-12** — ✅ `VoiceState` String-union.
- **C-20..C-25** — ✅ brak nowych akcji/sluga/`AIAction`; wykonanie/persystencja przez istniejące
  ścieżki; soft-delete niszczących przez `ActionDrawer`/execute bez zmian; `check:actions` zielone.
- **C-30/C-31/C-32** — ✅ tokeny CSS (wskaźnik/karty/composer/popover), mobile-first (pole flex-1,
  „+", cele dotyku), teksty/aria PL, prompt PL.
- **C-40/C-41** — ✅ routing modeli i klucze bez zmian (tylko instrukcje agenta).
- **C-53** — ✅ zmiany w istniejących plikach; reuse `handleExecute`/`handleRefine`/`ActionDrawer`/
  pętli 005; jeden refactor (wyjęcie `isDestructiveAction`); zero nowych zależności; wskaźnik na
  Tailwind `animate-pulse` (bez bibliotek).
- **C-54** — ✅ świadoma zmiana decyzji 005 (pauza → przepływ) odnotowana w spec/plan.

## Regresje
- **`ActionDrawer`** — używa teraz współdzielonego `DESTRUCTIVE_ACTION_TYPES` (ta sama lista);
  zachowanie (destructive opt-in, refine, execute) bez zmian; build/type-check zielone.
- **Ścieżka pisana** — plan renderuje się jak dotąd + dodatkowe szybkie przyciski; „Przejrzyj/popraw"
  otwiera ten sam drawer (`onOpenPlan`); wysyłka/stop/historia/prefs działają (prefs przeniesione do
  „+", panel bez zmian). Logika głosowa bramkowana `voiceState`/`pendingPlanId` — poza trybem głosowym
  no-op.
- **Prompt agenta** — zmiana instrukcji może wpłynąć na częstość plan vs answer; AC-2/AC-5 pilnują
  braku regresu wyraźnych poleceń. Katalog akcji, executory, read-toole bez zmian.

## Werdykt końcowy
**GOTOWE Z UWAGAMI.**
- Wszystkie 15 AC pokryte w warstwie logiki/instrukcji (dowody plik:linia); bramki
  (`check:migrations`, `check:actions`, `lint`, `build`) zielone.
- **Uwagi (nie blokujące):** (1) zachowanie agenta-kompana zależy od modelu LLM w runtime — warto
  potwierdzić kilkoma scenariuszami na `develop` (pytanie→rozmowa; „dodaj mleko do Zakupy"→plan; „dodaj
  zadanie" przy wielu projektach→clarify; „jestem zmęczony"→rozmowa); (2) pętla głosowa i wskaźnik —
  potwierdzalne ręcznie w Chrome (Web Speech poza CI). To ograniczenia weryfikacji, nie braki w kodzie.
- Brak braków wymagających powrotu do `/implement`. → przejście do `/review`.
