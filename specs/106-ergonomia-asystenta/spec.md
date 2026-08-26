# Spec: Ergonomia asystenta AI — chrom, sesje i tryb dokowania

- **ID:** 106-ergonomia-asystenta
- **Status:** draft
- **Autor sesji:** Claude Code (spec-driven pipeline)
- **Data:** 2026-08-26
- **Moduł(y):** Asystent AI (powłoka — `components/assistant` + `components/shell`), preferencje użytkownika

> **Zasada speca:** opisujemy **CO i DLACZEGO**, nigdy **JAK**.

## 1. Problem / potrzeba

Właściciel zgłosił cztery osobne rzeczy i wszystkie dotyczą **powłoki asystenta**, a nie tego, co
asystent potrafi:

1. **Górny pasek asystenta jest przepełniony.** Zbiera dziś: nazwę, znacznik trybu automatycznego,
   nową rozmowę, ustawienia, zgłoszenie błędu, historię, przełącznik trybu administratora i
   zamknięcie. Na telefonie (360 px) ikona „nowa rozmowa" nachodzi na chip „auto".
2. **Menu poziomu pracy jest przycinane na komputerze.** Otwiera się nad kompozytorem i wyjeżdża
   poza górną krawędź arkusza — górna część listy jest nieczytelna, więc wyboru jakości nie da się
   zrobić patrząc na to, co się wybiera.
3. **Rozmowy giną w historii.** Nie ma sposobu, żeby rozmowę, do której się wraca, wyróżnić — po
   kilkunastu nowych wątkach jest nie do znalezienia. Brakuje też jasnego miejsca na akcje
   dotyczące *całej bieżącej rozmowy*.
4. **Na komputerze asystent jest pływającym oknem.** Właściciel chce móc pracować z asystentem
   w obszarze treści — tam, gdzie normalnie stoi moduł — zamiast w dialogu przykrywającym stronę.

Wszystkie cztery są kosztem tego samego: asystent przez ostatnie przebiegi dostawał funkcje, a jego
rama nie rosła razem z nimi.

## 2. Cel i miary sukcesu

- **Cel:** powłoka asystenta mieści wszystkie dzisiejsze funkcje czytelnie na telefonie i na
  komputerze, pozwala trwale wyróżnić rozmowę, i daje na komputerze wybór między oknem a pracą
  w obszarze treści.
- **Sukces mierzymy:**
  - przy 360 px żaden element górnego paska asystenta nie nachodzi na inny i każdy zachowuje cel
    dotyku ≥ 44 × 44 px,
  - menu poziomu pracy na komputerze jest widoczne w całości (żadna pozycja nie jest przycięta),
  - rozmowa oznaczona jako zapisana jest po dziesięciu nowych rozmowach nadal osiągalna **bez
    przewijania** listy historycznej,
  - żadna funkcja dostępna dziś w asystencie nie znika — każda ma po zmianie dokładnie jedno miejsce.

## 3. Historyjki użytkownika

- Jako użytkownik na telefonie chcę **widzieć rozdzielnie** wszystkie kontrolki asystenta, żeby nie
  trafiać w „nową rozmowę", celując w znacznik trybu automatycznego.
- Jako użytkownik na komputerze chcę **widzieć całe menu jakości**, żeby wybierać poziom pracy
  świadomie, a nie po pamięci.
- Jako użytkownik chcę **zapisać rozmowę na osobnej liście**, żeby wątek, do którego wracam, nie
  ginął między codziennymi pytaniami.
- Jako użytkownik chcę mieć **akcje bieżącej rozmowy w jednym, przewidywalnym miejscu** (zapisz,
  zmień nazwę, usuń), żeby nie szukać ich raz u góry, raz przy polu wpisywania.
- Jako użytkownik na komputerze chcę **przełączyć asystenta w tryb pełnej treści**, żeby rozmawiać
  w obszarze, w którym normalnie pracuję — nie tracąc miejsca, w którym jestem.

## 4. Kryteria akceptacji (testowalne)

**Chrom asystenta (zgłoszenie 1)**

- [ ] **AC-1** — Given asystent otwarty na ekranie 360 px, when rozmowa jest pusta i tryb
      automatyczny włączony, then w górnym pasku widać jednocześnie: nazwę asystenta, znacznik trybu
      automatycznego, „nową rozmowę", historię, menu akcji drugiego planu i zamknięcie — **bez
      nakładania się** i bez poziomego przewijania paska.
- [ ] **AC-2** — Given asystent na wąskim ekranie, when tryb automatyczny jest włączony, then
      znacznik trybu jest widoczny (choćby samą ikoną) i ma dostępną nazwę czytelną dla czytnika
      ekranu; on szerszym ekranie pokazuje pełną etykietę.
- [ ] **AC-3** — Given asystent otwarty, when otwieram menu akcji drugiego planu, then znajduję
      w nim **wszystkie** funkcje, które dziś stoją w pasku i nie zostały w nim zachowane:
      ustawienia asystenta, zgłoszenie problemu, przełącznik trybu administratora (tylko admin) —
      żadna nie jest niedostępna.
- [ ] **AC-4** — Given menu akcji otwarte, when naciskam `Esc`, then zamyka się **tylko menu**,
      a rozmowa zostaje otwarta.

**Menu poziomu pracy (zgłoszenie 2)**

- [ ] **AC-5** — Given asystent na komputerze, when otwieram wybór poziomu pracy, then widzę
      wszystkie cztery poziomy oraz przełącznik wykonywania bezpiecznych akcji — **żadna pozycja
      nie jest przycięta** górną krawędzią asystenta ani krawędzią okna przeglądarki.
- [ ] **AC-6** — Given okno o małej wysokości (np. 600 px), when otwieram wybór poziomu pracy, then
      menu mieści się w widocznym obszarze — a jeśli treść jest wyższa niż dostępne miejsce,
      przewija się wewnątrz siebie, zamiast wychodzić poza ekran.
- [ ] **AC-7** — Given wybór poziomu otwarty, when wybieram poziom, then wybór zostaje zapisany
      i zachowanie jest takie samo jak dotychczas (zmiana poziomu, konfiguracja poziomu własnego,
      przełącznik bezpiecznych akcji) — zmiana dotyczy wyłącznie umiejscowienia menu.

**Zapisane rozmowy (zgłoszenie 3)**

- [ ] **AC-8** — Given otwarta rozmowa z co najmniej jedną turą, when wybieram „Zapisz rozmowę"
      w menu akcji bieżącej rozmowy, then rozmowa trafia na listę **Zapisane** i pozostaje tam po
      przeładowaniu strony oraz na innym urządzeniu tego samego konta.
- [ ] **AC-9** — Given szuflada historii otwarta, when przełączam się między listami, then widzę
      dwie listy: **Zapisane** i **Historia**, każda z licznikiem; lista zapisanych zawiera wyłącznie
      rozmowy zapisane, historyczna — pozostałe.
- [ ] **AC-10** — Given rozmowa zapisana, when otwieram menu akcji bieżącej rozmowy, then akcja
      jest odwracalna („Usuń z zapisanych") i po jej użyciu rozmowa wraca na listę historyczną,
      nie znikając z aplikacji.
- [ ] **AC-11** — Given lista zapisanych jest pusta, when ją otwieram, then widzę stan pusty
      wyjaśniający, jak zapisać rozmowę — nigdy pustego ekranu bez wyjaśnienia.
- [ ] **AC-12** — Given otwarta rozmowa, when otwieram menu akcji bieżącej rozmowy, then znajduję
      w nim komplet akcji na całej rozmowie: zapisz/usuń z zapisanych, zmień nazwę, usuń rozmowę —
      a usunięcie jest potwierdzane oknem deklarującym operację jako niszczącą.
- [ ] **AC-13** — Given istniejące rozmowy sprzed zmiany, when wchodzę do historii po wdrożeniu,
      then wszystkie są widoczne na liście historycznej (żadna nie ginie), a lista zapisanych jest
      pusta.

**Asystent w obszarze treści (zgłoszenie 4)**

- [ ] **AC-14** — Given komputer i dowolny moduł otwarty, when włączam tryb pracy w obszarze treści,
      then asystent zajmuje obszar treści modułu, a **adres strony się nie zmienia**.
- [ ] **AC-15** — Given asystent w trybie pracy w obszarze treści, when wracam do modułu, then widok
      modułu jest **w tym samym stanie**, w jakim go zostawiłem (pozycja przewijania, otwarte panele,
      wpisany tekst) — treść była ukryta, nie porzucona.
- [ ] **AC-16** — Given asystent w trybie pracy w obszarze treści, when zadaję pytanie dotyczące
      bieżącego miejsca w aplikacji, then asystent zna kontekst tej strony dokładnie tak samo, jak
      w trybie okna.
- [ ] **AC-17** — Given wybrany tryb pracy w obszarze treści, when przeładowuję stronę lub wchodzę
      z innego urządzenia, then wybór jest zapamiętany na koncie.
- [ ] **AC-18** — Given telefon, when otwieram asystenta, then działa jak dotąd (arkusz, ikona
      Sparkles pośrodku dolnego paska) — tryb pracy w obszarze treści nie dotyczy telefonu i nie
      da się do niego trafić przypadkiem.
- [ ] **AC-19** — Given asystent w trybie pracy w obszarze treści, when chcę wrócić do modułu, then
      zawsze widzę wyraźne wyjście z tego trybu (nie muszę go szukać ani znać skrótu).
- [ ] **AC-20** — Given asystent w dowolnym trybie, when korzystam z nawigacji modułów, then
      nawigacja pozostaje dostępna i działa (asystent nie zasłania menu).

**Wspólne**

- [ ] **AC-21** — Given cała zmiana, when uruchamiam `npm run build`, then przechodzi — w tym
      bramki `check:i18n` (zero nowych literałów), `check:ui-contract`, `check:owner-columns`,
      `check:client-safe`, `check:logs`, `check:migrations`.

## 5. Zakres

**W zakresie:**

- Przebudowa górnego paska asystenta: pozycje pierwszego planu widoczne, drugiego planu pod jednym
  menu; znacznik trybu automatycznego responsywny.
- Menu akcji bieżącej rozmowy (zapisz / zmień nazwę / usuń) — w nagłówku asystenta.
- Naprawa umiejscowienia menu poziomu pracy na komputerze (widoczne w całości, przewijalne
  wewnętrznie przy niskim oknie).
- Trwałe oznaczenie rozmowy jako **zapisanej** + rozdzielenie szuflady historii na dwie listy
  („Zapisane" / „Historia") z licznikami i stanem pustym.
- Tryb pracy asystenta w obszarze treści na komputerze: treść modułu zostaje **ukryta, nie
  porzucona**, adres strony bez zmian, kontekst strony nadal dostępny dla asystenta, wybór
  zapamiętany na koncie, jawne wyjście z trybu.
- Wpis do `doświadczenia.md` (C-51) — trzy z czterech zgłoszeń to błędy układu.

**Poza zakresem (świadomie):**

- **Nawigator tematów w Wiadomościach** — zrzut rozmowy w zgłoszeniu 1 dotyczy starszej sprawy
  (drop-down jako skok, nie filtr; usunięcie strzałek). To zostało zrobione w przebiegach 083/084;
  tutaj liczy się wyłącznie opis problemu z paskiem asystenta.
- Zmiany w samej logice asystenta: protokół agenta, katalog akcji, narzędzia odczytu, koszty,
  streaming, lektor — bez zmian.
- Etykiety/foldery rozmów, wyszukiwanie w historii, udostępnianie rozmów.
- Tryb pracy w obszarze treści na telefonie i na wąskim ekranie.
- Zmiana układu dolnego rzędu akcji kompozytora (obraz, poziom, mikrofon, wyślij) poza tym, co
  wymusza naprawa menu poziomu.

## 6. Wpływ na Omnia

- **Uprawnienie / RBAC:** bez zmian. Asystent to chrom powłoki dostępny dla każdej zalogowanej
  osoby; przełącznik trybu administratora w menu drugiego planu zachowuje dzisiejszy warunek
  `isAdmin` (C-22).
- **Własność danych:** wyłącznie per użytkownik. Rozmowy asystenta i preferencje asystenta są
  osobiste — nie mają i nie dostają własności zespołowej. Zmiana dokłada trwałe oznaczenie
  rozmowy oraz trwały wybór trybu prezentacji, oba na koncie (C-21, C-12 — rodzaje jako `String`
  + typ TS, nigdy enum Prisma).
- **Asystent AI:** brak nowej `AIAction` i brak nowego narzędzia odczytu. Zapisywanie rozmowy jest
  czynnością człowieka w interfejsie, nie akcją modelu — asystent nie zapisuje sobie sam rozmów
  (C-23 nie dotyczy).
- **Kalendarz / powiadomienia / trash:** nie dotyczy. Usunięcie rozmowy zachowuje dzisiejsze
  zachowanie (rozmowy asystenta nie idą do kosza) — zmiana dotyczy miejsca akcji, nie jej skutku.

## 7. Zgodność z konstytucją

- **C-53 (minimalizm)** — reguła prowadząca całego przebiegu. Cztery zgłoszenia to zmiany w ramie
  asystenta; nie przepisujemy jego wnętrza i nie dokładamy abstrakcji „na przyszłość".
- **C-31 (mobile-first, cele dotyku, safe-area)** — sedno zgłoszenia 1: przy 360 px nic nie nachodzi,
  każdy cel ≥ 44 × 44 px, dolne krawędzie respektują `env(safe-area-inset-bottom)`.
- **C-30 (motyw przez zmienne CSS)** — nowe elementy (menu akcji, zakładki list, rama trybu
  w obszarze treści) biorą kolory ze zmiennych; żadnych hexów.
- **C-32 (teksty przez `t()`, polski jako źródło)** — wszystkie nowe napisy do `messages/pl.json`;
  bramka `check:i18n` jest dziś regułą bezwzględną, więc literał z polskim znakiem wywala build.
- **C-34 (potwierdzenia przez `confirmDialog`)** — usunięcie rozmowy z menu akcji potwierdzamy
  jawnie zadeklarowaną operacją niszczącą, nigdy `window.confirm`.
- **C-10 / C-11 / C-12 (baza)** — trwałe oznaczenie rozmowy i trwały wybór trybu wymagają **ręcznie
  napisanego pliku migracji** o kolejnym wolnym numerze; rodzaje jako `String` + union TS.
- **C-20 (Server Actions z `revalidatePath`)** — zapis oznaczenia rozmowy i wyboru trybu idą przez
  akcje serwerowe, nie przez trasy API.
- **C-33 (kontrakt widoku)** — asystent nie jest widokiem modułu i nie rysuje `ModuleView`; tryb
  pracy w obszarze treści **nie może** złamać kontraktu widoku modułów — moduł zostaje pod spodem
  nienaruszony, a nie zastąpiony.
- **C-36 (granica `platform/` ↔ `modules/`)** — powłoka nie sięga do wnętrza żadnego modułu; tryb
  prezentacji jest sprawą powłoki i preferencji użytkownika.
- **C-50 / C-51 / C-52 / C-52a** — „gotowe" = zielony `npm run build`; lekcje do `doświadczenia.md`;
  merge do `develop` i promocja `develop → master` automatycznie, `--ff-only`.

## 8. Otwarte pytania / decyzje właściciela

Zadane w jednym wywołaniu na etapie `/specify` (C-55). Odpowiedzi:

- [x] **Odchudzenie górnego paska** → **menu ⋮ dla akcji drugiego planu**. W pasku zostają: nazwa
      asystenta, znacznik trybu automatycznego, „nowa rozmowa", historia, ⋮, zamknięcie. Pod ⋮ idą:
      ustawienia asystenta, zgłoszenie problemu, przełącznik trybu administratora oraz akcje
      bieżącej rozmowy. Chip „auto" na wąskim ekranie zwija się do ikony.
- [x] **Oznaczanie rozmów** → **osobna lista „Zapisane"** jako druga zakładka w szufladzie historii
      (właściciel wybrał wariant z jawnym rozdziałem list, nie sekcję przypiętych na górze jednej
      listy). Nośnikiem pozostaje trwałe oznaczenie na rozmowie — bez nowej tabeli i bez etykiet.
- [x] **Akcje bieżącej rozmowy** → **w menu ⋮ w nagłówku asystenta**. Kompozytor zostaje przy tym,
      co dotyczy wysyłanej wiadomości.
- [x] **Dokowanie na komputerze** → **asystent w miejscu treści modułu, przy czym treść jest tylko
      UKRYWANA**. Wprost od właściciela: „główna treść ma zostać tylko ukryta, więc nie zmieniamy
      URL. Kontekst dla asystenta powinien być dostępny." Z tego wynikają trzy wiążące warunki,
      pilnowane przez AC-14…AC-16: adres strony bez zmian, stan modułu zachowany (ukrycie, nie
      porzucenie), kontekst bieżącej strony nadal dostępny dla asystenta.

Założenia przyjęte samodzielnie (nie wymagały pytania):

- Tryb pracy w obszarze treści włącza się i wyłącza z nagłówka asystenta i jest zapamiętany na
  koncie — konsekwentnie z resztą preferencji asystenta.
- Rozmowa bez ani jednej tury nie daje się zapisać (nie ma czego zapisywać).
- Zakładka otwierana domyślnie po wejściu w historię to **Historia** — zachowuje dzisiejsze
  zachowanie dla kogoś, kto niczego nie zapisał.

## 9. Ryzyka

- **Ukrycie treści zamiast odmontowania może przeciekać** (uwięziony fokus, czytnik ekranu czytający
  ukrytą stronę, skróty klawiszowe modułu łapiące klawisze pisane do asystenta) → warunkiem
  odbioru jest, że ukryta treść jest niedostępna dla fokusu i technologii asystujących, a nie tylko
  niewidoczna.
- **Menu ⋮ chowa funkcje, więc może je „schować za dobrze"** — dokładnie ta lekcja padła w przebiegu
  100 (przełącznik segmentowy w Wiadomościach zastąpił ⋮, bo menu nie mówi ani co jest dostępne,
  ani co jest wybrane) → dlatego stan, który musi być widoczny stale (tryb automatyczny), zostaje
  **w pasku** jako znacznik, a pod ⋮ idą wyłącznie **czynności**, nigdy wskaźniki stanu.
- **Dwie listy rozmów mogą rozjechać się z licznikami** (rozmowa widoczna na obu albo na żadnej) →
  jedno źródło prawdy dla podziału i test na przejściu rozmowy między listami (AC-9, AC-10).
- **Migracja na istniejących rozmowach** → wartość domyślna musi odtwarzać dzisiejsze zachowanie:
  wszystko historyczne, nic zapisane (AC-13).
- **Regres na telefonie przy okazji zmian desktopowych** → tryb pracy w obszarze treści jest
  dostępny wyłącznie od szerokości desktopowej i nie zmienia ścieżki mobilnej (AC-18).
