# Spec: Kontrola nad AI — kiedy generuje, ile kosztuje, co robi bez pytania

- **ID:** 041-kontrola-nad-ai
- **Status:** draft
- **Autor sesji:** Claude Code (spec-driven pipeline)
- **Data:** 2026-08-01
- **Moduł(y):** przekrojowo (Pogoda, Wiadomości, Magazynowanie, Pety, Kuchnia) + asystent AI +
  ustawienia użytkownika i administratora; dodatkowo poprawka nawigacji w Wiadomościach

> **Zasada speca:** opisujemy **CO i DLACZEGO**, nigdy **JAK**.

## 1. Problem / potrzeba

Aplikacja wydaje pieniądze właściciela na model w miejscach, których on nie kontroluje i nie widzi.
Sekcje generowane przez AI same decydują, kiedy się odświeżyć; koszt wielkiego przebiegu
odświeżania wiadomości pokazuje się przez chwilę i znika bezpowrotnie; a każda akcja asystenta
wymaga ręcznego zatwierdzenia, nawet gdy właściciel od dawna zatwierdza wszystko po kolei.

Trzy różne objawy, jedna przyczyna: **to system decyduje, co robi automatycznie, a właściciel nie ma
ani przełącznika, ani wglądu**. Do tego dochodzi czwarte zgłoszenie z tej samej partii — nawigacja
po tematach w Wiadomościach, poprawiana w 040, nadal jest niewygodna przy ośmiu długich nazwach.

## 2. Cel i miary sukcesu

- **Cel:** właściciel decyduje, kiedy AI pracuje, widzi ile go to kosztowało — także po fakcie — i
  może zdjąć z siebie klikanie tam, gdzie jest ono tylko formalnością.
- **Sukces mierzymy:**
  - wejście na stronę z sekcją AI **nie kosztuje ani grosza**, dopóki użytkownik nie poprosi,
  - z każdej sekcji AI widać **jednym spojrzeniem**: czy treść jest, kiedy powstała, czy jest
    aktualna i ile kosztowała,
  - koszt zakończonego przebiegu odświeżania wiadomości da się odczytać **następnego dnia**,
  - przy włączonym auto-zatwierdzaniu ciąg „dodaj trzy zadania" idzie **bez ani jednego kliknięcia**,
    a usunięcie **nadal pyta**,
  - zmiana tematu w Wiadomościach to **dwa kroki**, niezależnie od liczby i długości nazw.

## 3. Historyjki użytkownika

- Jako właściciel chcę, żeby sekcje AI nie generowały się same, bo płacę za każde wejście na stronę,
  którego wcale nie planowałem.
- Jako właściciel chcę widzieć ostatnio wygenerowaną treść od razu po wejściu, razem z informacją,
  czy nadal pasuje do aktualnych danych — nie chcę klikać po coś, za co już zapłaciłem.
- Jako właściciel chcę sam ustawić, które sekcje mają się odświeżać automatycznie, a które wyłącznie
  na moje kliknięcie.
- Jako administrator chcę ustawić **domyślne** zachowanie dla systemu osobno od **swojego własnego**,
  bo to dwie różne decyzje.
- Jako administrator chcę zobaczyć, ile kosztował ostatni przebieg odświeżania wiadomości, także gdy
  patrzę na to dzień później.
- Jako właściciel chcę móc raz włączyć auto-zatwierdzanie akcji asystenta i mieć je włączone także
  jutro, bez powtarzania tej decyzji w każdej rozmowie.
- Jako właściciel chcę przeskakiwać między ośmioma monitorowanymi tematami bez przewijania paska w
  bok i bez zgadywania, gdzie kończy się ucięta nazwa.

## 4. Kryteria akceptacji (testowalne)

**Sekcje AI: kiedy generują (zgłoszenie 2)**
- [ ] **AC-1** — Given sekcja AI bez żadnej zapamiętanej treści, when otwieram stronę, then widzę
      **zaproszenie do wygenerowania**, a model **nie jest wołany** dopóki nie kliknę.
- [ ] **AC-2** — Given sekcja z zapamiętaną treścią, when otwieram stronę, then widzę **tę treść od
      razu**, bez żadnego wywołania modelu.
- [ ] **AC-3** — Given zapamiętana treść i **niezmienione** dane wejściowe, when patrzę na sekcję,
      then jest ona oznaczona jako **aktualna**, a system nie proponuje regeneracji jako czynności
      koniecznej.
- [ ] **AC-4** — Given zapamiętana treść i **zmienione** dane wejściowe, when patrzę na sekcję, then
      widzę wyraźny znacznik, że treść jest **nieaktualna**, wraz z możliwością przegenerowania —
      ale treść **nie znika** i nie regeneruje się sama.
- [ ] **AC-5** — Given dowolna sekcja AI, when patrzę na jej podpis, then w **jednym miejscu** mam
      komplet: kiedy powstała, czy aktualna, ile kosztowała i jak ją przegenerować.
- [ ] **AC-6** — Given otwarty szczegół kosztu przy sekcji, when go rozwinę, then widzę rozbicie
      kosztu tej konkretnej sekcji (jak dotąd), a nie zbiorczą sumę całego modułu.

**Sekcje AI: ustawienia trybu (zgłoszenie 2 f/g)**
- [ ] **AC-7** — Given sekcja AI, when otwieram jej ustawienie trybu, then mogę wybrać jeden z
      trzech: **na żądanie**, **automatycznie przy zmianie danych wejściowych**, **automatycznie przy
      każdym wyświetleniu**.
- [ ] **AC-8** — Given ustawiony tryb „na żądanie", when wchodzę na stronę wielokrotnie, then model
      **nie jest wołany ani razu** bez mojego kliknięcia.
- [ ] **AC-9** — Given ustawiony tryb „przy zmianie danych", when dane wejściowe się zmieniły i
      wchodzę na stronę, then treść odświeża się sama; gdy się **nie** zmieniły — nie odświeża się.
- [ ] **AC-10** — Given sekcja, dla której **nie** ustawiłem trybu, when patrzę na jej zachowanie,
      then obowiązuje **domyślny tryb ustawiony przez administratora**.
- [ ] **AC-11** — Given jestem administratorem, when zmieniam **systemowy domyślny** tryb, then moje
      **własne** ustawienie pozostaje nietknięte (i odwrotnie) — to dwie osobne decyzje.
- [ ] **AC-12** — Given ustawienie trybu, when zmieniam je i wracam następnego dnia, then wybór jest
      zachowany.
- [ ] **AC-13** — Given telefon, when korzystam z sekcji AI, then kontrolki (generuj / tryb / koszt)
      są **dostępne kciukiem** i **nie przytłaczają** treści, dla której wszedłem na stronę.

**Koszt przebiegu wiadomości (zgłoszenie 4)**
- [ ] **AC-14** — Given zakończony przebieg odświeżania wiadomości, when wracam na stronę **po
      kolejnym przebiegu albo następnego dnia**, then nadal mogę odczytać, ile kosztował.
- [ ] **AC-15** — Given jestem administratorem, when otwieram koszt przebiegu, then widzę
      **szczegóły** (etapy i ich udział), a nie tylko sumę.
- [ ] **AC-16** — Given nie jestem administratorem, when patrzę na moduł, then **nie widzę** danych
      kosztowych — tak jak dotąd.
- [ ] **AC-17** — Given kilka kolejnych przebiegów, when patrzę na historię, then rozróżniam je po
      czasie i wyniku, a nie widzę wyłącznie ostatniego.

**Auto-zatwierdzanie akcji asystenta (zgłoszenie 3)**
- [ ] **AC-18** — Given włączone auto-zatwierdzanie, when asystent proponuje akcje **bezpieczne**
      (dodanie, edycja), then wykonują się **bez mojego kliknięcia**, a ja widzę, co zostało zrobione.
- [ ] **AC-19** — Given włączone auto-zatwierdzanie, when wśród akcji jest **niszcząca** (usunięcie),
      then **nadal wymaga potwierdzenia** — auto-zatwierdzanie jej nie obejmuje.
- [ ] **AC-20** — Given włączone auto-zatwierdzanie, when zamykam aplikację i wracam **jutro**, then
      ustawienie **nadal jest włączone**.
- [ ] **AC-21** — Given rozmowa z asystentem, when chcę przełączyć auto-zatwierdzanie, then robię to
      **bez opuszczania czatu**, w tym samym miejscu, w którym ustawiam poziom pracy asystenta.
- [ ] **AC-22** — Given włączone auto-zatwierdzanie, when patrzę na asystenta, then **widzę, że jest
      włączone** — tryb nie działa po cichu.

**Nawigacja po tematach (zgłoszenie 1)**
- [ ] **AC-23** — Given osiem tematów o długich nazwach, when wybieram temat, then widzę **pełne
      nazwy** wszystkich i wybieram w **dwóch krokach**, bez przewijania w bok.
- [ ] **AC-24** — Given lista tematów, when szukam konkretnego, then mogę **zawęzić ją pisząc** część
      nazwy.
- [ ] **AC-25** — Given telefon i komputer, when porównuję sposób wyboru tematu, then jest to **ten
      sam mechanizm**, a nie dwa różne układy.
- [ ] **AC-26** — Given wybrany temat, when patrzę na ekran, then widzę, **który temat jest aktywny**
      i ile ma nowych wiadomości, bez rozwijania listy.

## 5. Zakres

**W zakresie:**
- Spójny sposób prezentacji i sterowania **każdą** sekcją generowaną przez AI: stan (pusta / treść /
  nieaktualna), akcja generowania, koszt, ustawienie trybu odświeżania.
- Trzy tryby odświeżania per sekcja, z dziedziczeniem po ustawieniu administratora.
- Osobne ustawienia administratora: własne i systemowe domyślne.
- Trwała historia kosztów przebiegu odświeżania wiadomości, ze szczegółami, dla administratora.
- Auto-zatwierdzanie bezpiecznych akcji asystenta, trwałe między sesjami, przełączane z czatu.
- Nowy sposób nawigacji po tematach w Wiadomościach.

**Poza zakresem (świadomie):**
- Zmiana samego sposobu generowania treści (prompty, modele, etapy przebiegu) — dotykamy **kiedy** i
  **za ile**, nie **jak**.
- Budżety i limity wydatków na AI (np. „nie wydawaj więcej niż X miesięcznie") — to osobna funkcja,
  a nie kontrola nad pojedynczą sekcją.
- Historia kosztów dla pozostałych modułów poza Wiadomościami — zgłoszenie dotyczy przebiegu
  odświeżania, który jest największym jednorazowym wydatkiem.
- Auto-zatwierdzanie akcji niszczących w jakiejkolwiek formie (odliczanie, „cofnij") — decyzja
  właściciela wyklucza je z tego mechanizmu.
- Zmiany w module Kuchnia/Pety/Magazyn poza wpięciem ich sekcji AI w nowy, wspólny sposób obsługi.

## 6. Wpływ na Omnia

- **Uprawnienie / RBAC:** bez nowych slugów. Ustawienia systemowych domyślnych i szczegóły kosztów
  są za istniejącym uprawnieniem administratora; ustawienia własne — za sesją użytkownika (C-22).
- **Własność danych:** wszystko per użytkownik (`ownerId`), zgodnie z C-21. Systemowe domyślne to
  konfiguracja globalna, nie dane użytkownika. Historia kosztów przebiegu należy do właściciela
  przebiegu.
- **Asystent AI:** bez nowych akcji asystenta. Zmienia się **sposób zatwierdzania** istniejących
  akcji, nie ich katalog (C-23). Rozróżnienie „bezpieczna / niszcząca" musi pochodzić z tego samego
  źródła, które dziś odznacza akcje niszczące w szufladzie — nie z drugiej, równoległej listy.
- **Kalendarz / powiadomienia / trash:** nie dotyczy.

## 7. Zgodność z konstytucją

- **C-10, C-11, C-12** — ustawienia trybu i historia kosztów wymagają zmian schematu: ręczne pliki
  migracji, tryby jako tekst z typem TypeScript (nigdy enum Prisma).
- **C-20, C-21** — zmiana ustawień i zapis historii przez Server Actions z `revalidatePath`, dostęp
  po `ownerId`.
- **C-25** — zmiana **systemowego domyślnego** trybu to zmiana konfiguracji, więc trafia do dziennika
  zmian administratora.
- **C-30, C-31** — kontrolki sekcji wyłącznie na zmiennych CSS; muszą być używalne kciukiem i
  **subtelne**, bo siedzą przy treści, dla której użytkownik przyszedł.
- **C-32** — teksty po polsku.
- **C-40** — nic nie zmienia routingu modeli; sterujemy **momentem** wywołania, nie jego treścią.
- **C-53** — mechanizmy z 037 (koszt) i 038 (pamięć treści) już istnieją. To zgłoszenie prosi wprost
  o **spójny sposób** i połączenie z licznikiem kosztu — czyli o jedno miejsce zamiast pięciu
  wariantów, a nie o nową warstwę obok istniejących.

## 8. Otwarte pytania / decyzje właściciela

Wszystkie rozstrzygnięte na starcie (C-55):

- [x] **Nawigacja po tematach** → **rozwijany selektor z wyszukiwarką**: jedno pole z aktywnym
      tematem, po rozwinięciu pionowa lista z pełnymi nazwami, licznikami i polem wyszukiwania.
- [x] **Domyślne zachowanie sekcji AI** → **pokaż ostatni wynik, generuj wyłącznie na żądanie**.
      Wejście na stronę nigdy nie kosztuje; brak zapamiętanej treści = zaproszenie do kliknięcia.
- [x] **Gdzie ustawia się tryb odświeżania** → **przy sekcji, w tym samym miejscu co koszt** —
      zgodnie z prośbą o połączenie z komponentem kosztu.
- [x] **Zakres auto-zatwierdzania** → **tylko akcje bezpieczne**; niszczące zawsze wymagają
      potwierdzenia.
- [x] **Miejsce przełącznika auto-zatwierdzania** → **w rozwijanej sekcji ustawień asystenta na dole
      czatu, obok poziomu pracy** (nie ikona w nagłówku, nie osobny wpis w ustawieniach).

Założenia przyjęte domyślnie:

- Systemowy domyślny tryb dla wszystkich sekcji to **na żądanie** — najtańszy i zgodny z sensem
  zgłoszenia; administrator może to zmienić.
- Auto-zatwierdzanie jest **domyślnie wyłączone** — włączenie ma być świadomą decyzją.
- Historia kosztów przebiegu wiadomości przechowywana jest **ograniczony czas** (nie w nieskończoność)
  — zgłoszenie mówi o odczycie „po fakcie", nie o wieczystym archiwum księgowym.

## 9. Ryzyka

- **„Sekcja czeka na kliknięcie" może zostać odebrana jako awaria** („nie działa, pusto"). →
  Zaproszenie musi mówić wprost, że treść powstanie po kliknięciu, a nie wyglądać jak pusty stan po
  błędzie. To dokładnie ta różnica, o którą rozbiła się Pogoda w 038.
- **Cztery kontrolki przy każdej sekcji (generuj, tryb, koszt, aktualność) mogą przytłoczyć treść.** →
  Właściciel wprost prosi o subtelność: wszystko schodzi do jednej linii podpisu, a szczegóły
  (rozbicie kosztu, wybór trybu) rozwijają się dopiero na żądanie.
- **Auto-zatwierdzanie działające po cichu jest niebezpieczne** — użytkownik może zapomnieć, że jest
  włączone, i zdziwić się skutkiem. → Stan musi być widoczny w czacie przez cały czas, nie tylko w
  chwili przełączania (AC-22).
- **Rozróżnienie „bezpieczna / niszcząca" zapisane w drugim miejscu rozjedzie się z pierwszym.** →
  Musi pochodzić z tego samego źródła, którego dziś używa szuflada akcji; inaczej dodanie nowej
  akcji niszczącej ominie zabezpieczenie.
- **Trzecie podejście do nawigacji po tematach** (po zakładkach z 040 i kolumnie sprzed 040). →
  Kryteria są tym razem policzalne — pełne nazwy, dwa kroki, jeden mechanizm na obu szerokościach,
  wyszukiwanie — więc da się sprawdzić, czy rozwiązanie faktycznie odpowiada na zarzut, zamiast
  polegać na wyczuciu.
