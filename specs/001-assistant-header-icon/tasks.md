# Zadania: Ikona akcji w nagłówku okna asystenta AI

- **Plan:** ./plan.md (001-assistant-header-icon)
- **Status:** todo
- **Data:** 2026-07-18

> Kolejność wg zależności. Feature jest jednoplikowy i czysto UI — faz danych/serwera/AI **brak**
> (patrz plan §2–§6: „nie dotyczy"). `[x]` odhaczane w `/implement`.

## Legenda
- `[ ]` do zrobienia · `[x]` zrobione · `[~]` w trakcie · `[!]` zablokowane
- `[P]` — niezależne, można zrównoleglić

## Faza 0–3 — Fundament danych / serwer / RBAC / AI
- **Nie dotyczy.** Brak migracji (plan §2), brak Server Actions/RBAC (plan §3–§4), brak `AIAction`
  (plan §6). `check:migrations` i `check:actions` przechodzą trywialnie (brak nowych artefaktów).

## Faza UI
- [x] **T-1** — W `worldofmag/src/components/home/AICommandSheet.tsx`, w sekcji `{/* Header */}`
  (rząd akcji po prawej), dodać przycisk-ikonę `Settings` z `onClick={() => setShowPrefs((v) => !v)}`,
  umieszczony **przed** przyciskiem „Historia rozmów", żeby „Zamknij" (`X`) został skrajnie z prawej.
  Reużyć stylu `iconBtn`; kolor: `var(--accent-blue)` gdy `showPrefs || prefs.trim()`, inaczej
  domyślny `var(--text-muted)` z `iconBtn`. Dodać `title`/`aria-label="Ustawienia asystenta"` (PL) i
  `aria-expanded={showPrefs}`. **Gotowe, gdy:** w rzędzie akcji nagłówka są 4 przyciski (ustawienia /
  historia / nowa rozmowa* / zamknij), a nowa ikona przełącza panel `{showPrefs && (…)}`.
  *(kolejność przycisków nowa-rozmowa/historia zostaje jak w kodzie; dokładamy tylko `Settings`.)*

## Faza — Bramki i domknięcie
- [x] **T-2** — `npx next build` (z dummy/lokalnym `DATABASE_URL`, **nie** `npm run build` przeciw
  prod — C-13/C-50) przeszedł: `tsc --noEmit` exit 0, `next lint` exit 0 (tylko znane ~64 kosmetyczne
  ostrzeżenia, żadne z edytowanych linii), `next build` exit 0 (wszystkie trasy skompilowane).
- [x] **T-3** — Mapowanie AC → wynik (input do `/verify`): AC-1 (4 przyciski), AC-2 (klik toggluje
  panel), AC-3 (PL a11y + kolory ze zmiennych), AC-4 (mobile bez rozjazdu). Szczegóły w `verify.md`.
- [x] **T-4** — Brak nieoczywistego problemu (trywialna, jednolinijkowa zmiana UI) → wpisu do
  `doświadczenia.md` nie dodajemy (zgodnie z regułą C-51: dopisujemy tylko przy realnym bugu/lekcji).

## Mapowanie kryteriów akceptacji
| AC | Zadanie | Jak weryfikujemy |
|----|---------|------------------|
| AC-1 — dodatkowa ikona w rzędzie akcji | T-1 | inspekcja: 4 przyciski w nagłówku |
| AC-2 — klik otwiera/zamyka panel ustawień | T-1 | `setShowPrefs((v)=>!v)` wpięty; panel istnieje |
| AC-3 — PL a11y + kolory ze zmiennych CSS | T-1 | `title`/`aria-label` PL; `var(--…)`, brak hex |
| AC-4 — mobile nie łamie układu | T-1, T-2 | rząd flex, 4× 16px; build + przegląd responsywny |

## Ścieżka krytyczna
`T-1` (jedyna zmiana kodu) → `T-2` (build) → `T-3` (mapowanie AC) → `T-4` (opcjonalny wpis lekcji).
Brak zadań równoległych — całość to jeden spójny commit z T-1.

## Notatki / blokady
- Brak.
