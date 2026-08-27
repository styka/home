# Pisanie: markdown i podgląd

Treść notatki to zwykły tekst. Jeśli chcesz czegoś więcej — nagłówków, list, tabeli, pogrubienia —
notatka rozumie **markdown**, czyli formatowanie pisane znakami w treści.

## Podgląd na żywo

W trybie edycji notatki, obok pola treści, stoi **ikona oka**. Włącza podgląd: po lewej piszesz, po
prawej od razu widzisz efekt. To najszybszy sposób, żeby sprawdzić, czy tabela się „złapała"
i czy lista zagnieździła się tam, gdzie miała.

Notatka sformatowana markdownem dostaje na liście etykietę **MD**.

## Co dokładnie działa

Omnia renderuje własny, celowo wąski zestaw markdownu — ten sam w notatkach, przepisach, zadaniach
i raportach:

| Zapis | Efekt |
|---|---|
| `# Tytuł` … `###### Tytuł` | Nagłówki sześciu poziomów |
| `**gruby**`, `*pochylony*` | Pogrubienie i kursywa |
| `- pozycja` albo `* pozycja` | Lista wypunktowana |
| dwie spacje wcięcia przed `-` | Lista zagnieżdżona |
| `1. pozycja` | Lista numerowana |
| `> cytat` | Blok cytatu |
| `` `kod` `` oraz ` ```blok``` ` | Kod w linii i blok kodu |
| `[napis](https://adres)` | Odnośnik |
| `![opis](https://adres-obrazka)` | Obrazek (tylko `http`/`https`) |
| `---` | Linia pozioma |

Tabele też działają — wiersze rozdzielasz pionową kreską, a pod wierszem nagłówka wstawiasz wiersz
z myślnikami. Dokładny zapis najprościej podejrzeć w tej właśnie tabeli: notatka renderuje ją tym
samym mechanizmem, co ten przewodnik. Jedno ograniczenie: **pionowa kreska zawsze rozdziela komórki**
— nie da się jej wpisać w środku komórki jako zwykłego znaku, bo nie ma sposobu na jej „ucieczkę".

## Czego świadomie nie ma

**Surowy HTML nie działa.** Wpisanie `<b>test</b>` da w podglądzie dosłownie `<b>test</b>`, a nie
pogrubiony napis. Nie jest to niedoróbka, tylko decyzja: notatki bywają udostępniane innym osobom,
a treść wklejona ze strony internetowej potrafi zawierać kod, którego nikt nie chciał uruchomić.
Znaki `<` i `&` są zamieniane na nieszkodliwe odpowiedniki, zanim treść w ogóle trafi na ekran.

Praktyczny wniosek: **wklejanie fragmentów stron „z formatowaniem" nie zadziała** tak, jak w edytorze
tekstu. Wklej sam tekst, a formatowanie dołóż markdownem.

Nie ma też list zadań (`- [ ]`) renderowanych jako klikalne pola wyboru — od odhaczania rzeczy do
zrobienia jest moduł Zadania, a notatka z pozorną listą kontrolną, której nie da się kliknąć, byłaby
gorsza niż jej brak.

## Dyktowanie zamiast pisania

Przy polu treści — zarówno w pasku nowej notatki, jak i w edycji — stoi **mikrofon**. Kliknięcie
uruchamia rozpoznawanie mowy po polsku i dopisuje rozpoznany tekst do treści. Drugie kliknięcie
kończy nagrywanie.

W trybie edycji jest jeszcze druga, ciekawsza opcja: mikrofon opisany **„Powiedz co zmienić"**. Nie
dopisuje on dyktowanego tekstu dosłownie, tylko przekazuje go jako **polecenie** — „dopisz na końcu
listę zakupów", „popraw literówki", „zrób z tego punkty". Treść zmienia się zgodnie z poleceniem.

## Eksport pojedynczej notatki

Ikona pobierania przy notatce zapisuje ją jako **plik `.md`** — zwykły tekst, który otworzy dowolny
edytor. To jest twoja droga wyjścia: treść notatek nigdy nie jest zamknięta w aplikacji.
