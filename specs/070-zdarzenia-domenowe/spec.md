# Spec: Zdarzenia domenowe — zapis nierozłączny z mutacją

- **ID:** 070-zdarzenia-domenowe
- **Status:** draft
- **Autor sesji:** Claude Code (spec-driven pipeline)
- **Data:** 2026-08-15
- **Moduł(y):** platforma (nowa zdolność) + pierwsi producenci wyłonieni pomiarem

## 1. Problem / potrzeba

Omnia realizuje **trzy różne rodzaje integracji międzymodułowej jednym mechanizmem** — bezpośrednim
wywołaniem. Rozdz. 9.1 nazywa to błędem, bo rodzaje te mają różne wymagania co do spójności
i obsługi awarii. Reguła rozstrzygająca: *brak odpowiedzi **zatrzymuje** operację → kontrakt;
brak odpowiedzi ją tylko **opóźnia** → zdarzenie*.

Konkret: zakończenie listy zakupów księguje wydatek w Portfelu **w tej samej ścieżce**. Skutki:

1. **Awaria Portfela zabiera zakupy.** Operacja, która miała się tylko opóźnić, zatrzymuje operację
   nadrzędną.
2. **Sprzężenie rośnie z liczbą reakcji.** Każde nowe „gdy tam coś się stanie, zrób coś tutaj"
   dokłada wywołanie do modułu źródłowego, więc musi on **wiedzieć o wszystkich** odbiorcach.

Rozdz. 9.4 odpowiada outboxem: mutacja zapisuje **zdarzenie** w tej samej transakcji, a reakcje
dzieją się osobno. Dziś model zdarzenia nie istnieje.

**Dlaczego teraz.** Wzorzec akcji z rozdz. 10.2 ma pięć kroków; krok trzeci (reguła biznesowa
wyliczająca to, co trafi do zdarzenia) powstał w 069. Ten przebieg dowozi drugą połowę kroku
czwartego: **zapis i zdarzenie w jednej transakcji**.

**Sednem jest jedno zdanie z rozdz. 9.4.2** — zapis zdarzenia poza transakcją to *„najczęstszy błąd
przy wdrażaniu outboxu"*. Groźny nie dlatego, że częsty, tylko dlatego, że **nie daje objawu**: przy
awarii pomiędzy zapisem stanu a zapisem zdarzenia jedno i drugie się rozjeżdża, a jedynym śladem
jest reakcja, która nigdy nie nastąpiła. Nie ma wyjątku, nie ma logu, nie ma czerwonego testu.
Mechanizm, który tego zabrania **komentarzem**, prędzej czy później zostanie użyty źle.

## 2. Cel i miary sukcesu

- **Cel:** trwały dziennik zdarzeń domenowych, którego **nie da się zapisać niespójnie ze stanem**,
  bo emisja jest technicznie niemożliwa poza transakcją mutacji.

- **Sukces mierzymy:**
  1. **Wycofanie transakcji nie zostawia zdarzenia** — to właściwy dowód, nie obecność wiersza po
     udanym zapisie.
  2. Emisja poza transakcją **nie kompiluje się**, a obejście typu **wywala build**.
  3. Mechanizm ma **prawdziwych producentów** (C-35: „gotowe" znaczy wpięte).
  4. Kształt zdarzenia **wystarcza zadaniu 22** bez zmiany modelu — subskrybent może być idempotentny.
  5. **Zero zmian widocznych dla użytkownika**, zero spadku liczników.

## 3. Historyjki użytkownika

Zdarzenia są w tym przebiegu niewidoczne; wypłata przychodzi z zadaniami 22–25.

- Jako **użytkownik** chcę, żeby awaria jednej funkcji nie blokowała drugiej — zakończenie zakupów
  ma się udać także wtedy, gdy księgowanie chwilowo nie działa.
- Jako **użytkownik pracujący wspólnie** chcę wiedzieć, **kto** wykonał zmianę na wspólnym zasobie,
  więc zdarzenie musi nieść sprawcę.
- Jako **rozwijający Omnię** chcę dokładać reakcje **bez dotykania modułu źródłowego**.
- Jako **rozwijający Omnię** chcę mieć pewność, że dziennik nie kłamie: jest zdarzenie ⇔ zmiana
  się dokonała.

## 4. Kryteria akceptacji (testowalne)

- [ ] **AC-1** — Given mutację emitującą zdarzenie, when transakcja zostanie **wycofana**, then
  w bazie **nie ma ani zmiany stanu, ani zdarzenia**.
- [ ] **AC-2** — Given udaną transakcję, then zdarzenie niesie **sprawcę**, **przestrzeń**,
  **moduł**, **rodzaj**, ładunek i jest oznaczone jako **niedostarczone**.
- [ ] **AC-3** — Given próbę emisji **poza** transakcją, when kod jest kompilowany, then
  **nie kompiluje się**. Zakaz wyrażony typem, nie prośbą w komentarzu.
- [ ] **AC-4** — Given próbę obejścia typu (zapis wprost do dziennika), when build, then **pada**.
- [ ] **AC-5** — Given producentów wyłonionych **pomiarem**, then każdy emituje z transakcji,
  a wybór **i odrzucenie pozostałych** są uzasadnione w manifeście.
- [ ] **AC-6** — Given rodzaje zdarzeń, then są **tekstem z unią TS** (C-12), a rodzaj spoza
  rejestru **wywala build**.
- [ ] **AC-7** — Given zasób **bez przestrzeni**, then zachowanie jest **jawne i przetestowane**,
  a mutacja **przez nie nie pada**.
- [ ] **AC-8** — Given każdy niezmiennik bramki osobno, when go złamiemy, then bramka **zgłasza błąd**.
- [ ] **AC-9** — Given testy mechanizmu, when zepsujemy mechanizm, then testy **czerwienieją**.
  Zielony test, którego nie widziano na czerwono, nie jest dowodem (069: pierwsza runda dała
  DO POPRAWY przy **wszystkich 18 bramkach na zielono**).
- [ ] **AC-10** — Given kształt zdarzenia, then niesie **stabilny identyfikator** jako klucz
  idempotencji dla zadania 22 (gwarancja „co najmniej raz", rozdz. 9.4.4).
- [ ] **AC-11** — Given cały przebieg, then **żaden licznik nie spada** (160/553/35/35, zapadki
  263 i 34), testów **przybywa**, build zielony, zero zmian w warstwie widoku.

## 5. Zakres

**W zakresie:** dziennik + migracja · emisja niemożliwa poza transakcją (typ **i** bramka) ·
rejestr rodzajów · pomiar i wpięcie producentów · manifest + bramka + test negatywny każdego
niezmiennika · testy (powodzenie, **wycofanie**, brak przestrzeni) + weryfikacja mutacyjna ·
wpis w dzienniku przebudowy.

**Poza zakresem (świadomie):**
- **Publikacja** (worker, `LISTEN/NOTIFY`, `deliveredAt`) — zadanie 22. Ten przebieg dowozi
  **outbox bez czytelnika** i tak ma być: czytelnik bez spójnego źródła stałby na piasku.
- **SSE** (23), koniec odpytywania w sygnalizatorze świeżości (24), **subskrypcje międzymodułowe**
  (25) — w tym przepięcie księgowania wydatku. Bez publikacji przepięcie oznaczałoby **utratę funkcji**.
- **Retencja** — sensowna, gdy wiadomo, ile zdarzeń przybywa (zadanie 30).
- **Etap 4 zadania 11 i etap 2 zadania 12** — zablokowane warunkiem produkcyjnym.
- **Emisja ze wszystkich mutacji** — zdarzenie ma sens tam, gdzie ktoś zareaguje.

## 6. Wpływ na Omnia

- **RBAC:** brak nowych slugów; dziennik zapisuje system, nie czyta użytkownik. Dostęp sprawdza się
  wcześniej, w akcji, i tam zostaje.
- **Własność danych:** zdarzenie należy do **przestrzeni**, nie do użytkownika ani zespołu — bo tak
  będzie filtrowane przez kanał czasu rzeczywistego (rozdz. 11.1).
- **Asystent AI / kalendarz / trash:** nie dotyczy. Powiadomienia są naturalnym odbiorcą, ale
  przepięcie należy do zadania 25.
- **Widoczność:** **żadna** — wymóg, nie skutek uboczny.
- **Koszt:** jeden `INSERT` w istniejącej transakcji producenta. Świadomie akceptowany.

## 7. Zgodność z konstytucją

**C-10/C-11** (ręczna migracja) · **C-12** (unia TS, nie enum) · **C-13** (lokalna baza) ·
**C-20** (`revalidatePath` bez zmian) · **C-21** (emisja nie sprawdza dostępu) ·
**C-35** (mechanizm razem z producentami) · **C-36** (zdolność platformy; wiedza modułowa
parametrem) · **C-50** (bramka w buildzie) · **C-51** (lekcje) · **C-53** (bez Kafki i RabbitMQ —
rozdz. 9.4.3 wprost).

## 8. Otwarte pytania / decyzje właściciela

Brak — przebieg autonomiczny. Decyzje domyślne:

- **Zakaz typem, nie konwencją.** Emisja przyjmuje klienta transakcyjnego; bramka jest drugą linią,
  bo typ da się obejść.
- **Outbox bez czytelnika to poprawny stan pośredni**, nie połowiczna robota.
- **Zdarzenie należy do przestrzeni.**
- **Brak przestrzeni:** zachowanie ustala plan po pomiarze; wymóg — **jawne, przetestowane**,
  a mutacja **przez nie nie pada** (zdarzenie jest dodatkiem do operacji, nie jej warunkiem).
- **Producenci z pomiaru**, wzorcem 064 (19 → 6) i 069 (55 → 21).

## 9. Ryzyka

- **Mechanizm użyty źle mimo typu** (rzutowanie, zapis wprost) → bramka z manifestem.
- **Test sprawdzający tylko udany zapis niczego nie dowodzi** → AC-1 wymaga wycofania.
- **Test, który niczego nie dowodzi** — potwierdzone w 069 → AC-9 jako warunek zamknięcia.
- **Kształt nie wystarczy zadaniu 22** → AC-10 każe przemyśleć idempotencję teraz, gdy zmiana jest
  darmowa.
- **Rozlanie zakresu na publikację** → jawnie poza zakresem.
- **Dziennik rośnie bez ograniczeń** → zadanie 30; obserwacja w manifeście.
