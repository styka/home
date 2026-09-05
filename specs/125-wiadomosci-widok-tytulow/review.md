# Recenzja: Wiadomości — widok samych tytułów do oznaczania „do doczytania"

- **Spec:** ./spec.md (125-wiadomosci-widok-tytulow)
- **Data:** 2026-09-05
- **Zakres:** `git diff origin/develop..HEAD` (bez `specs/**` i przepieczonych `src/generated/**`)
- **Recenzenci:** przegląd własny + świeże oko subagenta `omnia-reviewer`

## Ustalenia (od najpoważniejszego) — wszystkie NAPRAWIONE w tym przebiegu

1. **`NewsPage.tsx` — correctness (niska waga): optymistyka bez ochrony przed odczytem w locie.**
   `loadStream` wystartowany PRZED dotknięciem wiersza (domknięte odświeżanie w tle, „oznacz temat"
   w nagłówku sekcji) wracał z migawką sprzed zapisu i wizualnie cofał gest — rozjazd
   samonaprawialny, ale łamiący literę AC-2 („stan widoczny i trwały"). **Naprawione:** numer
   sekwencji żądania w `loadStream` (odpowiedź, która nie jest najnowsza, przepada) +
   `przelaczDoczytanie` unieważnia odpowiedzi będące w locie w chwili gestu.
2. **`WierszTytulu.tsx` — convention C-31: link do artykułu ~35 px szerokości** (poniżej normy
   44 px modułu). Chybienie lądowało na odwracalnym przełączniku, więc bez skutku trwałego —
   **naprawione:** `min-w-[44px] justify-center` (wysokość rozciąga `items-stretch`).
3. **`NewsPage.tsx` — a11y: `aria-pressed` na przycisku, który w trybie tytułów jest nawigacją.**
   Czytnik ekranu ogłaszał „Przejdź do odłożonych" jako wyłączony przełącznik. **Naprawione:**
   `aria-pressed` tylko poza trybem tytułów.

## Sprawdzone i czyste (bez ustaleń)

- **Optymistyka na jednym nośniku**: `stream` zasila licznik, filtr, nawigator i lektora — zero
  drugiego nośnika do rozjazdu (AC-5/AC-9 spójne konstrukcyjnie).
- **C-20/C-21/C-23**: żadnej nowej mutacji ani `AIAction`; wiersz woła `setItemReadLater` z 124
  (guard `czyMojRekord` + `revalidatePath` nietknięte).
- **C-30/C-32/C-36/C-53**: kolory wyłącznie zmiennymi CSS (łącznie z `inset`-shadow z var), teksty
  przez `t()` we właściwych namespace'ach, całość w module News, jeden nowy komponent i zero
  zależności; link zewnętrzny z `rel="noopener noreferrer"`.
- **Mechanika 124 nietknięta**: render kart za flagą domyślnie wyłączoną; spec 124 przechodzi bez
  modyfikacji scenariuszy.
- **E2E**: serial, bez `networkidle`, asercje zakresowane po seedzie, reset cudzych odłożeń;
  `--workers=1` przy wspólnym przebiegu plików Wiadomości (globalne „Oznacz wszystkie").

4. **`e2e/specs/124-wiadomosci-doczytania.spec.ts` — correctness testu (wyszło w rundzie
   kontrolnej):** kontrolny przebieg po poprawkach odwrócił kolejność plików (125 przed 124)
   i licznik odłożonych w 124 pokazał „2" — pozycję zostawioną przez 125. Utwardzenie seedu 125
   z T-4 było jednostronne. **Naprawione:** ten sam reset cudzych `readLater` w seedzie 124;
   oba pliki są teraz odporne na dowolną kolejność. Lekcja dopisana do `doświadczenia.md`.

## Weryfikacja po poprawkach recenzji

- `tsc --noEmit`, `check:i18n`, `next lint --dir src` — zielone.
- Klikacze 125+124 ponowione po poprawkach (`--workers=1`) — wynik w podsumowaniu przebiegu.
- Pełny `npm run build` był zielony bezpośrednio przed poprawkami; poprawki nie dotykają migracji,
  akcji ani manifestów — bramki potwierdzone punktowo jak wyżej.

## Werdykt

**APPROVE Z UWAGAMI** — trzy drobne ustalenia, wszystkie naprawione w tym samym przebiegu; brak
uwag otwartych. Zgodnie ze standing authorization: merge do `develop`, push, automatyczna promocja
`develop → master` po kontroli integralności.
