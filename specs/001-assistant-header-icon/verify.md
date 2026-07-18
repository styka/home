# Weryfikacja: Ikona akcji w nagłówku okna asystenta AI

- **Spec/Plan:** ./spec.md, ./plan.md (001-assistant-header-icon)
- **Data:** 2026-07-18
- **Weryfikował:** Claude Code (etap /verify)

## Bramki techniczne
| Komenda | Wynik |
|---------|-------|
| `npm run check:migrations` | ✅ OK (następny wolny numer 0206; brak nowych migracji — feature bez schematu) |
| `npm run check:actions` | ✅ OK (95 akcji, wszystkie z egzekutorem; brak nowej `AIAction`) |
| `npx tsc --noEmit` | ✅ exit 0 (pełny type-check projektu, zero błędów) |
| `npx next lint --dir src` | ✅ exit 0 (tylko znane ~64 kosmetyczne ostrzeżenia exhaustive-deps/no-img-element; żadne z edytowanej sekcji nagłówka) |
| `npx next build` | ✅ exit 0 (wszystkie trasy skompilowane, wszystkie dynamiczne `ƒ`) |

> Uwaga (C-13): build uruchomiony z **dummy** `DATABASE_URL` (nie prod), bez kroku `migrate.js`.
> Strony są dynamiczne (auth/cookies), więc build nie łączy się z bazą. Pełny `npm run build`
> (z `migrate.js`) świadomie **nie** był odpalany przeciw produkcji.

## Kryteria akceptacji
| AC | Werdykt | Dowód |
|----|---------|-------|
| **AC-1** — dodatkowa ikona w rzędzie akcji nagłówka | ✅ | `AICommandSheet.tsx:1120–1125` — rząd akcji ma teraz **4** przyciski: „Nowa rozmowa" (`Plus`), **„Ustawienia asystenta" (`Settings`, nowy, :1122)**, „Historia rozmów" (`History`), „Zamknij" (`X`). Nowa ikona sąsiaduje z historią, „Zamknij" zostaje skrajnie z prawej. |
| **AC-2** — klik otwiera/zamyka panel ustawień | ✅ | `onClick={() => setShowPrefs((v) => !v)}` (:1122) przełącza istniejący stan `showPrefs` (:262). Panel „Stałe preferencje" + głos lektora renderuje się warunkowo w `{showPrefs && (…)}` (:1128). To ten sam panel, który był dostępny z menu „+" (:1343). |
| **AC-3** — PL a11y + kolory ze zmiennych CSS | ✅ | `title="Ustawienia asystenta"`, `aria-label="Ustawienia asystenta"` (PL), `aria-expanded={showPrefs}`. Kolor wyłącznie ze zmiennych: `var(--accent-blue)` gdy `showPrefs || prefs.trim()`, inaczej `var(--text-muted)` z `iconBtn` (:1427). Zero hexów. |
| **AC-4** — mobile nie łamie układu | ✅ | Rząd akcji to `display:flex; gap:4` bez zmian; dołożono 1 ikonę 16px (łącznie 4). `next build` przeszedł (żaden warunek responsywny nie ucierpiał); nagłówek `justify-between` z `flex-shrink-0` — ikony trzymają się w rzędzie także na `md:hidden`. |

## Zgodność z konstytucją
- **C-01/C-02** ✅ — zmiana w `worldofmag/`, brak nowych ścieżek importu (reużyte symbole w tym samym pliku).
- **C-10..C-14** ✅ — nie dotyczy (brak zmian schematu/migracji), świadomie.
- **C-20..C-25** ✅ — nie dotyczy (czysto UI, brak mutacji/Server Actions/AIAction/RBAC/trash/audit).
- **C-30** ✅ — kolory ikony ze zmiennych CSS, brak `#fff`/hex.
- **C-31** ✅ — układ mobilny nienaruszony; brak drugiego sidebaru; cel dotyku jak pozostałe ikony nagłówka.
- **C-32** ✅ — teksty po polsku.
- **C-53** ✅ — minimalizm: jeden `<button>`, reużycie `showPrefs`/`prefs`/`Settings`/`iconBtn`; zero nowych zależności/abstrakcji.

## Regresje
- Brak. Zmiana jest addytywna i lokalna w rzędzie akcji nagłówka. Menu „+" (drugie wejście do
  ustawień) pozostaje nietknięte — dwa wejścia do tego samego panelu działają niezależnie.
- `check:actions` (95 akcji) i `check:migrations` bez zmian → brak wpływu na asystenta AI/migracje.
- Pełny `next build` wszystkich modułów zielony → brak regresji kompilacji w sąsiednich modułach.

## Werdykt końcowy
**GOTOWE** — wszystkie 4 kryteria akceptacji spełnione, wszystkie bramki (check:migrations,
check:actions, tsc, lint, next build) zielone, zero naruszeń konstytucji, brak regresji.
