# Spec: Asystent AI — czytelność dla użytkownika, bezpieczeństwo i wymuszona walidacja akcji

- **ID:** 031-asystent-ux-bezpieczenstwo-walidacja
- **Status:** draft
- **Autor sesji:** Claude Code (spec-driven pipeline)
- **Data:** 2026-07-25
- **Moduł(y):** Home / asystent AI (czat, panel akcji, ustawienia), przekrojowo: wszystkie moduły (autoryzacja i walidacja akcji), Admin (konfiguracja skrzynki zgłoszeń i syntezy mowy)

> **Zasada speca:** opisujemy **CO i DLACZEGO**, nigdy **JAK**. Zero nazw plików, tabel, bibliotek,
> endpointów. Jeśli piszesz o implementacji — to należy do `plan.md`, nie tutaj.

## 1. Problem / potrzeba

Asystent AI przestał być narzędziem wyłącznie dla właściciela — korzystają z niego zwykli
użytkownicy, a jego warstwa prezentacji wciąż mówi językiem bazy danych: pokazuje identyfikatory
encji, wartości techniczne (`NONE`, `TODO`, `MEDIUM`), techniczne nazwy akcji i parametrów, oraz
pełny, surowy log rozumowania. Równolegle ujawniły się dwie luki systemowe: (1) nie ma
gwarancji, że **każda** akcja — wykonywana ręcznie przez użytkownika i przez asystenta —
sprawdza, czy użytkownik ma prawo do danych, oraz (2) nie ma gwarancji, że **każda** akcja
waliduje dane tak samo dla asystenta jak dla formularza w UI. Do tego dochodzi paczka drobnych,
ale realnych usterek UX (mobilna historia rozmów wyjeżdża poza ekran, preferencje trzymane per
urządzenie zamiast per użytkownik, mylące głosy lektora, nieczytelna stopka odpowiedzi, brak
podpowiedzi skrótu wysyłania) i błąd uprawnień przy zgłaszaniu problemów do skrzynki admina.

Robimy to teraz, bo każdy nowy moduł i każda nowa akcja pogłębiają te luki — im później, tym
większy audyt.

## 2. Cel i miary sukcesu

- **Cel:** asystent AI mówi do użytkownika językiem aplikacji, nigdy nie wykona akcji, do której
  użytkownik nie ma prawa albo której dane nie przechodzą walidacji, a poprawność ta jest
  **wymuszana automatycznie** także dla akcji, które dopiero powstaną.
- **Sukces mierzymy:**
  - W żadnym miejscu widocznym dla zwykłego użytkownika (odpowiedzi asystenta, panel „Przejrzyj /
    popraw", log rozumowania) nie pojawia się identyfikator encji ani surowa wartość techniczna.
  - Próba wykonania przez asystenta akcji na cudzych danych kończy się odmową z czytelnym
    komunikatem — nigdy cichym sukcesem ani błędem technicznym.
  - Dodanie do aplikacji nowej akcji odczytu lub mutacji **bez** zadeklarowanej kontroli dostępu i
    reguł walidacji **przerywa build** — tak jak dziś przerywa go brak pokrycia akcji przez AI.
  - Wszystkie 11 zgłoszeń administratora z tej paczki jest zamkniętych i sprawdzalnych.

## 3. Historyjki użytkownika

- Jako **zwykły użytkownik** chcę czytać odpowiedzi asystenta bez identyfikatorów i skrótów typu
  `TODO`, żeby rozumieć je tak samo jak ekrany aplikacji.
- Jako **zwykły użytkownik** chcę w panelu „Przejrzyj / popraw" widzieć nazwy i wartości po polsku
  oraz kontrolki dopasowane do rodzaju pola, żeby móc bezpiecznie poprawić propozycję asystenta,
  nie wpisując przypadkiem wartości nie do przyjęcia.
- Jako **zwykły użytkownik** chcę widzieć jeden, aktualny krok pracy asystenta zamiast rosnącej
  listy kroków, a szczegóły dopiero po rozwinięciu, żeby czat pozostał czytelny.
- Jako **właściciel danych** chcę mieć pewność, że ani ja przez UI, ani asystent w moim imieniu nie
  sięgnie po dane, których nie jestem właścicielem i które nie zostały mi udostępnione.
- Jako **właściciel danych** chcę, żeby asystent nie mógł zapisać danych, których nie przyjąłby
  formularz w aplikacji, żeby rozmowa nie stawała się obejściem reguł.
- Jako **użytkownik na telefonie** chcę, żeby historia rozmów mieściła się na ekranie.
- Jako **użytkownik z Polski** chcę móc wybrać spośród kilku działających polskich głosów lektora
  i usłyszeć próbkę przed wyborem.
- Jako **użytkownik korzystający z kilku urządzeń** chcę, żeby moje stałe preferencje asystenta i
  wybrany poziom pracy asystenta były te same na komputerze i na telefonie.
- Jako **użytkownik dbający o koszty** chcę móc przełączyć asystenta w tryb oszczędny, gdy zadanie
  jest proste.
- Jako **zwykły użytkownik** chcę móc zgłosić problem administratorowi, nie dostając przy tym
  propozycji otwarcia zadania, do którego i tak nie mam dostępu.
- Jako **administrator** chcę wskazać, który projekt zadań jest skrzynką zgłoszeń, żeby zmiana
  nazwy projektu nie psuła po cichu zgłaszania problemów.

## 4. Kryteria akceptacji (testowalne)

### Czytelność dla użytkownika

- [ ] **AC-1** — Given rozmowa, w której asystent wypisuje zadania, when asystent formułuje
  odpowiedź, then w treści widocznej dla użytkownika nie występują identyfikatory encji ani surowe
  wartości techniczne (np. `NONE`, `TODO`, `MEDIUM`), a zamiast nich pojawiają się etykiety
  identyczne z tymi na ekranach aplikacji (np. „Brak", „Do zrobienia", „Średni").
- [ ] **AC-2** — Given asystent pracuje nad odpowiedzią, when wykonuje kolejne kroki, then w czacie
  widoczny jest **jeden** aktualny krok, zastępowany przez następny, a nie narastająca lista.
- [ ] **AC-3** — Given asystent zakończył pracę, when kroki się skończyły, then w ich miejscu
  pojawia się „Pokaż log rozumowania", a po rozwinięciu — kroki opisane językiem naturalnym, bez
  danych technicznych.
- [ ] **AC-4** — Given użytkownik bez uprawnień administratora, when otwiera rozwinięcia pod
  odpowiedzią, then widzi wyłącznie log opisowy; techniczny log (z parametrami narzędzi i danymi
  surowymi) jest dostępny **tylko** dla administratora i podpisany jako techniczny.
- [ ] **AC-5** — Given panel „Przejrzyj / popraw" z zaproponowanymi akcjami, when użytkownik go
  otworzy, then każda akcja ma polską nazwę opisową, a jej parametry — polskie etykiety i wartości
  w formie widocznej w aplikacji; identyfikatory encji nie są prezentowane, mimo że pozostają
  zachowane na potrzeby wykonania akcji.
- [ ] **AC-6** — Given parametr akcji o określonym rodzaju (wybór ze zbioru wartości / data /
  liczba / wartość logiczna / tekst), when użytkownik chce go zmienić w panelu, then otrzymuje
  kontrolkę adekwatną do rodzaju pola, uniemożliwiającą wprowadzenie wartości spoza dozwolonych.
- [ ] **AC-7** — Given panel „Przejrzyj / popraw", when użytkownik ogląda listę akcji, then pole
  wyboru każdej pozycji jest wyrównane w pionie z ikoną i nazwą akcji.
- [ ] **AC-8** — Given stopka odpowiedzi asystenta, when użytkownik ją ogląda, then widzi wyłącznie
  ikony (bez etykiet tekstowych), w kolejności: odczytaj na głos, kopiuj, ponów — każda z podpowiedzią
  (tooltipem) i dostępna dla czytników ekranu.
- [ ] **AC-9** — Given telefon (szerokość mobilna), when użytkownik otwiera historię rozmów
  asystenta, then żaden element (w tym opisy historycznych rozmów) nie wychodzi poza szerokość
  ekranu i nie powoduje przewijania w poziomie.
- [ ] **AC-10** — Given pole wiadomości asystenta, when użytkownik go używa, then jest dla niego
  czytelne, że wiadomość wysyła się skrótem Ctrl+Enter (podpowiedź widoczna w interfejsie, także
  po polsku, i nieprzeszkadzająca na telefonie).

### Ustawienia użytkownika

- [ ] **AC-11** — Given użytkownik zapisał stałe preferencje asystenta na jednym urządzeniu, when
  zaloguje się na innym urządzeniu, then widzi te same preferencje, a interfejs nie sugeruje już,
  że zapis dotyczy urządzenia.
- [ ] **AC-12** — Given asystent otwarty, when użytkownik patrzy na okolice pola wiadomości, then na
  lewo od mikrofonu znajduje przełącznik poziomu pracy asystenta z dwiema opcjami: standardową
  (modele zgodnie z konfiguracją administratora) i oszczędną (do wszystkich operacji asystenta
  używany jest model przypisany przez administratora do operacji najprostszych).
- [ ] **AC-13** — Given użytkownik wybrał tryb oszczędny, when otworzy asystenta na innym
  urządzeniu, then wybór jest zachowany (ustawienie zapisane po stronie serwera, nie w pamięci
  przeglądarki).
- [ ] **AC-14** — Given tryb oszczędny, when asystent wykonuje dowolną operację (rozumowanie,
  klasyfikacja, generowanie), then korzysta z modelu przypisanego do operacji najprostszych, a nie
  z modelu przypisanego do rozumowania.

### Lektor / głosy

- [ ] **AC-15** — Given ustawienia asystenta, when użytkownik otwiera listę głosów lektora, then
  lista jest stabilna (nie „znika" ani nie zmienia się samoistnie po chwili) i zawiera wyłącznie
  głosy, które faktycznie dają się odtworzyć.
- [ ] **AC-16** — Given administrator skonfigurował serwerową syntezę mowy, when użytkownik wybiera
  głos lektora, then ma do wyboru dodatkowe polskie głosy działające niezależnie od przeglądarki i
  systemu, a odczytywanie odpowiedzi korzysta z wybranego głosu.
- [ ] **AC-17** — Given administrator **nie** skonfigurował serwerowej syntezy mowy, when użytkownik
  korzysta z lektora, then wszystko działa jak dotąd na głosach przeglądarki (bez błędów), a
  interfejs nie obiecuje głosów, których nie ma.
- [ ] **AC-18** — Given lista głosów, when użytkownik chce sprawdzić głos przed wyborem, then może
  odsłuchać próbkę.

### Zgłoszenia problemów

- [ ] **AC-19** — Given dowolny zalogowany użytkownik bez uprawnień do skrzynki zgłoszeń, when
  zgłasza problem (z asystenta lub z trybu wskazywania elementu), then zgłoszenie trafia do skrzynki
  administratora, mimo że użytkownik nie jest właścicielem projektu ani nie ma do niego
  udostępnienia.
- [ ] **AC-20** — Given użytkownik, który nie ma dostępu do odczytu skrzynki zgłoszeń, when
  zgłoszenie zostanie utworzone, then **nie** dostaje propozycji przejścia do utworzonego zadania;
  użytkownik z dostępem — dostaje.
- [ ] **AC-21** — Given użytkownik bez uprawnień do skrzynki zgłoszeń, when próbuje odczytać,
  wylistować lub zmodyfikować zadania w niej zawarte (dowolną drogą, w tym przez asystenta), then
  dostaje odmowę — wyjątek dotyczy **wyłącznie** dodania zgłoszenia.
- [ ] **AC-22** — Given administrator, when wskaże w konfiguracji systemu projekt pełniący rolę
  skrzynki zgłoszeń, then zgłoszenia trafiają do wskazanego projektu; brak wskazania zachowuje
  dotychczasowe zachowanie.

### Bezpieczeństwo i walidacja (przekrojowo)

- [ ] **AC-23** — Given dowolna akcja odczytu lub mutacji w aplikacji, when jest wykonywana —
  ręcznie przez użytkownika albo przez asystenta w jego imieniu — then przechodzi tę samą kontrolę
  dostępu do danych (właściciel / udostępnienie / członkostwo w zespole / uprawnienie modułu).
- [ ] **AC-24** — Given asystent próbuje wykonać akcję na danych, do których użytkownik nie ma
  prawa, when akcja jest uruchamiana, then zostaje odrzucona po stronie serwera, a użytkownik
  dostaje zrozumiały komunikat o braku dostępu (bez ujawniania istnienia i treści cudzych danych).
- [ ] **AC-25** — Given asystent planuje akcje, when buduje propozycję, then wie, których akcji
  wykonać nie może z powodu braku dostępu, i nie proponuje ich zamiast obiecywać wykonanie.
- [ ] **AC-26** — Given dane akcji naruszające regułę walidacji obowiązującą użytkownika w
  interfejsie, when akcję zleca asystent, then zostaje ona odrzucona na serwerze z komunikatem
  wskazującym naruszoną regułę — asystent nie ma drogi obejścia walidacji dostępnej w UI.
- [ ] **AC-27** — Given reguła walidacji poprawiająca UX przy ręcznym wprowadzaniu, when użytkownik
  wypełnia formularz, then reguła działa również od razu w interfejsie (walidacja serwerowa
  pozostaje rozstrzygająca).
- [ ] **AC-28** — Given nowa akcja odczytu lub mutacji dodana do aplikacji **bez** zadeklarowanej
  kontroli dostępu i reguł walidacji, when uruchamiany jest build, then build **kończy się błędem**
  ze wskazaniem brakującej deklaracji.
- [ ] **AC-29** — Given istniejące akcje aplikacji, when przeprowadzony zostanie audyt w ramach tej
  zmiany, then każda z nich ma zadeklarowaną kontrolę dostępu, a akcje, w których audyt wykryje
  faktyczny brak sprawdzenia, zostają poprawione; ustalenia audytu są spisane.
- [ ] **AC-30** — Given wszystkie powyższe zmiany, when uruchomiony zostanie `npm run build` (do
  kroku poprzedzającego migrację produkcyjną), then przechodzi bez błędów, wraz z istniejącymi
  bramkami pokrycia akcji i migracji.

## 5. Zakres

**W zakresie:**

1. **Warstwa prezentacji asystenta** — tłumaczenie wartości technicznych na etykiety aplikacji w
   odpowiedziach, w panelu „Przejrzyj / popraw" i w opisowym logu rozumowania (zgłoszenia 2b, 6a).
2. **Przebudowa logu rozumowania** — jeden zastępowalny krok na żywo, po zakończeniu „Pokaż log
   rozumowania" (opisowy, dla wszystkich), a dotychczasowy surowy log jako „techniczny log
   rozumowania (admin)" (zgłoszenie 6b).
3. **Panel „Przejrzyj / popraw"** — wyrównanie pionowe pól wyboru, polskie nazwy akcji i
   parametrów, kontrolki dopasowane do rodzaju pola, ukrycie identyfikatorów przy zachowaniu ich w
   danych akcji (zgłoszenie 2a+2b).
4. **Stopka odpowiedzi** — same ikony z podpowiedziami, kolejność: odczytaj na głos, kopiuj, ponów
   (zgłoszenie 7).
5. **Historia rozmów na telefonie** — brak wychodzenia poza ekran (zgłoszenie 1).
6. **Podpowiedź skrótu Ctrl+Enter** w polu wiadomości (zgłoszenie 10).
7. **Stałe preferencje asystenta per użytkownik** (zapis serwerowy) + usunięcie mylącego opisu
   (zgłoszenie 4).
8. **Przełącznik poziomu pracy asystenta** (standardowy / oszczędny) przy polu wiadomości, zapis
   serwerowy per użytkownik, wpływ na dobór modelu we wszystkich operacjach asystenta
   (zgłoszenie 8).
9. **Lektor** — naprawa niestabilnej listy głosów i odsiew głosów niedziałających, próbka głosu,
   oraz **serwerowa synteza mowy** konfigurowana przez administratora, dająca dodatkowe polskie
   głosy niezależne od przeglądarki, z zachowaniem działania bez niej (zgłoszenie 3, decyzja
   właściciela).
10. **Skrzynka zgłoszeń** — konfigurowalny wskaźnik projektu-skrzynki z zachowaniem dotychczasowego
    zachowania jako domyślnego; kontrolowany wyjątek pozwalający każdemu użytkownikowi **dodać**
    zgłoszenie bez prawa odczytu; propozycja przejścia do zadania tylko przy realnym dostępie
    (zgłoszenie 5).
11. **Uniwersalny kontrakt akcji** — jedno miejsce opisujące dla każdej akcji: etykietę i opis pól
    po polsku, słownik wartości technicznych → widocznych, rodzaj kontrolki, reguły walidacji i
    wymaganą kontrolę dostępu; zasilające naraz panel akcji, walidację serwerową, wiedzę asystenta
    i bramkę build (zgłoszenia 2b, 6a, 9, 11; decyzja właściciela).
12. **Bramka build** wymuszająca deklarację kontroli dostępu i walidacji dla **każdej** akcji
    odczytu i mutacji — analogicznie do istniejącej bramki pokrycia akcji przez AI (zgłoszenia 9, 11).
13. **Audyt wszystkich istniejących akcji** pod kątem kontroli dostępu, z poprawieniem miejsc, w
    których sprawdzenia faktycznie brakuje, i spisaniem ustaleń (zgłoszenie 9, decyzja właściciela).

**Poza zakresem (świadomie):**

- Przepisywanie każdej Server Action tak, by przechodziła przez wspólny wrapper wykonawczy
  (odrzucone przez właściciela jako zbyt ryzykowny diff; kontrakt + bramka dają tę samą gwarancję
  bez przepisywania działającego kodu).
- Zmiany w mechanizmie ról i uprawnień modułowych (RBAC) — korzystamy z istniejącego; nie dodajemy
  nowych slugów uprawnień poza tym, czego wymaga skrzynka zgłoszeń.
- Rozszerzanie zakresu działań asystenta o nowe moduły lub nowe rodzaje akcji.
- Zmiana wyglądu i układu czatu poza punktami wymienionymi wyżej.
- Obniżanie kosztów rozmów innymi drogami niż przełącznik poziomu pracy asystenta.
- Wielojęzyczność interfejsu — wszystkie teksty pozostają po polsku.

## 6. Wpływ na Omnia

- **Uprawnienie / RBAC:** korzystamy z istniejących slugów `module.*` (m.in. `module.tasks`,
  `module.admin`). Skrzynka zgłoszeń wprowadza **kontrolowany wyjątek**: dodanie zgłoszenia jest
  możliwe bez posiadania dostępu do projektu, ale wyłącznie tą jedną drogą i wyłącznie jako zapis —
  odczyt i modyfikacja pozostają pod normalną kontrolą (C-21, C-22).
- **Własność danych:** bez zmian w modelu współwłasności `ownerId`/`ownerTeamId`. Nowe ustawienia
  użytkownika (stałe preferencje, poziom pracy asystenta, wybór głosu) są **per użytkownik**, nie
  zespołowe. Kontrakt akcji **opisuje** istniejące reguły dostępu, nie zastępuje ich.
- **Asystent AI:** nie dodajemy nowych rodzajów akcji ani nowych narzędzi odczytu. Zmienia się
  natomiast to, **co asystent wie** o akcjach (dostępność, reguły walidacji, etykiety) i **jak**
  prezentuje wyniki. Istniejąca bramka „każda akcja asystenta ma egzekutor" pozostaje; dokładamy
  drugą — o kontroli dostępu i walidacji (C-23).
- **Kalendarz / powiadomienia / trash:** nie dotyczy — feature nie tworzy nowych encji podlegających
  agendzie ani kosza. Serwerowa synteza mowy nie przechowuje trwale nagrań.
- **Administracja:** dochodzą dwa ustawienia systemowe — wskazanie projektu-skrzynki zgłoszeń oraz
  konfiguracja serwerowej syntezy mowy (dostawca/model/klucz, zgodnie z istniejącym modelem
  konfiguracji LLM: klucz szyfrowany i maskowany).

## 7. Zgodność z konstytucją

- **C-01, C-02** — całość pracy w `worldofmag/`, importy przez alias.
- **C-10, C-11, C-12, C-14** — nowe ustawienia użytkownika i konfiguracja systemowa wymagają
  **ręcznie napisanych migracji** z unikalnym numerem; nowe rodzaje/statusy jako kolumny tekstowe z
  typem TypeScript, **bez enumów Prisma**; seed konfiguracji idempotentny.
- **C-13** — weryfikujemy build do kroku poprzedzającego migrację; **nigdy** przeciw produkcyjnej
  bazie.
- **C-20** — zapis preferencji użytkownika i konfiguracji przez Server Actions z `revalidatePath()`.
- **C-21, C-22** — kontrola dostępu opiera się na istniejącym modelu współwłasności i guardach
  modułów; wyjątek dla skrzynki zgłoszeń jest jawny, wąski i tylko dla zapisu.
- **C-23** — istniejąca bramka pokrycia akcji przez AI pozostaje spełniona; nowa bramka jest jej
  odpowiednikiem dla dostępu i walidacji.
- **C-25** — zmiany konfiguracji systemowej (skrzynka zgłoszeń, synteza mowy) trafiają do dziennika
  audytu.
- **C-30** — kolory wyłącznie przez zmienne CSS (przełącznik poziomu pracy, panel akcji, podpowiedź
  skrótu); żadnych hexów.
- **C-31** — poprawki mobilne (historia rozmów, przełącznik przy polu wiadomości, podpowiedź skrótu)
  respektują minimalne cele dotyku i bezpieczny obszar; brak przewijania poziomego.
- **C-32** — wszystkie teksty po polsku; to jest **sedno** zgłoszeń 2b i 6a.
- **C-40, C-41** — dobór modeli (w tym tryb oszczędny) i konfiguracja syntezy mowy pozostają
  sterowane z bazy przez panel administratora; klucze szyfrowane i maskowane. Zero hardcodowania
  dostawcy ani modelu.
- **C-50, C-51** — „gotowe" = zielony build; każdy naprawiony błąd z tej paczki dostaje wpis w
  `doświadczenia.md`.
- **C-53** — jeden wspólny kontrakt akcji zamiast czterech równoległych mechanizmów; audyt poprawia
  wyłącznie miejsca z faktycznym brakiem, bez refaktorów „przy okazji".

## 8. Otwarte pytania / decyzje właściciela

Wszystkie pytania zadano w jednym momencie na etapie `/specify` (C-55). Odpowiedzi właściciela:

- [x] **Zakres zgłoszeń 9 i 11** → **mechanizm + bramka + audyt wszystkich akcji**. Budujemy
  uniwersalny mechanizm i bramkę build wymuszającą deklarację dla **każdej** akcji, przechodzimy
  przez wszystkie istniejące akcje i łatamy te, w których audyt wykryje faktyczny brak sprawdzenia.
  Pełny refaktor „każda akcja przez wspólny wrapper" świadomie odrzucony.
- [x] **Architektura zgłoszeń 2b / 6a / 11** → **jeden wspólny kontrakt akcji** (etykiety, słownik
  wartości, rodzaj kontrolki, reguły walidacji, wymagany dostęp) zasilający panel akcji, walidację
  serwerową, wiedzę asystenta i bramkę build.
- [x] **Głosy lektora (zgłoszenie 3)** → **dołożyć serwerową syntezę mowy**. Właściciel świadomie
  wybrał wariant szerszy niż sama naprawa listy: przeglądarka nie doda polskich głosów, więc
  dokładamy syntezę po stronie serwera. Konsekwencje przyjęte do wiadomości: nowa konfiguracja
  administratora, klucz dostawcy i koszt użycia. Naprawa niestabilnej listy głosów przeglądarki
  **zostaje w zakresie** jako ścieżka zapasowa (AC-15, AC-17).
- [x] **Skrzynka zgłoszeń (zgłoszenie 5)** → **konfigurowalna w panelu administratora, z
  fallbackiem** do dotychczasowego zachowania.

Założenia przyjęte samodzielnie (brak pytania — rozstrzygnięte rozsądnym domyślnym, C-55):

- Nazwy opcji przełącznika poziomu pracy asystenta dobiera implementacja (polskie, opisowe, np.
  „Standardowy" / „Oszczędny"); zgłoszenie wprost zostawia to do decyzji wykonawcy.
- Ustawienia użytkownika (preferencje, poziom pracy, głos) są **per użytkownik**, nie zespołowe —
  dotyczą osobistego sposobu pracy.
- Opisowy log rozumowania powstaje z **już istniejących** myśli asystenta, bez dodatkowych wywołań
  modelu (bez nowych kosztów).
- Podpowiedź o Ctrl+Enter jest dyskretna i nie zajmuje miejsca krytycznego na telefonie.
- Wybór głosu lektora może pozostać zapamiętany lokalnie **tylko** w części dotyczącej głosów
  systemowych (są specyficzne dla urządzenia); wybór głosu serwerowego jest zapamiętywany per
  użytkownik.

## 9. Ryzyka

- **Rozmiar zmiany** → paczka jest duża i dotyka wszystkich modułów. Ograniczamy: kontrakt opisuje
  istniejące reguły zamiast je przepisywać, a audyt zmienia kod tylko tam, gdzie brakuje
  sprawdzenia.
- **Bramka build blokująca przyszłą pracę** → gdyby wymagała zbyt wiele przy nowej akcji, stanie się
  uciążliwa. Ograniczamy: deklaracja ma być krótka, a komunikat błędu bramki — instruktażowy,
  wskazujący dokładnie, czego brakuje i gdzie to dopisać.
- **Fałszywe poczucie bezpieczeństwa** → sama deklaracja nie dowodzi, że kod naprawdę sprawdza
  dostęp. Ograniczamy: audyt weryfikuje faktyczne sprawdzenia w kodzie, a nie samą obecność wpisu, i
  spisuje ustalenia.
- **Koszty i awaryjność serwerowej syntezy mowy** → nowa zależność zewnętrzna i płatność za użycie.
  Ograniczamy: konfiguracja opcjonalna, wyłączona domyślnie, z automatycznym powrotem do głosów
  przeglądarki, gdy usługa nie odpowiada lub nie jest skonfigurowana.
- **Wyjątek dla skrzynki zgłoszeń jako furtka** → zapis do cudzego projektu bez uprawnień jest z
  natury czułym miejscem. Ograniczamy: wyjątek dotyczy wyłącznie dodania zgłoszenia, tylko przez
  ścieżkę zgłoszeniową, bez prawa odczytu i modyfikacji, i tylko do jednego wskazanego projektu.
- **Tryb oszczędny psujący jakość odpowiedzi** → słabszy model może nie poradzić sobie ze złożonym
  poleceniem. Ograniczamy: tryb jest świadomym wyborem użytkownika, domyślnie wyłączony, z czytelną
  informacją, co oznacza.
- **Regresja w czacie przy przebudowie logu rozumowania** → historia rozmów jest zapisywana
  przyrostowo, więc zmiana prezentacji musi zachować zgodność ze starymi rozmowami. Ograniczamy:
  stare rozmowy renderują się dalej poprawnie.
