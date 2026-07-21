# Recenzja: Zapytania odczytowe w asystencie AI nie giną na limicie modelu

- **Spec:** ./spec.md · **Plan:** ./plan.md · **Verify:** ./verify.md
- **Data:** 2026-07-21
- **Diff:** 2 pliki kodu zmienione (`agentTools.ts` +69, `route.ts` ±2) + 1 nowy test (+48); reszta to artefakty pipeline'u i wpis do `doświadczenia.md`.

## Ustalenia (od najpoważniejszego)
Brak ustaleń blokujących ani istotnych. Punkty sprawdzone świeżym okiem:

1. **correctness — parsowanie wierszy** (`agentTools.ts:buildReadToolsPrompt`): regex `/^- (\w+):/`
   poprawnie wyłuskuje nazwę narzędzia z każdego wypunktowania; wszystkie narzędzia są w oryginale w
   osobnych liniach, a opisy nie zaczynają linii od `- `. Linie puste/nagłówek zachowane (`return true`).
   **Werdykt:** poprawne, brak scenariusza awarii.
2. **correctness — fallback** : `selected` = przecięcie `modules` z wartościami `READ_TOOL_MODULE`; puste
   → zwraca pełny `READ_TOOLS_PROMPT`. Moduł bez read-tooli (np. hipotetyczny routing tylko na `truck`)
   → pełny katalog zamiast pustego; gorszy przypadek = zachowanie jak przed zmianą (zero regresji).
   **Werdykt:** bezpieczne.
3. **correctness — narzędzia core**: `list_calendar`, `web_search`, `list_trash` zawsze dołączane —
   agent nie traci dostępu do kalendarza/wyszukiwarki/kosza przy zawężeniu. **Werdykt:** OK.
4. **convention (C-53) — reuse/minimalizm**: `READ_TOOLS_PROMPT` pozostaje jedynym źródłem prawdy;
   builder tylko filtruje jego wiersze, wzorem `buildActionCatalog(modules)`. Zero duplikacji tekstu,
   zero nowych zależności, brak martwego kodu. **Werdykt:** zgodne.
5. **convention (C-32/C-40/C-41)**: komentarze i logika po polsku; brak hardkodowanego providera/modelu;
   brak logowania/wycieku kluczy. **Werdykt:** OK.
6. **security**: brak nowych ścieżek danych, brak zmian w guardach dostępu, brak renderu HTML/markdown.
   `runReadTool`/`READ_TOOL_NAMES` nietknięte — wykonanie narzędzi nadal w zakresie dostępu użytkownika.
   **Werdykt:** brak zagrożeń.

## Bramki (potwierdzone w verify.md, ten sam commit)
`check:actions` ✅ · `check:migrations` ✅ · `next lint` ✅ · `next build` ✅ · `test:unit` ✅ (332 pass, +4 nowe).

## Werdykt
**APPROVE.** Zmiana jest minimalna, poprawna, dobrze przetestowana i usuwa **przyczynę** (nie objaw)
przeciążenia dla zapytań odczytowych. Domykam: merge `claude/ai-chat-task-filtering-bug-8tevho` →
`develop` → push, a następnie automatyczna promocja `develop → master` (C-52).
