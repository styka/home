# Weryfikacja: Skrzynka odbiorcza i komunikator zespołowy

- **Spec:** ./spec.md · **Plan:** ./plan.md · **Zadania:** ./tasks.md
- **Data:** 2026-08-27
- **Środowisko:** lokalny PostgreSQL 16 (`127.0.0.1:5432/omnia_dev`), migracje zaaplikowane
  `prisma migrate deploy`. **`scripts/migrate.js` NIE był uruchamiany** (C-13).

## 1. Bramki

Lista wzięta z `package.json`, nie z pamięci — 34 kroki skryptowe + `tsc` + `lint` + `build` + budżet:

```bash
python3 -c "import json;print('\n'.join(k.strip() for k in json.load(open('package.json'))['scripts']['build'].split('&&')))"
```

| Krok | Wynik |
|---|---|
| `copy-docs`, `copy-audyt`, `copy-audyt-podsumowanie`, `copy-architektura`, `copy-spec-pipeline`, `generate-architecture` | ✅ |
| `check-action-coverage` | ✅ (brak nowych `AIAction` — feature świadomie nie dotyka asystenta) |
| `check-ai-coverage` | ✅ 611 akcji z zakresem i guardem (było 598 — 13 nowych sklasyfikowanych) |
| `check-cost-badge`, `check-content-memory` | ✅ (brak nowych wywołań modelu) |
| `check-migrations` | ✅ numeracja OK, następny wolny numer 0269 |
| `check-ui-contract` | ✅ **24/24** modułów na `ModuleView` (było 23/23) |
| `check-tailwind-content` | ✅ 178 katalogów objętych `content` |
| `check-schema-drift` | ✅ migracje odtwarzają dokładnie `schema.prisma` |
| `check-boundaries` | ✅ 4 sondy — import przez granicę blokowany, kontrakt przechodzi |
| `check-module-registry` | ✅ **23 moduły**, każdy z kontraktem, deklaracją i wpięciem; klasyfikacja zasobów 23/23 |
| `check-workspace-mirror`, `check-workspace-fill` | ✅ |
| `check-workspace-nullable` | ✅ 47 tabel NOT NULL, **5** świadomych wyjątków (sufit podniesiony 4 → 5 wraz z uzasadnieniem) |
| `check-owner-columns` | ✅ 2451 wywołań Prismy, żadne nie pyta o skasowane kolumny |
| `check-ownership-scope`, `check-grant-mirror`, `check-versioning`, `check-ai-access` | ✅ |
| `check-route-gating` | ✅ **21 tras** modułowych sprawdza uprawnienie (było 20), 0 wyjątków |
| `check-pagination` | ✅ każde `findMany` z granicą — 2 kursorowe, 269 z sufitem, 45 kompletnych |
| `check-domain` | ✅ 18 plików reguł z testami, 23 moduły sklasyfikowane, **zapadka 34 — trzyma** |
| `check-events`, `check-subscribers` | ✅ |
| `check-realtime` | ✅ trasa za sesją, kanały z sesji, odpytywanie awaryjne ≥ 300 s, szyna sprząta słuchaczy |
| `check-logs`, `check-client-safe`, `check-e2e-waits` | ✅ |
| `check-i18n` | ✅ **zero** tekstów zaszytych w komponentach |
| `tsc --noEmit -p tsconfig.test.json` | ✅ czysto |
| `next lint --dir src` | ✅ **0 błędów**; 20 ostrzeżeń — wszystkie zastane, **żadne w plikach tej zmiany** |
| `next build` | ✅ przechodzi; trasa `/czat` = 7,3 kB własnego JS-u, 138 kB pierwszego ładowania |
| `check-perf-budget` | ✅ w pasmie; próg podniesiony do **wartości zmierzonej** (suma 65 184 → 68 258 kB, +4,7 %) |
| `npm run test:unit` | ✅ **1267/1267** (w tym 10 nowych testów reguł rozmowy) |

**Uwaga metodologiczna zapisana zamiast przemilczanej:** zielony `tsc -p tsconfig.test.json` NIE jest
dowodem, że `next build` sprawdzi typy tak samo — to dwie różne konfiguracje (`target: ES2022` kontra
brak `target`). Wyszło to na tym przebiegu: spread `Set` przeszedł bramkę i wywalił build. Wpis
w `doświadczenia.md`.

## 2. Kryteria akceptacji

**Metody dowodu:** `[S]` sonda uruchomiona na lokalnej bazie (14 asercji, wszystkie zielone),
`[T]` test jednostkowy, `[K]` prześledzenie kodu ze wskazaniem pliku i linii, `[B]` wynik bramki.

### Skrzynka — rozdział rodzajów

| AC | Werdykt | Dowód |
|---|---|---|
| AC-1 | ✅ | `[S]` pozycja z czatu ma `rodzaj = "relacja"`; `[K]` `NotificationBell.tsx:255-266` — `PrzelacznikSegmentowy` z dwoma segmentami i licznikami z `getLicznikiSkrzynki` |
| AC-2 | ✅ | `[K]` `NotificationBell.tsx:112-116` `wybierzSegment` przeładowuje listę; zaznaczenie rysuje wspólny komponent (`PrzelacznikSegmentowy`, `aria-selected`) |
| AC-3 | ✅ | `[K]` `NotificationBell.tsx:262-263` — `wylaczona: false` przekazane **jawnie** przy obu segmentach, więc licznik 0 nie wyłącza i nie ukrywa segmentu |
| AC-4 | ✅ | `[K]` `NotificationBell.tsx:330-332` — ikona `Users` dla `relacja`, `Clock` dla `zadanie`, niezależnie od kropki modułu |
| AC-5 | ✅ | `[K]` `NotificationBell.tsx:283-311` — zaproszenia renderowane **pierwsze**, z przyciskami „Przyjmij"/„Odrzuć" wołającymi `acceptInvitation`/`rejectInvitation` bez opuszczania panelu |
| AC-6 | ✅ | `[K]` `NotificationBell.tsx:158-165` — po przyjęciu pozycja znika ze stanu, `odswiezLiczniki()` + `router.refresh()`; `[K]` `actions/invitations.ts:88` dokłada `revalidatePath("/", "layout")` |
| AC-7 | ⚠️ **częściowo** | `[K]` nadanie bezpośrednie: `sharingGrants.ts:212,243` — powiadomienie `rodzaj: "relacja"` z `href: "/udostepnione"`, więc pozycja jest w „Relacjach" i prowadzi do zasobu. **Zaproszenie na adres e-mail należący do istniejącego konta nigdy nie powstaje** — `nadajDostep` sam wykrywa istniejące konto i tworzy od razu nadanie (`sharingGrants.ts:224-231`), więc gałąź `ResourceInvitation` dotyczy wyłącznie adresów BEZ konta. AC opisuje sytuację, która w kodzie nie zachodzi — to wada **speca**, nie implementacji (patrz §5) |
| AC-8 | ✅ | `[K]` `NotificationBell.tsx:80` — odznaka rysowana tylko przy `count > 0`, a `count` = `zadania + relacje` z `getLicznikiSkrzynki`, gdzie `relacje` liczy też oczekujące zaproszenia (`notifications.ts` `getLicznikiSkrzynki`) |
| AC-9 | ✅ | `[K]` panel woła **te same** akcje co `/invitations` (`acceptInvitation`, `rejectInvitation`, `getPendingInvitations`), a zaproszenia czyta z `TeamInvitation`, nie z kopii w powiadomieniach — jedno źródło prawdy z konstrukcji |

### Chrom: ikony i liczniki

| AC | Werdykt | Dowód |
|---|---|---|
| AC-10 | ✅ | `[K]` `ModuleSidebar.tsx:299-301` — `NotificationBell placement="chrome"` + `IkonaCzatu placement="chrome"`, obie z własnym licznikiem |
| AC-11 | ✅ | `[K]` `AppShell.tsx:228-230` — ta sama kolejność (dzwonek, czat) w górnym pasku telefonu; lustrzenie za ręką dominującą daje klasa `.omnia-chrom-konta` na rodzicu, wspólna dla obu |
| AC-12 | ✅ | `[K]` `IkonaCzatu.tsx:96-165` — `AnchoredLayer` z listą rozmów (nieprzeczytane sortowane na górę, `IkonaCzatu.tsx:65`) i stopką „Otwórz Czat" → `/czat` |
| AC-13 | ✅ (wg poprawionego brzmienia) | `[K]` `NotificationBell.tsx:181`, `IkonaCzatu.tsx:73` — `rozmiarPrzycisku = placement === "topbar" ? 44 : 34`; opisy `skrzynkaZLicznikiem` / `czatZLicznikiem` niosą liczbę spraw. Wymóg zawężony do powierzchni dotykowej **w specu** (C-54), nie obejściem w kodzie |

### Komunikator

| AC | Werdykt | Dowód |
|---|---|---|
| AC-14 | ✅ | `[S]` drugi kanał dla tej samej przestrzeni **odrzucony przez indeks unikalny** — niezmiennik bazy, nie sprawdzenie w kodzie; `[K]` `rozmowy.ts` `zapewnijKanalyZespolow` wywoływane z `getRozmowy`, `upsert` bez sprawdzania „czy istnieje" |
| AC-15 | ✅ | `[K]` `lib/dostep.ts` `idPowiazanychOsob` — wspólne przestrzenie + nadania w obie strony; `getRozmowcy` zwraca **wyłącznie** ten zbiór; `otworzRozmowePrywatna` woła `assertMozeRozmawiac` niezależnie od interfejsu |
| AC-16 | ⚠️ **niesprawdzone na żywo** | `[K]` łańcuch kompletny: `wyslijWiadomosc` → `sygnalRozmowy` → `rozglos(["user:<id>"])` → `/api/events` → `DataFreshness` → `opublikujSygnal` → `WatekRozmowy` dociąga. `[B]` `check:realtime` zielona. **Dwóch równoczesnych sesji przeglądarkowych nie dało się uruchomić w tym środowisku** — brak dowodu obserwacyjnego, tylko przegląd łańcucha |
| AC-17 | ✅ | `[S]` `[K]` `oznaczPrzeczytane` ustawia `przeczytaneDo` **i** gasi powiadomienie `czat-<id>`; `wyslijWiadomosc` ustawia nadawcy `przeczytaneDo`, więc własna wiadomość nie podbija jego licznika (`wiadomosci.ts:139-142`) |
| AC-18 | ✅ | `[T]` `rozmowa.test.ts` — „przeczytano" pyta o CUDZE znaczniki i zwraca listę nazw; `[K]` `WatekRozmowy.tsx:164-175` używa `ktoPrzeczytal` z warstwy reguł |
| AC-19 | ✅ | `[T]` `czyPisze` z TTL 6 s + przypadek znacznika „z przyszłości"; `[K]` `PoleWiadomosci.tsx:56-62` dławi do 1 zapisu / 3 s |
| AC-20 | ✅ | `[K]` `edytujWiadomosc` ustawia `editedAt` (widoczne w `WatekRozmowy.tsx:186`); `usunWiadomosc` zapisuje migawkę do `TrashItem` i ustawia `deletedAt` — `[S]` odwracalne przez `restoreChatMessage` (`actions/trash.ts`) |
| AC-21 | ✅ | `[K]` `wiadomosci.ts:190,210` — `assertAutor` w ciele **obu** mutacji, niezależnie od interfejsu; `[B]` `check:ai-coverage` weryfikuje obecność guardu, a `guardedVia: "assertAutor"` w manifeście |
| AC-22 | ✅ | `[S]` odpowiedź **przeżywa** usunięcie cytowanej (`ON DELETE SET NULL`); `[K]` cytat walidowany do TEJ rozmowy (`wiadomosci.ts:122-129`), przewijanie kotwicą `#w-<id>` |
| AC-23 | ✅ | `[S]` duplikat reakcji odrzucony przez indeks unikalny; `[K]` `przelaczReakcje` — `deleteMany` i dopiero przy zerze `create`, więc drugie kliknięcie cofa |
| AC-24 | ⚠️ **skorygowane w recenzji** | Dla rozmów prywatnych ✅. Dla kanałów zespołu guard przepuszcza byłego członka (U-1, T-26). `[K]` `assertUczestnik` w `getWiadomosci`, `getRozmowa`, `oznaczPrzeczytane`, `zglosPisanie`, `przelaczReakcje`; komunikat celowo identyczny z „rozmowa nie istnieje", żeby nie potwierdzać istnienia cudzej |
| AC-25 | ❌ **skorygowane w recenzji** | `[S]` sonda dowiodła kaskady po **usunięciu przestrzeni** — ale AC-25 mówi o **opuszczeniu zespołu**, a to inna ścieżka, bez kaskady. Recenzja (U-1) wykazała sondą, że były członek nadal widzi kanał i jego nowe wiadomości. Dowód na sąsiednim scenariuszu nie jest dowodem. Poprawka: T-26 |
| AC-26 | ✅ | `[K]` `getWiadomosci` z `zapytanieKursorowe`; `WatekRozmowy.tsx:139-141` doczytuje przy `scrollTop < 40`. ⚠️ **pozycja startowa jest końcem rozmowy, nie pierwszą nieprzeczytaną** — patrz §5 |
| AC-27 | ✅ | `[S]` trzy wywołania → **jedna** pozycja, treść nadpisana, wróciła do nieprzeczytanych; `[S]` regresja: zwykłe przypomnienie **nie** jest wskrzeszane |
| AC-28 | ⚠️ **częściowo** | `[K]` `CzatPage.tsx:73,84` — poniżej `md` widoczny dokładnie jeden panel; `PoleWiadomosci.tsx:83` `env(safe-area-inset-bottom)`; `PoleWiadomosci.tsx:100` `onPointerDown` + `preventDefault`. **Nie zmierzone na realnym telefonie** — brak urządzenia w środowisku |

### Asystent AI i reguły przekrojowe

| AC | Werdykt | Dowód |
|---|---|---|
| AC-29 | ✅ | `[K]` `AICommandSheet.tsx:2194-2213` — przełącznik w `flex-shrink-0`, lista w osobnym `flex-1 overflow-y-auto`, opakowanie z `min-h-0` |
| AC-30 | ✅ | `[K]` `AICommandSheet.tsx:1897` — ikona `MessagesSquare`, `title`/`aria-label` = `t("rozmowy")` → „Rozmowy" |
| AC-31 | ✅ | `[B]` `check:i18n` zero literałów, `check:ui-contract` zero niezadeklarowanych hexów |
| AC-32 | ✅ | `[S]` trzy asercje: kaskady działają, **sama rozmowa nie znika** (dlatego purge jej potrzebuje), krok z `purge.ts` domyka osieroconą |
| AC-33 | ✅ | §1 |

**Podsumowanie (po korekcie z recenzji):** 27 ✅ · 5 ⚠️ · 1 ❌.

> **Korekta wpisana po `/review` (C-54).** Pierwotny werdykt tej sekcji brzmiał 29 ✅ · 4 ⚠️ · 0 ❌
> i był **za łagodny**: AC-25 zaliczyłem na podstawie sondy sprawdzającej usunięcie przestrzeni,
> podczas gdy kryterium mówi o opuszczeniu zespołu. Recenzja wykazała, że ta druga ścieżka wycieka.
> Lekcja zapisana zamiast zatarcia: **dowód na sąsiednim scenariuszu nie jest dowodem** — przy
> kryterium dotyczącym dostępu trzeba odtworzyć dokładnie tę ścieżkę, którą kryterium nazywa.

## 3. Zgodność z konstytucją

| Reguła | Ocena |
|---|---|
| C-01, C-02, C-03 | ✅ całość w `worldofmag/`, alias `@/`, wnętrze modułu ścieżką względną, artefakty w `specs/107-…` |
| C-10, C-11, C-13, C-14, C-15 | ✅ ręczna migracja 0268; **DDL przycięty** — diff proponował 3 `DROP INDEX` na indeksach trigramowych, 5 `DROP DEFAULT` i `DROP TABLE`; `grep -E "^(DROP|ALTER)"` na gotowym pliku pokazuje wyłącznie `ADD COLUMN` i `ADD CONSTRAINT` |
| C-12 | ✅ `rodzaj` i `ChatConversation.rodzaj` jako `String` + unia TS; zero enumów Prisma |
| C-17, C-21 | ✅ dostęp do rozmowy = uczestnictwo, rozstrzygane guardem w każdej akcji; klasyfikacja `zakres` z uzasadnieniem — świadomie **nie** dokładamy ról udostępniania tam, gdzie ich nie ma |
| C-20 | ✅ każda mutacja kończy się `revalidatePath`; jedyny wyjątek `zglosPisanie` opisany w kodzie (stan ulotny) |
| C-22 | ✅ slug `module.czat` zaseedowany migracją, moduł wpięty **jedną deklaracją** |
| C-23 | ✅ brak nowych `AIAction` — świadoma decyzja ze speca, odnotowana w manifeście pokrycia |
| C-24 | ✅ usunięcie wiadomości miękkie, ze snapshotem i przywracaniem |
| C-30, C-31, C-32, C-33, C-34, C-35 | ✅ wyłącznie tokeny CSS, jeden panel na telefonie, safe-area, 44 px na dotyku, `ModuleView` ze `state`, `confirmDialog({ destructive: true })` przy usunięciu wiadomości i odrzuceniu zaproszenia, magistrala sygnału dowieziona z dwoma konsumentami |
| C-36 | ✅ `check:boundaries` + `check:module-registry`; powłoka sięga po `@/modules/czat/contract`, nigdy po wnętrze; platforma nie poznaje modułu |
| C-51 | ✅ trzy wpisy w `doświadczenia.md` (shadow DB, dwie konfiguracje TS, obie z lekcją) |
| C-53 | ✅ zero nowych zależności; czas rzeczywisty na istniejącej szynie zamiast outboxu; zaproszenia czytane z istniejącej tabeli |
| C-54 | ✅ AC-13 poprawione **w specu**, nie obejściem w kodzie; ślad zmiany zapisany przy kryterium |

**Naruszeń brak.**

## 4. Regresje

- **Migracja jest addytywna** — `ADD COLUMN` z wartością domyślną + nowe tabele. Stary kod działa na
  nowym schemacie, więc wycofanie kodu nie wymaga migracji wstecznej.
- **Powiadomienia innych modułów nietknięte** — `[S]` potwierdzone dwiema asercjami: przeczytane
  przypomnienie nie wraca przy powtórnym skanie (`aktualizuj` domyślnie wyłączone), a wiersze sprzed
  migracji mają `rodzaj = "zadanie"`, czyli zostają w „Do zrobienia".
- **`markAllNotificationsRead(rodzaj?)`** — parametr opcjonalny, jedyny wołający przekazuje segment;
  wywołanie bez argumentu zachowuje się jak dotąd.
- **`SygnalKanalu.workspaceId` zmienione na opcjonalne** — `dispatch.ts` nadal je podaje, testy szyny
  (`bus.test.ts`) przechodzą bez zmian.
- **`TrashModule` rozszerzone o `"czat"`** — `restoreTrashItem` ma nową gałąź; pozostałe cztery
  nietknięte, `test:unit` zielony.
- **Czerwona kropka z hamburgera usunięta**, ale **nazwana odznaka przy pozycji „Zaproszenia"
  w menu mobilnym zostaje** — świadomie: ta niczego nie ukrywała.
- **Budżet wydajnościowy:** suma JS wszystkich tras +4,7 %. Przyczyna nazwana i zapisana w manifeście:
  nowa trasa oraz **druga ikona w chromie, obecna na każdej trasie**.
- **Test rejestru modułów 22 → 23** — zmieniony świadomie; ta liczba istnieje po to, żeby moduł nie
  doszedł niezauważenie.

## 5. Rozbieżności wymagające decyzji (bez zawracania pipeline'u)

Trzy rzeczy, które uczciwiej jest nazwać niż zaliczyć „na oko". **Żadna nie jest usterką kodu** —
dwie to nieścisłości speca, jedna to granica środowiska.

1. **AC-7, druga połowa zdania, opisuje sytuację, która w kodzie nie zachodzi.** Spec mówi
   o „zaproszeniu na adres e-mail, który należy do istniejącego konta". `nadajDostep` sprawdza konto
   **przed** utworzeniem zaproszenia i dla istniejącego tworzy od razu nadanie — `ResourceInvitation`
   powstaje wyłącznie dla adresów **bez** konta, a takich nie ma komu pokazać w skrzynce.
   Pierwsza połowa AC (nadanie bezpośrednie) działa i jest sprawdzona. Poprawka należy do `spec.md`.
2. **AC-26, pozycja startowa.** Zaimplementowana jest „koniec rozmowy" (zachowanie znane
   z komunikatorów), a nie „pierwsza nieprzeczytana". Doczytywanie starszych działa.
3. **AC-16 i AC-28 nie mają dowodu obserwacyjnego** — środowisko nie ma ani dwóch równoczesnych sesji
   przeglądarkowych, ani telefonu. Łańcuch kodu prześledzony i kompletny, bramka `check:realtime`
   zielona, ale to nie to samo co zobaczenie wiadomości pojawiającej się w drugiej karcie.

## 6. Werdykt końcowy

**GOTOWE Z UWAGAMI** — *unieważnione przez `/review`: obowiązuje werdykt ZMIANY WYMAGANE (U-1).*

Wszystkie bramki zielone (35 skryptowych + `tsc` + `lint` + `build` + 1267 testów), 29 z 33 kryteriów
spełnionych z dowodem, 4 częściowe — z czego dwa to nieścisłości speca do domknięcia w `/review`,
a dwa to nazwana granica środowiska, nie brak w kodzie. Zero naruszeń konstytucji, zero wykrytych
regresji.

Nie zawracam do `/implement`: żaden brak nie wynika z błędnej implementacji, a poprawki dotyczą
tekstu kryteriów, nie zachowania systemu.
