# Spec: Kanał czasu rzeczywistego — koniec odpytywania

- **ID:** 072-kanal-sse
- **Status:** draft
- **Data:** 2026-08-15
- **Zadania z checklisty:** **23** (SSE `/api/events`) **i 24** (usunięcie `setInterval`)

## 1. Problem / potrzeba

Diagnoza 5.2: **każda otwarta karta odpytuje serwer co 45 sekund**, niezależnie od tego, czy
cokolwiek się zmieniło. `DataFreshness` woła `router.refresh()`, czyli **pełne przeliczenie
komponentów serwerowych** — zapytania do bazy, render, transfer. Dla jednego użytkownika z trzema
kartami to ~240 przeliczeń na godzinę, z których **prawie wszystkie zwracają to samo**.

Koszt rośnie liniowo z liczbą kart i użytkowników, a wartość jest odwrotna do częstotliwości:
przy odpytywaniu co 45 s użytkownik i tak czeka średnio 22 sekundy na cudzą zmianę.

Faza 4 dowiozła już dwa ogniwa łańcucha z rozdz. 11.1: zdarzenie zapisywane atomowo z mutacją (070)
i worker, który je czyta i rozsyła (071). Brakuje ostatniego: **dotarcia do przeglądarki**.

**Dlaczego 23 i 24 to jeden przebieg.** Kanał bez konsumenta byłby dokładnie tym, czego zabrania
C-35 — ogłoszeniem rozwiązania, którego nikt nie używa. A `DataFreshness` bez kanału nie ma na co
zamienić odpytywania. Jedno bez drugiego nie ma sensu.

## 2. Cel i miary sukcesu

- **Cel:** zmiana dociera do otwartej karty **w sekundy, nie w pół minuty**, a karta, w której nic
  się nie dzieje, **nie odpytuje serwera co 45 s**.
- **Sukces mierzymy:**
  1. Zmiana wykonana w jednej karcie powoduje odświeżenie drugiej **bez czekania na interwał**.
  2. Bezczynna karta z działającym kanałem robi **zero** przeliczeń serwerowych w ciągu minuty
     (pytanie kontrolne z rozdz. 14: *ile zapytań generuje bezczynna karta w ciągu 5 minut? cel: 0*).
  3. **Brak kanału nie psuje aplikacji** — degradacja do odpytywania, ale co **5 minut**, nie 45 s.
  4. Karta dostaje **tylko to, co jej dotyczy** — nie cudzy strumień.
  5. Zero regresji: build zielony, liczniki bez spadku.

## 3. Historyjki użytkownika

- Jako **użytkownik dwóch urządzeń** chcę widzieć zmianę z telefonu na laptopie od razu, a nie po pół minuty.
- Jako **współpracownik** chcę widzieć odhaczenie pozycji na wspólnej liście bez odświeżania strony.
- Jako **użytkownik na telefonie** chcę, żeby aplikacja nie mieliła w tle, gdy tylko na nią patrzę.
- Jako **użytkownik za restrykcyjnym proxy** chcę, żeby aplikacja **działała** także wtedy, gdy
  strumienia nie da się utrzymać.

## 4. Kryteria akceptacji

- [ ] **AC-1** — Given otwarty kanał, when w przestrzeni użytkownika powstanie zdarzenie, then karta
  dostaje sygnał i odświeża dane **bez** czekania na interwał.
- [ ] **AC-2** — Given zdarzenie w **cudzej** przestrzeni, then karta go **nie** dostaje.
- [ ] **AC-3** — Given kartę bez sesji, when spróbuje otworzyć kanał, then dostaje odmowę
  (kanał niesie informację o zmianach w danych użytkownika — musi być za sesją).
- [ ] **AC-4** — Given działający kanał, then `DataFreshness` **nie odpytuje co 45 s**; odświeżenie
  następuje na sygnał, na powrót do karty i **awaryjnie co 5 minut**.
- [ ] **AC-5** — Given brak kanału (błąd, proxy, uśpione środowisko), then aplikacja działa dalej
  z odpytywaniem **co 5 minut** — bez błędu widocznego dla użytkownika.
- [ ] **AC-6** — Given zerwane połączenie, then klient **wznawia** je samoczynnie, z narastającym
  odstępem, i nie zapętla się przy trwałej awarii.
- [ ] **AC-7** — Given ograniczenia wdrożenia (jedna instancja, usypiające środowisko testowe), then
  są **opisane w `docs/devops/`** — rozdz. 11.1.5 ostrzega wprost, że inaczej „stracisz dzień na
  diagnozowanie awarii, której nie ma".
- [ ] **AC-8** — Given każdy niezmiennik bramki osobno, when go złamiemy, then bramka zgłasza błąd.
- [ ] **AC-9** — Given cały przebieg, then liczniki bez spadku, testów przybywa, build zielony.

## 5. Zakres

**W zakresie:** trasa strumienia za sesją · kanały **przestrzeni** i **użytkownika** · publikacja
z workera zdarzeń · klient wznawiający połączenie · `DataFreshness` na sygnale zamiast odpytywania,
z 5-minutową siatką bezpieczeństwa · opis ograniczeń w `docs/devops/` · testy + bramka.

**Poza zakresem (świadomie):**
- **Kanał per zasób** (`res:<type>:<id>` z rozdz. 11.1.2) — wymaga, żeby klient zgłaszał, co ma
  otwarte. Pierwszy konsument (odświeżenie danych) tego nie potrzebuje: wystarcza mu „coś w mojej
  przestrzeni się zmieniło". Dokładamy, gdy pojawi się konsument, który rozróżnia zasoby (obecność,
  wskaźniki edycji — rozdz. 8.8).
- **`sharing.grant.revoked` na kanale użytkownika** (rozdz. 11.1.3) — natychmiastowe odebranie
  dostępu **już działa** (zadanie 17, przebieg 063, cache unieważniany per żądanie). Kanał doda tu
  wartość dopiero przy zadaniu 25, gdy odebranie dostępu zacznie emitować zdarzenie.
- **`LISTEN/NOTIFY` / Redis** — patrz decyzja w §8; wraca przy realnym wymogu wielu instancji.
- **Zadanie 25** (subskrypcje międzymodułowe) i zablokowane 11/12.

## 6. Wpływ na Omnia

- **RBAC:** trasa wymaga sesji; kanały wyprowadzane **z serwera** z sesji użytkownika, nigdy
  z parametru żądania — inaczej podanie cudzego identyfikatora przestrzeni byłoby podsłuchem.
- **Widoczność:** aplikacja odświeża się **szybciej** i **rzadziej mieli**. To jedyna zmiana.
- **Wydajność:** jedno trwałe połączenie na kartę zamiast żądania co 45 s.

## 7. Zgodność z konstytucją

C-13 · C-21 (kanały z sesji, nie z żądania) · C-30..C-32 (bez nowego UI, teksty PL) ·
C-35 (kanał razem z konsumentem — dlatego 23 i 24 razem) · C-36 (kanał to zdolność platformy) ·
C-50/C-51 · **C-53** (bez nowych zależności).

## 8. Decyzje przyjęte domyślnie

- **Rozgłaszanie w procesie, nie przez `LISTEN/NOTIFY`.** Łańcuch z rozdz. 11.1.1 wymienia
  `LISTEN/NOTIFY` albo Redis, ale oba istnieją tam z **jednego** powodu: żeby worker z instancji A
  dosięgnął karty podłączonej do instancji B. Omnia chodzi dziś na **jednej** instancji, a oba
  warianty wymagają surowego połączenia poza Prismą, czyli **nowej zależności** (C-53).
  Wybieramy rozgłaszanie w procesie i **nazywamy ograniczenie wprost** (AC-7), zamiast kupować
  infrastrukturę na zapas. Przy wielu instancjach karta dostanie sygnał tylko ze swojej — a siatką
  bezpieczeństwa jest wtedy **to samo 5-minutowe odpytywanie**, które i tak zostaje.
- **Kanały wyprowadzane z sesji na serwerze**, nie przyjmowane parametrem.
- **`res:` odłożone** do pierwszego konsumenta, który rozróżnia zasoby.

## 9. Ryzyka

- **Podsłuch cudzej przestrzeni** → kanały z sesji; test AC-2.
- **Uśpione środowisko testowe wygląda na awarię** (rozdz. 11.1.5 ostrzega wprost) → AC-7, opis
  w `docs/devops/`.
- **Zerwane połączenie zostawia kartę bez odświeżania** → AC-6 (wznawianie) + AC-5 (siatka 5 min).
- **Wyciek połączeń/nasłuchiwaczy** przy wielu kartach → sprzątanie przy zamknięciu strumienia,
  pokryte testem.
- **Jedna instancja to założenie, nie fakt na zawsze** → nazwane w AC-7 i w manifeście.
