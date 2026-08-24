# 084 — Recenzja

> Etap 6. Świeże spojrzenie na diff przed scaleniem do `develop`. Recenzję przeprowadził subagent
> `omnia-reviewer` (read-only). Poniżej: ustalenia, werdykt i **co z każdym zrobiono**.

## Werdykt recenzenta: ZMIANY WYMAGANE → po naprawach **APPROVE**

Dziewięć ustaleń, w tym dwa blokujące. Wszystkie dziewięć naprawione w tym samym przebiegu; żadne
nie zostało odłożone „na potem".

## Ustalenia i naprawy

### Blokujące

**1. Pasek lektora chował się pod mobilnym paskiem zakładek.**
Pasek dostał `z-30`, a dolny pasek zakładek powłoki ma `z-40` i wysokość `56px + safe-area`. Na
telefonie — czyli tam, skąd przyszło zgłoszenie — sterowanie lektorem było zasłonięte przez chrom
aplikacji. Naprawa: `bottom-[calc(56px+env(safe-area-inset-bottom))]` na telefonie i `md:bottom-0`
+ `md:left-[var(--sidebar-width)]` na desktopie, gdzie tego paska nie ma. **Nie** podniesienie
`z-index` ponad powłokę: pasek lektora ma stać NAD treścią i POD nawigacją, a nie wygrywać wyścig
warstw z powłoką.

**2. Czujka ciszy fałszywie alarmowała na ścieżce serwerowej.**
Czujka (1,5 s bez `onstart`/`onend` = cisza) uzbrajała się w `speak()`, jeszcze przed `fetch` do
`/api/tts`. Na tej ścieżce te 1,5 s musiało pokryć pobranie audio **i** syntezę **i** start
odtwarzania — typowo ~2 s. Efekt: działający lektor byłby regularnie zgłaszany jako niemy, czyli
dokładnie odwrotność zgłoszenia właściciela. Naprawa: czujka uzbraja się **wyłącznie** w
`speakViaBrowser`, czyli tam, gdzie okno startu jest natychmiastowe. Doszedł test mierzący MOMENT
orzeczenia ciszy (≥1800 ms od wywołania), żeby regresja tego czasu była widoczna jako czerwony test,
a nie jako skarga użytkownika.

### Pozostałe

**3. Nasłuch przewijania gasił podążanie zawsze — i zapisywał to w ustawieniach konta.**
Nasłuch wisiał niezależnie od tego, czy lektor gra, a wyłączenie szło przez `zmienPodazanie`, czyli
**do bazy**. Ktoś, kto nigdy nie włączył odsłuchu, jednym przewinięciem listy trwale gasił sobie
funkcję, o której nie wiedział. Naprawa: nasłuch działa tylko przy `lektorGra`, a automatyczne
wyłączenie rusza wyłącznie stan bieżący (`setPodazanie`) — do ustawień trafia tylko jawne
przełączenie. `lektorGra` przychodzi z lektora nowym wywołaniem `onGra`.

**4. Dwa nośniki strażnika czasu.**
Komentarz obiecywał „ten sam strażnik, co obserwator sekcji", a w kodzie stał drugi, własny
`programoweDoRef`, którego `przewinDo` nie aktualizował. Skutek: skok do tematu z listy — czyli
sedno AC-11 — gasił podążanie użytkownikowi, który zrobił dokładnie to, o co go poproszono. Naprawa:
jeden nośnik, `programoweDo` zwracane przez `useSekcjeTematow`.

**5. „Przestań monitorować" wymuszało płatną regenerację.**
`load(true)` po usunięciu tematu kazało wygenerować listę gorących tematów od nowa. Odsiewanie
monitorowanych dzieje się **po odczycie z pamięci**, więc zwykłe `load()` daje ten sam wynik za
darmo. Naprawa: `load()`.

**6. Autostart przeładowywał odsłuch na początek przy każdej zmianie zestawu.**
Zestaw zmienia się także wtedy, gdy słuchacz oznaczy wiadomość jako przeczytaną — i cała porcja
leciała od nowa. Naprawa dwuczęściowa: autostart odpala się **raz na otwarcie**, a przełączenie
odsłuchu na inny temat wymusza konsument przez `key={kluczZakresu(reader)}` (przemontowanie).
Zmiana listy w trakcie słuchania jest obsłużona osobno: szukamy tego samego ZDANIA w nowej liście
i czytamy dalej od niego; gdy zniknęło (odrzucono właśnie czytaną wiadomość) — milkniemy, bo
zgadywanie następnika byłoby gorsze niż cisza.

**7. Lektor startował przed rozstrzygnięciem konfiguracji głosu.**
Pierwsze zdanie szło głosem przeglądarki, a wybrany głos serwerowy wchodził od drugiego — słychać to
jako zmianę lektora w połowie wiadomości. Naprawa: autostart czeka na `glosGotowy` (ustawiane
w `finally`, więc także przy awarii odczytu ustawień — brak ustawień nie może zablokować odsłuchu).

**8. `summaryFailed` mogło oznaczyć pozycję, która streszczenie dostała.**
Wykonawca partii zwracał listę sukcesów **na końcu**. Jeśli rzucił po zapisaniu części pozycji,
lista przepadała razem z wyjątkiem, a zapisane już pozycje dostawały znacznik „bez streszczenia".
Naprawa: sukces zgłaszany **natychmiast po zapisie**, przez `zglosSukces` — co zapisane, to
policzone, niezależnie od tego, co stanie się w partii dalej. Nowy test jednostkowy pilnuje właśnie
tego scenariusza (7 testów `partieStreszczen`).

**9. Martwy kod.**
Usunięte: `useMemo` w `NewsItemCard` z osieroconym komentarzem, klucz `wszystkieTematy` w `pl.json`,
helper `otworzChromWidoku` w klikaczu (bez konsumenta od korekty AC-14) oraz **nieużywane API
`GroupNavigator`**: pozycja zbiorcza (`WSZYSTKIE`, `pozycjeNawigatora`, `etykietaWszystkich`)
i strzałki (`onSasiad`, `moznaWstecz`, `moznaDalej`) wraz z ich komunikatami. To odwraca decyzję
zapisaną w `verify.md` przy AC-12 („prop zostaje dla innych konsumentów") — i słusznie: martwe API
w komponencie WSPÓŁDZIELONYM jest gorsze niż jego brak, bo następny moduł czyta je jako drogę
rekomendowaną. Sam krok przetrwał jako czysta `sasiadujacaGrupa`, której używa gest w bok
w Wiadomościach. `CLAUDE.md` zaktualizowany.

## Czego recenzja nie zmieniła

Dwa czerwone testy klikacza w pełnym przebiegu (wyścig o ulubione wspólnego konta, zielone
w izolacji) zostają zaraportowane jako znane ograniczenie — naprawa wymaga zmiany infrastruktury
testów, a nie tego przebiegu (C-53). Ostateczne potwierdzenie, że lektor odzywa się na iPhonie
właściciela, nadal należy do właściciela: w środowisku nie ma WebKita.
