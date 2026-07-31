# Spec: Pogoda — dopracowanie oraz przekrojowa pamięć treści generowanych przez AI

- **ID:** 038-pogoda-pamiec-tresci-llm
- **Status:** draft
- **Autor sesji:** Claude Code (spec-driven pipeline)
- **Data:** 2026-07-31
- **Moduł(y):** Pogoda (główny) + przekrojowo wszystkie moduły generujące treść przez LLM

> **Zasada speca:** opisujemy **CO i DLACZEGO**, nigdy **JAK**.

## 1. Problem / potrzeba

Moduł Pogoda po ostatniej rozbudowie działa, ale codzienne użycie obnażyło siedem rzeczy: sekcja
**„Co robić?" potrafi uparcie zwracać „Brak propozycji"** (właściciel próbował ponad pięć razy),
**ikony pogody pokazują słońce o drugiej w nocy**, na telefonie **tytuły obserwatorów są ściśnięte w
jedną linię**, a **pełnoekranowy arkusz szczegółów wchodzi pod zegar i kamerkę**. Brakuje też
podstawowej informacji pogodowej — **wschodu i zachodu słońca oraz fazy księżyca**. Do tego w kaflu
„Co robić?" stoją **dwa przyciski, które oba wyglądają na ponowną generację**, a lista propozycji
**generuje się od nowa przy każdym wejściu** na stronę.

Ten ostatni punkt jest objawem czegoś większego i to jest **właściwy ciężar tego przebiegu**: w całej
aplikacji treść wygenerowana przez model **znika po odświeżeniu strony i powstaje na nowo**, choć
użytkownik o to nie prosił. Płaci więc za to samo wielokrotnie i nie może wrócić do tego, co przed
chwilą czytał. Właściciel chce jednej, wspólnej zasady: **treść wygenerowana raz jest pamiętana, a
nowa powstaje wyłącznie na wyraźne kliknięcie** — i chce tego wszędzie, nie tylko w Pogodzie.

## 2. Cel i miary sukcesu

- **Cel:** Pogoda przestaje zawodzić w codziennym użyciu (propozycje faktycznie się pojawiają, ikony i
  dane odpowiadają porze doby, mobile jest czytelny), a cała aplikacja zyskuje **jedną wspólną
  mechanikę pamiętania treści AI**: raz wygenerowane wraca za darmo, nowe powstaje tylko na żądanie.
- **Sukces mierzymy:**
  - Wejście na `/pogoda`, opuszczenie strony i powrót tego samego dnia przy tych samych parametrach
    **nie tworzy żadnego nowego wywołania modelu** — lista propozycji wraca z pamięci.
  - Zmiana dnia albo pory dnia na parametry, dla których treść już istnieje, też **nie kosztuje**.
  - Sekcja „Co robić?" zwraca listę propozycji dla każdej pory doby, łącznie z nocnymi — a gdy model
    naprawdę nic nie zwróci, użytkownik widzi **powód**, nie samo „brak".
  - W kaflu „Co robić?" jest **dokładnie jeden** przycisk, którego działaniem jest wygenerowanie
    nowych propozycji, i jego nazwa mówi wprost, co zrobi.
  - Ikona pogody dla godziny nocnej różni się od ikony dla tej samej pogody w dzień.
  - Na telefonie tytuł obserwatora nie jest ucięty ani ściśnięty, a nagłówek pełnoekranowego arkusza
    jest w całości widoczny pod zegarem i kamerką.
  - Propozycję da się zapisać **bez** generowania jej opisu; opis powstaje dopiero przy pierwszym
    wejściu w szczegóły.

## 3. Historyjki użytkownika

- Jako użytkownik chcę **zobaczyć propozycje zamiast „Brak propozycji"** — bo pięć prób z rzędu bez
  wyniku znaczy dla mnie tyle, że funkcja nie działa.
- Jako użytkownik chcę, żeby przy nieudanej próbie aplikacja **powiedziała mi, co poszło nie tak**,
  zamiast udawać, że po prostu nie ma pomysłów.
- Jako użytkownik chcę, żeby **wracając na stronę widzieć to, co już wygenerowano**, a nie czekać na
  nową listę i płacić za nią drugi raz.
- Jako użytkownik chcę **jednego, jasno nazwanego przycisku** do wygenerowania nowych propozycji —
  dwa podobne przyciski obok siebie każą mi zgadywać.
- Jako użytkownik chcę **zapisać ciekawy pomysł jednym dotknięciem**, nie czekając na wygenerowanie
  całego planu, którego może nigdy nie przeczytam.
- Jako użytkownik chcę **wiedzieć, o której wschodzi i zachodzi słońce oraz jaka jest faza księżyca**,
  bo to decyduje, czy zdążę wrócić przed zmrokiem.
- Jako użytkownik chcę, żeby **ikona nocnej godziny wyglądała na nocną** — słońce o 2:00 podważa moje
  zaufanie do całej prognozy.
- Jako użytkownik telefonu chcę **przeczytać tytuł obserwatora w całości** i **zobaczyć nagłówek
  arkusza szczegółów**, którego dziś zasłania pasek systemowy.
- Jako właściciel systemu chcę, żeby **żaden moduł nie generował treści na nowo bez mojego
  kliknięcia** — płacę za każde wywołanie modelu.

## 4. Kryteria akceptacji (testowalne)

**Naprawa „Brak propozycji" (zgłoszenie 11)**
- [ ] **AC-1** — Given lokalizacja i dowolna pora doby (łącznie z nocną), when otwieram „Co robić?",
      then dostaję listę propozycji; propozycje domowe i nocne są dopuszczalną odpowiedzią, pusta
      lista nie jest.
- [ ] **AC-2** — Given model zwrócił odpowiedź, której nie da się odczytać (ucięta, niepoprawny
      format), when kończy się próba, then użytkownik widzi **komunikat o niepowodzeniu** z
      możliwością ponowienia — a **nie** komunikat „Brak propozycji na tę porę".
- [ ] **AC-3** — Given wybrana pora dnia już minęła (np. „Rano" oglądane wieczorem), when generuję
      propozycje, then dostaję propozycje dla tej pory w wybranym dniu, a nie pustą listę.

**Pamięć treści AI (zgłoszenia 8 i 9, przekrojowo)**
- [ ] **AC-4** — Given wygenerowałem listę propozycji dla danej lokalizacji, dnia i pory, when
      opuszczam stronę i wracam na nią (także po ponownym uruchomieniu aplikacji, na innym urządzeniu
      tego samego konta), then widzę **tę samą listę** i **nie powstaje żadne nowe wywołanie modelu**.
- [ ] **AC-5** — Given zapisana lista propozycji, when zmieniam dzień lub porę na taką, dla której
      treść już istnieje, then również wraca z pamięci, bez kosztu.
- [ ] **AC-6** — Given zapisana lista propozycji, when zmieniły się warunki, na podstawie których
      powstała (inna lokalizacja albo istotnie inna prognoza dla tego dnia i pory), then aplikacja
      **oznacza treść jako nieaktualną** i proponuje odświeżenie — ale **nie generuje jej sama**.
- [ ] **AC-7** — Given kafel „Co robić?", when patrzę na jego nagłówek, then jest tam **dokładnie
      jeden** przycisk generujący nowe propozycje, z nazwą mówiącą wprost, co zrobi; wejście do
      biblioteki pomysłów jest wyraźnie odróżnialne od generowania.
- [ ] **AC-8** — Given dowolna treść generowana przez AI objęta tą mechaniką w innym module, when
      wracam na jej ekran, then widzę zapamiętaną treść wraz z informacją, kiedy powstała, i mogę ją
      odświeżyć jednym kliknięciem.
- [ ] **AC-9** — Given deweloper dodaje nowe miejsce generujące treść do czytania, when uruchamia
      build, then bramka jakości wskazuje brak wpięcia pamięci treści (analogicznie do istniejącej
      bramki licznika kosztów).

**Leniwe generowanie i zapis pomysłu (zgłoszenie 9)**
- [ ] **AC-10** — Given lista propozycji, when zapisuję propozycję z poziomu listy, then trafia do
      biblioteki **bez generowania jej opisu** i **bez kosztu**.
- [ ] **AC-11** — Given zapisana propozycja bez opisu, when po raz pierwszy wchodzę w jej szczegóły,
      then opis powstaje wtedy i zostaje zapisany na stałe.
- [ ] **AC-12** — Given zapisana propozycja bez opisu, when jej opis powstaje później (nawet po
      wielu dniach), then jest generowany na podstawie **warunków zapamiętanych w chwili
      zaproponowania** (lokalizacja, dzień, pora, prognoza), a nie przypadkowych warunków bieżących —
      a użytkownik widzi, jakiego momentu dotyczy plan.

**Wschód/zachód słońca i faza księżyca (zgłoszenie 5)**
- [ ] **AC-13** — Given sekcja bieżącej pogody, when patrzę na nią, then widzę **godzinę wschodu i
      zachodu słońca** dla wybranej lokalizacji i dnia oraz **fazę księżyca** z czytelną polską nazwą.
- [ ] **AC-14** — Given te informacje, when korzystam z telefonu, then mieszczą się w układzie bez
      przewijania w poziomie i bez ściskania pozostałych danych.

**Ikony dnia i nocy (zgłoszenie 6)**
- [ ] **AC-15** — Given godzina po zachodzie i przed wschodem słońca, when patrzę na pasek „Najbliższe
      godziny", then ikona dla tej godziny jest **nocna** (księżyc/gwiazdy zamiast słońca), przy
      zachowaniu rozróżnienia zachmurzenia i opadów.
- [ ] **AC-16** — Given bieżące warunki po zmroku, when patrzę na sekcję „Teraz", then jej ikona
      również jest nocna.

**Mobile (zgłoszenia 4 i 7)**
- [ ] **AC-17** — Given telefon, when patrzę na kafelek obserwatora pogody, then tytuł, status i
      horyzont czasowy są czytelne (zawijają się lub układają w wiersze), a żaden z nich nie jest
      ucięty; cele dotykowe spełniają minimum z konstytucji.
- [ ] **AC-18** — Given telefon z wcięciem na kamerkę / paskiem stanu, when otwieram pełnoekranowy
      arkusz szczegółów propozycji, then jego nagłówek („Wróć do listy", tytuł) jest **w całości
      widoczny** poniżej paska systemowego.
- [ ] **AC-19** — Given strona biblioteki pomysłów, when ją oglądam, then jej układ, nagłówek i
      odstępy są spójne z pozostałymi podstronami aplikacji (jak `/portfel/budzety`), także na
      telefonie.

## 5. Zakres

**W zakresie:**
- Naprawa pustych propozycji w „Co robić?" wraz z **rozróżnieniem braku wyniku od niepowodzenia**.
- **Przekrojowa pamięć treści generowanych przez AI**: zapis wygenerowanej treści wraz z warunkami, w
  jakich powstała; ponowne pokazanie bez kosztu; oznaczenie nieaktualności; regeneracja wyłącznie na
  jawne kliknięcie. Mechanizm ma być **wielokrotnego użytku** i zostać wpięty w miejsca, gdzie AI
  tworzy **treść do czytania** (Pogoda, wnioski Magazynu i Petów, plan tygodnia Kuchni, podsumowania).
- **Bramka jakości** pilnująca, że nowe takie miejsca nie ominą pamięci treści.
- **Leniwe generowanie opisu propozycji** + zapis pomysłu z poziomu listy bez kosztu, z zachowaniem
  warunków potrzebnych do późniejszego wygenerowania opisu.
- Ujednolicenie przycisków w kaflu „Co robić?".
- **Wschód/zachód słońca i faza księżyca** w sekcji bieżącej pogody.
- **Ikony dnia i nocy** w sekcji „Teraz" i w pasku godzinowym.
- Poprawki mobilne: kafelek obserwatora, górny margines bezpieczny arkusza szczegółów, spójność
  stylistyczna strony biblioteki pomysłów.

**Poza zakresem (świadomie, do następnego przebiegu — decyzja właściciela):**
- **Cały moduł Wiadomości** — zgłoszenia (1) sens przycisku „Wszystkie", (2) lektor z synchronizacją
  tekstu i dźwięku, (3) brak wiadomości po długim generowaniu, (12) przebudowa pobierania (pobieranie
  przyrostowe od ostatniego razu, linia czasu tematu z datami z treści, tanie oznaczanie przynależności
  do tematów, generowanie opisów gorących tematów dopiero na ich widoku, blokowanie gorących tematów z
  listą do przywrócenia, przeniesienie przycisku „Odśwież", przebudowa UX). **Żadne z tych zgłoszeń nie
  jest porzucone** — mają własny przebieg, a decyzja o przycisku „Wszystkie" jest już zapisana w §8.
- **Baza wiedzy o użytkowniku** (zgłoszenie 10) — pełny mechanizm profilu użytkownika, uczącego się z
  decyzji, z kartami hipotez do potwierdzenia i panelem administratora. W tym przebiegu propozycje
  pogodowe korzystają z tego, co **już istnieje** (zapisane i zablokowane pomysły użytkownika oraz
  stałe preferencje z ustawień asystenta); pełna baza wiedzy podepnie się w miejsce tego wejścia.
- Ostrzeżenia i powiadomienia push o zmianie pogody.
- Zmiana dostawcy danych pogodowych.

## 6. Wpływ na Omnia

- **Uprawnienie / RBAC:** bez nowych slugów. Pogoda zostaje pod `module.weather`, pozostałe wpięcia
  pamięci treści działają w obrębie uprawnień swoich modułów. Ewentualny podgląd diagnostyczny —
  `module.admin`.
- **Własność danych:** zapamiętana treść AI jest **prywatna dla użytkownika**, tak jak dotychczasowe
  dane Pogody (`ownerId`, bez współwłasności zespołowej) — por. C-21.
- **Asystent AI:** bez nowych akcji zapisujących. Nowe akcje odczytu/mutacji muszą zostać
  sklasyfikowane w manifeście pokrycia AI (C-23 i bramka `check:ai-coverage`).
- **Kalendarz / powiadomienia / trash:** kalendarz i powiadomienia — nie dotyczy. Trash — zapamiętana
  treść AI jest odtwarzalna (można ją wygenerować ponownie), więc **nie** wchodzi do kosza; usunięcie
  pomysłu z biblioteki działa jak dotąd.
- **Koszty AI:** każde nowe miejsce generujące treść nadal pokazuje wskaźnik kosztu (mechanizm z 037).
  Pamięć treści **obniża** liczbę wywołań, więc oba mechanizmy grają w tę samą stronę.

## 7. Zgodność z konstytucją

- **C-01 / C-02** — praca wyłącznie w `worldofmag/`, importy przez alias.
- **C-10 / C-11 / C-12** — pamięć treści AI i warunki generowania propozycji wymagają zmian schematu →
  **ręczne pliki migracji** z kolejnym wolnym numerem; wszystkie rodzaje/stany jako `String` + union
  TypeScript, **nigdy** enum Prisma.
- **C-13** — weryfikacja lokalnie do kroku `next build` na lokalnym Postgresie; zero operacji na
  produkcyjnej bazie.
- **C-20** — mutacje jako Server Actions z `revalidatePath()`.
- **C-21** — własność `ownerId` zgodnie ze wzorcem modułu Pogoda.
- **C-24** — kosz nie dotyczy zapamiętanej treści AI (jest odtwarzalna) — decyzja odnotowana w §6.
- **C-30** — ikony nocne i nowe elementy (wschód/zachód, faza księżyca) wyłącznie na zmiennych CSS.
- **C-31** — sedno trzech zgłoszeń: mobile-first. Kafelek obserwatora, arkusz szczegółów
  (`env(safe-area-inset-top)` **i** `-bottom`), cele dotykowe, brak przewijania w poziomie.
- **C-32** — wszystkie teksty i nazwy faz księżyca po polsku.
- **C-40** — routing modeli nadal wyłącznie przez konfigurację w bazie, bez nazw modeli w kodzie.
- **C-50 / C-51** — „gotowe" = zielony build z nową bramką; każdy naprawiony błąd → wpis do
  `doświadczenia.md`.
- **C-53** — minimalizm: **jeden** mechanizm pamięci treści dla całej aplikacji zamiast rozwiązania
  osobno w każdym module; wschód/zachód pobieramy z danych, które dostawca **już zwraca**; ikony dnia i
  nocy rozszerzają istniejące mapowanie kodów pogody, nie tworzą drugiego.
- **C-54 / C-55** — pytania zadane jednorazowo (§8); dalsze etapy trzymają spójność artefaktów.

## 8. Otwarte pytania / decyzje właściciela

Pytania zadano jednorazowo na etapie `/specify`; właściciel wybrał wariant zalecany w każdym.

- [x] **Zakres przebiegu** → **Pogoda + przekrojowa pamięć treści LLM.** Zgłoszenia Wiadomości
      (1, 2, 3, 12) i baza wiedzy o użytkowniku (10) idą do następnego przebiegu jako jawnie wypisane
      „poza zakresem" (§5). Powód: naprawa „dwóch przycisków" i leniwego generowania **wymaga**
      mechanizmu pamięci treści, więc te rzeczy muszą powstać razem.
- [x] **Baza wiedzy o użytkowniku** → **ucząca się z decyzji + karty hipotez do potwierdzenia jednym
      dotknięciem**, z wglądem i edycją dla administratora. Realizacja w następnym przebiegu; ten
      przebieg przygotowuje miejsce, w które ta wiedza się wepnie.
- [x] **Zasięg „regeneracja tylko na wyraźną akcję"** → **tylko treści prezentowane użytkownikowi**
      (propozycje i plany, wnioski, plany tygodnia, podsumowania). Narzędzia działające na żądanie
      (podpowiedz tagi, sparsuj tekst, wyszukaj) zostają bez zmian — tam kliknięcie **już jest**
      wyraźną akcją, a pamięć zwracałaby nieaktualny wynik dla zmienionego wejścia.
- [x] **Przycisk „Wszystkie" w Wiadomościach** → **zostaje jako czytelny filtr źródła** z jawną
      etykietą i licznikiem źródeł. Decyzja zapisana teraz, wykonanie w przebiegu Wiadomości.

**Założenia przyjęte samodzielnie** (wzorzec sąsiednich modułów, C-53):
- Zapamiętana treść AI jest **prywatna dla użytkownika**; brak współwłasności zespołowej.
- „Nieaktualność" treści rozstrzygamy **porównaniem warunków**, w jakich powstała, z bieżącymi — bez
  wygasania po czasie. Prognoza na ten sam dzień i porę bywa korygowana, więc sam upływ godzin nie
  jest powodem do generowania od nowa; istotna zmiana prognozy jest.
- Zapamiętaną treść trzymamy **bez limitu czasu**, ale odtwarzalną — jeśli kiedykolwiek zajdzie
  potrzeba sprzątania, usunięcie wpisu jest bezpieczne (najwyżej powstanie na nowo na żądanie).
- Faza księżyca liczona **rachunkiem astronomicznym z daty**, bez dokładania zewnętrznej usługi.

## 9. Ryzyka

- **Przyczyna pustych propozycji może być inna niż zakładam** → zanim naprawię, muszę **odtworzyć
  awarię** i wskazać przyczynę dowodem, a nie domysłem. Silny podejrzany: nieodróżnialność „model nic
  nie zwrócił" od „nie dało się odczytać odpowiedzi" — obie ścieżki kończą się dziś tym samym pustym
  ekranem, więc użytkownik nie ma jak zgłosić, co się właściwie stało.
- **Pamięć treści może pokazywać nieaktualne informacje** → stąd jawne oznaczanie nieaktualności i
  data powstania przy każdej zapamiętanej treści; użytkownik zawsze wie, na czym patrzy.
- **Zbyt agresywne uznawanie treści za nieaktualną** zniweczyłoby oszczędność → próg oparty na
  istotnej zmianie prognozy, nie na dowolnej różnicy o jedną dziesiątą stopnia.
- **Szeroki zasięg zmiany** (kilka modułów) → jeden wspólny mechanizm i bramka w buildzie, tak jak
  przy liczniku kosztów w 037; zadania rozbite per moduł.
- **Rozjazd między zapisanym pomysłem a warunkami jego powstania** (AC-12) → warunki zapisujemy razem
  z pomysłem w chwili zaproponowania, a nie odtwarzamy ich później z bieżącej prognozy.
- **Faza księżyca policzona źle** daje cichy, wiarygodnie wyglądający błąd → obliczenie musi mieć test
  na znanych datach (nów, pełnia), a nie tylko „wygląda sensownie".
