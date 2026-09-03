# Spec: Transkrypcje YouTube — naprawa pobierania (filmy z napisami raportują „brak transkrypcji")

- **ID:** 123-youtube-transkrypcje-fix
- **Status:** draft
- **Autor sesji:** Claude Code (spec-driven pipeline)
- **Data:** 2026-09-03
- **Moduł(y):** YouTube (`/youtube`, `module.youtube`)

> **Zasada speca:** opisujemy **CO i DLACZEGO**, nigdy **JAK**. Zero nazw plików, tabel, bibliotek,
> endpointów. Jeśli piszesz o implementacji — to należy do `plan.md`, nie tutaj.

## 1. Problem / potrzeba

Moduł YouTube ocenia filmy i buduje streszczenia na podstawie transkrypcji, ale użytkownik zgłasza,
że **transkrypcja nie jest znajdowana nawet dla filmów, które ją mają** — na liście filmów niemal
wszystko pokazuje „brak transkrypcji" (przykład ze zgłoszenia: kanał „Kamila Kaźmierczak · brak
transkrypcji" na `/youtube`). Użytkownik podpowiada, że w interfejsie YouTube transkrypcja jest
dostępna dopiero po rozwinięciu opisu filmu (przycisk „Wyświetl transkrypcję" na końcu opisu) — czyli
film **ma** napisy, a nasz sposób ich wydobywania ze strony filmu przestał trafiać w to, co YouTube
faktycznie serwuje. Skutek kaskadowy: bez transkrypcji gorsze są streszczenia, ocena „czy warto
obejrzeć", zapis do Notatek i „Fiszki z filmu" (Języki) — wszystkie te funkcje spadają na sam opis
filmu, który bywa szczątkowy.

Dodatkowy problem utrwalający usterkę: film, dla którego pobranie raz się nie powiodło, zostaje
oznaczony jako „transkrypcja niedostępna" **na zawsze** — kolejne odświeżenia go pomijają. Nawet po
naprawie mechanizmu istniejące filmy pozostałyby więc „bez transkrypcji".

## 2. Cel i miary sukcesu

- Cel: dla filmu, który ma napisy (autorskie lub automatyczne), moduł YouTube pozyskuje pełną
  transkrypcję i używa jej w streszczeniach, ocenach, notatkach i fiszkach; „brak transkrypcji"
  pojawia się tylko przy filmach, które napisów faktycznie nie mają.
- Sukces mierzymy:
  - na realnej próbce filmów z napisami (w tym z kanału ze zgłoszenia) skuteczność pobrania jest
    bliska 100 % — a nie, jak dziś, bliska zeru;
  - istniejący w module wskaźnik skuteczności pobrań (logowany po każdym przebiegu odświeżania)
    raportuje wyraźny wzrost odsetka udanych pobrań;
  - filmy wcześniej błędnie oznaczone „niedostępna" po naprawie dostają transkrypcję bez ręcznej
    interwencji użytkownika.

## 3. Historyjki użytkownika

- Jako użytkownik modułu YouTube chcę, aby film mający napisy miał w Omnii transkrypcję, żeby
  streszczenie i ocena „czy warto obejrzeć" opierały się na treści filmu, a nie tylko na opisie.
- Jako użytkownik chcę, aby filmy dotąd oznaczone „brak transkrypcji" zostały ponownie sprawdzone po
  naprawie, żebym nie musiał ich usuwać i dodawać od nowa.
- Jako użytkownik zapisujący film do Notatek lub generujący „Fiszki z filmu" chcę, aby te funkcje
  dostawały transkrypcję, kiedy tylko istnieje, żeby wynik był merytoryczny.
- Jako właściciel systemu chcę widzieć w logach skuteczność pobierania transkrypcji, żeby przyszłą
  regresję (YouTube znów coś zmieni) wykryć po spadku odsetka, a nie po zgłoszeniu użytkownika.

## 4. Kryteria akceptacji (testowalne)

- [ ] **AC-1** — Given film na YouTube posiadający napisy (autorskie lub automatyczne), when moduł
  pobiera dla niego transkrypcję (podczas odświeżania), then transkrypcja zostaje zapisana w całości
  wraz z językiem, a film przestaje pokazywać „brak transkrypcji".
- [ ] **AC-2** — Given odpowiedzi YouTube w postaci, jaką serwis zwraca **obecnie** (zapisane próbki
  rzeczywistych odpowiedzi), when uruchamiane są testy jednostkowe warstwy wydobywania, then
  wydobycie listy dostępnych napisów i złożenie tekstu przechodzi na tych próbkach.
- [ ] **AC-3** — Given film oznaczony wcześniej jako „transkrypcja niedostępna" (skutek usterki),
  when po wdrożeniu naprawy przebiega odświeżanie modułu, then film zostaje ponownie sprawdzony i —
  jeśli napisy istnieją — dostaje transkrypcję bez ręcznej interwencji.
- [ ] **AC-4** — Given film, który napisów faktycznie nie ma (albo YouTube odmawia), when pobranie
  się nie powiedzie, then film dostaje stan „niedostępna", a odświeżanie modułu, streszczenia
  z opisu i pozostałe funkcje działają dalej (żaden wyjątek nie przerywa przebiegu).
- [ ] **AC-5** — Given napisy dostępne w kilku językach/wariantach, when wybierana jest ścieżka,
  then zachowana jest dotychczasowa preferencja: polski → angielski → cokolwiek, a w obrębie języka
  napisy autorskie przed automatycznymi.
- [ ] **AC-6** — Given zakończony przebieg odświeżania, w którym próbowano pobrać transkrypcje,
  when przebieg się kończy, then log skuteczności (próbowano/udane/odsetek) nadal jest emitowany.
- [ ] **AC-7** — Given transkrypcja istnieje, when użytkownik zapisuje film do Notatek albo generuje
  „Fiszki z filmu", then funkcje te korzystają z transkrypcji (a nie wyłącznie z opisu) — tak jak
  przewidywał to pierwotny kontrakt modułu.

## 5. Zakres

**W zakresie:**
- Naprawa pozyskiwania transkrypcji filmu tak, by działała z tym, co YouTube serwuje obecnie
  (zgłoszenie wskazuje, że dotychczasowa droga „ze strony filmu" przestała trafiać w dostępne dane).
- Jednorazowe ponowne zakwalifikowanie filmów błędnie oznaczonych „niedostępna" do ponownej próby.
- Aktualizacja testów jednostkowych o próbki odpowiedzi w kształcie, jaki YouTube zwraca dziś.
- Zachowanie dotychczasowych zasad modułu: brak transkrypcji jest normalnym stanem (nie awarią),
  preferencja językowa bez zmian, limit liczby pobrań na przebieg bez zmian.

**Poza zakresem (świadomie):**
- Jakiekolwiek zmiany UI modułu YouTube (lista, szczegół filmu) poza tym, że poprawne dane same
  naprawią wyświetlane stany.
- Automatyczne okresowe ponawianie filmów „niedostępna" w nieskończoność (jednorazowa rekwalifikacja
  po naprawie wystarcza; film bez napisów ma prawo zostać „niedostępna").
- Pobieranie transkrypcji przez sterowaną przeglądarkę (klikanie „Wyświetl transkrypcję" w realnym
  UI) — wskazówka użytkownika opisuje, gdzie transkrypcja jest w interfejsie, ale rozwiązanie ma
  pozostać lekkim pobraniem bez przeglądarki, jak dotąd.
- Zmiany w innych modułach (Notatki, Języki) — one już konsumują transkrypcję przez kontrakt.

## 6. Wpływ na Omnia

- **Uprawnienie / RBAC:** bez zmian — istniejący slug modułu YouTube; żadnych nowych tras.
- **Własność danych:** bez zmian — filmy i transkrypcje pozostają w przestrzeni użytkownika, jak
  dotychczas.
- **Asystent AI:** bez nowych `AIAction`/read-tooli — istniejące narzędzia odczytu modułu YouTube
  po prostu zaczną dostawać dane, których dziś brakuje.
- **Kalendarz / powiadomienia / trash:** nie dotyczy.

## 7. Zgodność z konstytucją

- **C-01** — cała praca w `worldofmag/`.
- **C-36** — zmiana zamyka się we wnętrzu modułu YouTube; inne moduły nadal widzą go wyłącznie przez
  kontrakt; wiedza o kształcie odpowiedzi YouTube pozostaje w funkcjach czystych, testowalnych na
  zapisanych próbkach.
- **C-10/C-11** — jeśli rekwalifikacja filmów „niedostępna" będzie wymagała zmiany danych, idzie
  ręczną, sekwencyjnie numerowaną migracją; bez enumów Prisma (C-12) — stany pozostają `String`
  + union.
- **C-20** — ewentualne mutacje po stronie akcji wg istniejącego wzorca modułu.
- **C-50** — gotowe = `npm run build` przechodzi (lokalnie do `next build`, bez prod DB — C-13).
- **C-51** — usterka naprawiona → wpis do `doświadczenia.md` razem z fixem.
- **C-52/C-52a** — merge do `develop`, promocja `develop → master` fast-forward na końcu przebiegu.
- **C-53** — minimalizm: naprawa pobierania + rekwalifikacja, bez refaktorów „przy okazji".

## 8. Otwarte pytania / decyzje właściciela

Zgłoszenie jest jednoznacznym bugfixem — pytań do właściciela nie zadano (C-55). Przyjęte
założenia (rekomendowane domyślne):

- **Rekwalifikacja jednorazowa:** filmy oznaczone dziś „niedostępna" zostają po wdrożeniu ponownie
  sprawdzone przy najbliższym odświeżaniu; nie wprowadzamy wiecznego ponawiania.
- **Bez przeglądarki:** pozostajemy przy lekkim pobieraniu bez sterowania realnym UI YouTube —
  wskazówka użytkownika („Wyświetl transkrypcję" w rozwiniętym opisie) służy jako trop, że napisy
  istnieją i są osiągalne, nie jako wymóg klikania w DOM.
- **Zasady modułu bez zmian:** „brak transkrypcji" pozostaje normalnym stanem; preferencja językowa
  i limit pobrań na przebieg bez zmian.

## 9. Ryzyka

- **YouTube znów zmieni kształt odpowiedzi** → wiedza o kształcie zostaje w funkcjach czystych
  z testami na zapisanych próbkach; log skuteczności (próbowano/udane/odsetek) pozwala wykryć
  regresję po spadku odsetka.
- **YouTube ogranicza żądania z serwerów (blokady/limity)** → niepowodzenie pojedynczego filmu
  nigdy nie przerywa przebiegu (stan „niedostępna"), limit pobrań na przebieg zostaje; skuteczność
  na realnej próbce oceniamy **na środowisku testowym po wdrożeniu na `develop`** (środowisko
  budowy nie ma dostępu sieciowego do YouTube — korekta wg C-54, etap planu), a naprawę
  projektujemy wielotorowo (kilka niezależnych dróg pozyskania), żeby pojedyncza zmiana po stronie
  YouTube nie zerowała skuteczności.
- **Rekwalifikacja dużej liczby filmów naraz** → ponowne próby i tak sączą się przez istniejący
  limit pobrań na przebieg, więc nie zaleją ani YouTube, ani kolejki zadań.
