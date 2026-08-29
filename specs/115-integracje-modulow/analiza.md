# Analiza integracji międzymodułowych Omnia

- **ID przebiegu:** 115-integracje-modulow · **Data:** 2026-08-29 · **Autor:** Claude Code
- **Zlecenie właściciela:** przeanalizować **każdy moduł z każdym innym**, wskazać wszystkie
  rozsądne integracje (mniej potrzebne jako opcjonalne), spisać na końcu **listę zleceń
  z pełnymi informacjami** — a następnie zrealizować wszystkie zlecenia.

---

## 1. Metoda i zasady oceny

### 1.1 Co uznajemy za „integrację"

Integracja to sytuacja, w której dane albo działanie JEDNEGO modułu stają się użyteczne
w DRUGIM bez ręcznego przepisywania. W Omnii występuje w czterech kształtach, o różnym koszcie
i różnym ryzyku:

1. **Jawna operacja użytkownika** (przycisk „wyślij do…") — najtańsza i najbezpieczniejsza:
   nic nie dzieje się bez decyzji człowieka, więc nie potrzebuje przełącznika. Przykład
   istniejący: zbiór Roślin → spiżarnia Kuchni.
2. **Wkład do huba** — moduł deklaruje swoje dane wspólnej powierzchni (kalendarz, pulpit,
   asystent, powiadomienia, kosz, udostępnianie). Jeden wkład daje integrację z KAŻDYM
   czytelnikiem huba naraz — to jest powód, dla którego macierz 24×24 nie oznacza 276 mostów
   punkt-punkt.
3. **Automat** (coś dzieje się samo: auto-księgowanie, uzupełnianie listy zakupów z min-stock) —
   najwyższa wartość przy dobrym dopasowaniu, ale i jedyny kształt, który potrafi HAŁASOWAĆ.
   Dlatego automaty są opt-in albo wyłączalne, zawsze w ustawieniach modułu ŹRÓDŁOWEGO.
4. **Wspólny odczyt** (moduł czyta cudze dane przez kontrakt, np. Rośliny czytają prognozę
   Pogody do reguły podlewania) — niewidoczny dla użytkownika, ale to on czyni moduły „mądrymi".

### 1.2 Kryteria „rozsądności" (kiedy integracja dostaje zlecenie)

- **Dane już istnieją po obu stronach.** Most, który wymaga najpierw zbudowania nowej ewidencji
  (np. stan karmy dla zwierząt), nie jest integracją, tylko nowym feature'em — odkładamy.
- **Usuwana jest realna ręczna praca** (przepisywanie kwoty, nazwiska, tytułu) albo realna
  ślepota (dane są, ale niewidoczne tam, gdzie zapada decyzja).
- **Nie powstaje drugie źródło prawdy.** Odrzucamy wszystko, co kopiuje dane na stałe
  (drugi magazyn, druga księgowość) — lekcja zapisana już przy Roślinach (113).
- **Minimalizm (C-53):** jeden przycisk / jedno pole / jeden wkład — nie podsystem.

### 1.3 Statusy w macierzy

- ✔ **istnieje** — integracja już działa (wskazujemy którędy),
- ➕ **zlecenie** — rozsądna i wykonalna teraz → trafia do rozdziału 6 (Z-INT-NN),
- ◐ **odłożona** — rozsądna, ale wymaga decyzji właściciela / nowych danych / dużego nakładu →
  rozdział 5 z uzasadnieniem,
- — **brak sensu** — para bez naturalnego przepływu danych; łączy je co najwyżej hub
  (i to wystarcza). Zawsze z jednym zdaniem uzasadnienia.

### 1.4 Zasada hubów (dlaczego większość par NIE dostaje mostu bezpośredniego)

Siedem powierzchni wspólnych już dziś realizuje integrację „każdy z każdym":

| Hub | Co daje każdej parze |
|---|---|
| **Kalendarz** | wszystkie terminy w jednej siatce (11 wkładów po przebiegu 114) |
| **Pulpit (Home)** | migawka stanu wszystkich modułów w jednym miejscu |
| **Asystent AI** | odczyt 18 modułów + akcje zapisu między modułami jednym poleceniem |
| **Powiadomienia** | dzwonek zbiera przypomnienia wszystkich modułów |
| **Kosz** | jednolite przywracanie usuniętych bytów |
| **Udostępnianie** | jeden model nadań dla zasobów różnych modułów |
| **Raporty** | asystent zapisuje analizy przekrojowe jako dokumenty |

Kiedy w macierzy piszemy „— (hub: kalendarz/asystent)", to NIE jest wykręt — to stwierdzenie,
że właściwa integracja tej pary już istnieje na poziomie platformy i most bezpośredni niczego
by nie dodał poza kodem do utrzymania.

---

## 2. Stan istniejący (zmierzony, nie deklarowany)

Graf realnych zależności = importy kontraktów (`@/modules/<x>/contract`) między modułami:

```
kitchen  ──────► shopping      (przepis → lista, spiżarnia → lista, kategoryzacja)
magazynowanie ─► shopping      (uzupełnienie min-stock → lista)
shopping ──────► magazynowanie (powiązanie pozycji z magazynem)
rosliny  ──────► shopping | kitchen | portfel | tasks | weather
                               (nasiona → lista, zbiór → spiżarnia, koszt → wydatek,
                                „do zadań", prognoza → reguła podlewania)
flota    ──────► portfel       (auto-księgowanie tankowań/serwisów)
services ──────► portfel       (płatności/faktury)
weather  ──────► tasks         (pomysł „co robić" → zadanie)
habits   ──────► tasks         (zadanie z nawyku)
```

Huby: kalendarz (11 wkładów), pulpit (11 wkładów), asystent (18 modułów odczytu, akcje zapisu),
powiadomienia, kosz (8 modułów), udostępnianie (5 deklaracji), fakty o użytkowniku
(Pogoda/Wiadomości → `UserFact` → prompty wszystkich generacji AI).

Wniosek z pomiaru: **Portfel i Zakupy są już naturalnymi „zlewniami"** (odpowiednio pieniądze
i rzeczy do kupienia), Zadania stają się trzecią (działania). Analiza niżej świadomie wzmacnia
te trzy zlewnie zamiast wymyślać nowe kierunki.

---

## 3. Skorowidz nowych integracji

| Zlecenie | Para / pary | Kształt | Opcjonalność |
|---|---|---|---|
| Z-INT-01 | Kalendarz → Zadania (pokrywa 10+ par X→Zadania) | jawna operacja | zawsze dostępna |
| Z-INT-02 | Zdrowie → Portfel | jawna operacja (+ nowe pole kosztu) | przycisk |
| Z-INT-03 | Zwierzęta → Portfel | jawna operacja | przycisk |
| Z-INT-04 | Warsztaty → Zakupy | jawna operacja (agenda braków) | przycisk |
| Z-INT-05 | Warsztaty → Portfel | jawna operacja (+ pole kosztu projektu) | przycisk |
| Z-INT-06 | Usługi → Kontakty | jawna operacja | przycisk |
| Z-INT-07 | Zdrowie/Zwierzęta → Kontakty | jawna operacja | przycisk |
| Z-INT-08 | Kontakty → Zadania | jawna operacja | przycisk |
| Z-INT-09 | Notatki → Zadania | jawna operacja | przycisk |
| Z-INT-10 | Czat → Zadania | jawna operacja | akcja przy wiadomości |
| Z-INT-11 | Wiadomości → Notatki | jawna operacja | przycisk |
| Z-INT-12 | YouTube → Notatki | jawna operacja | przycisk |
| Z-INT-13 | YouTube → Języki | operacja AI na żądanie | przycisk + przegląd wyników |
| Z-INT-14 | Truck → Flota → Portfel | wspólny odczyt + jawne księgowanie | wybór pojazdu |
| Z-INT-15 | Pogoda → Kalendarz | automat (odczyt) | wyłączalne w ustawieniach Pogody |
| Z-INT-16 | Zakupy → Kuchnia (spiżarnia) | automat opt-in | domyślnie WYŁĄCZONE |
| Z-INT-17 | Nawyki/Warsztaty/Kontakty/Pogoda → Pulpit | wkłady huba | personalizacja pulpitu |
| Z-INT-18 | Rośliny → Magazynowanie | jawna operacja (Pro) | tylko przy wyborze pozycji |
| Z-INT-19 | publikacja analizy jako raport systemowy | dokument | — |

---

## 4. Analiza par — moduł po module

Porządek kanoniczny: Zakupy, Zadania, Notatki, Kuchnia, Zwierzęta, Rośliny, Zdrowie, Nawyki,
Flota, Portfel, Języki, Wiadomości, Pogoda, Magazynowanie, Warsztaty, Usługi, Kontakty, Czat,
YouTube, Truck, Kalendarz, Pulpit, Raporty, QA. **Każda para omawiana jest raz — w sekcji
wcześniejszego modułu z tej listy.** Sekcja modułu zawiera przemyślenia o parach ciekawych
oraz listę rozstrzygnięć dla WSZYSTKICH pozostałych par.

### 4.1 Zakupy (shopping)

Zakupy to zlewnia „rzeczy do kupienia" — najlepiej zintegrowany moduł aplikacji: przyjmują
wpisy z Kuchni (przepis, spiżarnia), Magazynowania (min-stock) i Roślin (nasiona), a oddają
koszty do Portfela („Zakończ zakupy"). Przemyślenie kierunkowe: Zakupy nie powinny WIEDZIEĆ,
skąd przychodzi pozycja — i nie wiedzą (wpis przez kontrakt `assertListAccess`+add). Każdy
nowy moduł z potrzebą „trzeba to kupić" ma gotowe wejście; w tym przebiegu korzystają z niego
Warsztaty (Z-INT-04).

Najciekawsza NOWA para to **Zakupy → Kuchnia (spiżarnia)**. Dziś strzałka biegnie tylko
w drugą stronę (spiżarnia → lista, gdy czegoś brakuje). Ale koniec zakupów to moment,
w którym fizyczna spiżarnia się ZAPEŁNIA — a jej cyfrowy obraz nie. Ręczne przepisanie
dziesięciu kupionych produktów do spiżarni jest dokładnie tą pracą, którą integracje mają
eliminować. Ryzyko: nie każda pozycja z listy jest żywnością (żarówki, chemia) i nie każdy
użytkownik prowadzi spiżarnię — automat domyślnie włączony byłby hałasem. Stąd kształt:
**opt-in przy „Zakończ zakupy"** (checkbox, zapamiętywany), pozycje trafiają do spiżarni
z ilością i jednostką z listy → **Z-INT-16**.

Rozstrzygnięcia pozostałych par:

- Zakupy↔Zadania — **—** „kup X" to pozycja listy, nie zadanie; dublowanie bytów szkodzi
  (asystent i tak zamienia jedno na drugie na życzenie).
- Zakupy↔Notatki — **—** brak naturalnego przepływu; notatka „co kupić" to anty-wzorzec wobec listy.
- Zakupy↔Kuchnia — ✔ (przepis→lista, spiżarnia→lista) + ➕ Z-INT-16 (lista→spiżarnia).
- Zakupy↔Zwierzęta — **—** karma/akcesoria to zwykłe pozycje listy; Zwierzęta nie prowadzą
  stanów zapasów, więc nie mają czego automatycznie zamawiać (patrz 5: „stan karmy" = nowy
  feature, nie most).
- Zakupy↔Rośliny — ✔ (nasiona/środki → lista przez kontrakt).
- Zakupy↔Zdrowie — **—** leki kupuje się z recepty, nie z listy zakupów spożywczych; moduł
  Zdrowie ma własną ewidencję leków (dawkowanie), a „kup lek" załatwia zwykła pozycja listy.
- Zakupy↔Nawyki — **—** brak wspólnych danych.
- Zakupy↔Flota — **—** paliwo/płyny księguje Flota bezpośrednio; lista zakupów nic nie wnosi.
- Zakupy↔Portfel — ✔ („Zakończ zakupy" z opcjonalnym księgowaniem).
- Zakupy↔Języki/Wiadomości/Pogoda — **—** brak przepływu danych (hub: asystent).
- Zakupy↔Magazynowanie — ✔ (min-stock → lista; powiązanie pozycji).
- Zakupy↔Warsztaty — ➕ Z-INT-04 (braki materiałów → lista; omówione w 4.15).
- Zakupy↔Usługi/Kontakty/Czat/YouTube/Truck — **—** brak naturalnego przepływu (hub: asystent).
- Zakupy↔Kalendarz/Pulpit — ✔ pulpit pokazuje migawkę zakupów; kalendarz nie ma tu terminów.
- Zakupy↔Raporty/QA — **—** (huby narzędziowe).

### 4.2 Zadania (tasks)

Zadania to zlewnia DZIAŁAŃ. Przemyślenie kierunkowe: prawie każdy moduł ma momenty, w których
jego byt wymaga czynności z terminem („przygotuj się do badania", „oddzwoń do klienta",
„dokończ notatkę"). Budowanie po jednym moście z każdego modułu do Zadań dałoby tuzin prawie
identycznych przycisków — dokładnie ta obserwacja prowadzi do najważniejszego zlecenia tego
przebiegu: **„Do zadań" z pozycji WSPÓLNEGO KALENDARZA** (Z-INT-01). Kalendarz już agreguje
terminy jedenastu modułów; jedna akcja na pozycji agendy zamienia dowolny termin dowolnego
modułu w zadanie (z terminem i odnośnikiem do źródła) — jeden mechanizm zamiast jedenastu.

Obok huba zostają trzy mosty bezpośrednie, bo ich źródła NIE są pozycjami kalendarza:
- **Notatki → Zadania** (Z-INT-09): notatka to często ustalenie, z którego ma wyniknąć
  czynność; przycisk w edytorze tworzy zadanie z tytułem notatki i odnośnikiem zwrotnym.
- **Czat → Zadania** (Z-INT-10): „kupisz jutro bilety?" pada w rozmowie domowników; akcja
  przy wiadomości robi z niej zadanie, zanim zginie w wątku.
- **Kontakty → Zadania** (Z-INT-08): lekki CRM potrzebuje follow-upów („odezwij się do X") —
  to najtańsza namiastka historii interakcji wskazanej w przeglądzie 114.

Rozstrzygnięcia pozostałych par (Zadania × moduły dalsze w porządku):

- Zadania↔Notatki — ➕ Z-INT-09 (wyżej).
- Zadania↔Kuchnia — **—** gotowanie planuje plan posiłków (własny byt z datą i kalendarzem);
  „ugotuj obiad" jako zadanie dublowałoby wpis planu. Hub Z-INT-01 i tak to umożliwi z agendy.
- Zadania↔Zwierzęta/Rośliny/Zdrowie/Flota/Warsztaty — **— bezpośrednio / ➕ przez Z-INT-01**:
  wszystkie te moduły mają WŁASNE harmonogramy (opieka, przeglądy, wizyty) widoczne
  w kalendarzu; przycisk huba pokrywa każdą z tych par jednym mechanizmem.
- Zadania↔Nawyki — ✔ (zadanie z nawyku istnieje).
- Zadania↔Portfel — **—** zadanie nie ma kwoty; „zapłać rachunek" to zadanie ręczne, a cykliczne
  płatności to domena Portfela (budżety) — dublowanie bytów odrzucone.
- Zadania↔Języki — **—** powtórki planuje SRS (algorytm), nie lista zadań; kalendarz już
  pokazuje powtórki, hub Z-INT-01 wystarczy na wyjątki.
- Zadania↔Wiadomości — **—** „przeczytaj później" lepiej realizuje zapis artykułu do Notatek
  (Z-INT-11) niż zadanie bez treści.
- Zadania↔Pogoda — ✔ (pomysł → zadanie istnieje).
- Zadania↔Magazynowanie — **—** magazyn działa dokumentami i stanami, nie czynnościami;
  jedyna czynność („zamów braki") ma już własny mechanizm zamówień.
- Zadania↔Usługi — **—** zlecenie u wykonawcy ma własny workflow statusów z terminami
  w kalendarzu; równoległe zadanie = drugi stan tej samej rzeczy.
- Zadania↔Czat — ➕ Z-INT-10 (wyżej).
- Zadania↔YouTube — **—** „obejrzyj później" to dokładnie zapisany film w module YouTube.
- Zadania↔Truck — **—** trasa to obliczenie, nie zobowiązanie.
- Zadania↔Kalendarz — ➕ Z-INT-01 (hub, wyżej); ✔ terminy zadań już zasilają kalendarz.
- Zadania↔Pulpit — ✔ (sekcja zadań na pulpicie istnieje).
- Zadania↔Raporty/QA — **—** (narzędziowe; eksport listy do Claude Code już istnieje).

### 4.3 Notatki (notes)

Notatki to pamięć zewnętrzna użytkownika — a pamięć integruje się przez DOPŁYW treści
z modułów, które treść wytwarzają. Dwa naturalne dopływy w tym przebiegu:
**Wiadomości → Notatki** (Z-INT-11: artykuł ze streszczeniem i adresem — baza wiedzy zamiast
ulotnych newsów) i **YouTube → Notatki** (Z-INT-12: podsumowanie filmu — moduł już płaci za
transkrypcję i streszczenie, a wynik ginie w liście filmów). Odpływ: **Notatki → Zadania**
(Z-INT-09, omówione w 4.2).

Przemyślenie o granicy: kuszące jest „taguj notatki kontaktami/roślinami/przepisami" —
uniwersalny system odnośników. Odrzucamy świadomie: Notatki mają już wikilinki `[[Tytuł]]`
działające wewnątrz modułu, a uniwersalne linkowanie bytów między modułami to zmiana
platformowa (byłby to ósmy hub), nie para modułów — za duża na to zlecenie, zapisana w 5.

- Notatki↔Kuchnia — **—** przepis JEST ustrukturyzowaną notatką; import przepisu z tekstu
  istnieje w Kuchni (parsery), więc most „notatka→przepis" dublowałby import.
- Notatki↔Zwierzęta/Rośliny — **—** oba moduły mają WŁASNE dzienniki przy bycie (to była
  świadoma decyzja 113); notatka ogólna nie ma czego tu zasilać.
- Notatki↔Zdrowie/Nawyki/Flota/Portfel/Magazynowanie/Warsztaty/Usługi/Truck — **—** brak
  naturalnego przepływu treści; hub: asystent (poproszony, zrobi notatkę z czegokolwiek).
- Notatki↔Języki — ◐ „fiszki z notatki" (rozdz. 5) — mechanizm identyczny z Z-INT-13, ale
  notatki są przeważnie po polsku; wartość niepewna, odkładamy do potwierdzenia potrzeby.
- Notatki↔Wiadomości — ➕ Z-INT-11 (wyżej).
- Notatki↔Pogoda — **—** brak przepływu.
- Notatki↔Kontakty — **—** kontakt ma własne pole notatek; pełna „historia interakcji" to
  feature CRM (tracker), nie most do modułu Notatek.
- Notatki↔Czat — **—** wiadomość wartą utrwalenia lepiej zamienić na zadanie (Z-INT-10);
  kopiowanie rozmów do notatek tworzy drugą skrzynkę.
- Notatki↔YouTube — ➕ Z-INT-12 (wyżej).
- Notatki↔Kalendarz — **—** notatka nie ma terminu (celowo; „notatka z datą" = zadanie).
- Notatki↔Pulpit — ✔ (sekcja notatek istnieje).
- Notatki↔Raporty — **—** raport to dokument systemowy/AI; notatka to prywatna treść —
  rozdzielenie celowe.
- Notatki↔QA — **—**.

### 4.4 Kuchnia (kitchen)

Kuchnia jest już centralnie zintegrowana (Zakupy w obie strony po Z-INT-16, Rośliny → spiżarnia,
kalendarz, pulpit, asystent). Przemyślenia o brakujących parach:

**Kuchnia↔Zdrowie** to intelektualnie najciekawsza para całej macierzy: przepisy mają wartości
odżywcze per porcja, plan posiłków mówi, co jem — złożenie daje dzienny bilans kaloryczny,
który moduł Zdrowie mógłby zestawiać z wynikami badań i wagą. To jednak nie „most", tylko
nowa funkcja zdrowotna (cele żywieniowe, braki danych w połowie przepisów, interpretacja) —
dokładnie przypadek z kryterium 1.2 „dane muszą istnieć po obu stronach". **◐ odłożone**
z opisem w rozdziale 5, żeby decyzja właściciela zapadła świadomie, nie przy okazji.

**Kuchnia↔Magazynowanie**: dwa magazyny w jednej aplikacji wyglądają na oczywisty most
(„przenieś między spiżarnią a magazynem"). Odrzucamy z tego samego powodu, dla którego Rośliny
nie zbudowały drugiego magazynu: spiżarnia to celowo UPROSZCZONY stan żywności (nazwa, ilość,
termin), magazyn to pełna ewidencja (SKU, partie, FEFO, dokumenty). Transfer między nimi
wymagałby mapowania tożsamości produktów — czyli trzeciego słownika. Żywność w trybie Pro
można od początku prowadzić w Magazynie; mieszanie obu światów tworzy dwuźródłowość. **—**
z tym uzasadnieniem (w 5 tylko wzmianka, bo to decyzja architektoniczna, nie brak czasu).

- Kuchnia↔Zwierzęta — **—** karma nie jest posiłkiem domowników; brak przepływu.
- Kuchnia↔Rośliny — ✔ (zbiór → spiżarnia).
- Kuchnia↔Nawyki — **—** „gotuj 3×/tydz." to nawyk jak każdy inny; danych wspólnych brak.
- Kuchnia↔Flota/Języki/Usługi/Kontakty/Czat/YouTube/Truck/QA — **—** brak przepływu (hub: asystent).
- Kuchnia↔Portfel — ✔ koszt posiłków liczony (getMealPlanCost), zakupy księgowane przez Zakupy;
  osobny most dublowałby księgowanie tej samej złotówki.
- Kuchnia↔Wiadomości — **—**.
- Kuchnia↔Pogoda — **—** „na upał chłodnik" to zadanie dla generatora AI (już umie), nie most.
- Kuchnia↔Warsztaty — **—**.
- Kuchnia↔Kalendarz/Pulpit — ✔ (plan posiłków w obu).
- Kuchnia↔Raporty — **—**.

### 4.5 Zwierzęta (pets)

Moduł kompletny wewnętrznie (opieka, hodowla, kalendarz, pulpit, eksport wet.), ale finansowo
ŚLEPY: wizyty weterynaryjne mają pole kosztu, sprzedaże mają cenę — i żadna złotówka nie
trafia do Portfela. To czysta luka zlewni: **Z-INT-03** (księgowanie kosztu wizyty jako
wydatek i ceny sprzedaży jako przychód, idempotentnie po źródle). Hodowca w trybie Pro
dostaje w Portfelu prawdziwy rachunek hodowli bez przepisywania.

Druga para z realnym przepływem: **Zwierzęta → Kontakty**. Weterynarz (`vetName`, `clinic`)
jest wpisywany tekstem przy każdej wizycie — a to przecież kontakt, do którego się dzwoni.
„Zapisz w kontaktach" z wizyty (tag „weterynarz") zasila CRM danymi, które już istnieją →
część **Z-INT-07** (wspólny wzorzec ze Zdrowiem, patrz 4.7).

- Zwierzęta↔Rośliny — **—** dwa światy żywe, zero wspólnych danych (poza urokiem pytania).
- Zwierzęta↔Zdrowie — **—** celowo osobne: Zdrowie = ludzie, Zwierzęta = pupile; wspólna
  dokumentacja mieszałaby RODO-wrażliwe dane ludzi z hodowlą.
- Zwierzęta↔Nawyki — **—** opieka cykliczna ma własny mechanizm (PetCareTask).
- Zwierzęta↔Flota — **—**.
- Zwierzęta↔Portfel — ➕ Z-INT-03 (wyżej).
- Zwierzęta↔Języki/Wiadomości — **—**.
- Zwierzęta↔Pogoda — ◐ pomysł „alarm pogodowy dla terrarium/wybiegu" (mróz → wnieś gady) jest
  sensowny, ale moduł ma już alarmy ŚRODOWISKOWE z odczytów; pogodowe wymagają lokalizacji
  zwierzęcia i reguł per gatunek — rozdział 5.
- Zwierzęta↔Magazynowanie/Warsztaty — **—**.
- Zwierzęta↔Usługi — **—** wizytę u usługodawcy-weterynarza obsługuje marketplace ogólnie;
  specjalny most nie wnosi nic ponad Z-INT-06/07.
- Zwierzęta↔Kontakty — ➕ Z-INT-07 (wyżej).
- Zwierzęta↔Czat/YouTube/Truck — **—**.
- Zwierzęta↔Kalendarz/Pulpit — ✔.
- Zwierzęta↔Raporty — ✔ eksport karty wet. (PDF/CSV) istnieje.
- Zwierzęta↔QA — **—**.

### 4.6 Rośliny (rosliny)

Najmłodszy moduł jest wzorcem integracji wychodzących (Zakupy, Kuchnia, Portfel, Zadania,
Pogoda — wszystko przez kontrakty). Jedyna brakująca para z realnym przepływem:
**Rośliny → Magazynowanie** w trybie profesjonalnym. Ewidencja oprysków wymaga nazwy środka
i numeru zezwolenia — a gospodarstwo prowadzące Magazyn ma te środki NA STANIE. Dziś nazwa
jest przepisywana ręcznie, a stan magazynu nie wie o zużyciu. Most: przy wpisie zabiegu
OPCJONALNY wybór pozycji z Magazynu → nazwa wypełnia się sama, stan schodzi ruchem z opisem
źródła (**Z-INT-18**). Kluczowe ograniczenie kształtu: wybór jest dobrowolny per wpis (rolnik
bez Magazynu niczego nie widzi), a Rośliny nadal NIE prowadzą własnych stanów — dokładnie
w duchu „builds no second warehouse".

- Rośliny↔Zdrowie/Nawyki/Flota — **—** brak przepływu.
- Rośliny↔Portfel/Kuchnia/Zakupy/Pogoda/Zadania — ✔ (istnieją).
- Rośliny↔Języki/Wiadomości — **—**.
- Rośliny↔Magazynowanie — ➕ Z-INT-18 (wyżej).
- Rośliny↔Warsztaty — **—** sprzęt ogrodniczy można prowadzić w Warsztacie jako narzędzia —
  to już działa bez mostu; „przegląd kosiarki" to WorkshopItem.
- Rośliny↔Usługi/Kontakty/Czat/YouTube/Truck — **—**.
- Rośliny↔Kalendarz/Pulpit — ✔ (od 113/114).
- Rośliny↔Raporty — ✔ eksport ewidencji CSV.
- Rośliny↔QA — **—**.

### 4.7 Zdrowie (health)

Dwie luki lustrzane do Zwierząt. Po pierwsze **koszty**: wizyty prywatne i badania kosztują,
a model wizyty nie ma nawet POLA na kwotę — to jedyne zlecenie tego przebiegu, które dodaje
kolumnę danych zdrowotnych (nullable, bez żadnej automatyki): **Z-INT-02** = pole kosztu +
jawne „Zaksięguj w Portfelu" (kategoria „Zdrowie"). Automatu świadomie brak — dane zdrowotne
mają najwyższy rygor prywatności w aplikacji (AI opt-in domyślnie OFF), więc każda złotówka
wychodzi do Portfela wyłącznie ręką użytkownika.

Po drugie **ludzie**: `doctorName` + `facility` przy wizycie to gotowy kontakt („dr Kowalska,
kardiolog, CM Zdrowie"). **Z-INT-07** obejmuje oba moduły jednym wzorcem: „Zapisz
w kontaktach" (tag „lekarz" / „weterynarz"), z rozpoznaniem istniejącego kontaktu po nazwie —
bez duplikatów przy drugiej wizycie.

- Zdrowie↔Nawyki — **—** celowo osobno: leki mają własne odhaczanie z dawkami i porami;
  nawyk „bierz leki" dublowałby ewidencję medyczną gorszym narzędziem.
- Zdrowie↔Flota — **—**.
- Zdrowie↔Portfel — ➕ Z-INT-02 (wyżej).
- Zdrowie↔Języki/Wiadomości — **—**.
- Zdrowie↔Pogoda — **—** (ciśnienie/pogoda to ciekawostka bez danych po stronie Zdrowia).
- Zdrowie↔Magazynowanie — **—** apteczka domowa MOGŁABY być magazynem, ale leki mają już
  własną ewidencję z dawkowaniem; drugi stan = dwuźródłowość.
- Zdrowie↔Warsztaty/Usługi — **—** (wizytę u fizjoterapeuty z marketplace'u obsługują Usługi
  ogólnie).
- Zdrowie↔Kontakty — ➕ Z-INT-07 (wyżej).
- Zdrowie↔Czat/YouTube/Truck — **—**.
- Zdrowie↔Kalendarz/Pulpit — ✔.
- Zdrowie↔Raporty — **—** (trendy badań są w module; dane wrażliwe nie idą do raportów ogólnych).
- Zdrowie↔QA — **—**.

### 4.8 Nawyki (habits)

Po przebiegu 114 moduł ma kalendarz i kosz; z hubów brakuje mu tylko PULPITU — a to akurat
hub, na którym nawyki żyją najlepiej („co mi dziś zostało do odhaczenia" to pytanie poranne).
Wkład do migawki pulpitu → część **Z-INT-17**.

- Nawyki↔Flota/Portfel/Języki/Wiadomości/Pogoda/Magazynowanie/Warsztaty/Usługi/Kontakty/
  Czat/YouTube/Truck — **—** nawyk to prywatny rytm bez danych wspólnych z tymi modułami
  (hub: kalendarz, asystent odhacza głosem).
- Nawyki↔Zadania — ✔; Nawyki↔Kalendarz — ✔ (114); Nawyki↔Pulpit — ➕ Z-INT-17.
- Nawyki↔Raporty/QA — **—**.

### 4.9 Flota (flota)

Flota jest wzorem zlewni Portfela (auto-księgowanie) i dostawcą danych, których nikt dotąd
nie czytał: z tankowań wynika ŚREDNIE SPALANIE i ŚREDNIA CENA litra. Jedyny moduł, który tych
liczb potrzebuje, to **Truck**: wyznacza trasę z dystansem, ale kosztu paliwa nie umie
oszacować. Most odczytowy Flota → Truck + jawne księgowanie szacunku w Portfelu = **Z-INT-14**
(omówiony w 4.20, bo operacja dzieje się w Trucku).

- Flota↔Portfel — ✔; Flota↔Kalendarz/Pulpit — ✔.
- Flota↔Języki/Wiadomości/Magazynowanie/Warsztaty/Usługi/Kontakty/Czat/YouTube — **—**
  (serwis w warsztacie DOMOWYM to ServiceRecord Floty; moduł Warsztaty dotyczy własnej
  pracowni, nie serwisowania aut — rozdzielenie celowe).
- Flota↔Pogoda — **—**.
- Flota↔Truck — ➕ Z-INT-14.
- Flota↔Raporty/QA — **—**.

### 4.10 Portfel (portfel)

Portfel to zlewnia PIENIĘDZY — po tym przebiegu przyjmuje księgowania z ośmiu modułów
(Zakupy, Flota, Usługi, Rośliny + nowe: Zdrowie, Zwierzęta, Warsztaty, Truck). Przemyślenie
kierunkowe: Portfel nadal nie zna ŻADNEGO z tych modułów — wszystkie wchodzą przez jedno
wejście (`bookAutoExpense`, idempotentne po module+źródle). To jest właściwy kształt zlewni
i żadne zlecenie tego nie zmienia.

Rozważona i odłożona para: **Portfel ↔ Magazynowanie** („wartość magazynu jako składnik
majątku"). Kusząca dla trybu Pro (wycena zapasów), ale majątek w Portfelu to dziś elementy
prowadzone ręcznie; automatyczna pozycja o zmiennej wartości wymaga decyzji, jak liczyć
(cena zakupu? FEFO? partie bez ceny?) — rozdział 5.

- Portfel↔Języki/Wiadomości/Pogoda/Kontakty/Czat/YouTube — **—** brak przepływu.
- Portfel↔Magazynowanie — ◐ (wyżej, rozdz. 5).
- Portfel↔Warsztaty — ➕ Z-INT-05 (4.15); Portfel↔Usługi — ✔; Portfel↔Truck — ➕ Z-INT-14 (4.20).
- Portfel↔Kalendarz — ◐ terminy celów oszczędnościowych (deadline) mogłyby zasilać kalendarz —
  zapisane w trackerze (T-31) jeszcze przed tym przebiegiem; zostaje tam, żeby nie dublować
  zleceń między dokumentami.
- Portfel↔Pulpit — ✔; Portfel↔Raporty — ✔ (raporty miesięczne w module); Portfel↔QA — **—**.

### 4.11 Języki (languages)

Moduł samotnik — SRS, TTS, własny rytm. Jedyny naturalny DOPŁYW treści w aplikacji to
transkrypcje YouTube: użytkownik ogląda materiał w uczonym języku, moduł YouTube ma pełny
tekst — a przepisywanie słówek do talii jest ręczną robotą par excellence. **Z-INT-13**:
operacja AI na żądanie „Fiszki z filmu" (istniejący ekstraktor słownictwa nad transkrypcją,
wybór talii, przegląd propozycji przed dodaniem, licznik kosztu). Wiadomości odpadają jako
źródło (treści polskie — uzasadnienie przy 4.3/4.12).

- Języki↔Wiadomości/Pogoda/Magazynowanie/Warsztaty/Usługi/Kontakty/Czat/Truck — **—**.
- Języki↔YouTube — ➕ Z-INT-13.
- Języki↔Kalendarz/Pulpit — ✔ (powtórki w obu).
- Języki↔Raporty/QA — **—**.

### 4.12 Wiadomości (news)

Moduł czyta świat i STRESZCZA go za pieniądze (LLM) — a streszczenia żyją 24h w strumieniu.
Jedyny rozsądny most to utrwalenie: **artykuł → Notatka** (Z-INT-11, omówione w 4.3).
Wiadomości zasilają też fakty o użytkowniku (✔ hub `UserFact`).

- Wiadomości↔Pogoda/Magazynowanie/Warsztaty/Usługi/Kontakty/Czat/YouTube/Truck — **—**.
- Wiadomości↔Kalendarz — **—** newsy nie mają terminów użytkownika.
- Wiadomości↔Pulpit — ◐ sekcja „nagłówki dnia" na pulpicie jest rozsądna, ale pulpit ma już
  briefing AI, który wiadomości STRESZCZA — druga sekcja z tym samym źródłem to hałas;
  odłożone do decyzji przy przebudowie pulpitu.
- Wiadomości↔Raporty/QA — **—**.

### 4.13 Pogoda (weather)

Pogoda jest dostawcą KONTEKSTU (prognoza) — najlepiej integruje się przez odczyt cudzy
(Rośliny ✔) i przez huby. Nowy most odczytowy: **prognoza w siatce wspólnego kalendarza**
(Z-INT-15). Uzasadnienie: kalendarz to miejsce PLANOWANIA, a plany zderzają się z pogodą;
ikona+temperatura przy najbliższych dniach to informacja bez jednego kliknięcia. Kształt:
czysty odczyt (bez LLM), domyślna lokalizacja użytkownika, wyłączalne w ustawieniach Pogody
(automat = musi być wyłączalny, zasada 1.1).

- Pogoda↔Magazynowanie/Warsztaty/Usługi/Kontakty/Czat/YouTube — **—**.
- Pogoda↔Truck — ◐ „pogoda na trasie" (opady na odcinkach) to realna wartość dla kierowcy,
  ale wymaga prognozy dla POLILINII trasy (wiele punktów × godziny przejazdu) — nakład
  nieproporcjonalny do eksperymentalnego statusu Trucka; rozdział 5.
- Pogoda↔Kalendarz — ➕ Z-INT-15; Pogoda↔Zadania — ✔; Pogoda↔Pulpit — ➕ Z-INT-17 (dzisiejsza
  pogoda w migawce — pulpit dziś jej nie ma).
- Pogoda↔Raporty/QA — **—**.

### 4.14 Magazynowanie (magazynowanie)

Zlewnia RZECZY z pełną ewidencją. Integracje ma wzorcowe (Zakupy w obie strony, pulpit,
asystent); nowa para przychodzi z zewnątrz: Rośliny-Pro pobierają środki ochrony ze stanu
(Z-INT-18, omówione w 4.6). Odłożone: majątek w Portfelu (4.10), transfer ze spiżarnią (4.4).

- Magazynowanie↔Warsztaty — **—** ŚWIADOMIE OSOBNE stany: Warsztat prowadzi wyposażenie
  i materiały WARSZTATOWE z własnym min-stock (uzupełnianym przez Z-INT-04 do Zakupów),
  Magazyn — zapasy ogólne z dokumentami. Wspólny stan wymagałby scalenia dwóch modeli
  pozycji — dwuźródłowość albo wielka migracja; obie drogi odrzucone (1.2).
- Magazynowanie↔Usługi/Kontakty/Czat/YouTube/Truck — **—** (dostawcy magazynu to osobny byt
  biznesowy z dokumentami — nie CRM prywatny; scalanie odłożone, rozdz. 5).
- Magazynowanie↔Kalendarz — ◐ terminy ważności partii (FEFO) w kalendarzu — zapisane już
  w trackerze T-31 przed tym przebiegiem; zostaje tam.
- Magazynowanie↔Pulpit — ✔; Magazynowanie↔Raporty — ✔ (analityka w module); ↔QA — **—**.

### 4.15 Warsztaty (warsztaty)

Moduł z trzema lukami zlewni naraz — wszystkie trzy dostają zlecenia:

1. **Braki materiałów → Zakupy** (Z-INT-04). Warsztat zna progi min-stock i liczy braki
   w agendzie przeglądów, ale jedyne, co użytkownik może z tym zrobić, to przepisać listę
   ręcznie. Wzorzec istnieje w Magazynie (uzupełnienie → lista) — przenosimy go 1:1: przycisk
   w agendzie braków dodaje pozycje (ilość do progu) na wskazaną listę.
2. **Koszt projektu → Portfel** (Z-INT-05). Projekty warsztatowe (Pro) pochłaniają materiały
   i usługi; pole kosztu na projekcie + jawne księgowanie domyka rachunek hobby/pracowni.
3. **Pulpit** (część Z-INT-17): najbliższe przeglądy i braki w migawce dnia — zapytanie
   agendy już istnieje, brakowało tylko wkładu.

- Warsztaty↔Usługi — **—** zlecenie klienta na usługę warsztatową to marketplace (Usługi);
  projekt warsztatowy to wewnętrzna robota — celowo osobne byty.
- Warsztaty↔Kontakty/Czat/YouTube/Truck — **—**.
- Warsztaty↔Kalendarz — ✔ (114); ↔Pulpit — ➕ Z-INT-17; ↔Raporty/QA — **—**.

### 4.16 Usługi (services)

Marketplace ma komplet integracji „twardych" (płatności → Portfel ✔, terminy → kalendarz ✔).
Luka jest MIĘKKA: wykonawca, z którym współpraca się udała, powinien zostać w prywatnym CRM
użytkownika — z telefonem, mailem i tagiem „wykonawca" — zamiast żyć wyłącznie jako profil
w marketplace (który może zniknąć). **Z-INT-06**: „Zapisz w kontaktach" z profilu wykonawcy
i z wątku zlecenia; rozpoznanie po nazwie chroni przed duplikatem.

- Usługi↔Kontakty — ➕ Z-INT-06 (wyżej).
- Usługi↔Czat — **—** czat marketplace'u (klient↔wykonawca) i czat domowników to dwa różne
  kanały o różnych rolach dostępu; scalenie mieszałoby obcych z rodziną.
- Usługi↔YouTube/Truck — **—**.
- Usługi↔Kalendarz/Pulpit — ✔/— (pulpit nie potrzebuje sekcji marketplace — zlecenia mają
  powiadomienia); ↔Raporty/QA — **—**.

### 4.17 Kontakty (contacts)

Po 114 (urodziny → kalendarz, kosz) Kontakty stają się zlewnią LUDZI: przyjmują wykonawców
(Z-INT-06), lekarzy i weterynarzy (Z-INT-07), a oddają follow-upy do Zadań (Z-INT-08)
i urodziny do kalendarza (✔) oraz na pulpit (Z-INT-17 — najbliższe urodziny w migawce).
Przemyślenie kierunkowe: CRM prywatny rośnie z DANYCH UBOCZNYCH innych modułów — nikt nie
siada „uzupełnić CRM", ale każdy chce mieć telefon do sprawdzonego hydraulika.

- Kontakty↔Czat — **—** czat łączy KONTA domowników; kontakt to osoba spoza systemu.
  Mapowanie kontakt↔konto (po e-mailu) to ciekawostka bez operacji, którą by odblokowała.
- Kontakty↔YouTube/Truck — **—**.
- Kontakty↔Kalendarz — ✔ (urodziny, 114); ↔Pulpit — ➕ Z-INT-17; ↔Raporty/QA — **—**.

### 4.18 Czat (czat)

Komunikator domowników. Jedyny naturalny odpływ: ustalenia → Zadania (Z-INT-10, omówione
w 4.2). Wszystko inne załatwia asystent (który w czacie i tak bywa wołany).

- Czat↔YouTube/Truck — **—**; ↔Kalendarz — **—** (wiadomości nie mają terminów);
  ↔Pulpit — ✔ (nieprzeczytane w migawce — istnieje); ↔Raporty/QA — **—**.

### 4.19 YouTube (youtube)

Moduł płaci za transkrypcje i streszczenia — a wyniki są dziś ślepą uliczką. Dwa odpływy
naprawiają rachunek wartości: podsumowanie → Notatki (Z-INT-12, patrz 4.3) i słownictwo →
Języki (Z-INT-13, patrz 4.11).

- YouTube↔Truck — **—**; ↔Kalendarz — **—**; ↔Pulpit — ◐ „ostatnio zapisane filmy" to
  kandydat na sekcję, ale pulpit już jest długi — odłożone do przebudowy pulpitu (razem
  z 4.12); ↔Raporty/QA — **—**.

### 4.20 Truck (truck)

Eksperymentalny kalkulator tras nabiera sensu, gdy przestaje być samotny: **Z-INT-14** łączy
go z Flotą (średnie spalanie i średnia cena litra z historii tankowań wybranego pojazdu)
i Portfelem (jawne zaksięgowanie szacunku kosztu trasy). Przemyślenie: to jedyna para, gdzie
integracja PODNOSI status modułu — z ciekawostki do narzędzia planowania kosztów przejazdu.

- Truck↔Kalendarz/Pulpit — **—** (trasa nie ma terminu ani stanu dziennego);
- Truck↔Raporty/QA — **—**.

### 4.21–4.24 Huby: Kalendarz, Pulpit (Home), Raporty, QA

**Kalendarz** — po tym przebiegu: 11 wkładów ✔, akcja „Do zadań" na pozycji (Z-INT-01),
pasek prognozy (Z-INT-15). Pary Kalendarz↔moduł nie wymagają osobnych rozstrzygnięć — kalendarz
Z DEFINICJI integruje przez wkłady; brakujące wkłady (Portfel-cele, Magazyn-FEFO) są
w trackerze T-31.

**Pulpit** — hub migawek; Z-INT-17 domyka cztery brakujące wkłady (Nawyki, Warsztaty,
Kontakty, Pogoda). Odłożone sekcje Wiadomości/YouTube — rozdz. 5.

**Raporty** — hub dokumentów: asystent już zapisuje analizy; ta analiza również trafi do
raportów (Z-INT-19). Pary Raporty↔moduł = „—", bo raport nie jest partnerem wymiany danych,
tylko ich ujściem.

**QA** — narzędzie wewnętrzne (scenariusze testowe); wszystkie pary „—". Jedyna „integracja"
to pokrycie scenariuszami funkcji innych modułów — czyli praca redakcyjna, nie most.

---

## 5. Integracje wskazane, ale ODŁOŻONE (z powodami)

| # | Para | Co by dawała | Dlaczego nie teraz |
|---|---|---|---|
| O-1 | Kuchnia ↔ Zdrowie | dzienny bilans kaloryczny z planu posiłków vs cele/waga | to nowa funkcja zdrowotna (cele, interpretacja, braki danych w przepisach), nie most; wymaga decyzji właściciela o zakresie |
| O-2 | Portfel ↔ Magazynowanie | wartość zapasów jako składnik majątku | brak rozstrzygnięcia metody wyceny (cena zakupu/partie); majątek dziś ręczny |
| O-3 | Notatki → Języki | fiszki z treści notatki | mechanizm = Z-INT-13, ale notatki są po polsku; najpierw sprawdzić realny popyt |
| O-4 | Pogoda → Truck | prognoza wzdłuż trasy | wymaga prognoz dla polilinii (N punktów × godziny) — nakład ≫ status modułu |
| O-5 | Zwierzęta ← Pogoda | alarmy pogodowe dla wybiegów/terrariów zewn. | wymaga lokalizacji zwierzęcia i reguł per gatunek; alarmy środowiskowe już istnieją |
| O-6 | Wiadomości/YouTube → Pulpit | sekcje „nagłówki dnia"/„ostatnie filmy" | pulpit już długi, briefing AI streszcza wiadomości; wraca przy przebudowie pulpitu |
| O-7 | Magazyn ↔ Kontakty | dostawca jako kontakt | dostawca to byt biznesowy z dokumentami; scalenie z CRM prywatnym wymaga przemyślenia ról |
| O-8 | Linkowanie bytów między modułami (uniwersalne `[[...]]`) | odnośniki notatka↔kontakt↔roślina… | to ósmy hub platformowy, nie para; osobny, duży przebieg |
| O-9 | Gmail / Google Calendar (zewnętrzne) | dwustronna synchronizacja | czeka na zgody/klucze właściciela — tracker T-15 |
| O-10 | Kuchnia ↔ Magazynowanie | transfer spiżarnia↔magazyn | odrzucone architektonicznie (dwuźródłowość) — wraca tylko, gdyby właściciel chciał prowadzić żywność w Magazynie w całości |

Pozycje O-1…O-10 NIE są zleceniami tego przebiegu — każda wróci osobną decyzją. Terminy
Portfel-cele i Magazyn-FEFO w kalendarzu pozostają w trackerze T-31 (żeby jedno zlecenie nie
żyło w dwóch dokumentach).

---

## 6. LISTA ZLECEŃ (wiążący zakres realizacji)

Każde zlecenie: cel · uzasadnienie (skrót z rozdz. 4) · moduły · operacje · opcjonalność ·
priorytet · kryteria akceptacji (uzupełniają AC ze spec.md). **Realizowane są WSZYSTKIE.**

### Z-INT-01 — Kalendarz → Zadania: „Do zadań" z pozycji agendy
- **Cel:** dowolna pozycja wspólnego kalendarza zamienia się jednym działaniem w zadanie.
- **Uzasadnienie:** jeden mechanizm huba zamiast tuzina bliźniaczych przycisków per moduł (4.2).
- **Moduły:** Kalendarz (UI) → Zadania (kontrakt `createTask`).
- **Operacje:** akcja przy pozycji dnia; zadanie dostaje tytuł pozycji, termin = data pozycji,
  opis z etykietą modułu i odnośnikiem `href` pozycji; komunikat potwierdzenia.
- **Opcjonalność:** jawna operacja — bez przełącznika.
- **Priorytet:** P1.
- **AC:** z pozycji „Przegląd: Golf (Warsztat)" powstaje zadanie z terminem tego dnia
  i linkiem do warsztatu; działa dla pozycji każdego modułu-wkładu.

### Z-INT-02 — Zdrowie → Portfel: koszt wizyty/badania
- **Cel:** koszt wizyty ląduje w Portfelu bez przepisywania.
- **Uzasadnienie:** 4.7; jedyna nowa kolumna wśród danych zdrowotnych, nullable, zero automatyki.
- **Moduły:** Zdrowie → Portfel (kontrakt `bookAutoExpense`).
- **Operacje:** pole „Koszt" przy wizycie (formularz+szczegół); przycisk „Zaksięguj w Portfelu"
  (kategoria „Zdrowie", data wizyty, `force` — jawna decyzja); idempotencja po źródle
  (moduł+id wizyty) → drugie kliknięcie koryguje kwotę.
- **Opcjonalność:** przycisk (nigdy automat — dane wrażliwe).
- **Priorytet:** P1.
- **AC:** AC-2 ze spec.md.

### Z-INT-03 — Zwierzęta → Portfel: koszty wet. i przychody ze sprzedaży
- **Cel:** rachunek opieki/hodowli w Portfelu.
- **Uzasadnienie:** 4.5; pola kosztu i ceny już istnieją — brakowało mostu.
- **Moduły:** Zwierzęta → Portfel.
- **Operacje:** „Zaksięguj" przy wizycie wet. z kosztem (wydatek, kategoria „Zwierzęta")
  i przy sprzedaży z ceną (przychód); idempotentnie po źródle.
- **Opcjonalność:** przyciski.
- **Priorytet:** P1.
- **AC:** AC-3.

### Z-INT-04 — Warsztaty → Zakupy: braki materiałów na listę
- **Cel:** braki min-stock trafiają na listę zakupów jednym działaniem.
- **Uzasadnienie:** 4.15; wzorzec uzupełnienia z Magazynu przeniesiony 1:1.
- **Moduły:** Warsztaty → Zakupy (kontrakt list/pozycji).
- **Operacje:** w agendzie braków przycisk „Dodaj braki do zakupów" → wybór listy → pozycje
  z ilością do progu (nazwa + jednostka materiału).
- **Opcjonalność:** przycisk.
- **Priorytet:** P1.
- **AC:** AC-4.

### Z-INT-05 — Warsztaty → Portfel: koszt projektu
- **Cel:** wydatki projektów warsztatowych w Portfelu.
- **Uzasadnienie:** 4.15.
- **Moduły:** Warsztaty → Portfel.
- **Operacje:** pole „Koszt" na projekcie (nullable) + „Zaksięguj w Portfelu" (kategoria
  „Warsztat", idempotentnie po projekcie).
- **Opcjonalność:** przycisk.
- **Priorytet:** P2.
- **AC:** AC-5.

### Z-INT-06 — Usługi → Kontakty: zapis wykonawcy
- **Cel:** sprawdzony wykonawca zostaje w prywatnym CRM.
- **Uzasadnienie:** 4.16.
- **Moduły:** Usługi → Kontakty (kontrakt tworzenia kontaktu).
- **Operacje:** „Zapisz w kontaktach" na publicznym profilu wykonawcy i w wątku zlecenia;
  kontakt: nazwa, telefon/e-mail (jeśli dostępne), firma, tag „wykonawca", notatka z adresem
  profilu; istniejący kontakt o tej nazwie → komunikat zamiast duplikatu.
- **Opcjonalność:** przycisk.
- **Priorytet:** P2.
- **AC:** AC-6 (część usługowa).

### Z-INT-07 — Zdrowie/Zwierzęta → Kontakty: lekarz i weterynarz
- **Cel:** ludzie wpisywani tekstem przy wizytach stają się kontaktami.
- **Uzasadnienie:** 4.5/4.7 — wspólny wzorzec, jedna implementacja, dwa punkty wpięcia.
- **Moduły:** Zdrowie, Zwierzęta → Kontakty.
- **Operacje:** „Zapisz w kontaktach" przy wizycie z lekarzem (nazwa=doctorName, firma=facility,
  tag „lekarz") i wizycie wet. (vetName/clinic, tag „weterynarz"); deduplikacja po nazwie.
- **Opcjonalność:** przyciski.
- **Priorytet:** P2.
- **AC:** AC-6 (części zdrowie/wet.).

### Z-INT-08 — Kontakty → Zadania: follow-up
- **Cel:** „odezwij się do X" jednym działaniem.
- **Uzasadnienie:** 4.2/4.17 — najtańsza namiastka historii interakcji CRM.
- **Moduły:** Kontakty → Zadania.
- **Operacje:** akcja przy kontakcie „Utwórz zadanie" → zadanie „Skontaktuj się: <nazwa>"
  z opisem (telefon/e-mail) i odnośnikiem do kontaktów.
- **Opcjonalność:** przycisk.
- **Priorytet:** P2.
- **AC:** AC-7 (część kontaktowa).

### Z-INT-09 — Notatki → Zadania: „Do zadań" z notatki
- **Cel:** ustalenie z notatki staje się czynnością.
- **Uzasadnienie:** 4.2/4.3.
- **Moduły:** Notatki → Zadania.
- **Operacje:** akcja w widoku notatki → zadanie z tytułem notatki i opisem zawierającym
  odnośnik do niej; komunikat.
- **Opcjonalność:** przycisk.
- **Priorytet:** P1.
- **AC:** AC-7 (część notatkowa).

### Z-INT-10 — Czat → Zadania: zadanie z wiadomości
- **Cel:** ustalenia z rozmów domowników nie giną.
- **Uzasadnienie:** 4.2/4.18.
- **Moduły:** Czat → Zadania.
- **Operacje:** akcja przy wiadomości → zadanie (tytuł = skrót treści, opis = pełna treść +
  autor + odnośnik do rozmowy).
- **Opcjonalność:** akcja przy wiadomości.
- **Priorytet:** P1.
- **AC:** AC-7 (część czatowa).

### Z-INT-11 — Wiadomości → Notatki: zapis artykułu
- **Cel:** opłacone streszczenie artykułu można utrwalić.
- **Uzasadnienie:** 4.3/4.12.
- **Moduły:** Wiadomości → Notatki.
- **Operacje:** „Zapisz jako notatkę" przy artykule → notatka (tytuł artykułu; treść:
  streszczenie/fragment + źródło + adres URL); komunikat z odnośnikiem.
- **Opcjonalność:** przycisk.
- **Priorytet:** P2.
- **AC:** AC-8 (część wiadomości).

### Z-INT-12 — YouTube → Notatki: zapis filmu
- **Cel:** podsumowanie/transkrypt filmu trafia do bazy wiedzy.
- **Uzasadnienie:** 4.3/4.19.
- **Moduły:** YouTube → Notatki.
- **Operacje:** „Zapisz jako notatkę" przy filmie → notatka (tytuł filmu; podsumowanie
  albo skrót transkryptu + kanał + adres filmu).
- **Opcjonalność:** przycisk.
- **Priorytet:** P2.
- **AC:** AC-8 (część youtube).

### Z-INT-13 — YouTube → Języki: fiszki z transkrypcji
- **Cel:** słownictwo z realnych materiałów zasila talie.
- **Uzasadnienie:** 4.11 — jedyny naturalny dopływ treści obcojęzycznej w aplikacji.
- **Moduły:** YouTube → Języki (istniejący ekstraktor słownictwa).
- **Operacje:** „Fiszki z filmu" przy filmie z transkrypcją → wybór talii → ekstrakcja AI
  (na żądanie, typ operacji zgodny z ekstraktorem, licznik kosztu) → lista propozycji
  z odznaczaniem → dodanie zatwierdzonych do talii.
- **Opcjonalność:** operacja na żądanie; model nigdy nie zapisuje sam.
- **Priorytet:** P3.
- **AC:** AC-9.

### Z-INT-14 — Truck → Flota/Portfel: koszt paliwa trasy
- **Cel:** szacunek kosztu przejazdu z realnych danych pojazdu.
- **Uzasadnienie:** 4.9/4.20.
- **Moduły:** Truck ← Flota (odczyt średnich z tankowań) → Portfel (księgowanie).
- **Operacje:** po wyznaczeniu trasy wybór pojazdu z Floty → „szacowany koszt paliwa" =
  dystans × średnie spalanie × średnia cena litra (z historii tankowań; przy braku danych —
  czytelny komunikat zamiast liczby) + „Zaksięguj koszt trasy" (wydatek, kategoria „Transport",
  idempotentnie per trasa/dzień).
- **Opcjonalność:** wybór pojazdu jest dobrowolny; bez wyboru nic się nie liczy.
- **Priorytet:** P2.
- **AC:** AC-10.

### Z-INT-15 — Pogoda → Kalendarz: prognoza w siatce
- **Cel:** planowanie z pogodą przed oczami.
- **Uzasadnienie:** 4.13.
- **Moduły:** Pogoda (kontrakt prognozy) → Kalendarz (UI).
- **Operacje:** ikona + temperatura dnia w komórkach najbliższych ~7 dni (domyślna lokalizacja
  użytkownika); przełącznik w ustawieniach Pogody (domyślnie WŁĄCZONE — czysty odczyt bez
  kosztu AI); bez lokalizacji — nic się nie pokazuje.
- **Opcjonalność:** wyłączalne (automat-odczyt).
- **Priorytet:** P3.
- **AC:** AC-11.

### Z-INT-16 — Zakupy → Kuchnia: kupione do spiżarni
- **Cel:** stan spiżarni nadąża za zakupami.
- **Uzasadnienie:** 4.1.
- **Moduły:** Zakupy → Kuchnia (kontrakt spiżarni).
- **Operacje:** w oknie „Zakończ zakupy" checkbox „Dodaj kupione do spiżarni" (domyślnie
  ODZNACZONY; wybór zapamiętany per użytkownik); po zatwierdzeniu kupione pozycje trafiają
  do spiżarni z ilością/jednostką.
- **Opcjonalność:** automat OPT-IN.
- **Priorytet:** P1.
- **AC:** AC-12.

### Z-INT-17 — Wkłady pulpitu: Nawyki, Warsztaty, Kontakty, Pogoda
- **Cel:** migawka dnia kompletna o cztery brakujące moduły.
- **Uzasadnienie:** 4.8/4.13/4.15/4.17.
- **Moduły:** cztery wkłady → Pulpit (hub).
- **Operacje:** sekcje: nawyki dziś (pozostałe/odhaczone), najbliższe przeglądy i braki
  warsztatowe, najbliższe urodziny (X dni), dzisiejsza pogoda (temp./opis, domyślna
  lokalizacja); wszystkie podlegają personalizacji pulpitu jak istniejące sekcje.
- **Opcjonalność:** personalizacja pulpitu (ukrywanie sekcji) — mechanizm istnieje.
- **Priorytet:** P1.
- **AC:** AC-13.

### Z-INT-18 — Rośliny → Magazynowanie: środek z magazynu w ewidencji (Pro)
- **Cel:** ewidencja oprysków spójna z magazynem, stan schodzi automatycznie.
- **Uzasadnienie:** 4.6/4.14.
- **Moduły:** Rośliny → Magazynowanie (kontrakt: lista pozycji + korekta stanu).
- **Operacje:** w formularzu wpisu zabiegu (przestrzeń Pro) opcjonalny wybór pozycji
  z Magazynu → nazwa środka wypełnia się; po zapisie zdjęcie podanej ilości ze stanu ruchem
  z opisem „ewidencja zabiegu <data>"; bez wyboru — zachowanie jak dziś; niewystarczający
  stan → czytelny błąd, wpis ewidencji i tak powstaje (dokument > stan).
- **Opcjonalność:** tylko przy jawnym wyborze pozycji; wyłącznie tryby profesjonalne.
- **Priorytet:** P3.
- **AC:** AC-14.

### Z-INT-19 — Publikacja analizy
- **Cel:** właściciel czyta tę analizę w aplikacji.
- **Operacje:** raport systemowy w raportach admina (idempotentny seed) z treścią analizy
  (rozdz. 1–6) + aktualizacja dokumentacji projektu (tabela modułów/tracker) po realizacji.
- **Priorytet:** P1 (na końcu przebiegu).
- **AC:** AC-15.

---

### Bilans macierzy

24 moduły = 276 par. Rozstrzygnięcia: **17 ✔ istnieje** (w tym huby per para liczone przez
wkłady), **18 ➕ w 19 zleceniach**, **10 ◐ odłożonych** (rozdz. 5), pozostałe **— brak sensu**
z uzasadnieniem przy module. Żadna para nie została pominięta: każda występuje dokładnie raz
w sekcjach 4.1–4.24 (pary z hubami — zbiorczo w 4.21–4.24, zgodnie z zasadą 1.4).
