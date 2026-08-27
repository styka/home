# Wikilinki: notatki, które się znają

To jest funkcja, która zamienia zbiór kartek w sieć — i jednocześnie ta, o której najtrudniej się
dowiedzieć samemu, bo nie ma dla niej żadnego przycisku.

## Jak to działa

Wpisz w treści notatki tytuł innej notatki w **podwójnym nawiasie kwadratowym**:

```
Rozmawiałem z [[Hydraulik Marek]] o wymianie pionu.
Szczegóły ustaleń są w [[Remont łazienki 2026]].
```

Po zapisaniu, w trybie edycji notatki, pojawia się sekcja **„Linkuje do:"** z odnośnikami do obu
notatek. Kliknięcie przenosi wprost do wskazanej notatki.

## Odnośniki zwrotne — najciekawsza połowa

Druga sekcja nazywa się **„Linkują tu:"** i pokazuje wszystkie notatki, które wskazują **na
bieżącą**. Nie musisz robić nic, żeby ją wypełnić — powstaje sama, z linków wpisanych gdzie indziej.

To zmienia sposób pracy. Nie trzeba budować struktury z góry: pisząc notatkę ze spotkania, wspominasz
`[[Projekt Alfa]]`, a notatka o projekcie **sama** zbiera listę wszystkich spotkań, które jej
dotyczyły. Spis treści powstaje bez pisania spisu treści.

## Cztery zachowania, które zaskakują za pierwszym razem

Wikilinki nie są magiczne — dopasowują się **po tytule**, i stąd biorą się wszystkie niespodzianki.

**1. Odnośnik do nieistniejącej notatki jest widoczny i nieklikalny.**
Jeśli wpiszesz `[[Ubezpieczenie auta]]`, a takiej notatki nie ma, odnośnik pokaże się jako blady
napis obrysowany kreskowaną ramką, z podpowiedzią „Brak notatki o tym tytule". Nie jest to błąd —
raczej lista rzeczy do napisania. Utwórz notatkę o dokładnie takim tytule, a odnośnik ożyje sam.

**2. Wielkość liter nie ma znaczenia.**
`[[remont łazienki]]` trafi w notatkę „Remont łazienki". Spacje na początku i końcu też są
ignorowane. Reszta — tak: `[[Remont lazienki]]` bez ogonka **nie trafi** nigdzie.

**3. Gdy dwie notatki mają ten sam tytuł, odnośnik prowadzi do pierwszej z brzegu.**
Nie ma ostrzeżenia i nie ma wyboru. To jest najlepszy powód, żeby tytuły notatek, do których
linkujesz, były **unikalne i konkretne**: nie „Spotkanie", tylko „Spotkanie z Anią 12.03".

**4. Zmiana tytułu notatki zrywa istniejące odnośniki.**
Nic ich automatycznie nie poprawia. Notatka „Remont łazienki" przemianowana na „Łazienka — remont"
sprawi, że wszystkie `[[Remont łazienki]]` staną się odnośnikami do nieistniejącej notatki.
Zanim zmienisz tytuł, zajrzyj w sekcję **„Linkują tu:"** — to jest dokładnie lista miejsc do
poprawienia.

## Gdzie tego szukać

Wszystkie trzy sekcje — „Linkuje do:", „Linkują tu:" oraz załączniki i historia — pokazują się
**w trybie edycji notatki**, nie na liście. Wejdź w notatkę (dwuklik albo klawisz `e`), a zobaczysz
całe jej otoczenie. To świadomy kompromis: gdyby lista pokazywała wszystkie powiązania każdej
notatki, przestałaby być listą.

## Trzy sposoby użycia, które warto ukraść

- **Notatka-koncentrator.** Załóż pustą notatkę „Remont 2026" i nie pisz w niej niczego. Wszystkie
  notatki o remoncie niech wspominają `[[Remont 2026]]`. Sekcja „Linkują tu:" będzie sama utrzymywać
  aktualny spis treści remontu.
- **Notatki-osoby.** Jedna notatka na osobę: kontakt, ustalenia, historia. Każda notatka ze spotkania
  wspomina `[[Marek Hydraulik]]`. Dostajesz kartotekę, której nikt nie musiał prowadzić.
- **Dziennik z odnośnikami.** Notatka na dzień, a w niej odnośniki do spraw, którymi się zajmowałeś.
  Po miesiącu każda sprawa ma pod spodem oś czasu — złożoną z dni, w których się pojawiła.
