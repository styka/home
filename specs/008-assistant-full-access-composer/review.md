# Recenzja kodu: Asystent — pełny dostęp, „query-first", composer jak ChatGPT, wybór głosu

- **Spec:** ./spec.md · **Plan:** ./plan.md · **Weryfikacja:** ./verify.md
- **Data:** 2026-07-17
- **Zakres diffa:** `origin/develop...HEAD` — 5 plików źródłowych (`fastPath.ts`, `agent/route.ts`,
  `AICommandSheet.tsx`, `SmartTextarea.tsx`, `tts.ts`) + artefakty specs + `doświadczenia.md`.
- **Werdykt:** ✅ **APPROVE** (bez blokad; drobne poprawki naniesione w trakcie recenzji).

## Ustalenia (od najpoważniejszego)

### 1. [convention] `fastPath.ts` — JSDoc `classifyIntent` odklejony od funkcji — **NAPRAWIONE w recenzji**
Nowe helpery (`READ_INTENT_RE`, `SHOPPING_NAMED_LIST_RE`, `isBlank`, `hasEmptyPayload`) wstawiono
między blok JSDoc a `export async function classifyIntent`, przez co dokumentacja przestała opisywać
funkcję. **Skutek:** wyłącznie czytelność (brak wpływu na działanie). **Poprawka (naniesiona):**
przeniosłem helpery ponad JSDoc, doc wrócił bezpośrednio nad `classifyIntent`. Lint/build zielone po zmianie.

### 2. [correctness] Strażnik `READ_INTENT_RE` / `SHOPPING_NAMED_LIST_RE` może nad-kwalifikować do „complex" — **świadome, bezpieczne**
Regex intencji odczytu jest kotwiczony na początku wypowiedzi, a `SHOPPING_NAMED_LIST_RE` łapie rdzeń
„list" (trafi też np. „listopad"/„listek"). **Scenariusz:** „dodaj mleko na listopad" → `complex`
zamiast fast-path. **Skutek:** tylko wyższa latencja (pełny agent i tak poprawnie obsłuży tworzenie) —
nigdy błędne działanie; polecenia tworzące (dodaj/utwórz/zanotuj/kup/zaplanuj/zatankowałem) nie
zaczynają się od słów z `READ_INTENT_RE`, więc nie są blokowane. Zgodne z założeniem planu („nadmiar
complex jest OK"). **Bez zmian** — to celowy, bezpieczny kompromis (C-53).

### 3. [convention] Composer: „Wyślij" ukryty przy pustym polu (zamiast wyszarzony) — **OK, celowe**
Nowy composer pokazuje „Wyślij" dopiero gdy `inputText.trim() || attachedImage`; przy pustym polu widać
kółko rozmowy głosowej (wzór ChatGPT). **Skutek:** brak — pustej wiadomości i tak nie da się wysłać;
wszystkie funkcje dostępne (dyktowanie odsłania „Wyślij"). Bez regresji.

### 4. [correctness] Zapamiętany głos niedostępny na urządzeniu — `<select>` bez dopasowanej opcji — **akceptowalne**
Gdy `omnia.aiVoice` wskazuje `voiceURI` spoza bieżącej listy (inne urządzenie/przeglądarka),
`<select value={voiceURI}>` nie ma pasującej `<option>` (wizualnie pokaże pierwszą), ale stan trzyma
zapamiętany URI, a `speak()` bezpiecznie wraca do głosu domyślnego (`tts.ts:150`). **Skutek:** kosmetyka;
brak błędu. Dosypywanie „widmowej" opcji byłoby nadmiarowe (C-53). **Bez zmian.**

## Zgodność z konstytucją
- **C-01** (praca w `worldofmag/`), **C-02** (alias `@/`), **C-12** (brak enumów — bez zmian schematu):
  ✅.
- **C-10..C-14** (migracje): N/D — brak zmian schematu. ✅
- **C-20/C-21/C-22/C-23**: brak nowych mutacji, guardów, slugów ani `AIAction` (`check:actions` ✅). ✅
- **C-30** (zmienne CSS): cały nowy UI na `var(--*)` (pigułka, kółko `var(--accent-blue)`/
  `var(--on-accent)`, selektor). Brak nowych hexów. ✅
- **C-31** (mobile-first): pigułka `w-full`, pole `flex-1 min-w-0`, cele ≈38px; overlay, nie sidebar. ✅
- **C-32** (PL): wszystkie nowe teksty po polsku. ✅
- **C-40/C-41**: routing modeli/klucze bez zmian. ✅
- **C-53** (minimalizm): `bare` opt-in, zero nowych zależności, reużycie read-tooli/executorów. ✅

## Bezpieczeństwo
- Brak nowych wejść od użytkownika renderowanych jako HTML; `<select>`/tekst są kontrolowane. Brak
  logowania/wycieku kluczy. Read-toole nadal w zakresie własności użytkownika. ✅

## Regresje
- **`SmartTextarea` (współdzielony):** `bare` domyślnie `false`; jedyny konsument `bare` to composer
  Asystenta. Ścieżka bez `bare` niezmieniona; build typuje wszystkich konsumentów. ✅
- **Pętla głosowa:** rdzeń (`startListening`/`scheduleListen`/driver) nietknięty; zmiana to skrócony
  announce i przeniesienie toggle na kółko (dalej `primeSpeech`+`startListening`). ✅
- **Import `Mic`** usunięty (nieużywany); `MicOff` dalej używany w pasku stanu. Lint/build ✅.

## Bramki (potwierdzone w recenzji)
`check:migrations` ✅ · `check:actions` ✅ (95 akcji) · `next lint --dir src` ✅ (brak findings w 008) ·
`next build` ✅ („✓ Compiled successfully", lokalny Postgres — nie prod, C-13).

## Werdykt
✅ **APPROVE.** Zmiana realizuje wszystkie 6 punktów właściciela i 11 AC, zgodna z konstytucją, bez
regresji. Jedna drobna poprawka czytelności naniesiona w trakcie recenzji (przeniesienie JSDoc).
Domykam zadanie: merge brancha roboczego → `develop` (standing authorization C-52). AC-1/2/5/11 do
finalnego potwierdzenia na test env `develop` (zależność od LLM/urządzenia) — kod deterministyczny na
miejscu.
