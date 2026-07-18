# Plan techniczny: Ikona akcji w nagłówku okna asystenta AI

- **Spec:** ./spec.md (001-assistant-header-icon)
- **Status:** draft
- **Data:** 2026-07-18

> **Zasada planu:** to jest **JAK**. Zmiana czysto UI w jednym istniejącym komponencie.

## 1. Podejście (2–4 zdania)
Zmiana dotyczy wyłącznie komponentu okna asystenta AI `src/components/home/AICommandSheet.tsx`.
W istniejącym rzędzie akcji nagłówka (obecnie: „Nowa rozmowa" `Plus`, „Historia rozmów" `History`,
„Zamknij" `X`) dodajemy jeden przycisk-ikonę **`Settings`** (gear), który przełącza istniejący stan
`showPrefs` — ten sam panel „Ustawienia asystenta", który dziś jest dostępny wyłącznie z menu „+" przy
polu tekstowym. Wzorzec do naśladowania jest **w tym samym pliku**: istniejące przyciski `iconBtn`
w nagłówku oraz istniejące wpięcie `setShowPrefs((v) => !v)` w menu „+" (linia ~1343). Zero nowej
logiki, zero nowych zależności (ikona `Settings` z `lucide-react` jest już zaimportowana).

## 2. Model danych (Prisma)
**Bez zmian w schemacie.** Brak nowych modeli/kolumn, brak migracji (C-10..C-12 nie dotyczą tej zmiany).

## 3. Warstwa serwera (Server Actions — C-20)
**Nie dotyczy.** Brak mutacji danych, brak nowych/edytowanych Server Actions, brak `revalidatePath`,
brak guardów dostępu (`showPrefs` to lokalny stan `useState` klienta).

## 4. RBAC / rejestr modułu (C-22)
**Bez zmian.** Okno asystenta jest już dostępne w `AppShell`; żadnego nowego slug'a, żadnych wpięć
w `permissions.ts` / `modules.tsx` / `ModuleSidebar`.

## 5. UI (C-30, C-31, C-32)
- Plik: `src/components/home/AICommandSheet.tsx`, sekcja `{/* Header */}` (rząd akcji po prawej,
  `<div style={{ display: "flex", alignItems: "center", gap: 4 }}>` ~linia 1120).
- Dodajemy nowy `<button>` **przed** przyciskiem „Historia rozmów" (żeby „Zamknij" `X` został skrajnie
  z prawej — konwencjonalnie zamknięcie jest ostatnie), reużywając stylu `iconBtn`:
  ```tsx
  <button onClick={() => setShowPrefs((v) => !v)} title="Ustawienia asystenta"
          aria-label="Ustawienia asystenta" aria-expanded={showPrefs}
          style={{ ...iconBtn, color: showPrefs || prefs.trim() ? "var(--accent-blue)" : "var(--text-muted)" }}>
    <Settings size={16} />
  </button>
  ```
- **Motyw (C-30):** kolor ikony wyłącznie ze zmiennych CSS (`var(--accent-blue)` gdy panel otwarty
  lub są ustawione stałe preferencje, inaczej `var(--text-muted)` z `iconBtn`). Zero hexów.
- **Mobile (C-31):** rząd akcji jest już `display:flex; gap:4`; czwarty przycisk 16px mieści się
  w nagłówku także na `md:hidden`. Bez zmian w układzie mobilnym poza dodaną ikoną.
- **Teksty (C-32):** `title` i `aria-label` po polsku („Ustawienia asystenta").
- Spójność wizualna: ta sama ikona `Settings` i ta sama logika kolorowania co pozycja „Ustawienia
  asystenta" w menu „+" (linia ~1344), więc oba wejścia wyglądają jednakowo.

## 6. AI / integracje (jeśli dotyczy — C-23, C-40)
**Nie dotyczy.** Brak nowej `AIAction`, brak read-toola, brak wpięć kalendarz/powiadomienia. To tylko
element chrome okna asystenta.

## 7. Pliki do utworzenia / zmiany
| Plik | Akcja | Po co |
|------|-------|-------|
| `worldofmag/src/components/home/AICommandSheet.tsx` | edycja | Dodanie przycisku-ikony „Ustawienia asystenta" (`Settings`) do rzędu akcji w nagłówku; reużycie `showPrefs`/`setShowPrefs`. |
| `specs/001-assistant-header-icon/verify.md` | nowy (etap /verify) | Raport weryfikacji AC. |
| `specs/001-assistant-header-icon/review.md` | nowy (etap /review) | Recenzja + werdykt. |

## 8. Bramki i weryfikacja (C-50)
- Brak migracji i Server Actions → weryfikacja lokalna to **`npm run build` do kroku `next build`**
  (nie odpalać `migrate.js` przeciw prod DB — C-13). `check:migrations`/`check:actions` przejdą
  trywialnie (brak nowych migracji i `AIAction`). Uwaga: pełny `npm run build` woła `migrate.js`
  na końcu — do weryfikacji użyjemy `npx next build` (lub build z bezpiecznym/lokalnym `DATABASE_URL`),
  a nie `npm run build` przeciw produkcji.
- Mapowanie AC → weryfikacja:
  - **AC-1** (dodatkowa ikona w rzędzie akcji) → inspekcja nagłówka: 4 przyciski zamiast 3.
  - **AC-2** (klik otwiera/zamyka panel ustawień) → `onClick` wpięty w `setShowPrefs((v)=>!v)`,
    panel `{showPrefs && (…)}` istnieje.
  - **AC-3** (PL a11y + kolory ze zmiennych) → `title`/`aria-label` PL, kolory `var(--…)`.
  - **AC-4** (mobile nie łamie układu) → rząd flex, 4× 16px ikony; sprawdzenie wizualne/responsywne.

## 9. Ryzyka techniczne i plan wycofania
- Ryzyko: duplikacja wejścia do ustawień (nagłówek + menu „+") — świadome, to skrót; menu „+" bez zmian.
- Ryzyko: zatłoczenie nagłówka na wąskim ekranie — minimalne (małe ikony). Mitygacja: kolejność
  „ustawienia → historia → zamknij", zamknięcie skrajnie z prawej.
- Rollback: to jednoplikowa zmiana kodu — rewert commita (brak migracji, brak stanu DB).

## 10. Zgodność z konstytucją — checklista
- [x] C-10..C-14 (migracje) — **nie dotyczy** (brak zmian schematu), świadomie odnotowane.
- [x] C-20..C-25 (server/RBAC/AI/trash/audit) — **nie dotyczy** (czysto UI, brak mutacji).
- [x] C-30..C-32 (UX) — kolory ze zmiennych CSS, mobile bez rozjazdu, teksty PL.
- [x] C-53 (minimalizm) — jeden `<button>`, reużycie istniejącego stanu i ikony; zero nowych zależności.
