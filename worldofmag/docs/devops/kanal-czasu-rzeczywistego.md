# Kanał czasu rzeczywistego — co wiedzieć przed diagnozowaniem

> Rozdz. 11.1.5 dokumentu „Omnia 🧐 — architektura docelowa" ostrzega wprost: *„Będzie wyglądało
> na zepsute na `develop`, a działać na produkcji. Zaplanuj to i opisz w `docs/devops/`, inaczej
> stracisz dzień na diagnozowanie awarii, której nie ma."* To jest ten opis.

## Jak to działa (jednym akapitem)

Mutacja zapisuje `DomainEvent` w tej samej transakcji (070). Worker zdarzeń czyta niedostarczone,
woła subskrybentów i **rozgłasza sygnał na szynę w procesie** (071 + 072). Trasa `/api/events`
trzyma po jednym strumieniu SSE na otwartą kartę i przekazuje sygnały z kanałów użytkownika.
Klient (`DataFreshness`) na sygnał woła `router.refresh()`.

Kanały: `user:<userId>` i `ws:<workspaceId>` — liczone **na serwerze z sesji**, nigdy z parametru
żądania.

## Dwa ograniczenia, które wyglądają jak awaria

### 1. Środowisko testowe (`develop`) zasypia po 15 minutach

`worldofmag.onrender.com` stoi na **darmowym planie**, który usypia usługę po 15 minutach
bezczynności. Trwałe połączenie SSE **zostanie zerwane** przy zaśnięciu, a po przebudzeniu wstanie
dopiero, gdy ktoś wejdzie na stronę.

**Objaw:** na `develop` zmiana z drugiej karty „nie dochodzi", a na produkcji dochodzi natychmiast.

**To nie jest błąd.** Produkcja (`omnia-prod.onrender.com`) stoi na planie płatnym i nie zasypia.

**Jak sprawdzić w 10 sekund:** otwórz narzędzia deweloperskie → Sieć → filtr `events`. Połączenie
w stanie „pending" z pulsem co 25 s = kanał działa. Brak połączenia albo natychmiastowe zamknięcie
= usługa spała.

### 2. Szyna rozgłoszeniowa żyje w JEDNYM procesie

Rozdz. 11.1.1 wymienia `LISTEN/NOTIFY` albo Redis. Oba istnieją tam z jednego powodu: żeby worker
z instancji A dosięgnął karty podłączonej do instancji B. Omnia chodzi dziś na **jednej** instancji,
a oba warianty wymagają surowego połączenia poza Prismą — czyli nowej zależności (C-53).

**Konsekwencja przy skalowaniu w poziomie:** karta dostanie sygnał tylko z instancji, która ją
obsługuje. Zmiana zrobiona przez użytkownika trzymanego przez inną instancję **nie wypchnie** się
natychmiast.

**Kiedy to naprawić:** dopiero gdy pojawi się druga instancja. Wtedy `rozglos` z
`platform/events/bus.ts` zamienia się w publikację przez `LISTEN/NOTIFY`, a `subskrybuj` w nasłuch —
reszta łańcucha (worker, trasa, klient) zostaje bez zmian. To jest **jedno miejsce**, celowo.

**079 (U-6): ta liczba jest wreszcie widoczna.** `/admin/health` pokazuje `ileSluchaczy()` — ilu
słuchaczy trzyma **ta** instancja. Do 079 kanał nie miał żadnego licznika, więc „strumień nie
działa" i „nikt akurat nie patrzy" wyglądały identycznie. Czytaj to tak:

| Co widzisz | Co to znaczy |
|---|---|
| 0 przy otwartych kartach | kanał zerwany albo trasa martwa — patrz „Diagnostyka" niżej |
| liczba ≈ liczbie otwartych kart | normalny stan |
| liczba rośnie i nie spada | przeciek słuchaczy: `subskrybuj` zwraca funkcję odsubskrybowania, ktoś jej nie woła |

**Wartość jest per instancja i taka zostanie.** Po przejściu na skalowanie poziome nie da się jej
zsumować bez wspólnego magazynu — i to jest kolejny (poza samą propagacją) powód, dla którego druga
instancja wymaga `LISTEN/NOTIFY`, a nie tylko go „ładnie by mieć".

## Siatka bezpieczeństwa — dlaczego odpytywanie nie zniknęło całkiem

`DataFreshness` odpytuje **awaryjnie co 5 minut** (było: co 45 sekund) i to zostaje **na stałe**.
Pokrywa trzy rzeczy naraz:

1. brak `EventSource` (stara przeglądarka, restrykcyjne proxy),
2. zerwany strumień, którego nie udało się wznowić,
3. **wiele instancji** (ograniczenie nr 2).

Do tego odświeżenie przy powrocie do karty (`visibilitychange` / `focus` / `pageshow`) — tanie
i ratuje sytuację natychmiast po powrocie użytkownika.

Wniosek praktyczny: **nawet przy całkowicie zepsutym kanale aplikacja działa poprawnie** — po prostu
zmiany dochodzą wolniej. Awaria SSE nie jest awarią aplikacji.

## Czego szukać, gdy kanał naprawdę nie działa

| Objaw | Prawdopodobna przyczyna |
|---|---|
| `401` na `/api/events` | brak sesji — użytkownik wylogowany w innej karcie |
| Połączenie zamyka się natychmiast, w kółko | trasa rzuca; sprawdź logi serwera. Klient milknie po 5 próbach i zostaje na odpytywaniu |
| Połączenie stoi, ale sygnały nie przychodzą | worker zdarzeń nie chodzi (startuje z `layout.tsx`) albo zdarzenia nie powstają — sprawdź `DomainEvent` z `deliveredAt IS NULL` |
| Sygnały przychodzą, ale ekran się nie zmienia | to nie kanał — `router.refresh()` doszedł, ale dane faktycznie są te same |

## Limity

Jedno połączenie na kartę. Puls co 25 s zapobiega zamknięciu przez warstwy pośrednie
(`X-Accel-Buffering: no` wyłącza buforowanie w nginx-podobnych). Przy dużej liczbie kart limit
połączeń instancji staje się realnym sufitem — materiał na zadanie 28 (wydajność).
