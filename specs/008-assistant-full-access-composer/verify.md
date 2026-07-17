# Weryfikacja: Asystent — pełny dostęp, „query-first", composer jak ChatGPT, wybór głosu

- **Spec:** ./spec.md · **Plan:** ./plan.md · **Zadania:** ./tasks.md
- **Data:** 2026-07-17
- **Werdykt:** ✅ **GOTOWE Z UWAGAMI** (wszystkie bramki zielone; AC-1/2/5/11 zależne od LLM/urządzenia
  — do ostatecznego potwierdzenia na test env `develop`, kod deterministyczny na miejscu).

## 1. Bramki techniczne
| Komenda | Wynik |
|---------|-------|
| `npm run check:migrations` | ✅ „Numeracja migracji OK (następny wolny numer: 0206)" — 0 nowych migracji |
| `npm run check:actions` | ✅ „95 akcji w katalogu, wszystkie obsługiwane przez executor" — 0 nowych `AIAction` |
| `npx next lint --dir src` | ✅ brak findings w plikach 008 (pozostają tylko istniejące warningi w innych modułach) |
| `npx next build` (lokalny Postgres `127.0.0.1/omnia_dev`, **nie** prod — C-13) | ✅ kompilacja + walidacja typów OK, pełna tabela tras wygenerowana |

## 2. Kryteria akceptacji
| AC | Werdykt | Dowód |
|----|---------|-------|
| **AC-1** klasyfikacja odczytu | ✅ (kod; live na develop) | `fastPath.ts:138` `READ_INTENT_RE.test(trimmed)` → `complex`; regex kotwiczony `^\s*(podaj|pokaż|…|zaproponuj|…)` łapie „podaj mi zadanie…"; agent realizuje query+answer (prompt `agent/route.ts:245`). Strażnik pustego payloadu `fastPath.ts:105` blokuje „dodanie niczego". |
| **AC-2** intencje find/show | ✅ (kod; live) | `READ_INTENT_RE` obejmuje `pokaż/ile/znajdź/jakie/co mam/masz/…` (`fastPath.ts:92`) + reguła promptu QUERY-FIRST (`agent/route.ts:245`). |
| **AC-3** query-first, bez „mielenia" | ✅ | Reguła promptu: „Filtruj PO STRONIE NARZĘDZIA … nie przetwarzaj dużych zbiorów w całości" (`agent/route.ts:245`); read-toole mają parametry `search/status/limit` (`agentTools.ts:26-49`). |
| **AC-4** pełny dostęp | ✅ (inspekcja) | `READ_TOOLS_PROMPT` wstrzykiwany **bezwarunkowo** (`agent/route.ts:232`); `READ_TOOL_NAMES` pokrywa wszystkie 15 modułów katalogu; dostęp w zakresie własności (`agentTools.ts` ownerScope). Bez zmian kodu — brak nowych read-tooli (moduły spoza `AIActionModule` świadomie poza zakresem). |
| **AC-5** nazwany kontener | ✅ (kod; live) | fast-path: `SHOPPING_NAMED_LIST_RE` → `complex` dla `add_item` (`fastPath.ts:98,172`); prompt „SZANUJ WSKAZANY KONTENER" (`agent/route.ts:246`); executor priorytetyzuje `listName`/`projectName` (`shared.ts:85`, `shared.ts:165`). |
| **AC-6** composer wygląd | ✅ (struktura; wizual na urządzeniu) | Pigułka: kontener `border/bg/borderRadius:24` (`AICommandSheet.tsx:1310-1311`), `+` okrągły, `bare SmartTextarea` (`:1340`), kółko `AudioLines` w wypełnionym `var(--accent-blue)` (`:1351`), Wyślij/Stop. Wyłącznie zmienne CSS. |
| **AC-7** kompletność funkcji | ✅ | Zachowane: `toggleVoice` (dalej `primeSpeech()`+`startListening()`), `handleSend`, `stopGeneration`, popover `+` (Zdjęcie + „Ustawienia asystenta"), dyktowanie (bare zachowuje mikrofon SmartTextarea), tryb głosowy. Build typuje wszystkie handlery. |
| **AC-8** mniej gadania | ✅ | `AICommandSheet.tsx:449` — komunikat skrócony do „Przygotowałem N akcji." (bez recytowania „powiedz zatwierdź/odrzuć/podaj poprawkę"); przyciski/instrukcje na karcie zostają wizualnie. |
| **AC-9** wybór głosu — ustawienia | ✅ | Selektor w panelu ustawień (`AICommandSheet.tsx:1134`), zasilany `getAvailableVoices()`, subskrypcja `onVoicesChanged` (efekt przy montażu); async-safe — hint „Głosy ładują się…" gdy pusto. |
| **AC-10** trwałość + użycie | ✅ | `setPreferredVoiceURI`→`localStorage["omnia.aiVoice"]` (`tts.ts:92`), leniwy `getPreferredVoiceURI` (`:80`); `speak()` ustawia `u.voice=match` gdy głos dostępny, inaczej domyślny (`tts.ts:150`). |
| **AC-11** brak regresji pętli głosowej | ✅ (kod; live Chrome/iOS) | Rdzeń pętli (`startListening`/`scheduleListen`/driver `useEffect`) niezmieniony; jedyne zmiany: skrócony announce (T-6) i przeniesienie toggle do kółka (dalej `primeSpeech`+`startListening`). Build zielony. |

## 3. Zgodność z konstytucją
- **C-10..C-14 (migracje):** N/D — brak zmian schematu; `check:migrations` zielone. ✅
- **C-20/C-21:** brak nowych mutacji; read-toole/executory respektują `ownerId`/`ownerTeamId` (bez zmian). ✅
- **C-22 (RBAC):** brak nowych slugów; feature w `module.home`. ✅
- **C-23 (AIAction↔executor):** 0 nowych akcji; `check:actions` zielone. ✅
- **C-30 (zmienne CSS):** nowy kod używa wyłącznie `var(--*)` (pigułka, kółko `var(--accent-blue)`/
  `var(--on-accent)`, selektor); brak nowych hexów. (Istniejące `rgba(...)` w toolbarze SmartTextarea
  są sprzed zmiany i nietknięte.) ✅
- **C-31 (mobile-first):** pigułka `w-full`, pole `flex-1 min-w-0`, cele ≥38px; to overlay, nie sidebar. ✅
- **C-32 (PL):** wszystkie nowe teksty po polsku. ✅
- **C-40:** routing modeli DB-driven bez zmian. ✅
- **C-53 (minimalizm):** `bare` opt-in (domyślnie false), brak nowych zależności/abstrakcji, reużycie
  istniejących read-tooli/executorów. ✅

## 4. Regresje
- **`SmartTextarea` (współdzielony komponent):** nowy prop `bare` domyślnie `false` → ścieżka bez `bare`
  identyczna jak dotąd; `bare` przekazuje **wyłącznie** composer Asystenta (grep potwierdza jeden
  konsument). Build typuje wszystkich konsumentów (tasks/notes/…). ✅ bez regresji.
- **Import `Mic`** usunięty z `AICommandSheet` (był nieużywany po zmianie kółka) — `MicOff` dalej
  używany w pasku stanu. Build/lint zielone. ✅
- **Composer — widoczność „Wyślij":** przy pustym polu Send jest ukryty (zamiast wyszarzony), pojawia
  się gdy jest treść lub załączone zdjęcie (`inputText.trim() || attachedImage`). Ścieżka wysyłki
  zachowana. ✅
- **`tts.ts` / `speak()`:** sygnatura publiczna bez zmian; wszystkie istniejące wywołania (voiceAnnounce,
  driver, SpeakButton) działają jak dotąd, dodatkowo respektując wybrany głos. ✅

## 5. Werdykt końcowy
✅ **GOTOWE Z UWAGAMI.** Wszystkie bramki (`check:migrations`, `check:actions`, `next lint`,
`next build`) zielone; wszystkie AC pokryte kodem. Uwagi: AC-1/AC-2/AC-5 (zachowanie klasyfikatora/
agenta — zależne od LLM) oraz AC-11 (pętla głosowa Chrome + iOS/Safari) wymagają **potwierdzenia na
test env `develop`/urządzeniu** — kod deterministyczny (strażniki fast-path, reguły promptu, wtopiona
pigułka) jest na miejscu i nie zmienia rdzenia pętli głosowej. Przechodzę do `/review`.
