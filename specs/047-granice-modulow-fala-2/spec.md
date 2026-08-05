# Spec: Granice modułów — Faza 1, fala 2

- **ID:** 047-granice-modulow-fala-2
- **Status:** draft
- **Autor sesji:** Claude Code (spec-driven pipeline)
- **Data:** 2026-08-05
- **Moduł(y):** Nawyki, Nauka języków, Notatki, Warsztaty, Magazynowanie, Flota, Zdrowie (+ dług z QA i klikaczy)

> **Zasada speca:** opisujemy **CO i DLACZEGO**, nigdy **JAK**.

## 1. Problem / potrzeba

Przebieg 046 postawił granice modułów i **udowodnił wzorzec na czterech modułach** — ale 17 z 21
modułów nadal leży rozsypanych po `src/actions`, `src/components` i `src/lib`. Dopóki tak jest,
korzyść z przebudowy jest częściowa i, co gorsza, **odwracalna**: reguła granic nie chroni kodu, który
do modułów jeszcze nie trafił, a lista przejściowa kusi, żeby dopisać do niej kolejny wpis zamiast
utworzyć katalog. Rozdz. 14 ostrzega wprost — granice bez konsekwentnego domykania erodują.

Do tego przebieg 046 zostawił trzy **nazwane** długi, których dalsze noszenie kosztuje: panel admina QA
omija kontrakt własnego modułu, a środowisko klikaczy nie ma danych z seeda, przez co 16 testów świeci
na czerwono z powodów niezwiązanych z kodem. To drugie jest groźniejsze, niż wygląda: **psuje wartość
sygnału** — „czerwony" przestaje znaczyć „regresja", więc następna prawdziwa regresja utonie w szumie.

## 2. Cel i miary sukcesu

- **Cel:** przenieść kolejną falę modułów do `src/modules/` tym samym, sprawdzonym wzorcem, tak by
  lista przejściowa realnie się skurczyła, a nie tylko została opisana.
- **Sukces mierzymy:**
  - liczba modułów w `src/modules/` rośnie z **4** do co najmniej **10**, a lista przejściowa
    w rejestrze maleje z 17 do co najwyżej 11;
  - **zero** zmian widocznych dla użytkownika — klikacz ścieżki szczęśliwej nadal 21/21;
  - pełny zestaw klikaczy przestaje kłamać: czerwone testy z braku danych znikają, a wynik da się
    czytać jako sygnał o regresji.

## 3. Historyjki użytkownika

- Jako **właściciel systemu** chcę, żeby dodanie nowego modułu wymagało jednego katalogu, a nie wpisu
  w kilku listach — więc chcę, żeby modułów objętych tą regułą było jak najwięcej.
- Jako **osoba rozwijająca Omnię** chcę, żeby czerwony klikacz oznaczał realną regresję, a nie brak
  danych w środowisku — inaczej przestanę na niego patrzeć.
- Jako **osoba czytająca dokument architektury** chcę wiedzieć po tej fali dokładnie, ile modułów
  zostało i dlaczego akurat te — żeby kolejna sesja nie musiała tego wnioskować z historii gita.
- Jako **użytkownik aplikacji** nie chcę zauważyć niczego: te same ekrany, te same adresy, te same
  uprawnienia.

## 4. Kryteria akceptacji (testowalne)

**Przenoszenie modułów**

- [ ] **AC-1** — Given moduł objęty tą falą, when patrzę na jego katalog, then zawiera wszystko, czego
      moduł potrzebuje (akcje, komponenty, logika własna, kontrakt, deklaracja), a jego trasy
      w aplikacji pozostają cienkie.
- [ ] **AC-2** — Given konsument spoza modułu (asystent AI, pulpit, powłoka), when korzysta
      z przeniesionego modułu, then robi to **wyłącznie przez jego kontrakt**, nigdy przez wnętrze.
- [ ] **AC-3** — Given przeniesiony moduł, when szukam jego wpisu na liście przejściowej rejestru
      i w słowniku uprawnień, then **nie ma go tam** — jego tożsamość wynika z deklaracji.
- [ ] **AC-4** — Given moduł, którego nie da się przenieść bez zmiany zachowania, when kończę falę,
      then jest to **jawnie odnotowane z powodem**, a nie po cichu pominięte.

**Dług z przebiegu 046**

- [ ] **AC-5** — Given panel administracyjny QA, when wyświetla drzewo scenariuszy, then pobiera dane
      przez kontrakt modułu QA, a nie z pominięciem granicy.
- [ ] **AC-6** — Given środowisko uruchamiania klikaczy, when odpalam pełny zestaw, then testy
      wymagające danych mają te dane — czerwony wynik oznacza regresję, a nie puste tabele.
- [ ] **AC-7** — Given zakończona fala, when czytam dziennik przebudowy, then wiem, ile modułów jest
      przeniesionych, ile zostało, które to są i co jeszcze blokuje domknięcie zadania 5.

**Brak regresji**

- [ ] **AC-8** — Given przeniesione moduły, when uruchamiam klikacz ścieżki szczęśliwej, then
      **21/21 modułów** otwiera się bez błędu, dokładnie jak przed falą.
- [ ] **AC-9** — Given cała aplikacja, when uruchamiam komplet bramek i budowanie, then wszystko
      przechodzi — w tym granice modułów, rejestr modułów, kontrakt widoku, pokrycie akcji AI
      i kontrola dostępu, przy **niezmienionej** liczbie akcji objętych kontrolą.
- [ ] **AC-10** — Given historia zmian tej fali, when ją przeglądam, then przenosiny są oddzielone od
      poprawek: żaden commit nie miesza przeniesienia plików ze zmianą zachowania.

## 5. Zakres

**W zakresie:**
- Przeniesienie do `src/modules/` modułów: **Nawyki, Nauka języków, Notatki, Warsztaty,
  Magazynowanie, Flota, Zdrowie** — każdy osobnym commitem, z kontraktem i deklaracją, z usunięciem
  wpisu z listy przejściowej i ze słownika uprawnień.
- Przejście konsumentów zewnętrznych (egzekutory asystenta, narzędzia odczytu, pulpit) na kontrakty.
- Spłata długu 046: panel admina QA przez kontrakt; dane z seeda w środowisku klikaczy.
- Aktualizacja dziennika przebudowy: statusy zadań, **jawna lista modułów wciąż czekających**.

**Poza zakresem (świadomie):**
- Pozostałe moduły (Strona główna, Kalendarz, Zakupy, Zadania, Zwierzęta, Kuchnia, Wiadomości, Pogoda,
  Usługi, Portfel) — najbardziej sprzężone, w tym te zasilające pulpit i kalendarz; kolejna fala.
- Przeniesienie zdolności platformy `ai`, `llm`, `jobs` — wymagają własnego przebiegu.
- **Zadanie 8** (asystent AI składany z deklaracji) — dokument stawia je ostatnim w fazie.
- Wyprowadzenie pulpitu i kalendarza z deklaracji — sensowne dopiero, gdy w `src/modules/` będą
  moduły, które je zasilają.
- Zaostrzenie bramki rejestru tak, by wykrywała moduł napisany „po staremu" — możliwe dopiero przy
  pustej liście przejściowej; po tej fali odnotowujemy jedynie, ile zostało.
- Jakakolwiek zmiana funkcjonalna w przenoszonych modułach.

## 6. Wpływ na Omnia

- **Uprawnienie / RBAC:** bez nowych slugów. Uprawnienia przenoszonych modułów **przenoszą się do ich
  deklaracji**; slugi w bazie i przypisania ról pozostają nietknięte. Wymagane: ścieżki tych modułów
  nadal muszą być zablokowane dla użytkownika bez uprawnienia (C-22).
- **Własność danych:** bez zmian — `ownerId`/`ownerTeamId` i guardy dostępu przenoszą się razem
  z akcjami, bez modyfikacji treści (C-21).
- **Asystent AI:** bez nowych `AIAction` ani read-tooli. Zmienia się **wyłącznie ścieżka importu**
  w egzekutorach i narzędziach odczytu — z wnętrza modułu na jego kontrakt. Liczba akcji objętych
  bramkami pokrycia i kontroli dostępu musi zostać **taka sama** (C-23).
- **Kalendarz / powiadomienia / trash:** bez zmian. Zdrowie i Flota zasilają kalendarz — agregat
  przechodzi na kontrakty tych modułów, ale jego wynik pozostaje identyczny.
- **Baza danych:** **bez migracji.** Fala nie dotyka schematu.

## 7. Zgodność z konstytucją

- **C-36** — reguła tej fali w całości: granica `platform/` ↔ `modules/`, kontrakt jako jedyne wejście,
  własne wnętrze ścieżką względną, jedna deklaracja zamiast list.
- **C-02** — alias `@/*` na zewnątrz, ścieżka względna wewnątrz modułu (wyjątek z C-36).
- **C-21, C-22** — własność i RBAC bez zmian; guardy przenoszą się razem z akcjami.
- **C-23** — egzekutory i read-toole asystenta importują kontrakt; pokrycie akcji bez ubytku.
- **C-53** — minimalizm: powtarzamy sprawdzony wzorzec z 046, nie wymyślamy nowego. Kontrakt zawiera
  to, czego potrzebują konsumenci, i nic ponadto.
- **C-50** — „gotowe" = `npm run build` przechodzi, z kompletem bramek.
- **C-51** — nieoczywiste problemy trafiają do `doświadczenia.md`.
- **C-10..C-14** — **nie dotyczą**: brak zmian schematu; potwierdzi to bramka rozjazdu.

## 8. Otwarte pytania / decyzje właściciela

Brak — zakres jest jednoznaczny, a wzorzec przenoszenia został rozstrzygnięty i sprawdzony w 046.
Decyzje przyjęte domyślnie, odnotowane tutaj:

- **Kolejność przenoszenia: od najmniej do najbardziej sprzężonych** (Nawyki → Nauka języków →
  Warsztaty → Magazynowanie → Notatki → Flota → Zdrowie). Ten sam powód co w 046: wzorzec ma być
  sprawdzony na module z jednym konsumentem, zanim dotknie modułu zasilającego pulpit i kalendarz.
- **Moduł zbyt sprzężony zostaje na liście przejściowej.** Cel fali to sprawdzone przeniesienie, a nie
  liczba w raporcie; forsowanie modułu kosztem zmiany zachowania łamie warunek brzegowy.
- **Seed w środowisku klikaczy uruchamiamy istniejącym mechanizmem**, bez pisania drugiego zestawu
  danych testowych obok już istniejącego.

## 9. Ryzyka

- **Moduł okazuje się bardziej sprzężony, niż wynika z liczby importów** (np. współdzieli helper
  z modułem nieprzeniesionym) → przenosimy pojedynczo, po każdym module kontrola typów; przy realnym
  splocie zostawiamy moduł na liście i odnotowujemy powód (AC-4).
- **Kontrakt rozdmuchany do rozmiaru spisu eksportów** → kontrakt piszemy **po** ustaleniu, czego
  faktycznie potrzebują konsumenci; rosnący kontrakt traktujemy jako sygnał, nie jako cel.
- **Ciche osłabienie kontroli dostępu przy przenoszeniu akcji** (dokładnie to, co 046 wykrył
  w bramkach) → po każdym module sprawdzamy, czy liczba akcji objętych kontrolą dostępu i pokryciem AI
  **nie spadła**.
- **Seed w klikaczach wydłuża i destabilizuje przebieg** → jeśli okaże się, że pełny zestaw danych jest
  za ciężki, ograniczamy się do danych faktycznie wymaganych przez testy i mówimy o tym wprost.
- **Diff wielkości fali utrudnia recenzję** → jeden commit na moduł, przenosiny bez zmian funkcji,
  poprawki osobno (AC-10) — ta sama dyscyplina, która sprawdziła się w 046.
