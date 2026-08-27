# Porządek: foldery, tagi, przypinanie

Do porządkowania notatek służą trzy niezależne mechanizmy. Warto rozumieć, czym się różnią, bo
każdy odpowiada na inne pytanie.

## Folder — „gdzie to leży"

Folder (w kodzie i starszych ekranach nazywany też **grupą**) to szuflada. Notatka leży **w jednym
folderze albo w żadnym** — dokładnie tak jak plik na dysku.

Foldery tworzysz i porządkujesz na `/notes/groups`: nazwa, opis i kolor. Kolor nie jest ozdobą —
na liście pozwala rozpoznać notatkę kątem oka, bez czytania.

Zakładka **„Bez grupy"** pokazuje notatki, które nigdy nie trafiły do żadnej szuflady. To dobra
skrzynka spraw przychodzących: zapisujesz szybko, a raz na jakiś czas przechodzisz przez tę zakładkę
i rozdzielasz.

## Tag — „czego to dotyczy"

Tag to etykieta. Notatka może mieć **dowolnie wiele tagów naraz** — i to jest cała różnica wobec
folderu. „Wakacje 2026" to folder; `#pomysł`, `#pilne`, `#do-przeczytania` to tagi.

Tagi dodajesz przy notatce (pole `+ tag`) albo zarządzasz nimi zbiorczo na `/notes/tags`. Klikając
tag w pasku filtrów zawężasz listę; klikając kilka — zawężasz **iloczynem**, czyli zostają notatki
mające **wszystkie** wybrane tagi naraz, nie którykolwiek z nich. To rozróżnienie zaskakuje przy
pierwszym użyciu: dwa tagi zwykle dają mniej wyników niż jeden, nie więcej.

> **Tagi są wspólne dla całej aplikacji.** Ten sam słownik tagów obsługuje notatki i przepisy
> w Kuchni. Tag utworzony przy notatce zobaczysz więc przy przepisie — i odwrotnie. To celowe:
> `#wegetariańskie` znaczy to samo w obu miejscach.

### AI podpowiada tagi

Pod polem treści notatki pojawiają się **propozycje tagów** wyliczone z tego, co napisałeś.
Klikasz, żeby przyjąć; ignorujesz, żeby odrzucić. Nic nie dzieje się samo — asystent proponuje,
Ty decydujesz.

## Przypięcie — „to jest teraz ważne"

Pinezka przy notatce wypycha ją na górę listy, nad wszystkie pozostałe, niezależnie od dat
i filtrów. Zakładka **„Przypięte"** pokazuje wyłącznie te notatki.

Przypięcie jest z natury **tymczasowe**. Sprawdza się dla rzeczy, które są ważne przez tydzień:
lista rzeczy do spakowania przed wyjazdem, numer do serwisu w trakcie naprawy, kod do bramy na czas
remontu. Gdy przypiętych notatek zrobi się dwadzieścia, przestają cokolwiek wyróżniać — wtedy lepiej
sięgnąć po folder.

## Jak to składać

Sprawdzony układ, jeśli nie wiesz od czego zacząć:

1. **Nie twórz folderów na zapas.** Pierwsze trzydzieści notatek może spokojnie leżeć „bez grupy" —
   wyszukiwarka je znajdzie.
2. **Folder zakładaj wtedy, gdy zauważysz powtórkę** — trzecia notatka o tym samym remoncie jest
   sygnałem, że remont zasługuje na szufladę.
3. **Tagów używaj do przekrojów**, których folder nie obsłuży: `#pilne` dotyczy remontu, pracy
   i zdrowia naraz, więc nie ma sensownej szuflady.
4. **Przypinaj najwyżej kilka rzeczy naraz** i odpinaj, gdy przestają być bieżące.
