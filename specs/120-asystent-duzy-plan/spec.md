# Spec: Asystent dowozi DUŻY plan — koniec cichego ucinania odpowiedzi

- **ID:** 120-asystent-duzy-plan
- **Status:** draft
- **Autor sesji:** Claude Code (spec-driven pipeline)
- **Data:** 2026-09-01
- **Moduł(y):** Asystent AI (pętla agenta, protokół odpowiedzi), Zwierzęta (odbiorca planu)

> **Zasada speca:** opisujemy **CO i DLACZEGO**, nigdy **JAK**. Zero nazw plików, tabel, bibliotek,
> endpointów. Jeśli piszesz o implementacji — to należy do `plan.md`, nie tutaj.

## 1. Problem / potrzeba

Właściciel powtórzył **dokładnie to samo polecenie**, które było przedmiotem przebiegu 112
(„przeczytaj obowiązki psa Raj z projektu zadań i załóż na ich podstawie zwierzę w module
Zwierzęta"), już na wdrożonym kodzie 112 — i **znów nie dostał wyniku**. Zgłoszenie brzmi:
*„Asystent powinien sobie poradzić z takim zadaniem, jakie chce od niego user; przeanalizuj jeszcze,
co należy poprawić, by się udało."*

**112 zadziałało — i to jest ustalone, nie domniemane.** Diagnostyka pokazuje:
- **Odczyt jest naprawiony:** cały projekt z treścią opisów przyszedł w **jednym** wywołaniu
  (`includeDescription`, `limit`), a asystent sam napisał „Zdążyłem pobrać dane z aplikacji
  (1 odczyt)". Poprzednio było 11 odczytów w 6 iteracjach. Spirala zawężania zniknęła.
- **Pamięć podręczna działa dokładnie wg polityki 112:** wywołanie 1 zapisuje blok stały, wywołanie 2
  zapisuje katalog, wywołania 3–6 czytają cały prompt, a wywołanie domykające **nic nie zapisuje**.

Zawiódł **następny krok w łańcuchu**: zbudowanie planu. Siedem wywołań modelu, 65 479 tokenów,
**1,42 zł**, a użytkownik dostał: *„Nie dokończyłem tego zadania… Zablokowało mnie to: zabrakło
kroków na dokończenie odpowiedzi."*

| Wywołanie | Wyjście | Co to znaczy |
|---|---|---|
| 1 (odczyt zadań) | 115 | prawidłowa odpowiedź |
| 2, 3, 4, 5, 6 | **1200 · 1200 · 1200 · 1200 · 1200** | pięć razy **dokładnie** limit — to nie są odpowiedzi, to odcięcia |
| 7 (domknięcie) | **2800** | limit domknięcia, też odcięte; 34 sekundy |

**Przyczyna nie leży w limicie kroków ani w liczbie iteracji — leży w trzech miejscach naraz:**

1. **Budżet wyjścia nie ma związku z tym, co tura ma wyprodukować.** Jest wybierany **przed pętlą**,
   z treści wiadomości użytkownika: wklejona długa lista → duży, prośba o raport → średni, reszta →
   mały. „Duży plan" nie jest żadną z tych kategorii i **z zasady nie da się go rozpoznać po
   wiadomości** — o rozmiarze planu decyduje ilość danych, które asystent **przeczytał**, a nie
   długość prośby. Prośba o psa Raj ma trzy zdania; plan to kilkanaście akcji z polskimi opisami.
2. **Ucięcie jest po cichu zamieniane w błąd protokołu.** Gdy z uciętej odpowiedzi nie zostaje
   użyteczna treść, w jej miejsce podstawiany jest pusty obiekt — a pusty obiekt **parsuje się
   poprawnie**. Skutki są trzy i wszystkie złe: informacja o ucięciu zostaje **skasowana**, strażnik
   „jedna szansa na skrócenie, potem wychodzimy" **nigdy nie wchodzi** (bo siedzi w gałęzi „nie
   udało się sparsować"), a pętla widzi tylko „odpowiedź bez znanego kroku" i **spala kolejną
   iterację** — i tak aż do wyczerpania. Stąd pięć identycznych wywołań i wzrost wejścia o ~38
   tokenów zamiast o ~1200: do rozmowy trafiał pusty obiekt i krótka korekta, nie treść modelu.
3. **Komunikat dla użytkownika mówi nieprawdę.** „Zabrakło kroków na dokończenie odpowiedzi"
   sugeruje, że pomogłoby więcej iteracji. Nie pomogłoby — każda kolejna też zostałaby ucięta.
   Mechanizm opisu przyczyny **ma** osobną gałąź na ucięcie, ale nie mogła zostać użyta, bo punkt (2)
   wcześniej skasował informację o ucięciu.

Do tego **~40 % rachunku tej tury** (siedem tysięcy tokenów wyjścia po najwyższej stawce) poszło na
treść uciętą w połowie i wyrzuconą. Oszczędność, którą przyniosła pamięć podręczna z 112, została
przez to zjedzona.

## 2. Cel i miary sukcesu

- **Cel:** asystent dowozi zadanie, którego wynikiem jest **duży plan** — a gdy naprawdę się nie
  mieści, oddaje część i mówi prawdę o przyczynie, zamiast pięć razy produkować treść do kosza.
- **Sukces mierzymy:**
  - Polecenie „załóż psa na podstawie zadań z projektu Raj" kończy się **planem akcji do
    potwierdzenia** (profil zwierzęcia + zabiegi + wizyty + karta zdrowia), a nie komunikatem
    o niedokończeniu.
  - **Zero** wywołań, których wyjście kończy się dokładnie na limicie i zostaje wyrzucone. Ucięcie
    ma być rozpoznane **przy pierwszym wystąpieniu**.
  - Komunikat o niedokończeniu **nigdy nie podaje „zabrakło kroków", gdy przyczyną było ucięcie**.
  - Koszt tej tury spada wobec zmierzonych **1,42 zł**, mimo większego budżetu wyjścia — bo znika
    sześć odpowiedzi produkowanych do kosza.

## 3. Historyjki użytkownika

- Jako użytkownik chcę jednym poleceniem przenieść obowiązki psa z zadań do modułu Zwierzęta i dostać
  **gotowy plan do zatwierdzenia**, bez dzielenia prośby na kawałki.
- Jako użytkownik chcę, żeby asystent, któremu zabrakło miejsca na odpowiedź, oddał to, co zdążył
  zbudować, i **napisał wprost, czego brakuje** — zamiast podawać przyczynę, która nie jest prawdziwa.
- Jako właściciel chcę, żeby asystent **nie płacił pięć razy za tę samą uciętą odpowiedź**.
- Jako właściciel chcę nadal dostać listę informacji, których **nie da się przenieść** do modułu
  Zwierzęta — to jest część pierwotnej prośby i wciąż nie została spełniona.

## 4. Kryteria akceptacji (testowalne)

**A. Ucięcie jest rozpoznawane i nigdy nie udaje błędu protokołu**

- [ ] **AC-1** — Given odpowiedź modelu ucięta na limicie długości, z której nie zostaje użyteczna
      treść, when pętla ją odbiera, then jest rozpoznana jako **UCIĘCIE**, a nie jako „odpowiedź
      w nieznanym formacie" — w szczególności informacja o ucięciu **nie zostaje skasowana**.
- [ ] **AC-2** — Given kolejne ucięcia w jednym przebiegu, when pętla je odbiera, then przebieg
      kończy się **po pierwszym nieudanym ponowieniu**, a nie po wyczerpaniu wszystkich iteracji.
      Liczba wywołań modelu zmarnowanych na ucięte odpowiedzi jest **ograniczona i mała**.
- [ ] **AC-3** — Given przebieg zakończony z powodu ucięcia, when użytkownik czyta komunikat, then
      przyczyna jest nazwana **zgodnie z prawdą** (odpowiedź nie zmieściła się w limicie długości),
      a **nie** „zabrakło kroków".

**B. Budżet wyjścia dobierany do tego, co tura ma wyprodukować**

- [ ] **AC-4** — Given tura, w której do kontekstu trafiły już dane z odczytu, when asystent buduje
      z nich odpowiedź lub plan, then ma na to **wyraźnie większy budżet** niż zwykłe wywołanie
      rozmowy.
- [ ] **AC-5** — Given zwykła tura konwersacyjna bez odczytu danych, when asystent odpowiada, then
      budżet pozostaje **bez zmian wobec dzisiejszego** — podniesienie dotyczy wyłącznie tur, które
      mają co wypisać.
- [ ] **AC-6** — Given wywołanie domykające przebieg („dokończ z tego, co masz"), when jest
      wykonywane, then ma budżet **co najmniej taki jak wywołania w pętli** — domknięcie nie może
      mieć mniej miejsca niż krok, którego nie starczyło.

**C. Gdy plan i tak się nie mieści**

- [ ] **AC-7** — Given plan, który przekracza dostępny budżet nawet po podniesieniu, when przebieg
      się kończy, then użytkownik dostaje **akcje, które udało się zbudować** (a nie pustą odpowiedź).
- [ ] **AC-8** — Given sytuację jak wyżej, when użytkownik czyta odpowiedź, then jest w niej **wprost
      napisane, że plan jest niepełny** i czego zabrakło — żadna akcja nie znika po cichu.
- [ ] **AC-9** — Given częściowy plan, when trafia do panelu potwierdzenia, then przechodzi
      **tą samą ścieżką** co plan pełny: akcje niszczące pozostają domyślnie odznaczone, nic nie
      wykonuje się bez zatwierdzenia.

**D. Pierwotne zadanie użytkownika (niedomknięte od 112)**

- [ ] **AC-10** — Given projekt zadań z obowiązkami psa, when użytkownik prosi o założenie zwierzęcia
      na ich podstawie, then przebieg kończy się **planem** zawierającym profil zwierzęcia **oraz**
      akcje odwzorowujące obowiązki (zabiegi cykliczne, wizyty, wpisy do karty zdrowia).
- [ ] **AC-11** — Given ten sam przebieg, when użytkownik czyta odpowiedź, then znajduje
      **wyodrębnioną listę informacji, których nie dało się przenieść**, z powodem.
- [ ] **AC-12** — Given ten sam przebieg, when się zakończy, then **żadne zadanie źródłowe nie
      zostaje zmienione ani usunięte**.

**E. Koszt**

- [ ] **AC-13** — Given powtórzenie zmierzonej sesji, when zsumujemy zużycie, then koszt jest
      **niższy niż 1,42 zł**, mimo większego budżetu wyjścia — bo znikają odpowiedzi produkowane
      do kosza.
- [ ] **AC-14** — Given jakąkolwiek zmianę z tego zakresu, when patrzymy na dorobek 112, then
      **jednokrotny odczyt z opisami** i **polityka pamięci podręcznej** działają dalej bez zmian.

## 5. Zakres

**W zakresie:**

- Rozpoznawanie ucięcia także wtedy, gdy z odpowiedzi nie zostaje użyteczna treść (AC-1…AC-3).
- Ograniczenie liczby wywołań marnowanych na ucięte odpowiedzi (AC-2).
- Prawdziwy komunikat o przyczynie niedokończenia (AC-3).
- Budżet wyjścia zależny od etapu tury, nie od treści wiadomości (AC-4…AC-6).
- Oddanie **częściowego planu** z jawną informacją o niekompletności (AC-7…AC-9).
- Domknięcie pierwotnego zadania właściciela (AC-10…AC-12).

**Poza zakresem (świadomie):**

- **Dzielenie planu na zatwierdzane partie** oraz **wykonywanie akcji etapami bez potwierdzenia** —
  właściciel wybrał wariant „jeden plan, budżet dobrany do zadania". Wraca do rozważenia dopiero,
  gdyby okazało się, że realne plany przekraczają nawet podniesiony budżet.
- **Zapowiedź zamiaru przed zbudowaniem planu** („znalazłem 18 obowiązków, przeniosę je jako 14
  akcji — kontynuować?") — świadomie odrzucona: panel potwierdzenia i tak pokazuje wszystkie akcje
  przed wykonaniem, a dodatkowe pytanie kłóci się z prośbą „asystent powinien sobie poradzić".
- **Zmiana modelu, dostawcy ani poziomu pracy asystenta** — routing zostaje w panelu administratora.
- **Zmiany w odczycie danych i w polityce pamięci podręcznej** — to dorobek 112, który działa
  (AC-14 pilnuje, żeby go nie naruszyć).
- **Nowe pola w module Zwierzęta** — profil zwierzęcia został rozszerzony w 112 i wystarcza.

## 6. Wpływ na Omnia

- **Uprawnienie / RBAC:** bez zmian. Istniejące slugi `module.tasks` i `module.pets`; odczyty
  asystenta ograniczone tymi samymi regułami dostępu co aplikacja.
- **Własność danych:** bez zmian — zasób należy do przestrzeni, w której powstaje. Feature nie
  wprowadza nowego nośnika własności.
- **Asystent AI:** to jest rdzeń zmiany — dotyczy protokołu odpowiedzi, pętli agenta i sposobu
  domykania przebiegu. **Nie powstają nowe akcje**, więc katalog akcji i jego bramki pozostają bez
  zmian; plan po prostu **mieści się** tam, gdzie dotąd się nie mieścił.
- **Kalendarz / powiadomienia / trash:** nie dotyczy. Zabiegi i wizyty zakładane przez asystenta
  wpinają się w agendę istniejącymi ścieżkami modułu Zwierzęta; nic nie jest usuwane.

## 7. Zgodność z konstytucją

- **C-53 (minimalizm)** — reguła prowadząca. Trzy objawy mają **jedną wspólną przyczynę** (ucięcie
  udające błąd protokołu) i jedną poboczną (budżet ustalany z góry). Naprawiamy przyczyny; **nie**
  dokładamy dzielenia planu na partie ani nowych stanów w UI.
- **C-40 (routing modeli sterowany z bazy)** — zmieniamy **ile miejsca** dajemy na odpowiedź, nigdy
  nie zaszywając dostawcy, modelu ani poziomu wysiłku.
- **C-32 (teksty przez `t()`, polski jako źródło)** — nowe komunikaty widoczne dla użytkownika idą
  przez warstwę tłumaczeń; treść promptu i komunikaty składane po stronie serwera to protokół, nie
  tekst UI.
- **C-51 (lekcja do `doświadczenia.md`)** — obowiązkowa. Sprawa jest podręcznikowym przykładem
  **wartości domyślnej, która ukrywa błąd**: „jak nie ma treści, weź pusty obiekt" wygląda na
  ostrożność, a wyłącza strażnik i zamienia prawdziwą diagnozę w fałszywą.
- **C-50 / C-13 (definicja „gotowe", nigdy build z prod bazą)** — weryfikacja do kroku `next build`
  na lokalnym Postgresie.
- **C-54 (spójność artefaktów)** — 112 pozostaje w mocy; ten spec go **nie unieważnia**, tylko
  domyka łańcuch o krok dalej. Gdyby implementacja pokazała, że któreś ustalenie stąd jest
  nieprawdziwe, poprawiamy ten spec, a nie obchodzimy sprawę w kodzie.

## 8. Otwarte pytania / decyzje właściciela

Wszystkie rozstrzygnięte w jedynym momencie pytań (C-55) — cztery odpowiedzi rekomendowane:

- [x] **Jak dowieźć duży plan** → *budżet dobierany do zadania*. Jedno wywołanie, jeden kompletny
      plan w panelu potwierdzenia. Bez dzielenia na partie i bez wykonywania etapami.
- [x] **Kiedy podnosić budżet** → *gdy tura zmierza do planu po odczycie danych*. Zwykła rozmowa
      zostaje tania; koszt rośnie tylko tam, gdzie dziś i tak jest marnowany na uciętą treść.
- [x] **Gdy plan się nie zmieści** → *część planu + jasna informacja, czego brakuje*. Coś jest
      zrobione, a komunikat mówi prawdę o przyczynie.
- [x] **Zapowiedź zamiaru przed planem** → *bez dodatkowego pytania*. Panel potwierdzenia zachowuje
      kontrolę, a właściciel prosił, żeby asystent „poradził sobie z takim zadaniem".

**Ustalenie z rekonesansu, zapisane zanim ruszy plan:** mechanizm z punktu (2) w § 1 został
**potwierdzony eksperymentalnie**, nie jest domysłem — pusty obiekt podstawiany za brakującą treść
parsuje się jako poprawna odpowiedź protokołu. To wyjaśnia jednocześnie pięć identycznych wywołań,
wzrost wejścia o ~38 tokenów zamiast ~1200 oraz mylny komunikat o przyczynie. Plan ma to
**odtworzyć testem**, a nie przyjąć na słowo.

## 9. Ryzyka

- **Ryzyko: większy budżet wyjścia podnosi koszt zamiast go obniżyć.** → AC-13 wymaga pomiaru netto
  na tej samej sesji. Bilans jest wyjściowo korzystny: dziś płacimy za **sześć** odpowiedzi do kosza,
  po zmianie płacimy za **jedną**, która trafia do użytkownika.
- **Ryzyko: rezerwacja większego budżetu zbliża nas do limitów przepustowości dostawcy.** →
  Dlatego podnosimy budżet **wybiórczo** (AC-5), a nie dla całej pętli.
- **Ryzyko: częściowy plan wprowadzi użytkownika w błąd, że przeniesiono wszystko.** → AC-8 wymaga
  jawnej informacji o niekompletności, a AC-9 zostawia zatwierdzanie tam, gdzie było.
- **Ryzyko: naprawa rozpoznawania ucięcia zepsuje ścieżkę degradacji formatu**, którą 030 dodało dla
  modeli zwracających prozę zamiast JSON. → Obie ścieżki muszą zostać rozróżnione **testem** —
  „ucięto" i „zły format" to dwa różne problemy i mają prowadzić do dwóch różnych zachowań.
- **Ryzyko: naruszenie dorobku 112 przy okazji.** → AC-14 czyni z tego kryterium akceptacji, a nie
  dobre chęci.
