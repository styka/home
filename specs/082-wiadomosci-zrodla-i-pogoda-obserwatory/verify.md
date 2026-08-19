# Weryfikacja: 082 — Wiadomości (odświeżanie, biblioteka źródeł, pasek tematów) + Pogoda (obserwatory wg stanu)

- **Spec:** ./spec.md · **Plan:** ./plan.md · **Zadania:** ./tasks.md
- **Data:** 2026-08-19
- **Środowisko:** lokalny PostgreSQL 16 (`omnia_dev`, migracje zaaplikowane), Node 22, Next 14.2.29.
  **Nigdy prod `DATABASE_URL`** (C-13) — zatrzymanie przed `scripts/migrate.js`.

## 1. Bramki

| Komenda | Wynik |
|---------|-------|
| `check:migrations` | ✅ następny wolny numer 0256 (0254/0255 bez kolizji) |
| `check:actions` | ✅ 161 akcji asystenta, wszystkie z egzekutorem i kontraktem |
| `check:schema-drift` | ✅ brak rozjazdu — migracje odtwarzają `schema.prisma` (4 świadome wyjątki) |
| `check:owner-columns` | ✅ 2345 wywołań Prismy **+ 5 prób mutacyjnych** — nowa kontrola działa |
| `check:ai-coverage` | ✅ 580 akcji sklasyfikowanych; kontrola dostępu: każda z guardem w kodzie |
| `check:i18n` | ✅ zero tekstów zaszytych w komponentach |
| `check:ui-contract` | ✅ 22/22 modułów na `ModuleView` |
| `check:route-gating` | ✅ 19 tras modułowych sprawdza uprawnienie |
| `check:boundaries` | ✅ granice `platform/` ↔ `modules/` egzekwowane |
| `check:module-registry` | ✅ 21 modułów, klasyfikacja zasobów kompletna |
| `check:pagination` | ✅ każde `findMany` z granicą (258 z sufitem) |
| `check:domain` | ✅ zapadka pomocników w akcjach **trzyma na 34** (patrz §4) |
| `check:workspace-fill` / `-nullable` / `-mirror` | ✅ (44 tabele NOT NULL, 4 świadome wyjątki) |
| `check:tailwind`, `check:client-safe`, `check:e2e-waits`, `check:logs` | ✅ |
| `check:cost-badge`, `check:content-memory`, `check:versioning` | ✅ |
| `check:ownership-scope`, `check:grant-mirror`, `check:events`, `check:subscribers`, `check:realtime` | ✅ |
| `tsc --noEmit` (główny + `tsconfig.test.json`) | ✅ bez błędów |
| `npm run test:unit` | ✅ **1142/1142**, 0 fail (w tym 14 nowych: `wierszePuli`, `uklad`, `katalog`) |
| `next lint --dir src` | ✅ **0 błędów**; ostrzeżenia wyłącznie zastane (`exhaustive-deps`, `no-img-element`) |
| `next build` | ✅ „Compiled successfully" (czysty `.next`); `/admin/zrodla-rss` 7,01 kB / 134 kB |
| `check:perf-budget` | ✅ najcięższa trasa 1171 kB, suma 65635 kB — w paśmie ±5% |

**Łącznie 27 bramek statycznych, wszystkie zielone.**

## 2. Kryteria akceptacji

Legenda: ✅ spełnione · ⚠️ częściowo / z zastrzeżeniem · ❌ niespełnione.

### Odświeżanie wiadomości

| AC | Werdykt | Dowód |
|----|---------|-------|
| **AC-1** przebieg kończy się powodzeniem, artykuły trafiają do puli | ✅ | **Uruchomione na żywej bazie**: `wierszePuli(...)` → `prisma.newsArticle.createMany` zapisał **2 wiersze**. Przed poprawką ten sam kod zwracał `Unknown argument ownerId`. Źródło: `src/modules/news/jobs/newsRefresh.ts:117-153` (własność liczona raz na przebieg, `...opts.wlasnosc` zamiast `ownerId`) |
| **AC-2** komunikat o błędzie znika po udanym przebiegu | ✅ | Baner ma warunek `state.status === "FAILED"` (`NewsPage.tsx:473`), a stan pochodzi z **najnowszego** zadania (`news.ts:527-534`, `findFirst` + `orderBy createdAt desc`). Sprawdzone na bazie: po wstawieniu FAILED, a potem DONE, najnowsze zadanie ma `DONE` → baner znika |
| **AC-3** bramka wyłapuje ten rodzaj błędu | ✅ | `check:owner-columns` z 5 wbudowanymi próbami mutacyjnymi. **Dowód czynny**: cofnięcie poprawki wzorca czerwieni dokładnie te dwie próby, które mają paść („MIAŁA paść, a przeszła"), i nie rusza trzech, które mają przejść. Przed 082 obie przechodziły |

Dodatkowo, poza AC: powtórzenie `createMany` na tych samych danych zapisuje **0** wierszy — unikalność
`[workspaceId, sourceId, url]` działa (komentarz w kodzie mówił wcześniej o `ownerId`, czyli o kolumnie,
której nie ma; poprawiony).

### Biblioteka źródeł — użytkownik

| AC | Werdykt | Dowód |
|----|---------|-------|
| **AC-4** przeglądarka z wyszukiwarką i filtrami | ✅ | `SourceCatalogPicker.tsx` (modal, pole szukania + 3 selekty) → `getSourceCatalog` (`modules/news/actions/katalog.ts:44-90`), filtry **serwerowe**. Zapytania sprawdzone na bazie: „kosmos" → Space.com, Space24 (trafienie **po opisie**, nie tylko po nazwie); `DE`+`de` → 14; kategoria `technologia` → 78 |
| **AC-5** dodanie bez wpisywania czegokolwiek | ✅ | `addSourceFromCatalog` kopiuje `name/rssUrl/homepageUrl/descriptor` z wpisu (`katalog.ts:99-127`). Wykonane na bazie: dodało „Onet Wiadomości" z kompletem pól |
| **AC-6** już dodane oznaczone i niemożliwe do powtórzenia | ✅ | Pole `added` z jednego zapytania o klucze użytkownika (`katalog.ts:70-77`), w UI etykieta „Dodane" zamiast przycisku. Powtórzenie odbite **dwukrotnie**: sprawdzeniem w akcji i przez `@@unique([workspaceId, key])` — potwierdzone na bazie (`Unique constraint failed on the fields: (workspaceId, key)`) |
| **AC-7** droga ręczna działa jak dotąd | ✅ | `createSource`/`updateSource`/`deleteSource` **bez zmian** (`git diff` na `actions/news.ts` nie dotyka tych funkcji). W UI oba przyciski obok siebie (`NewsSettings.tsx`) |
| **AC-8** zestaw startowy bez zmian | ✅ | `DEFAULT_SOURCES` i `ensureNewsSetup` nietknięte. Sprawdzone na bazie dla nowego konta: `onet,okopress,niezalezna` — dokładnie jak przed zmianą |

### Biblioteka źródeł — administrator

| AC | Werdykt | Dowód |
|----|---------|-------|
| **AC-9** pełny katalog + CRUD | ✅ | `/admin/zrodla-rss` → `NewsSourceCatalogManager` (dodaj/edytuj/włącz/wyłącz/usuń) na `actions/adminNewsCatalog.ts`. Trasa w buildzie: `ƒ /admin/zrodla-rss 7,01 kB` |
| **AC-10** wyłączony wpis znika użytkownikom, źródła działają dalej | ✅ | Sprawdzone na bazie: po `enabled=false` zapytanie użytkownika (`where.enabled:true`) zwraca **0**, zapytanie administratora **1**. Źródła użytkownika są osobnymi rekordami `NewsSource` (dodanie kopiuje), więc nie są ruszane |
| **AC-11** sprawdzenie kanału zapisuje wynik przy wpisie | ⚠️ | Kod: `checkCatalogEntry` woła `fetchRss` i zapisuje `checkStatus`/`checkedAt`/`checkNote` (`adminNewsCatalog.ts:186-210`); ścieżka zapisu przechodzi `tsc` i jest wywoływana z UI. **Nie dało się wykonać end-to-end z tej piaskownicy**: pośrednik sieciowy odbija `CONNECT` do serwisów zewnętrznych błędem 403 (sprawdzone `curl`-em: BBC i Hacker News → `CONNECT tunnel failed, response 403`), więc `fetchRss` zwraca zero pozycji dla **każdego** adresu. Do sprawdzenia po wdrożeniu |
| **AC-12** eksport/import bez duplikatów | ✅ | **Wykonane na bazie**: eksport 419 wpisów → import tego samego pliku dał `added=0, skipped=419`, katalog nadal 419. Dodatkowo sprawdzone, że import **nie cofa poprawki administratora**: ręcznie zmieniony `rssUrl` przetrwał import nietknięty |
| **AC-13** ≥ 400 wpisów, PL + świat | ✅ | `SELECT` na bazie po `migrate deploy`: **419 wpisów, 31 krajów, 17 języków, 142 polskie**. Kategorie: wiadomości 138, technologia 78, biznes 40, nauka 38, opinie 28, sport 21, lokalne 20, rozrywka 16, kultura 15, zdrowie 13, inne 12 |
| **AC-14** zmiany w dzienniku audytu | ✅ | `logAudit("config", "news.catalog.<akcja>", key, …)` w każdej mutacji (`adminNewsCatalog.ts`: create/update/enable/disable/delete/import). Kategoria `config` jest widoczna w `/admin/audit` |
| **AC-15** odmowa dostępu bez roli administratora | ✅ | Podwójnie: trasa `redirect("/")` przy braku `PERMISSIONS.ADMIN` (`app/admin/zrodla-rss/page.tsx:21`) **oraz** `requireAdmin()` w każdej akcji — sam redirect chroniłby tylko widok, nie dane. Potwierdza to `check:ai-coverage` (guard w ciele każdej akcji) |

### Obserwatory pogody

| AC | Werdykt | Dowód |
|----|---------|-------|
| **AC-16** sortowanie po stanie | ✅ | `poStanie` + `STATUS_ORDER` (`modules/weather/lib/uklad.ts`), wpięte w `WatchersPanel`. Test: sortowanie **stabilne**, `met → partial → unmet → bez werdyktu` (`ukladObserwatorow.test.ts`) |
| **AC-17** liczniki + filtr stanu | ✅ | Rząd chipów-liczników w `WatchersPanel`; klik przełącza stan w filtrze (`przelaczStan`). `liczniki()` zwraca **wszystkie** stany, także z zerem — test |
| **AC-18** grupowanie w sekcje | ✅ | `wSekcje` + przełącznik układu; sekcja pusta nie jest rysowana, kolejność stała — test |
| **AC-19** wybór zapamiętany | ✅ | `WeatherPref` (`workspaceId @unique`), `getWeatherPref` wczytywany **po stronie serwera** w `app/pogoda/page.tsx` i podawany propsem. Sprawdzone na bazie: `upsert` tworzy wiersz z domyślnym `status` i pustym filtrem |
| **AC-20** brak fałszywych stanów przed oceną | ✅ | `oceniono = verdicts !== null && !pending`; przy `false` lista zostaje w kolejności dodania, liczniki i przełącznik `disabled` z `title={t("najpierwOcen")}`. Filtr też nie działa przed oceną — inaczej odsiałby wszystko |
| **AC-21** stan dostępny tekstem | ✅ | `STATUS_STYLE` niesie `label` i `hint` (zachowane z 037); w sekcjach nagłówek to **tekst** + kropka, w licznikach tekst + liczba. Kolor nigdy nie jest jedynym nośnikiem |

### Nawigacja po tematach

| AC | Werdykt | Dowód |
|----|---------|-------|
| **AC-22** poziomy pasek z nazwami, aktywny wyróżniony | ✅ | `TopicPicker.tsx:147-190` — `overflow-x-auto`, chipy `whitespace-nowrap px-3 py-3`, aktywny obramowany `--accent-blue`. Klasa `.omnia-pasek-tematow` w `globals.css` ukrywa scrollbar (dokłada 6 px i psuje wyrównanie wiersza) |
| **AC-23** aktywny sam się dosuwa | ✅ | `useEffect` na `selectedId` → `scrollIntoView({inline:"center"})` (`TopicPicker.tsx:57-68`). Wisi na **stanie**, nie na obsłudze kliknięcia, więc obejmuje wszystkie drogi: chip, strzałka, wybór z listy i gest w `NewsStream` |
| **AC-24** lista z wyszukiwarką zostaje | ✅ | Cała logika listy (szukanie po tytule i filtrze semantycznym, `Esc`, klik poza) **niezmieniona**; przeniósł się wyłącznie jej wyzwalacz na przycisk z chevronem. Powód zapisany w nagłówku pliku, żeby następna sesja nie „posprzątała" jednej z dwóch dróg |
| **AC-25** jeden mechanizm mobile+desktop | ✅ | Zero `hidden md:*` w `TopicPicker.tsx` (sprawdzone `grep`). Cele dotyku `py-3`, `Esc` zamyka listę, `overscroll-behavior-x: contain` blokuje gest „wstecz" przeglądarki na końcu paska |

**Podsumowanie: 24 z 25 kryteriów ✅, jedno (AC-11) ⚠️ — kod gotowy, wykonanie niemożliwe w tym środowisku.**

## 3. Zgodność z konstytucją

| Reguła | Stan |
|--------|------|
| **C-01/C-02/C-03** | ✅ cały kod w `worldofmag/`, artefakty w `specs/082-…/`, alias `@/*` na zewnątrz modułu, ścieżki względne wewnątrz `modules/<x>/` |
| **C-10/C-11** | ✅ dwie ręcznie pisane migracje, numery z `next:migration`, brak kolizji |
| **C-12** | ✅ `category`, `checkStatus`, `watchersLayout` jako `String` + union TS. Zero enumów Prismy |
| **C-13** | ✅ wszystko na lokalnym Postgresie; `scripts/migrate.js` **nie uruchamiany** |
| **C-14** | ✅ seed idempotentny (`gen_random_uuid()::text`, `ON CONFLICT ("key") DO NOTHING`) — **zweryfikowany wykonaniem**: powtórny przebieg 0 nowych wierszy |
| **C-15** | ✅ DDL pisany ręcznie; `grep -E '^(DROP|ALTER TABLE .* DROP)'` na obu migracjach = 0 |
| **C-20** | ✅ każda mutacja z `revalidatePath` (`/wiadomosci`, `/pogoda`, `/admin/zrodla-rss`) |
| **C-21** | ✅ `wlasnoscOsobistaDoZapisu`/`filtrMoichRekordow`; katalog świadomie systemowy, uzasadnienie w planie §2.1 i w komentarzu przy modelu |
| **C-22** | ✅ bez nowego slugu; `/admin/zrodla-rss` pod `PERMISSIONS.ADMIN` |
| **C-23** | ✅ zero nowych `AIAction`; 12 nowych akcji sklasyfikowanych w manifeście |
| **C-24** | ✅ kosz świadomie pominięty — słownik systemowy, odwracalną drogą jest wyłączenie wpisu (jak `adminCategories`) |
| **C-25** | ✅ `logAudit("config", …)` w każdej mutacji katalogu |
| **C-30** | ✅ zero hexów — wyłącznie `var(--*)`; `--on-accent` na kolorowych znacznikach |
| **C-31** | ✅ jeden mechanizm mobile/desktop, `py-3`, `Esc` |
| **C-32** | ✅ nowe teksty w `messages/pl.json` (3 przestrzenie), bramka zielona |
| **C-33** | ✅ kontrakt widoku nietknięty; nowe UI to modale i sekcje w istniejących widokach |
| **C-34** | ✅ usunięcie wpisu przez `useConfirm()`; zero `window.confirm` |
| **C-35** | ✅ zero komponentów bez konsumenta — każdy wpięty w tym samym commicie |
| **C-36** | ✅ kontrakt modułu Wiadomości **nie urósł**; panel admina sięga po tabelę, nie po wnętrze modułu; wspólne typy w `src/lib/news/` (dwaj konsumenci) |
| **C-50/C-51** | ✅ build zielony do `next build`; **trzy** lekcje w `doświadczenia.md` |
| **C-53** | ✅ zero nowych zależności; dwie tabele, dwa pliki akcji, jeden ekran administracyjny |
| **C-54** | ✅ hipoteza o luce w bramce okazała się błędna po pomiarze → poprawiony `plan.md` §3.2 i zakres `T-3`, ślad zostawiony w obu artefaktach |
| **C-55** | ✅ pytania zadane raz, w `/specify`; dalsze etapy bez pytań |

## 4. Regresje

- **Sąsiednie moduły** — obie migracje są **wyłącznie dokładające** (dwie nowe tabele); żadna
  istniejąca tabela, kolumna ani indeks nie są ruszane. `check:schema-drift` i `check:workspace-*`
  zielone. Kaskada przy kasowaniu konta sprawdzona: usunięcie użytkownika czyści artykuły przez
  `Workspace` (0 pozostałych wierszy).
- **Wspólne komponenty** — `Modal`, `Button`, `useConfirm`, `useToast` tylko **używane**, nie zmieniane.
  Jedyna zmiana globalna to **dopisana** klasa `.omnia-pasek-tematow` w `globals.css` (nowa reguła,
  nic nie nadpisuje).
- **`WatchersPanel`** — karta obserwatora została **wydzielona**, a nie przepisana: znaczniki, klasy
  i obsługa zdarzeń przeniesione bez zmian, żeby dwie ścieżki renderowania (płaska i sekcje) nie
  rozjechały się w przyszłości.
- **`TopicPicker`** — usunięty został wyłącznie szeroki przycisk-wyzwalacz; logika listy, wyszukiwarki,
  strzałek i zamykania nietknięta. Gest w `NewsStream` woła to samo `onSelect`, więc korzysta
  z nowego dosuwania bez zmian u siebie.
- **RBAC** — brak nowych slugów i brak zmian w `permissions.ts`/`modules.tsx`/`ModuleSidebar`.
  `check:route-gating` nadal 19 tras modułowych.
- **Wydajność** — budżet w paśmie ±5%; `/wiadomosci` 23,3 kB, `/pogoda` 16,7 kB.
- **Testy zastane** — 1142/1142 przechodzą (przed zmianą: 1128; doszło 14 nowych).

## 5. Werdykt końcowy

**GOTOWE Z UWAGAMI.**

Wszystkie cztery zgłoszenia właściciela zrealizowane, 24 z 25 kryteriów akceptacji spełnione
z dowodem, 27 bramek statycznych zielonych, build i testy przechodzą.

Jedna uwaga, świadomie **nie** zamieciona:

- **AC-11 (sprawdzenie kanału) zweryfikowane tylko na poziomie kodu.** Piaskownica przepuszcza ruch
  wyłącznie przez pośrednik, który odbija `CONNECT` do serwisów zewnętrznych błędem 403, więc
  `fetchRss` zwraca zero pozycji dla każdego adresu — także dla ewidentnie żywych (BBC, Hacker News,
  potwierdzone `curl`-em). Ścieżka zapisu wyniku jest sprawdzona typami i wywoływana z UI, ale
  **pełny przebieg trzeba wykonać po wdrożeniu**, z panelu administratora.
- **Konsekwencja tego samego ograniczenia:** żywotność 419 adresów w katalogu startowym jest
  **niezweryfikowana**. To było świadome ryzyko wyboru właściciela („400+, maksymalnie szeroko"),
  wypisane w specu §9 — i dokładnie dlatego wpis niesie `checkStatus`/`checkedAt`/`checkNote`,
  a panel ma „Sprawdź" oraz wyłączenie jednym ruchem. Pierwszą czynnością po wdrożeniu powinien być
  przegląd katalogu tym przyciskiem.

Nic z tego nie blokuje merge: martwy wpis w bibliotece jest odwracalny jednym kliknięciem, a
odświeżanie u użytkownika liczy próg **per źródło**, więc pojedynczy niedziałający kanał nie psuje
przebiegu pozostałym.
