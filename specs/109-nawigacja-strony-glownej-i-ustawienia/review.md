# Recenzja: Nawigacja Strony głównej i podział widoku Ustawień

- **Spec:** ./spec.md · **Plan:** ./plan.md · **Weryfikacja:** ./verify.md
- **Data:** 2026-08-27
- **Zakres:** `git diff origin/develop...HEAD` — 46 plików, +2600/−374. Recenzja świeżym okiem po
  weryfikacji, więc nie powtarza tego, co `verify.md` już zmierzyło.

## Ustalenia

Posortowane od najpoważniejszego. Cztery drobne poprawki naniesione od razu (oznaczone
**[naprawione]**), reszta to świadome obserwacje bez zmiany kodu.

### 1. `[naprawione]` Komentarz trasy twierdził nieprawdę o zachowaniu 404
`src/app/settings/[sekcja]/page.tsx:20,29` · **correctness (dokumentacja)**

Nagłówek pliku mówił, że walidacja segmentu i **`404`** mają po jednym miejscu, a `/settings/team`
„daje 404 — dokładnie jak przed 109". Po zmianie z `T-31` żadne z tych zdań nie jest prawdziwe:
`notFound()` zniknął, a zły adres dostaje widok ze spisem.

*Skutek, gdyby zostało:* następna osoba czytająca ten plik szuka w kodzie `notFound()`, którego tam
nie ma, albo — gorzej — dopisuje kolejną trasę pod `/settings` z `notFound()`, wpadając dokładnie
w tę samą pułapkę, którą ten przebieg już zmierzył i opisał.

*Poprawka:* nagłówek opisuje stan faktyczny i nazywa różnicę wobec stanu sprzed 109.

### 2. `[naprawione]` Uzasadnienie `switch`-a było fałszywe
`src/app/settings/[sekcja]/page.tsx:58-64` · **correctness (dokumentacja)**

Komentarz twierdził, że `switch` zamiast mapy `id → komponent` chroni przed wciągnięciem
dziesięciu komponentów do grafu. **To nieprawda w tym pliku** — wszystkie dziesięć jest
importowanych statycznie w linijkach 5–15, więc `switch` nie oszczędza ani jednego modułu.

*Skutek, gdyby zostało:* argument brzmi wiarygodnie (odwołuje się do prawdziwej lekcji z 050),
więc zostałby powielony tam, gdzie naprawdę nie działa.

*Poprawka:* komentarz mówi, co jest faktem — to komponenty **serwerowe**, więc do przeglądarki i tak
trafia tylko wybrana sekcja — i wskazuje właściwe narzędzie (`dynamic()` na komponencie), gdyby
kiedyś ciążyły.

### 3. `[naprawione]` Nieaktualny opis rzędu ikon konta w panelu bocznym
`src/components/shell/ModuleSidebar.tsx` · **convention**

Blok komentarza z 085/086 stał nad wierszem Strony głównej (a opisywał rząd ikon **poniżej**) i
mówił o „czterech ikonach: dzwonek, zapis widoku, ściągawka skrótów, tryb administratora". Po 087
dzwonek i przełącznik admina są w wierszu nazwy aplikacji, a po 109 z rzędu wyszła też ikona domu —
zostały **dwie**. Komentarz opisujący układ sprzed dwóch przebiegów jest w powłoce szczególnie
kosztowny, bo to jedyne miejsce, gdzie ta historia jest zapisana.

*Poprawka:* blok przeniesiony nad rząd, który opisuje, i zaktualizowany; nagłówek „Moduły" wrócił
nad `<nav>`, gdzie ma sens.

### 4. `[naprawione]` Punkt orientacyjny listy nazywał pole szukania
`src/components/settings/SpisUstawien.tsx` · **convention (a11y)**

`<nav aria-label={t("etykietaSzukania")}>` — czytnik ekranu zapowiadał listę sekcji jako „Szukaj
ustawienia". Landmark ma nazywać **zbiór**, nie kontrolkę nad nim.

*Poprawka:* nowy klucz `etykietaListy` („Sekcje ustawień"). Przy okazji lista w wariancie bocznym
dostała `width: 100%` — bez tego dziecko kontenera `flex` sizowało się do treści.

### 5. Angielskie „member/members" w sekcji Zespoły
`src/components/settings/sekcje/Zespoly.tsx:66` · **convention (C-32)** · *bez zmiany*

Licznik członków renderuje `1 member` / `3 members` w polskim interfejsie. **To dług sprzed 109** —
tekst przeniesiony 1:1 z dawnej strony (bramka `check:i18n` go nie łapie, bo nie ma diakrytyków).

*Dlaczego bez zmiany:* poprawka wymaga formy mnogiej ICU (`1 członek / 2 członków / 5 członków`),
czyli nowego klucza i decyzji o brzmieniu — to zmiana treści, a ten przebieg świadomie przenosi
sekcje **bez przeprojektowywania** (C-53). Zgłoszone jako osobna, drobna pozycja do kolejnego
przebiegu.

### 6. Trzy zaszyte kolory w stronie zespołu
`src/app/settings/team/[teamId]/page.tsx:134,155,157` · **convention (C-30)** · *bez zmiany*

`#ef4444` zamiast `var(--accent-red)`, więc skórka tego nie przestawi. Plik **nietknięty** przez ten
przebieg; bramka `check:ui-contract` skanuje `src/components`, więc go nie widzi. Odnotowane
w `verify.md` jako dług sprzed 109.

### 7. Status HTTP dla złego adresu sekcji to 200
`src/app/settings/[sekcja]/page.tsx` · **correctness** · *świadome, opisane*

Zmierzone i opisane w `verify.md` §6 oraz w `doświadczenia.md`. Aplikacja wymaga logowania, więc nie
ma konsekwencji dla wyszukiwarek; użytkownik dostaje poprawną treść z wyjściem dalej. Usunięcie tego
wymagałoby przebudowy granic Suspense w całym poddrzewie `/settings` — nieproporcjonalne do skutku.

## Czego szukałem i nie znalazłem

- **Kontrola dostępu:** obie trasy wołają `auth()` i przekierowują; `legacyPermissionForPath`
  dopasowuje po prefiksie, więc każdy adres sekcji dziedziczy `module.settings` (test jednostkowy).
  Żadna sekcja nie poszerza zakresu danych — te same akcje, te same guardy co przed zmianą.
- **`revalidatePath` / mutacje:** zero nowych mutacji, więc nie ma czego inwalidować.
- **Migracje / `schema.prisma`:** bez zmian, `check:schema-drift` zielony.
- **`AIAction` bez egzekutora:** brak nowych akcji AI.
- **Enumy Prisma, hardcode kolorów w nowym kodzie, brak wariantu mobilnego, teksty nie-PL:** nie
  występują (§AC-15/17/18/19 w `verify.md`).
- **Martwy kod:** `not-found.tsx` dodany w trakcie eksperymentu został **usunięty**, gdy okazał się
  nieskuteczny — nie został „na wszelki wypadek" (C-35 czytane w drugą stronę).
- **Nowe zależności:** żadnych; normalizacja diakrytyków standardowym `String.normalize`.

## Bramki po poprawkach recenzenckich

| Bramka | Wynik |
|---|---|
| `npm run build` (pełny łańcuch, bez `migrate.js` — C-13) | ✅ `EXIT=0` |
| `check:perf` | ✅ suma 69373 kB — w pasmie ±5% |
| `check:i18n` | ✅ zero tekstów zaszytych w komponentach |
| `npm run test:unit` | ✅ 1283 / 0 |
| Klikacz — spec 109 | ✅ **14/14** (17 z krokami przygotowania) |

## Werdykt

**APPROVE Z UWAGAMI.**

Zmiana robi dokładnie to, co opisuje spec, i nie robi nic poza tym. Cztery poprawki naniesione
w recenzji dotyczyły **komentarzy i a11y**, nie logiki — ale dwie z nich to komentarze twierdzące
nieprawdę o kodzie, co w tym repozytorium jest realnym kosztem: historia decyzji powłoki żyje
w komentarzach i to z nich korzysta następny przebieg.

Uwagi do osobnego przebiegu (nie blokują): angielskie „member/members" w liczniku członków zespołu
oraz trzy zaszyte kolory w `settings/team/[teamId]/page.tsx` — oba są długiem sprzed 109 i oba
wymagają decyzji o treści, a nie mechanicznej podmiany.
