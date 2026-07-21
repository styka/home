# Recenzja: Odporność asystenta AI na wyczerpanie limitu modelu

- **Spec:** ./spec.md · **Plan:** ./plan.md · **Verify:** ./verify.md
- **Data:** 2026-07-21
- **Diff:** 3 pliki kodu (`chat.ts` +helpery/slice, `resolver.ts` +ogniwo 8b, `route.ts` ±komunikat) + 1 nowy test. Bez migracji, bez `AIAction`, bez UI-nawigacji.

## Ustalenia (od najpoważniejszego)
Brak ustaleń blokujących ani istotnych. Sprawdzone świeżym okiem:

1. **correctness — degradacja** (`resolver.ts` krok 3): ogniwo 8b dokładane po legacy-Groq, z dedupem;
   `chatComplete` iteruje łańcuch i przy 429 (retryable) próbuje kolejnego ogniwa. Potwierdzone
   uruchomieniem: `reasoning` = 70b→8b, a z adminowym Anthropic = anthropic→70b→8b (Anthropic 1.).
   **Werdykt:** poprawne, bez scenariusza awarii.
2. **correctness — klasyfikacja** (`chat.ts` `classifyRateLimitKind`): działa na treści z 300 znaków
   (sygnał „(TPD)/(TPM)" mieści się w tym oknie — z realnych logów ~150 znaków); `\btpd\b`/`\btpm\b`
   łapią token także w nawiasach; brak sygnału → `generic` (bezpieczny „za chwilę"). Testy 6/6.
   **Werdykt:** poprawne.
3. **correctness — komunikat w route** (`route.ts` catch 429): 429 zawsze → `rateLimitUserMessage(...)`
   (polski, nigdy surowy tekst). Ścieżka ≠429 zwraca `providerMsg` — to **zachowanie sprzed 017**
   (niezmienione semantycznie: `providerMsg` = dawne `e.message`), więc nie regresja. **Werdykt:** OK.
4. **convention (C-40)**: degradacja rozszerza **istniejący** łańcuch w resolverze (miejsce właściwe dla
   routingu modeli), nie hardkoduje modelu w kodzie cechy; admin nadal wybiera 1. ogniwo. **Werdykt:** zgodne.
5. **convention (C-41/C-32)**: komunikaty statyczne po polsku; treść dostawcy służy tylko klasyfikacji i
   logowi (`AiCall`), nie jest pokazywana użytkownikowi przy 429. **Werdykt:** OK.
6. **simplification (C-53)**: minimalny diff; `decryptSecret(legacy.value)` liczone 2× (krok 2 i 3) — tania
   operacja synchroniczna, nie warto refaktorować dla jednego wywołania. **Werdykt:** akceptowalne.
7. **security**: brak wycieku klucza, brak nowych ścieżek danych/uprawnień; test pilnuje braku surowego
   tekstu dostawcy. **Werdykt:** brak zagrożeń.

## Bramki (potwierdzone w verify.md, ten sam commit)
`check:actions` ✅ · `check:migrations` ✅ · `next lint` ✅ · `next build` ✅ · `test:unit` ✅ (414 pass, +6 nowe).

## Werdykt
**APPROVE.** Zmiana minimalna, poprawna, przetestowana; realizuje decyzję właściciela (degraduj-i-działaj
+ uczciwy komunikat). Domykam: merge `claude/ai-chat-task-filtering-bug-8tevho` → `develop` → push, a
następnie automatyczna promocja `develop → master` (C-52).
