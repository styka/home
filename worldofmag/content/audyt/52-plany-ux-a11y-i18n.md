# Dodatek A.6 — Plany wdrożenia: UX, a11y, i18n

Plany realizujące zalecenia z Rozdz. 11.

---

## Plan Z-111 (P0) — Globalny `error.tsx` + `ErrorBoundary`

**Cel:** sensowny stan błędu zamiast białego ekranu.
**Kroki:** dodać `src/app/error.tsx` (route-level) + `global-error.tsx`; komponent `ErrorState`
(ikona/komunikat/„spróbuj ponownie”/zgłoś); spiąć z Sentry (plan Z-090). Rozważyć `error.tsx` per
cięższy moduł.
**Pliki:** `src/app/error.tsx`, `src/app/global-error.tsx`, `src/components/ui/ErrorState.tsx`.
**Kryteria:** wyjątek w komponencie pokazuje stan błędu, nie wywala całej strony; zdarzenie w Sentry.

---

## Plan Z-110 (P1) — Brakujące prymitywy UI

**Cel:** wyeliminować powielanie i rozjazdy.
**Kroki:** dodać do `src/components/ui/`: `Modal/Dialog`, `Tabs`, `Tooltip`, opakowania
`Input/Select/Textarea`, `Pagination` (na Radix, który jest już w zależnościach); migrować najczęstsze
miejsca przyrostowo.
**Kryteria:** nowe ekrany używają prymitywów; spada liczba ad-hoc modali/tabów.

---

## Plan Z-112 / Z-113 (P1) — Tokeny odstępów/typografii + jeden `EmptyState`

**Cel:** spójna gęstość i mniej inline-styli.
**Kroki:** dodać skalę spacing/rozmiarów (tokeny CSS/obiekty w `ui/home/styles.ts`); ujednolicić
`EmptyState` do jednej implementacji; migrować najczęstsze wzorce.
**Kryteria:** jeden `EmptyState`; nowe UI używa tokenów odstępów.

---

## Plan Z-114 (P1) — Audyt i poprawki a11y

**Cel:** dostępność (WCAG/EAA) i brak barier.
**Kroki:** `alt` dla wszystkich `<img>`; nie sygnalizować statusu samym kolorem (ikona/tekst);
`role`/`aria` w prymitywach; pułapka focusu + obsługa klawiatury w `Modal`; helper `sr-only`; przegląd
kontrastu. Wykonalne offline.
**Kryteria:** obrazy mają `alt`; modale obsługiwane klawiaturą; statusy nie tylko kolorem.

---

## Plan Z-115 (P1) — Warstwa i18n + formaty `Intl`

**Cel:** umożliwić wielojęzyczność i poprawne formaty.
**Kroki:** wprowadzić lekką warstwę słownika (np. własny `t()` lub `next-intl`); **od zaraz owijać nowe
teksty** (PL jako domyślny); formaty dat/liczb/waluty przez `Intl.*` (zastąpić ręczny `formatMoney`).
Pełne tłumaczenia, gdy pojawi się rynek nie-PL.
**Kryteria:** nowe teksty przez warstwę; waluty/daty przez `Intl`.
**Ryzyka:** duży zakres — robić przyrostowo, nie „big bang”.

---

## Pozostałe (skrót)

- **Z-116 (P2)** — responsywna typografia/odstępy + cele dotykowe ≥44 px.
- **Z-117 (P2)** — rozbudować skórki (gotowe motywy, jasny/sepia/system) jako atut.
- **Z-118 (P2)** — reguła „prymityw przed inline” w przeglądach.

**Kolejność:** Z-111 → Z-110 → Z-114 → Z-112/Z-113 → Z-115 → reszta.
