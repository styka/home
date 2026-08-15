# Spec: Publikacja zdarzeń domenowych — outbox dostaje czytelnika

- **ID:** 071-publikacja-zdarzen
- **Status:** draft
- **Autor sesji:** Claude Code (spec-driven pipeline)
- **Data:** 2026-08-15
- **Moduł(y):** platforma (worker zdarzeń) + pierwszy prawdziwy subskrybent

## 1. Problem / potrzeba

Przebieg 070 dowiózł **outbox bez czytelnika** — i tak miało być. Zdarzenia domenowe zapisują się
atomowo z mutacją, trafiają do właściwej przestrzeni, niosą sprawcę i czekają z `deliveredAt = null`.
**Nikt ich nie czyta.** Dziennik rośnie, a integracje międzymodułowe nadal działają tak, jak przed
Fazą 4: bezpośrednim wywołaniem w tej samej ścieżce.

Dopóki tak jest, cała Faza 4 nie przyniosła użytkownikowi niczego. Problem z rozdz. 9.1 —
*awaria Portfela zabiera zakupy* — stoi nietknięty, bo `bookAutoExpense` nadal jest wołane wprost.

Rozdz. 9.4.3 opisuje brakujący element w trzech krokach: worker czyta niedostarczone zdarzenia,
**wywołuje subskrybentów zadeklarowanych w module**, oznacza `deliveredAt`.

**Sedno tego przebiegu to gwarancja, nie mechanika.** Rozdz. 9.4.4 rozstrzyga świadomie i wprost:
dostarczenie jest **co najmniej raz**, nigdy dokładnie raz („koszt nieproporcjonalny do zysku").
Z tego wynika **twarde wymaganie dla każdego subskrybenta**: *musi wytrzymać dwukrotne wywołanie
tym samym zdarzeniem*. Subskrybent, który tego nie robi, przy pierwszym ponowieniu zaksięguje
wydatek drugi raz — i **nikt tego nie zauważy**, bo obie operacje wyglądają na poprawne.

To nie jest ryzyko teoretyczne: ponowienie następuje zawsze, gdy worker padnie **po** wykonaniu
subskrybenta, a **przed** oznaczeniem zdarzenia jako dostarczone. Tego okna nie da się zamknąć —
można je tylko uczynić nieszkodliwym.

## 2. Cel i miary sukcesu

- **Cel:** zdarzenia z dziennika **docierają do subskrybentów**, dokładnie raz *w skutkach* mimo
  dostarczenia „co najmniej raz" — bo idempotencja jest **wymuszona**, a nie zalecana.

- **Sukces mierzymy:**
  1. **Dwukrotne dostarczenie tego samego zdarzenia daje ten sam stan** co jednokrotne. Dowiedzione
     testem, który celowo dostarcza dwa razy.
  2. Zdarzenie, którego subskrybent **padł**, zostaje niedostarczone i **wraca** w kolejnym obiegu —
     nie ginie i nie blokuje pozostałych.
  3. **Wielu workerów nie dostarcza tego samego zdarzenia równolegle** (ten sam wymóg co w kolejce
     zadań: produkcja i środowisko testowe potrafią mieć więcej niż jedną instancję).
  4. Subskrybenci pochodzą **z deklaracji modułu**, nie z listy w platformie — dodanie reakcji nie
     wymaga edycji cudzego pliku.
  5. Mechanizm ma **prawdziwego subskrybenta** (C-35), nie tylko test.
  6. Zero spadku istniejących liczników; build zielony.

## 3. Historyjki użytkownika

- Jako **użytkownik** chcę, żeby awaria jednej funkcji nie blokowała drugiej — a to wymaga, żeby
  reakcja wykonała się **poza** ścieżką operacji.
- Jako **użytkownik** chcę, żeby reakcja wykonała się **raz**, nawet jeśli system ponowi próbę:
  jeden zakup to jeden wydatek w Portfelu, nie dwa.
- Jako **użytkownik** chcę, żeby reakcja, która się nie powiodła, **doszła później**, a nie znikła.
- Jako **rozwijający Omnię** chcę deklarować reakcję **u siebie w module** i nie dotykać modułu,
  który zdarzenie wysyła.

## 4. Kryteria akceptacji (testowalne)

- [ ] **AC-1** — Given zdarzenie niedostarczone, when worker wykona obieg, then subskrybent zostaje
  wywołany, a zdarzenie **oznaczone jako dostarczone**.
- [ ] **AC-2 (IDEMPOTENCJA)** — Given to samo zdarzenie dostarczone **dwa razy**, then stan
  końcowy jest **identyczny** jak po jednym dostarczeniu. Test dostarcza dwukrotnie **celowo**.
- [ ] **AC-3** — Given subskrybenta, który **rzuca**, then zdarzenie **pozostaje niedostarczone**,
  wraca w kolejnym obiegu, a **pozostałe zdarzenia są przetwarzane normalnie** (jeden zepsuty
  subskrybent nie zatrzymuje strumienia).
- [ ] **AC-4** — Given dwa workery pracujące równolegle, when oba sięgną po ten sam zestaw zdarzeń,
  then **żadne zdarzenie nie zostaje przetworzone przez obu naraz**.
- [ ] **AC-5** — Given moduł deklarujący subskrypcję, then subskrybent jest **wywoływany**, a jego
  wkład pochodzi z **deklaracji modułu** — platforma nie zna listy subskrybentów, dostaje ją
  parametrem (C-36). Deklaracja idzie po **stronie serwerowej** (lekcja z 049: wkład serwerowy
  w `module.ts` wciąga kod serwerowy do grafu klienta).
- [ ] **AC-6** — Given subskrybenta bez zabezpieczenia idempotencji, when uruchomimy build, then
  **build pada**. „Subskrybent musi być idempotentny" jako zdanie w dokumentacji jest bezwartościowe;
  musi być wymuszone.
- [ ] **AC-7** — Given każdy niezmiennik bramki osobno, when go złamiemy, then bramka **zgłasza błąd**.
- [ ] **AC-8** — Given testy tego mechanizmu, when zepsujemy mechanizm, then testy **czerwienieją**
  (weryfikacja mutacyjna jako warunek zamknięcia — lekcja z 069 i 070).
- [ ] **AC-9** — Given zdarzenie **bez** subskrybentów, then zostaje oznaczone jako dostarczone
  i **nie wraca w nieskończoność**. Zdarzenie, na które nikt nie czeka, nie może zatykać obiegu.
- [ ] **AC-10** — Given cały przebieg, then **żaden licznik nie spada**, testów przybywa, build
  zielony, a zachowanie widoczne dla użytkownika zmienia się **wyłącznie** w zakresie opisanym
  przez pierwszego subskrybenta.

## 5. Zakres

**W zakresie:**
- Worker zdarzeń: pobieranie niedostarczonych **bezpiecznie wieloworkerowo**, wywołanie
  subskrybentów, oznaczenie `deliveredAt`, ponowienie po błędzie.
- **Protokół subskrypcji** deklarowany przez moduł (strona serwerowa) + korzeń kompozycji.
- **Wymuszona idempotencja** — bramka z manifestem, nie zalecenie w komentarzu.
- **Pierwszy prawdziwy subskrybent** (C-35).
- Testy: dostarczenie, **podwójne dostarczenie**, błąd subskrybenta, brak subskrybentów,
  równoległość; weryfikacja mutacyjna.
- Wpis w dzienniku + status zadania 22.

**Poza zakresem (świadomie):**
- **`LISTEN/NOTIFY` / Redis Pub/Sub jako mechanizm wyzwalania.** Rozdz. 9.4.3 dopuszcza jedno albo
  drugie, ale oba wymagają **surowego połączenia poza Prismą** (nowa zależność), a jedyne, co
  kupują, to **niższe opóźnienie** względem obiegu co kilka sekund. Opóźnienie zaczyna mieć
  znaczenie dopiero przy **kanale czasu rzeczywistego** (zadanie 23) — i tam należy tę decyzję
  podjąć, mając realny wymóg. Do tego czasu obieg workera jest wystarczający i **nie dokłada
  zależności** (C-53).
- **Kanał SSE do przeglądarek** (zadanie 23) — worker w tym przebiegu wywołuje subskrybentów
  serwerowych, nie wypycha niczego do klienta.
- **Komplet subskrypcji międzymodułowych** (zadanie 25) — w szczególności **usunięcie**
  synchronicznego `bookAutoExpense` z Zakupów. Usunięcie wywołania jest zmianą widoczną i wymaga,
  żeby ścieżka zdarzeniowa była wcześniej sprawdzona w boju.
- **Retencja dziennika** (zadanie 30) — `deliveredAt` oznacza dostarczenie, nie kasuje wiersza.
- **Etap 4 zadania 11 i etap 2 zadania 12** — zablokowane warunkiem produkcyjnym.

## 6. Wpływ na Omnia

- **Uprawnienie / RBAC:** brak nowych slugów. Worker działa **bez sesji** — to jest istotne
  i ma konsekwencję: subskrybent nie może polegać na `requireAuth`, a dostęp musi wynikać
  z samego zdarzenia (przestrzeń + sprawca).
- **Własność danych:** zdarzenie niesie `workspaceId`; subskrybent działa **w tej przestrzeni**.
- **Asystent AI:** nie dotyczy.
- **Powiadomienia:** naturalny przyszły odbiorca, ale wpięcie należy do zadania 25.
- **Widoczność dla użytkownika:** ograniczona **wyłącznie** do tego, co robi pierwszy subskrybent,
  i opisana wprost w planie.

## 7. Zgodność z konstytucją

- **C-36** — platforma nie zna subskrybentów; dostaje ich **parametrem wymaganym**, tak jak worker
  kolejki dostaje rezolwer handlerów (049). Deklaracja po **stronie serwerowej**.
- **C-35** — mechanizm razem z pierwszym subskrybentem.
- **C-12** — rodzaje zdarzeń pozostają tekstem + unią TS.
- **C-13** — build wyłącznie przeciw lokalnej bazie. **C-20/C-21** — subskrybent nie omija guardów;
  działa w przestrzeni ze zdarzenia.
- **C-50/C-51/C-53** — bramka w buildzie, lekcje, **zero nowych zależności**.

## 8. Otwarte pytania / decyzje właściciela

Brak — przebieg autonomiczny. Decyzje domyślne:

- **Obieg workera zamiast `LISTEN/NOTIFY`** — uzasadnione w §5; decyzja o kanale push zapada
  w zadaniu 23, gdy pojawi się realny wymóg opóźnienia.
- **Idempotencja wymuszona bramką, nie zaleceniem.** Rozdz. 9.4.4 stawia wymóg; przebieg 070
  pokazał, że wymóg niepilnowany mechanicznie jest życzeniem.
- **Pierwszy subskrybent dobrany tak, żeby nie zabierać zakresu zadania 25** — plan wybierze go
  pomiarem i uzasadni; ma udowodnić machinerię, a nie przenieść integracje.
- **Zdarzenie bez subskrybentów jest dostarczone**, nie porzucone (AC-9).

## 9. Ryzyka

- **Subskrybent nieidempotentny** → podwójny skutek, niewidoczny. Główne ryzyko przebiegu; odpowiedź
  to AC-2 + AC-6 (test **i** bramka).
- **Zepsuty subskrybent zatyka strumień** → AC-3 wymaga izolacji błędu.
- **Wyścig przy wielu instancjach** → AC-4; wzorzec `SKIP LOCKED` jest w repo sprawdzony (kolejka zadań).
- **Zdarzenie bez odbiorcy krąży w nieskończoność** → AC-9.
- **Test, który niczego nie dowodzi** → AC-8, weryfikacja mutacyjna jako warunek zamknięcia.
- **Rozlanie zakresu na zadanie 25** → jawnie poza zakresem; usunięcie synchronicznego wywołania
  wymaga wcześniejszego sprawdzenia ścieżki zdarzeniowej w boju.
