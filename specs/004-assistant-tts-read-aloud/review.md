# Recenzja: Odczytywanie postów Asystenta na głos

- **Spec/Plan/Verify:** ./spec.md · ./plan.md · ./verify.md
- **Data:** 2026-07-15
- **Diff:** `worldofmag/src/lib/tts.ts` (+43), `worldofmag/src/components/home/AICommandSheet.tsx` (+65) — 2 pliki.

## Ustalenia (od najpoważniejszego)
Brak ustaleń blokujących ani wymagających zmian. Prześledzone punkty ryzyka i werdykt każdego:

1. **Wyścig `onEnd` przy przełączaniu odczytu** (correctness) — `AICommandSheet.tsx toggleSpeak`.
   Klik posta B w trakcie odczytu A woła `stopSpeaking()`, co asynchronicznie odpala `onend`/`onerror`
   utterance A → `setSpeakingId(cur => cur===A ? null : cur)`. Do czasu tego callbacku stan to już B,
   więc guard zwraca `cur` (B) i **nie kasuje** aktywnego B. ✅ Zabezpieczone poprawnie.
2. **`u.onerror` przy `cancel()`** (correctness) — część przeglądarek zgłasza anulowanie jako `onerror`
   ("interrupted"), nie `onend`. Oba zdarzenia wpięte w ten sam `onEnd` → stan zawsze się domyka; guard
   z pkt 1 chroni przed skasowaniem nowszego odczytu. ✅ OK.
3. **Hydratacja `SpeakButton` (`useState(() => ttsSupported())`)** (informational) — na SSR `ttsSupported()`
   = false (brak `window`). Ale `turns` startują puste (ładowane po stronie klienta efektami), więc żaden
   `SpeakButton` nie trafia do HTML serwera → **brak realnego mismatchu**. Lazy init jest tu bezpieczny. ✅
4. **ReDoS w `speechTextFromMarkdown`** (security) — regexy liniowe/leniwe (`` ```[\s\S]*?``` ``,
   `[^`]+`, linki), bez zagnieżdżonych kwantyfikatorów → brak katastroficznego backtrackingu. ✅
5. **Bezpieczeństwo XSS** — tekst idzie wyłącznie do `SpeechSynthesisUtterance` (nie do DOM/innerHTML),
   render markdown bez zmian (istniejący `markdownToHtml`). ✅ Brak nowej powierzchni ataku.

## Konwencje Omnia
- **C-01/C-02** ✅ tylko `worldofmag/src`, import `@/lib/tts`. · **C-12** ✅ brak enumów/schematu.
- **C-30** ✅ kolory z tokenów CSS. · **C-31** ✅ przycisk spójny z `CopyButton`, bez zmian layoutu mobile.
- **C-32** ✅ teksty i `aria-label` po polsku. · **C-53** ✅ reużycie `CopyButton`/`@/lib/tts`, 0 nowych zależności.
- Nie dotyczą: C-10..C-14 (migracje), C-20..C-25 (akcje/RBAC/AIAction/trash/audit), C-40/C-41 (LLM/klucze).

## Bramki (z verify.md)
`check:migrations` ✅ · `check:actions` ✅ · lint (zmienione pliki) ✅ · `tsc --noEmit` ✅ exit 0 · `next build` ✅ exit 0.

## Werdykt
✅ **APPROVE** — zmiana mała, poprawna, zgodna z konwencjami i minimalistyczna. Bez poprawek. Domykam do `develop`.
