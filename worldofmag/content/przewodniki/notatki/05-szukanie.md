# Szukanie i pytanie notatek

Notatki wolno zapisywać byle jak — pod warunkiem, że da się je potem znaleźć. Dlatego moduł ma dwa
niezależne sposoby dotarcia do treści: wyszukiwarkę i asystenta.

## Wyszukiwarka

Zakładka **„Szukaj"** (albo klawisz `/` z dowolnego miejsca listy) otwiera pole wyszukiwania.
Wyniki zawężają się w trakcie pisania; szukane słowo jest **podświetlone** w tytule i w podglądzie
treści, więc od razu widać, dlaczego dana notatka się pokazała.

Wyszukiwanie obejmuje **tytuł, treść i tagi**, a wyniki są **ważone** — nie ułożone od najnowszych.
Kolejność jest taka:

1. tytuł dokładnie równy szukanej frazie,
2. tytuł zaczynający się od frazy,
3. fraza gdziekolwiek w tytule,
4. trafienie w nazwie tagu,
5. trafienie w treści.

Dzięki temu notatka **„Wifi"** wyjdzie przed dwudziestoma notatkami, w których słowo „wifi" pada
mimochodem w treści.

> **Literówki są wybaczane po stronie bazy.** Wyszukiwanie w treści korzysta z indeksu, który
> porównuje fragmenty słów, więc „hydralik" ma szansę trafić w „hydraulika". Nie licz na to jak na
> pewnik — ale nie zakładaj też, że jedna przestawiona litera oznacza zero wyników.

### Filtry łączą się z wyszukiwaniem

Wybrany folder i zaznaczone tagi **nie znikają** po wejściu w wyszukiwarkę — działają razem. Jeśli
szukanie „nie znajduje oczywistej notatki", spójrz na licznik „widoczne / wszystkie" nad listą: gdy
pokazuje coś w rodzaju „0 / 128", to znak, że filtr zawęził zbiór, zanim wyszukiwarka zdążyła cokolwiek
zrobić. Klawisz `Esc` czyści wyszukiwanie i wraca do zakładki „Wszystkie".

## „Pytaj AI" — pytanie zamiast szukania

Obok filtrów stoi przycisk **„Pytaj AI"**. Otwiera on pole, w którym zamiast słowa kluczowego zadajesz
**pytanie**: „co ustaliliśmy z hydraulikiem?", „jaki był kod do bramy?", „co miałem kupić na urodziny
mamy?".

Asystent czyta notatki, do których masz dostęp, i odpowiada zdaniem — a pod odpowiedzią pokazuje
**„Źródła:"**, czyli notatki, na których ją oparł. Ta lista jest ważniejsza, niż się wydaje: pozwala
sprawdzić odpowiedź, zamiast brać ją na wiarę.

Kiedy co wybrać:

| Sytuacja | Narzędzie |
|---|---|
| Pamiętasz słowo, które na pewno tam pada | Wyszukiwarka |
| Pamiętasz sens, ale nie słowa | „Pytaj AI" |
| Chcesz listę wszystkich notatek na temat | Wyszukiwarka albo tag |
| Chcesz jedno zdanie z odpowiedzią | „Pytaj AI" |

## Wyszukiwanie z każdego miejsca aplikacji

Notatek nie musisz szukać w module. **`Ctrl+K`** (na Macu `Cmd+K`) otwiera paletę poleceń dostępną
wszędzie, a globalny asystent — ikona iskierek na dole ekranu — odpowiada na pytania o notatki
w trakcie pracy w zupełnie innym module. O tym drugim jest osobny rozdział.
