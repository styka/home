# Recenzja: Skrzynka odbiorcza i komunikator zespołowy

> **Dwa przebiegi.** Poniżej przebieg 1 (werdykt: ZMIANY WYMAGANE), zachowany bez zacierania.
> **Obowiązujący werdykt jest na końcu pliku — przebieg 2.**

- **Spec:** ./spec.md · **Plan:** ./plan.md · **Weryfikacja:** ./verify.md
- **Data:** 2026-08-27
- **Zakres:** `git diff origin/develop...HEAD` — 52 pliki, +3720 / −80

## Ustalenia (od najpoważniejszego)

### U-1 — Były członek zespołu nadal widzi kanał i jego nowe wiadomości
- **Plik:** `src/modules/czat/actions/rozmowy.ts:84` (`getRozmowy`) oraz
  `src/modules/czat/lib/dostep.ts:16-24` (`assertUczestnik`)
- **Kategoria:** correctness / **security**
- **Opis:** Widoczność kanału zespołu stoi **wyłącznie** na wierszu `ChatParticipant`, a opuszczenie
  zespołu tego wiersza nie usuwa.

**Scenariusz awarii (sprawdzony sondą na żywej bazie, nie wywnioskowany):**
Bob należy do zespołu, więc `getRozmowy` zakłada mu uczestnictwo w kanale. Właściciel usuwa go
przez `removeMember` (`src/actions/teams.ts:201`) — znika `TeamMember`, a `mirrorTeamWorkspace`
usuwa `WorkspaceMember`. **Nic nie usuwa `ChatParticipant`.** Ala pisze w kanale nową wiadomość.
Bob otwiera `/czat`:

```
❌ AC-25: kanał po wyjściu z zespołu NADAL WIDOCZNY na liście
❌ AC-24/25: assertUczestnik NADAL PRZEPUSZCZA byłego członka
```

Bob czyta treść zespołu, do którego nie należy — i może w nim pisać, bo `wyslijWiadomosc` opiera się
na tym samym guardzie. To jest **wyciek danych**, nie usterka wyglądu.

**Dlaczego weryfikacja tego nie złapała:** sonda w `verify.md` sprawdziła *usunięcie przestrzeni*
(kaskada FK działa poprawnie) i uznała AC-25 za spełnione. AC-25 mówi jednak o **opuszczeniu
zespołu**, a to zupełnie inna ścieżka — bez kaskady. Klasyczny błąd: dowód na sąsiednim scenariuszu.

**Sugerowana poprawka:** członkostwo w zespole rozstrzygać **przy odczycie**, a nie ufać kopii:
- `assertUczestnik` — dla rozmowy `zespol` dodatkowo wymagać wiersza `WorkspaceMember`
  dla `(conversation.workspaceId, userId)`;
- `getRozmowy` — w `where` dla kanałów zespołu wymagać `workspace: { members: { some: { userId } } }`;
- `zapewnijKanalyZespolow` — przy okazji **sprzątać** osierocone uczestnictwa (samo-naprawa), żeby
  wiersz nie został na zawsze.

Rozstrzyganie przy odczycie jest tu lepsze od „usuwaj `ChatParticipant` w `leaveTeam`/`removeMember`":
dopisanie kasowania do dwóch miejsc dziś nie zabezpiecza trzeciego, które ktoś doda jutro — a cichą
karą za pominięcie jest wyciek. To ta sama zasada, którą repo stosuje do dostępu gdzie indziej:
decyzji o dostępie się nie cache'uje.

### U-2 — `getLicznikNieprzeczytanych` robi N+1 zapytań na **każdym ładowaniu dowolnej strony**
- **Plik:** `src/modules/czat/actions/rozmowy.ts:192-215`
- **Kategoria:** correctness (wydajność ścieżki gorącej)
- **Opis:** Funkcja pobiera wszystkie moje uczestnictwa, a potem woła `count` **osobno dla każdej
  rozmowy**.
- **Scenariusz:** `IkonaCzatu` montuje się w powłoce, czyli na **każdej trasie aplikacji**, i woła tę
  funkcję w `useEffect`. Konto z 20 rozmowami płaci 21 zapytań przy wejściu na `/tasks`, `/notes`,
  `/pogoda` — wszędzie. To nie jest koszt czatu, tylko koszt **całej aplikacji**, dołożony przez ten
  przebieg.
- **Sugerowana poprawka:** jedno `groupBy` po `conversationId` z `_max: { createdAt }` dla cudzych
  nieusuniętych wiadomości i porównanie w pamięci z `przeczytaneDo`. Licznik zlicza **rozmowy**, nie
  wiadomości, więc dokładna liczba wiadomości nie jest tu do niczego potrzebna — jedno zapytanie
  wystarcza.

### U-3 — `zapewnijKanalyZespolow` pisze do bazy na ścieżce ODCZYTU, przy każdym sygnale z czatu
- **Plik:** `src/modules/czat/actions/rozmowy.ts:57-78`, wołane z `getRozmowy:83`
- **Kategoria:** correctness (wydajność) / simplification
- **Opis:** Dwa `upsert` na zespół przy każdym wywołaniu `getRozmowy`.
- **Scenariusz:** `CzatPage` odświeża listę przy **każdym** sygnale z dowolnej rozmowy. Konto w trzech
  zespołach płaci 6 zapisów za każdą wiadomość wysłaną przez kogokolwiek — także w rozmowie, której
  nie ogląda. Przy żywej rozmowie w kanale to zapisy w tempie pisania.
- **Sugerowana poprawka:** najpierw dwa tanie `count` (moje przestrzenie zespołowe kontra moje kanały
  zespołowe); pętla `upsert` tylko gdy się różnią. Rozwiązanie zostaje samo-naprawiające, a koszt
  zwykłego przebiegu spada z zapisów do dwóch odczytów.

### U-4 — Otwarty wątek nie oznacza nowych wiadomości jako przeczytanych
- **Plik:** `src/modules/czat/ui/WatekRozmowy.tsx:70-73` i `76-78`
- **Kategoria:** correctness
- **Opis:** `oznaczPrzeczytane` jest wołane raz, po pierwszym wczytaniu (`useEffect` zależny od
  `ladowanie`). Nasłuch sygnału dociąga wiadomości, ale odczytu nie odnotowuje.
- **Scenariusz:** Patrzę na otwartą rozmowę. Rozmówca pisze. Wiadomość pojawia się na ekranie **i
  jednocześnie zapala się odznaka „1 nieprzeczytana"** — przy wiadomości, którą właśnie czytam.
  Licznik gaśnie dopiero po wyjściu i ponownym wejściu.
- **Sugerowana poprawka:** po dociągnięciu z sygnału wołać `oznaczPrzeczytane`, gdy karta jest
  widoczna (`document.visibilityState === "visible"`).

### U-5 — Trzykrotna deklaracja tej samej krawędzi
- **Plik:** `src/modules/czat/ui/ListaRozmow.tsx:88-92`
- **Kategoria:** simplification
- **Opis:** `borderBottom`, potem `border: "none"` (kasujące poprzednie), potem trzy longhandy
  przywracające. Działa dzięki kolejności kluczy, ale czyta się jak pomyłka.
- **Skutek:** żaden wizualny — wyłącznie koszt czytania.
- **Sugerowana poprawka:** `border: "none", borderBottom: "1px solid var(--border)"`.

## Ustalenia rozpatrzone i ODRZUCONE (żeby nie wracały)

- **Wyścig przy dwukrotnym kliknięciu „napisz do".** `otworzRozmowePrywatna` szuka istniejącej
  rozmowy i zakłada nową; pary nie da się objąć indeksem unikalnym. **Ryzyko przyjęte:**
  `ListaRozmow:57` zamyka panel **synchronicznie**, zanim wywołanie ruszy, więc drugie kliknięcie
  nie ma w co trafić. Zabezpieczenie transakcyjne kosztowałoby więcej niż problem.
- **`reakcje: { take: 200 }` w `getWiadomosci`.** Powyżej 200 reakcji na jednej wiadomości liczniki
  byłyby zaniżone. Bramka paginacji wymaga granicy, a 200 to sufit nieosiągalny w rozmowie
  kilkuosobowej. Zostaje.
- **`markAllNotificationsRead(rodzaj?)` z parametrem opcjonalnym.** Optional z „historycznym"
  domyślnym bywa zakazany (C-36), ale ta reguła dotyczy **wiedzy modułowej wstrzykiwanej do
  platformy**. Tu brak argumentu znaczy „wszystkie rodzaje" i jest to zawężenie **danych
  użytkownika**, nie obejście kontroli dostępu.

## Zgodność z konwencjami

Bez zastrzeżeń poza wymienionymi: zero enumów Prisma, zero hardcodowanych kolorów (`check:ui-contract`),
zero literałów tekstowych (`check:i18n`), warianty mobilne obecne, praca wyłącznie w `worldofmag/`,
`revalidatePath` w każdej mutacji poza świadomie opisanym `zglosPisanie`, brak nowych zależności,
brak logowania sekretów.

## Werdykt

**ZMIANY WYMAGANE.**

Powód jest jeden i wystarczający: **U-1 to wyciek treści zespołu do byłego członka**, potwierdzony
sondą, a nie podejrzenie. U-2 i U-3 dokładają koszt do ścieżek, którymi chodzi cała aplikacja, więc
też nie nadają się do „poprawimy potem". U-4 psuje dokładnie to zachowanie, które AC-17 obiecuje.
U-5 jest kosmetyczny i idzie przy okazji.

Braki wracają do `/implement` jako T-26…T-30. **Nie jest to wina planu ani speca** — spec formułował
AC-25 poprawnie, to weryfikacja dowiodła go na sąsiednim scenariuszu. Dlatego poprawiam także
`verify.md`, żeby historia decyzji się zgadzała (C-54).

---

# Przebieg 2 — recenzja poprawek

- **Data:** 2026-08-27, po T-26…T-31 i drugim przebiegu weryfikacji.
- **Zakres:** delta od przebiegu 1 (poprawki U-1…U-5, AC-26 dowieziony kodem, AC-7 zawężony w specu)
  **plus ponowny przegląd całości pod kątem defektów wniesionych przez same poprawki.**

## Ustalenia przebiegu 2

### U-6 — pozycja startowa liczona przez `offsetTop` (**wniesiona przez poprawkę AC-26**)
- **Plik:** `src/modules/czat/ui/WatekRozmowy.tsx` (kod z T-26…T-31, przed korektą w tym przebiegu)
- **Kategoria:** correctness
- **Opis:** Przewijanie do pierwszej nieprzeczytanej liczyło `cel.offsetTop - el.offsetTop`.
- **Scenariusz awarii:** `offsetTop` mierzy się względem najbliższego **pozycjonowanego** przodka.
  Kontener przewijania pozycjonowany nie jest, więc dziś oba elementy trafiają na tego samego
  przodka i odejmowanie daje właściwą liczbę — **przypadkiem**. Wystarczy, że ktoś doda kontenerowi
  `position: relative` (zwykła zmiana stylu, np. przy dokładaniu nakładki), a `cel.offsetParent`
  staje się sam kontener; `cel.offsetTop` jest wtedy już liczony względem niego, a odjęcie
  `el.offsetTop` (mierzonego względem czegoś innego) przestawia rozmowę w losowe miejsce. Objaw:
  „czat czasem otwiera się nie tam, gdzie trzeba", bez żadnego błędu.
- **Status:** ✅ **naprawione w tym przebiegu** — `el.scrollTop += cel.getBoundingClientRect().top -
  el.getBoundingClientRect().top`, miara niezależna od tego, co jest pozycjonowane.

## Ponowny przegląd poprawek z przebiegu 1

| Ustalenie | Ocena poprawki |
|---|---|
| **U-1** | ✅ Rozstrzyganie przy odczycie zamiast kasowania kopii — właściwy wybór. `widoczneRozmowyWhere` jest **jednym** warunkiem, wspólnym dla listy i licznika, więc nie ma jak rozjechać dwóch miejsc. Wiersz `ChatParticipant` celowo przeżywa wyjście i jest to **udokumentowane w teście**, żeby następna osoba nie „posprzątała" go w dobrej wierze i nie zamieniła obrony przy odczycie w obronę przez kasowanie |
| **U-2** | ✅ `groupBy` + porównanie w pamięci. Sprawdzone, że `_max.createdAt` liczy **cudze nieusunięte** wiadomości, a brak znacznika odczytu daje „wszystko nowe", nie „nic nowego" |
| **U-3** | ✅ Sprzątanie zbędnych uczestnictw dokłada samo-naprawę: bez niego porównanie zbiorów fałszowałoby się po każdym wyjściu z zespołu i pętla `upsert` chodziłaby przy każdym odczycie mimo poprawki |
| **U-4** | ✅ Warunek `visibilityState === "visible"` jest istotny — rozmowa otwarta w tle nie jest czytana, więc odnotowanie odczytu byłoby zapisaniem nieprawdy |
| **U-5** | ✅ |

**Sprawdzone i czyste:** brak pętli sprzężenia zwrotnego (`oznaczPrzeczytane` nie rozgłasza sygnału,
więc nasłuch nie wywołuje sam siebie); `progOdczytuRef` trzymany w `ref`, a nie w stanie — inaczej
pozycja startowa liczyłaby się ze znacznika, który sama przed chwilą przesunęła; nowy test jest
`integration` i pomija się bez bazy, zamiast fałszować wynik.

## Bramki (potwierdzenie na finalnym kodzie)

34 bramki skryptowe ✅ · `tsc` ✅ · `next lint` **0 błędów** ✅ · `next build` ✅ (`/czat` 7,53 kB) ·
budżet wydajnościowy ✅ w paśmie · `test:unit` **1268/1268** ✅.

## Werdykt przebiegu 2

**APPROVE Z UWAGAMI.**

Wszystkie ustalenia przebiegu 1 zamknięte z dowodem; jedyny defekt wniesiony przez same poprawki
(U-6) znaleziony i naprawiony w tym przebiegu. Zero naruszeń konstytucji.

**Uwagi przenoszone do właściciela** (nie blokujące, do sprawdzenia na środowisku testowym):
- **AC-16** — dostarczanie wiadomości bez odświeżania strony. Łańcuch kodu kompletny i bramka
  `check:realtime` zielona, ale w tym środowisku nie dało się otworzyć dwóch równoczesnych sesji.
  Warto sprawdzić jako pierwsze po wdrożeniu.
- **AC-28** — zachowanie na telefonie (klawiatura, obszar bezpieczny, jedna kolumna). Sprawdzone
  w kodzie, niesprawdzone na urządzeniu.
- **Szyna czasu rzeczywistego działa w jednym procesie.** Przy dwóch instancjach karta dostanie
  sygnał tylko ze swojej; siatką bezpieczeństwa jest istniejące odpytywanie awaryjne co 5 minut.
  To ograniczenie **nie jest nowe** — dotyczy całej aplikacji od 072 — ale czat jest pierwszą
  funkcją, w której użytkownik odczuje je jako opóźnienie, a nie jako niewidoczny szczegół.
