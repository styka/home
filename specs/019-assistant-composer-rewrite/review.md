# Recenzja: Przepisanie kompozytora asystenta AI (układ jak „Chat with Claude")

- **Spec:** ./spec.md · **Plan:** ./plan.md · **Verify:** ./verify.md (019-assistant-composer-rewrite)
- **Data:** 2026-07-22 · **Recenzent:** Claude Code (etap /review)

## Zakres
Diff względem `origin/develop`: 1 plik kodu `AICommandSheet.tsx` (**+61/−80**, netto −19) + artefakty
speca + wpis do `doświadczenia.md`. Zmiana czysto kliencka (układ kompozytora + przeniesienie ikony
ustawień); brak schematu, migracji, Server Actions, RBAC, `AIAction`.

## Ustalenia
**Brak ustaleń** (correctness / convention / simplification / security) wymagających zmiany.

Przegląd:
- **Poprawność:** te same handlery (`handleSend`/`stopGeneration`/`sendImage`/`onPickImage`/
  `dictation`/`toggleVoice`), ta sama logika głównego przycisku (Stop/Wyślij/Głos), `onFocus/onBlur`
  zachowane (sterują warunkowym insetem stopki). Dwa ukryte inputy (`fileRef` galeria, `cameraRef`
  `capture`) → ten sam `onPickImage`. Auto-rozrost bez zmian. Bez wyścigów/braków `await`.
- **Martwy kod / import:** `Send` usunięty z importu (potwierdzony brak innych użyć); `Plus` nadal
  używany (nagłówek + drawer historii); `rowBtn` nadal używany (drawer). `showPlus`/menu „+" w pełni
  usunięte — brak dangling referencji.
- **Konwencje:** C-30 — kolory/tło/promień z tokenów (`--bg-elevated`, `--border`, `--radius-lg`,
  `--accent-*`, `--on-accent`, `--text-muted`); zero hardcodu. C-32 — teksty/aria po polsku. C-01 —
  praca w `worldofmag/`. Brak enumów/migracji (n/d).
- **Minimalizm (C-53):** netto mniej kodu; 2 ikony z już używanego `lucide-react` (bez nowych
  zależności); wydzielone `composerActionBtn`/`composerPrimaryBtn` (spójne z istniejącym `iconBtn`).
- **Bezpieczeństwo:** brak renderu markdown/HTML/kluczy → brak powierzchni ataku w tym diffie.

Uwagi informacyjne (nie-defekty, bez zmian):
- `<textarea maxHeight:160>` vs limit auto-rozrostu `140` w `useEffect` — efektywny sufit 140px; CSS
  to nieszkodliwa rezerwa (zgodne z AC-2).
- `capture="environment"` na desktopie jest ignorowane → „Zrób zdjęcie" otwiera zwykły picker (jak
  galeria). Akceptowalne (desktop używa galerii).

## Werdykt
**APPROVE Z UWAGAMI.** Kod poprawny, zgodny z konwencjami Omnia i minimalny; wszystkie bramki zielone;
AC-2..AC-9 spełnione z dowodem w kodzie. **Uwaga:** AC-1/AC-8 (zachowanie karetki na iOS) spełnione
**strukturalnie**, ale ich runtime na urządzeniu **nie był weryfikowany w sandboxie** — wymaga testu
właściciela na `develop`. Ważne: produkcja już dziś zawiera błąd karetki (z wcześniejszych wdrożeń tej
sesji), więc ta zmiana jest **poprawą lub neutralna** wobec karetki, a przy okazji usuwa regresję
szarpanego przewijania (cofnięty VisualViewport) — promocja nie wprowadza regresji. Domknięcie: merge
do `develop` + automatyczna promocja `develop → master` (C-52).
