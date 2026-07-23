# Recenzja: Log diagnostyki AI w zgłoszeniu błędu z czatu asystenta

- **Spec:** ./spec.md · **Plan:** ./plan.md · **Verify:** ./verify.md
- **Data:** 2026-07-23
- **Diff:** 3 pliki, +68/−34 (`aiCallLog.ts` nowy, `AiCallsPage.tsx`, `AICommandSheet.tsx`)

## Ustalenia
Brak ustaleń blokujących ani uwag wymagających poprawki. Przegląd priorytetowy:

- **Poprawność** — ✅. `submitProblemReport` pobiera log tylko gdy jest `conversationId`, w try/catch
  (`aiCallsError`), a `createTask` idzie niezależnie — brak ścieżki, w której zgłoszenie pada z powodu
  logu (AC-3). `await` obecny przy `getRecentAiCalls`. Trzy gałęzie adnotacji rozłączne i wyczerpujące.
- **Uprawnienia (C-21/C-22)** — ✅. `getRecentAiCalls` wymusza `requireAdmin()`; panel zgłoszenia jest
  admin-only. Wołanie server action z komponentu klienta to ten sam wzorzec, co istniejący
  `AiCallsPage.tsx`.
- **`revalidatePath` (C-20)** — ✅ nie dotyczy: nowy kod tylko **czyta** (`getRecentAiCalls`); jedyna
  mutacja (`createTask`) była już wcześniej i ma własną inwalidację.
- **Konwencje (C-12/C-30/C-32/C-01)** — ✅. Brak enumów, brak hardcoded hexów (zmiana w treści opisu
  zadania), teksty PL, praca w `worldofmag/`.
- **Reuse / minimalizm (C-53)** — ✅. Format logu wyniesiony do jednego `aiCallsToText` używanego przez
  panel i zgłoszenie — eliminuje ryzyko rozjazdu (AC-2); zero duplikacji, zero nowych zależności.
  Alias `fmtAiCallTime as fmtTime` zachowuje istniejące referencje w panelu bez zbędnych zmian.
- **Bezpieczeństwo (C-41)** — ✅. Brak logowania kluczy; `errorText` z `AiCall` jest już przycinany do
  500 znaków przy zapisie; całość logu dodatkowo `trunc(...,8000)`. Treść trafia do opisu zadania
  (markdown w bloku kodu) — bez nowej powierzchni XSS.
- **Typy / build** — ✅. `type AiCallLogRow` z pliku `"use server"` to import wyłącznie typu (usuwany na
  etapie kompilacji) — zgodny z regułą „use server", potwierdzony zielonym `next build`.

## Werdykt
**APPROVE.** Zmiana minimalna, poprawna, zgodna z konwencjami; wszystkie AC pokryte, bramki zielone.
