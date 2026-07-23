# Recenzja: Naprawa czatu asystenta AI po wyborze dostawcy Anthropic (`temperature`)

- **Spec:** ./spec.md · **Plan:** ./plan.md · **Verify:** ./verify.md
- **Data:** 2026-07-23
- **Zakres diffa:** `worldofmag/src/lib/llm/chat.ts` (+74/−31), nowy test `anthropicBody.test.ts`,
  wpis `doświadczenia.md`, artefakty `specs/026-*`.

## Ustalenia
Brak ustaleń blokujących ani drobnych. Recenzja skupiona na `chat.ts` (jedyna zmiana zachowania).

### Analiza równoważności (behavior-preserving refaktor)
- **OpenAI jednorazowy** — `openAiBody(cfg,opts,false)` odtwarza dawne ciało: `model/messages/
  temperature/max_tokens` + `response_format` gdy `opts.json`. `else if (opts.json)` jest bezpieczne
  (w wariancie nie-stream `stream` nigdy nie jest ustawiony). ✅ równoważne.
- **OpenAI strumień** — `openAiBody(cfg,opts,true)` daje `…+ stream:true` bez `response_format`;
  poprzednio strumień OpenAI **nigdy** nie wysyłał `response_format`, a `if(stream)` wygrywa gałąź,
  więc zachowanie identyczne. ✅
- **Anthropic (oba warianty)** — `anthropicBody` pomija **wyłącznie** `temperature`; `model`,
  `max_tokens`, `system` (z `cache_control`), `messages`, `stream` bez zmian. Transform `toAnthropic`/
  `toAnthropicSystem` reużyty (C-53). ✅ zamierzona i jedyna zmiana zachowania.

### Poprawność
- Fix trafia w przyczynę z diagnostyki: `temperature` nie leci już do Anthropic → brak 400
  „temperature is deprecated" → łańcuch fallbacku nie jest przerywany nieprzejściowym 4xx. Grep
  potwierdza: `temperature` w ciele żądania tylko w `openAiBody` (`chat.ts:191`); ścieżka Anthropic
  czysta. Scenariusz awarii (Anthropic reasoning) — wyeliminowany.
- `JSON.stringify` pomija klucze `undefined`, więc `temperature: undefined` w `openAiBody` zachowuje
  dotychczasowe „nie wysyłaj gdy brak" — bez zmiany na ścieżce OpenAI.

### Konwencje / bezpieczeństwo / uproszczenia
- **C-40:** rozróżnienie po rodzaju dostawcy (osobne buildery), nie hardcode modelu w logice operacji;
  `resolver.ts` nietknięty. ✅
- **C-41:** klucze budowane w nagłówkach na miejscu wywołania, nie w ciele; buildery nie logują/nie
  zwracają klucza. ✅
- **C-53:** minimalny, reużywa istniejących helperów; `export` builderów uzasadniony testem. ✅
- **C-01/C-02/C-12/C-30..C-32:** zmiana backendowa w `worldofmag/`, alias importów, brak enumów, brak
  hardcode kolorów, brak UI — nie dotyczą lub spełnione. ✅
- Brak martwego kodu — usunięto zbędne lokalne `const { system, messages } = toAnthropic(...)` z obu
  funkcji anthropic (przeniesione do buildera).

## Werdykt
**APPROVE.** Fix jest poprawny, minimalny i behavior-preserving poza zamierzonym pominięciem
`temperature` dla Anthropic. Bramki zielone (verify.md: test:unit 0 fail, check:migrations/actions OK,
lint bez błędów, tsc czysto, next build exit 0). Domykam: merge do `develop` i automatyczna promocja
`develop → master` (C-52).
