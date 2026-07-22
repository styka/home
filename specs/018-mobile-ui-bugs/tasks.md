# Zadania: Poprawki UI na mobile — zadania + asystent AI

- **Plan:** ./plan.md (018-mobile-ui-bugs)
- **Status:** done
- **Data:** 2026-07-22

> **Zasada listy zadań:** cztery niezależne, drobne naprawy klienckie/CSS (brak migracji, akcji, AI).
> Każde zadanie ≈ jeden spójny commit, samodzielne i weryfikowalne. Kolejność od najprostszego.

## Legenda
- `[ ]` do zrobienia · `[x]` zrobione · `[~]` w trakcie · `[!]` zablokowane
- `[P]` — niezależne od poprzedniego, można robić równolegle

## Faza 0 — Fundament danych
- (brak) — feature nie rusza schematu ani migracji (plan §2). `npm run check:migrations` musi
  pozostać zielony (żadnego nowego katalogu migracji).

## Faza 1 — Warstwa serwera / RBAC
- (brak) — brak Server Actions, RBAC, AIAction (plan §3–§4, §6). `npm run check:actions` zielony.

## Faza 2 — UI (cztery naprawy, niezależne pliki → wszystkie `[P]` względem siebie)
- [x] **T-1** `[P]` — **Pasek akcji masowych przewijalny na mobile (AC-1).**
  Plik: `worldofmag/src/components/tasks/BulkActionBar.tsx`. W głównym rzędzie akcji (`flex items-center
  gap-1 p-2`, ~linia 186) dodać `overflow-x-auto [&>*]:flex-shrink-0` (wzorzec z `TasksPage.tsx:494`).
  Bez zmian kolorów/tekstów.
  *Gotowe, gdy:* na wąskim viewport wszystkie akcje (Status…Usuń + „X") są osiągalne przez przewinięcie
  poziome; desktop (`md:w-auto`) bez zmian.

- [x] **T-2** `[P]` — **Globalny anty-zoom pól na iOS (AC-2).**
  Plik: `worldofmag/src/app/globals.css`, reguła `@media (pointer: coarse)` (~linie 129–135). Dodać
  `!important` do `font-size: 16px`, aby wygrywała z inline `fontSize < 16` (kompozytor asystenta 15px,
  `SmartTextarea` 14px, inne pola). Zaktualizować komentarz PL: dlaczego `!important` (inline bije
  arkusz). NIE dodawać `maximum-scale`/`user-scalable` (pinch-zoom zostaje).
  *Gotowe, gdy:* na `pointer: coarse` efektywny `font-size` input/textarea/select = 16px (w tym
  kompozytor asystenta) → brak zoomu przy focusie; desktop bez zmian.

- [x] **T-3** `[P]` — **Widoczne sortowanie sekcji „Zrobione" (AC-3).**
  Plik: `worldofmag/src/components/tasks/CompletedSection.tsx`. Na `<TaskGroup>` przekazać
  `defaultOpen={sortBy === "completedAt"}` oraz `key={sortBy}` (remount przy przełączeniu sortu →
  włączenie sortu rozwija sekcję z posortowaną listą; wyłączenie wraca do zwiniętej domyślnej). Bez
  zmian logiki sortu i stanu aktywnego przycisku (już `accent-blue`).
  *Gotowe, gdy:* przy filtrze „Wszystkie" klik ikony „Sortuj zrobione po dacie wykonania" rozwija
  sekcję i pokazuje zmienioną kolejność; ponowny klik zwija/wyłącza.

- [x] **T-4** `[P]` — **Kompozytor asystenta nad kreską iOS (AC-4).**
  Plik: `worldofmag/src/components/home/AICommandSheet.tsx`, stopka kompozytora (`<div className="px-4
  py-3 flex-shrink-0" …>`, ~linia 1423). Dodać inline
  `paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))"` (nadpisuje dolny `py-3`).
  *Gotowe, gdy:* na viewport z `safe-area-inset-bottom > 0` całe pole kompozytora jest nad home
  indicatorem; desktop (inset=0) bez zmian.

## Faza 3 — AI / integracje
- (brak) — plan §6: nie dotyczy.

## Faza 4 — Bramki i domknięcie
- [x] **T-5** — **Bramki jakości (C-50).** Z `worldofmag/`: `npm run check:migrations`,
  `npm run check:actions`, `next lint`, `next build` (lokalny Postgres — C-13, **nie** prod DB; nie
  odpalać `scripts/migrate.js`). *Gotowe, gdy:* wszystkie zielone do `next build`.
- [x] **T-6** — **Mapowanie AC → wynik** (input do `/verify`): AC-1→T-1, AC-2→T-2, AC-3→T-3,
  AC-4→T-4, AC-5 (brak regresji desktop) → weryfikacja przy T-1/T-2. Żaden AC bez pokrycia.
- [x] **T-7** — **Wpis do `doświadczenia.md`** (C-51): lekcja o inline `font-size` bijącym regułę
  anty-zoom (potrzebny `!important` na coarse) oraz o zwiniętej grupie maskującej działający sort.

## Mapowanie kryteriów akceptacji
| AC | Zadanie |
|----|---------|
| AC-1 (pasek akcji widoczny na mobile) | T-1 |
| AC-2 (brak auto-zoomu na polach, w tym asystent) | T-2 |
| AC-3 (widoczne sortowanie zrobionych + stan przycisku) | T-3 |
| AC-4 (kompozytor nad kreską iOS) | T-4 |
| AC-5 (brak regresji na desktopie) | T-1, T-2 (weryfikacja w T-5/T-6) |

## Notatki / blokady
- Brak. T-1..T-4 dotykają rozłącznych plików → można wykonać w dowolnej kolejności; T-5 po nich.
