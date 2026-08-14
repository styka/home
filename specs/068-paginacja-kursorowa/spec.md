# Spec: paginacja kursorowa — zadanie 20, mechanizm i zapadka

- **ID:** 068-paginacja-kursorowa · **Data:** 2026-08-13

## 1. Problem / potrzeba

Rozdz. 11.4 wymienia „paginację kursorową we **wszystkich** widokach listowych" wśród zmian
potrzebnych przy 100 tys. użytkowników. Powód jest prostszy niż wydajność pojedynczego zapytania:
**zapytanie bez `take` zwraca wszystko**, a „wszystko" rośnie razem z kontem. Lista zadań osoby
używającej Omnii od trzech lat to nie jest ten sam obiekt, co lista z pierwszego tygodnia.

**Pomiar:** w akcjach modułów i w `src/actions` jest **263** wywołań `findMany` **bez `take`**.
Przepisanie ich jednym przebiegiem to 263 niesprawdzone zmiany w zapytaniach — dokładnie ten rodzaj
roboty, którego ta przebudowa unika od 051.

## 2. Kryteria akceptacji

- [ ] **AC-1** — Given nowa lista, then ma gotowy mechanizm kursorowy: rozmiar strony z sufitem,
      argumenty kursora i rozstrzygnięcie „czy jest więcej" **bez** drugiego zapytania z `count`.
- [ ] **AC-2** — Given pełna strona bez nadmiaru, then to **koniec danych**, a nie kolejna strona.
- [ ] **AC-3** — Given kursor, then kolejna strona **nie powtarza** ostatniego wiersza poprzedniej.
- [ ] **AC-4** — Given `?limit=100000`, then rozmiar strony zostaje **ograniczony sufitem** —
      paginacji nie da się ominąć parametrem z URL-a.
- [ ] **AC-5** — Given **nowe** zapytanie listowe bez `take`, then **build pada**. Zastane 263
      zostają; licznik może maleć, nigdy rosnąć.
- [ ] **AC-6** — Given spadek licznika, then bramka **też** pada, żądając obniżenia progu —
      inaczej zapadka trzyma na starym poziomie i pozwala dołożyć z powrotem.
- [ ] **AC-7** — Given komplet bramek i build, then przechodzą.

## 3. Zakres

**W zakresie:** `platform/pagination.ts` (kursor, sufit, budowanie strony); testy przypadków
granicznych; bramka-zapadka.

**Poza zakresem — z powodem:** **przepisanie 263 zastanych zapytań**. To praca na wiele przebiegów,
moduł po module, i każdy z nich zmienia zachowanie widoku (widać część listy zamiast całości).
Ta bramka **zatrzymuje wzrost długu**, zamiast udawać, że go spłaciła.

**Dlaczego kursor, nie `skip`/`offset`:** `OFFSET 5000` każe bazie policzyć i odrzucić 5000
wierszy, więc koszt rośnie z numerem strony; przy dopisaniu rekordu między stronami element
przesuwa się i użytkownik widzi go dwa razy albo wcale.

## 4. Zgodność z konstytucją

**C-50**, **C-53** (mechanizm + zapadka zamiast 263 poprawek), **C-36** (helper platformy nie zna
modułów).
