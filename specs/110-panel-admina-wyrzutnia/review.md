# Recenzja: Panel administratora jako pogrupowana wyrzutnia

- **Spec:** ./spec.md · **Plan:** ./plan.md · **Weryfikacja:** ./verify.md
- **Data:** 2026-08-27
- **Zakres:** `git diff origin/develop...HEAD` — 31 plików, +2158/−490 (bez `src/generated/*`,
  które przebudowuje build). Recenzja świeżym okiem po weryfikacji, więc nie powtarza pomiarów
  z `verify.md`.

## Ustalenia

Posortowane od najpoważniejszego. Trzy poprawki naniesione od razu (**[naprawione]**), reszta to
świadome obserwacje bez zmiany kodu.

### 1. `[naprawione]` Akcja nosiła atrapę adresu, a test to zaliczał
`src/lib/admin/narzedzia.ts` · **correctness (model danych + siła testu)**

Pozycja „Zgłoś błąd lub sugestię" nie prowadzi pod żaden adres — uruchamia tryb wskazywania
elementu. Typ wymagał jednak `href`, więc wpis nosił `href: "#"`. To nieprawda w pliku, którego
całym zadaniem jest **być jedynym źródłem prawdy**, a test „każda pozycja ma adres"
(`href.length > 0`) zaliczał ją bez mrugnięcia.

*Skutek, gdyby zostało:* następna pozycja-akcja skopiuje `"#"`, a ktoś kiedyś przeczyta to jako
odnośnik do kotwicy i zacznie szukać, dokąd prowadzi. Test zaś **wygląda** na sprawdzający adresy,
a w rzeczywistości przepuszcza atrapy.

*Poprawka:* typ jest teraz **unią rozłączną** — pozycja jest ALBO odnośnikiem z adresem, ALBO akcją
bez adresu; osobna funkcja `akcja(...)` obok `n(...)`. Kompilator natychmiast wskazał zbyt słabą
asercję w teście (`'narzedzie.href' is possibly 'undefined'`), którą przepisano na sprawdzającą
**obie** gałęzie z osobna. Bramka `check:admin-links` i 7 testów przechodzą, klikacz 14/14.

### 2. `[naprawione]` Martwe importy po usunięciu odnośnika
`src/app/admin/llm/page.tsx:10-11` · **simplification**

Podmiana powrotu z `/admin/config` na `PowrotDoPanelu` zostawiła nieużywane `ChevronLeft` i `Link`.
`next lint` zgłasza to jako ostrzeżenie, a nie błąd, więc build był zielony mimo martwego kodu.

*Poprawka:* oba importy usunięte; `grep` na `Link|ChevronLeft` w tym pliku → zero.

### 3. `[naprawione]` Zdublowana ramka w gałęzi akcji
`src/components/admin/SpisNarzedziAdmina.tsx` · **simplification**

Przycisk akcji miał `style={{ ...styl, border: "1px solid var(--border)" }}` — a `styl` już tę
ramkę zawiera. Nadpisanie tą samą wartością sugeruje różnicę, której nie ma.

*Poprawka:* `style={styl}`.

### 4. Trzy różne etykiety powrotu do panelu
20 stron panelu · **convention** · *bez zmiany*

Pomiar z AC-12 pokazał: „Admin" (13 stron), „Panel admina" (5), „Panel administratora" (2 — nowe).
Wszystkie prowadzą do `/admin`, więc kryterium jest spełnione, ale ta sama rzecz ma trzy nazwy.

*Dlaczego bez zmiany:* ujednolicenie dotyka osiemnastu plików, w różnych miejscach układu; to
osobna, świadoma zmiana, a nie „przy okazji" (C-53). Zgłoszone tu i w `verify.md` §5.

### 5. Dwadzieścia stron panelu nadal rysuje własny nagłówek
`src/app/admin/*` · **convention (C-33)** · *bez zmiany*

Poza kontraktem widoku. Panel jest jednak wyłączony z `check:ui-contract` (`NOT_MODULES`), więc to
nie jest dług wobec bramki. `/admin` i przegląd weszły do ramy, bo i tak powstawały od nowa.

### 6. Bramka czyta rejestr regexem, nie kompilatorem
`scripts/check-admin-links.js` · **correctness** · *świadome*

Pozostałe bramki repozytorium robią tak samo (skrypt jest zwykłym node'em i nie ma czym wykonać
TypeScriptu). Kierunek ewentualnej pomyłki jest **bezpieczny**: pozycja dopisana z pominięciem
`n(...)` nie zostanie rozpoznana, więc bramka zgłosi „strona bez odnośnika" i build padnie — czyli
człowiek zobaczy problem, zamiast go przegapić. Trzy próby mutacyjne w `verify.md` §1 potwierdzają,
że bramka odmawia w każdym z trzech przewidzianych przypadków, łącznie z pustym rejestrem.

## Czego szukałem i nie znalazłem

- **Kontrola dostępu:** obie trasy panelu wołają `hasPermission(session, PERMISSIONS.ADMIN)` →
  `redirect("/")` **jawnie**; nowa trasa nie polega na tym, że „leży pod `/admin`". Test jednostkowy
  pokrywa mapowanie dla 26 ścieżek, e2e `gating.spec.ts` — dla nie-admina.
- **`revalidatePath` / mutacje:** zero nowych mutacji, więc nie ma czego inwalidować.
- **Migracje / `schema.prisma`:** bez zmian, `check:schema-drift` zielony.
- **Enumy Prisma, hardcode kolorów, brak wariantu mobilnego, teksty nie-PL:** nie występują
  (`verify.md` AC-14/15/16).
- **Utrata treści:** jedenaście liczników, pięć pól buildu i trzy pola sesji przeniesione 1:1 —
  e2e sprawdza je **pętlą po nazwach**, nie jednym spojrzeniem.
- **Martwy kod:** `FeedbackTriggerButton` skasowany razem z jedynym konsumentem, a wzmianki o nim
  w `CLAUDE.md` zaktualizowane — nie został osierocony plik ani nieprawdziwy akapit w dokumentacji.
- **Duplikacja:** `bezOgonkow`/`pasujeDoFrazy` mają teraz **jedną** definicję zamiast dwóch, które
  zastałem (rejestr ustawień + wyszukiwarka celów nawigacji); trzeci konsument dołączył zamiast
  dopisać trzecią kopię.

## Bramki po poprawkach recenzenckich

| Bramka | Wynik |
|---|---|
| `npm run build` (pełny łańcuch, bez `migrate.js` — C-13) | ✅ `EXIT=0` |
| `check:admin-links` | ✅ `24 trasy /admin/* — każda ma wejście z panelu (25 pozycji, w tym 1 spoza /admin)` |
| `check:perf` | ✅ suma 69825 kB — w pasmie ±5% |
| `check:i18n` | ✅ zero tekstów zaszytych w komponentach |
| `npm run test:unit` | ✅ 1290 / 0 |
| Klikacz — spec 110 | ✅ **14/14** |

## Werdykt

**APPROVE Z UWAGAMI.**

Zmiana robi to, co opisuje spec, i nie robi nic poza tym: zero migracji, zero nowych akcji, zero
poszerzeń dostępu. Najcenniejszy element to nie sam układ, tylko **bramka** — zgłoszenie mówiło
o długości widoku, a pomiar wyciągnął z niego trasę (`/admin/llm`), do której nie prowadził żaden
odnośnik w całej aplikacji. Od teraz następna taka strona zatrzyma build zamiast czekać na
przypadkowe odkrycie.

Trzy poprawki naniesione w recenzji były drobne, ale jedna z nich (unia rozłączna w typie) miała
realny ciężar: usunęła nieprawdę z rejestru **i** obnażyła asercję, która wyglądała na sprawdzającą
adresy, a przepuszczała atrapy — kompilator wskazał ją natychmiast po zmianie typu.

Dwie uwagi do osobnego przebiegu, obie zmierzone i zgłoszone zamiast po cichu naprawione: trzy
różne etykiety powrotu do panelu oraz dwadzieścia stron panelu poza kontraktem widoku.
