# Plan techniczny: Audyt bezpieczeństwa infrastruktury + raport w aplikacji

- **Spec:** ./spec.md (101-audyt-bezpieczenstwa)
- **Status:** draft
- **Data:** 2026-08-25

## 1. Podejście

Zmiana ma **dwie części o różnym ciężarze**. Część opisowa to raport wgrany idempotentną migracją do
tabeli `Report` — wzorcem jest migracja `0252_historia_wersji_omnia` (dollar-quoting, `gen_random_uuid()::text`,
`ON CONFLICT ("slug") DO NOTHING`), więc niczego nowego tu nie wymyślamy. Część naprawcza to **trzy
punktowe poprawki** wynikające z rozpoznania, każda w jednym pliku i każda **zawężająca** (odrzuca
przypadek niebezpieczny, nie zmienia zachowania poprawnego).

Rozpoznanie zostało już wykonane i jego wynik jest **wejściem do tego planu** — treść raportu nie
powstaje na etapie pisania, tylko przepisuje ustalenia z sekcji 11 poniżej.

**Bez zmian w modelach** — `Report` istnieje, migracja tylko wstawia wiersz.

## 2. Model danych (Prisma)

**Bez zmian w schemacie.** Żadnego nowego modelu ani kolumny — a więc `check:schema-drift` nie ma
prawa niczego zgłosić.

- **Migracja (C-10, C-11, C-14):**
  - Numer z `npm run next:migration`: **`0261`**
  - Katalog: `prisma/migrations/0261_raport_audyt_bezpieczenstwa/migration.sql`
  - DDL: **wyłącznie `INSERT INTO "Report" … ON CONFLICT ("slug") DO NOTHING`**. Zero `CREATE`,
    zero `ALTER`, zero `DROP` — sprawdzalne przez `grep -E "^(DROP|ALTER|CREATE)"` na nowym pliku (C-15).
  - `slug`: `audyt-bezpieczenstwa-2026-08` (globalnie unikalny — sprawdzić `grep -r "audyt-bezpieczenstwa" prisma/migrations/`).
  - `category`: `system`, `authorId`/`teamId`: `NULL` (raport systemowy, nie należy do nikogo).
  - Treść w dollar-quotingu `$raport$…$raport$` — **uwaga:** raport zawiera bloki kodu i znaki `$`,
    więc tag musi być nietypowy i nie może wystąpić w treści.

## 3. Warstwa serwera (Server Actions — C-20)

**Bez nowych Server Actions.** Feature nie dodaje żadnej mutacji użytkownika, więc `check:ai-coverage`
i `check:actions` nie mają nowego wejścia do pokrycia. Zmiany dotykają:

- `src/instrumentation.ts` — **twarde zatrzymanie startu** przy braku sekretu podpisującego sesje
  (AC-10). To właściwe miejsce, bo `register()` uruchamia się **przy starcie serwera**, a nie podczas
  `next build` — dzięki temu build nadal przechodzi bez sekretu (wymóg z AC-10), a produkcja bez
  sekretu **nie wstanie**, zamiast działać z wartością wpisaną w repozytorium.
- `src/platform/auth/session.ts` — zastępczą wartość zostawiamy (potrzebna w buildzie), ale nadajemy
  jej **rozpoznawalną nazwę stałej**, żeby strażnik z `instrumentation.ts` mógł ją wykryć, a nie
  porównywać literał w dwóch miejscach.

## 4. RBAC / rejestr modułu (C-22)

**Bez zmian.** Żadnego nowego sluga, żadnego nowego modułu, żadnego wpięcia w `modules.tsx`.
Raport trafia do istniejącej powierzchni `/reports`; uprawnienia bez zmian.

## 5. UI (C-30, C-31, C-32)

**Bez nowych widoków i bez nowych tekstów interfejsu** — czyli `check:i18n` i `check:ui-contract`
nie dostają nowego wejścia. Jedyna zmiana w warstwie prezentacji to odkażanie treści ikony
w istniejącym komponencie (pkt 6), bez zmiany jego wyglądu.

## 6. Naprawy — trzy punktowe zmiany

### 6.1 Nagłówki bezpieczeństwa (AC-6, AC-7) — `next.config.mjs`

Jedno miejsce: `async headers()` zwracające zestaw dla `source: "/:path*"`.

| Nagłówek | Wartość | Po co |
|---|---|---|
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains; preload` | wymusza HTTPS; **tylko gdy `NODE_ENV === "production"`** |
| `X-Frame-Options` | `DENY` | zakaz osadzenia w cudzej ramce (clickjacking) |
| `X-Content-Type-Options` | `nosniff` | zakaz zgadywania typu treści |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | ogranicza wyciek adresów — **istotne dla feedu iCal, gdzie token jest w adresie** |
| `Permissions-Policy` | `camera=(self), microphone=(self), geolocation=(self), interest-cohort=()` | zawęża uprawnienia, **nie odbierając ich aplikacji** |
| `X-DNS-Prefetch-Control` | `on` | bez znaczenia dla bezpieczeństwa, spójność z domyślną praktyką Next |

> **To jest główna mina tej zmiany (AC-7).** Aplikacja **realnie używa** trzech uprawnień, które
> `Permissions-Policy` domyślnie by wyłączyło: **kamery** (skanowanie kodów kreskowych w Magazynowaniu,
> `@zxing`), **mikrofonu** (dyktowanie głosem w asystencie, Web Speech) i **geolokalizacji** (Pogoda).
> Dlatego każde z nich musi mieć jawnie `(self)`. Wartość `()` zamiast `(self)` wyłączyłaby te funkcje
> w całej aplikacji — po cichu, bo błąd zobaczy dopiero użytkownik przy próbie użycia.

**`Content-Security-Policy` świadomie NIE wchodzi** (decyzja właściciela ze speca). W raporcie
zostaje jako rekomendacja wraz z powodem: aplikacja używa stylów osadzonych (`MARKDOWN_STYLES`
przez `dangerouslySetInnerHTML`), map Leaflet i syntezy mowy, więc restrykcyjne CSP wymaga osobnego
przebiegu z listą wyjątków i własną weryfikacją.

### 6.2 Odkażanie ikon kategorii (AC-9) — nowy plik w module Shopping

- **Gdzie:** `src/modules/shopping/lib/odkazSvg.ts`. Zgodnie z C-36 („przynależność pliku ustala lista
  KONSUMENTÓW") — konsumentami są wyłącznie `IconDisplay.tsx` i `actions/categoryIcons.ts`, oba
  w module Shopping, więc plik jest **własnością tego modułu**, nie platformy.
- **Musi być klientowo-bezpieczny** (żadnej Prismy, żadnego `node:`) — `IconDisplay` to komponent
  kliencki. To warunek z `check:client-safe`.
- **Mechanika — biała lista, nie czarna:** zostawiamy wyłącznie znane bezpieczne elementy rysunkowe
  (`path`, `circle`, `rect`, `line`, `polyline`, `polygon`, `ellipse`, `g`, `defs`, `title`) i ich
  atrybuty geometryczne/prezentacyjne. Odrzucamy **wszystko inne**, w szczególności każdy atrybut
  zaczynający się od `on`, elementy `script`, `animate`, `set`, `foreignObject`, `image`, `use`,
  oraz każdy `href`/`xlink:href`.
- **Odkażamy w DWÓCH miejscach i to jest celowe:** przy **zapisie** *oraz* przy **wyświetleniu**.
  **Korekta z etapu implementacji (C-54):** obu list było w planie za mało.
  Treść przyjmują **dwie** ścieżki zapisu, nie trzy — `assignIconToCategory` tylko przenosi istniejący
  wiersz, więc nie ma czego odkażać. Renderują ją natomiast **trzy** komponenty, nie jeden:
  `IconDisplay` oraz dwie osobne kopie pomocniczego `SvgIcon` w `CategoryGroup.tsx`
  i `CategoryManager.tsx`. Kopie nie dzielą nazwy z oryginałem, więc wyszły dopiero z `grep`
  po wzorcu wstrzyknięcia — stąd wniosek do `doświadczenia.md`. Samo odkażanie przy zapisie nie wystarcza, bo **w bazie leżą już
  wiersze zapisane bez filtrowania** — to je zabezpiecza dopiero odkażanie przy odczycie. Samo
  odkażanie przy odczycie też nie wystarcza, bo zostawiałoby ładunek w bazie.
- **Gałąź `data:image/`** w `IconDisplay` (renderowana jako `<img src>`) zawężamy do
  `data:image/png|jpeg|gif|webp` — dziś przechodzi także `data:image/svg+xml`, czyli ta sama treść
  inną drogą.

### 6.3 Twarde zatrzymanie przy braku sekretu (AC-10) — `src/instrumentation.ts`

W `register()`, w gałęzi `NEXT_RUNTIME === "nodejs"`, sprawdzamy sekret podpisujący sesje: brak
wartości albo wartość równa zastępczej ze `session.ts` → **rzucamy błąd z czytelnym komunikatem po
polsku**. Przy okazji tym samym strażnikiem obejmujemy klucz szyfrowania sekretów, bo `secrets.ts`
ma analogiczny fallback (`"omnia-insecure-fallback"`) — z tą różnicą, że tam wystarczy **ostrzeżenie
w logu**, a nie zatrzymanie: konfiguracja bez żadnego klucza API jest poprawnym stanem aplikacji,
a brak sekretu sesji nie jest.

## 7. Pliki do utworzenia / zmiany

| Plik | Akcja | Po co |
|------|-------|-------|
| `prisma/migrations/0261_raport_audyt_bezpieczenstwa/migration.sql` | nowy | raport do `/reports` (C-14) |
| `next.config.mjs` | edycja | `headers()` — nagłówki bezpieczeństwa (AC-6) |
| `src/modules/shopping/lib/odkazSvg.ts` | nowy | biała lista dla treści ikony (AC-9) |
| `src/modules/shopping/lib/__tests__/odkazSvg.test.ts` | nowy | dowód, że ładunki są odrzucane, a zwykłe ikony przechodzą |
| `src/modules/shopping/ui/IconDisplay.tsx` | edycja | odkażanie przy wyświetleniu + zawężenie `data:image/` |
| `src/modules/shopping/ui/CategoryGroup.tsx` | edycja | druga kopia sinka (C-54, wykryta w implementacji) |
| `src/modules/shopping/ui/CategoryManager.tsx` | edycja | trzecia kopia sinka (C-54, jw.) |
| `src/platform/auth/zastepczySekret.ts` | nowy | stała bez zależności — `instrumentation.ts` jest pakowany także dla środowiska brzegowego |
| `src/modules/shopping/actions/categoryIcons.ts` | edycja | odkażanie przy zapisie |
| `src/instrumentation.ts` | edycja | zatrzymanie startu bez sekretu sesji (AC-10) |
| `src/platform/auth/session.ts` | edycja | nazwana stała zastępczej wartości |
| `doświadczenia.md` | edycja | wpis o `Permissions-Policy` i o odkażaniu w dwóch miejscach (C-51) |

## 8. Bramki i weryfikacja (C-50)

Weryfikacja **wyłącznie na lokalnym Postgresie** (C-13) i **pełnym `npm run build`**, nie pojedynczymi
bramkami — lekcja z `doświadczenia.md` z 2026-08-25 mówi wprost, że wybiórcze odpalanie bramek jest
zgadywaniem, która bramka reaguje na zmianę.

| AC | Jak sprawdzimy |
|----|----------------|
| AC-1, AC-2 | `migrate deploy` na lokalnej bazie; `SELECT slug FROM "Report"` pokazuje wpis; **drugie** `migrate deploy` (po ręcznym cofnięciu wpisu w `_prisma_migrations`) nie tworzy duplikatu |
| AC-3, AC-4, AC-5, AC-8 | rewizja treści raportu wobec listy ustaleń z sekcji 11 — każdy odcinek drogi danych i każde ustalenie ma stan i wagę |
| AC-6 | `curl -sI localhost:3000/` na zbudowanej aplikacji (`next start`) — komplet nagłówków w odpowiedzi |
| AC-7 | **`nohup bash scripts/e2e-web.sh`** — pełny zestaw klikaczy; dodatkowo ręczne sprawdzenie, że `Permissions-Policy` ma `(self)` dla kamery, mikrofonu i geolokalizacji |
| AC-9 | test jednostkowy `odkazSvg.test.ts` (ładunek z `onload`, `<script>`, `<image href>`, `data:image/svg+xml` → odrzucone; `<path d="…">` → przechodzi) |
| AC-10 | uruchomienie `next start` **bez** sekretu → proces kończy się błędem; `next build` bez sekretu → nadal przechodzi |

## 9. Ryzyka techniczne i plan wycofania

- **`Permissions-Policy` wyłącza kamerę/mikrofon/geolokalizację** → wartości `(self)`, plus jawna
  weryfikacja w AC-7. Rollback: usunięcie jednego nagłówka z `next.config.mjs`.
- **`X-Frame-Options: DENY` psuje osadzanie** → aplikacja nie jest nigdzie osadzana (brak `<iframe>`
  wskazującego na siebie, brak trybu widżetu). Ryzyko przyjęte świadomie.
- **HSTS jest trudny do cofnięcia** (przeglądarka pamięta `max-age`) → dlatego **tylko na produkcji**,
  która i tak jest wyłącznie po HTTPS. `preload` **nie** zgłaszamy do listy przeglądarek — to byłby
  krok faktycznie nieodwracalny; sam nagłówek bez zgłoszenia cofa się po wygaśnięciu.
- **Odkażanie zepsuje istniejące ikony** → biała lista obejmuje elementy, których faktycznie używają
  ikony w tej aplikacji (kontury `path`/`circle`/`rect`); test pilnuje, że typowa ikona przechodzi bez zmian.
- **Strażnik sekretu wywali build albo e2e** → strażnik siedzi w `register()`, które **nie uruchamia
  się podczas builda**; w e2e sekret jest ustawiony przez skrypt.
- **Rollback całości:** kod cofa się jednym `git revert`. Migracja **nie potrzebuje wycofania** —
  wstawia jeden wiersz do `Report` i nie zmienia kształtu bazy (por. runbook `docs/devops/`).

## 10. Zgodność z konstytucją — checklista

- [x] **C-10, C-11, C-14, C-15** — ręczna migracja `0261` z `next:migration`, wyłącznie idempotentny `INSERT`, zero DDL.
- [x] **C-12** — bez nowych kolumn statusowych, więc temat enumów nie występuje.
- [x] **C-13** — weryfikacja tylko na lokalnym Postgresie; `migrate.js` nigdy przeciw produkcji.
- [x] **C-20..C-25** — bez nowych akcji, RBAC, kosza i wpisów audytowych; nic tu nie dochodzi.
- [x] **C-30..C-32** — bez nowych widoków i bez nowych tekstów; wygląd ikon bez zmian.
- [x] **C-36** — `odkazSvg.ts` ląduje w module, którego konsumenci go używają, nie w platformie.
- [x] **C-41** — raport opisuje mechanizmy; **żadnej wartości sekretu, adresu bazy ani fragmentu klucza**.
- [x] **C-50** — „gotowe" = pełny `npm run build` + klikacze.
- [x] **C-51** — wpis do `doświadczenia.md`.
- [x] **C-53** — zero nowych zależności; sanitizer to ~60 linii czystej funkcji, nie biblioteka.

## 11. Wynik rozpoznania — wsad do treści raportu

> To jest **materiał źródłowy** dla migracji z pkt. 2. Ustalenia potwierdzone w kodzie tego
> repozytorium; to, czego z repozytorium potwierdzić się nie da, jest oznaczone **[do potwierdzenia]**
> i takie musi trafić do raportu — zgadywanie w audycie jest gorsze niż luka.

### Ustalenia — do naprawy w tej zmianie

| # | Ustalenie | Waga |
|---|---|---|
| **U-01** | **Brak jakichkolwiek nagłówków bezpieczeństwa.** `next.config.mjs` nie ma `headers()`, w `src/` zero wystąpień HSTS / X-Frame-Options / X-Content-Type-Options / Referrer-Policy | wysoka |
| **U-02** | **Nieodkażany SVG ikony kategorii trafia do przeglądarki innego użytkownika.** `saveAndActivateCategoryIcon` przyjmuje dowolną treść od zalogowanego użytkownika, a `IconDisplay` wstrzykuje ją do drzewa dokumentu. `getActiveCategoryIconMap` zwraca **także ikony zespołów** (`teamId: { in: teamIds }`) — więc treść jednej osoby renderuje się u drugiej | wysoka |
| **U-03** | **Zastępczy sekret podpisujący sesje wpisany w repozytorium.** `session.ts` podstawia stałą wartość, gdy brak zmiennej. Gdyby zabrakło jej na produkcji, sesje byłyby podpisywane sekretem znanym każdemu, kto widział repozytorium = możliwość podrobienia cudzej sesji. Dziś zmienna jest ustawiona, ale **nic tego nie pilnuje** | wysoka (warunkowa) |

### Ustalenia — rekomendacje (poza tą zmianą)

| # | Ustalenie | Waga |
|---|---|---|
| **U-04** | **12 podatnych zależności: 3 krytyczne, 8 wysokich.** Krytyczna dotyczy **biblioteki logowania** (`@auth/core`) — m.in. ciasteczka kontrolne OAuth (`state`, `nonce`, PKCE) niepowiązane z dostawcą, który je wystawił. **Naprawa nie jest zmianą łamiącą** (`npm audit fix`). **Rekomendacja numer jeden**, świadomie osobnym commitem: gdy bump biblioteki uwierzytelniania zepsuje logowanie, nie wolno go szukać w diffie z nagłówkami | krytyczna |
| **U-05** | Podatność Next.js (ujawnienie punktów końcowych funkcji serwerowych) wymaga przejścia na następną **główną** wersję — planowo, z własną weryfikacją | wysoka |
| **U-06** | **Brak `Content-Security-Policy`** — świadomie odłożone (decyzja właściciela); wymaga osobnego przebiegu z listą wyjątków | wysoka |
| **U-07** | **Feed iCal: token w adresie, bez ograniczenia liczby żądań.** Trasa jest celowo poza bramką sesji; token jest odwoływalny i zakres danych poprawny, ale nic nie ogranicza zgadywania tokenu. `Referrer-Policy` (naprawiane w U-01) zmniejsza wyciek adresu | średnia |
| **U-08** | **Sekrety zapisane przed wprowadzeniem szyfrowania zostają jawne**, dopóki ktoś ich nie zapisze ponownie (`decryptSecret` zwraca wartość bez prefiksu bez zmian). Wskazane jednorazowe przeszyfrowanie | średnia |
| **U-09** | Klucz szyfrowania sekretów ma **fallback na stałą z repozytorium**, gdy brak `CONFIG_SECRET` i `AUTH_SECRET` — obejmujemy ostrzeżeniem (pkt 6.3); docelowo osobna zmienna | średnia |
| **U-10** | **Logowanie tylko przez Google, bez drugiego składnika po stronie aplikacji.** Siła logowania = ustawienia konta Google właściciela — rekomendacja: włączyć tam 2FA | średnia |
| **U-11** | Dostawca logowania E2E jest **wyłączany zmienną środowiskową**. Zabezpieczenie jest poprawne, ale jednopunktowe — rekomendacja: dodatkowo odciąć go, gdy `NODE_ENV === "production"` | średnia |

### Ustalenia — stan w porządku (do wypisania w raporcie jako potwierdzone)

`U-12` bramkowanie tras (sesja w `middleware`, uprawnienie modułu w `layout`, bramka
`check:route-gating`) · `U-13` model ról i uprawnień z zabezpieczeniem przed odcięciem ostatniego
administratora · `U-14` uprawnienia odświeżane przy **każdym** dostępie do sesji, więc odebranie roli
działa natychmiast · `U-15` cztery użycia surowego SQL — wszystkie parametryzowane, interpolacje
wyłącznie ze stałych wewnętrznych, **brak powierzchni wstrzyknięcia** · `U-16` renderowanie markdownu
escapuje `&` i `<` globalnie · `U-17` klucze API szyfrowane AES-256-GCM i maskowane w interfejsie ·
`U-18` sekrety w `render.yaml` jako `sync: false`; w repozytorium **nie ma** pliku `.env`, tylko
`.env.example` · `U-19` wspólne ograniczanie liczby żądań oparte na bazie (okna + dzierżawy slotów),
odporne na wiele instancji · `U-20` budżety AI z wyłącznikiem awaryjnym sprawdzanym bezwarunkowo ·
`U-21` dziennik zmian uprawnień i konfiguracji bez klucza obcego do użytkownika (przeżywa usunięcie
konta) · `U-22` retencja danych z atomowym przejęciem prawa do przebiegu · `U-23` eksport danych
i usunięcie konta (RODO) · `U-24` logi z czyszczeniem danych osobowych i zakazem `console.*` ·
`U-25` lista dozwolonych źródeł dla akcji serwerowych ustawiona na trzy znane adresy ·
`U-26` brak nagłówków CORS — API jest wyłącznie wewnętrzne.

### Odpowiedź na pytanie „zrobić ssh" (AC-5)

Serwera SSH w tej architekturze **nie ma i nie należy go stawiać** — hosting jest zarządzany, a własny
serwer SSH byłby **dodatkową powierzchnią ataku**, nie zabezpieczeniem. Dostęp do powłoki kontenera
produkcyjnego daje panel hostingu (Render Shell), a dostęp do bazy — klient `psql` po TLS. W obu
przypadkach faktycznym zabezpieczeniem jest **konto w panelu**, więc rekomendacja brzmi: drugi składnik
logowania na koncie hostingu, na koncie bazy i na koncie Google. **[do potwierdzenia]** — czy 2FA jest
włączone na tych trzech kontach i kto poza właścicielem ma do nich dostęp; z repozytorium nie da się
tego odczytać, a to środowisko nie ma dostępu do panelu hostingu.

### Architektura — droga danych (AC-3)

Przeglądarka **→[TLS, certyfikat hostingu]→** usługa web na Renderze (Frankfurt; `develop` na planie
darmowym, `master` na płatnym) **→[TLS, `sslmode=require`]→** Neon PostgreSQL (Frankfurt).
Obok: logowanie Google OAuth (poza aplikacją), Google Drive (osobna, dobrowolna zgoda, zakres
`drive.file`), dostawcy modeli językowych i syntezy mowy (klucze z bazy, szyfrowane), oraz kilka
bezkluczowych usług (pogoda, kanały RSS, trasowanie, mapy). Wewnątrz jednego procesu: warstwa web,
kolejka zadań i zadania cykliczne, rozdzielane zmienną roli procesu.
**[do potwierdzenia]** — czy produkcyjny adres bazy faktycznie niesie `sslmode=require` (w repozytorium
jest to udokumentowane, ale sama wartość jest sekretem po stronie hostingu).
