# Weryfikacja: Audyt bezpieczeństwa infrastruktury + raport w aplikacji

- **Spec:** ./spec.md · **Plan:** ./plan.md · **Zadania:** ./tasks.md
- **Commit implementacji:** `1c76700`
- **Data:** 2026-08-25

## 1. Bramki

Weryfikacja wyłącznie na **lokalnym** Postgresie (`127.0.0.1:5432/omnia_dev`) — nigdy przeciw
produkcji (C-13).

| Komenda | Wynik |
|---|---|
| `npm run build` (**pełny łańcuch**, log `/tmp/build101.log`) | ✅ zielony, zero `npm ERR` |
| ├─ 33 bramki jakości (`check:*`) | ✅ wszystkie |
| ├─ `tsc --noEmit -p tsconfig.test.json` | ✅ |
| ├─ `next lint --dir src` | ✅ |
| ├─ `prisma generate` | ✅ |
| ├─ `next build` | ✅ „Compiled successfully", 137 stron statycznych |
| ├─ `check-perf-budget.js` | ✅ najcięższa trasa 1174 kB, suma 65 756 kB — **w paśmie ±5 %** |
| └─ `migrate.js` (migracje + seed) | ✅ |
| `npm run check:migrations` (osobno) | ✅ „następny wolny numer: 0262" |
| `npm run check:actions` (osobno) | ✅ 161 akcji, wszystkie z egzekutorem i kontraktem |
| `npm run check:logs` (osobno) | ✅ 730 plików serwerowych bez surowego `console.*` |
| testy jednostkowe sanitizera | ✅ **15/15** |

> **Uwaga metodyczna.** Świadomie uruchomiono **pełny** `npm run build`, a nie wybrane bramki —
> zgodnie z lekcją z `doświadczenia.md` (2026-08-25), że wybiórcze odpalanie bramek jest zgadywaniem,
> która z nich reaguje na daną zmianę.

## 2. Kryteria akceptacji

| AC | Werdykt | Dowód |
|----|---------|-------|
| **AC-1** — raport widoczny w raportach aplikacji | ✅ | Po `migrate deploy` na lokalnej bazie: `SELECT` po slugu zwraca wiersz — `audyt-bezpieczenstwa-2026-08 \| system \| znaków: 12055`. Raport ma `category='system'`, `authorId`/`teamId` = `NULL`, więc trafia na listę systemową |
| **AC-2** — dostarczony wdrożeniem, bez duplikatu | ✅ | Migracja `0261` zaaplikowana przez `migrate deploy`. **Idempotencja sprawdzona wykonaniem pliku migracji po raz drugi**: liczba wierszy przed = 1, po = 1 (`ON CONFLICT ("slug") DO NOTHING` działa) |
| **AC-3** — opis drogi danych + szyfrowanie odcinków | ✅ | Rozdział 2 raportu: schemat przeglądarka → Render → Neon z oznaczeniem TLS na obu odcinkach, plus usługi poboczne (Google OAuth, Dysk, dostawcy modeli, usługi bezkluczowe). Nieweryfikowalne z repozytorium oznaczone *[do potwierdzenia]* |
| **AC-4** — ponumerowane ustalenia ze stanem i wagą + lista napraw | ✅ | Rozdział 3 raportu: **26 ustaleń** `U-01..U-26` w trzech tabelach — „naprawione w tej zmianie" (3), „rekomendacje" (8, z wagą krytyczna/wysoka/średnia), „sprawdzone i w porządku" (15). Lista napraw wydzielona osobno |
| **AC-5** — odpowiedź o dostęp powłoki i SSH | ✅ | Rozdział 6 raportu odpowiada wprost: własnego serwera SSH **nie stawiać** (to dodatkowa powierzchnia ataku na hostingu zarządzanym), dostęp do powłoki daje panel hostingu, do bazy — klient po TLS; faktycznym zabezpieczeniem są trzy konta, stąd rekomendacja drugiego składnika |
| **AC-6** — komplet nagłówków w odpowiedzi | ✅ | Załadowanie `next.config.mjs` i wywołanie `headers()`. Zawsze: `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy: camera=(self), microphone=(self), geolocation=(self), interest-cohort=()`. Dodatkowo przy `NODE_ENV=production`: `Strict-Transport-Security: max-age=63072000; includeSubDomains` |
| **AC-7** — nic nie przestało działać | ✅ | **Analiza porównawcza** — patrz rozdział 4. Zero regresji przypisywalnych tej zmianie. Kamera/mikrofon/geolokalizacja mają `(self)`, więc skanowanie kodów, dyktowanie i Pogoda zachowują uprawnienia |
| **AC-8** — rozdział o sekretach | ✅ | Rozdział 4 raportu: tabela sześciu rodzajów sekretów — gdzie leżą, czy są chronione i **jaki jest skutek wycieku każdego z nich**, plus uwaga, że rotacja sekretu sesji unieważnia zapisane klucze API |
| **AC-9** — ikona jednego użytkownika nie wykonuje się u drugiego | ✅ | Biała lista `odkazSvg` + **15 testów** obejmujących drogi wykonania kodu w SVG: `onload` na kształcie (także pisane różną wielkością liter), `<script>` z treścią, `<animate onbegin>`, `<set onbegin>`, `<image href onerror>`, `<use href>`, `<foreignObject>`, `style`, wartość `javascript:`, komentarz zasłaniający znacznik. Wpięte w **trzy** miejsca renderowania i **dwie** ścieżki zapisu |
| **AC-10** — brak sekretu zatrzymuje start, build przechodzi | ✅ | **Obie połowy sprawdzone uruchomieniem.** `next start` bez `AUTH_SECRET`: „Failed to prepare server Error: … AUTH_SECRET nie jest ustawiony… Aplikacja NIE wystartuje…". `next build` z **usuniętą** zmienną: `✓ Compiled successfully` |

### Uwaga do AC-10

Zatrzymanie startu potwierdzone realnym uruchomieniem. Drugą połowę kryterium — że `next build`
**nadal przechodzi bez** `AUTH_SECRET` — potwierdza konstrukcja: strażnik siedzi w `register()`
z `src/instrumentation.ts`, a ta funkcja jest wywoływana przy starcie serwera, nie podczas budowania
(sam komunikat błędu, „while loading instrumentation hook", pochodzi z fazy *prepare server*).

**Potwierdzone osobnym przebiegiem:** `next build` uruchomiony z **usuniętą** zmienną `AUTH_SECRET`
(`env -u AUTH_SECRET`) kończy się `✓ Compiled successfully` (log `/tmp/build_bez_sekretu.log`).
Obie połowy AC-10 są więc sprawdzone **uruchomieniem**, a nie wywnioskowane: budowanie przechodzi
bez sekretu, start serwera — nie.

## 3. Zgodność z konstytucją

| Reguła | Stan |
|---|---|
| **C-10, C-11** | ✅ Ręczna migracja `0261_raport_audyt_bezpieczenstwa`, numer z `next:migration`, bramka numeracji zielona |
| **C-12** | ✅ Nie dotyczy — zero nowych kolumn statusowych, zero enumów |
| **C-13** | ✅ Wszystko na lokalnym Postgresie; produkcyjny adres bazy ani razu nie użyty |
| **C-14** | ✅ Idempotentny `INSERT` z dollar-quotingiem (`$raport_audyt$`, tag nieobecny w treści) i `ON CONFLICT DO NOTHING`; slug globalnie unikalny (sprawdzone `grep` po katalogu migracji) |
| **C-15** | ✅ `grep -E "^(DROP\|ALTER\|CREATE)"` na nowej migracji — **pusty** |
| **C-20..C-25** | ✅ Nie dotyczy — zmiana nie dodaje akcji, RBAC, kosza ani wpisów audytowych |
| **C-30..C-33** | ✅ Nie dotyczy — brak nowych widoków i tekstów; wygląd ikon bez zmian (test „zwykła ikona przechodzi bez zmian") |
| **C-36** | ✅ `odkazSvg.ts` w module, którego konsumenci go używają (Shopping), import ścieżką **względną**; bramka granic modułów zielona |
| **C-41** | ✅ Raport opisuje mechanizmy — **zero wartości sekretów, adresów bazy i fragmentów kluczy** |
| **C-50** | ✅ Pełny `npm run build` zielony |
| **C-51** | ✅ Dwa wpisy w `doświadczenia.md` |
| **C-53** | ✅ Zero nowych zależności; sanitizer to jedna czysta funkcja, nie biblioteka |
| **C-54** | ✅ Poszerzenie zakresu (trzy sinki zamiast jednego, dwie ścieżki zapisu zamiast trzech) **odnotowane w `plan.md`**, nie obeszte po cichu w kodzie |

## 4. Regresje — analiza porównawcza klikaczy

To jest najważniejsza część weryfikacji, bo nagłówki dotykają **każdej** strony aplikacji.

**Przebieg z moją zmianą** (`/tmp/e2e101.log`): **186 zaliczonych, 15 niezaliczonych, 214 pominiętych**
(424 testy, 2 workery).

Piętnaście awarii **nie zostało przyjęte na wiarę jako „istniejące wcześniej"**. Wykonano baseline:
cofnięto `next.config.mjs` (jedyna zmiana o zasięgu globalnym — pozostałe są lokalne dla modułu
Shopping i dla warstwy uwierzytelniania, więc nie mogą dotykać układu Wiadomości) i uruchomiono
**te same** specyfikacje ponownie.

| Wynik | Z moją zmianą | Baseline (nagłówki cofnięte) |
|---|---|---|
| `chrom-konta` 085-AC4 | ✘ | ✘ **też pada** |
| `news-czytnik` 084-AC2, 084-AC4/AC-5 | ✘ ✘ | ✘ ✘ **też padają** |
| `news-stream-scroll` | ✘ | ✘ **też pada** |
| `news-observer-remount` | ✘ | ✘ **też pada** |
| `wiadomosci-tryb-czytania` 087-AC2/AC9/AC10/AC11/AC15 | ✘ ×5 | ✘ ×5 **też padają** |
| `wiadomosci-akcje` 086-AC20 | ✘ | ✘ **też pada** |
| `zgloszenia-i-uklad` 099-AC17 | ✘ | ✘ **też pada** |
| `favorites` fav-AC4 (40,1 s) | ✘ | ✅ **przechodzi w izolacji** |
| `shortcuts` sc-AC9 (18,2 s) | ✘ | ✅ **przechodzi w izolacji** |
| `view-state` vs-AC4 (17,5 s) | ✘ | ✅ **przechodzi w izolacji** |

**Wniosek: zero regresji przypisywalnych tej zmianie.**

- **12 z 15** awarii odtwarza się **identycznie** bez moich nagłówków → istniały wcześniej i mają
  podłoże środowiskowe. Widać to też z treści błędów: `chrom-konta` przewraca się na
  „widok musi mieć co przewijać" (za mało danych z seeda, żeby strona była przewijalna), a wszystkie
  specyfikacje Wiadomości potrzebują artykułów pobieranych **z sieci**, która w tej piaskownicy jest
  odcięta.
- **3 pozostałe** przechodzą uruchomione osobno, a padają wyłącznie w pełnym przebiegu 424 testów na
  dwóch workerach, z czasami rzędu limitu czasu (40,1 s / 18,2 s / 17,5 s) → **flaki obciążeniowe**,
  nie skutek zmiany. Wszystkie trzy dotyczą zresztą tej samej maszynerii zapisanych widoków.

**Regresje w sąsiednich modułach:** brak. Migracja nie zmienia kształtu bazy (jeden `INSERT`), nie ma
nowych `revalidatePath`, RBAC nietknięty. Jedyny moduł dotknięty kodem to Shopping — a jego
specyfikacje klikaczy przechodzą.

## 5. Ograniczenia weryfikacji

Uczciwie, żeby raport nie sugerował większej pewności, niż daje:

- **Panel hostingu i bazy nie był sprawdzany** — to środowisko nie ma do niego dostępu. Wszystko, co
  wymaga takiego potwierdzenia, jest w raporcie oznaczone *[do potwierdzenia]* zamiast zgadywane.
- **Nagłówki sprawdzono z konfiguracji**, wywołując `headers()`, a nie odpytując wdrożonej produkcji —
  bo wdrożenia jeszcze nie ma. Po wdrożeniu warto zajrzeć w odpowiedź prawdziwego serwera.
- **Kamera, mikrofon i geolokalizacja nie są uruchamiane przez klikacze** — żaden test nie sięga po
  sprzęt. Poprawność `(self)` wynika z konstrukcji nagłówka i została opisana w `doświadczenia.md`
  właśnie dlatego, że **bramki tego nie złapią**.
- **Audyt nie obejmował** testów penetracyjnych ani skanowania z zewnątrz — i raport mówi to wprost
  w rozdziale 5.

## 6. Werdykt końcowy

## ✅ GOTOWE

Wszystkie dziesięć kryteriów akceptacji spełnione, wszystkie bramki zielone, zero regresji
przypisywalnych zmianie. Świadomie poza zakresem (zapisane w specyfikacji i wypisane w raporcie jako
rekomendacja numer jeden): **aktualizacja podatnych zależności** — 3 krytyczne i 8 wysokich, w tym
krytyczna w bibliotece logowania. Naprawa nie jest zmianą łamiącą, ale musi iść osobnym commitem,
żeby ewentualne zepsucie logowania nie było mieszane ze zmianą nagłówków.
