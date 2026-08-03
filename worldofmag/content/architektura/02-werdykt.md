# Werdykt — decyzje architektoniczne

## Decyzja główna

**Nie przepisujemy Omnii. Przebudowujemy jej granice i podnosimy współpracę do rangi fundamentu.**

Architektura docelowa to **modularny monolit z twardymi granicami**, uzupełniony o **jednolity model
współdzielenia zasobów** i **warstwę operacyjną** przygotowaną na 100 tys. użytkowników.

## Siedem decyzji, które definiują Omnię 🧐

| # | Decyzja | Zastępuje |
|---|---------|-----------|
| **D1** | Moduły komunikują się wyłącznie przez **kontrakty** (`contract.ts`), wymuszone lintem | bezpośrednie importy `actions → actions` |
| **D2** | Reakcje międzymodułowe idą przez **zdarzenia domenowe** (outbox), nie wywołania | Zakupy wołające Portfel wprost |
| **D3** | Moduł **rejestruje się jedną deklaracją** (`module.ts`) | dopisywanie w ośmiu miejscach |
| **D4** | **Jeden model współdzielenia** dla wszystkich zasobów (`ResourceGrant`) | 5 mechanizmów, 3 słowniki ról |
| **D5** | **Kontrola współbieżności przez wersjonowanie** rekordu + wykrywanie konfliktu | ciche nadpisanie „ostatni wygrywa" |
| **D6** | **Wypychanie zmian zdarzeniem** (SSE), nie odpytywanie | `setInterval` co 45 s z każdej karty |
| **D7** | **Jeden system komponentów i kontrakt widoku** dla wszystkich modułów | każdy moduł rysuje po swojemu |

## Co zostało odrzucone i dlaczego

| Wariant | Werdykt | Powód w jednym zdaniu |
|---------|---------|------------------------|
| Mikroserwisy | ❌ odrzucony | Integracja międzymodułowa **jest produktem** — zamiana wywołań funkcji na RPC zabiłaby to, dla czego aplikacja istnieje |
| Event sourcing jako model danych | ❌ odrzucony | 545 akcji i 147 modeli do przepisania za zysk, którego nie da się nazwać liczbą; **outbox bierzemy, event sourcingu nie** |
| CRDT dla całej aplikacji | ❌ odrzucony | Ale **przyjęty warunkowo dla pól tekstowych o współbieżnej edycji** (rozdz. 8.6) — architektura ma to umożliwiać per moduł |
| Przepisanie na inny framework | ❌ odrzucony | Next.js App Router jest trafny dla tego kształtu; zmiana = miesiące za zero wartości |
| Status quo + same łatki | ❌ odrzucony | Domyka ruch, nie domyka **kosztu dodania modułu nr 22** — a to było pytanie właściciela |
| Rozdzielenie procesów web/worker/cron | ✅ **przyjęty** | Tanie, bo kolejka już to udźwignie (`SKIP LOCKED`) |

## Najważniejsza korekta: współdzielenie zmienia obraz

Wcześniejsze analizy opierały wniosek na tezie, że **dane Omnii są prywatne per użytkownik**.
**To było fałszywe uogólnienie.** W Omnii sens ma udostępnienie prawie każdego zasobu, a samo
udostępnianie jest dziś rozproszone i niespójne.

**Co z tej korekty wynika — i czego z niej NIE wynika:**

| Wynika | Nie wynika |
|--------|------------|
| Współdzielenie musi stać się **zdolnością platformy**, jednolitą dla wszystkich modułów (D4) | że potrzebujemy event sourcingu |
| Potrzebna jest **kontrola współbieżności** — dziś dwie osoby cicho nadpisują sobie zmiany (D5) | że potrzebujemy CRDT dla całej aplikacji |
| Wypychanie zmian przestaje być optymalizacją, a staje się **wymogiem poprawności** (D6) | że trzeba przepisać warstwę danych |
| Uprawnienia stają się **per zasób**, nie tylko per moduł | że RBAC modułowy znika |

Rozdział 5 pokazuje, dlaczego te trzy rzeczy wystarczają, a czwarta (CRDT) dotyczy wąskiego,
dającego się wskazać zbioru pól.

## Prawdziwy problem, który ta przebudowa rozwiązuje

Nie brzmi on „aplikacja nie udźwignie ruchu". Brzmi:

> **Aplikacja coraz drożej przyjmuje kolejne moduły, a jej obietnica — „wszystko, czego użytkownik
> potrzebuje w życiu" — oznacza, że modułów będzie przybywać bez końca.**

Dziś dodanie modułu wymaga dotknięcia **ośmiu** miejsc, z których żadne nie jest wymuszone typami.
Po przebudowie: **jednego katalogu i jednej deklaracji**. To jest mierzalny wynik tej pracy:
**8 → 1**.

## Punkt wyjścia jest lepszy, niż zakłada typowa diagnoza

Sprawdzone w kodzie, nie założone. Cztery hipotezy „prototypu przed skalą" okazały się fałszywe:

| Hipoteza | Rzeczywistość |
|----------|---------------|
| „Kolejka padnie przy wielu instancjach" | **Fałsz** — `SELECT … FOR UPDATE SKIP LOCKED` z widocznością i ponowieniami |
| „Nie ma testów" | **Fałsz** — 90 plików, w tym test izolacji najemców |
| „Nie ma rate-limitingu" | **Fałsz** — istnieje, z uczciwym komentarzem o potrzebie Redisa przy skali |
| „Brak indeksów po `ownerId`" | **Fałsz** — 45 z 46 modeli |

**To nie jest sprzątanie po bałaganie.** To dokładanie warstw, których świadomie jeszcze nie
budowano — w repozytorium istnieje nawet ich nazwana rezerwa („Faza 4 / SC2–SC7"), nigdy
nierozpoczęta.

## Dlaczego teraz

1. **Większość prac to przenoszenie plików i zmiana importów** — czyli dokładnie to, co generuje
   konflikty scaleń. Zamrożenie developmentu obniża koszt tej zmiany bardziej niż jakiejkolwiek innej.
2. **Umiędzynarodowienie jest liniowe względem rozmiaru kodu** i niezależne od liczby użytkowników.
   Każdy tydzień zwłoki to więcej tekstów do wyciągnięcia.
3. **Współdzielenie łatwiej ujednolicić przy 2 kontach niż przy 100 tys.** — migracja danych
   z pięciu mechanizmów do jednego jest dziś operacją na pustej bazie.

To jest moment, w którym ta przebudowa kosztuje najmniej, ile kiedykolwiek będzie kosztować.
