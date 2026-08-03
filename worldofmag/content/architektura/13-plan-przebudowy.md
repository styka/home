# Plan przebudowy — dziewięć faz

> Od tego rozdziału dokument jest **instrukcją roboczą dla Claude Code**.
>
> **Zasady obowiązujące przez całą przebudowę:**
> - Każda faza to **osobny przebieg spec-driven pipeline'u** (`/specify …`). **Nigdy dwie naraz.**
> - Konstytucja `.claude/spec-pipeline/constitution.md` obowiązuje bez wyjątków.
> - **Żadna faza nie zmienia zachowania widocznego dla użytkownika**, chyba że jest to wprost jej
>   celem. Refaktor i zmiana funkcji **nigdy w jednym commicie**.
> - Po każdej fazie: `npm run build` zielony + pełny zestaw klikaczy + wpis do `doświadczenia.md`.
> - Migracje wyłącznie ręcznymi plikami (`C-10`), numer z `npm run next:migration` (`C-11`),
>   nigdy przeciw prod DB (`C-13`).

---

## Faza 0 — Siatka bezpieczeństwa 🔴 **BEZWARUNKOWO PIERWSZA**

**Cel:** móc wykryć, że refaktor coś zepsuł.
**Dlaczego:** przenosimy setki plików. Bez siatki dowiemy się o regresji od testerów, nie od bramki.

**Zadania:**
1. **Klikacz ścieżki szczęśliwej dla 21/21 modułów** — wejdź, dodaj, edytuj, usuń, sprawdź.
   Dziś pokryta jest część.
2. **Generowany test izolacji najemcy dla wszystkich 545 akcji** — z manifestu
   `action-coverage.json`: dla każdej akcji sprawdź, że użytkownik B nie widzi danych A.
   **To najważniejszy test w systemie** — wyciek między najemcami kończy produkt.
3. **Bramka rozjazdu schematu** — `prisma migrate diff` w CI musi być pusty względem
   `schema.prisma`.

**Kryteria wyjścia:** 21/21 modułów z klikaczem; test izolacji generowany i zielony; rozjazd
schematu wykrywany automatycznie.
**Ryzyko:** niskie — samo dokładanie testów.

---

## Faza 1 — Granice modułów 🔴 rdzeń przebudowy

**Cel:** struktura z rozdziału 7.
**Dlaczego:** to jest właściwy powód tej przebudowy — koszt dodania kolejnego modułu.

**Zadania:**
1. `src/platform/` — przenieś wspólne zdolności (`auth`, `db`, `jobs`, `ai`, `trash`, `audit`,
   `notifications`, `activity`, `viewState`, `shortcuts`, `favorites`).
2. `src/modules/<x>/` — **moduł po module, jeden commit na moduł**. Trasy w `src/app/` zostają,
   ale stają się cienkie.
3. `contract.ts` per moduł — zacznij od **odwrócenia istniejących importów**.
4. **Reguła ESLint** `no-restricted-imports` (rozdz. 7.2 R1). **Bez niej cała faza jest
   bezwartościowa.**
5. `defineModule` + wyprowadzenie rejestru, uprawnień, nawigacji, pulpitu, kalendarza.
6. **Migracja asystenta AI na katalog składany z deklaracji — OSTATNIA w fazie.**

**Kolejność modułów:** od najmniej sprzężonych (Truck, QA, Kontakty, Raporty) do najbardziej
(Zadania, Zakupy, Kalendarz, asystent).

**Kryteria wyjścia:** build zielony; lint blokuje import przez granicę; dodanie modułu wymaga
**jednego** katalogu i **zera** zmian w innych modułach; wszystkie klikacze zielone; **zero zmian
zachowania**.
**Ryzyko:** średnie — ogromny, ale mechaniczny diff. **Nie rób jednym commitem.**

---

## Faza 2 — Współdzielenie i współbieżność 🔴 największa wartość produktowa

**Cel:** rozdział 8 — jednolity model udostępniania + koniec cichej utraty pracy.
**Dlaczego teraz:** migracja z pięciu mechanizmów do jednego jest dziś operacją **na pustej bazie**.
Przy 100 tys. kont byłaby operacją na żywym organizmie.

**Zadania:**
1. Modele `Workspace`, `WorkspaceMember`, `ResourceGrant`, `ResourceInvitation` (migracja ręczna).
2. `platform/sharing` — `requireAccess`, rozwiązywanie nadań z dziedziczeniem, cache per żądanie.
3. Migracja danych: `Team`→`Workspace`, `ownerId`/`ownerTeamId`→`workspaceId` na 46 modelach.
   **Krokami:** kolumna nullable → wypełnienie SQL → przełączenie zapytań → wymagalność.
   **To najbardziej ryzykowny krok całej przebudowy.**
4. Migracja `TaskProjectMember`, `TaskShare`, `PetShare` → `ResourceGrant`.
5. Kolumna `version` + wzorzec `updateMany` z warunkiem na wersji w akcjach edycyjnych.
6. `ShareDialog`, `ConflictDialog`, widoki „Udostępnione mi" i „Co udostępniłem".
7. Deklaracje `resources` w `module.ts` **wszystkich** modułów, dla których udostępnianie ma sens.

**Kryteria wyjścia:** każdy moduł z sensownym udostępnianiem je wspiera; jedna lista „udostępnione
mi"; dwie osoby edytujące ten sam rekord dostają wybór, nie ciche nadpisanie; test odwołania dostępu
zielony.
**Ryzyko:** **wysokie** — migracja danych na 46 modelach. Wymaga próby odtworzenia kopii **przed**
rozpoczęciem.

---

## Faza 3 — Warstwa domenowa i paginacja 🟠

1. `domain/` w każdym module — czyste funkcje bez Prismy i Reacta.
2. **Paginacja kursorowa** we wszystkich widokach listowych. Zacznij od Zadań, Zakupów,
   Magazynowania, Notatek.

**Kryteria wyjścia:** żadne zapytanie listowe nie pobiera bez limitu; testy domenowe chodzą
w sekundy, bez bazy.

---

## Faza 4 — Zdarzenia i koniec odpytywania 🔴

1. `DomainEvent` + zapis **w tej samej transakcji** co mutacja.
2. Publikacja przez worker (`LISTEN/NOTIFY`).
3. SSE `/api/events` z kanałami per przestrzeń, zasób i użytkownik (rozdz. 11.1.2).
4. **Usunięcie `setInterval` z `DataFreshness`**; degradacja do 5 min przy braku SSE.
5. Subskrypcje międzymodułowe (Zakupy→Portfel, Magazyn→Zakupy).

**Kryteria wyjścia:** bezczynna karta = **zero** zapytań w tle; zmiana na jednym urządzeniu widoczna
na drugim w < 2 s; **zmiana we współdzielonym zasobie widoczna u współpracownika w < 2 s**;
wyłączenie SSE nie psuje aplikacji.
**Ryzyko:** średnie — patrz pułapka o środowisku testowym (11.1.5) i o wielu instancjach (11.9).

---

## Faza 5 — Skala i koszt 🔴

1. Współdzielony rate-limit (Redis/DB), **ten sam interfejs**.
2. Budżety AI: per użytkownik + globalny wyłącznik + alarmy progowe.
3. Pula połączeń, audyt N+1, indeksy pod `workspaceId` i `ResourceGrant`.
4. Cache agregatów i rozstrzygnięć dostępu, unieważniany zdarzeniami.
5. Retencja (rozdz. 11.6), konfigurowalna w `/admin/config`.

**Kryteria wyjścia:** limit trzyma przy N instancjach (test z dwoma procesami); istnieje budżet,
którego nie da się przekroczyć; pulpit robi kilka zapytań, nie kilkanaście.

---

## Faza 6 — Obserwowalność i rozdzielenie procesów 🟠

1. Logi strukturalne (bez PII).
2. Metryki na `/admin/health` — w tym **konflikty edycji per moduł** (rozdz. 11.7).
3. Rozdzielenie `web` / `worker` / `cron`.

---

## Faza 7 — Wielojęzyczność 🟠

1. `next-intl`.
2. Wyciągnięcie tekstów modułami do `messages/pl.json`.
3. **Zmiana `C-32` w konstytucji** — bez tego kolejne sesje przywrócą literały.
4. Formatowanie przez `Intl`; język i strefa w ustawieniach przestrzeni.
5. Język przestrzeni w kontekście promptów AI.

**Kryteria wyjścia:** dodanie języka to praca tłumacza, nie programisty.

---

## Faza 8 — Gotowość produkcyjna 🟡

1. Eksport i usunięcie danych (RODO) — z decyzją o zasobach zespołowych (rozdz. 12.3).
2. **Przeprowadzona** próba odtworzenia z kopii, opisana w runbooku.
3. Stany błędów i puste w każdym module.
4. Budżet wydajnościowy w CI (rozmiar paczki JS, czas pierwszego renderu).

---

## Faza 9 — Domknięcie 🟢

1. Aktualizacja `CLAUDE.md` i konstytucji do nowej struktury.
2. Aktualizacja `/admin/architecture` (drzewo struktury) i tego dokumentu.
3. Nazwa wersji: **Omnia 🧐**.

---

## Ryzyka całości i ich ograniczenia

| Ryzyko | Prawdopodobieństwo | Szkoda | Ograniczenie |
|--------|--------------------|--------|--------------|
| Migracja `workspaceId` na 46 modelach psuje dane | średnie | **bardzo wysoka** | Kroki (nullable→wypełnienie→przełączenie→wymagalność); próba odtworzenia przed startem; Faza 0 wykonana |
| Granice erodują po przebudowie | **wysokie bez lintu** | wysoka | Reguła ESLint jest częścią Fazy 1, nie „potem" |
| Faza 1 rozlewa się i blokuje development | średnie | średnia | Moduł po module, każdy osobno mergowany |
| SSE „nie działa" na środowisku testowym | **wysokie** | niska | Udokumentowane z góry (11.1.5) |
| Wielu instancji + SSE bez pub/sub | średnie | wysoka | Wymóg pub/sub zapisany w Fazie 4 |
| Asystent obchodzi uprawnienia współdzielenia | średnie | **bardzo wysoka** | Test kontraktowy read-tooli (12.2.1) |
| Refaktor miesza się ze zmianą funkcji | wysokie | średnia | Zasada „nigdy w jednym commicie" |

## Mierniki sukcesu przebudowy

| Miernik | Dziś | Cel |
|---------|------|-----|
| Miejsc do dotknięcia przy dodaniu modułu | 8 | **1** |
| Modułów wspierających udostępnianie per zasób | 3 / 21 | **wszystkie, dla których ma to sens** |
| Zapytań do bazy przy bezczynnej karcie | ~1/45 s × N kart | **0** |
| Opóźnienie widoczności zmiany współpracownika | do 45 s | **< 2 s** |
| Cicha utrata pracy przy równoległej edycji | możliwa | **niemożliwa** |
| Mechanizmów współdzielenia | 5 | **1** |
| Słowników ról | 3 | **1** |
| Czas dodania języka | miesiące | **praca tłumacza** |

## Czego NIE robić

1. **Nie rozbijaj na mikroserwisy** (rozdz. 6C).
2. **Nie wprowadzaj event sourcingu** — outbox ≠ event sourcing (rozdz. 6D).
3. **Nie dokładaj Kafki/RabbitMQ** — `LISTEN/NOTIFY` albo Redis wystarczy.
4. **Nie skracaj interwału odpytywania** — ma zniknąć, nie przyspieszyć.
5. **Nie rób Fazy 1 ani Fazy 2 jednym commitem.**
6. **Nie łącz refaktoru ze zmianą funkcji** — błąd zauważony przy przenoszeniu naprawiaj osobnym
   commitem, przed albo po.
7. **Nie usuwaj bramek jakości**, nawet gdy zaczną przeszkadzać — dostosuj je. To one czynią tę
   przebudowę wykonalną.
8. **Nie buduj rzeczy z Progu C** (sharding, regiony, repliki) — architektura ma je umożliwiać,
   nie zawierać.
9. **Nie zaczynaj Fazy 2 przed zieloną Fazą 0** — migracja danych bez siatki bezpieczeństwa to
   hazard.
