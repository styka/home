# Recenzja: Architektura AI dla Asystenta Osobistego

- **Spec:** ./spec.md · **Plan:** ./plan.md · **Verify:** ./verify.md · **Data:** 2026-07-15
- **Zakres:** 16 plików, +1302/−11 (baza: punkt startu brancha `claude/ai-architecture-personal-assistant-ms655f`).

## Ustalenia (od najpoważniejszego)

Brak ustaleń **correctness/security** blokujących. Poniżej uwagi drobne (nie-blokujące):

1. **`usage.ts:134` — `maybeFireCostAlert` na każde wywołanie LLM** (convention/efficiency).
   Skutek: gdy próg > 0, każde `chatComplete` robi dodatkowy odczyt `Config` + agregację `AiCall` +
   zapytanie o adminów. Dla prywatnego, jednoużytkownikowego systemu (kilkadziesiąt wywołań/dzień) to
   pomijalne; gdy próg = 0 (domyślnie) kończy po jednym tanim odczycie. Świadomie minimalne (C-53) —
   zostawiam; ewentualna optymalizacja (próbkowanie) dopiero gdyby ruch urósł.
2. **`chat.ts` (anthropicComplete) — `totalTokens` nie wlicza tokenów cache** (convention).
   `total = input+output` (bez `cache_read/creation`). Koszt liczony jest osobno i **poprawnie**
   (promptTokens pełną ceną, cache tańszą/droższą wg mnożników — zgodnie z semantyką Anthropic, gdzie
   `input_tokens` już wyklucza tokeny cache). `totalTokens` jest jedynie informacyjny — bez wpływu na
   koszt/budżet. Pozostawiam jako świadome uproszczenie.
3. **`llmConfig.ts` `applyAnthropicProfile` — nadpisuje `baseUrl` istniejącego providera Anthropic**
   na `https://api.anthropic.com/v1` (convention). To zamierzone dla „profilu" (reset do standardu);
   gdyby ktoś używał własnego proxy Anthropic, może go zresetować — akceptowalne dla przycisku-skrótu,
   `baseUrl` i tak edytowalny w karcie dostawcy.

## Poprawność / bezpieczeństwo (sprawdzone, OK)
- **Guardy dostępu (C-21/C-22):** wszystkie nowe akcje (`getAiCostBreakdown`, `get/setCostAlertThreshold`,
  `applyAnthropicProfile`) wołają `requireAdmin()`; strony pod `module.admin`. ✅
- **`revalidatePath` (C-20):** `setCostAlertThreshold` i `applyAnthropicProfile` kończą
  `revalidatePath("/admin/llm")`. ✅
- **Sekrety (C-41):** klucz Anthropic `encryptSecret`; nigdzie nie logowany (audyt loguje tylko fakt). ✅
- **`AIAction` (C-23):** brak nowych wariantów — fast-path reużywa istniejące typy; `check:actions` ✅.
- **Migracja↔schema (C-10/12):** `0205_ai_call_log` zgodne ze `schema.prisma` (te same pola/indeksy),
  `String`/`Float`, zero enumów; `check:migrations` ✅, `migrate deploy` lokalnie ✅.
- **Fast-path fallback:** każda niepewność/błąd LLM/moduł nieaktywny → `complex` → pełna pętla; brak
  ryzyka „utknięcia" ani wykonania zapisu bez ActionDrawer. ✅
- **Fire-and-forget log:** `void recordAiCall(...).catch(()=>{})` — błąd logu nie wywala odpowiedzi. ✅
- **Brak cyklu importów:** `usage.ts`→`actions/notifications` nie tworzy cyklu (build zielony). ✅

## Werdykt
**APPROVE Z UWAGAMI.** Zmiany poprawne, zgodne z konstytucją i konwencjami Omnia; uwagi 1–3 są drobne i
świadome (minimalizm), nie wymagają zmian przed merge. Bramki i AC potwierdzone w `verify.md`.
