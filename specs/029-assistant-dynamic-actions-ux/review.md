# Recenzja: Ujednolicenie UX dynamicznych sekcji akcji asystenta AI + zgłaszanie problemów z asystentem

- **Spec:** ./spec.md · **Plan:** ./plan.md · **Verify:** ./verify.md
- **Data:** 2026-07-25
- **Recenzent:** Claude Code (spec-driven pipeline, etap /review)
- **Diff:** `origin/develop...HEAD` — 4 pliki źródłowe (`usage.ts`, `fastPath.ts`, `agent/route.ts`,
  `AICommandSheet.tsx`) + artefakty + `doświadczenia.md`.

## Ustalenia (od najpoważniejszego)

### 1. [correctness] Nieużyty prefiks 🐛 mógł „przenieść się" na niezwiązane zadanie — **NAPRAWIONE w recenzji**
- **Plik:** `AICommandSheet.tsx` — `feedbackPrefixRef` (ustawiany przy zgłoszeniu, czyszczony tylko w `handleExecute`).
- **Scenariusz awarii:** user otwiera główny robaczek → agent proponuje plan → user **odrzuca** plan
  (lub wysyła inną, normalną wiadomość) zamiast zatwierdzić → `feedbackPrefixRef` zostaje `"🐛 "` →
  następne, niezwiązane `create_task` (np. „dodaj zadanie kup mleko") dostaje błędnie tytuł „🐛 kup mleko".
- **Poprawka (naniesiona, bezpieczna):** czyszczenie `feedbackPrefixRef.current = null` w `dismissPlanTurn`
  oraz na starcie normalnej (nie-zgłoszeniowej) ścieżki `handleSend`. Prefiks obowiązuje więc tylko dla
  bezpośredniej ścieżki zgłoszenie→wykonanie. Build zielony po poprawce.

### 2. [correctness] Spójność sumy kosztu — sprawdzone, OK
- `accrueUsage` dolicza `costUsd` do `meter.costUsd` **i** dopisuje ten sam `costUsd` do `meter.calls` —
  z definicji suma pozycji == kwota w stopce (AC-6). Brak `usage` → pomijane w obu miejscach spójnie.

### 3. [convention] Zgodność ze stylem repo — OK
- Nowe komponenty (`CostChip`, `ResultRows`) i style używają wyłącznie zmiennych CSS (`var(--*)`),
  teksty PL, brak hardcodowanych hexów (C-30/C-32). `UsageCall` to `type` z polami prostymi — zero enumów
  (C-12). Panel kosztu `overflow-x:auto`, SpeakButton 26×26 (cel dotyku, C-31).

### 4. [simplification] Reuse — OK
- Lista wyników wydzielona do współdzielonego `ResultRows` (scalona sekcja planu + wsteczna zgodność
  tury `results`) — brak duplikacji. Brak nowych zależności. `MetaFooter` zastąpione `CostChip` bez
  martwego kodu (grep: brak referencji do `MetaFooter`).

### 5. [security] Bez uwag
- Brak logowania/zwracania kluczy (C-41). `calls` niosą tylko nazwę modelu/tokeny/koszt — brak wrażliwych
  danych. Render markdown niezmieniony (istniejący, bezpieczny `markdownToHtml`). Diagnostyka AI w raporcie
  pozostaje best-effort i nie zmienia bramek uprawnień.

### 6. [correctness] Hydratacja / append-only — sprawdzone, OK
- `loadConversation` scala `results` w poprzedzającą turę `plan` (mutacja tej samej referencji w tablicy),
  znacznik `{undo:true}` ustawia `undone`; stare rozmowy bez planu renderują `results` samodzielnie.
  Brak podwójnej sekcji po przeładowaniu.

## Werdykt

**APPROVE Z UWAGAMI** — jedno realne ustalenie (stały prefiks) naprawione w trakcie recenzji; pozostałe
obszary bez zastrzeżeń. Bramki zielone (`check:migrations`, `check:actions`, `check:ai-coverage`,
`next lint`, `next build`). Zgodność z konstytucją zachowana. Domykam pipeline: merge do `develop` i
automatyczna promocja `develop → master` (C-52).
