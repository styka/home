# Recenzja: 034-asystent-poziomy-koszty-ux

- **Spec:** ./spec.md · **Plan:** ./plan.md · **Weryfikacja:** ./verify.md
- **Data:** 2026-07-27
- **Zakres:** `git diff origin/develop...HEAD` — 41 plików, +2843/−347

## Ustalenia

### 1. `AICommandSheet.tsx:1389` — correctness (NAPRAWIONE w recenzji)
**Opis:** `loadConversation` wołało `collapseSections()` *przed* odczytem rozmowy, a po zmianie na
jeden stan panelu zamykało to również historię — czyli przed sprawdzeniem, czy odczyt się uda.
**Scenariusz awarii:** klikam rozmowę w historii → `getAiConversation` rzuca (sieć/serwer) →
`catch` łyka błąd → historia jest już zamknięta, na ekranie zostaje **stary** wątek i żadnej
informacji, że nic się nie wczytało. Przed zmianą historia zostawała otwarta.
**Poprawka (naniesiona):** `collapseSections({ keepPanel: true })` w `loadConversation`; panel zamyka
się dopiero po udanym wczytaniu (istniejące `setHeaderPanel("none")` na końcu `try`).

### 2. `AiCostBadge.tsx:5` — simplification (NAPRAWIONE w recenzji)
**Opis:** dwa osobne importy z tego samego modułu `@/lib/usdPln`.
**Skutek:** wyłącznie czytelność. **Poprawka (naniesiona):** scalone w jeden import.

### 3. `tags.ts` / `noteGroups.ts` — convention (ŚWIADOME, bez zmian)
**Opis:** rekord **systemowy** (bez właściciela) jest czytelny dla wszystkich, ale `updateTag`/
`deleteTag` rzucą dla zwykłego użytkownika. W `TagsManager` przyciski edycji i usuwania renderują się
dla wszystkich widocznych etykiet, więc na rekordzie systemowym skończą się komunikatem błędu.
**Skutek:** kosmetyczny — komunikat zamiast wyszarzonego przycisku; **nie** jest to dziura w dostępie
(guard po stronie serwera działa). Po backfillu z migracji 0212 wszystkie istniejące rekordy należą do
administratora, więc w praktyce właściciel systemu tego nie zobaczy. Zostawiam świadomie (C-53) —
ukrywanie przycisków wymagałoby przepchnięcia informacji o właścicielu do typu `Tag` w UI.

### 4. `resolver.ts:73` — correctness (sprawdzone, zachowanie poprawne)
**Opis:** `const row = own ?? base` — gdy wiersz poziomu istnieje, ale jego dostawca jest wyłączony,
NIE spadamy na dostawcę z poziomu standardowego, tylko na wbudowany fallback Groq.
**Ocena:** to zachowanie zamierzone i zgodne z dotychczasowym (`resolveLlmChain` zawsze tak robiło dla
wyłączonego dostawcy). Dziedziczenie dotyczy **pól**, nie „ratowania" wyłączonego dostawcy — inaczej
wyłączenie dostawcy na jednym poziomie dawałoby cichy powrót do innego, czego admin nie oczekuje.

### 5. `pricing.ts` — correctness (sprawdzone)
**Opis:** `estimateCost` jest synchroniczne i czyta cache modułu; gdyby `recordAiCall` zostało wywołane
bez wcześniejszego `ensurePricesLoaded()`, użyje wartości startowych z kodu.
**Ocena:** bezpieczne — wartości startowe to dokładnie dawny cennik, a jedyne ścieżki wołające
`recordAiCall` (`chatComplete`/`chatStream`) robią `ensurePricesLoaded()` przed wywołaniem modelu.
Nigdy nie schodzimy do „koszt 0" z powodu nieodczytanego cennika.

### 6. Sprawdzone i czyste (bez ustaleń)
- **C-23** — brak nowych `AIAction`; katalog, kontrakt i egzekutor spójne (`check:actions` zielone).
- **C-21** — wszystkie nowe odczyty przechodzą przez `ownedOrSystemWhere`, mutacje przez
  `assertDictionaryAccess`; `check:ai-coverage` wymusza realne wywołanie guarda w ciele akcji.
- **C-20** — `updateUserLlmPref`, `resetUserLlmPrefs`, `setModelPrice`, `deleteModelPrice` mają
  `revalidatePath`.
- **C-12** — `level`, `effort`, rodzaje dostawców to `String` + union TS; zero enumów Prisma.
- **C-30/C-32** — nowe komponenty wyłącznie na zmiennych CSS, teksty po polsku; brak hardcodowanych hexów.
- **C-41** — cennik i poziomy nie dotykają kluczy API; klucze nadal szyfrowane i maskowane.
- **Wsteczna zgodność wskaźnika kosztu** — pola tokenów pamięci podręcznej są opcjonalne w
  `AiCostCall`, więc rozmowy zapisane przed tą zmianą renderują się bez błędu.
- **Przepisy a etykiety** — `recipes.ts` operuje wyłącznie na `tagIds` (nie tworzy etykiet), więc
  zmiana unikalności `Tag.name` na klucz z właścicielem ich nie dotyka.
- **`prisma/seed.ts`** — `upsert` po nazwie zamieniony na `findFirst` + `create`, bo klucz złożony nie
  przyjmuje `NULL`; rekordy seedowe zostają systemowe (widoczne dla wszystkich).

## Werdykt

**APPROVE Z UWAGAMI.**

Dwie poprawki naniesione w trakcie recenzji (ustalenia 1–2), typecheck i bramki po nich zielone.
Uwagi niewymagające zmian: kosmetyczne zachowanie przycisków edycji na rekordach systemowych
(ustalenie 3) oraz to, że AC-11/AC-12/AC-16 zweryfikowano przeglądem kodu, a nie w przeglądarce
(odnotowane w `verify.md`) — pierwsze uruchomienie na środowisku testowym warto na to zerknąć.
