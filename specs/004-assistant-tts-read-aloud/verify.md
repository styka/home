# Weryfikacja: Odczytywanie postów Asystenta na głos

- **Spec:** ./spec.md · **Plan:** ./plan.md · **Tasks:** ./tasks.md
- **Data:** 2026-07-15
- **Werdykt:** ✅ GOTOWE

## Bramki techniczne
| Komenda | Wynik |
|---------|-------|
| `npm run check:migrations` | ✅ „Numeracja migracji OK (następny wolny numer: 0206)." — brak nowej migracji (feature bez schematu) |
| `npm run check:actions` | ✅ „95 akcji w katalogu, wszystkie obsługiwane przez executor." — brak nowej `AIAction` |
| `next lint` (zmienione pliki) | ✅ Zero błędów/ostrzeżeń dla `tts.ts` i `AICommandSheet.tsx` (pozostałe ostrzeżenia to istniejące, w innych plikach) |
| `npx tsc --noEmit` (całość) | ✅ exit 0 |
| `npx next build` (atrapa DB, bez `migrate.js` — C-13) | ✅ exit 0, kompilacja i typecheck całej aplikacji przechodzą |

> Uwaga: brak migracji i mutacji danych → lokalny Postgres nie był potrzebny do weryfikacji; prod DB nie tknięty (C-13).

## Kryteria akceptacji
- **AC-1** (ikona przy poście Asystenta z treścią) — ✅ `SpeakButton` renderowany w bąbelkach
  `answer` (`AICommandSheet.tsx` rząd akcji obok `CopyButton`), `report`, oraz `navigate`/`plan`/`clarify`
  (gdy `turn.content` niepuste). Dowód: wpięcia `{onToggleSpeak && <SpeakButton …/>}` w każdym z tych kindów.
- **AC-2** (klik → mowa + stan aktywny) — ✅ `toggleSpeak(id,text)` woła `speak(speechTextFromMarkdown(text),"pl",{onEnd})`
  i `setSpeakingId(id)`; `SpeakButton` przy `speaking===true` pokazuje `Square` + `var(--accent-blue)` i „Zatrzymaj".
- **AC-3** (drugi klik tego samego posta → stop) — ✅ gałąź `if (speakingId === id) { stopSpeaking(); setSpeakingId(null); }`.
- **AC-4** (klik na innym poście przerywa poprzedni) — ✅ przed `speak` zawsze `stopSpeaking()`; `speechSynthesis.cancel()`
  przerywa poprzednią wypowiedź → nigdy dwa głosy naraz.
- **AC-5** (brak treści / brak wsparcia → brak/nieaktywna ikona, bez błędu) — ✅ `SpeakButton` zwraca `null`
  gdy `!ttsSupported()` (lazy init, bez SSR-mismatch); `navigate/plan/clarify` renderują przycisk tylko przy niepustej treści;
  `toggleSpeak` przerywa gdy `speechTextFromMarkdown` daje pusty tekst; bąbel `results` bez przycisku.
- **AC-6** (auto-reset po naturalnym końcu) — ✅ `speak(..., { onEnd: () => setSpeakingId(cur => cur===id ? null : cur) })`,
  a `tts.speak` wpina `onEnd` w `u.onend` **i** `u.onerror`.
- **AC-7** (tylko posty Asystenta) — ✅ gałąź `turn.role === "user"` zwraca goły bąbel bez `SpeakButton`;
  `results` (statusy akcji) świadomie pominięte.

## Zgodność z konstytucją
- **C-01/C-02** ✅ zmiany tylko w `worldofmag/src/`, import przez `@/lib/tts`.
- **C-12** ✅ dodany typ `SpeakOptions` to zwykły typ TS; brak enumów, brak schematu.
- **C-30** ✅ kolory z tokenów (`--text-muted`/`--accent-blue`), zero hardcoded hexów.
- **C-31** ✅ przycisk spójny z `CopyButton` (dotyk), brak zmian layoutu mobile/sidebarów.
- **C-32** ✅ etykiety/`aria-label` po polsku („Odczytaj na głos"/„Zatrzymaj odczyt").
- **C-53** ✅ minimalizm: 2 pliki, reużycie `CopyButton`/`@/lib/tts`, zero nowych zależności.
- **C-10..C-14, C-20..C-25, C-40/C-41** — nie dotyczą (brak migracji/akcji/RBAC/AIAction/kluczy).

## Regresje
- **`@/lib/tts` używany w module Languages** — ✅ sygnatura `speak(text, lang)` zachowana (nowy 3. arg opcjonalny);
  `tsc`/`next build` całości przechodzą, więc istniejące wywołania nie zepsute.
- **`AICommandSheet` — pozostałe funkcje** — ✅ dodano tylko stan + propsy + przyciski; ścieżki wysyłki/planów/historii
  bez zmian logiki; build zielony.
- **Brak zmian w `revalidatePath`/RBAC/migracjach** → brak wpływu na inne moduły.

## Werdykt końcowy
✅ **GOTOWE** — wszystkie 7 kryteriów akceptacji spełnione, bramki zielone, brak regresji.
