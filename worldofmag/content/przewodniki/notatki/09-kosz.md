# Usuwanie, kosz i odzyskiwanie

## Usunięcie nie jest ostateczne

Usunięcie notatki — koszem przy notatce albo klawiszem `d` — najpierw pyta o potwierdzenie, a potem
**przenosi notatkę do kosza**, wspólnego dla całej aplikacji. Zapisywana jest pełna migawka: tytuł,
treść, folder, przypięcie i tagi.

Kosz otwierasz spod adresu `/trash` albo ikoną ze strzałką w pasku nad listą notatek. Przy każdej
pozycji stoi **odliczanie do trwałego skasowania** i przycisk przywrócenia. Przywrócona notatka wraca
z tagami i folderem — nie tylko z gołym tekstem.

**Czas na zmianę zdania: 30 dni.** Po tym okresie wpis jest kasowany na stałe i nie ma go już skąd
odzyskać.

## Co usunięcie robi z odnośnikami

Nic — i to jest właśnie to, o czym trzeba wiedzieć. Wikilinki wskazujące na usuniętą notatkę
**nie znikają**: zamieniają się w blade, nieklikalne odnośniki do nieistniejącej notatki, dokładnie
takie same jak odnośnik do notatki, której jeszcze nie napisałeś.

Ma to dobrą stronę: przywrócenie notatki z kosza **ożywia je wszystkie naraz**, bo dopasowanie idzie
po tytule, a tytuł wraca razem z notatką.

Zanim usuniesz notatkę, na którą coś może wskazywać, zajrzyj do sekcji **„Linkują tu:"** w jej
edycji — to jest lista miejsc, w których po usunięciu zostanie ślepy odnośnik.

## Czego kosz nie obejmuje

- **Załączniki usunięte pojedynczo** (mały kosz na miniaturze) znikają od razu, bez kosza. Usunięcie
  **całej notatki** zachowuje jej treść w koszu.
- **Folder usunięty na `/notes/groups`** — notatki z niego **nie znikają**, tracą tylko przypisanie
  i trafiają do zakładki „Bez grupy".
- **Tag usunięty na `/notes/tags`** znika ze wszystkich notatek, które go miały. Same notatki
  zostają nietknięte.
- **Historia wersji** ginie razem z trwałym skasowaniem notatki.

## Zanim usuniesz — trzy tańsze rozwiązania

Notatki nie zajmują miejsca i nie przeszkadzają, dopóki nie są na wierzchu. Zamiast kasować:

1. **Odepnij** — zniknie z góry listy.
2. **Wrzuć do folderu „Archiwum"** — zniknie z zakładki „Bez grupy" i przestanie wpadać w oczy.
3. **Oznacz tagiem** `#zamknięte` — zostanie do wyszukania, gdy okaże się potrzebna.

Notatka, o której na pewno wiesz, że nie wróci — hasło, które przestało obowiązywać, ustalenia
sprzed dwóch lat — to inna sprawa. Usuń ją; masz miesiąc na zmianę zdania.
