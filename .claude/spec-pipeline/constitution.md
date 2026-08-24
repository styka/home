# Omnia — Konstytucja inżynierska (Spec-Driven Pipeline)

> **Czym jest ten plik.** To zestaw **twardych, nienegocjowalnych reguł** projektu WorldOfMag /
> Omnia. Każdy etap pipeline'u (`/specify → /plan → /tasks → /implement → /verify → /review`) ma
> obowiązek być z nimi zgodny. Gdy spec, plan albo kod łamie którąś regułę — to jest błąd blokujący,
> nie kwestia gustu. Źródłem prawdy dla architektury pozostaje `CLAUDE.md`; ten plik wyciąga z niego
> reguły, które najłatwiej złamać, i podnosi je do rangi bramek jakości.

Numeracja (`C-NN`) jest stała — odwołuj się do reguł po numerze w specach, planach i recenzjach.

---

## A. Zakres i struktura repo

- **C-01 — Pracujemy tylko w `worldofmag/`.** Cały nowy kod, migracje, testy i skrypty żyją w
  `worldofmag/`. **Nigdy** nie dotykaj `src/` w katalogu głównym repo, `_old/`, `pom.xml` ani
  legacy AngularJS/Spring. Komendy uruchamiamy z `worldofmag/`.
- **C-02 — Alias importów `@/*` → `./src/*`.** Zawsze używaj aliasu w importach, nigdy długich
  ścieżek względnych (`../../..`). **Wyjątek: wewnątrz `src/modules/<x>/` importujemy własne
  wnętrze ścieżką względną** (`./actions/x`) — patrz C-36.
- **C-36 — Granica modułów: `platform/` ↔ `modules/`.** (Faza 1 przebudowy, 046.)
  - `src/platform/` to zdolności **niezależne od modułu** (sesja, baza, uprawnienia, kosz, audyt,
    powiadomienia, stan widoku, skróty, ulubione, komponenty). Platforma **nie zna żadnego modułu**
    i nie wolno jej importować `@/modules/*` — nawet kontraktu. Gdy platforma potrzebuje wiedzy
    modułowej, **przyjmuje ją parametrem** (wzorzec: `filterAccessibleFavorites(..., isPathLocked)`).
  - `src/modules/<x>/` to moduł: `contract.ts` (granica), `module.ts` (deklaracja), `actions/`,
    `ui/`, `lib/`. Trasy zostają w `src/app/` i są **cienkie**: sesja → uprawnienie → dane → render.
  - **Moduł widzi inny moduł WYŁĄCZNIE przez `@/modules/<x>/contract`.** Własne wnętrze importuje
    **ścieżką względną** — bo dla lintera `@/modules/qa/…` wewnątrz `modules/qa` wygląda identycznie
    jak import cudzego wnętrza, a przy ścieżce względnej granicę widać w samym imporcie.
  - Kontrakt zawiera **dokładnie to, czego potrzebują konsumenci** — nie „wszystko na wszelki
    wypadek". Kontrakt rosnący do kilkudziesięciu funkcji to sygnał, że moduł robi za dużo.
  - Moduł rejestruje się **jedną deklaracją** (`defineModule` w `module.ts`): stąd biorą się menu,
    uprawnienie, mapowanie ścieżek, **nawigacja boczna** (`sideNav`), **wkład do asystenta** (`ai` —
    katalog akcji, egzekutor, narzędzia odczytu), **zadania w tle** (`jobs`) i **wkład do wspólnej
    agendy** (`calendar`). **Nie dopisuj modułu do równoległych list** — po 048/049 takich list już
    nie ma i cel „8 → 1" jest osiągnięty; dopisanie nowej byłoby regresją.
  - **Wszystkie te pola są LENIWE** (funkcja zwracająca `import()`) i to jest wymóg poprawności,
    nie optymalizacja — w obie strony: `module.ts` czyta kod serwerowy (więc statyczny import
    komponentu klienckiego wciągnąłby go tam), a `MODULES` importuje `ModuleSidebar`, komponent
    kliencki (więc statyczny import egzekutora wciągnąłby Prismę do przeglądarki).
  - **Wkład do migawki pulpitu:** `src/modules/<x>/dashboard.ts` wpięty w korzeń kompozycji
    `src/lib/dashboardContributors.ts` — **świadomie poza `module.server.ts`** (050). Wspólny obiekt
    leniwych loaderów jest **plikiem zbiorczym**: kto importuje go dla jednego pola, dostaje do grafu
    cele `import()` wszystkich pozostałych (zmierzone: strona główna 1889 → 2117 modułów). Bramka
    pilnuje wpięcia **w obie strony**. Ta sama operacja czeka `ai`, `jobs` i `calendar`.
  - **Trasa pulpitu (`src/app/page.tsx`) nie importuje żadnego modułu poza widokiem Strony głównej.**
    Moduł pokazujący coś na pulpicie deklaruje to u siebie; bramka rejestru odrzuca powrót do
    dopisywania się do trasy.
  - **Gdy platforma potrzebuje wiedzy modułowej, przyjmuje ją parametrem WYMAGANYM.** `buildAiCatalog`
    dostaje wkłady, worker kolejki — rezolwer handlerów. Parametr opcjonalny z „historycznym"
    domyślnym jest zakazany: zapomniany argument stałby się cichym wyciekiem uprawnień.
  - **Przynależność pliku ustala lista jego KONSUMENTÓW, nie nazwa.** Zanim przeniesiesz plik do
    modułu, wypisz kto go importuje. Helper używany przez trzy moduły zostaje wspólny; „słownik",
    po który sięga tylko jeden moduł, jest jego własnością. Nazwa mówi, czym plik miał być; lista
    konsumentów mówi, czym jest.
  - **Powłoka nie importuje wnętrza żadnego modułu.** Gdy potrzebuje od modułu komponentu, bierze go
    z deklaracji; gdy danych — z kontraktu.
  - Wymuszają to: `npm run check:boundaries` (reguła lintu naprawdę działa) i
    `npm run check:module-registry` (osiem kontroli: kontrakt, kompletna deklaracja, unikalne id,
    wpięcie w oba korzenie kompozycji, brak kodu modułu poza jego katalogiem, wpięcie wkładu pulpitu
    w obie strony i czysta trasa pulpitu). Obie w `build`.
- **C-03 — Artefakty pipeline'u żyją w `specs/<NNN-slug>/`** (katalog główny repo): `spec.md`,
  `plan.md`, `tasks.md`, `verify.md`, `review.md`. Numer `NNN` jest sekwencyjny, zero-padded (001,
  002, …). Slug = kebab-case, po angielsku lub po polsku bez znaków diakrytycznych.

## B. Baza danych i migracje

- **C-10 — Edycja `schema.prisma` NIE tworzy tabel na produkcji.** Każdy nowy model/kolumna wymaga
  **ręcznie napisanego pliku migracji** pod `prisma/migrations/<NNNN_nazwa>/migration.sql`. Prod
  odpala `prisma migrate deploy`, który tylko *aplikuje istniejące* pliki.
- **C-11 — Numer migracji jest unikalny i sekwencyjny (4 cyfry).** Nowy numer bierzemy z
  `npm run next:migration`. `npm run check:migrations` (wpięte w `build`) wywala się na *nowej*
  kolizji. **Nigdy nie zmieniaj nazwy już zaaplikowanej migracji** — `migrate deploy` kluczuje po
  pełnej nazwie katalogu, więc rename = ponowne odpalenie (CREATE/ALTER → deploy pada).
- **C-12 — Zero enumów Prisma.** Statusy/rodzaje to kolumny `String` + zawężający typ TypeScript
  (union), np. `type ItemStatus = "NEEDED" | "IN_CART" | "DONE"`. Historyczny powód (SQLite) już nie
  obowiązuje, ale konwencja zostaje — **nigdy** nie konwertuj na `enum`.
- **C-13 — Nie odpalaj `npm run build` / `scripts/migrate.js` lokalnie z prod `DATABASE_URL`.**
  `migrate.js` robi `migrate deploy` + seed na prawdziwej bazie Neon. Do lokalnej weryfikacji
  postaw lokalny Postgres (patrz C-31).
- **C-14 — Seed raportów i uprawnień robimy idempotentnymi migracjami SQL** (dollar-quoting
  `$tag$…$tag$`, `gen_random_uuid()::text`, `ON CONFLICT ("slug") DO NOTHING|UPDATE`). `slug` jest
  **globalnie unikalny**.

## C. Warstwa aplikacji

- **C-20 — Mutacje danych = Server Actions z `revalidatePath()` na końcu.** Nigdy nie dokładaj
  ręcznej inwalidacji cache gdzie indziej. Pliki akcji: `src/actions/*`.
- **C-21 — Model współwłasności `ownerId` / `ownerTeamId`** (wzajemnie wykluczające się). Dostęp
  liczymy przez `getUserTeamIds(userId)` i `where: { OR: [{ ownerId }, { ownerTeamId: { in }}] }`.
  Każdy moduł ma swój guard (`assertListAccess`, `assertNoteAccess`, …) — użyj/rozszerz istniejący.
- **C-15 — Wyjścia `prisma migrate diff` NIE dopisuj do migracji bez przeczytania.** (051.)
  `--to-schema-datamodel` generuje **doprowadzenie bazy do schematu**, a nie „DDL twojej zmiany":
  wszystko, co żyje wyłącznie w surowym SQL-u — czyli dokładnie to, co jest wypisane
  w `src/lib/db/schema-drift-allowed.json` — diff zaproponuje **skasować** (indeksy `pg_trgm`,
  domyślne wartości kolumn). Po wygenerowaniu DDL zostaw wyłącznie instrukcje swojej zmiany;
  `grep -E "^(DROP|ALTER)"` na nowej migracji zajmuje sekundę.
- **C-16 — Przestrzenie są LUSTREM zespołów, dopóki trwa Faza 2.** (051, zadanie 9.)
  `Team`/`TeamMember` pozostają źródłem prawdy; `Workspace`/`WorkspaceMember` je odwzorowują.
  Kto mutuje zespół, **uzgadnia przestrzeń** (`syncTeamWorkspace`) — wymusza to
  `npm run check:workspace-mirror` (w `build`). Pominięte uzgodnienie nie objawia się niczym, bo nic
  przestrzeni jeszcze nie czyta; wyszłoby dopiero przy zadaniu 11. Kasowanie lustra robi kaskada FK.
- **C-17 — Dostęp do ZASOBU rozstrzyga platforma; moduł deklaruje operacje.** (052, zadanie 10.)
  `platform/sharing` odpowiada na „czy wolno", biorąc katalog zasobów **parametrem wymaganym**
  (bez wartości domyślnej — zapomniany argument byłby cichym przyzwoleniem). Moduł deklaruje
  `src/modules/<x>/sharing.ts`: etykiety, mapowanie **własnych operacji** na cztery role
  (`viewer` < `commenter` < `editor` < `manager`) i rodzica do dziedziczenia — **nigdy własnych ról
  i nigdy własnej reguły dziedziczenia**. Wpięcie w `src/lib/sharingResources.ts` pilnuje
  `check:module-registry` w obie strony: niewpięta deklaracja objawia się **odmową dostępu**.
  **Moduł woła platformę z własnym katalogiem**, nie przez korzeń kompozycji (inaczej odwraca
  zależność — regresja z 049). **Zmiana reguły dostępu wymaga tabeli prawdy** porównanej komórka
  po komórce PRZED przełączeniem; poszerzenie czyjegokolwiek dostępu „przy okazji" jest zakazane —
  idzie osobną, świadomą zmianą.
- **C-22 — RBAC.** Nowy moduł = nowy slug `module.*` zaseedowany migracją SQL, wpięty w
  `src/lib/permissions.ts` (`PERMISSIONS`, `permissionForPath`), w rejestr modułów
  `src/lib/modules.tsx` i w `ModuleSidebar` (desktop + mobilny tab bar). Strony poza `/auth/signin`
  wymagają sesji — brak trybu anonimowego.
- **C-23 — Każda `AIAction` MUSI mieć egzekutor** w `/api/llm/home/execute`. `npm run
  check:actions` (w `build`) wywala się, jeśli brakuje handlera. Typ `AIAction` żyje w
  `src/lib/ai/aiAction.ts`; read-toole w `src/lib/ai/agentTools.ts`.
- **C-24 — Soft-delete zamiast twardego `delete`,** tam gdzie moduł to wspiera: zapis snapshotu do
  `TrashItem` (`lib/trash.ts`) z retencją; odzysk w `/trash`.
- **C-25 — Zmiany RBAC/konfiguracji logujemy w `AuditLog`** (`lib/audit.ts`, kategoria
  `rbac|config`). `AuditLog` nie ma FK do `User` — snapshotuje email aktora.

## D. UX / UI

- **C-30 — Ciemny motyw przez zmienne CSS.** Kolory bierzemy z `var(--bg-base)`, `var(--text-primary)`,
  `var(--accent-*)` itd. — **nigdy** nie hardcoduj hexów. Na kolorowych przyciskach tekst = `var(--on-accent)`,
  nie `#fff`. Skórki mogą nadpisać każdą zmienną, więc hardcode łamie skinowalność.
- **C-31 — Mobile-first i keyboard-first.** Desktopowy sidebar to `hidden md:flex`; mobilny dostaje
  top bar + overlay + dolny tab bar. **Nigdy dwa sidebary na mobile.** Respektuj
  `env(safe-area-inset-bottom)`. Min. cel dotyku `py-3`, checkboxy 20×20px. Skróty: `j/k`, `x/Space`,
  `e`, `d`, `a/n`, `/`, `Ctrl+K`, `Esc`.
- **C-33 — Widok modułu deklaruje się przez `ModuleView`, nie rysuje własnego nagłówka.**
  Moduł podaje `title`/`icon`/`filters`/`actions`/`state`; ramę rysuje powłoka. **Od 085 rama nie
  wstrzykuje już do paska żadnego chromu** — gwiazdka „zapisz widok" i ściągawka skrótów mieszkają
  w **chromie konta** (telefon: górny pasek obok dzwonka; komputer: rząd w stopce panelu bocznego),
  a wskaźnik świeżości został skasowany, bo mierzył moment przeładowania strony przez powłokę, a nie
  świeżość danych modułu. `ViewChromeProvider` już nie istnieje; został po nim wyłącznie typ
  `ViewResource` (prop `ModuleView`, zarezerwowany na Fazy 2 i 4). **Pasek widoku jest PRZYKLEJONY**
  u góry obszaru przewijania — i jest to przebudowa struktury, nie sam `position: sticky`: element
  przyklejony trzyma się tylko w granicach swojego rodzica, więc pasek musi być BEZPOŚREDNIM
  dzieckiem kontenera przewijania. Moduł z własnym przyklejonym paskiem odsuwa go o `--view-bar-h`.
  Stany brzegowe
  (pusty / ładowanie / błąd / brak dostępu) idą **wyłącznie** przez prop `state` — nigdy rysowane
  ręcznie. Wymusza to `npm run check:ui-contract` (w `build`): katalog trasy bez wpisu w manifeście
  albo `ModuleView` bez `state` = build pada. **Gdy rama nie pasuje do widoku — poszerz ramę
  (`layout`, `density`, `breadcrumb`), a nie rób wyjątku w module.** Wyjątek w module to dług
  w dwudziestu miejscach; poszerzenie kontraktu jest jednorazowe.
- **C-34 — Potwierdzenia przez `confirmDialog`, nigdy `window.confirm()`.**
  `if (!(await confirmDialog("Usunąć listę?"))) return;`. Natywne okno nie zna skórki, ma przyciski
  w języku systemu i blokuje wątek, więc nie pokaże, CO zostanie usunięte.
- **C-35 — Nowy wspólny komponent dowozimy razem z pierwszym konsumentem.**
  „Gotowe" znaczy **wpięte**, nie „istnieje". Komponent bez konsumenta jest gorszy niż jego brak:
  w galerii ogłasza wspólne rozwiązanie, którego nikt nie stosuje, więc następna osoba i tak napisze
  swoje. Gdy migracja istniejących wywołań jest droga — zrób **cienką nakładkę na stare API**
  (wzorzec `ui/home/EmptyState` → `ViewEmpty`), zamiast przepisywać dwadzieścia plików.

- **C-32 — Teksty UI przez `t()`, polski jako język źródłowy.** Nowy tekst widoczny dla użytkownika
  idzie do `messages/pl.json` i jest czytany przez `useTranslations` (`next-intl`, konfiguracja
  bez routingu językowego — zadanie 34/089). **Żadnych literałów w komponentach.** Pilnuje tego
  zapadka `npm run check:i18n`: liczba tekstów zaszytych w JSX nie może rosnąć, a przy każdym
  wyciągniętym module należy obniżyć próg w `src/lib/ui/i18n-baseline.json`.
  Polski pozostaje **językiem źródłowym** — piszemy po polsku, nie po angielsku.
  Język i strefa czasowa należą do **przestrzeni** (`Workspace.locale`/`timezone`), nie do konta,
  bo zasób należy do przestrzeni; formatuj daty, liczby i kwoty przez `@/platform/i18n/format`,
  nie przez `toLocaleString("pl-PL")` (to drugie ignoruje strefę przestrzeni).
  Nazwy kategorii w promptach LLM traktujemy jako słowa **języka przestrzeni** — do promptu wchodzi
  `zdanieOJezyku()` (zadanie 38), które dla polskiego jest puste, więc nic dziś nie kosztuje.

## E. AI / LLM

- **C-40 — Routing modeli jest DB-driven** przez `/admin/llm` (`LlmProvider` + `LlmAssignment`),
  rozwiązywany per typ operacji w `src/lib/llm/resolver.ts` (`dispatch`/`reasoning`/`vision`/
  `generation`). Nie hardcoduj providera ani modelu w kodzie funkcji.
- **C-41 — Klucze API szyfrowane w spoczynku** (`lib/crypto/secrets.ts`) i **maskowane** w UI
  (`/admin/config`, `/admin/llm`). Nigdy nie loguj ani nie zwracaj pełnego klucza.

## F. Proces i bramki jakości

- **C-50 — Definicja „gotowe": `npm run build` przechodzi.** Build to
  `copy-docs → copy-audyt(*2) → check:actions → check:migrations → next lint → prisma generate →
  next build → migrate.js`. Dla zmiany docs-only builda nie ma — wystarcza rewizja poprawności.
  **Uwaga:** ostatni krok (`migrate.js`) rusza prod DB — patrz C-13; do CI/lokalu weryfikuj do
  kroku `next build`.
- **C-51 — Każdy naprawiony bug / nieoczywisty problem → wpis do `doświadczenia.md`** (katalog
  główny repo, po polsku, format: `## YYYY-MM-DD — tytuł` / `**Problem:**` / `**Rozwiązanie:**` /
  `**Lekcja:**`). Nie pytaj o zgodę — dopisz i zacommituj razem z fixem.
- **C-52 — Merge do `develop`, a na koniec automatyczna promocja `develop → master`** (gdy `build`
  zielony), zgodnie ze STANDING AUTHORIZATION w `CLAUDE.md` — **automatycznie, bez pytania**.
  Właściciel z góry i trwale autoryzował na koniec pipeline'u sekwencję: merge brancha roboczego
  (`claude/*`) → `develop` → push `develop`, a następnie promocja `develop → master` → push `master`
  (produkcja, Render auto-deploy na `omnia-prod.onrender.com`). Pipeline **nie zadaje już pytania
  domykającego** o produkcję. Promocja na `master` odbywa się **wyłącznie** przy werdykcie
  APPROVE/APPROVE Z UWAGAMI i zielonym buildzie, i **musi** przejść kontrolę integralności
  (`git merge-base --is-ancestor origin/master develop` oraz ponowne sprawdzenie po merge), żeby nigdy
  nie cofnąć produkcji; jeśli kontrola zawiedzie albo push do `master` odbije — **zatrzymaj się i zgłoś
  właścicielowi** zamiast forsować `master`.
- **C-52a — `develop → master` to ZAWSZE `--ff-only`; wydanie znaczy tag, nie commit scalający.**
  `git merge --no-ff develop` na `master` tworzy commit, który **istnieje tylko na `master`** — od tej
  chwili `develop` nie zawiera produkcji, kontrola integralności z C-52 wypada fałszywie i każdy
  kolejny przebieg musi zacząć od merge'a synchronizującego `master → develop`. Stąd biorą się
  powtarzalne komunikaty o „commicie scalającym na gałęzi docelowej" i puste merge'e w historii.
  Dlatego: promocja to `git merge --ff-only develop` (a gdy odbije — **stop i zgłoszenie**, nigdy
  `--no-ff` ani force-push), a widoczny ślad wydania daje **adnotowany tag** `prod-<NNN>-<slug>`
  wypchnięty razem z `master`. Efekt uboczny, który jest właściwym celem: na produkcji stoi commit
  **dokładnie** ten, który przeszedł testy na `develop`. Merge commit z brancha roboczego do
  `develop` jest w porządku — powstaje na gałęzi docelowej i jedzie dalej razem z nią.
- **C-53 — Minimalizm.** Rozwiązanie najmniejsze z możliwych: bez nadmiarowych abstrakcji, nowych
  zależności i „przy okazji" refaktorów. Zgodność ze stylem otoczenia > osobiste preferencje.

## G. Przebieg pipeline'u (autonomia i spójność)

- **C-54 — Spójność artefaktów i zawracanie.** Artefakty są źródłem prawdy i tworzą łańcuch
  `spec.md → plan.md → tasks.md → kod` — muszą pozostać **spójne**. Gdy dowolny etap odkryje fakt,
  który zmienia **wcześniejszy** artefakt (implementacja pokazuje, że plan jest błędny; plan wykrywa
  lukę w specu; nowa odpowiedź właściciela zmienia zakres), masz obowiązek:
  1. **zaktualizować dotknięty wcześniejszy artefakt** (`spec.md`/`plan.md`/`tasks.md`) — a nie tylko
     „obejść" problem w kodzie,
  2. **przeliczyć w dół to, co z niego wynika** (zmiana speca → popraw plan i zadania; zmiana planu →
     popraw zadania) **zanim** ruszysz dalej,
  3. zostawić krótki ślad zmiany (co i dlaczego), żeby historia decyzji się zgadzała.
  Nigdy nie zostawiaj rozjazdu „kod robi X, ale spec mówi Y". Pętle wstecz są **wbudowane**: `/verify`
  i `/review` przy brakach **zawracają do `/implement`**, dopisując konkretne braki do `tasks.md`;
  gdy brak wynika z błędnego planu/speca — najpierw popraw plan/spec (pkt 1–2), potem wróć do implementacji.
- **C-55 — Jeden moment pytań, z wąską furtką.** Pytania do właściciela są **skoncentrowane w
  `/specify`**: jedno wywołanie `AskUserQuestion`, opcja **rekomendowana pierwsza** + etykieta
  `(zalecane)`. Dalsze etapy działają **autonomicznie** — rozstrzygają rozsądnym domyślnym (wzorzec
  sąsiedniego modułu, minimalizm C-53) i idą dalej. **Furtka (wyjątek):** na późniejszym etapie
  wolno zadać **jedno, zbiorcze** pytanie **tylko** gdy decyzja spełnia **wszystkie** warunki:
  (a) jest istotna dla właściciela (a nie techniczny drobiazg), (b) była nie do przewidzenia na
  `/specify`, (c) zły wybór jest kosztowny lub trudny do cofnięcia, (d) nie da się jej rozstrzygnąć z
  artefaktów, kodu ani konwencji. Wtedy **pytaj, nie zgaduj** (`AskUserQuestion`, rekomendowana
  pierwsza + `(zalecane)`), po odpowiedzi zaktualizuj artefakty wg C-54 i jedź dalej. Cel: właściciel
  wołany **jak najrzadziej**, ale **nigdy nie zgadujemy** przy naprawdę ważnej, niejednoznacznej
  decyzji. Wszystko poza tą furtką rozstrzygasz sam. **Bez pytania domykającego:** promocja
  `develop → master` na końcu pipeline'u jest **z góry autoryzowana** (C-52) i wykonywana automatycznie
  — pipeline nie zadaje już żadnego pytania o produkcję. Jedyny wyjątek to sytuacja awaryjna z C-52
  (nieudana kontrola integralności lub odbity push do `master`): wtedy zatrzymaj się i zgłoś właścicielowi.

---

### Jak używać w pipeline
- `/specify` — sekcja *Zgodność z konstytucją* w spec musi wskazać, które reguły dotyczą feature'a;
  to główny (i domyślnie jedyny) moment pytań (C-55).
- `/plan` — plan musi jawnie zaadresować C-10..C-14 (migracje), C-20..C-25 (warstwa app), C-30..C-35 (UX).
- `/tasks` — bramki C-50 wpięte jako kroki (`check:migrations`, `check:actions`, `build`).
- `/verify` i `/review` — weryfikują zgodność z tą konstytucją punkt po punkcie i raportują naruszenia;
  przy brakach zawracają do `/implement` (C-54).
- Każdy etap — trzyma spójność artefaktów (C-54) i pyta tylko przez wąską furtkę (C-55).
