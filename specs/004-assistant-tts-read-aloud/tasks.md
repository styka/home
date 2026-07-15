# Zadania: Odczytywanie postów Asystenta na głos

- **Plan:** ./plan.md (004-assistant-tts-read-aloud)
- **Status:** todo
- **Data:** 2026-07-15

> Feature czysto frontendowy: brak migracji, schematu, Server Actions, RBAC i `AIAction`.
> Fazy 0/1/3 z szablonu **nie dotyczą** — zostają puste (odnotowane), praca skupia się w warstwie
> `lib` + UI + bramki.

## Legenda
- `[ ]` do zrobienia · `[x]` zrobione · `[~]` w trakcie · `[!]` zablokowane
- `[P]` — niezależne, można zrównoleglić

## Faza 0 — Fundament danych
- [ ] **T-0** — Nie dotyczy: brak zmian schematu/migracji (plan §2). `npm run check:migrations` pozostaje zielone (brak nowej migracji).

## Faza 1 — Warstwa serwera / RBAC
- [ ] **T-0b** — Nie dotyczy: brak Server Actions i zmian RBAC (plan §3/§4).

## Faza 2 — Warstwa lib (helper TTS)
- [x] **T-1** — `src/lib/tts.ts`: rozszerzyć `speak(text, lang?, opts?)` o opcjonalny `{ onEnd?: () => void }`
  wpięty w `u.onend`/`u.onerror`; zachować wsteczną kompatybilność sygnatury (Languages woła `speak(text, lang)`).
  *Gotowe, gdy:* `speak("x","pl",{onEnd})` odpala callback po zakończeniu, a istniejące wywołania kompilują się bez zmian.
- [x] **T-2** — `src/lib/tts.ts`: dodać `stopSpeaking()` (guard `ttsSupported()` → `window.speechSynthesis.cancel()`).
  *Gotowe, gdy:* funkcja eksportowana, bezpieczna w środowisku bez syntezy.
- [x] **T-3** `[P]` — `src/lib/tts.ts`: dodać `speechTextFromMarkdown(md): string` zdejmujący znaczniki
  markdown (`#`, `*`, `` ` ``, `[t](u)`→`t`, `![...]()` usuń, `|`, `>`, `---`), zwracający czytelny tekst mowy.
  *Gotowe, gdy:* przykładowy markdown (nagłówek + link + lista) zwraca tekst bez symboli.

## Faza 3 — UI (AICommandSheet)
- [x] **T-4** — `AICommandSheet.tsx`: lokalny komponent `SpeakButton({ text, speaking, onToggle })` wg
  wzorca `CopyButton` — ikona `Volume2` (idle) ↔ `Square` (odczyt), kolory z tokenów CSS
  (`--text-muted`/`--accent-blue`), `title`/`aria-label` PL („Odczytaj na głos"/„Zatrzymaj odczyt"),
  brak renderu gdy `!ttsSupported()` (lazy init stanu, bez SSR-mismatch). *(pokrywa AC-1, AC-5)*
- [x] **T-5** — `AICommandSheet.tsx`: stan `speakingId` + `toggleSpeak(id, text)` w body sheeta —
  ten sam id → `stopSpeaking()`+reset (AC-3); inny → `stopSpeaking()` przed `speak(speechTextFromMarkdown(text),"pl",{onEnd:reset})` (AC-2, AC-4, AC-6).
  Przekazać `speakingId`/`onToggleSpeak` do `ChatTurn` (jak `onRegenerate`).
- [x] **T-6** — `AICommandSheet.tsx`: wpiąć `SpeakButton` w bąbelki Asystenta — `answer` i `report`
  (rząd akcji obok `CopyButton`), `navigate`/`plan`/`clarify` (przy treści `turn.content`); pominąć
  `results` i posty użytkownika. *(pokrywa AC-1, AC-7; AC-5 dla `results`)*
- [x] **T-7** `[P]` — `AICommandSheet.tsx`: sprzątanie odczytu — `useEffect` stopuje mowę przy zamknięciu
  arkusza (`open===false`), zmianie konwersacji i unmount (`stopSpeaking()`+`setSpeakingId(null)`). *(ryzyko §9)*

## Faza 4 — Bramki i domknięcie
- [x] **T-8** — `next lint` czysty dla zmienionych plików + `npx tsc --noEmit` (exit 0) + `npx next build`
  (exit 0, bez `migrate.js` — C-13). Zielone.
- [x] **T-9** — Mapowanie AC → wynik gotowe (patrz plan §8; wejście do `/verify`).
- [x] **T-10** — Brak nieoczywistego problemu po drodze (build/typecheck od razu zielone) → wpis do
  `doświadczenia.md` niepotrzebny (C-51 dotyczy naprawionych bugów).

## Mapowanie AC → zadania
| AC | Zadania |
|----|---------|
| AC-1 (ikona przy poście) | T-4, T-6 |
| AC-2 (klik → mowa) | T-1, T-5 |
| AC-3 (drugi klik → stop) | T-2, T-5 |
| AC-4 (przełączenie między postami) | T-2, T-5 |
| AC-5 (brak treści/wsparcia → brak/nieaktywna) | T-3, T-4, T-6 |
| AC-6 (auto-reset po końcu) | T-1, T-5 |
| AC-7 (tylko posty Asystenta) | T-6 |

## Ścieżka krytyczna
T-1 → T-2 (helpery TTS) → T-5 (logika toggle korzysta z obu) → T-6 (wpięcie w bąbelki) → T-8 (build).
T-3, T-4, T-7 są względnie niezależne (`[P]`), ale T-5/T-6 z nich korzystają, więc muszą być gotowe przed T-8.

## Notatki / blokady
- Brak. Faza 0/1/3 świadomie puste — feature nie dotyka danych/serwera/AI.
