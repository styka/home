# Doświadczenia — Lessons Learned

Plik prowadzony automatycznie przez Claude Code. Każdy wpis to rzeczywisty problem napotkany podczas pracy nad projektem i wyciągnięta z niego lekcja.

---

## 2026-06-01 — Magiczna ikona obcinała wsadowe polecenia do ~7 akcji (limit tokenów)
**Problem:** Po wklejeniu do asystenta („magiczna ikona") dużego JSON-a z 47 zadaniami, drawer pokazywał tylko 7 pierwszych. Nie było jawnego limitu liczby akcji — wąskim gardłem był sztywny `maxTokens: 1024` w `src/app/api/llm/home/interpret/route.ts`. Każda akcja `create_task` to ~150–250 tokenów, więc w 1024 tokenach model „domykał" tablicę JSON na ~7 pozycjach.
**Rozwiązanie:** Budżet tokenów skalowany do długości wejścia: `Math.min(8192, Math.max(1024, ceil(text.length/2)))`. Dodatkowo tolerancyjny parser `parseActionArray` — gdy odpowiedź urwie się mimo to, przycina do ostatniego kompletnego `}` i domyka `]`, więc zwraca tyle akcji, ile się zmieściło, zamiast 502.
**Lekcja:** Sztywny `maxTokens` przy odpowiedziach o zmiennej długości (listy/JSON) to cichy obcinacz — skaluj budżet do rozmiaru wejścia i zawsze miej plan B na urwany JSON (graceful degrade zamiast twardego błędu). Przy poleceniach generujących N elementów licz „tokeny na element × N", nie jedną stałą.

## 2026-05-31 — Kolizja numerów migracji przy mergu gałęzi roboczej do `develop`
**Problem:** Gałąź robocza dodawała migracje `0049`/`0050` (raporty E2E), ale w międzyczasie `develop` urósł o własne `0049_architecture_full_report`, `0049_omnia_implementation_report_v2` i `0050_omnia_handoff_prompt` (Faza 0 Omnia). Po `git fetch` okazało się, że te same numery są zajęte — merge stworzyłby zdublowane prefiksy migracji, a kolejność stosowania (Prisma sortuje po nazwie katalogu) stałaby się niejednoznaczna.
**Rozwiązanie:** Przed mergem przenumerowałem swoje migracje na `0051`/`0052` (`git mv`), tak by trafiły po najnowszej na `develop`. Zweryfikowałem cały łańcuch `prisma migrate deploy` na świeżej bazie (51 migracji, raporty wstawione) oraz `npm run build`. Konflikt treści był tylko w `doświadczenia.md` (oba wpisy zachowane).
**Lekcja:** Numer migracji to wspólny zasób — przed dodaniem nowej i przed mergem do `develop` **zrób `git fetch origin develop` i sprawdź najwyższy numer tam**, nie tylko lokalnie. Gdy gałąź długo żyje, `develop` mógł już zająć „następny" numer. Najtaniej naprawić to `git mv` na wolny, wyższy numer przed mergem (migracje nie były jeszcze wdrożone na prod), niż rozplątywać zdublowane prefiksy po fakcie.

## 2026-05-31 — Cytaty blokowe (`>`) nie renderują się w raportach (Markdown renderer)
**Problem:** Pisząc duży raport architektury (migracja `0049`) chciałem użyć cytatów blokowych Markdown (`> tekst`) jako „callout". W `src/lib/markdown.ts` funkcja `markdownToHtml` najpierw wywołuje `escapeOutsideCodeBlocks`, która zamienia `>` na `&gt;` w całym tekście poza blokami kodu. Dopiero **później** działa regex cytatu `^> (.+)$`. Po escapowaniu linia zaczyna się od `&gt; `, więc regex nigdy nie trafia — cytat renderuje się jako zwykły akapit z dosłownym `&gt;` na początku. Istniejące raporty (np. `0019`, `0022`, `0035`) mają ten sam ukryty defekt.
**Rozwiązanie:** Naprawiono źródło w `src/lib/markdown.ts`. Kluczowa zmiana: globalny escape **przestał escapować `>`** — escapujemy tylko `&` i `<` (to one neutralizują wstrzyknięcie HTML; samotny `>` nie otwiera tagu). Dzięki temu marker `> ` przeżywa do passu cytatów. Dodano też pass list numerowanych (`1.`, `<ol class="md-ol">`) przed listami punktowanymi oraz wieloliniowe cytaty. **Pułapka po drodze:** próba „czystego" wariantu (usunięcie globalnego escape i escapowanie dopiero w `inlineFormat`) wprowadziła **dziurę XSS** — regex tabel zjada pojedynczy `\n` separatora, skleja kolejny akapit z blokiem `<table>`, a gałąź „pomiń już-otagowane" zwracała ten akapit **bez escapowania**. Dlatego zostawiłem escape globalny (gwarancja, że każdy tekst jest zescapowany), jedynie wyłączając z niego `>`. Pokryte testem manualnym (cytaty, listy, tabele, bloki kodu, oraz XSS dla akapitu sklejonego po tabeli).
**Lekcja:** W tym własnym rendererze **kolejność transformacji i to, co escapujemy globalnie, są warunkiem bezpieczeństwa, nie tylko poprawności**. Nie przenoś escapowania „w dół" do `inlineFormat` bez prześledzenia każdej ścieżki, którą tekst trafia do wyjścia — zwłaszcza gałęzi „pomiń już-otagowane bloki", bo bloki potrafią się sklejać (regex zjada separator) i przepuścić surowy HTML. Bezpieczny, minimalny fix to escapować `&` i `<` globalnie (a `>` zostawić), zamiast refaktoryzować całą kolejność.

## 2026-05-31 — Smoke testy E2E padały na logowaniu: zły id providera w `auth.setup.ts`
**Problem:** Wszystkie klikacze padały, bo projekt `setup:auth` nie tworzył sesji — `/api/auth/session` zwracało `null`. W logach serwera: `[auth][error] TypeError: Cannot read properties of undefined (reading 'type')`. Powód: provider credentials w `src/lib/auth.ts` jest zarejestrowany z `id: "e2e"`, więc jego callback to `/api/auth/callback/e2e`, ale `e2e/setup/auth.setup.ts` POST-ował na `/api/auth/callback/credentials`. NextAuth nie znajdował providera o tym id → błąd `Configuration` (302 na `/api/auth/error?error=Configuration`), brak ciasteczka sesji.
**Rozwiązanie:** Zmieniono ścieżkę w `auth.setup.ts` na `/api/auth/callback/e2e` (zgodną z `id` providera). Po poprawce setup loguje admina i limited usera, a smoke przechodzi.
**Lekcja:** Ścieżka callbacku NextAuth to `/api/auth/callback/<id>`, gdzie `<id>` to **`id` providera**, a nie jego typ. Gdy provider ma jawne `id`, endpoint logowania w testach musi go używać. Objaw „session = null + error=Configuration + Cannot read 'type'" = NextAuth nie dopasował providera po id w URL-u.

## 2026-05-31 — Menu: trzy źródła nawigacji i „disabled zamiast hidden"
**Problem:** Pozycje menu były powielone w trzech miejscach (`AppShell` `MODULES`, ręcznie kodowane `NavItem`-y w `ModuleSidebar`, oraz osobne bloki mobilne + dolny pasek), a brak uprawnień renderował element jako wyszarzony z kłódką (`opacity: 0.35` + `Lock`) zamiast go ukrywać. Każda zmiana działu wymagała edycji wielu list, a użytkownik widział działy, do których i tak nie miał dostępu.
**Rozwiązanie:** Wprowadzono jedno źródło prawdy `src/lib/modules.tsx` (lista `MODULES` + helper `resolveMenu(permissions, prefs)` zwracający `enabled`/`more`). Brak uprawnień ⇒ pozycja w ogóle nie jest renderowana. Dodano per-user preferencje (`UserMenuPref`: kolejność + wyłączone działy, domyślnie wszystko oprócz QA) z sekcją „Więcej…" do włączania działów i edytorem w ustawieniach. Sidebar desktop i drawer mobilny czytają tę samą listę.
**Lekcja:** Gdy ta sama nawigacja jest kopiowana do desktopu, mobile i dolnego paska, najpierw wydziel wspólną definicję (dane + helper widoczności), a dopiero potem renderuj w każdym miejscu. „Brak uprawnień" to ukrycie, nie wyszarzenie — wyszarzony, klikalny element myli i tak kończy się odbiciem na auth-checku.

## 2026-05-31 — „Strona domowa raportów" nie pozwalała przejść do większości raportów
**Problem:** Zgłoszenie „na stronie domowej raportów nie da się przejść do żadnych widoków". `/reports` (`ReportsHomePage`) to dashboard, który listował tylko `reports.slice(0, 8)` najnowszych raportów, a kafelek „Wszystkie raporty" w sekcji „Zarządzanie" linkował do `/reports` — czyli do samego siebie. W bazie jest ~20 raportów systemowych (wiele migracji `INSERT INTO "Report"`), więc starsze raporty były **całkowicie nieosiągalne** z tej strony. Trasa szczegółów `/reports/[slug]` i tak była dynamiczna (używa `auth()`), więc to nie był problem renderu — wiersze raportów działały, brakowało tylko dostępu do reszty.
**Rozwiązanie:** Zdjęto limit `slice(0, 8)` (strona domowa = pełna, klikalna lista wszystkich raportów), usunięto zapętlony self-link „Wszystkie raporty", a sekcję „Zarządzanie" ograniczono do admina (realny cel: panel admina). Dodatkowo dla parytetu dodano `export const dynamic = "force-dynamic"` w `/reports/[slug]/page.tsx` (jedyna uwierzytelniona strona treści bez tego).
**Lekcja:** „Nie da się nigdzie przejść" z listy-dashboardu najczęściej znaczy: dane są ucięte (limit/`slice`) albo link prowadzi do tej samej trasy (martwy self-link), a nie że nawigacja jest technicznie zepsuta. Przy dashboardach typu „ostatnie N" zawsze zostaw realne wyjście do pełnej listy — i sprawdź, czy kafelki „Zarządzanie"/„Zobacz wszystko" nie linkują do bieżącej strony.

## 2026-05-31 — Nowy moduł nie pojawił się w menu na mobile (dwa źródła nawigacji)
**Problem:** Po dodaniu działów „Nauka języków" i „Zdrowie" wpisy pojawiły się na desktopie, ale na iPhonie ich nie było. Zaktualizowany był tylko `ModuleSidebar.tsx` (sidebar desktop), a nawigacja mobilna żyje **osobno** w `AppShell.tsx` (tablica `MODULES` + jawna lista `MobileItem`, plus dolny pasek zakładek). Pozycje zablokowane brakiem uprawnień i tak renderują się jako wyszarzone — więc „kompletny brak w menu" to sygnał, że to nie RBAC, tylko brakujący wpis/niewdrożony kod.
**Rozwiązanie:** Dodano oba działy w `AppShell.tsx`: do `MODULES` (wykrywanie aktywnego modułu w górnym pasku) oraz do mobilnej listy jako `MobileItem` z `locked={isLocked(...)}`. Dolny pasek zakładek zostaje kuratorowany (4 pozycje) — bez zmian.
**Lekcja:** Dodając moduł, aktualizuj OBA źródła nawigacji: `ModuleSidebar.tsx` (desktop) i `AppShell.tsx` (mobile: `MODULES` + `MobileItem`). Przy diagnozie „nie ma w menu" rozróżniaj: wyszarzone = brak uprawnienia (RBAC), całkowity brak = brakujący wpis w którymś menu albo niewdrożony build.

## 2026-05-30 — `npx prisma` ciągnie Prisma 7, schemat projektu to Prisma 5
**Problem:** W świeżym kontenerze (brak `node_modules`) `npx prisma validate` pobrało najnowszą Prismę 7, która odrzuca `url`/`directUrl` w bloku `datasource` (P1012) — choć projekt jest na `prisma@^5.22`. Build/migracje wyglądały na zepsute, a problem był tylko w wersji narzędzia.
**Rozwiązanie:** Najpierw `npm install`, potem wołać binarkę projektu: `./node_modules/.bin/prisma …` (nie `npx prisma`, które bez lokalnej instalacji ściąga latest). Migracje generować offline bez bazy: `git show HEAD:worldofmag/prisma/schema.prisma > /tmp/old.prisma` i `prisma migrate diff --from-schema-datamodel /tmp/old.prisma --to-schema-datamodel prisma/schema.prisma --script`.
**Lekcja:** W tym repo zawsze używaj lokalnej binarki Prisma (zgodnej z `package.json`), nie `npx`. Raporty techniczne trafiają do bazy przez migrację SQL (`INSERT … ON CONFLICT (slug) DO NOTHING`, treść w dollar-quote), bo prod DB nie jest osiągalna z kontenera — nie przez skrypt runtime z `createReport`.

## 2026-05-30 — Admin odebrał sobie dostęp do panelu /admin (RBAC lockout)
**Problem:** Na dev administrator przez panel `/admin/access` przypadkowo usunął sobie dostęp do panelu admina i nie da się go odzyskać z poziomu UI (bramka `/admin` wymaga `module.admin`, a edycja RBAC sama jest pod tą bramką → klasyczny self-lockout). Brak dostępu do bazy.
**Rozwiązanie:** Migracja `0043_restore_admin_access` odtwarza cały łańcuch uprawnień idempotentnie: (1) `Permission(slug='module.admin')`, (2) `RolePermission(ADMIN → module.admin)`, (3) `UserRole(role='ADMIN')` dla `tyka.szymon@gmail.com`. Każdy `INSERT ... SELECT ... WHERE NOT EXISTS`, więc bezpieczna do wielokrotnego uruchomienia i niezależna od tego, które ogniwo zostało usunięte. Stosuje te same wzorce co `0015_permissions` (`gen_random_uuid()::text`, Postgres).
**Lekcja:** Dostęp do panelu admina zależy wyłącznie od uprawnienia `module.admin` (przez `UserRole`→`RolePermission`→`Permission`), nie od legacy `User.role`. Gdy nie ma dostępu do bazy, recovery RBAC robimy migracją idempotentną odtwarzającą wszystkie ogniwa łańcucha naraz — nie zgadujemy, które usunięto.
**Zabezpieczenie (dodane):** `src/actions/access.ts` ma helper `countAdminAccessHolders()` i blokuje trzy drogi self-lockoutu: `toggleRolePermission` (odebranie `module.admin` roli), `removeUserRole` (usunięcie ostatniej roli z dostępem) i `deletePermission` (usunięcie samego `module.admin`) — jeśli operacja zostawiłaby 0 użytkowników z dostępem do `/admin`, rzuca błędem. Bo Next.js maskuje treść błędów server actions w produkcji, lustrzana blokada jest też w UI (`PermissionManager.tsx`): odpowiednie kontrolki są wyłączone z tooltipem, a handlery łapią błąd i pokazują `alert`. Granica bezpieczeństwa to server action; UI to UX. Uwaga: guard celowo nie blokuje, gdy posiadaczy jest już 0 (stan lockoutu) — żeby nie zablokować naprawy.

## 2026-05-30 — Nawigacja z asystenta AI: adresy od LLM trzeba walidować jak nieufne wejście
**Problem:** Magiczna ikona (AICommandSheet) dostała krok `navigate` — LLM zwraca URL, na który mamy przekierować użytkownika (`router.push`). URL pochodzi z modelu, więc bez kontroli groziłby open-redirect (`//evil.com`, `http://…`) albo wejściem na ścieżki spoza aplikacji.
**Rozwiązanie:** `sanitizeNavUrl()` w `agent/route.ts` przepuszcza tylko ścieżki zaczynające się od jednego `/` (odrzuca `//` i absolutne URL-e) i pasujące do whitelisty prefiksów (`/tasks`, `/shopping`, `/notes`, `/pets`). Gdy URL jest niedozwolony, prosimy LLM o poprawkę zamiast go zwracać. Żeby przekierowanie miało sens, `TasksPage` czyta `?status=` i `?task=` (analogicznie do `?focus=`/`?pinned=` w Notatkach).
**Lekcja:** Każdy URL/identyfikator pochodzący z LLM traktuj jak dane od użytkownika — waliduj przeciw whitelist, nie blacklist. Nawigacja deep-link działa tylko, jeśli strona docelowa faktycznie czyta parametry z query — dodanie kroku `navigate` bez wsparcia parametrów po stronie widoku nic nie da.

## 2026-05-29 — Powiadomienie zadania pojawiało się podwójnie (Notification API bez dedup)
**Problem:** Powiadomienie „Zadanie za chwilę: …” przychodziło dwukrotnie. `checkDueNotifications()`
w `TasksPage.tsx` było wołane z `useEffect([tasks])`, więc każda zmiana propu `tasks`
(re-render / `revalidatePath`) ponownie tworzyła `new Notification(...)` dla tego samego zadania.
Brakowało też w treści informacji, z jakiego projektu jest zadanie — był tylko tytuł + „from Omnia”
(„Omnia” to nazwa PWA doklejana jako źródło przez system, nie da się jej usunąć z poziomu kodu).
**Rozwiązanie:** Dedup przez `useRef<Set<string>>` z kluczem `id:dueDate` (przeżywa re-rendery,
re-notyfikacja tylko gdy zmieni się termin). Do treści powiadomienia dodano nazwę projektu (z emoji),
więc widać konkretny projekt zamiast samej marki.
**Lekcja:** Powiadomienia odpalane w `useEffect` zależnym od danych MUSZĄ mieć dedup poza stanem Reacta
(`useRef`), bo efekt powtórzy się przy każdym re-renderze. Nazwy aplikacji w Notification API nie
nadpiszesz — kontekst (projekt/źródło) podawaj w `title`/`body`.

## 2026-05-29 — Margines ikony: licz od ZEWNĘTRZNEJ krawędzi pociągnięcia, nie od promienia
**Problem:** Trzeba było dać ikonie aplikacji jednolity ~2px margines. Pierścienie rysowane są
`stroke`iem o szerokości `sw`, więc realny zasięg grafiki to `R + sw/2`, a nie `R`. Liczenie marginesu
od samego `R` zostawiłoby pół grubości stroke’a wystające poza zakładany margines.
**Rozwiązanie:** W `brandLogo.ts` promień zewnętrzny liczony jako `R = 50 - MARGIN - MAX_SW/2`
(siatka 100×100). Wewnętrzne pierścienie kurczą się same (`r *= K`). Po zmianie geometrii podbito
`ICON_VERSION` (cache iOS).
**Lekcja:** Przy marginesach grafiki wektorowej ze `stroke` uwzględniaj `sw/2`. Każda zmiana wyglądu
ikony = podbicie `ICON_VERSION`.

---

## 2026-05-29 — iOS uparcie cache'uje apple-touch-icon po ŚCIEŻCE (ignoruje ?query) → wersjonowanie ścieżki
**Problem:** Po zmianie logo ikona na ekranie startowym iPhone nadal była stara, mimo że
favicon w Safari/Chrome był nowy, a endpoint `/apple-icon` serwował poprawny PNG (zweryfikowane
lokalnie). Odświeżanie strony i ponowne „Dodaj do ekranu początkowego" nie pomagało. Przyczyna:
iOS/WebKit cache'uje apple-touch-icon po SAMEJ ścieżce URL i IGNORUJE parametr `?hash`, który
Next dokleja przy zmianie ikony (`/apple-icon?abc`). Dodatkowo w `<head>` były DWA linki
apple-touch-icon: automatyczny z konwencji `app/apple-icon.tsx` oraz nasz — iOS mógł brać stary.
**Rozwiązanie:** (1) Ikonę iOS podajemy pod WERSJONOWANĄ ścieżką `/apple-touch-icon/<ICON_VERSION>`
(trasa `app/apple-touch-icon/[v]/route.tsx`), a `ICON_VERSION` (appName.ts) podbijamy przy każdej
zmianie wyglądu — nowa ścieżka = iOS traktuje to jako nowy zasób, bez cache. (2) Usunięto
`app/apple-icon.tsx`, by w `<head>` był tylko jeden link. (3) Dodano `apple-touch-icon` do
wykluczeń matchera middleware.
**Lekcja:** Przy zmianie ikony iOS NIE polegaj na `?query` ani na samym usunięciu kafelka —
zmień ŚCIEŻKĘ pliku apple-touch-icon (wersjonowanie). Pilnuj, by w `<head>` był dokładnie jeden
`<link rel="apple-touch-icon">` (usuń konwencyjne `apple-icon.tsx`, jeśli dodajesz własny link).

## 2026-05-29 — Generowane ikony (icon/apple-icon/pwa-icon) za bramką logowania → iOS pokazuje starą ikonę
**Problem:** Po wdrożeniu nowego logo na produkcji ikona „dodaj do ekranu głównego" na iPhone
pokazywała STARE fioletowe „O", a nie nowe pierścienie (na dev działało). Render produkcyjny
ikony był poprawny (sprawdzony skryptem przez `next/og`) — więc problem nie był w kodzie ikony.
Dwie realne przyczyny: (1) matcher w `src/middleware.ts` wykluczał z bramki logowania tylko
stary katalog `icons`, ale NIE generowane trasy `icon`/`apple-icon`/`pwa-icon` ani dynamiczny
`manifest` — iOS/Safari pobiera te zasoby BEZ sesji, dostawał redirect 302 na `/auth/signin`
i spadał na cache starej ikony; (2) w repo wciąż leżał stary `public/icons/apple-touch-icon.png`
(to fioletowe „O").
**Rozwiązanie:** Rozszerzono wykluczenia matchera o `icon|apple-icon|pwa-icon|manifest|favicon`,
usunięto stare pliki `public/icons/*` i przepięto powiadomienia (`TasksPage`) na `/pwa-icon/192`.
**Lekcja:** Wszystkie publiczne zasoby pobierane bez sesji (ikony, manifest, og-image, robots,
sitemap, sw.js) MUSZĄ być wykluczone z matchera middleware autoryzacji — inaczej zwracają
redirect zamiast pliku. Po podmianie ikon usuń stare statyki z `public/`, bo przeglądarka/OS
potrafi je serwować lub cache'ować. iOS szczególnie agresywnie cache'uje apple-touch-icon —
po naprawie trzeba usunąć i ponownie dodać aplikację do ekranu głównego.

## 2026-05-29 — Ręczny `<link rel="apple-touch-icon">` nadpisuje generowaną `apple-icon.tsx`
**Problem:** Po wdrożeniu nowej ikony marki (generowanej przez `src/app/apple-icon.tsx`)
ikona na ekranie domowym iPhone wciąż pokazywała STARĄ grafikę. Powód: w `src/app/layout.tsx`
w bloku `<head>` był zaszyty ręcznie `<link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />`
wskazujący stary, statyczny PNG. Ten ręczny link ma pierwszeństwo przed konwencją plikową
Next.js (`apple-icon.tsx`), więc nowa ikona nigdy się nie pojawiała.
**Rozwiązanie:** Usunięto ręczny `<link rel="apple-touch-icon">` (oraz `appleWebApp.startupImage`
wskazujący ten sam stary plik). Po usunięciu Next sam wstrzykuje link do generowanej ikony.
**Lekcja:** Gdy używasz konwencji plikowej Next (`icon.tsx`/`apple-icon.tsx`), NIE dubluj
linków do ikon ręcznie w `<head>` — ręczny `<link>`/`<meta>` wygrywa i „zamraża" stary zasób.
Przy podmianie ikon najpierw sprawdź `layout.tsx` (`<head>` i `metadata.icons`/`appleWebApp`).

---

## 2026-05-28 — Build na Render pada: `Module not found: '@/...'` bo `NODE_ENV=production` wycina devDependencies

**Problem:** Nowy serwis prod na Render (`omnia-prod`) wywalał build:
`Module not found: Can't resolve '@/actions/config'` (oraz `@/actions/reports`,
`@/lib/auth`, `@/lib/permissions`) — same pliki pod `src/app/admin/`. Lokalnie
build przechodził bez problemu, na obu wersjach Node (22 i 24). Mylące tropy:
wielkość liter (Mac↔Linux), wersja Node, brak `baseUrl` w `tsconfig` — wszystkie
okazały się fałszywe. Prawdziwy ślad był w logu: „added **111 packages**" —
zdecydowanie za mało. `typescript` siedzi w `devDependencies`, a ustawione
`NODE_ENV=production` każe `npm ci` pominąć devDependencies. Bez pakietu
`typescript` Next.js po cichu nie wczytuje aliasu `@` z `tsconfig.json` →
„Module not found". Widać tylko ~5 błędów (a nie 77), bo build przerywa się na
pierwszych alfabetycznie trasach (`/admin/...`).

**Rozwiązanie:** Dodano `worldofmag/.npmrc` z linią `include=dev`, co wymusza
instalację devDependencies również przy `NODE_ENV=production`. Zweryfikowane:
`NODE_ENV=production npm ci` z tym `.npmrc` instaluje 198 pakietów (zamiast 57),
`typescript` jest obecny, a `next build` przechodzi (69/69 stron) na Node 24.

**Lekcja:** Gdy build na Render/CI pada na `Module not found: '@/...'`, a
lokalnie działa — sprawdź najpierw liczbę zainstalowanych pakietów w logu.
`NODE_ENV=production` + `npm ci` = brak devDependencies (w tym `typescript`,
`@types/*`, `tailwindcss`), których Next potrzebuje do BUILDU. Diagnozę
odtwarzaj przez `NODE_ENV=production npm ci` w czystym checkoutcie, nie przez
zwykłe `npm install`. Trzymaj `.npmrc` z `include=dev` w katalogu aplikacji.

---

## 2026-05-25 — TS: iteracja po `Map.values()` wywala `tsc` (TS2802)

**Problem:** W `petGenetics.ts` `for (const x of map.values())` wywaliło
`tsc --noEmit`: *TS2802: can only be iterated through when using
'--downlevelIteration' or '--target' 'es2015' or higher*. `next build` używa
naszej konfiguracji TS i przy tym targecie iteracja po iteratorach Map/Set jest
zablokowana.

**Rozwiązanie:** Owinąć w `Array.from(map.values())` (działa też dla
`map.keys()`, `map.entries()`, `set.values()`).

**Lekcja:** W tym repo nie iteruj bezpośrednio po iteratorach `Map`/`Set` w
`for...of` — używaj `Array.from(...)`. Dotyczy też spreadu `[...map.values()]`.
Szybka walidacja przed buildem: `npx tsc --noEmit`.

---

## 2026-05-25 — Nowe modele (moduł Zwierzęta): JSON jako String, brak enumów, seed permisji w 2 miejscach

**Problem:** Projektując schemat modułu Zwierzęta, narzucała się pokusa użycia
typu Prisma `Json` (np. `featureFlags Json`) i enumów dla statusów — tak
sugerowały automatyczne analizy. To jednak złamałoby konwencję projektu:
`datasource` to `postgresql`, ale lokalny dev używa SQLite (`file:./dev.db`),
gdzie `Json`/enum się nie kompilują, a `mode: "insensitive"` w zapytaniach jest
Postgres-only. Drugi haczyk: permisje modułów są seedowane **wyłącznie w SQL
migracji** (uruchamianym przez `migrate deploy` w buildzie prod), więc lokalny
`db:push` ich nie tworzy i nowy moduł byłby niewidoczny lokalnie.

**Rozwiązanie:** Wszystkie pola JSON (`featureFlags`, `recurring`, `details`,
`payload`) jako `String?` z `JSON.parse/stringify` (jak istniejące
`Task.recurring String? // JSON`); statusy/typy jako `String` + unia TS.
Permisję `module.pets` zaseedowano w migracji `0026` (prod) **oraz**
idempotentnie w `prisma/seed.ts` (upsert + grant ADMIN) dla lokalnego
`db:push`.

**Lekcja:** W tym repo zawsze: zero enumów, JSON trzymaj w `String`, a nową
permisję modułu dopisuj w dwóch miejscach — w SQL migracji (prod) i w
`seed.ts` (lokalny db:push). Wspólną logikę (np. `computeNextDue`) wydzielaj do
`src/lib` zamiast duplikować między modułami.

---

## 2026-05-24 — Playwright: własny fixture `isMobile` tworzy cykl zależności

**Problem:** Po dodaniu do `test.extend<>()` własnego fixture'a `isMobile`
(`async ({ page }, use) => …`) `playwright test --list` wywalał: *Fixtures
"page" -> "context" -> "isMobile" -> "page" form a dependency cycle* i zbierał
0 testów. Powód: `isMobile` to **wbudowana opcja Playwrighta** (część
deskryptora urządzenia, np. `devices['iPhone 13']`). Builtin `context` czyta
opcję `isMobile`, a mój fixture `isMobile` zależał od `page` (które zależy od
`context`) — kółko się zamknęło.

**Rozwiązanie:** Usunąłem własny fixture. Testy nadal destrukturyzują
`{ isMobile }` — i dostają wartość wbudowaną (true dla projektu iPhone 13,
false dla desktop), dokładnie to, czego chciałem.

**Lekcja:** Nie nadpisuj nazw wbudowanych opcji/fixture'ów Playwrighta
(`isMobile`, `browserName`, `viewport`, `userAgent`, `storageState`, …) własnym
fixturem zależnym od `page`/`context` — powstaje cykl. Jeśli potrzebujesz tej
informacji, czytaj builtin (destrukturyzuj `{ isMobile }`) albo nadaj własnemu
fixture'owi inną nazwę. Szybka walidacja całej serii bez przeglądarki:
`npx playwright test --list` (kompiluje i zbiera testy, nie startuje serwera).

---

## 2026-05-24 — E2E (Playwright) dla aplikacji z logowaniem tylko przez Google: env-gated credentials provider

**Problem:** Aplikacja loguje się WYŁĄCZNIE przez Google OAuth (NextAuth v5), którego nie da się skryptować w Playwright (Google blokuje automatyzację, captcha/2FA). Bez rozwiązania logowania żaden test nie przejdzie dalej niż `/auth/signin`. Dodatkowo `hasPermission` nie ma bypassu dla ADMIN — uprawnienia pochodzą wyłącznie z `RolePermission`, więc testowy użytkownik „admin" bez nadanych grantów i tak nie wejdzie do modułów.

**Rozwiązanie:**
- **Env-gated Credentials provider** w `src/lib/auth.ts`: dodawany do `providers` tylko gdy `process.env.E2E_TEST_MODE === "1"`. W produkcji (Render) ta zmienna nigdy nie jest ustawiona, więc provider jest całkowicie nieaktywny — zero ryzyka. Działa, bo sesja jest `strategy: "jwt"` (Credentials wymaga JWT, nie database sessions). `webServer` w `playwright.config.ts` startuje `npm run dev` z `E2E_TEST_MODE=1`.
- **Seed użytkowników + uprawnień w setupie** (`e2e/fixtures/db.ts`): idempotentny upsert ról `E2E_ALL` (wszystkie permissiony) i `E2E_LIMITED` (tylko `module.home`) + grantów `RolePermission`. Dwa storage-state'y (`admin.json`, `limited.json`) dają pokrycie scenariuszy pozytywnych i gating/blokad jednym mechanizmem.
- **Logowanie bez UI**: `auth.setup.ts` woła `/api/auth/csrf` → POST `/api/auth/callback/credentials`, weryfikuje `/api/auth/session`, zapisuje `storageState`. Reużywane przez projekty `desktop` i `mobile` (iPhone 13).
- **tsconfig split**: `e2e/` i `playwright.config.ts` wykluczone z głównego tsconfig (żeby `next build` ich nie kompilował), osobny `e2e/tsconfig.json` do typechecku testów.

**Lekcja:** Aby E2E-testować appkę z OAuth-only, nie automatyzuj prawdziwego logowania — dodaj **provider testowy gated zmienną środowiskową** (aktywny tylko lokalnie/CI) i loguj przez endpoint `/api/auth/callback/credentials`, zapisując `storageState`. Gdy uprawnienia są czysto rolowe (bez bypassu admina), **seed grantów `RolePermission` musi być częścią setupu testów**, inaczej nawet „admin" jest zablokowany. Trzymaj testy poza `tsconfig` Next, żeby nie wchodziły w produkcyjny build.

---

## 2026-05-24 — Trasy TIR: Google Maps nie omija ograniczeń — liczymy trasę u nas (ORS HGV) i przekazujemy waypointy

**Problem:** Wymaganie brzmiało „pobierz ograniczenia dla ciężarówek + roboty i ustaw Google Maps tak, by je omijał". Konsumencka aplikacja Google Maps **nie ma trybu ciężarówki** i **nie da się wstrzyknąć własnych „omijaj te odcinki"** — parametr `avoid` obsługuje wyłącznie płatne drogi / autostrady / promy. Naiwna implementacja (np. eksport pinów do My Maps) tylko pokazuje ograniczenia, ale nawigacja i tak prowadzi przez nie.

**Rozwiązanie:**
- **Routing po naszej stronie, Google tylko prowadzi.** Profil `driving-hgv` OpenRouteService ma w grafie zakodowane tagi OSM `maxweight`/`maxheight`/`hgv`, więc po podaniu `options.profile_params.restrictions` (waga/wysokość/długość/szerokość/oś) + `options.vehicle_type:"hgv"` natywnie omija drogi z ograniczeniami. Aktualne roboty z Overpass (`highway=construction`) zamieniamy na małe kwadraty i podajemy jako `options.avoid_polygons` (MultiPolygon), z fallbackiem do trasy bazowej gdy ORS odrzuci polygony. Geometrię z gotowej trasy próbkujemy do max 8 waypointów i budujemy URL `https://www.google.com/maps/dir/?api=1&...&waypoints=...&travelmode=driving`.
- **Endpoint `/geojson`** ORS (`.../driving-hgv/geojson`) zwraca gotowy `LineString` — zero dekodowania encoded-polyline.
- **`vehicle_type` jest siblingiem `profile_params`**, nie jest zagnieżdżony w środku (łatwa pomyłka).
- **Limit waypointów Google ~9** → cap 8 punktów pośrednich; korytarz jest „przybliżony" (Google przelicza odcinki między punktami) — to trzeba uczciwie napisać w UI.

**Lekcja:** Zanim obiecasz integrację z cudzą nawigacją, zweryfikuj jej realne API. Gdy platforma docelowa nie umie czegoś z definicji, przenieś logikę do siebie i użyj jej tylko jako „wyświetlacza". Pytaj użytkownika o kierunek (warstwa wizualna vs liczenie trasy) zanim zaczniesz kodować — to zmienia całą architekturę.

## 2026-05-24 — Migrację Prisma trzeba dopisać ręcznie, gdy w środowisku nie ma bazy

**Problem:** Dodałem model `VehicleProfile` do `schema.prisma`, ale `prisma migrate dev` wymaga połączenia z bazą (shadow DB), a kontener nie ma `DATABASE_URL` (provider = postgresql, brak lokalnego Postgresa). Prod stosuje migracje przez `scripts/migrate.js` → `prisma migrate deploy`, które **tylko aplikuje istniejące pliki migracji**, nie generuje ich ze schematu. Sama edycja `schema.prisma` → tabela nigdy by nie powstała na prodzie.

**Rozwiązanie:** Ręcznie napisany `prisma/migrations/0025_vehicle_profile/migration.sql` zgodny z konwencją repo (Float → `DOUBLE PRECISION`, `updatedAt TIMESTAMP(3) NOT NULL`, `createdAt ... DEFAULT CURRENT_TIMESTAMP`, `@unique` → `CREATE UNIQUE INDEX`, FK `ON DELETE CASCADE`). Walidacja przez `npx prisma generate` (działa bez bazy) + `tsc --noEmit` + pełny `next build` (przeszedł, `/truck` jako dynamic route).

**Lekcja:** Bez bazy: `prisma generate` (typy) + ręczna migracja SQL wzorowana na ostatniej + `next build` jako pełna walidacja kompilacji/granic RSC. Pamiętaj, że pliki `"use server"` mogą eksportować **tylko** async funkcje (typy/interfejsy są OK, bo znikają w kompilacji).

## 2026-05-24 — Sidebar-lock działa tylko dla ścieżek znanych `permissionForPath`

**Problem:** Dodanie wpisu do `MODULES` w `AppShell.tsx` i `NavItem` w `ModuleSidebar.tsx` to za mało — blokada (kłódka) i gate strony opierają się o `isPathLocked` → `permissionForPath`. Bez gałęzi dla `/truck` w `permissionForPath` lock by nie zadziałał (tak jak istniejące `/reports`, które nie ma mapowania).

**Rozwiązanie:** Dodać `if (path.startsWith("/truck")) return PERMISSIONS.TRUCK` w `permissionForPath` razem ze slugiem w `PERMISSIONS`. Uprawnienie nadawane idempotentnie w `scripts/migrate.js:seedPermissions()` (mapka grantów per-uprawnienie: `module.truck → [ADMIN, BETA_TESTER]`), bo właśnie tam żyje `module.qa` — nie w migracji SQL.

**Lekcja:** Przy nowym module zawsze ruszasz trójkę: `PERMISSIONS` + `permissionForPath` + seed w `migrate.js`. Sam wpis w nawigacji nie wystarcza.

---

## 2026-05-24 — Scenariusze QA dla 10 modułów: badaj kod równolegle, jeden wspólny helper, slugi globalnie unikalne

**Problem:** Pisząc scenariusze testowe dla wszystkich pozostałych modułów (tasks, notes, kitchen, home, reports, teams, settings, auth, admin, qa-meta) były dwa ryzyka: (1) zmyślenie funkcji, których nie ma w kodzie (np. nieistniejący skrót klawiaturowy, zły zestaw statusów), (2) duplikacja boilerplate (`md()` + pętla upsert) w 11 plikach seedów, plus kolizje slugów między modułami (upsert po slug → kolizja nadpisałaby cudzy scenariusz).

**Rozwiązanie:**
- **Research przez równoległe agenty Explore** przed pisaniem: każdy agent zinwentaryzował realne routes/server-actions/statusy/uprawnienia jednego obszaru. Dzięki temu scenariusze odnoszą się do prawdziwych nazw (`toggleTaskStatus`, `bulkSetMealPlan`, `assertNoteAccess`, role OWNER/ADMIN/MEMBER) zamiast ogólników. Statusy zadań to faktycznie TODO/IN_PROGRESS/DONE/CANCELLED/DEFERRED — bez researchu wpisałbym z głowy.
- **Jeden `qa-helpers.ts`** eksportuje typy + `md()` + `seedModule(prisma, module, epics, authorId)`. Każdy `qa-<module>.ts` eksportuje tylko `*_EPICS: EpicSeed[]`. `qa-all.ts` importuje wszystkie i odpala seedModule w pętli. Refaktor istniejącego `qa-shopping.ts` z inline-logiki na sam eksport tablicy.
- **Weryfikacja unikalności slugów** jednym grepem (`grep -rho 'slug: "..."' | sort | uniq -d`) — zero duplikatów na 201 scenariuszy. Slugi prefiksowane modułem (`scenario-tasks-…`, `scenario-kitchen-…`) eliminują kolizje.

**Lekcja:** Przy generowaniu treści opisującej istniejący kod (scenariusze, dokumentacja, testy) ZAWSZE najpierw zbadaj kod — równoległe agenty Explore to tani sposób na zgruntowanie 10 obszarów naraz bez zaśmiecania własnego kontekstu. Przy N plikach z tym samym wzorcem seeda wyciągnij wspólny `seedModule()` od razu (nie kopiuj pętli upsert 11×). Gdy klucz idempotencji to globalny `slug`, prefiksuj go scope'em i zweryfikuj unikalność jednym poleceniem przed seedem — kolizja slugów po cichu nadpisałaby inny rekord.

---

## 2026-05-24 — Nowy moduł QA: gating przez permission slug, którego wcześniej nie było

**Problem:** Dodając dział QA trzeba było (1) udostępnić go tylko dla `ADMIN` i nowej roli `TESTER`, (2) zapewnić hierarchię treści Epic → User Story → Scenariusz w bazie. Pułapki: schema Prismy jest `postgresql`-only, więc `prisma db push`/`migrate dev` lokalnie failuje (`P1001 localhost:5432`) — nie ma lokalnego Postgresa, dev.db to pusty plik. Druga pułapka: nowy permission `module.qa` nie istnieje w bazie po deployu, a `RolePermission` trzeba zasiać, bo inaczej nawet admin nie zobaczy modułu.

**Rozwiązanie:**
- **Migracja ręczna zamiast `migrate dev`:** napisałem `prisma/migrations/0024_qa_module/migration.sql` ręcznie (CREATE TABLE + indeksy + FK), zgodnie z konwencją wcześniejszych migracji. Lokalnie weryfikacja przez `npx prisma generate` (klient widzi typy) + `npx tsc --noEmit` + `next build` z atrapą `DATABASE_URL` — strony `force-dynamic` nie są prerenderowane, więc build nie dotyka bazy.
- **Seed uprawnień w `scripts/migrate.js`:** po `prisma migrate deploy` skrypt robi `upsert` permission `module.qa` i `RolePermission` dla `ADMIN` + `TESTER` (idempotentnie). Dzięki temu rola TESTER „istnieje" jako zbiór uprawnień bez osobnej tabeli ról — `UserRole.role` to zwykły string. `getAvailableRoles()` w `access.ts` dorzuca wbudowane role do dropdowna, żeby admin mógł przypisać TESTER zanim ktokolwiek ją ma.
- **Trzy osobne tabele zamiast self-relacji:** Epic / UserStory / TestScenario jako oddzielne modele (a nie jedna tabela z `parentId`) — czytelniejsze typy, łatwiejsze `include`, osobne pola (`type`/`priority` tylko na scenariuszu) bez nullowania.

**Lekcja:** Przy module gated nowym uprawnieniem ZAWSZE dodaj seed permission + RolePermission do `scripts/migrate.js` (nie tylko do `PERMISSIONS` w kodzie) — inaczej po deploy moduł jest niewidoczny dla wszystkich. Przy postgres-only schemacie nie próbuj `migrate dev` lokalnie: pisz migration.sql ręcznie i weryfikuj `tsc` + `next build` z atrapą env. Typ z `Promise<X[]>` udostępniaj jako `X` (pojedynczy element), a do propów zagnieżdżonych używaj `X["children"][number]` — nie `X[number]` gdy `X` nie jest tablicą.

---

## 2026-05-22 — Personal dashboard pattern: ukrywaj sekcje per-permission, nie pokazuj „locked"

**Problem:** Stara `HomePage.tsx` pokazywała 3 pille (Shopping/Tasks-dziś/Tasks-overdue) gdzie pille Tasks zostawały na ekranie ale z `Lock` ikoną i `opacity: 0.35` gdy user nie miał `module.tasks`. Niby informacyjne, ale w praktyce: martwy pixel, smog wizualny, mówi "tu coś jest ale nie dla ciebie". Po rozbudowie aplikacji (Kuchnia, Raporty, Zespoły, Admin) wprowadzenie 6+ pille z lockami byłoby tragiczne — user widziałby dashboard pełen ikon kłódki zamiast actionable contentu.

**Rozwiązanie:** Nowa `HomePage.tsx` warunkowo renderuje SEKCJE zamiast lockowanych tile'ów. `ModuleSnapshotGrid` filtruje listę tile'ów wg `userPermissions.includes()` PRZED renderem — user widzi tylko swoje moduły. `TodaySnapshot` ukrywa swoją kolumnę gdy brak permissions lub brak danych. `AdminDashboardWidget` renderowany tylko jeśli `isAdmin`. `InvitationsBanner` widoczny tylko gdy `count > 0`. Footer links zachowuje lockowanie (subtelnie, bo to nawigacja awaryjna). Plus `getSubtitle()` w greeting dynamiczny: „Masz 3 zaległe zadania" / „Dzisiaj czeka 5 zadań" / „2 pozycje do kupienia" — pokazuje stan modułu w jednej linii.

**Lekcja:** Lockowane elementy mają sens tylko gdy `(a)` ich liczba jest niewielka i `(b)` ich pokazanie ma wartość edukacyjną („jest taka feature do której nie masz dostępu"). W dashboardzie power-userskim z 6+ modułami **lepiej ukryć całkowicie niedostępne sekcje** niż utopić dashboard w `opacity: 0.35`. Reguła: jeśli user nie może z tego nic zrobić — nie pokazuj. Wyjątek: nawigacja awaryjna (footer/sidebar) — tam lockowane linki sygnalizują strukturę aplikacji. Drugi insight: `subtitle` w greeting kontekstowy (priority: overdue > today > pending > meals > zero-state) natychmiast komunikuje "co dziś jest ważne" — działa jak personal CEO briefing zamiast statycznego powitania.

---

## 2026-05-21 — Ujednolicenie 4 stron domowych przez ekstrakcję wspólnych primitive'ów

**Problem:** Cztery moduły (Shopping/Tasks/Notes/`/`) miały strony domowe zbudowane na tym samym "języku wizualnym" (max-width 640, h1 22px, sekcje 11px uppercase, karty 14px), ALE każda miała własne dziwactwa: Shopping — 3-kolumnowy management grid z 5 itemami, Tasks — pojedynczy link "Tagi" (a osobno virtual views z tekstowymi liczbami), Notes — brak przycisku Create na home page, główna `/` — własna paleta i layout sekcji. Dodatkowo `/kitchen` w ogóle nie miał home — robił redirect do `/kitchen/recipes`. Niespójność rosła wraz z każdym nowym modułem.

**Rozwiązanie:** Stworzony katalog `src/components/ui/home/` z 5 współdzielonymi primitive'ami: `PageHeader` (h1 z ikoną + subtitle + action), `StatTile` (klikalna kafel ze statystyką, opcjonalnie `emphasized` z accent border), `SectionHeading` (uppercase 11px z optional action po prawej), `ManagementGrid` (auto-fit grid 2-kol fallback), `EmptyState` (ikona + komunikat + opcjonalny CTA). Plus `styles.ts` z cardStyle, page container i hover handlers. Wszystkie 4 strony zrefaktoryzowane. NOWY `KitchenHomePage` zbudowany od zera używając tych samych primitive'ów: stats grid (Przepisy/Posiłki dziś/Spiżarnia/Wygasające), Today's meals (4 sloty), Recently cooked, Expiring soon, Cookbooks carousel, Management grid.

**Lekcja:** "Te same patterns, różne implementacje" w 4 miejscach = każda zmiana wymaga 4 edit'ów i wprowadza nowe rozbieżności. Wyciągnięcie wspólnych primitive'ów do `src/components/ui/home/` zwiększyło spójność (każda strona ma identyczną typografię, padding, hover behavior) i obniżyło koszt dodania kolejnej strony (Kitchen home gotowy w 1 plik, nie 5). Reguła: gdy 3+ strony robią to samo wizualnie różnymi sposobami, refaktoruj do współdzielonego primitive'a — koszt jednorazowy, korzyść w każdym przyszłym dodaniu. Drugi insight: subtitle w header + kontekstowy ("3 zaległe zadania" / "2 posiłki dziś") natychmiast pokazuje stan modułu bez scrollu, znacznie lepiej niż statyczna nazwa.

---

## 2026-05-21 — Headerowy dropdown do przełączania kontekstu modułu = anti-pattern

**Problem:** Moduł Zakupy (najstarszy w projekcie) miał `ListDropdown` w nagłówku strony — custom dropdown pozycjonowany `absolute`, z hover-revealed akcjami rename/delete. Na mobile niemożliwy w użyciu: overlay zawartości, brak hover na touch, mały hit target. Na desktopie cramped między `SortControl`/`Wyczyść`/statsami w headerze. Newer moduły (Tasks) używały już lepszego patternu — sub-sidebar w `ModuleSidebar` plus natywny `<select>` na mobile — ale nikt nie wrócił do Zakupów.

**Rozwiązanie:** Powstał `ShoppingSideNav` mirrorujący `TasksSideNav` (lista entries z inline rename/create/delete, sub-linki Mapy/Ikony, separator), podpięty w `ModuleSidebar` warunkowo dla `/shopping/*`. Mobile dostał natywne `<select>` w headerze strony (jak `TasksPage`) — full-screen native picker iOS/Android. `ListDropdown.tsx` usunięty. Server action `getListSummaries(archived?)` wyciągnięty z `app/shopping/page.tsx` jako jedyne źródło danych dla sidebara i catalogu.

**Lekcja:** Custom dropdown w headerze ≠ rozwiązanie do przełączania kontekstu w module. Wzorzec referencyjny: **sub-sidebar (desktop) + natywny `<select>` (mobile)**. Sub-sidebar daje stały widok wszystkich list z licznikami i miejsce na inline-CRUD bez utrudniającej hover-revealed UI. Natywny `<select>` na mobile to fullscreen UI systemu — zawsze lepszy niż jakikolwiek custom dropdown. Gdy zauważasz że nowsze moduły mają lepszy nawigacji pattern niż starsze, refaktoruj starsze do zgodności — niespójność modułów jest gorsza niż każdy z nich osobno.

---

## 2026-05-21 — `bulkSetMealPlan` race condition: pętla findFirst + create/update bez `$transaction`

**Problem:** W `bulkSetMealPlan` była pętla po `input.entries` z `prisma.mealPlanEntry.findFirst({ date, slot, ownerId })` → `update` albo `create`. Dwa concurrent wywołania (np. AI Plan tygodnia kliknięte dwa razy) mogły oba zobaczyć "slot pusty" i utworzyć duplikaty wpisów dla tej samej kombinacji date×slot×owner. W schemie nie ma `@@unique([date, slot, ownerId])`, więc DB tego nie zatrzyma.

**Rozwiązanie:** Cała pętla owinięta w `prisma.$transaction(async (tx) => {...})`, wszystkie zapytania przepisane na `tx.mealPlanEntry.*`. Liczniki `added`/`skipped` zwracane z transakcji.

**Lekcja:** Każdy server action który robi „find-then-create/update" w pętli to potencjalny race condition. Owijaj w `$transaction` zawsze gdy: (1) jest pętla po wielu rekordach, (2) między `find` a `create/update` może wejść drugi request. Trwałą gwarancją jest też `@@unique` w schemie — ale transakcja serializuje czytanie/pisanie nawet bez constraintu.

---

## 2026-05-21 — Polski plural inline w 5+ miejscach → wyodrębnić utility na drugiej kopii

**Problem:** W kuchni mieliśmy 5 inline-instancji formuły `n === 1 ? 'X' : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? 'Y' : 'Z'` dla "przepis/przepisy/przepisów", "pozycja/pozycje/pozycji", "posiłek/posiłki/posiłków". Powielanie tej samej logiki z drobnymi różnicami (np. `< 10 || >= 20` vs `< 12 || > 14` — pierwsza jest BŁĘDNA dla liczb 12-14 i 112-114).

**Rozwiązanie:** `src/lib/polishPlural.ts` z funkcją `polishPlural(n, [one, few, many])`. Refactor 5 call site'ów (CookbookList, CookbookView, ShopForRecipeDialog, ShoppingFromPlanDialog, PlanWeekDialog).

**Lekcja:** Reguła "trzy podobne linie" — przy drugiej kopii już ekstraktuj. Polski plural ma subtelność `n % 100 ∈ [12,14] → many`, którą inline-formuły czasem łapią błędnie. Jeden punkt prawdy → testowalne i jednorazowo poprawione.

---

## 2026-05-21 — `setUTCHours(12, …)` to świadomy „noon UTC trick" — nazwa wprowadza w błąd

**Problem:** `startOfDayUTC()` ustawiała `setUTCHours(12,0,0,0)`. Nazwa sugeruje początek dnia (północ UTC), kod robi południe UTC. Reviewer mógł "naprawić" na `setUTCHours(0,…)` co skutkowałoby przesunięciem MealPlanEntry o dzień w PL (UTC+1/+2): 2026-05-21T00:00Z = 2026-05-21T02:00 lokalnie OK, ale przy odczycie z `new Date(date).toLocaleDateString("pl")` dla użytkownika z TZ ujemnym dzień się cofa. Noon UTC jest stabilny — żadna strefa nie przesunie tego do innego dnia kalendarzowego.

**Rozwiązanie:** Rename na `dayKeyUTC`, dodany komentarz wyjaśniający dlaczego noon a nie midnight.

**Lekcja:** „Magic numbers" / „magic logic" w date utility ZAWSZE wymagają komentarza wyjaśniającego DLACZEGO. Nazwa funkcji musi mówić co robi (key dla daty), nie jak była zaimplementowana w pierwszej iteracji. Drugi reviewer (lub późniejszy ty) nie ma kontekstu i może "uprościć" coś co było celowe.

---

## 2026-05-21 — `revalidatePath` z ID gdy ścieżka jest po slugu — cache nie unieważnia się

**Problem:** W `markRecipeCooked(id)` byłem nieuważny i napisałem `revalidatePath(\`/kitchen/recipes/${id}\`)`. Tymczasem dynamic route używa `[recipeId]`, ale linki w UI (RecipeView, RecipeCard) używają `recipe.slug`. W efekcie Next.js cachuje stronę pod kluczem slug-owym, a `revalidatePath` z ID nie pasuje do żadnej już wyrenderowanej ścieżki. Po `Ugotowałem` user widzi stary `cookCount` aż do twardego F5.

**Rozwiązanie:** Po `prisma.recipe.update` dorzucić `select: { slug: true }` i wywołać `revalidatePath(\`/kitchen/recipes/${updated.slug}\`)`.

**Lekcja:** `revalidatePath` musi mieć dokładnie tę samą ścieżkę, którą Next.js wyrenderował i zacachował. Jeśli URL używa `slug`, to `id` nie unieważni cache nawet jeśli oba są zaakceptowane przez `getRecipe`. Reguła: w server action pobierz `slug` z rekordu po update i użyj go w `revalidatePath`.

---

## 2026-05-21 — `trackActivity` z literal union modułów — przy nowym module trzeba rozszerzyć typ

**Problem:** Stworzyłem `src/actions/recipes.ts` i `cookbooks.ts` z `trackActivity("kitchen", …)`. TypeScript rzucił `TS2345: Argument of type '"kitchen"' is not assignable to parameter of type '"shopping" | "tasks" | "notes"'` — funkcja `trackActivity` w `src/actions/activity.ts` ma sztywno wpisany literal union dla modułów.

**Rozwiązanie:** Dodanie `"kitchen"` do literal union w sygnaturze `trackActivity(module: "shopping" | "tasks" | "notes" | "kitchen", …)`. Sama tabela `UserActivity.module` to `String` — DB nie wymaga zmian.

**Lekcja:** Po dodaniu nowego modułu — sprawdzić wszystkie literal union typy w `src/actions/activity.ts`, `src/lib/permissions.ts`, `permissionForPath()`, `MODULES` w `AppShell.tsx`. TypeScript wyłapie większość, ale warto przejrzeć ręcznie żeby nie zaskoczyło to dopiero podczas buildu.

---

## 2026-05-20 — Brakujące `teamId` w `select` po rozszerzeniu schematu

**Problem:** Dodaliśmy pole `teamId` do modelu `Report` w `schema.prisma`. Typ `ReportMeta = Omit<Report, "content">` automatycznie zaczął wymagać `teamId`. Oba zapytania Prisma używały `select` bez `teamId`, więc TypeScript rzucił błąd dopiero na produkcyjnym buildzie Render — lokalnie nie było `prisma generate`.

**Rozwiązanie:** Dodanie `teamId: true` do obu `select` w `getReportsMeta()` i `getUserReportsMeta()`. Zmiana rzutowania z `as ReportMeta[]` na `as unknown as ReportMeta[]` tam gdzie mapowanie usuwa pole `author`.

**Lekcja:** Po każdym dodaniu pola do modelu Prisma — przejrzeć wszystkie miejsca które używają `Omit<Model, ...>` jako typ zwracany. Jeśli zapytanie używa `select` (nie `include`), musi jawnie wymieniać każde pole. Typy Prisma są ścisłe — `select` bez nowego pola ≠ pełny model.

---

## 2026-05-20 — Server Actions bez `requireAuth()` na mutacjach

**Problem:** Nowe pliki akcji (`tags.ts`, `noteGroups.ts`) zostały stworzone bez dodania `requireAuth()` do funkcji mutujących (create/update/delete). `getConfigValue()` odczytywał klucz API (`groq_api_key`) bez żadnej ochrony.

**Rozwiązanie:** Dodanie `requireAuth()` do każdej funkcji mutującej w `tags.ts` i `noteGroups.ts`. `getConfigValue()` dostało `requireAdmin()`.

**Lekcja:** Tworząc nowy plik `actions/*.ts` — jako pierwszy krok dodaj `requireAuth()` lub `requireAdmin()` do każdej funkcji która modyfikuje dane. Funkcje tylko-do-odczytu (`getTags`, `getNoteGroups`) mogą być publiczne jeśli dane nie są wrażliwe, ale mutacje zawsze wymagają auth. Funkcje odczytujące wrażliwe dane (klucze API, konfiguracja) — `requireAdmin()`.

---

## 2026-05-20 — Łańcuch przekazywania propsów zerwany (searchQuery)

**Problem:** `NoteRow` implementował podświetlanie wyników wyszukiwania (`highlightMatch`), ale `searchQuery` był urywany na poziomie `NoteList` — nie był destrukturyzowany i nie trafiał do `sharedProps`, przez co `NoteGroupSection` i `NoteRow` nigdy go nie otrzymywały.

**Rozwiązanie:** Dodanie `searchQuery` do destrukturyzacji w `NoteList`, do `sharedProps`, do interfejsu `NoteGroupSectionProps` i do wywołania `NoteRow`.

**Lekcja:** Przy dodawaniu nowego propu do komponentu głęboko w drzewie — zawsze przejść cały łańcuch od góry do dołu i upewnić się że prop jest: (1) w interfejsie każdego komponentu pośredniego, (2) destrukturyzowany, (3) przekazywany dalej. Samo dodanie do interfejsu TypeScript bez destrukturyzacji nie generuje błędu kompilacji — prop po cichu ginie.

---

## 2026-05-20 — Konflikty merge: feature branch vs. bardziej zaawansowany master

**Problem:** Feature branch `claude/update-claude-config-FPi9s` modyfikował te same pliki co master, ale master był bardziej zaawansowany (miał grid view, `assertNoteAccess`, itd.). Merge `--no-ff` do mastera wygenerował konflikty w 8 plikach jednocześnie.

**Rozwiązanie:** `git checkout --ours` dla plików gdzie master był zdecydowanie bardziej kompletny (NoteRow, ShoppingPage, NoteList, NoteGroupSection, CommandPalette, notes.ts). Ręczne scalenie dla `schema.prisma` i `reports.ts` gdzie obie strony wnosiły coś unikalnego.

**Lekcja:** Przed mergem feature brancha — sprawdzić `git diff master...feature-branch` żeby zobaczyć co się rozjechało. Jeśli master poszedł dalej w tych samych plikach, lepiej zrobić `git rebase master` na feature branchu przed mergem — unika konfliktów lub ogranicza je do minimalnego diff. `--no-ff` merge jest dobry dla historii, ale rebase najpierw czyni go czystym.

---

## 2026-05-20 — `prompt()` zablokowany w niektórych kontekstach przeglądarki

**Problem:** `window.prompt()` użyte do tworzenia nowej listy zakupów w CommandPalette jest zablokowane w Safari na iOS w trybie PWA, w niektórych iframe'ach i ogólnie nie pasuje do stylu aplikacji.

**Rozwiązanie:** Inline input wbudowany bezpośrednio w CommandPalette — `useState(creatingList)` + `useState(newListName)` + ref do focusu + obsługa `Enter`/`Escape`.

**Lekcja:** Nigdy nie używać `window.prompt()`, `window.alert()`, `window.confirm()` w aplikacji Next.js. Zawsze zastępować własnym UI — inline inputem, modalem lub toast z akcją. Natywne dialogi są blokowane w PWA, iframe i na iOS Safari.

## 2026-05-29 — Brak UI dodawania na liście zakupów → na mobile nie dało się nic dodać
**Problem:** Widok listy zakupów (`ShoppingPage`) nie renderował żadnego pola dodawania
produktu — jedyną drogą była paleta poleceń (`Ctrl+K`, tylko desktop). Komponent
`QuickAddBar` istniał, ale był osierocony, a `[listId]/page.tsx` pobierał `categoryNames`
i ich nie przekazywał. Na telefonie (brak skrótu klawiszowego) dodawanie było niemożliwe.
**Rozwiązanie:** Podpięto istniejący, responsywny `QuickAddBar` w `ShoppingPage` i przekazano
`categoryNames` z page.tsx.
**Lekcja:** Każda funkcja sterowana wyłącznie skrótem klawiszowym musi mieć też widoczny
element UI (przycisk/pole), inaczej znika na mobile. Po refaktorze sprawdź, czy komponenty
nie zostały „osierocone" — `grep` na użycie komponentu, nie tylko na jego istnienie.

## 2026-05-29 — FAB chowający się za mobilnym dolnym paskiem nawigacji
**Problem:** „Magiczna" ikona AI (FAB) miała `position:fixed; bottom:24; z-index:30`, a dolny
pasek nawigacji na mobile to `z-40`, wysokość `56px + safe-area` — FAB był pod paskiem i
wyglądał na „zniknięty".
**Rozwiązanie:** FAB na klasach Tailwind: `bottom-[calc(72px+env(safe-area-inset-bottom))]
md:bottom-6 z-40` — ponad paskiem na mobile, bez zmian na desktopie.
**Lekcja:** Elementy `position:fixed` w rogu muszą uwzględniać wysokość mobilnego paska
nawigacji (+ `env(safe-area-inset-bottom)`) i mieć z-index ≥ pasek.

## 2026-05-29 — Surowy „Digest" zamiast komunikatu przy błędzie Server Action
**Problem:** Dodanie zadania z desktopu potrafiło rzucić błąd widoczny tylko jako
„Digest: …", bo handler wołał `createTask` w `startTransition` bez `try/catch`, a akcja
mogła rzucić m.in. gdy przekazano wirtualny widok (`all`/`today`) jako `projectId` do
`assertProjectAccess`.
**Rozwiązanie:** Utwardzono `createTask` (walidacja tytułu, wirtualne widoki = brak projektu,
bezpieczne parsowanie dat) i owinięto wywołanie w `try/catch` z `useToast`.
**Lekcja:** Każde wywołanie Server Action z UI owijaj w `try/catch` i pokazuj błąd (Toast) —
„cichy Digest" to brak obsługi błędu. Akcje walidujące `projectId` muszą odsiewać wirtualne
identyfikatory widoków, których nie ma w bazie.

## 2026-05-29 — Lokalny dev: provider Prisma to tylko PostgreSQL (notka SQLite w CLAUDE.md nieaktualna)
**Problem:** `npm run db:push` z `file:./dev.db` zawiódł — `schema.prisma` ma `provider =
"postgresql"`, a Prisma CLI nie czyta `.env.local` (tylko `.env`). Build odpala też
`scripts/migrate.js`, który próbuje połączyć się z bazą.
**Rozwiązanie:** Do walidacji bez bazy wystarczy `prisma validate` + `prisma generate` z
dowolnymi (atrapowymi) `DATABASE_URL`/`DIRECT_URL` (nie łączą się). `next build` kompiluje
strony `force-dynamic` bez połączenia z bazą — błąd dotyczy wyłącznie post-build migracji.
**Lekcja:** Schemat i typy waliduj `prisma validate` + `prisma generate` + `tsc --noEmit` +
`next build`; połączenie z bazą (db:push/migrate) wymaga realnego Postgresa (Docker/Neon),
nie pliku SQLite.

## 2026-05-29 — Kopiowanie do schowka działało na desktopie, na mobile NotAllowedError
**Problem:** Przycisk „Kopiuj prompt dla Claude Code" w adminie (`OmniaClipboardButton`)
wywoływał `navigator.clipboard.writeText()` dopiero PO `await getOmniaTasksForClipboard()`
(server action). Na iOS Safari po `await` przeglądarka traci „transient activation" z gestu
kliknięcia i blokuje zapis do schowka → NotAllowedError. Na desktopie ten sam kod działał.
**Rozwiązanie:** Zapis startujemy synchronicznie w obrębie gestu przez `navigator.clipboard.write`
z `ClipboardItem`, któremu wolno podać `Promise<Blob>` — przeglądarka czeka na tekst nie tracąc
aktywacji. Fallback: `writeText` (desktop/Android), a dla najstarszych przeglądarek textarea +
`execCommand`. Wynik producenta tekstu cache'owany, by fallback nie pobierał danych dwa razy.
**Lekcja:** Na iOS NIGDY nie wołaj `clipboard.writeText` po `await`. Jeśli tekst wymaga async pracy,
przekaż `Promise` do `ClipboardItem` i użyj `clipboard.write([item])` — to jedyny sposób na zachowanie
aktywacji użytkownika po fetchu. Zawsze testuj kopiowanie na realnym Safari/iPhone, nie tylko na desktopie.

## 2026-05-29 — AI tworzyło zadanie w skrzynce zamiast w otwartym projekcie
**Problem:** Na widoku `/tasks/<projectId>` polecenie do „magicznej ikony AI" („utwórz zadanie X")
tworzyło zadanie w skrzynce, nie w otwartym projekcie. `AICommandSheet` wysyłał do LLM tylko opisowy
`routeHint` („widok projektu zadań") bez ID/nazwy projektu, a `execute` przy braku `projectName`
wpadał w fallback do inboxa.
**Rozwiązanie:** `AICommandSheet` wyciąga `activeProjectId` ze ścieżki (tylko dla realnego projektu,
nie widoków wirtualnych today/upcoming/overdue/all) i przekazuje `currentProjectId` do interpret i
execute. Interpret dokleja nazwę bieżącego projektu do promptu (LLM ustawia `projectName` tylko gdy
użytkownik wskaże inny). Execute: gdy brak `projectName`, używa `currentProjectId` (po sprawdzeniu
dostępu) PRZED fallbackiem do skrzynki.
**Lekcja:** Kontekst widoku przekazuj do LLM jako twarde dane (ID), nie tylko opis w `routeHint`.
Domyślne wartości zależne od kontekstu egzekwuj po stronie serwera (execute), nie licz wyłącznie na to,
że model „się domyśli".

## 2026-05-29 — „from Omnia" w powiadomieniu jest NIEUSUWALNE z kodu
**Problem:** Prośba o usunięcie „from Omnia" z tytułu powiadomienia. Śledztwo: aplikacja NIE wysyła
e-maili (brak nodemailer/resend/itp.) ani web-push (brak handlera `push` w `sw.js`, brak VAPID).
Powiadomienia to `new Notification()` w `TasksPage.tsx`. „Omnia" pochodzi z pola `name` manifestu PWA
(`appName.ts` → `APP_TITLE`) i jest doklejane przez SYSTEM/przeglądarkę jako źródło powiadomienia.
**Rozwiązanie:** Brak zmiany w kodzie — sufiks źródła jest dodawany przez OS dla zainstalowanego PWA
(jak u każdej aplikacji) i nie ma API, by go usunąć. Jedyny kodowy regulator to zmiana `name` w
manifeście (zmienia słowo, nie usuwa „from"). Udokumentowano w raporcie zamiast pozorować poprawkę.
**Lekcja:** Atrybucji aplikacji w powiadomieniach (Notification API / web-push) nie da się usunąć z
kodu — to zachowanie systemowe. Nie obiecuj „naprawy"; wyjaśnij ograniczenie i jedyny realny regulator
(nazwa w manifeście).

## 2026-05-29 — Załączniki zdjęć bez zewnętrznego storage → downscale do data-URL w DB
**Problem:** Przepisy miały dostawać załączniki/zdjęcia, ale projekt nie ma żadnego storage (S3/CDN) —
obrazy trzymane były dotąd tylko jako URL-e (string).
**Rozwiązanie:** Zdjęcia zmniejszane po stronie klienta (canvas, max 1400 px, JPEG q≈0.82) i zapisywane
jako `data:`-URL w `RecipeImage.url` (Postgres TEXT). OCR per zdjęcie (vision LLM) zapisuje transkrypcję
w nowym polu `RecipeImage.ocrMarkdown` (NULL=nieanalizowane, ""=brak tekstu), prezentowaną obok zdjęcia.
**Lekcja:** Bez storage pragmatycznie trzymaj zdjęcia jako downscalowane data-URL-e w DB, ale ZAWSZE
zmniejszaj po stronie klienta przed zapisem (rozmiar wiersza/transferu). Rozróżniaj „nieanalizowane"
(NULL) od „przeanalizowane, brak wyniku" ("") — inaczej nie wiadomo, czy ponowić OCR.

## 2026-05-29 — Powiadomienia zadań nie działały na iPhone (new Notification vs Service Worker)
**Problem:** Po poprzedniej poprawce powiadomienia o zadaniach pojawiały się tylko na desktopie,
a na iPhone (Safari/PWA) w ogóle. Kod używał konstruktora `new Notification(...)`, który na iOS
nie jest wspierany — iOS pokazuje powiadomienia wyłącznie przez Service Worker
(`registration.showNotification`). Konstruktor cicho zawodził na telefonie.
**Rozwiązanie:** Dodano `showTaskNotification()` w `TasksPage.tsx`, która najpierw próbuje
`navigator.serviceWorker.ready` → `reg.showNotification(...)` (działa i na iOS, i na desktopie),
a `new Notification()` jest tylko fallbackiem. W `sw.js` dodano handler `notificationclick`
(fokus okna / otwarcie /tasks) i podbito wersję cache do v2. `tag` = klucz dedup, by system nie
zdublował powiadomienia.
**Lekcja:** Powiadomienia w PWA pisz od razu przez `registration.showNotification` — konstruktor
`new Notification()` nie działa na iOS. Każda zmiana w `sw.js` wymaga podbicia wersji cache,
by klient pobrał nowy worker.

## 2026-05-29 — OCR przepisów zwracał błąd (wycofany model wizyjny Groq)
**Problem:** Po wybraniu zdjęcia OCR przepisu zwracał błąd i przepis nie powstawał. Trasy
`/api/llm/kitchen/ocr-image` i `/ocr-text` używały modelu `llama-3.2-11b-vision-preview`, który
Groq WYCOFAŁ (`model_decommissioned`) — każde zapytanie wizyjne kończyło się błędem.
**Rozwiązanie:** Nazwę modelu wyniesiono do `src/lib/groqVision.ts` (`GROQ_VISION_MODEL =
meta-llama/llama-4-scout-17b-16e-instruct`) i podpięto w obu trasach. Dodano `parseGroqError()`,
która wyciąga prawdziwy komunikat z odpowiedzi Groq i dokleja kod HTTP — przy kolejnej awarii widać
realną przyczynę zamiast gołego statusu.
**Lekcja:** Modele „preview" u Groq bywają wycofywane bez zapowiedzi — trzymaj nazwę modelu w jednym
miejscu (stała) i przepuszczaj prawdziwy komunikat błędu dostawcy do frontu, by diagnoza nie wymagała
zgadywania.

## 2026-05-30 — Powiadomienia: brak timera + zawieszanie na navigator.serviceWorker.ready
**Problem:** Po przejściu na `registration.showNotification` powiadomienia działały gorzej —
na komputerze potrafiły zniknąć, na iPhone (apka otwarta) też bywało źle. Dwa błędy: (1) BRAK
timera — `checkDueNotifications` odpalało się tylko przy montażu i zmianie propu `tasks`, więc
przypomnienie „10 min przed" pojawiało się tylko przypadkiem; (2) `navigator.serviceWorker.ready`
to obietnica, która NIGDY się nie odrzuca — przy niezdrowym/nieaktywnym SW `await` wisiał w
nieskończoność i nie było fallbacku na `new Notification()`.
**Rozwiązanie:** Dodano `setInterval` co 30 s (czytający najnowsze zadania przez `tasksRef`) oraz
ścigano `ready` z timeoutem 1,5 s (`Promise.race`) — gdy SW nie odpowie, spadamy na konstruktor
`new Notification()` (desktop). iOS w tle nadal wymaga Web Push (osobny, zaplanowany krok).
**Lekcja:** `navigator.serviceWorker.ready` nigdy nie rejectuje — nie czekaj na nią bez timeoutu,
bo zabijesz ścieżkę fallback. Powiadomienia „o czasie" wymagają własnego timera; sama zależność od
danych w `useEffect` nie wystarcza. Klient pokaże notyfikację tylko gdy apka żyje — tło to Web Push.

## 2026-05-30 — OCR przepisu zwracał 422 (jednostrzałowe zdjęcie→JSON jest kruche)
**Problem:** Po naprawie modelu (scout) import przepisu ze zdjęcia leciał 422 „not-a-recipe" nawet
dla czytelnych kartek. Trasa `ocr-image` prosiła model wizyjny, by JEDNOCZEŚNIE odczytał obraz i
zwrócił sztywny JSON przepisu — model często się „poddawał" i zwracał `{"error":"not-a-recipe"}`.
Model był OK (scout to właściwy model wizyjny Groq; maverick jest wycofywany na rzecz tekstowego
gpt-oss-120b), problemem było połączenie dwóch trudnych zadań w jednym wywołaniu.
**Rozwiązanie:** Rozbito OCR na dwa kroki: (1) model wizyjny robi wierną transkrypcję tekstu ze
zdjęcia, (2) model tekstowy (`llama-3.3-70b-versatile`, tryb `response_format: json_object`) układa
transkrypcję w przepis. 422 zwracamy tylko gdy naprawdę nie odczytano tekstu. Wspólny helper
`groqChat()` + `stripJsonFence()` w `groqVision.ts`. `ocr-text` też dostał tryb JSON.
**Lekcja:** Nie każ modelowi wizyjnemu czytać i strukturyzować w jednym strzale — rozdziel
„czytanie obrazu" (vision) od „układania w JSON" (model tekstowy + json_object). Dużo wyższa
skuteczność, zwłaszcza dla pisma odręcznego.

## 2026-05-30 — Agent „magicznej ikony": akcje celowane po id wymagają re-weryfikacji własności na serwerze
**Problem:** Nowy agent AI pobiera dane przez narzędzia odczytu i generuje akcje zbiorcze celujące
w konkretne rekordy przez `taskId`/`itemId`/`noteId`/`listId`. Te akcje trafiają najpierw do `ActionDrawer`,
gdzie użytkownik może edytować payload — a więc id przychodzące do `/execute` są w pełni klienckie
i NIE wolno im ufać (klient mógłby podstawić cudze id).
**Rozwiązanie:** Egzekutor dla ścieżki id nie robi „gołego" `findUnique(id)`, tylko wykonuje akcję przez
istniejące Server Actions z `src/actions/*` (`updateTask`, `deleteItem`, `updateNote`…), które same
asertują dostęp (`assertProjectAccess`/`assertListAccess`/`assertNoteAccess`). Fallback po `searchQuery`
wyszukuje WYŁĄCZNIE w zakresie własności użytkownika (OR ownerId/team/membership). Pętla agenta jest
bezstanowa — przy `clarify` zwraca transkrypt do klienta i wznawia po dosłaniu odpowiedzi; nawet
zmanipulowany transkrypt nie obejdzie kontroli dostępu, bo te są po stronie serwera w warstwie zapisu.
**Lekcja:** Gdy LLM proponuje akcje na konkretnych rekordach po id, a użytkownik może edytować payload
przed wykonaniem — id są nieufne. Wykonuj zapisy przez te same serwisy co UI (asercje dostępu wewnątrz),
a nie bezpośrednim Prisma po id. Bezpieczeństwo trzymaj w warstwie zapisu, nie w transkrypcie/promptcie.

## 2026-05-31 — Klikanie UI jest możliwe w kontenerze, ale brakuje bibliotek przeglądarki
**Problem:** Claude meldował, że nie może wyklikać UI, bo „strony są bramkowane Google OAuth, a kontener nie ma Postgresa". W rzeczywistości harness E2E już istniał (`scripts/e2e.sh`, `E2E_TEST_MODE=1` → provider `credentials`, Postgres w Dockerze), a kontener ma Dockera. Prawdziwe przeszkody były dwie: (1) Claude nie wiedział o harнессie (CLAUDE.md o nim milczał), (2) w świeżym kontenerze Chromium nie startuje — brak bibliotek systemowych przeglądarki, a `apt`/`playwright install-deps` jest zablokowany polityką sieci.
**Rozwiązanie:** Dopisano do CLAUDE.md sekcję „Weryfikacja klikana (E2E) — JAK i KIEDY". `scripts/e2e.sh` wykrywa brak `DISPLAY` (auto-headless, zdejmuje `--headed`) i przed testami sprawdza, czy Chromium w ogóle wstaje — jeśli nie, kieruje na ścieżkę dockerową. Dodano `scripts/e2e-docker.sh` + `npm run test:e2e:docker`, które odpalają Playwright w oficjalnym obrazie `mcr.microsoft.com/playwright` (ma wszystkie zależności) na sieci hosta — działa nawet bez bibliotek na hoście. Naprawiono też mylący quick-start (schema jest postgres-only, nie SQLite).
**Lekcja:** „Nie da się wyklikać" zwykle nie znaczy „się nie da", tylko „brakuje jednego z klocków": wiedzy o harнессie, bazy, albo bibliotek przeglądarki. W kontenerach bez X-serwera/zależności najpewniejszą drogą jest uruchomienie Playwrighta w jego oficjalnym obrazie Docker, zamiast walki z `apt`.

## 2026-05-31 — Design system: prymitywy UI zamiast inline-style
**Problem:** Raport architektury (§18.2) wskazał setki inline-style w komponentach (np. `home/TodaySnapshot` ~67), brak wspólnych komponentów bazowych — niespójny język wizualny i trudny refaktor.
**Rozwiązanie:** Dodano `src/components/ui/` z prymitywami opartymi WYŁĄCZNIE o tokeny CSS (`var(--bg-*)`, `--text-*`, akcenty): `Button`, `IconButton`, `Card`, `Surface`, `Badge`, `EmptyState` + helper `src/lib/cn.ts` (bez clsx). Plus `src/lib/ownership.ts` (`ownedByWhere`, `getUserScope`, `assertOwnership`) ujednolicający wzorzec dostępu user/zespół powtarzany w ~30 plikach akcji.
**Lekcja:** Przy „głębokim refaktorze" najpierw buduj fundament (prymitywy + helpery) jako kod addytywny, który się kompiluje samodzielnie, a propagację (przepisanie istniejących komponentów/akcji) rób etapami — wtedy build pozostaje zielony, a ryzyko regresji jest rozłożone.

## 2026-06-01 — Polskie cudzysłowy „…” w stringach łamią build (straight `"` w środku)
**Problem:** Przy budowie modułów Wiadomości/Pogoda `next build` wywalał się z „Unterminated string constant" w kilku miejscach. Przyczyną były prompty i placeholdery typu `"… różnych „gorących tematów". …"` — zamykający znak po słowie był zwykłym ASCII `"`, a nie typograficznym `”`. Wewnątrz `"..."` (i atrybutu JSX `placeholder="..."`) taki `"` przedwcześnie kończy string. W template literalach (backtick) i komentarzach to samo nie przeszkadza — dlatego część wystąpień była niegroźna.
**Rozwiązanie:** W stringach delimitowanych `"` usunięto wewnętrzne proste cudzysłowy (albo zamieniono na opis bez cudzysłowu). `grep -nP '„[^"]*"'` szybko wskazuje kandydatów — ale trzeba ręcznie odsiać te w backtickach/komentarzach (bezpieczne) od tych w `"..."`/JSX (psują build).
**Lekcja:** Pisząc polskie teksty w kodzie używaj backticków dla stringów z cudzysłowami, albo trzymaj poprawne pary „…” (U+201E/U+201D). Nie mieszaj prostego `"` w środku stringa delimitowanego `"`. Po napisaniu większej partii promptów warto od razu odpalić `npx next build` (sam typecheck nie złapie błędu składni w stringu).
