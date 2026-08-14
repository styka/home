# Recenzja: paginacja kursorowa — zadanie 20

## Ustalenia

### 1. Zapadka, która pada przy SPADKU licznika
*`scripts/check-pagination.js`* · **process** · **zaprojektowane celowo**

Zapadka porównująca „nie więcej niż X" wygląda na kompletną i **nie jest**: po spłaceniu dziesięciu
zapytań próg zostaje na starym poziomie i pozwala dołożyć dziesięć nowych. Bramka wymaga więc
obniżenia progu przy każdym spadku — dzięki temu postęp jest **utrwalany**, a nie tylko chwilowy.

Koszt: jedna dodatkowa edycja pliku przy każdej spłacie. To jest właściwa cena.

### 2. Rozstrzygnięcie „czy jest więcej" bez `count`
*`platform/pagination.ts` (`zbudujStrone`)* · **wydajność** · **odnotowane**

Naturalny odruch to `count` obok `findMany`. Na dużej tabeli `count` jest **droższy** niż sama
strona — czyli paginacja płaciłaby za siebie zapytaniem, którego miała uniknąć. Wiersz-zwiadowca
(`take: rozmiar + 1`) daje tę samą informację za darmo.

### 3. Ograniczenie tej bramki, warte nazwania
**granica narzędzia** · **odnotowane**

Wzorzec jest **tekstowy**, nie AST-owy: liczy `findMany({ … })` bez `take:` w wyciętym zgrubnie
fragmencie. Nie zobaczy zapytania złożonego dynamicznie ani `take` przekazanego w zmiennej.
To świadomy kompromis — bramka ma być tania i przewidywalna, a fałszywy alarm rozwiązuje się
dopisaniem `take`, co i tak jest właściwym ruchem.

## Rzeczy sprawdzone

- **`rozmiarStrony(0)`** zwraca domyślny, nie pustą stronę — zero to „nie podano", nie „nic nie
  pokazuj".
- **Ułamek** obcinany w dół, nie zaokrąglany.
- **`src/actions/privacy.ts`** ma 55 nieograniczonych zapytań — najwięcej w repo, ale to kod
  usuwania konta, który z definicji przechodzi po wszystkim. Zapadka go liczy; przy spłacie będzie
  pierwszym kandydatem na świadomy wyjątek.

## Werdykt

**APPROVE.**
