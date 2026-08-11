# Spec: Platforma AI i domknięcie Fazy 1

- **ID:** 049-platforma-ai-domkniecie-fazy-1
- **Status:** draft
- **Autor sesji:** Claude Code (spec-driven pipeline)
- **Data:** 2026-08-11
- **Moduł(y):** warstwa platformy (`ai`, `llm`, `jobs`) + wkład wszystkich 21 modułów do pulpitu,
  kalendarza, asystenta i kolejki zadań

> **Zasada speca:** opisujemy **CO i DLACZEGO**, nigdy **JAK**.

## 1. Problem / potrzeba

Trzy fale przeniosły **21 z 21 modułów** za granicę. Faza 1 wygląda więc na skończoną — i nie jest,
bo **największa zdolność systemu została poza platformą**: warstwa AI (25 plików, 97 importujących),
LLM (8 / 64) i kolejka zadań (5 / 44). Dopóki tam leży, „platforma" jest niepełna dokładnie w tym
miejscu, w którym Omnia jest najbardziej wyjątkowa.

Sedno problemu nie jest jednak w liczbie plików, tylko w **kierunku zależności**. Osiemnaście plików
w `lib/ai` i `lib/jobs` importuje dziś moduły: egzekutory akcji wołają kontrakty (jeden egzekutor na
moduł), read-toole odpytują dwadzieścia modułów, a połowa handlerów kolejki to zadania konkretnych
modułów (przepisy Kuchni, dokumenty Magazynowania, odświeżanie Wiadomości). Gdyby ten kod przenieść
do `src/platform/` „jak leci", **złamałby regułę, dla której cała Faza 1 powstała** (C-36: platforma
nie zna żadnego modułu). Rozdz. 9.6 rozstrzyga to wprost: katalog asystenta ma być **składany
z deklaracji modułów**, a nie utrzymywany ręcznie obok rejestru. Zadania 4 i 8 są więc **jednym
ruchem**, nie dwoma — i to jest ustalenie, które ten przebieg musi obsłużyć, zamiast zderzyć się
z nim w połowie.

Do tego dochodzi reszta zadania 7: **pulpit i kalendarz** stały się modułami dopiero w fali 3, więc
ich wkład wciąż jest listą utrzymywaną ręcznie obok rejestru — ostatnie dwie „równoległe listy",
które przetrwały cel „8 → 1".

## 2. Cel i miary sukcesu

- **Cel:** domknąć Fazę 1 — platforma kompletna i **niezależna od modułów**, a wkład modułu do
  pulpitu, kalendarza, asystenta i kolejki zadań pochodzi **z jego deklaracji**.
- **Sukces mierzymy:**
  - `src/lib/{ai,llm,jobs}` przestaje istnieć jako miejsce kodu platformowego — zdolności są
    w `src/platform/`, a kod modułowy w modułach;
  - **zero** importów `@/modules/*` z `src/platform/**` (dziś: 18 plików);
  - liczba **równoległych list** opisujących moduł: **0** — kafelek pulpitu, wkład do kalendarza,
    akcje i odczyty asystenta oraz zadania w tle wynikają z jednej deklaracji;
  - na pytanie kontrolne z rozdz. 14 („ile miejsc trzeba dotknąć, żeby dodać moduł?") da się
    odpowiedzieć **kodem**: jeden katalog;
  - **zero** zmian widocznych dla użytkownika — te same ekrany, te same odpowiedzi asystenta;
  - żadna bramka nie spada: `check:actions` 160, `check:ai-coverage` 551, `check:cost-badge` 35,
    `check:content-memory` 35.

## 3. Historyjki użytkownika

- Jako **właściciel systemu** chcę, żeby dodanie modułu z własnym kafelkiem pulpitu, wkładem do
  kalendarza i akcjami asystenta wymagało jednego katalogu — bez dopisywania się do czterech list
  w cudzych plikach.
- Jako **osoba rozwijająca Omnię** chcę, żeby platforma nie znała nazw modułów — inaczej „warstwa
  wspólna" jest tylko nową nazwą na to samo splątanie.
- Jako **osoba czytająca deklarację modułu** chcę zobaczyć w jednym pliku wszystko, czym ten moduł
  jest dla reszty systemu: menu, uprawnienie, nawigację, kafelek, kalendarz, AI i zadania w tle.
- Jako **użytkownik aplikacji** nie chcę zauważyć niczego: ten sam pulpit, ten sam kalendarz, ten sam
  asystent odpowiadający tak samo.

## 4. Kryteria akceptacji (testowalne)

**Platforma kompletna i niezależna (zadanie 4)**

- [ ] **AC-1** — Given zdolność niezależna od modułu (rozmowa z modelem, routing modeli, koszt,
      pamięć treści, kolejka zadań, protokół agenta), when sprawdzam, gdzie mieszka, then jest
      w warstwie platformy.
- [ ] **AC-2** — Given warstwa platformy, when sprawdzam **wszystkie** jej importy, then **żaden**
      nie sięga do modułu — ani do wnętrza, ani do kontraktu.
- [ ] **AC-3** — Given zdolność platformy, która potrzebuje wiedzy modułowej, when jej używam, then
      dostaje tę wiedzę **parametrem wymaganym**, wstrzykniętym z korzenia kompozycji. Parametr
      opcjonalny z „historycznym" domyślnym jest **niedopuszczalny** — zapomniany argument stałby się
      cichym wyciekiem uprawnień.

**Wkład modułu z deklaracji (reszta zadania 7 + zadanie 8)**

- [ ] **AC-4** — Given moduł wnoszący dane do pulpitu, when pulpit je zbiera, then bierze je
      z deklaracji modułu, a nie z ręcznej listy w trasie.
      **Korekta z `/plan` (C-54):** spec zakładał za rozdz. 9.3 „kafelek pulpitu" (`dashboard: () =>
      import("./ui/DashboardCard")`). **W Omnii takich kafelków nie ma** — pulpit składa się z sekcji
      przekrojowych (briefing, ulubione, „dziś", siatka modułów, szybkie akcje, sugestie, ostatnio
      używane), a nie z kafelków per moduł. Realne sprzężenie jest gdzie indziej i jest dokładnie tym,
      co rozdz. 9.3 chce usunąć: **trasa pulpitu importuje osiem kontraktów modułów**, żeby złożyć
      migawkę. Deklaracja ma więc wnosić **wkład danych do migawki**, nie komponent kafelka.
      Wprowadzanie kafelków per moduł byłoby nową funkcją, a przebieg ma nie zmieniać niczego
      widocznego dla użytkownika (C-53).
- [ ] **AC-5** — Given moduł wnoszący zdarzenia do wspólnego kalendarza, when kalendarz składa
      agendę, then pyta o nie deklarację — zamiast mieć gałąź `if` na każdy moduł.
- [ ] **AC-6** — Given asystent AI, when buduje katalog akcji, odczytów i nawigacji, then składa go
      z deklaracji modułów. **Moduł bez deklaracji nie istnieje dla asystenta** — i to jest gwarancja
      mocniejsza niż dzisiejsza kompletność ręcznej listy (rozdz. 9.6).
- [ ] **AC-7** — Given zadanie w tle należące do konkretnego modułu, when sprawdzam, gdzie mieszka
      jego obsługa, then jest w tym module, a lista dozwolonych zadań wynika z deklaracji.

**Brak regresji — to jest najostrzejszy warunek tego przebiegu**

- [ ] **AC-8** — Given asystent AI, when wykonuję te same polecenia co przed przebiegiem, then
      odpowiada tak samo: te same akcje do zatwierdzenia, te same odczyty, ta sama nawigacja.
- [ ] **AC-9** — Given pulpit i kalendarz, when je otwieram, then pokazują dokładnie to samo co
      przed przebiegiem — ta sama zawartość, ta sama kolejność sekcji.
- [ ] **AC-10** — Given komplet bramek i budowanie, when je uruchamiam, then wszystko przechodzi,
      a **żadna** z czterech bramek liczących akcje nie spada.
- [ ] **AC-11** — Given bramka zaszyta na ścieżki plików, when przenosiny ją wywrócą, then **bramkę
      naprawiamy**, a nie obchodzimy — to trzeci taki przypadek w tej przebudowie i wzorzec jest już
      nazwany w `doświadczenia.md`.
- [ ] **AC-12** — Given klikacz ścieżki szczęśliwej, when go uruchamiam, then 21/21 modułów otwiera
      się bez błędu, a liczba czerwonych w pełnym zestawie **nie rośnie**.

**Domknięcie fazy**

- [ ] **AC-13** — Given historia zmian, when ją przeglądam, then przenosiny są oddzielone od zmian
      zachowania: żaden commit nie miesza jednego z drugim.
- [ ] **AC-14** — Given pytanie „ile miejsc trzeba dotknąć, żeby dodać moduł?", when odpowiadam,
      then odpowiedzią jest **kod**: bramka, która wykrywa moduł opisany gdziekolwiek poza własnym
      katalogiem i deklaracją.
- [ ] **AC-15** — Given dziennik przebudowy, when go czytam po tym przebiegu, then wiem, czy Faza 1
      jest domknięta, co dokładnie z niej zostało i co jest pierwszym krokiem Fazy 2.

## 5. Zakres

**W zakresie:**
- **Zadanie 4 do końca** — zdolności `ai`, `llm`, `jobs` w warstwie platformy, z zachowaniem
  asymetrii: platforma nie zna modułu.
- **Rozdzielenie kodu modułowego od platformowego w tych trzech obszarach** — egzekutory akcji,
  read-toole i zadania w tle konkretnych modułów wracają do swoich modułów. To nie jest dodatek do
  zadania 4, tylko **warunek jego wykonania**.
- **Reszta zadania 7** — kafelek pulpitu i wkład do kalendarza z deklaracji.
- **Zadanie 8** — katalog asystenta składany z deklaracji.
- **Zaostrzenie bramki rejestru** o nowe pola deklaracji, tak by moduł opisany poza własnym
  katalogiem był wykrywany (AC-14).
- Aktualizacja rozdz. 15 dziennika: stan Fazy 1 i pierwszy krok Fazy 2.

**Poza zakresem (świadomie):**
- **Pole `resources` w deklaracji** (rozdz. 8.4 / 9.3) — należy do Fazy 2, bo ma sens dopiero
  z modelami `Workspace`/`ResourceGrant`.
- **Pola `subscribes` i zdarzenia domenowe** (rozdz. 9.4) — cała Faza 4.
- **Wymaganie z rozdz. 9.6, żeby read-toole asystenta przechodziły przez `requireAccess`** — to
  realne zagrożenie bezpieczeństwa i **musi** zostać zrobione, ale `requireAccess` powstaje dopiero
  w zadaniu 10 (Faza 2). Tu odnotowane jawnie, żeby nie zginęło.
- **Pole `shortcuts` w deklaracji** — rejestr skrótów z 043 działa i nikt się o niego nie potyka
  (C-53).
- Jakakolwiek zmiana funkcjonalna w asystencie, pulpicie czy kalendarzu.
- **Faza 2** w całości.

**Świadome ograniczenie przebiegu:** jeśli pełny zakres nie zmieści się w jednym przebiegu,
priorytetem jest **czysta granica**, nie liczba domkniętych zadań. Wtedy: platforma przeniesiona,
reszta zatrzymana z **jawnym** raportem w dzienniku i żadne z trzech zadań nie zostaje przemilczane.
Zatrzymanie się na czystej linii jest wynikiem; zostawienie warstwy AI w połowie migracji **nie jest**.

## 6. Wpływ na Omnia

- **Uprawnienie / RBAC:** bez nowych slugów. Sprawdzanie uprawnień w egzekutorach i read-toolach
  **nie zmienia się co do treści** — zmienia się tylko miejsce kodu. Każdy guard jedzie razem ze swoją
  akcją (C-21, C-22).
- **Własność danych:** bez zmian; zero migracji.
- **Asystent AI:** **zero nowych `AIAction`, zero nowych read-tooli.** Zmienia się wyłącznie to,
  **skąd** katalog jest składany. Liczba akcji objętych bramkami nie może spaść (C-23).
- **Kalendarz:** agregat ma zwracać **identyczny** wynik — czyta dane sześciu modułów, więc jest
  najostrzejszym testem tego przebiegu, tak samo jak w fali 3.
- **Powiadomienia / trash:** bez zmian.
- **Baza danych:** **bez migracji** — potwierdzi bramka rozjazdu schematu.

## 7. Zgodność z konstytucją

- **C-36** — reguła wiodąca. Asymetria „platforma nie zna modułu" jest tu **testem granicznym**:
  jeśli przetrwa najsilniej sprzężony element systemu, przetrwa wszystko.
- **C-02** — alias na zewnątrz, ścieżka względna wewnątrz modułu.
- **C-23** — każda `AIAction` ma egzekutor; po zmianie źródła katalogu bramka pilnuje **mocniejszej**
  własności: czy każdy moduł zadeklarował swoje akcje.
- **C-40, C-41** — routing modeli zostaje DB-driven, klucze nadal szyfrowane i maskowane; przenosiny
  nie mogą tego dotknąć.
- **C-21, C-22** — własność i RBAC bez zmian co do treści.
- **C-53** — powtarzamy wzorzec `sideNav` z 048 (pole deklaracji, ładowane leniwie). Nowe są tylko
  te pola, których przebieg **wymaga**.
- **C-50, C-51** — build zielony; nieoczywiste problemy do `doświadczenia.md`.
- **C-10..C-14** — **nie dotyczą**: brak zmian schematu.

## 8. Otwarte pytania / decyzje właściciela

Brak pytań. Właściciel zlecił przeprowadzenie pipeline'u automatycznie i **z góry rozstrzygnął
jedyną decyzję, która wymagałaby pytania** (co zrobić, gdy zakres nie mieści się w przebiegu —
patrz „Świadome ograniczenie przebiegu"). Pozostałe rozstrzygnięcia wynikają z dokumentu i
konstytucji; zapisane tu jako założenia:

- **Zadania 4 i 8 robimy razem, bo są jednym ruchem.** Egzekutorów i read-tooli nie da się przenieść
  do platformy bez złamania C-36, a nie da się ich zostawić w `src/lib`, bo wtedy zadanie 4 nie jest
  skończone. Rozdz. 9.6 wskazuje wyjście: wracają do modułów i są składane z deklaracji.
- **Zadania w tle konkretnych modułów też wracają do modułów**, a lista dozwolonych zadań wynika
  z deklaracji. Rozdz. 9.3 nie wymienia takiego pola, ale zasada jest ta sama co przy asystencie:
  handler wołający kontrakt modułu **nie może** mieszkać w platformie. Wybór między „nowe pole
  deklaracji" a „wyjątek od C-36" rozstrzygamy na korzyść reguły.
- **Kolejność: platforma → pulpit i kalendarz → asystent → zadania w tle.** Asystent jest najsilniej
  sprzężony, więc idzie po tym, jak wzorzec sprawdzi się na dwóch prostszych polach — dokładnie tak,
  jak rozdz. 9.6 nakazuje migrować go jako ostatni.
- **Jeden commit na spójny krok**, przenosiny oddzielone od zmian zachowania (jak w 046–048).

## 9. Ryzyka

- **To jest najbardziej sprzężony element systemu** (rozdz. 9.6 nazywa go wprost) → kolejność od
  najprostszego pola deklaracji do najtrudniejszego; komplet bramek po każdym kroku; przy realnym
  ryzyku utraty kontroli — zatrzymanie na czystej linii z jawnym raportem.
- **Cztery bramki liczą dokładnie ten kod, który przenosimy** (akcje, pokrycie dostępu, licznik
  kosztu, pamięć treści) → sprawdzane po **każdym** kroku, nie na końcu. Dwie z nich już raz
  wywróciły się na przenosinach (047, 048), więc zakładamy, że wywrócą się znowu — i że to bramkę
  się naprawia, nie obchodzi.
- **Zmiana źródła katalogu asystenta może po cichu zgubić akcję** — najgroźniejszy scenariusz całego
  przebiegu, bo objawiłby się dopiero w rozmowie z użytkownikiem, a nie w buildzie. Ograniczenie:
  liczba akcji jest **mierzona przed i po**, a bramka pilnuje kompletności deklaracji zamiast
  kompletności ręcznej listy.
- **Kalendarz i pulpit czytają wiele modułów** → wynik agregatu porównany przed/po.
- **Przebieg jest duży** → jeden commit na krok, zmiany zachowania osobno, klikacz po każdej zmianie
  dotykającej powłoki.
