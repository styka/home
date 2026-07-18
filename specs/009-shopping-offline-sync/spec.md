# Spec: Zakupy offline z synchronizacją

- **ID:** 009-shopping-offline-sync
- **Status:** draft
- **Autor sesji:** Claude Code (spec-driven pipeline)
- **Data:** 2026-07-17
- **Moduł(y):** Shopping (Zakupy)

> **Zasada speca:** opisujemy **CO i DLACZEGO**, nigdy **JAK**. Zero nazw plików, tabel, bibliotek,
> endpointów. Jeśli piszesz o implementacji — to należy do `plan.md`, nie tutaj.

## 1. Problem / potrzeba
Dziś moduł Zakupy działa wyłącznie online — każda zmiana pozycji (status, dodanie, edycja, usunięcie)
przechodzi przez serwer. W wielu sklepach (podziemne markety, hale, place targowe, piwnice) **nie ma
zasięgu internetu**, więc dokładnie w momencie, gdy lista zakupów jest najbardziej potrzebna, aplikacja
przestaje reagować: nie widać pozycji albo zmiana statusu wisi/nie zapisuje się. Użytkownik traci
zaufanie do listy i wraca do kartki. Chcemy, żeby wejście do sklepu bez sieci **nie przerywało** pracy
z listą, a po odzyskaniu zasięgu wszystko samo się zsynchronizowało — bez ręcznego „zapisz".

## 2. Cel i miary sukcesu
- Cel: użytkownik korzysta z list zakupów i modyfikuje pozycje **także bez internetu**, a wprowadzone
  offline zmiany po powrocie sieci **automatycznie trafiają na serwer**, bez utraty danych i bez
  ręcznej akcji.
- Sukces mierzymy:
  - Po utracie sieci lista otwiera się i pokazuje pozycje (dane z ostatniej synchronizacji), a
    przełączenie statusu pozycji następuje **natychmiast** (≤1 s, bez błędu sieci).
  - Zmiany zrobione offline są widoczne jako „oczekujące na synchronizację", a po powrocie sieci
    znikają z kolejki i są zapisane na serwerze — **bez działań użytkownika**.
  - Zero „zgubionych" zaznaczeń: to, co użytkownik zaznaczył offline, jest tym, co widzi po
    synchronizacji (przy braku równoległej edycji na serwerze).

## 3. Historyjki użytkownika
- Jako kupujący w sklepie bez zasięgu chcę **widzieć swoją listę zakupów**, żeby wiedzieć, co mam kupić.
- Jako kupujący offline chcę **odhaczać pozycje** (NEEDED → w koszyku → kupione / brak), żeby śledzić
  postęp zakupów tak samo jak online.
- Jako kupujący offline chcę **dopisać zapomniany produkt** oraz **poprawić ilość/cenę lub usunąć
  pozycję**, żeby lista odzwierciedlała rzeczywistość, nawet gdy przypomnę sobie coś przy półce.
- Jako użytkownik chcę **jasny sygnał, że jestem offline** i że mam **zmiany czekające na wysłanie**,
  żeby nie martwić się, czy praca nie przepadnie.
- Jako użytkownik chcę, żeby po odzyskaniu sieci zmiany **same się wysłały**, żeby nie musieć niczego
  klikać ani pamiętać o synchronizacji.
- Jako użytkownik, który jeszcze przed sklepem miał zasięg, chcę mieć **wszystkie aktywne listy**
  dostępne offline, żeby zadziałały nawet gdy sieć padnie dokładnie przy wejściu.

## 4. Kryteria akceptacji (testowalne)
Format Given/When/Then — każde musi dać się zweryfikować w `/verify`.
- [ ] **AC-1** — Given użytkownik otworzył moduł Zakupy z zasięgiem (dane list pobrane), when traci
  połączenie z internetem i otwiera dowolną **aktywną** listę, then widzi jej pozycje (stan z ostatniej
  synchronizacji) zamiast błędu/pustego ekranu.
- [ ] **AC-2** — Given użytkownik jest offline na widoku listy, when przełącza status pozycji
  (NEEDED → IN_CART → DONE / MISSING), then zmiana jest natychmiast widoczna w UI i **nie** pojawia się
  błąd sieci.
- [ ] **AC-3** — Given użytkownik jest offline, when dodaje nową pozycję, edytuje pozycję (nazwa/ilość/
  jednostka/notatka/cena) lub usuwa pozycję, then operacja jest natychmiast widoczna lokalnie i
  **oznaczona jako oczekująca na synchronizację**.
- [ ] **AC-4** — Given użytkownik zrobił zmiany offline, when połączenie wraca, then te zmiany są
  **automatycznie** wysyłane na serwer (bez akcji użytkownika), a po sukcesie znikają z kolejki
  „oczekujących".
- [ ] **AC-5** — Given zmiany zostały zsynchronizowane, when użytkownik odświeży aplikację (online),
  then serwer zwraca stan zgodny z tym, co użytkownik ustawił offline (przy braku równoległej zmiany na
  serwerze).
- [ ] **AC-6** — Given ta sama pozycja została zmieniona offline **oraz** równolegle na serwerze, when
  kolejka się synchronizuje, then obowiązuje reguła **„ostatni zapis wygrywa"** (nowsza zmiana wg czasu
  operacji offline), a synchronizacja kończy się bez zablokowania kolejki (żadna operacja nie „wisi").
- [ ] **AC-7** — Given aplikacja jest offline, when użytkownik patrzy na chrome/UI Zakupów, then widzi
  **czytelny wskaźnik trybu offline** oraz liczbę zmian oczekujących na synchronizację; wskaźnik znika
  po powrocie sieci i wysłaniu kolejki.
- [ ] **AC-8** — Given użytkownik był online w sesji, when przechodzi w tryb offline **bez** wcześniejszego
  otwarcia konkretnej listy, then i tak ma dostęp offline do **wszystkich aktywnych (niezarchiwizowanych)
  list**, bo były zapisane lokalnie w tle.
- [ ] **AC-9** — Given operacja z kolejki nie może się wykonać z powodu trwałego błędu (np. lista/
  pozycja skasowana na serwerze), when trwa synchronizacja, then ta operacja jest pomijana/oznaczana bez
  blokowania pozostałych, a stan kolejki pozostaje spójny (brak nieskończonych ponowień).
- [ ] **AC-10** — Given istniejące zachowanie online, when korzystamy z modułu z zasięgiem, then dotychczasowe
  ścieżki (dodawanie, statusy, „Zakończ zakupy", archiwizacja) działają **bez regresji**.

## 5. Zakres
**W zakresie:**
- Offline **odczyt** aktywnych list zakupów i ich pozycji (dane z ostatniej synchronizacji online).
- Offline **operacje na pozycjach**: zmiana statusu, dodanie, edycja (nazwa/ilość/jednostka/notatka/
  cena), usunięcie — kolejkowane lokalnie i odtwarzane po powrocie sieci.
- **Automatyczna** synchronizacja kolejki po odzyskaniu połączenia (bez ręcznego przycisku „synchronizuj").
- **Wskaźnik** trybu offline + licznik zmian oczekujących na synchronizację.
- Lokalne, w tle utrzymywane **kopie wszystkich aktywnych list** (gdy online), by były gotowe offline.
- Rozwiązywanie kolizji regułą **„ostatni zapis wygrywa"** (wg czasu operacji offline).

**Poza zakresem (świadomie):**
- Offline **operacje na LISTACH** (tworzenie, zmiana nazwy, usunięcie/archiwizacja, „Zakończ zakupy",
  księgowanie do Portfela) — pozostają **online-only**.
- Offline dla **innych modułów** niż Zakupy (Tasks, Notes itd.) — ten feature jest wzorcem do
  ewentualnego rozszerzenia później, ale nie realizujemy tego teraz.
- **Zaawansowane rozwiązywanie konfliktów** (scalanie pól, historia wersji, pytanie użytkownika przy
  kolizji) — świadomie upraszczamy do „ostatni zapis wygrywa".
- Offline konfiguracja słowników (kategorie/jednostki/produkty), mapy sklepów, sortowanie po trasie
  sklepu offline — poza zakresem (offline dotyczy samych list i ich pozycji).
- Współdzielona synchronizacja czasu rzeczywistego między urządzeniami (push/live) — synchronizacja
  jest „przy powrocie sieci / przy odświeżeniu", nie na żywo.

## 6. Wpływ na Omnia
- **Uprawnienie / RBAC:** bez zmian — używamy istniejącego `module.shopping`. Nie powstaje nowy slug
  (C-22 nie wymaga rozszerzenia). Dostęp offline dotyczy wyłącznie danych, do których użytkownik ma już
  prawo (jego listy `ownerId` + listy zespołowe `ownerTeamId`).
- **Własność danych:** bez zmian w modelu współwłasności — offline pracuje na danych list, które
  użytkownik już widzi (user + team, wzorzec `ownerId`/`ownerTeamId`, C-21). Lokalna kopia i kolejka
  są **per użytkownik/urządzenie** i nie zmieniają reguł dostępu po stronie serwera.
- **Asystent AI:** nie dotyczy — feature nie dodaje nowej `AIAction` ani read-toola (asystent działa
  online). Istniejące akcje AI na zakupach pozostają bez zmian.
- **Kalendarz / powiadomienia / trash:** kalendarz — nie dotyczy. Trash — offline usunięcie pozycji ma
  po synchronizacji zachować dotychczasowe zachowanie modułu (spójne z obecnym `deleteItem`), bez
  osobnej „offline'owej" ścieżki trash. Powiadomienia — opcjonalnie subtelny sygnał UI o trybie
  offline/kolejce; nie tworzymy trwałych `Notification`.

## 7. Zgodność z konstytucją
- **C-01/C-02** — całość w `worldofmag/`, importy przez alias `@/*`.
- **C-10..C-13** — jeśli synchronizacja „ostatni zapis wygrywa" wymaga po stronie serwera znacznika
  czasu modyfikacji pozycji, dołożymy to **ręcznym plikiem migracji** (bez enumów Prisma, C-12), z
  unikalnym sekwencyjnym numerem (C-11); nie odpalamy migracji przeciw prod DB (C-13). (Sam mechanizm
  kolejki jest po stronie klienta.)
- **C-20** — wszelkie zapisy na serwer nadal przez **Server Actions z `revalidatePath()`**; kolejka
  offline odtwarza istniejące akcje, nie omija warstwy akcji.
- **C-21/C-22** — brak zmian w RBAC i współwłasności; offline respektuje istniejące guardy dostępu przy
  synchronizacji.
- **C-30..C-32** — wskaźnik offline i oznaczenia „oczekujące" zgodne z ciemnym motywem (zmienne CSS,
  bez hardcode kolorów), mobile-first (to funkcja telefonu w sklepie), teksty po polsku.
- **C-53** — minimalizm: najprostszy działający mechanizm (lokalna kopia + kolejka operacji +
  auto-replay + „ostatni zapis wygrywa"), bez nadmiarowych abstrakcji i bez frameworka sync.
- **C-50/C-52** — „gotowe" = `npm run build` zielony; po skończeniu merge do `develop`.

## 8. Otwarte pytania / decyzje właściciela
Zebrane w jedynym momencie pytań (`/specify`) — wszystkie rozstrzygnięte, opcje rekomendowane wybrane:
- [x] **Zakres operacji offline** → **Statusy + dodawanie/edycja/usuwanie pozycji** (pełny CRUD na
  pozycjach offline; operacje na listach online-only).
- [x] **Które listy dostępne offline** → **Wszystkie aktywne (niezarchiwizowane) listy** zapisywane
  lokalnie w tle, gdy online.
- [x] **Rozwiązywanie konfliktów** → **„Ostatni zapis wygrywa"** wg czasu operacji offline.

Założenia przyjęte domyślnie (bez osobnego pytania, do potwierdzenia furtką C-55 tylko gdyby coś
istotnego wypłynęło w planie):
- Synchronizacja jest **automatyczna przy powrocie sieci** (i przy ponownym otwarciu aplikacji online),
  bez ręcznego przycisku „synchronizuj".
- Zakres offline obejmuje **listy aktywne**; listy zarchiwizowane nie muszą być dostępne offline.

## 9. Ryzyka
- **Rozjazd danych lokalnych vs serwer** (np. inne urządzenie zmienia listę) → ograniczamy regułą
  „ostatni zapis wygrywa" + odświeżenie stanu z serwera po synchronizacji; świadomie akceptujemy prostotę.
- **Kolejka „wisząca" na trwałym błędzie** (pozycja/lista skasowana na serwerze) → operacje z trwałym
  błędem są pomijane/oznaczane, bez blokowania reszty i bez nieskończonych ponowień (AC-9).
- **Rozdźwięk między natychmiastowym UI offline a rzeczywistym stanem serwera** → jasny wskaźnik
  „offline / X oczekujących" (AC-7), by użytkownik rozumiał, że zmiany nie są jeszcze na serwerze.
- **Ograniczenia PWA/przeglądarki na iOS** (Szymon używa iPhone'a; storage/service worker bywają
  kapryśne) → opieramy się na sprawdzonych mechanizmach offline PWA już obecnych w projekcie i degradujemy
  łagodnie (gdy brak wsparcia — zachowanie jak dziś, online-only, bez wywrotki).
- **Regresja ścieżek online** → AC-10 pilnuje, że tryb online działa bez zmian zachowania.
