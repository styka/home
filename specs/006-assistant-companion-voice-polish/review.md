# Recenzja: Asystent-kompan — rozmowa, dopracowany głos, czysty composer

- **Spec/Plan/Verify:** ./spec.md · ./plan.md · ./verify.md (006-assistant-companion-voice-polish)
- **Data:** 2026-07-16
- **Zakres diffa (feature):** `fdbbf8c..HEAD` — 5 plików źródłowych: `agent/route.ts` (prompt),
  `fastPath.ts` (klasyfikator), `lib/ai/aiAction.ts` (helper), `ActionDrawer.tsx` (reuse),
  `AICommandSheet.tsx` (pętla głosowa + karty + composer) + artefakty `specs/006-*`.

## Ustalenia (od najpoważniejszego)

### 1. [correctness/UX] Dwie „żywe" karty planu po korekcie głosem — **NAPRAWIONE w recenzji**
- **Plik:** `AICommandSheet.tsx` — driver-effect, gałąź `plan`.
- **Opis:** Korekta głosem (wypowiedź spoza confirm/cancel przy aktywnej karcie) idzie do agenta i
  tworzy **nową** kartę planu, a poprzednia, niepotwierdzona zostawała „żywa" w wątku.
- **Scenariusz:** „dodaj zadanie do listy" → karta A; „nie, do listy Apteka" → agent replanuje → karta
  B; w wątku dwie karty z „Zatwierdź" → ryzyko przypadkowego potwierdzenia nieaktualnej (A).
- **Poprawka (naniesiona):** gdy pojawia się nowa karta planu, a istniała poprzednia niepotwierdzona
  (`pendingPlanIdRef`), poprzednią oznaczamy `dismissed` („Odrzucono" = zastąpiona). Build zielony.

### 2. [minor/edge] Głosowe „zatwierdź" przy planie WYŁĄCZNIE niszczącym
- **Plik:** `AICommandSheet.tsx` `quickConfirmPlan`.
- **Opis:** Przy planie złożonym tylko z akcji niszczących głosowe „zatwierdź" nie wykonuje nic
  (bezpiecznie) i wypowiada „potwierdź na karcie", ale `pendingPlanIdRef` jest już wyzerowane, więc
  późniejsze „odrzuć" nie trafi w kartę (pójdzie jako rozmowa).
- **Skutek:** Brak ryzyka (nic destrukcyjnego się nie wykona); użytkownik zamyka kartę dotykiem
  („Odrzuć"). Rzadki przypadek. **Werdykt:** akceptowalne; bez zmian.

### 3. [minor/UX] Popover „+" zamykany kliknięciem tła (bez Esc)
- **Plik:** `AICommandSheet.tsx` composer — „+" popover.
- **Opis:** Zamknięcie przez `fixed inset:0` backdrop (klik poza). Esc dedykowanego dla popovera nie
  ma; głównego Esc obsługuje sheet. Standardowy wzorzec; jeśli któryś przodek tworzy kontekst
  stackingu przez `transform`, `fixed` liczy się względem niego — w praktyce backdrop działa, a
  przycisk „+" i tak przełącza stan.
- **Skutek:** kosmetyczny. **Werdykt:** akceptowalne; bez zmian.

## Zgodność z konwencjami Omnia
- **C-01/C-02** — ✅ praca w `worldofmag/`, importy `@/*`.
- **C-12 (bez enumów)** — ✅ `VoiceState` String-union; `DESTRUCTIVE_ACTION_TYPES` to `Set<string>`.
- **C-20..C-23** — ✅ brak nowych mutacji/akcji/`AIAction`; wykonanie i persystencja przez istniejące
  ścieżki (`handleExecute`, `persist`); soft-delete niszczących przez `ActionDrawer`/execute bez zmian;
  `check:actions` zielone (95 akcji).
- **C-30** — ✅ kolory wskaźnika/kart/composera/popovera z tokenów; jedyny `#fff` był już wcześniej —
  przy okazji zamieniony na `var(--on-accent)` w przycisku wyślij.
- **C-31/C-32** — ✅ composer mobile-first (pole `flex-1 min-w-0`, „+", cele dotyku 40px), teksty/aria
  PL, prompt/STT PL.
- **C-53 (minimalizm/reuse)** — ✅ zmiany w istniejących plikach; jeden refactor pod reuse
  (`isDestructiveAction` wyjęte, `ActionDrawer` importuje ten sam zbiór — mniej duplikacji niż przed);
  reuse `handleExecute`/`handleRefine`/pętli 005; wskaźnik na Tailwind `animate-pulse` (bez bibliotek);
  zero nowych zależności.
- **C-54** — ✅ świadoma zmiana decyzji 005 (pauza→przepływ) odnotowana w spec/plan/verify.
- **Bezpieczeństwo** — ✅ brak kluczy/logów; brak nowego renderu HTML (mowa przez
  `speechTextFromMarkdown`); akcje niszczące dalej wymagają świadomego opt-in (głos ich nie wykona).

## Regresje
- **`ActionDrawer`** — teraz importuje `DESTRUCTIVE_ACTION_TYPES` z `@/lib/ai/aiAction` (identyczna
  lista); logika (opt-in, refine, execute) bez zmian; build/type-check zielone.
- **Ścieżka pisana** — plan renderuje się jak dotąd + szybkie „Zatwierdź/Przejrzyj-popraw/Odrzuć";
  „Przejrzyj/popraw" otwiera ten sam drawer; wysyłka/stop/historia/prefs (przeniesione do „+") działają.
  Cała logika głosowa bramkowana `voiceState`/`pendingPlanId` → poza trybem głosowym no-op.
- **Prompt agenta** — zmiana instrukcji (answer-first, clarify-when-ambiguous). Katalog akcji,
  executory, read-toole i routing modeli bez zmian; AC-2/AC-5 pilnują braku regresu wyraźnych poleceń.

## Werdykt
**APPROVE Z UWAGAMI.** Jedna realna usterka UX (nr 1 — dwie żywe karty po korekcie) znaleziona i
**naprawiona w recenzji**; build/lint/type-check zielone po poprawce. Uwagi nr 2–3 to akceptowalne,
bezpieczne przypadki brzegowe. Wszystkie 15 AC pokryte. Zachowanie agenta-kompana i pętli głosowej
warto potwierdzić „na żywo" na `develop` (LLM w runtime + Web Speech poza CI) — jak w `verify.md`.
