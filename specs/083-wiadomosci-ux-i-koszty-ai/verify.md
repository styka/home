# 083 — Weryfikacja

> Etap 5 pipeline'u. Sprawdzam **zachowanie**, nie „czy się kompiluje". Wszystkie liczby niżej
> pochodzą z pomiarów w przeglądarce (Chromium headless, `scripts/e2e-web.sh`), a nie z lektury kodu —
> po lekcji z 082, gdzie regresja układu przeszła przez komplet bramek statycznych.

## 1. Bramki

| Komenda | Wynik |
|---|---|
| `check:migrations` | ✅ następny wolny numer 0256 (ten przebieg **nie dodaje migracji**) |
| `check:actions` | ✅ 161 akcji, każda z egzekutorem i kontraktem; 375 parametrów z etykietami PL |
| `check:ai-coverage` / `check:access` | ✅ 579 akcji sklasyfikowanych i z guardem |
| `check:cost-badge` | ✅ 35 plików wołających model przekazuje zużycie |
| `check:content-memory` | ✅ 35 plików sklasyfikowanych |
| `check:ui-contract` | ✅ 22/22 modułów na `ModuleView` |
| `check:boundaries` | ✅ 4 sondy — import przez granicę blokowany |
| `check:module-registry` | ✅ 21 modułów, komplet wpięć |
| `check:owner-columns` | ✅ 2345 wywołań Prismy + 5 sond mutacyjnych |
| `check:pagination` | ✅ każde `findMany` z granicą (nowe `getStreamTimeline` — `take: SUFIT_LISTY`) |
| `check:route-gating` | ✅ 19 tras modułowych sprawdza uprawnienie |
| `check:i18n` | ✅ zero literałów; 13 w plikach ze świadomym wyjątkiem |
| `check:tailwind-content` | ✅ 172 katalogi objęte `content` |
| `check:schema-drift` | ✅ brak rozjazdu (lokalny Postgres, C-13 — nigdy prod) |
| `check:logs`, `check:client-safe`, `check:e2e-waits` | ✅ |
| `tsc --noEmit` (`tsconfig.json` + `tsconfig.test.json`) | ✅ |
| `next lint --dir src` | ✅ zero błędów; zastane ostrzeżenia `exhaustive-deps` w innych modułach |
| `next build` | ✅ 137 stron |
| `check:perf` | ✅ najcięższa trasa 1171 kB, suma 65665 kB — w paśmie ±5% |
| testy jednostkowe | ✅ **1153 zielone** (w tym 8 nowych dla `GroupNavigator`) |
| klikacz — pełna suita | ⚠️ **147 zielonych / 2 czerwone** — oba wyjaśnione, patrz §4 |

**C-13 przestrzegane:** wszystko przeciw lokalnemu Postgresowi (`omnia_dev`, `worldofmag_e2e`).
Prod DB nietknięta.

## 2. Kryteria akceptacji

### A. Porządek w nagłówku

| AC | Werdykt | Dowód |
|---|---|---|
| **AC-1** — jedna gwiazdka na desktopie | ✅ | Pomiar `/wiadomosci` @1280 px: **1** ikona `lucide-star`. Inwentarz wszystkich elementów ze słowem „ulubione" (4 sztuki) pokazuje, że tylko jeden ma gwiazdkę: „Zapisz to miejsce w ulubionych" w pasku widoku. Pozostałe to zwijanie sekcji, jej nazwa i link do zarządzania. |
| **AC-2** — jedna gwiazdka na telefonie | ✅ | Ten sam pomiar @390 px: **1**. *Ograniczenie:* projekt `mobile` używa WebKita, którego w sandboxie nie ma — mierzone w Chromium przy szerokości telefonu, nie na iOS. |
| **AC-3** — wskaźnik świeżości nie udaje przycisku | ✅ | `FreshnessIndicator`: ikona `Clock` (nie `RefreshCw`), `aria-hidden` na ikonie, tekst zawsze widoczny, `cursor: default`. Nie ma już nic, co wygląda jak wyłączona kontrolka. |
| **AC-4** — jedno miejsce odświeżania w Wiadomościach | ✅ | W widoku jest jeden przycisk „Odśwież" (`headerAction`); sąsiaduje z „Nowy temat" (`Plus`), który wygląda i działa inaczej. Wskaźnik świeżości ma teraz zegar, więc nie jest już drugą „strzałką odświeżania" obok pierwszej. |
| **AC-5** — układ jak w reszcie aplikacji | ✅ | Wiadomości przeszły na `ModuleView density="compact"` — ten sam wariant, co Zadania, Zakupy i Notatki: tytuł + zakładki (`filters`) + akcje + chrom powłoki w jednej 48-pikselowej listwie. Zmierzony chrom nad treścią: **515 → 163 px** (desktop), **588 → 232 px** (390 px). |

### B. Koszty AI

| AC | Werdykt | Dowód |
|---|---|---|
| **AC-6** — nie-admin nie widzi kosztu | ✅ | `visibleUsage()` (`platform/ai/costVisibility.ts:39`) zwraca `undefined` bez `PERMISSIONS.ADMIN` — dane kosztowe nie wychodzą **po stronie serwera**, więc nie ma czego ukrywać w interfejsie. Zachowanie sprzed 083, celowo nietknięte. |
| **AC-7** — koszt domyślnie ukryty i bez miejsca | ✅ | `AiCostBadge` robi `if (!pokazuj) return null;` (`AiCostBadge.tsx:141`) — zwraca `null`, a nie ukryty element, więc nie zajmuje miejsca. Domyślna wartość przełącznika to „wyłączony". |
| **AC-8** — przełącznik w górnym pasku | ✅ | `PrzelacznikKosztow` w `FavoritesSidebarSection` (desktop, obok zarządzania ulubionymi) i w mobilnym pasku powłoki obok dzwonka (`AppShell.tsx:190`). Stan trzyma `usePokazKoszty` w kontekście, więc przełączenie działa natychmiast, bez przeładowania. |
| **AC-9** — ten sam przełącznik w asystencie | ✅ | `AICommandSheet.tsx:1661`. |
| **AC-10** — koszt + składowe po włączeniu | ✅ | Panel rozbicia (`AnchoredLayer`) niezmieniony od 037: wejście / wyjście / zapis i odczyt pamięci + suma. |
| **AC-11** — ulotne powiadomienie z kwotą i nazwą akcji | ✅ | `AiCostBadge` melduje **przed** wczesnymi wyjściami (`useEffect`, linia 130) — czyli **niezależnie od przełącznika**. `KosztToasts` rysuje w prawym górnym rogu, `CZAS_ZYCIA_MS = 6000`. Nazwa akcji to wymagany prop `akcja` (27 wywołań, etykiety typu „Streszczenie wiadomości", „Odświeżanie wiadomości"). |
| **AC-12** — widać, który koszt do której akcji | ✅ | Prop `akcja` jest **wymagany bez wartości domyślnej** — brak etykiety to błąd kompilacji, nie ciche „nieznana akcja". Powtórzenia tej samej akcji łączą się w `×N`, różne akcje zostają osobnymi powiadomieniami (max 3 naraz). |
| **AC-13** — brak trwałego zapisu | ✅ | `kosztBus` to magistrala w pamięci (`EventTarget`); `KosztToasts` trzyma listę w `useState` i usuwa po czasie. Nic nie idzie do `Notification`, do bazy ani do `localStorage`. 3 testy jednostkowe pilnują, że wypisanie się faktycznie odcina nasłuch. |
| **AC-14** — nad modalem i pływającym przyciskiem | ✅ | `zIndex: 10050` — powyżej modali (50), asystenta (9990) i `AnchoredLayer` (9995), poniżej trybu wskazywania elementu (9998/9999), który z definicji ma być nad wszystkim. |
| **AC-15** — wyłącznik systemowy nadrzędny | ✅ | `layout.tsx:92`: `kosztyDostepne = isAdmin && (await readCostBadgeEnabled())`. Przy `dostepne=false` `PrzelacznikKosztow` zwraca `null`, a `usePokazKoszty` nie może wejść w stan „pokazuj”. |

### C. Widok wiadomości

| AC | Werdykt | Dowód |
|---|---|---|
| **AC-16** — brak historii odświeżeń | ✅ | Komponent `RefreshHistory`, akcja `getNewsRefreshHistory` i jej wpis w `action-coverage.json` usunięte. Model `NewsRefreshRun` i zapis przebiegów zostają — to dane administracyjne, nie element widoku. |
| **AC-17** — „Wszystkie" pierwsze, brak przełącznika trybu | ✅ | `pozycjeNawigatora()` stawia pozycję zbiorczą na indeksie 0 — sprawdzone testem jednostkowym (`GroupNavigator.test.ts`, 8/8). `BrowseMode`, `ContentTab` „Strumień / Jeden temat" i klucz `tryb` w adresie **nie istnieją**. |
| **AC-18** — pasek nie powtarza nazwy bieżącego tematu | ✅ | Klikacz `news-stream-scroll` sprawdza to wprost: etykieta wyzwalacza po ośmiu przewinięciach jest **identyczna** jak na starcie, a nazwa czytanego tematu stoi w przyklejonym nagłówku sekcji przy górnej krawędzi ramy. Pasek ma strzałki ◀ ▶ i wejście do listy. |
| **AC-19** — płynne przejście w bok | ✅ | `translateX(±24 px)` + `opacity` przez 180 ms z `var(--motion-easing)`, wyłączane przy `prefers-reduced-motion`. Przesuwany jest **własny kontener treści**, nigdy rama — dlatego nie może naruszyć AC-20. |
| **AC-20** — brak cofania strony, pasek przyklejony | ✅ | Klikacz zielony na docelowym kodzie **i czerwony po wstrzyknięciu regresji** (`rama.scrollTo({top:0})` w obserwatorze → „krok 2: strona cofnęła się do góry"). Sprawdzone w obie strony, jak w 082-poprawce. `przewinDoSekcji` liczy pozycję ręcznie na ramie — świadomie bez `scrollIntoView`. |
| **AC-21** — akcje przy temacie | ✅ | Edycja i usunięcie w przyklejonym nagłówku sekcji (obok „słuchaj" i „oznacz"), z `aria-label` niosącym nazwę tematu. „Nowy temat" w akcjach widoku. Usunięcie za `confirmDialog` (C-34). |
| **AC-22** — wybór źródeł zajmuje stałą przestrzeń | ✅ | **Pomiar**: wysokość przyklejonego paska **59 px przy 3 źródłach i 59 px przy 15** (12 kanałów dosianych do bazy klikacza na czas pomiaru, potem usuniętych). Chrom nad treścią w obu przypadkach 163 px. |
| **AC-23** — zaznaczanie pojedynczo i wszystkich, stan widoczny bez otwierania | ✅ | Licznik na przycisku: „Wszystkie" albo „N z M". W panelu pozycja „Wszystkie portale" (czyści wybór) + `role="checkbox"` na każdym źródle. Pusty wybór znaczy „wszystkie", nie „nic". |
| **AC-24** — linia czasu przy „Wszystkich" | ✅ | Nowa akcja `getStreamTimeline()` czyta oś **wszystkich** tematów jednym zapytaniem; przełącznik `Wiadomości ⇄ Linia czasu` stoi w pasku i nie zależy już od wyboru pojedynczego tematu. |
| **AC-25** — widać, do którego tematu należy wpis | ✅ | `NewsTimelineStream` używa **tego samego** `SekcjaTematu` co widok wiadomości: przynależność niesie przyklejony nagłówek, widoczny przez cały czas przewijania. Etykietka przy każdym z ~stu wpisów byłaby tą samą informacją powtórzoną sto razy. |

### G. Zakładka Źródła

| AC | Werdykt | Dowód |
|---|---|---|
| **AC-26** — pozycje równo wyrównane | ✅ | Wiersz to `grid` o zadanych kolumnach (`minmax(0,1fr) 10rem minmax(0,1.1fr) auto`), na telefonie jedna kolumna. Poprzedni zawijany `flex` uzależniał start kolumny opisu od długości nazwy kanału — to była przyczyna „krzywizny". |
| **AC-27** — ustawienie długości bez przewijania na koniec | ✅ | Sekcja „Domyślna długość streszczeń" jest **pierwsza**, nad listą źródeł. Akcje dodawania weszły do nagłówka sekcji źródeł, więc też nie odjeżdżają w dół razem z listą. |
| **AC-28** — ten sam układ nagłówka w trzech zakładkach | ✅ | Wszystkie trzy używają wspólnego `NaglowekSekcji` (`sekcjeTematow.tsx`): Wiadomości i Linia czasu przez `SekcjaTematu`, Źródła i Gorące tematy bezpośrednio. Spójność wynika ze **wspólnego komponentu**, a nie z podobnie wyglądającego, skopiowanego JSX-a. |

### H. Spójność i reużywalność

| AC | Werdykt | Dowód |
|---|---|---|
| **AC-29** — nawigator jako wspólny komponent bez wiedzy o module | ✅ | `src/components/ui/nav/GroupNavigator.tsx` przyjmuje `grupy`/`aktywnaId`/`onWybor`/`onSasiad`/`akcje` i nie importuje niczego z `modules/` — pilnuje tego `check:boundaries` (platforma i komponenty wspólne nie mogą sięgać do modułów). |
| **AC-30** — ma konsumenta (C-35) | ✅ | Konsumentem jest `NewsPage`; `TopicPicker.tsx` **usunięty**, więc nie ma równoległej ścieżki. |

### I. Ramki skórki

| AC | Werdykt | Dowód |
|---|---|---|
| **AC-31** — narożniki zostają na miejscu | ✅ | **Pomiar** na `/wiadomosci` z włączoną dekoracją: wysokość ramki **800 px = wysokość okna**, przy `scrollHeight` 11561 px; po przewinięciu o 3000 px górna krawędź nadal 0 i wysokość nadal 800. Sprawdzone też strukturalnie: dekoracja **nie ma przewijalnego przodka** (`dekoracjaWPrzewijalnym: false`) — leży w zewnętrznym, nieprzewijanym opakowaniu `ModuleView`, obok elementu z `overflow-y`, a nie w nim. |

**Podsumowanie: 31/31 spełnione.**

## 3. Zgodność z konstytucją

- **C-01** ✅ całość w `worldofmag/`. **C-02/C-36** ✅ moduł importuje własne wnętrze względnie, wspólny nawigator nie zna modułu (`check:boundaries`, `check:module-registry`).
- **C-10..C-14** ✅ **bez zmian schematu i bez migracji** — decyzja z planu utrzymana. `NewsPref.activeSourceKey` zostaje w tabeli jako kolumna, której nic nie czyta; skasowanie jej to osobna migracja porządkowa, świadomie nie tutaj (C-53).
- **C-12** ✅ nowe rodzaje (`ContentKey`, `ReaderScope`) to unie TS, zero enumów Prisma.
- **C-20** ✅ `getStreamTimeline` to odczyt (bez `revalidatePath`, słusznie); mutacje bez zmian. **C-21/ownership** ✅ `filtrMoichRekordow` + `assertTopic`.
- **C-30** ✅ wyłącznie zmienne CSS; `check:ui-contract` zielone. **C-31** ✅ cele dotyku `py-3`/`py-2.5`, siatka źródeł zwija się do jednej kolumny na telefonie. **C-33** ✅ poszerzyliśmy ramę wariantem `density="compact"` zamiast robić wyjątek w module. **C-34** ✅ usunięcie tematu za `confirmDialog`. **C-32** ✅ `check:i18n` zielone.
- **C-35** ✅ `GroupNavigator` dowieziony **razem z konsumentem** — a stary `TopicPicker` skasowany, żeby nie zostały dwie drogi.
- **C-50** ✅ build zielony. **C-51** ✅ cztery wpisy w `doświadczenia.md`. **C-53** ✅ przebieg **usuwa** więcej niż dodaje: przełącznik trybu, historia odświeżeń, pas chipsów, `TopicPicker`, dwie akcje serwerowe.
- **C-54** ✅ dwie korekty artefaktów zapisane na miejscu: AC-20 (druga połowa kryterium unieważniona decyzją z AC-18) i asercja w `favorites.spec.ts` (083/AC-2 znosi drugą połowę 043/AC-2).

## 4. Regresje

Pełna suita klikacza: **147 zielonych / 2 czerwone**. Oba domknięte:

1. **`favorites.spec.ts` `[fav043-AC1-AC2 + 080-AC16]`** — czerwony na asercji „w sekcji ulubionych
   jest punkt zapisu z etykietą". To **nie jest regresja, tylko świadoma zmiana zakresu**: 083/AC-2
   znosi drugą połowę 043/AC-2, bo ta sama akcja stała w trzech miejscach naraz. Test poprawiony
   (C-54) — sprawdza teraz warunek odwrotny: „Zapisz ten widok" ma **zniknąć** z sekcji, a gwiazdka
   w pasku widoku ma być na miejscu. Po poprawce **zielony**.
2. **`shopping.spec.ts` `[scenario-add-item-enter]`** — czerwony w pełnym, równoległym przebiegu,
   **zielony w powtórce w izolacji** (23 zielone / 0 czerwonych na `favorites` + `shopping`).
   Jedyna zmiana 083 w tym module to etykieta `akcja` na `AiCostBadge` — komponencie, który w tym
   scenariuszu **w ogóle się nie renderuje** (brak `aiUsage`, żadnego wywołania modelu nie ma).
   Test jest też na liście zastanych czerwonych z runbooka (`shopping ×4` od przebiegu 047).
   Zapisuję jako **zastane/niestabilne**, nie jako skutek tego przebiegu.

Sąsiednie moduły: żadnych zmian w migracjach, RBAC ani w kontraktach innych modułów. Wspólne
komponenty ruszone w tym przebiegu (`AiCostBadge`, `FreshnessIndicator`, `ModuleView`,
`FavoritesSidebarSection`) przeszły pełną suitę klikacza w pozostałych modułach na zielono.

### Czego NIE dało się sprawdzić

- **Silnik mobilny (WebKit)** — nie ma go w obrazie sandboxa i polityka sieci nie pozwala go pobrać.
  AC-2 zmierzone w Chromium przy szerokości 390 px, co sprawdza układ, ale nie zachowanie Safari.
- **Żywotność kanałów RSS** — proxy sandboxa odrzuca `CONNECT`, więc `fetchRss` zwraca zero dla
  każdego adresu. Ograniczenie zastane, niezwiązane z tym przebiegiem.

## 5. Werdykt końcowy

**GOTOWE.** 31/31 kryteriów spełnionych, komplet bramek zielony, 1153 testy jednostkowe, klikacz
zielony po domknięciu obu czerwonych. Kluczowe liczby z przeglądarki: chrom nad treścią **515 → 163 px**
(desktop) i **588 → 232 px** (telefon), pasek nawigacji **59 px niezależnie od liczby źródeł**,
**jedna** gwiazdka na obu szerokościach, test przewijania sprawdzony **w obie strony**.
