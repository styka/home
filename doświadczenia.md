# Doświadczenia — Lessons Learned

Plik prowadzony automatycznie przez Claude Code. Każdy wpis to rzeczywisty problem napotkany podczas pracy nad projektem i wyciągnięta z niego lekcja.

---

## 2026-08-19 — Commit scalający na `master` rozjeżdżał gałęzie przy każdej promocji
**Problem:** Pipeline promował produkcję przez `git merge --no-ff develop -m "... [produkcja]"`.
Ten commit scalający powstaje **wyłącznie na `master`** — `develop` nigdy go nie dostaje. Od tej
sekundy `develop` nie zawiera produkcji, kontrola integralności z C-52
(`git merge-base --is-ancestor origin/master develop`) wypadała fałszywie, więc każdy następny
przebieg musiał zacząć od merge'a synchronizującego `master → develop` (`68ce01c` „commit scalający
promocji 080"). Stąd powtarzalne komunikaty o commicie scalającym na gałęzi docelowej i puste
merge'e w historii. W chwili naprawy `origin/master` był o 1 commit przed `origin/develop` przy
**zerowej różnicy treści**.
**Rozwiązanie:** Promocja `develop → master` to teraz zawsze `git merge --ff-only develop` (odbicie =
stop i zgłoszenie, nigdy `--no-ff` ani force-push), a widoczny ślad wydania daje **adnotowany tag**
`prod-<NNN>-<slug>` pushowany razem z `master`. Reguła zapisana w trzech miejscach, którymi steruje
się pipeline: `CLAUDE.md` (Git workflow), `.claude/spec-pipeline/constitution.md` (**C-52a**) i
`.claude/commands/review.md` (krok promocji).
**Lekcja:** Commit scalający ma sens **tylko na gałęzi, do której coś się jeszcze merguje z powrotem**.
`master` jest końcem drogi — commit powstały tam jest niewidoczny dla `develop` i zamienia jednorazowy
merge w stały narzut. Dodatkowo `--no-ff` na produkcji stawia tam commit, którego **nikt nie
testował**: `--ff-only` gwarantuje, że na produkcji stoi dokładnie to, co przeszło testy na
`develop`. Potrzeba „widocznego znacznika wydania" to zadanie dla taga, nie dla topologii historii.

## 2026-08-19 — Tryb JSON, który nic nie robi u połowy dostawców
**Problem:** `chatComplete({ json: true })` ustawiało `response_format: {type:"json_object"}`
WYŁĄCZNIE w ciele żądania zgodnym z OpenAI. `anthropicBody` nie czytało `opts.json` w ogóle, więc
u dostawcy Anthropic — tego, którego używa właściciel — tryb JSON był bezczynny. Osiemnaście miejsc
w aplikacji o niego prosi i każde opierało kształt odpowiedzi wyłącznie na uprzejmości modelu.
Wyszło przy generowaniu skórek, ale dotyczyło wszystkich.
**Rozwiązanie:** Dla Anthropic dokładamy dyrektywę JSON OSOBNYM blokiem systemowym na końcu.
Świadomie nie wypełnieniem tury asystenta znakiem `{` (metoda mocniejsza u tego dostawcy), bo
prefill jest niedozwolony razem z rozszerzonym myśleniem, a to włącza `applyEffort` zależnie od
konfiguracji administratora. Osobny blok, a nie doklejenie do promptu, bo doklejenie zmieniłoby
blok oznaczony `cache_control` i unieważniało pamięć podręczną promptu przy każdym wywołaniu.
**Lekcja:** Opcja wspólna dla wielu dostawców musi mieć **test na każdą ścieżkę**, inaczej działa
tam, gdzie ją pisano, i milczy wszędzie indziej. Flaga, która nie ma odpowiednika u dostawcy, jest
gorsza niż jej brak: kod wygląda, jakby wymuszał kształt, więc nikt nie dokłada zabezpieczenia
po stronie odczytu.

## 2026-08-19 — Między modelem a aplikacją musi być warstwa tłumacząca
**Problem:** Generator skórek czytał tokeny z JEDNEGO miejsca (`parsed.tokens`) i porównywał klucze
dokładnie z katalogiem. Każde odstępstwo modelu od tego kształtu dawało zero tokenów i komunikat
„model nie odesłał żadnych tokenów" — nieprawdziwy, bo model odsyłał je regularnie, tylko inaczej
opakowane. Cztery realne warianty: inny pojemnik (`variables`, `theme`), tablica par
`{name,value}` zamiast mapy, inna konwencja klucza (`bgBase`), i najpodstępniejszy — LICZBA zamiast
napisu (`"--font-weight-heading": 700`), którą walidator odrzucał bez śladu, bo przyjmuje tylko napisy.
**Rozwiązanie:** `lib/skins/mapowanie.ts` — czysta warstwa, która znajduje mapę gdziekolwiek jest,
tłumaczy konwencję kluczy i zamienia liczby JSON na napisy. Wybiera kandydata dającego NAJWIĘCEJ
rozpoznanych tokenów, a nie pierwszego napotkanego. Walidacja została nietknięta.
**Lekcja:** Model to nie jest API o stałym kontrakcie — to źródło, które ma INTENCJĘ i zmienny
kształt. Czytanie go „jednym `parsed.x`" jest równie kruche jak parsowanie HTML wyrażeniem
regularnym. Warstwa mapowania należy do aplikacji i **nie wolno jej mylić z rozluźnieniem
walidacji**: pierwsza doprowadza dane do postaci, na której druga może się wypowiedzieć. Osobno
warto pamiętać, że JSON ma liczby, a CSS ich nie ma — granica typów między formatami to klasyczne
miejsce cichej utraty danych.

## 2026-08-19 — Klikacz e2e zależy od stanu bazy, którego nie odtwarza żaden seed
**Problem:** Skasowałem lokalną bazę `omnia_dev`, żeby wykluczyć zabrudzenie danymi z ręcznych
przebiegów. Po odtworzeniu (migracje + `prisma/seed.ts` + `ensureE2EFixtures`) klikacz przestał
działać w sposób masowy: 36 czerwonych na 127, w tym testy niezwiązane ze zmianą. Kolejne braki
wychodziły warstwami: brak użytkowników → brak PRZESTRZENI OSOBISTYCH (`Workspace`) → brak
CZŁONKOSTW (`WorkspaceMember`) → dalej niewidoczne dane modułów. Fikstury speców wołają
`workspace.findUniqueOrThrow({ where: { personalUserId } })`, więc zakładają, że przestrzeń już
istnieje — a tworzy ją dopiero aplikacja przy pierwszym zapisie.
**Rozwiązanie:** Braki uzupełniane ręcznie SQL-em. Pełne odtworzenie środowiska z pustej bazy
pozostało niedomknięte i jest odnotowane jako osobna praca — nie wchodziło w zakres tej fali.
**Lekcja:** „Idempotentny seed" nie znaczy „odtwarza środowisko od zera". Ten seed zakłada bazę,
przez którą wcześniej przeszła aplikacja, więc **skasowanie bazy e2e jest operacją nieodwracalną
bez ręcznej pracy** — a przy diagnozie flaka to pierwszy odruch. Zanim skasujesz bazę testową,
zrób zrzut (`pg_dump`); i nie diagnozuj niestabilności testu przez kasowanie stanu, dopóki nie
wiadomo, czy ten stan da się odtworzyć.

## 2026-08-19 — Zakres widoku w parametrach zapytania znika po mutacji
**Problem:** Widok wielu projektów w Zadaniach pokazywał „🗂 Wiele projektów (0)" po zmianie statusu
dowolnego zadania. Zakres liczył się WYŁĄCZNIE z `searchParams` (`?group=` / `?projects=`), a te
potrafią nie dotrzeć przy ponownym renderze wywołanym z akcji przez `revalidatePath`: stan widoku
zapisujemy natywnym `pushState` (`useViewState`, 043), więc adres i drzewo routera mogą się
rozjechać. Puste parametry dawały pustą listę projektów.
**Rozwiązanie:** Zakres zapisanego zestawu przeniesiony do SEGMENTU ŚCIEŻKI (`/tasks/zestaw/<id>`) —
`params` są częścią trasy, więc Next ma je zawsze. Doraźny wybór projektów został filtrem widoku,
którego utrata pokazuje wszystkie projekty, nie żadnego. Stare adresy przekierowują z zachowaniem
filtrów (właściciel ma je w ulubionych widokach).
**Lekcja:** Pozostałe filtry gubiły się tak samo od miesięcy i NIKT tego nie zgłosił, bo
`oneOf(allowed, fallback)` degraduje je do wartości domyślnej — nieszkodliwie. Widoczna była tylko ta
jedna gałąź, której domyślną było „nic". Stąd reguła: **żadne źródło zakresu nie może degradować do
zera zasobów.** Jeśli wartość domyślna oznacza pustkę, to nie jest wartość domyślna, tylko awaria
czekająca na okazję.

## 2026-08-19 — Ścieżka zapasowa, która działa tylko na papierze
**Problem:** Lektor milczał, gdy dostawca płatnej syntezy odmawiał. Kod ZAPASOWEJ ścieżki istniał
i wyglądał poprawnie: nieudane `/api/tts` → `speakViaBrowser`. Tyle że działał **per wypowiedź
i asynchronicznie**, więc każde zdanie płaciło nieudane żądanie sieciowe, a syntezę przeglądarki
odpalał już POZA gestem użytkownika — a WebKit takie wywołanie odrzuca po cichu. Lektor Wiadomości
łańcuchuje zdania z `onEnd`, więc poza pierwszym żadne i tak nie było w geście.
**Rozwiązanie:** Zatrzask porażki. Po pierwszej odmowie `speak()` idzie na przeglądarkę od razu
i synchronicznie, bez żądania. Zatrzask kasuje zmiana głosu/konfiguracji, a przejście jest widoczne
w jednorazowym komunikacie.
**Lekcja:** „Mamy fallback" to za mało — trzeba sprawdzić, **w jakim kontekście się wykonuje**.
Ścieżka zapasowa uruchomiona po `await` jest w innym świecie niż ta uruchomiona w geście
użytkownika, i tylko jedna z nich naprawdę działa. Testem, który to łapie, jest asercja na LICZBĘ
żądań przy drugiej wypowiedzi, nie na sam fakt zejścia na głos zapasowy.

## 2026-08-19 — Jeden komunikat na wszystkie przyczyny to komunikat o niczym
**Problem:** Panel `/admin/llm` na każdą odmowę lektora mówił „Sprawdź klucz API i wybrany model".
Właściciel wygenerował nowy klucz API — na darmo, bo problem był gdzie indziej. Trasa `/api/tts`
łykała wyjątek i zwracała zawsze 502, mimo że `synthesizeSpeech` ZNAŁO status dostawcy.
**Rozwiązanie:** Błąd niesie kod powodu wyprowadzony ze statusu (auth/model/quota/provider/network);
trasa zwraca kod, panel tłumaczy go na zdanie. Treść odpowiedzi dostawcy dalej zostaje na serwerze,
bo potrafi zawierać klucz — pilnuje tego asercja NEGATYWNA w teście.
**Lekcja:** Diagnostyka, która nie rozróżnia przyczyn, jest gorsza niż jej brak: kieruje na fałszywy
trop i kosztuje czas na naprawianie czegoś, co działa. Jeśli serwer zna powód, to informacja, którą
się przekazuje — a nie szczegół implementacyjny, który się chowa.

## 2026-08-19 — Warstwa pozycjonowana w jednej osi
**Problem:** Popover kosztów LLM „zawsze otwiera się w górę i wychodzi powyżej widoku ekranu".
`AiCostBadge` miał zaszyte `bottom: calc(100% + 6px)`, a jego ~50 linii własnej matematyki liczyło
WYŁĄCZNIE oś poziomą. Pionu nie sprawdzało żadne z pięciu podobnych miejsc w aplikacji.
**Rozwiązanie:** Jeden `AnchoredLayer`: portal do `body` (wyklucza naraz przycięcie przez `overflow`
i zależność od bloku zawierającego), odbicie w pionie, dosunięcie w poziomie, `maxHeight` zamiast
wyjścia poza ekran. Wpięty od razu we wszystkie pięć miejsc — komponent bez konsumentów byłby
gorszy niż jego brak (C-35).
**Lekcja:** Usterka przetrwała tak długo, bo przypadek ŚRODKOWY wyglądał dobrze zawsze. Wariant
brzegowy (wyzwalacz przy krawędzi okna) trzeba wpisać do galerii komponentów jako osobny podgląd,
inaczej nikt go nie zobaczy przed użytkownikiem. Test geometrii przechodzi CAŁĄ powierzchnię okna,
bo „panel jest w oknie" to właściwość, a nie kilka przypadków.

## 2026-08-19 — Plan asystenta ucinany limitem wyjścia
**Problem:** „Dodaj ~100 pozycji do listy Weekend" kończyło się komunikatem „zabrakło kroków" —
dwa razy, po ~60 tys. tokenów każde, bez dodania ani jednej pozycji. W logu diagnostycznym KAŻDE
wywołanie kończy się dokładnie na `+1200` tokenów wyjścia. To nie była odpowiedź, tylko odcięcie
limitem `AGENT_MAX_TOKENS`: katalog Zakupów miał wyłącznie `add_item`, czyli jedną akcję na jedną
pozycję, więc plan musiałby zawierać sto obiektów JSON.
**Rozwiązanie:** Akcja `add_items` (sto pozycji = jedna akcja) plus większa rezerwacja tokenów dla
wiadomości, która wygląda na listę. Mniej akcji, nie więcej kroków — zwiększanie liczby obrotów
pętli mnoży koszt, który właściciel już dwa razy zapłacił bez efektu.
**Lekcja:** Równe `+1200` w kolejnych wierszach logu to nie zbieg okoliczności, tylko podpis limitu.
Zanim uzna się, że „model sobie nie poradził", warto porównać liczbę tokenów wyjścia ze stałą
w kodzie. I druga rzecz: koszt akcji w katalogu AI to nie tylko jej wykonanie — to także rozmiar
planu, w którym musi się zmieścić.

## 2026-08-19 — Sekcja AI wołana z useEffect przy każdym wejściu
**Problem:** Obserwatory pogody „bardzo często w ogóle nie działają", a przy wejściu na moduł kręcił
się spinner. `WatchersPanel` wołał model z `useEffect` przy każdym wejściu, a `evaluateWatchers`
szło prosto do `chatComplete` — bez pamięci treści, bez trybu odświeżania, bez możliwości
powstrzymania. Każde wejście płaciło za wywołanie, a każda odmowa kończyła się pustą listą.
**Rozwiązanie:** `rememberedContent` z nowym rodzajem `weather.watchers`, dokładnie wzorcem sekcji
„Co robić?" z tego samego pliku. Wejście na stronę tylko ODCZYTUJE stan sekcji.
**Lekcja:** Nieparsowalna odpowiedź modelu dawała ten sam widok co „żaden obserwator się nie
spełnił" — pustą listę. Dlatego usterka była niewidoczna mimo częstego występowania. **Awaria i
poprawny pusty wynik nie mogą wyglądać tak samo**; to ta sama lekcja co w 038 i wraca za każdym
razem, gdy ktoś napisze `?? []` na wyniku parsowania.

## 2026-08-19 — Ukryty element wciąż zajmuje kolumnę
**Problem:** Właściciel poprosił, żeby ikona trybu zaznaczania UKRYWAŁA kolumnę checkboxów, a nie
tylko blokowała zaznaczanie. Checkbox renderował się zawsze i dostawał `opacity-0
pointer-events-none` — był niewidoczny, ale zajmował 20 px plus odstęp w każdym wierszu.
**Rozwiązanie:** Poza trybem zaznaczania nie renderujemy go wcale. Świadomie cofa to ujawnianie
przy najechaniu z 042 — to ono było powodem, dla którego kolumna musiała stale zajmować miejsce.
**Lekcja:** `opacity: 0` chowa piksele, nie układ. Jeśli prośba brzmi „ukryj kolumnę", to znaczy
`display: none` albo brak elementu — nic innego nie zmieni szerokości wiersza. Przy cofaniu
wcześniejszej decyzji zostawiamy w kodzie komentarz, DLACZEGO nie wolno jej przywrócić: inaczej
następna osoba „naprawi regresję" i wróci do punktu wyjścia.

## 2026-08-20 — Konstrukcja obiektu Node w zasięgu modułu wywala hydrację CAŁEJ strony
**Problem:** `const x = new AsyncLocalStorage()` stało w zasięgu modułu w dwóch plikach platformy.
W grafie klienta `async_hooks` jest podmieniony na pusty moduł (świadomie — w przeglądarce ten
zakres nie ma sensu), więc klasa jest tam `undefined`. „Nie używamy tego w przeglądarce" dotyczy
WYWOŁANIA, nie IMPORTU: konstrukcja przy imporcie wykonuje się zawsze. Wyjątek przy starcie modułu
przerywa hydrację całej strony — użytkownik dostawał **pustą stronę**, a nie zepsuty widżet.
W produkcji ratowało wytrząsanie martwego kodu; w trybie deweloperskim, w którym chodzi klikacz,
nie ratowało nic i 61 ze 120 testów padało bez związku ze swoją treścią.
**Rozwiązanie:** Magazyn tworzony leniwie w funkcji; brak magazynu to POPRAWNY stan (brak
memoizacji, log bez pól żądania), nie wyjątek. Bramka `check:client-safe` pilnuje reguły.
**Lekcja:** Jeżeli moduł wbudowany Node może trafić do grafu klienta, nie wolno w zasięgu modułu
niczego z niego KONSTRUOWAĆ. Alias na pusty moduł chroni przed brakiem pliku, nie przed
„undefined is not a constructor" — a cena pomyłki jest nieproporcjonalna: biała strona.

## 2026-08-20 — Zepsuty miernik jest gorszy niż brak miernika
**Problem:** Klikacz e2e miał 61 czerwonych na 120 — dokładnie tyle samo przed moimi zmianami, co
po nich. Skoro „czerwony" nie znaczył „regresja", nikt tam nie patrzył. Pod tym szumem leżały:
niewidoczna siatka planu posiłków (Tailwind nie widział `src/modules` od przebudowy 046), cztery
moduły bez kontroli uprawnienia na trasie, zapytanie Wiadomości padające przy każdym wejściu
i dwie fikstury odwołujące się do skasowanej kolumny. Każda z tych rzeczy była w logu.
**Rozwiązanie:** Najpierw pomiar punktu odniesienia (ten sam zestaw na commicie sprzed zmian), potem
naprawa PRZYCZYN systemowych (hydracja, `networkidle`, serwer produkcyjny zamiast deweloperskiego),
a dopiero na końcu pojedynczych testów. 145/145 zielonych, przebieg 18 min → 2 min.
**Lekcja:** Zanim uwierzysz, że czerwony test to twoja wina — albo że nie jest — zmierz punkt
odniesienia. A jeżeli zestaw testów jest trwale czerwony, to nie jest „dług do posprzątania", tylko
**wyłączony alarm**: naprawa jest pilniejsza niż to, co akurat robisz.

## 2026-08-20 — Po przeniesieniu katalogów sprawdź konfiguracje, które wyliczają katalogi
**Problem:** `tailwind.config.ts` wyliczał `content` jako trzy katalogi (`pages`, `components`,
`app`). Przebudowa 046 przeniosła interfejsy wszystkich 21 modułów do `src/modules/` i tego pliku
nikt nie ruszył — więc Tailwind przestał widzieć klasy używane tylko w modułach i wycinał je
z arkusza. Objaw był NIEJEDNORODNY: klasa, która trafiła się też w `components/`, dalej działała.
Tak zniknęło `md:grid` w tygodniowym planie posiłków: `hidden md:grid` zostało bez reguły
przywracającej widoczność i cała siatka była na desktopie niewidoczna.
**Rozwiązanie:** Jeden glob `./src/**`, bo wyliczanie katalogów to ta sama równoległa lista, którą ta
przebudowa usuwała z aplikacji. Bramka `check:tailwind-content` sprawdza POKRYCIE: każdy katalog pod
`src/` z plikami `.tsx` musi być objęty którymś globem.
**Lekcja:** Duże przenosiny plików to nie tylko importy. Przejrzyj wszystko, co wymienia katalogi
z nazwy: konfiguracje narzędzi, globy, `include`/`exclude`, `content`, wzorce w skryptach. Te miejsca
nie krzyczą — po prostu przestają obejmować część kodu.

## 2026-08-20 — Bramka wymaga próby mutacyjnej: dwie z czterech były fałszywie zielone
**Problem:** Z czterech bramek dopisanych w jednym przebiegu **dwie** przechodziły na zielono także
wtedy, gdy błąd był obecny. `check-route-gating` dopasowywała samą nazwę funkcji, więc do przejścia
wystarczał sam `import` — po usunięciu wywołania bramka milczała. `check-tailwind-content` budowała
wyrażenie regularne z globu łańcuchem `replace`: kreska alternatywy z `{js,ts,…}` trafiała do wzorca
niezasłonięta i całe wyrażenie stawało się alternatywą najwyższego poziomu, więc **każda** ścieżka
pasowała do **każdego** globu.
**Rozwiązanie:** Do każdej bramki co najmniej jedna próba: zepsuj dokładnie to, czego bramka ma
pilnować, i sprawdź, że czerwieni. Obie wady wyszły natychmiast.
**Lekcja:** Bramka bez próby mutacyjnej to nie zabezpieczenie, tylko jego wygląd — i to gorszy niż
brak, bo daje poczucie pokrycia. Zielona bramka na zdrowym kodzie nie dowodzi niczego.

## 2026-08-20 — Wyścig z hydracją: ponowienie nazywa problem, dłuższy limit go ukrywa
**Problem:** Po usunięciu czekania na `networkidle` (które przy otwartym SSE trwało do limitu czasu
i przypadkiem dawało czas na hydrację) posypały się testy klikające i naciskające klawisze zaraz po
`load`. Formularz jest już w DOM (renderuje go serwer), więc `fill` przechodzi i przycisk daje się
kliknąć — tylko akcja nie leci, bo React jeszcze nie przejął strony. Objaw pojawiał się kilkanaście
linijek dalej: test padał na klikaniu listy, której nie utworzył.
**Rozwiązanie:** `expect(async () => { …akcja…; …asercja… }).toPass()` — ponowienie z krótkim limitem
wewnątrz. Przy tworzeniu danych ponowienie najpierw sprawdza, czy rekord już istnieje, żeby nie
robić duplikatów.
**Lekcja:** Na wyścig z hydracją nie odpowiada się dłuższym limitem czasu (ukrywa i spowalnia), tylko
ponowieniem akcji. I szukaj przyczyny WYŻEJ niż linia, w której test padł — brakujące dane zwykle
znaczą, że wcześniejsza akcja nie doszła.

## 2026-08-20 — Kodmod na JSX: pięć pułapek, z których każda wygląda jak jedno wyrażenie regularne
**Problem:** Wyciągnięcie 1358 tekstów z komponentów do `messages/pl.json` wydawało się zadaniem na
jeden regex. Kodmod trzeba było poprawiać pięć razy, za każdym razem po błędzie z `tsc`:
(1) podmiany i wstrzyknięcia `const t` w dwóch przebiegach — pozycje ciał funkcji liczone w tekście
oryginalnym przestawały pasować po podmianach i hook lądował **w środku napisu**; (2) zjadanie
białych znaków wokół tekstu — `<Icon /> Usuń` traciło spację; (3) `label = "x"` (przypisanie do
zmiennej) potraktowane jak atrybut JSX; (4) generyk `useState<string>(…)` i literał
`"<strong>Lista</strong>"` wzięte za tekst między znacznikami; (5) `await getTranslations` wstawione
do funkcji, która nie jest `async`.
**Rozwiązanie:** Jeden przebieg zmian malejąco po pozycji; białe znaki na zewnątrz `{t(…)}`; atrybut
rozpoznawany bez spacji wokół `=`; odsiew po SYGNATURACH kodu plus skaner literałów tekstowych;
wybór hooka per DEKLARACJA (`useTranslations` działa też w komponencie serwerowym, `getTranslations`
tylko w async).
**Lekcja:** Kodmod na JSX nie jest podmianą tekstu, tylko małym kompilatorem. Zanim go puścisz na
200 plików, uruchom na jednym katalogu i **przeczytaj diff** — a potem i tak licz się z tym, że
`tsc` znajdzie klasę przypadków, o której nie pomyślałeś.

## 2026-08-20 — Bez diakrytyków znika jedyny sygnał odróżniający zdanie od kodu
**Problem:** Po wyciągnięciu tekstów z polskimi znakami został ~1600 literałów bez nich. Kodmod
dostał „tryb szeroki" i podmienił 781 z nich — efekt: **22 pliki z błędami składni**. Do słownika
trafiło m.in. `) : null ) : (` z operatora warunkowego, bo między `>` a `<` naprawdę tam stało.
**Rozwiązanie:** Tryb wycofany w całości (759 podmian cofniętych, stan sprawdzony `tsc` i bramką).
Kryterium diakrytyków zostaje jako granica automatu; resztę trzeba rozstrzygać ręcznie.
**Lekcja:** Automat potrzebuje sygnału, po którym rozpoznaje swój cel. Kiedy sygnał znika (tu:
polskie znaki), nie rozszerzaj automatu „na oko" — zmień narzędzie albo zostaw robotę człowiekowi.
Rozszerzony automat nie robi więcej dobrego, tylko więcej.

## 2026-08-20 — Fragment zdania jako osobny klucz jest dla tłumacza gorszy niż zdanie w kodzie
**Problem:** Po wyciągnięciu pełnych tekstów zostało ~820 literałów będących KAWAŁKAMI zdań
rozbitych znacznikiem (`Opcjonalny, ale <strong>zalecany</strong> do web_search`). Licznik bramki
kusił, żeby wyciągnąć je jako `t("opcjonalnyAle")` i `t("zalecany")` — i zejść do zera.
**Rozwiązanie:** Zostawione świadomie, z zapisanym powodem. Z „Opcjonalny, ale" i „zalecany" nie da
się złożyć zdania w języku o innym szyku; poprawne rozwiązanie to `t.rich(...)` ze znacznikiem
w treści komunikatu, czyli przepisanie zdanie po zdaniu.
**Lekcja:** Miernik pokazuje liczbę, nie cel. Zejście licznika do zera kosztem sensu tłumaczenia
byłoby regresem udającym postęp — a bramka nigdy by tego nie zauważyła.

## 2026-08-20 — Parzystość cudzysłowów w linii to zły sposób na „czy jestem w stringu"
**Problem:** Bramka i18n sprawdzała, czy trafienie stoi wewnątrz literału, licząc cudzysłowy od
początku linii. Wystarczył literał szablonowy z cudzysłowem w środku
(`` `Usunąć kontakt „${nazwa}"?` ``), żeby parzystość się odwróciła i **cała reszta linii** stała
się dla bramki „wnętrzem napisu". Bramka przestawała widzieć teksty stojące dalej — czyli myliła się
w stronę ciszy, najgorszą z możliwych.
**Rozwiązanie:** Skaner z trzema ogranicznikami (`"`, `'`, `` ` ``), znakami ucieczki i zerowaniem
stanu na końcu linii dla cudzysłowów, które nie przechodzą przez nową linię.
**Lekcja:** Heurystyka parzystości działa tylko w gramatyce z jednym rodzajem ogranicznika. Przy
trzech (i szablonach wieloliniowych) trzeba napisać skaner — to piętnaście linii, a różnica jest
między bramką, która pilnuje, a bramką, która czasem pilnuje.

## 2026-08-20 — Zapadka, która nie widzi spłaty, zniechęca do spłacania
**Problem:** `check:pagination` liczyła zapytania bez `take` wzorcem tekstowym. Jedyne miejsce
w aplikacji z prawdziwą paginacją kursorową (log audytu) wnosi `take` **spreadem**
(`...keysetQuery(...)`), więc wzorzec go nie widział i poprawnie spaginowane zapytanie liczyło się
jako dług. Ktoś, kto spłacał dług właściwym narzędziem, nie widział poprawy licznika.
**Rozwiązanie:** Bramka rozpoznaje spread helpera. Przy okazji przestała być zapadką: dziś każde
`findMany` musi mieć jawną granicę — `take`, kursor albo komentarz „paginacja: kompletny — powód".
**Lekcja:** Pisząc zapadkę, sprawdź najpierw, czy rozpoznaje **właściwe rozwiązanie**, a nie tylko
zły stan. Miernik, który nie nagradza poprawnego ruchu, uczy omijania siebie.

## 2026-08-20 — Sufit dopisany mechanicznie do zapytania, które liczy sumę, to nie ochrona, tylko cichy błąd
**Problem:** Domknięcie zadania 20 zaczęło się od mechanicznego dopisania `take` do 204 zapytań.
Wśród nich były zapytania, z których liczy się LICZBY: raport miesięczny portfela, wydatki budżetu,
stan magazynowy sumowany z partii, trend badania, licznik posiadaczy dostępu administratora (na nim
stoi blokada samowykluczenia). Sufit w takim miejscu nie chroni — po cichu zmienia wynik.
**Rozwiązanie:** 36 miejsc przejrzanych po jednym i oznaczonych komentarzem
`// paginacja: kompletny — <powód>` tuż nad zapytaniem. Znacznik jest w kodzie, nie w manifeście:
pliki bywają mieszane (jeden ma i listę do pokazania, i sumę do policzenia), a powód w osobnym
pliku to powód, którego recenzent w diffie nie zobaczy.
**Lekcja:** Zmiana mechaniczna jest bezpieczna tylko wtedy, gdy jest **semantycznie obojętna**. Zanim
puścisz codemod na zapytania, podziel je na te, które coś POKAZUJĄ, i te, z których coś się LICZY —
drugie wymagają decyzji, nie transformacji.

## 2026-08-20 — Paginacji nie da się doszyć do widoku, który filtruje i liczy po stronie klienta
**Problem:** Rozdz. 11.4 wymaga kursora „we wszystkich widokach listowych". Próba wykonania tego
dosłownie pokazała, że przeszkodą nie jest pracochłonność: notatki pokazują `filtrowane / wszystkie`
i budują z pełnego zbioru linki `[[Tytuł]]` oraz odnośniki zwrotne, zadania grupują po projekcie
z licznikami na zakładkach, zakupy grupują po kategorii. Strona nie spowolniłaby tych ekranów —
**pokazałaby nieprawdziwe liczby**.
**Rozwiązanie:** Granica wszędzie (sufit `SUFIT_LISTY`), kursor tam, gdzie widok jest czystym
dziennikiem bez agregatów po stronie klienta. Warunek dla reszty — przeniesienie filtrowania
i grupowania na serwer — zapisany jako następny krok, nie odhaczony.
**Lekcja:** Zanim obiecasz paginację w widoku, sprawdź, czy ten widok czegoś nie **liczy** z pełnego
zbioru. Paginacja to zmiana kontraktu danych, nie optymalizacja zapytania.

## 2026-08-19 — Bramki pilnowały kształtu migracji, nie tego, czy kod jeszcze o to pyta
**Problem:** Migracja 0244 usunęła `ownerId`/`ownerTeamId` z 40 tabel. W czterech miejscach kod dalej
budował po nich warunek zapytania — w tym w planie posiłków zawężonym do zespołu i w rozstrzyganiu
projektu przez asystenta AI, czyli na ścieżkach, którymi użytkownik chodzi. Prisma odpowiada tam
`Unknown argument 'ownerTeamId'`. Przeżyło to `tsc` **i** dwadzieścia cztery bramki: warunek powstaje
jako `Record<string, unknown>` albo tablica literałów w zmiennej, więc dla kompilatora nazwa kolumny
jest zwykłym kluczem słownika, a wszystkie bramki własnościowe sprawdzały KSZTAŁT migracji (czy
kolumny znikły, czy triggery są, czy lustro się zgadza) — żadna nie pytała, czy kod nadal woła to,
co migracja skasowała.
**Rozwiązanie:** Cztery poprawki (`workspaceId` przez `filtrMoichRekordow` /
`przestrzenZespoluBezKontroliDostepu`) plus bramka `check:owner-columns`, która rozstrzyga PO MODELU:
`ownerId` w `itemHistory` przechodzi, ten sam klucz w `recipe` pada. Klucze podane przez zmienną są
rozwiązywane do punktu stałego w obrębie pliku.
**Lekcja:** Po usunięciu kolumny sprawdź nie tylko, czy zniknęła, ale **czy ktoś jeszcze o nią pyta**
— i pamiętaj, że dynamicznie budowany `where` jest dla kompilatora niewidzialny. Jeżeli w repo
istnieje wzorzec „warunek jako `Record<string, unknown>`", to każde usunięcie pola z bazy wymaga
własnej bramki, bo typy nie pomogą ani razu.

## 2026-08-19 — Bramka, która żąda uzasadnienia dla 37 plików, nie jest decyzją, tylko szumem
**Problem:** Pierwsza wersja `check:owner-columns` liczyła każdy klucz `ownerId:` w kodzie serwerowym
i zażądała wpisu w manifeście dla 37 plików. Większość z nich to były argumenty funkcji
(`enqueueJob({ownerId})`, `createBudget({ownerTeamId})`, propsy komponentów) — rzeczy, które z bazą
nie mają nic wspólnego. Manifest tej wielkości nikt nie czyta; bramka, która co drugi build oskarża
niewinny plik, kończy jako `|| true`.
**Rozwiązanie:** Filtr po ZNACZENIU zamiast po składni: liczy się tylko klucz, który faktycznie
dojedzie do Prismy jako nazwa pola — wprost w zbalansowanym argumencie `prisma.<model>.<op>(…)` albo
przez zmienną rozwiązywaną z tego argumentu. Wynik: zero wyjątków, zero manifestu, 2263 sprawdzone
wywołania i wszystkie cztery prawdziwe błędy złapane.
**Lekcja:** Wzorzec „manifest jawnych decyzji" (jak `content-memory-coverage.json`) jest dobry, gdy
decyzji jest kilkanaście i każda coś znaczy. Gdy bramka produkuje ich kilkadziesiąt, to nie znak, że
trzeba manifestu — to znak, że bramka mierzy złą rzecz. Najpierw zawęź pytanie, dopiero potem
dopuszczaj wyjątki.

## 2026-08-19 — Jeden poziom podstawienia za mało: próba mutacyjna złapała dziurę w nowej bramce
**Problem:** `check:owner-columns` rozwiązywała identyfikatory jednopoziomowo (`where: warunek` →
definicja `warunek`). Na czterech prawdziwych błędach złapała trzy. Czwarty (`getRecipes`) miał filtr
o jedno podstawienie dalej: `where` w zmiennej, a filtr własnościowy w DRUGIEJ zmiennej wskazanej
z niej przez `OR:`. Bez próby mutacyjnej bramka poszłaby do repozytorium zielona i nieprawdziwa.
**Rozwiązanie:** Rozwiązywanie do punktu stałego (limit rund chroni przed cyklem) + zestaw pięciu
prób mutacyjnych odtwarzających każdy z czterech błędów osobno plus literał wprost w `where`.
**Lekcja:** Nowej bramki nie wolno oddać na podstawie tego, że „łapie znany błąd" — trzeba ją
skonfrontować z **każdym** kształtem błędu, dla którego powstaje, osobno. Kształty różnią się o jedno
podstawienie, a właśnie ten jeden przypadek zostaje w kodzie.

## 2026-08-19 — Nadanie dostępu bez miejsca, w którym zasób się pojawi, jest prawdziwe i niewidoczne
**Problem:** Po wpięciu `ShareDialog` do Notatek nadanie działało: guard przepuszczał obdarowanego.
Notatka i tak była dla niego nieosiągalna — lista notatek jest zawężona do własnych przestrzeni,
a modułu Notatki nie da się otworzyć „po adresie zasobu", bo całość renderuje jedna strona.
Funkcja byłaby więc zaimplementowana, przetestowana i bezużyteczna.
**Rozwiązanie:** Nowa zdolność platformy `idZasobowNadanychMi(userId, resourceType, ctx)` —
odwrotność `resolveRole`. `resolveRole` odpowiada „czy mam dostęp do TEGO zasobu"; do listy potrzebne
jest pytanie „których zasobów tego typu mi udostępniono". Świadomie pomija nadania linkowe (link daje
dostęp temu, kto go ma, więc doklejenie zasobu do czyjejś listy pokazałoby go osobie, która linku
nigdy nie dostała) i odziedziczone (widać je przez rodzica).
**Lekcja:** Przy udostępnianiu zawsze sprawdź OBIE strony: czy obdarowany ma prawo **i czy ma jak
tam dotrzeć**. Kontrola dostępu odpowiada na pytanie o jeden zasób; lista wymaga pytania odwrotnego
i to jest osobna funkcja, nie efekt uboczny.

## 2026-08-19 — Opis struktury utrzymywany osobno od struktury zawsze kłamie
**Problem:** Strona `/admin/architecture` była pisana ręcznie: 449 linii, w tym „SQLite (lokalne dev)"
długo po przejściu całego projektu na Postgresa i nagłówek „ostatnia aktualizacja: 2026-06-01".
Nikt jej nie zaniedbał złośliwie — po prostu każda zmiana w kodzie wymagała pamiętania o drugim
miejscu, a przy dwudziestym takim miejscu pamięć przestaje wystarczać. To ta sama patologia, którą ta
przebudowa likwidowała w ośmiu równoległych listach modułów.
**Rozwiązanie:** Treść jest teraz WYPROWADZANA przy budowaniu (`scripts/generate-architecture.js`):
zdolności platformy z katalogu, moduły z rejestru, bramki z polecenia `build` w `package.json`,
liczby modeli i migracji z `prisma/`, progi zapadek z ich manifestów. Uzasadnień na tej stronie NIE MA
— są w książkach i dzienniku; trzecie miejsce na „dlaczego" byłoby powrotem tego samego problemu.
**Lekcja:** Jeżeli dokument POWTARZA fakt, który gdzieś już stoi w kodzie (liczbę, listę, próg,
wersję), to nie jest dokument — to kopia, która rozejdzie się z oryginałem, i to zwykle w miesiącu,
w którym nikt nie patrzy. Wygeneruj ją albo nie pisz. Ręcznie pisz wyłącznie to, czego z kodu wyczytać
NIE MOŻNA: powody decyzji i odrzucone warianty.

## 2026-08-19 — Zapadka, która liczy dwie różne rzeczy, kłamie w obie strony
**Problem:** Zapadka paginacji trzymała próg 261 „nieograniczonych zapytań listowych". W tej liczbie
siedziało 55 zapytań z eksportu i usuwania danych RODO — a tam `take` byłby BŁĘDEM, nie
optymalizacją: eksport niepełny to niespełnienie obowiązku, pominięty wiersz przy usuwaniu to dane,
które miały zniknąć i nie zniknęły. Skutek był podwójny: próg mówił, że mamy 261 list bez paginacji
(nieprawda), a spłata prawdziwego długu wyglądała na wolniejszą, niż jest — bo 21 % licznika nigdy
nie miało spaść.
**Rozwiązanie:** Manifest wyjątków per plik, z powodem, i z kontrolą martwych wpisów (inaczej lista
wyjątków rośnie jako wygodniejsza alternatywa dla właściwej roboty). Po wydzieleniu: 261 → 215, a po
realnej spłacie jednego miejsca → 207.
**Lekcja:** Zanim zamrozisz licznik jako zapadkę, sprawdź, czy wszystkie jego składniki **mogą
spaść**. Składnik, który z definicji nie spadnie, nie jest długiem — jest szumem, który maskuje
postęp i psuje interpretację progu. To dotyczy każdej metryki „ile jeszcze zostało": ostrzeżeń lintera,
plików bez testów, tekstów do przetłumaczenia. Wyjątek z powodem jest lepszy od zawyżonego progu.

## 2026-08-19 — Sonda, która nie czerwieni się po usunięciu reguły, mierzy inną regułę
**Problem:** Test miał dowodzić, że udostępnianie zasobu wymaga roli `manager`. Sprawdzał, że OBCY
użytkownik nie może udostępnić cudzego projektu — i po usunięciu z kodu całego warunku
`resourceRoleAtLeast(rola, "manager")` **nadal przechodził**. Powód: obcego odrzuca wcześniej
`resolveRole === null`, czyli brak jakiejkolwiek relacji do zasobu. Test mierzył „czy nieznajomy jest
odrzucany", a nie „czy wymagamy roli zarządzającej".
**Rozwiązanie:** Właściwym przypadkiem jest ktoś, kto MA dostęp, ale za niski — użytkownik z rolą
`viewer` próbujący udostępnić dalej. Bez sprawdzenia roli każdy z podglądem rozdawałby dostęp
dalej: eskalacja uprawnień przez udostępnianie. Po dodaniu tego przypadku sonda czerwieni się
prawidłowo.
**Lekcja:** Przy regułach stopniowanych (role, poziomy, progi) przypadek „ktoś całkiem z zewnątrz"
prawie nigdy nie testuje reguły — testuje warunek wejściowy, który stoi przed nią. Dobierz podmiot
leżący **dokładnie po niewłaściwej stronie granicy**: o jeden poziom za nisko, o złotówkę poniżej
progu, o dzień po terminie. I zawsze potwierdź sondą: reguła usunięta z kodu musi zaświecić test na
czerwono, inaczej test opisuje coś innego, niż sądzisz.

## 2026-08-19 — Wielojęzyczność: `toLocaleString("pl-PL")` jest gorszy od tekstu po polsku
**Problem:** Przy wyciąganiu tekstów naturalnym odruchem jest szukanie polskich napisów w JSX.
Tymczasem drugą połowę długu stanowi formatowanie: `toLocaleString("pl-PL")` **wygląda poprawnie**
i jest tak samo twardo zaszyty, a dodatkowo ignoruje strefę czasową przestrzeni (formatuje w strefie
systemu) i kusi, żeby wyprowadzić walutę z języka. Trzeci wariant tego samego błędu to granice doby
liczone przez `new Date(y, m, d)` — to strefa SERWERA, na Renderze UTC, więc między północą a drugą
w nocy polskie „dzisiaj" jest serwerowym „wczoraj".
**Rozwiązanie:** Osobna warstwa `platform/i18n/format.ts` przyjmująca `{locale, timezone}`
**parametrem** (helper sięgający po sesję nie działa w zadaniu w tle ani przy treści cudzej
przestrzeni), waluta jako osobny parametr, granice doby liczone przez `Intl` z odczytanym
przesunięciem strefy. Każdy z trzech błędów ma własny przypadek testowy z dwiema strefami.
**Lekcja:** Tekst zaszyty w komponencie widać; **format zaszyty w komponencie wygląda dobrze**.
Przy przeglądzie i18n szukaj `toLocaleString`, `toLocaleDateString`, `Intl.NumberFormat` bez
`timeZone` i arytmetyki na `Date` przy granicach dnia — tam siedzi ta część długu, której nie widać
na zrzucie ekranu, bo objawia się dopiero u kogoś w innej strefie.

## 2026-08-19 — „Przechodzi sam, czerwieni się w zestawie” to zwykle wina PRZYRZĄDU, nie kodu
**Problem:** Test liczący zapytania (zapadka N+1) zaczął padać wyłącznie w pełnym przebiegu
`test:unit`, nigdy uruchomiony osobno. Pierwszy odruch: „ostatnia zmiana coś zepsuła, tylko widać to
przy obciążeniu”. Sprawdzenie kodu niczego nie dało, bo kod był w porządku.
**Rozwiązanie:** Winny był sam pomiar. Zdarzenia Prismy `$on("query")` przychodzą ASYNCHRONICZNIE,
więc ostatnie zapytanie przebiegu rozgrzewającego potrafiło dolecieć już po wyzerowaniu licznika
i policzyć się w oknie pomiarowym jako powtórzenie. Na obciążonej maszynie okno było szersze,
stąd zależność od reszty zestawu. Poprawka: krótka chwila (`setTimeout 50 ms`) na dojście zdarzeń
po każdym przebiegu, przed odczytem licznika.
**Lekcja:** Gdy test jest niestabilny w zależności od OBCIĄŻENIA, a nie od danych, podejrzewaj
najpierw kanał, którym zbierasz wynik: log zdarzeń, strumień, callback, metrykę. Wszystko, co
dociera „przy okazji”, dociera z opóźnieniem — a granica okna pomiarowego wyznaczona synchronicznie
(`licznik = 0`) nie czeka na to, co jeszcze leci. Reguła ogólna: jeśli mierzysz przez kanał
asynchroniczny, po każdej fazie pomiaru daj mu dojść do końca.

## 2026-08-19 — Martwego zapytania nie widzi ani kompilator, ani lint — widzi je licznik
**Problem:** Audyt N+1 pokazał, że kalendarz wykonuje 35 zapytań przy siedmiu wkładach modułowych.
Sześć z nich to było `const teamIds = await getUserTeamIds(userId)` — wynik nieużywany ani razu,
pozostałość po migracji na przestrzenie (079 przełożyło miejsca UŻYCIA zespołów, a samo pobranie
zostało). W całym repozytorium takich martwych wywołań było **siedemnaście**. `tsc` ich nie zgłasza,
bo zmienna jest „użyta” przez samo przypisanie; `no-unused-vars` też nie, bo deklaracja z inicjalizacją
liczy się jako użycie w domyślnej konfiguracji.
**Rozwiązanie:** Znalezione mechanicznie: `grep -c "teamIds" <plik>` równe 1 oznacza, że jedyne
wystąpienie to deklaracja. Usunięte razem z importami; kalendarz spadł z 35 do 14 zapytań, a zapadka
paginacji z 263 do 261.
**Lekcja:** Po każdej migracji, która zmienia SPOSÓB liczenia czegoś (własność, zakres, uprawnienia),
przejdź jeszcze raz po miejscach, które POBIERAŁY stare dane wejściowe. Konwersja naturalnie skupia
się na tym, co się liczy, i zostawia to, z czego się liczyło. Najtańszy detektor to policzenie
wystąpień nazwy zmiennej w pliku — jedno wystąpienie znaczy „martwe”. Najlepszy to licznik zapytań:
martwe wywołanie jest niewidoczne w typach i widoczne w liczbie zapytań.

## 2026-08-19 — „Odczytaj, porównaj, zapisz” nie jest odebraniem prawa do przebiegu
**Problem:** Zadanie okresowe (retencja danych) miało chodzić raz na dobę, ale tyknięcie żyje
w każdej instancji `web`. Naturalna implementacja — odczytaj znacznik ostatniego przebiegu, porównaj
z bieżącym czasem, zapisz nowy — wygląda poprawnie i taka nie jest: dwie instancje czytają ten sam
stary znacznik, obie uznają, że im się należy, i obie ruszają. Sonda mutacyjna z pięcioma
równoległymi próbami przepuściła **pięć na pięć**.
**Rozwiązanie:** Prawo odbiera się jednym warunkowym zapisem, a nie sekwencją odczyt→zapis:
`INSERT … ON CONFLICT ("key") DO UPDATE SET "value" = EXCLUDED."value" WHERE "Config"."value" <
<granica> RETURNING "key"`. Wiersz wraca tylko do zwycięzcy; przegrani dostają pustkę i nic nie robią.
Ten sam kształt, co przejmowanie slotu dzierżawy w limiterze (081).
**Lekcja:** Za każdym razem, gdy kod czyta stan, podejmuje decyzję i zapisuje wynik tej decyzji,
zapytaj, co się stanie, gdy dwa procesy zrobią to naraz — w aplikacji z wieloma instancjami odpowiedź
brzmi „oba przejdą”. Jeśli decyzja daje się wyrazić warunkiem `WHERE` w tym samym zapisie, wyraź ją
tam. I napisz test z kilkoma równoległymi próbami: test sekwencyjny przechodzi w obu wariantach, więc
niczego nie dowodzi.

## 2026-08-19 — Bramka czytająca „każdy plik wołający X” prędzej czy później czyta testy
**Problem:** Nowy test integracyjny wołał `chatComplete`, żeby udowodnić, że wyłącznik awaryjny AI
działa. Dwie bramki (`check:cost-badge`, `check:content-memory`) skanują **każdy plik** z tym
wywołaniem i obie od razu zgłosiły brak pokrycia. Odruch podpowiadał dopisać ścieżkę testu do
manifestu wyjątków z powodem „to test".
**Rozwiązanie:** Manifest wyjątków ma opisywać REGUŁĘ, a nie kolekcjonować przykłady. Obie bramki
pilnują tego samego zdania: „treść pokazywana użytkownikowi ma licznik kosztu / jest pamiętana".
Test nie ma użytkownika, któremu cokolwiek pokazuje, więc nie jest konsumentem tej reguły — poprawką
jest zawężenie ZAKRESU bramki (katalogi `__tests__` i pliki `*.test.ts` poza skanem), nie wpis
wyjątku. Sprawdziłem przy okazji, że liczba objętych plików się nie zmieniła: gdyby spadła, znaczyłoby
to, że zawężenie zdjęło z bramki także prawdziwy kod.
**Lekcja:** Gdy bramka zgłasza plik, który spełnia jej WZORZEC, ale nie podlega jej REGULE, to jest
błąd zakresu bramki, nie brakujący wyjątek. Wyjątek zapisany „bo to test" działa raz, a przy piątym
takim wpisie nikt już nie pamięta, czego bramka właściwie pilnuje. Po zawężeniu zakresu porównaj
licznik przed i po — spadek oznacza, że zdjęło się za dużo.

## 2026-08-19 — Limit współbieżności w bazie musi być DZIERŻAWĄ, nie licznikiem
**Problem:** Przenosząc strażnika współbieżności z pamięci procesu do bazy odruchowo przepisałem to,
co było: licznik `inFlight` inkrementowany na starcie i dekrementowany w `finally`. W pamięci to
działa, bo licznik ginie razem z procesem. W bazie **przeżywa go** — proces ubity w połowie
odpowiedzi (deploy, OOM, restart kontenera) zostawia licznik podniesiony na zawsze, a użytkownik
dostaje „asystent przetwarza już Twoje polecenie" do końca świata. Objaw pojawia się u jednego konta,
nie ma go w logach i nie da się go odtworzyć — bo warunkiem jest awaria, a nie ruch.
**Rozwiązanie:** Nie licznik, tylko **sloty z terminem ważności**: `PRIMARY KEY (key, slot)`,
`holder`, `expiresAt`. Zajęcie to jeden `INSERT … ON CONFLICT (key, slot) DO UPDATE … WHERE
"expiresAt" <= now()` — atomowy na poziomie wiersza, więc serializuje go indeks unikalny, a nie
blokada doradcza (wariant „policz aktywne, wstaw jeśli mniej niż N" przepuszcza dwie równoległe
próby: obie widzą ten sam stan). Zwolnienie ma warunek `holder = <nasz>`, żeby spóźnione `finally`
nie skasowało dzierżawy, którą po wygaśnięciu przejął ktoś inny.
**Lekcja:** Przenosząc stan z pamięci procesu do współdzielonego magazynu zapytaj, **co ten stan
czyściło do tej pory**. Jeśli odpowiedź brzmi „śmierć procesu", to nowy nośnik musi mieć własny
mechanizm wygasania — inaczej przenosisz stan razem z wyciekiem. Ta sama uwaga dotyczy blokad,
sesji, znaczników „w trakcie" i flag „zablokowane do".

## 2026-08-19 — Klucz idempotencji z `event.id` bywa WĘŻSZY, niż wymaga tego reguła biznesowa
**Problem:** Pisząc subskrybenta „brak w Magazynie → pozycja na liście zakupów" sięgnąłem
odruchowo po wzorzec z 071: klucz idempotencji wyprowadzony z `event.id`. Przeszedłby bramkę
`check:subscribers` i test podwójnego dostarczenia. Nie spełniałby jednak tego, o co poprosił
właściciel: „ta sama pozycja nie dubluje się przy kolejnych spadkach". Trzy spadki tej samej pozycji
w ciągu dnia to **trzy różne zdarzenia** — każde z innym `event.id` — więc lista dostałaby trzy
wiersze „Mleko", a wszystkie testy świeciłyby na zielono.
**Rozwiązanie:** Kluczem jest trójka **(lista, nazwa, status `NEEDED`)**, czyli idempotencja
„naturalna". Reakcja brzmi odtąd „upewnij się, że brak jest na liście", a nie „dopisz brak".
Status w kluczu ma własny przypadek testowy: bez niego kupione raz mleko zablokowałoby automat na
zawsze.
**Lekcja:** `event.id` chroni przed **ponowieniem dostarczenia** i tylko przed nim. Zanim go
wybierzesz, zapytaj, czy reguła nie jest szersza: „nie rób tego dwa razy dla tego ZDARZENIA" to co
innego niż „nie rób tego dwa razy dla tego SKUTKU". Gdy istnieje klucz naturalny opisujący skutek,
jest lepszy — pokrywa oba przypadki naraz. Sygnał ostrzegawczy: wzorzec wybrany dlatego, że
poprzedni subskrybent go używał.

## 2026-08-19 — Asercja „po usunięciu konta" nie może liczyć zbioru, którego definicja żyje w tym koncie
**Problem:** Testy RODO sprawdzały „ile rekordów z `ownerId: A.id` zostało po `purgeUserData(A.id)`".
Przy przejściu na przestrzenie odpowiednikiem wydawało się `filtrMoichRekordow(A.id)` — i trzy testy
wywróciły się na `Foreign key constraint violated: Workspace_personalUserId_fkey`. Powód:
`filtrMoichRekordow` woła `przestrzenOsobista`, a ta **tworzy brakującą przestrzeń** (świadoma
decyzja z 076: brak przestrzeni to usterka lustra, nie stan do obsłużenia). Dla konta, które właśnie
skasowaliśmy, nie ma dla kogo jej utworzyć.
**Rozwiązanie:** Asercje liczą konkretne **id** rekordów zapamiętane przy tworzeniu fixture'u.
Wyszło mocniej, niż było: mierzą TE wiersze, a nie liczność zbioru, który mógł się zmienić z zupełnie
innego powodu.
**Lekcja:** Funkcja, która coś **domyka** (`ensure*`, „utwórz, jeśli brak"), jest wygodna w kodzie
aplikacji i pułapką w teście stanu końcowego — bo zmienia bazę w trakcie sprawdzania i wymaga
istnienia bytu, którego test właśnie się pozbył. W asercjach „po usunięciu" odwołuj się do **id
zapamiętanych wcześniej**, nigdy do predykatu wyliczanego z usuniętego bytu.

## 2026-08-19 — `--shadow-database-url` wskazujący na bazę roboczą kasuje ją bez ostrzeżenia
**Problem:** Do wygenerowania DDL nowego klucza obcego uruchomiłem
`prisma migrate diff --from-migrations … --shadow-database-url "$DATABASE_URL"`. DDL wyszedł
poprawny, ale następne `prisma migrate deploy` padło na `P3005: The database schema is not empty`.
Prisma użyła wskazanej bazy jako **cienia**: odtworzyła w niej migracje i posprzątała po sobie,
zostawiając tabele bez `_prisma_migrations`. Dokładnie objaw z instrukcji odzysku — tylko że tym
razem to nie kontener „cofnął bazę", tylko ja ją skasowałem własnym poleceniem.
**Rozwiązanie:** Odtworzenie bazy od zera (`dropdb`/`createdb` + `migrate deploy`). Docelowo:
**nie podawaj `--shadow-database-url` w ogóle** — Prisma stworzy i skasuje własną bazę cienia
(tak robi `check:schema-drift`, dlatego on jako jedyny przeszedł bez szkód).
**Lekcja:** Baza cienia jest **kasowana i odtwarzana** — wskazanie na nią czegokolwiek, na czym Ci
zależy, jest równoznaczne z `dropdb`. Gdy narzędzie prosi o „bazę pomocniczą", nigdy nie podawaj
tej, w której pracujesz, nawet lokalnie. Sygnał ostrzegawczy: baza „nagle kłamie" **zaraz po**
poleceniu, które dostało jej URL w nietypowym parametrze — to nie kontener, to ten parametr.

## 2026-08-19 — Fixture, który „porządkuje" stan przed pomiarem, wycina z pomiaru broniony przypadek
**Problem:** Usuwałem z deklaracji zasobów fakt `ownerId`, który od 075 pełnił rolę **siatki**:
gdy przestrzeni zasobu nie było w kontekście dostępu użytkownika (brak wiersza `WorkspaceMember`),
właściciel i tak dostawał `manager`. Trzy istniejące tabele prawdy (`truthTable`,
`truthTableRemaining`, `truthTablePets`) przeszły po zmianie na zielono — mimo że siatka zniknęła
bez zastępstwa. Powód: każdy z tych fixture'ów zaczyna od `ensurePersonalWorkspace`, który przy
okazji **naprawia brakujące członkostwo**. Mierzyły więc stan, w którym broniony kod jest zbędny.
**Rozwiązanie:** Osobna tabela prawdy (`wlasnoscBezLustra`), która stan awarii **buduje celowo** —
kasuje wiersze `WorkspaceMember` po utworzeniu zasobów. Sonda potwierdziła, że mierzy, co trzeba:
bez poprawki w `getAccessContext` sześć komórek czerwienieje. Siatka przeniosła się do kontekstu
dostępu — przestrzeń osobista czytana po `Workspace.personalUserId`, nie po członkostwie.
**Lekcja:** Kod istniejący na wypadek awarii wymaga testu, który **tę awarię odtwarza**. Fixture
wołający funkcję uzgadniającą (`ensure*`, `sync*`, „przygotuj czyste dane") jest wygodny i zwykle
poprawny — ale w teście zabezpieczenia jest wprost szkodliwy, bo usuwa przedmiot pomiaru. Sygnał
ostrzegawczy: **usuwam zabezpieczenie i nic się nie czerwieni**. To nie znaczy, że było zbędne;
najczęściej znaczy, że żaden test nie wchodzi w stan, dla którego powstało.

## 2026-08-18 — Lista bramek w CLAUDE.md rozjechała się o osiem pozycji, bo dopisywano ją ręcznie
**Problem:** Chciałem dopisać do opisu potoku budowania dwie nowe bramki. Sprawdzenie w
`package.json` pokazało, że dokument wymienia **13 bramek, a build uruchamia 21**. Osiem
(`check-domain`, `check-events`, `check-grant-mirror`, `check-ownership-scope`, `check-pagination`,
`check-realtime`, `check-subscribers`, `check-versioning`) dokładały kolejne przebiegi, każdy
aktualizując kod, ale nie ten akapit. Gdybym dopisał swoje dwie, rozjazd zmalałby o dwa i został.
**Rozwiązanie:** Cała linia zastąpiona **wartością wziętą z `package.json`**, a nie łatana o jedną
pozycję.
**Lekcja:** Gdy dokumentacja powtarza wartość, która żyje w pliku konfiguracyjnym, nie aktualizuj jej
przyrostowo — **wygeneruj z prawdziwego źródła i porównaj z tym, co jest**. Różnica jest miarą długu,
o którym nikt nie wiedział, i zwykle jest większa niż zmiana, którą właśnie wnosisz. Sygnał
ostrzegawczy: „dopiszę tu jeszcze jedną pozycję do listy" — to moment, w którym trzeba policzyć
całą listę, nie dodać element.

## 2026-08-18 — Kolumna NOT NULL zamieniła „jedną zamianę" w dwuetapową migrację
**Problem:** Plan etapu 4 brzmiał: zamień `data: { ownerId }` na `data: { workspaceId }` w ~250
miejscach, potem `DROP COLUMN`. Pomiar pokazał, że na **14 z 40 tabel `ownerId` jest NOT NULL**.
Na nich te dwa kroki nie są rozdzielne: zapis bez `ownerId` odrzuca baza, więc konwersja i migracja
musiałyby wejść JEDNYM commitem na 92 plikach. A każdy merge do `develop` jest wdrożeniem — byłby
to commit, po którym albo działa wszystko, albo nic.
**Rozwiązanie:** Faza podwójnego zapisu. Jedna funkcja (`wlasnoscDoZapisu`) zwraca `workspaceId`
policzony przez kod RAZEM z kolumnami własnościowymi, a miejsca zapisu rozpakowują wynik przez
`...`. Migracja zmienia potem **jedno ciało funkcji**, nie 250 miejsc.
**Lekcja:** Przed przepisaniem N miejsc sprawdź, czy stary i nowy nośnik danych mogą **współistnieć**.
Jeśli nie mogą (NOT NULL, UNIQUE, klucz obcy), to nie jest refaktor „N razy to samo", tylko migracja
dwuetapowa — i trzeba ją tak zaprojektować PRZED pierwszą zamianą. Rozpoznanie: policz, ile ze
zmienianych kolumn jest wymaganych. `nullable` znaczy „mogę przestać pisać", `NOT NULL` znaczy
„mogę przestać pisać dopiero razem z kolumną". Wskazówka projektowa: zwracaj **obiekt do rozpakowania**,
a nie pojedynczą wartość — wtedy zwężenie typu zwracanego nie dotyka miejsc użycia.

## 2026-08-18 — Cichą usterkę konwersji dało się zamienić w błąd bazy, bo istniało drugie źródło prawdy
**Problem:** Zamiana 250 miejsc zapisu ma jeden tryb awarii i jest cichy: pomyłka w argumencie
(`userId` kogoś innego, pominięty `teamId`) daje rekord w CUDZEJ przestrzeni. `tsc` widzi dwa
poprawne stringi, testy przechodzą, ekran się renderuje. Objaw pojawia się wtedy, gdy ktoś zobaczy
nie swoje dane. „Będę uważał" nie jest planem przy 92 plikach.
**Rozwiązanie:** W fazie podwójnego zapisu ta sama informacja jest w bazie **dwa razy** —
w `workspaceId` i w kolumnach własnościowych. Wyzwalacz (migracja 0240) zaczął je porównywać
i odrzucać rozjazd z komunikatem mówiącym, co się nie zgadza.
**Lekcja:** Gdy migracja tworzy przejściową **redundancję**, nie traktuj jej tylko jako kosztu —
to gotowy, darmowy inwariant do sprawdzania. Pytanie do zadania przy każdej takiej migracji: *czy
przez chwilę mam dwa niezależne nośniki tej samej prawdy, i czy mogę kazać bazie pilnować ich
zgodności?* Sprawdzenie stoi w BAZIE, nie w kliencie ORM: rozszerzenie klienta omijają zapisy
zagnieżdżone, surowy SQL, seedy i skrypty — wyzwalacza nie omija nic. Skutek uboczny, który też jest
lekcją: takie sprawdzenie czyni pewne stany NIEOSIĄGALNYMI, więc fixture'y testów, które te stany
celowo budowały, przestają się dać zbudować (u nas dwa) — to nie awaria testu, to sygnał, że asercję
trzeba przenieść na stan osiągalny.

## 2026-08-18 — Kosz przechowuje migawki, więc zmiana schematu sięga wstecz do zapisanych danych
**Problem:** Konwersja własności na przestrzenie wyglądała na zmianę wyłącznie w kodzie. `TrashItem`
trzyma jednak JSON utrwalony w chwili usunięcia rekordu, a migawki sprzed zmiany mają tylko
`ownerId`/`ownerTeamId`. Gdyby przywracanie czytało wyłącznie nową kolumnę, w dniu `DROP COLUMN`
każdy rekord leżący w koszu (retencja 30 dni, więc byłoby ich pełno) wróciłby z cudzą przestrzenią
albo bez niej — a operacja zgłaszałaby sukces.
**Rozwiązanie:** `przestrzenZMigawki`: najpierw przestrzeń z migawki, a gdy jej nie ma —
wyprowadzenie z kolumn własnościowych, tak jak robił to wyzwalacz. Migawki od teraz zapisują
`workspaceId`.
**Lekcja:** Przy usuwaniu kolumny wyszukaj miejsca, w których jej wartość jest **skopiowana poza
tabelę**: migawki kosza, kolejki zadań (payload), logi audytu, cache, eksporty, pola JSON. Tam nie
działa ani `tsc`, ani migracja danych, bo to nie są kolumny — a schemat tych kopii jest zamrożony
w chwili zapisu. Reguła kciuka: każde pole typu JSON/text trzymające „stan rekordu" to potencjalny
odczyt kolumny, której już nie ma, i wymaga ścieżki zgodności ze starym kształtem.

## 2026-08-18 — Bramka nie zna nazw, których jej nie podano
**Problem:** Po przepisaniu `where: { ownerId: userId }` na nowy helper `filtrMoichRekordow(userId)`
build padł na `check-ai-access`: dwa narzędzia odczytu asystenta „nie pokazują, jak zawężają wynik".
Zawężenie było na miejscu, i to ŚCIŚLEJSZE niż przedtem — ale bramka rozpoznaje mechanizmy z listy
wzorców tekstowych, a nowej nazwy na liście nie było.
**Rozwiązanie:** Wzorzec dopisany do listy z uzasadnieniem. Przy okazji bramka dopasowuje teraz
wzorce do KODU, nie do komentarzy (własna lekcja repo, tu jeszcze niezastosowana) — sprawdzone sondą:
plik, którego jedynym „mechanizmem" jest zdanie w komentarzu, jest odrzucany.
**Lekcja:** Zmieniając nazwę wspólnego mechanizmu, przeszukaj **bramki i skrypty** pod starą nazwę,
zanim uruchomisz build — inaczej bramka zgłosi „usunięto zabezpieczenie" tam, gdzie zostało
wzmocnione. To działa też w drugą stronę i jest groźniejsze: gdyby ta bramka miała regułę „ostrzegaj,
nie przerywaj", zawężenie mogłoby zniknąć naprawdę i nikt by nie zauważył. Bramka rozpoznająca
mechanizm po NAZWIE jest z definicji niepełna, więc jej lista jest częścią kontraktu refaktoru.

## 2026-08-17 — `NOT NULL` usunął siatkę bezpieczeństwa, o której istnieniu nikt nie pamiętał
**Problem:** Zaostrzenie `workspaceId` do NOT NULL miało być domknięciem porządku. Okazało się
zmianą zachowania w miejscu zupełnie niespodziewanym: w `rolaZWlasnosci` reguła „właściciel dostaje
`manager`" stała **pod** gałęzią liczącą rolę z przestrzeni, więc docierał do niej wyłącznie zasób
BEZ przestrzeni. Dopóki istniały sieroty, reguła po cichu ratowała każdy przypadek, w którym
przestrzeni zasobu nie było w kontekście dostępu użytkownika (np. brak wiersza `WorkspaceMember`).
Sieroty zniknęły — i razem z nimi ratunek: **właściciel przestawał być właścicielem**. Wyszło to
w teście kosztu dostępu, nie w żadnym teście uprawnień.
**Rozwiązanie:** Warunek własności przeniesiony NAD gałąź przestrzeni. Kontrola, że to nie
poszerzenie dostępu: tabela prawdy (20 komórek) bez jednej zmiany.
**Lekcja:** Kod nieosiągalny w typowym przepływie potrafi być **jedyną obroną w nietypowym**.
Usuwając stan (tu: „rekord bez przestrzeni"), nie pytaj tylko „co przestanie działać", ale też
**„co przestanie ratować"** — gałąź `else`, do której docierał wyłącznie usuwany stan, jest właśnie
takim kandydatem. Objaw bywa mylący: awaria pokazała się jako test WYDAJNOŚCI, bo to on jako jedyny
budował fixture bez pełnego lustra przestrzeni.

## 2026-08-17 — Kryterium wyjątku zbudowane z przykładów, a nie z reguły, jest za wąskie
**Problem:** Listę tabel, w których `workspaceId` zostaje nullowalne, zbudowałem z tego, co
zobaczyłem w danych: cztery tabele SŁOWNIKOWE z rekordami systemowymi. Reguła brzmiała „tabela
trzyma słownik". `Job` słownikiem nie jest, więc trafił do grupy zaostrzanej — i dziewięć testów
kolejki padło na `Null constraint violation`, bo zadanie systemowe nie ma właściciela, a więc i
przestrzeni.
**Rozwiązanie:** Kryterium przeformułowane z przykładu na własność: **„wiersz może nie mieć
właściciela"**. To pokrywa i słowniki, i kolejkę, i cokolwiek jeszcze przyjdzie.
**Lekcja:** Gdy piszesz listę wyjątków, nazwij **regułę**, a nie zbiór, który akurat widzisz.
Sprawdzian jest prosty: czy z samego kryterium potrafię rozstrzygnąć NOWĄ tabelę, nie zaglądając do
danych? Jeśli nie — kryterium jest opisem próbki, nie regułą. Druga połowa tej samej lekcji:
lista wyjątków ma się opierać na tym, co tabela **MOŻE** trzymać, a nie co trzyma dziś. `NoteGroup`
i `Tag` mają zero rekordów systemowych, ale model je dopuszcza — pierwszy taki rekord założony
przez administratora wywróciłby zapis na produkcji.

## 2026-08-17 — Domknięcie luki w wyzwalaczu zamieniło łagodną nieobecność w twardy błąd
**Problem:** Wyzwalacz wypełniający `workspaceId` tylko ODCZYTYWAŁ lustro; brak przestrzeni zostawiał
NULL. Po `NOT NULL` znaczyło to, że konto bez przestrzeni osobistej nie może utworzyć **niczego**,
więc nauczyłem wyzwalacz tworzyć brakującą przestrzeń. Poprawka wywróciła kolejkę zadań: `ownerId`
nie wszędzie jest kluczem obcym (`Job` trzyma zwykły tekst), więc wyzwalacz próbował wstawić
przestrzeń dla nieistniejącego konta i wywalał **cały zapis** na `Foreign key constraint violated`.
Przed poprawką ten sam przypadek był nieszkodliwy.
**Rozwiązanie:** Warunek `EXISTS (SELECT 1 FROM "User" …)` przed wstawieniem. Reguła: wyzwalacz
**leczy brak przestrzeni realnego właściciela, nie wymyśla właścicieli**.
**Lekcja:** Zamieniając „po cichu nic nie rób" na „napraw to", sprawdź, na ilu **różnych** ścieżkach
ta cichość była tolerowana. Kod obsługujący brak danych bywa jednocześnie kodem obsługującym dane
BŁĘDNE — i naprawa pierwszego zamienia drugie z drobiazgu w awarię zapisu. Szczególnie w wyzwalaczu,
bo tam koszt pomyłki płaci każdy zapis w tabeli, a nie tylko ścieżka, którą testowałeś.

## 2026-08-17 — Dwie bramki przestały widzieć swój przedmiot, bo filtrowały po `String?`
**Problem:** `check-workspace-fill.js` i test kompletności backfillu wybierały modele wyrażeniem
`workspaceId\s+String\?`. Etap 4 zdjął znak zapytania z 40 kolumn i obie kontrole zaczęły mierzyć
co innego niż miały: bramka zgłosiła „wyzwalacz na tabeli, której nie ma wśród modeli", test —
odwrotność tego samego. Rozluźnienie wzorca do `String\??` też było błędne: wpuściło trzy tabele
PLATFORMOWE (`DomainEvent`, `ResourceGrant`, `WorkspaceMember`), które mają `workspaceId` od
urodzenia jako prawdziwy klucz obcy.
**Rozwiązanie:** Filtr po tym, o co naprawdę chodziło: kolumna LUSTRZANA istnieje tam, gdzie jest
co lustrzać, czyli obok `ownerId`/`ownerTeamId`.
**Lekcja:** Bramka filtrująca po **składni** (`String?`) zamiast po **znaczeniu** psuje się przy
pierwszej zmianie tej składni — i psuje się cicho, bo nadal coś mierzy. Pisząc filtr, zapytaj, jaka
WŁASNOŚCIWOŚĆ odróżnia zbiór, który chcesz objąć; jeśli odpowiedzią jest cecha zapisu, a nie cecha
modelu, filtr jest tymczasowy, nawet jeśli nikt tego nie napisał.

## 2026-08-17 — „Zniknęła kolumna ze schematu" znaczyło: kontener się cofnął, a nie że kod jest zły
**Problem:** Po wznowieniu sesji `grep -c workspaceId prisma/schema.prisma` zwrócił **0**, choć baza
miała tę kolumnę w 45 tabelach, a bramka rozjazdu schematu świeciła na zielono. Wyglądało to na
dziurę w bramce — czyli na najgorszy możliwy błąd, bo bramka miałaby wtedy potwierdzać nieprawdę.
Prawdziwa przyczyna była zupełnie gdzie indziej: **kontener cofnął drzewo robocze** do commita
sprzed kilkunastu przebiegów (czwarty raz w tym projekcie). Bramka działała poprawnie — porównywała
stary schemat ze starymi migracjami i słusznie nie widziała rozjazdu.
**Rozwiązanie:** `git log --oneline -1` jako **pierwsza** komenda diagnostyczna, potem
`git fetch && git reset --hard origin/<gałąź>`, restart Postgresa (`pg_ctlcluster 16 main start`),
`prisma migrate deploy` i `prisma generate`. Nic nie przepadło, bo każde zadanie było wypchnięte na
zdalne repozytorium natychmiast po commicie.
**Lekcja:** Zanim uznasz, że **bramka kłamie** albo że kod jest zepsuty, sprawdź, **na czym w ogóle
pracujesz**. Objaw „plik nie zawiera tego, co na pewno tam wpisałem" ma w tym środowisku jedną
dominującą przyczynę i jest nią revert kontenera, a nie błąd w narzędziu. Sygnały rozpoznawcze:
zmiany zniknęły *hurtem* (nie jeden plik), baza cofnęła się do starszej migracji, a Postgres nie
odpowiada. Stąd druga część reguły, która już raz się opłaciła i opłaciła znowu: **pushuj po każdym
zadaniu**, nie na koniec sesji — zdalne repozytorium jest tu jedyną trwałą pamięcią.

## 2026-08-17 — Kopia zapasowa, której nie da się użyć: gdy klucz główny JEST kasowaną kolumną
**Problem:** Migracja 0233 archiwizuje `ownerId`/`ownerTeamId` przed etapem 4 zadania 11. Pierwsza
wersja zakładała, że każdy wiersz identyfikuje `"id"::text`. Padła na `NewsPref`
(`42703: column "id" does not exist`) — bo `NewsPref` nie ma `id`, jej **kluczem głównym jest samo
`ownerId`**. Poprawka na „czytaj klucz główny z `pg_index`" naprawiła zapis, ale przy testowaniu
procedury odtworzenia wyszło coś gorszego: dla `NewsPref` odtworzenie jest **niemożliwe z zasady**.
Po `DROP COLUMN "ownerId"` wiersz nie ma żadnej tożsamości — kopia zna wartość, ale nie ma po czym
dopasować ją z powrotem do wiersza.
**Rozwiązanie:** Identyfikator wiersza czytany z katalogu systemowego (`pg_index`), nazwy kolumn
klucza zapisywane w kopii (kolumna `klucz`), żeby kopia opisywała samą siebie. Dla `NewsPref`
dopisany **warunek wejścia w etap 4**: najpierw własny klucz główny (`id`) albo przejście na
`workspaceId`, dopiero potem `DROP COLUMN`. Do tego czasu jedynym odwrotem jest PITR całej bazy.
**Lekcja:** Zanim uznasz backup za zrobiony, zadaj pytanie **odwrotne** — nie „czy zapisałem dane",
tylko „po czym rozpoznam wiersz, gdy tych danych już nie będzie". Tabela, której klucz główny jest
kasowaną kolumną, jest nieodtwarzalna wierszami niezależnie od tego, jak dobrą ma się kopię.
Wychodzi to dopiero przy **przećwiczeniu odtworzenia**, nigdy przy pisaniu zapisu — więc procedurę
przywrócenia testuj naprawdę (`BEGIN … ROLLBACK` z prawdziwym `DROP COLUMN`), a nie opisowo.
Drobiazg dodatkowy z tej samej migracji: w `string_agg(x, ',' ORDER BY k.ord)` **nie ma przecinka
przed `ORDER BY`** — separator i klauzula sortująca to jeden argument.

## 2026-08-17 — Test odtworzenia z bazy przechodzi także wtedy, gdy nic nie odtworzył
**Problem:** Sprawdzenie procedury przywracania własności („porównaj stan po odtworzeniu z migawką
sprzed `DROP COLUMN`") wyszło na zielono: 0 rozbieżności. Wyglądało na dowód. Nie było nim —
większość wierszy w tabelach słownikowych ma `ownerId IS NULL` (rekordy systemowe), a „przywrócony
NULL" i „nigdy nie tknięty NULL" są nierozróżnialne. Zielony wynik obejmowałby też sytuację, w
której krok odtwarzający w ogóle się nie wykonał.
**Rozwiązanie:** Ta sama próba puszczona drugi raz z **celowo pominiętym** krokiem odtworzenia.
Zgłosiła dokładnie 2 rozbieżności — tyle, ile było wierszy z niepustym właścicielem. Dopiero to
dowiodło, że porównanie patrzy na dane. W runbooku dopisane ostrzeżenie: przy tabelach czysto
systemowych kontroluj dodatkowo licznik przywróconych wierszy.
**Lekcja:** Kolejny wariant reguły, która w tym projekcie wraca uparcie: **zielony wynik potrafi
dowodzić, że kod się nie wykonał**. Przy porównaniach stanu bazy dochodzi specyficzna pułapka —
`NULL` jest jednocześnie najczęstszą wartością i wartością nieodróżnialną od „nic nie zrobiono".
Zanim uznasz porównanie za dowód, policz, **ile wierszy w próbie ma w ogóle niepustą wartość**;
jeśli zero, próba nie sprawdza niczego.

## 2026-08-15 — `tsc -p tsconfig.test.json` NIE jest tym samym sprawdzeniem co `next build`
**Problem:** Nowy plik platformy iterował po zbiorze (`for (const s of kanaly.get(n) ?? [])`).
`npx tsc --noEmit -p tsconfig.test.json` przechodził czysto, testy jednostkowe zielone, wszystkie
bramki zielone — a `next build` **padł**: *„Type 'never[] | Set<Sluchacz>' can only be iterated
through when using the '--downlevelIteration' flag or with a '--target' of 'es2015' or higher"*.
**Rozwiązanie:** Przyczyna jest w konfiguracji: `tsconfig.test.json` ustawia `target: ES2022` (bo
testy chodzą w Node), a **główny `tsconfig.json` nie ustawia `target` w ogóle** — więc przy
sprawdzaniu typów przez `next build` obowiązuje domyślny ES5 i iteracja po `Set`/`Map` jest błędem.
Poprawka: `forEach` zamiast `for…of` po zbiorach (zgodnie z tym, co i tak robi reszta repo).
**Lekcja:** W repo są **dwie konfiguracje TypeScriptu o różnej surowości**, a bramka
`check:test-types` sprawdza tę **łagodniejszą pod tym względem**. Przed uznaniem zmiany w kodzie
aplikacji za gotową trzeba odpalić `npx tsc --noEmit` **bez `-p`** (główna konfiguracja) albo pełny
`next build` — samo `check:test-types` na zielono nic tu nie dowodzi. Dotyczy to zwłaszcza iteracji
po `Set`/`Map`, generatorów i `for…of` po `NodeList`.
I druga rzecz, proceduralna: **`tail -3` na logu builda potrafi ukryć porażkę** — Next wypisuje
tabelę tras i podsumowanie także wtedy, gdy build padł wcześniej. Wynik czytaj z **kodu wyjścia**,
nie z ostatnich linii.

## 2026-08-15 — Zanim zbudujesz element z diagramu, zapytaj PO CO on tam jest
**Problem:** Łańcuch czasu rzeczywistego z dokumentu docelowego przewidywał w środku
`LISTEN/NOTIFY` albo Redis Pub/Sub. Odruch: skoro jest na diagramie, trzeba to zbudować — a oba
warianty wymagają surowego połączenia poza Prismą, czyli **nowej zależności** w projekcie, który
świadomie ich unika.
**Rozwiązanie:** Pytanie „po co ten element tam stoi" dało jedną odpowiedź: **żeby worker
z instancji A dosięgnął karty podłączonej do instancji B**. Omnia chodzi na jednej instancji, więc
ten powód jeszcze nie istnieje. Zamiast zależności — szyna rozgłoszeniowa w procesie, ograniczenie
**nazwane wprost** w kodzie i w `docs/devops/`, oraz wskazane jedno miejsce podmiany, gdy pojawi się
druga instancja. Reszta łańcucha (worker, trasa, klient) jest wtedy nietknięta.
**Lekcja:** Diagram architektury pokazuje **rozwiązanie**, nie **problem**. Element bywa tam
z powodu, którego u nas jeszcze nie ma — i wtedy zbudowanie go jest kosztem bez zysku. Zanim
dołożysz zależność „bo tak jest w projekcie docelowym", nazwij **problem**, który ona rozwiązuje,
i sprawdź, czy ten problem u ciebie występuje. Jeśli nie: zbuduj wariant prostszy, **nazwij
ograniczenie** (nie przemilcz!) i wskaż miejsce podmiany.

## 2026-08-15 — Odpytywanie awaryjne nie jest długiem, tylko siatką
**Problem:** Zadanie brzmiało „usuń `setInterval`". Kuszące było usunąć je całkiem — skoro jest
strumień, odpytywanie to przecież relikt.
**Rozwiązanie:** Zostało, ale zwolniło z 45 sekund do **5 minut** — i jest opisane jako rozwiązanie
docelowe, nie tymczasowe. Pokrywa **trzy różne awarie naraz**: brak `EventSource` (stara
przeglądarka, proxy), zerwany strumień, którego nie udało się wznowić, oraz **wiele instancji
serwera**, gdzie szyna w procesie z definicji nie dosięgnie cudzej karty.
**Lekcja:** Gdy zastępujesz mechanizm zgrubny (częste odpytywanie) precyzyjnym (wypychanie),
zachowaj ten pierwszy **z rozrzedzoną częstotliwością** jako siatkę. Koszt spada 6-krotnie, a układ
zyskuje własność wartą więcej niż oszczędność: **awaria nowego mechanizmu przestaje być awarią
aplikacji**. Warto to zapisać wprost w komentarzu, bo inaczej ktoś potraktuje pozostawiony interwał
jako niedokończoną robotę i usunie go „porządkując".

## 2026-08-15 — Bramka czytająca plik czyta też KOMENTARZE o kodzie
**Problem:** Bramka miała sprawdzać, że subskrybent buduje klucz idempotencji z `event.id` — bo tylko
ta wartość jest stabilna między ponowieniami. Sonda negatywna (podmiana klucza na `Date.now()`)
**nie zaczerwieniła** bramki. Powód: wzorzec `/event\.id/` trafiał w **komentarz** nad funkcją,
który wyjaśniał, że klucz ma pochodzić z `event.id`. Bramka potwierdzała dokumentację, nie kod —
i przepuściłaby subskrybenta, który robi dokładnie odwrotnie, niż opisuje jego własny komentarz.
**Rozwiązanie:** Usuwanie komentarzy (`/* */` i `//`) z treści pliku **przed** dopasowaniem wzorców.
Jedna linijka; sonda po niej działa.
**Lekcja:** Bramka tekstowa widzi cały plik, a im lepiej opisujemy kod, tym więcej w nim zdań
zawierających dokładnie te frazy, których bramka szuka. **Im staranniejsza dokumentacja, tym
łatwiej bramka staje się ślepa.** Każdą bramkę szukającą wzorca w kodzie trzeba albo odpalić na
treści bez komentarzy, albo sprawdzić sondą, że komentarz jej nie zaspokaja — a to drugie i tak
sprowadza się do tego pierwszego.

## 2026-08-15 — „Co najmniej raz" znaczy, że ponowienie NA PEWNO nastąpi
**Problem:** Przy dostarczaniu zdarzeń trzeba wybrać, kiedy oznaczyć zdarzenie jako dostarczone:
przed wywołaniem subskrybenta czy po. Wygląda to na szczegół implementacyjny i łatwo wybrać „przed",
bo jest prostsze (jedno zapytanie, brak stanu pośredniego).
**Rozwiązanie:** Wypisanie obu skutków obok siebie rozstrzyga sprawę w jednym spojrzeniu.
Oznaczenie **przed** znaczy, że awaria w oknie **gubi zdarzenie** — reakcja nigdy nie nastąpi
i nikt się nie dowie. Oznaczenie **po** znaczy, że awaria **ponawia** — reakcja wykona się dwa razy.
Drugie da się unieszkodliwić (klucz idempotencji), pierwszego nie da się nawet wykryć.
**Lekcja:** Przy każdym „wykonaj i odhacz" okna między jednym a drugim **nie da się zamknąć**,
jeśli obie operacje piszą osobnymi transakcjami. Nie wybiera się więc między „poprawnie" a
„niepoprawnie", tylko **po której stronie ma leżeć błąd**. Reguła: wybierz stronę, której skutek
da się wykryć i naprawić. I potraktuj wynikający z tego wymóg (tu: idempotencja subskrybenta)
jako część mechanizmu — pilnowaną maszynowo — a nie jako zalecenie w dokumentacji, bo ponowienie
nie jest sytuacją wyjątkową, tylko pewną.

## 2026-08-15 — Typ strukturalny nie zabrania niczego, dopóki nie zabroni PRZEZ NADMIAR
**Problem:** Emisja zdarzenia domenowego miała być niemożliwa poza transakcją — miał to wymuszać
typ: `emitDomainEvent(tx: Prisma.TransactionClient, …)`. Sonda pokazała, że
`emitDomainEvent(prisma, …)` **kompiluje się bez ostrzeżenia**. `Prisma.TransactionClient` to
`PrismaClient` **pomniejszony** o kilka metod, a w typowaniu strukturalnym obiekt z **nadmiarem**
pól jest przypisywalny do typu, który ma ich mniej. Zakaz „przyjmuj tylko węższe" nie działa,
bo szersze **spełnia** węższe.
**Rozwiązanie:** Odwrócenie warunku — zamiast wymagać obecności czegoś, zabronić obecności:
`Prisma.TransactionClient & { $transaction?: never }`. Pełny klient **ma** `$transaction`
(funkcja nie jest przypisywalna do `never`), więc odpada; prawdziwy `tx` tej metody **nie ma**,
więc przechodzi. Sprawdzone w obie strony: sonda z globalnym klientem → `TS2345`, sonda z `tx` → czysto.
**Lekcja:** W TypeScripcie „ten typ jest węższy" **nie znaczy** „szerszy zostanie odrzucony" — jest
dokładnie odwrotnie. Żeby odciąć nadzbiór, trzeba nazwać pole, które **ma tylko on**, i zabronić go
przez `?: never`. I szerzej: **zanim uwierzysz, że typ czegoś pilnuje, napisz plik, który tę regułę
łamie, i sprawdź, czy `tsc` faktycznie krzyczy.** Trzy linijki sondy, a różnica między zakazem
a życzeniem. Osobno warte zapamiętania: gdy kryterium akceptacji okazuje się niespełnione, pierwszym
odruchem powinno być **znalezienie rozwiązania**, a nie obniżenie kryterium do tego, co już działa.

## 2026-08-15 — Test, który NAŚLADUJE kod, dowodzi tylko tego, że naśladuje
**Problem:** Producent zdarzeń w Kuchni miał emitować **jedno** zdarzenie na spis spiżarni, a nie
jedno na pozycję (sto pozycji = jedna czynność użytkownika). Był na to test integracyjny i był
zielony. Test mutacyjny — przeniesienie emisji **do wnętrza pętli** w prawdziwej akcji — **nie
zaczerwienił niczego**. Powód: test nie wołał `bulkSetPantryQuantities`, tylko **odwzorowywał
kształt** tej pętli u siebie (bo prawdziwa akcja wymaga sesji, a repo nie ma wzorca jej podstawiania).
Test sprawdzał więc własną kopię, która oczywiście była poprawna.
**Rozwiązanie:** Nie dało się tego naprawić testem bez wprowadzania nowego wzorca (poza zakresem),
więc własność przejęła **bramka**: producent deklaruje w manifeście `ladunek: "pojedynczy" |
"zbiorczy"`, a przy `zbiorczy` bramka zabrania emisji z wnętrza pętli — i patrzy przy tym na
**prawdziwy plik producenta**. Test został, ale z uczciwie nazwanym zakresem („sprawdza mechanizm,
nie akcję") i komentarzem, dlaczego nie sięga dalej.
**Lekcja:** Test, który **odtwarza** logikę zamiast ją **uruchamiać**, jest wart tyle co komentarz.
Rozpoznaje się go po tym, że w ciele testu stoi kopia pętli, warunku albo wyliczenia z produkcji.
Gdy prawdziwej ścieżki nie da się zawołać (sesja, sieć, framework), uczciwe są dwa ruchy naraz:
**nazwać granicę testu wprost** i **przenieść pilnowanie własności tam, gdzie widać prawdziwy kod**
— zwykle do bramki statycznej. Milczące zostawienie kopii to najgorsza opcja: wygląda na pokrycie.

## 2026-08-15 — Test przechodzi także wtedy, gdy reguła jest zepsuta
**Problem:** Do 16 wyprowadzonych reguł powstały 124 testy, wszystkie zielone, z przypadkami
brzegowymi w każdym pliku. Wyglądało to na komplet. Sprawdzenie mutacyjne — **zepsuj regułę
i zobacz, czy test zauważy** — wykazało, że **3 z 11 mutacji przechodzą niezauważone**: próg klasy
A w analizie ABC (`80` → `90`), próg klasy B (`95` → `99`) i brzeg daty końca w terminie opieki
(`>` → `>=`). Po naprawie i rozszerzeniu zestawu na 24 mutacje wyszła jeszcze jedna: usunięcie
`Math.round` z jednego pola odcisku pogody.
**Rozwiązanie:** We wszystkich czterech przypadkach winna była **fikstura, nie asercja**. ABC:
wartości 800/150/50 dają udziały narastające 80/95/100, czyli **dokładnie w progach** — przesunięcie
progu nic nie zmienia. Trzeba wartości, które wypadają **pomiędzy** starym a nowym progiem (85 %).
Data końca: termin wypadał o 10:00, a `endDate` ustawiono na 23:59, więc `>` i `>=` dawały to samo —
trzeba równości **co do milisekundy**. Odcisk: fikstura miała temperatury całkowite, a zaokrąglanie
liczby całkowitej niczego nie zmienia — trzeba wartości ułamkowych.
**Lekcja:** „Test brzegowy" to nie ten, który ma w nazwie brzeg, tylko ten, którego **fikstura leży
na brzegu**. Przy każdym progu liczbowym dobierz dane tak, żeby przesunięcie progu **zmieniło
wynik** — inaczej test opisuje regułę, zamiast jej pilnować. Jedyny tani sposób, żeby to sprawdzić,
to zepsuć regułę i zobaczyć czerwień; robi się to w minutę, a przy progach (80/95, `>` vs `>=`,
zaokrąglenia) wychodzi zaskakująco często.

## 2026-08-15 — Reguła w pliku `"use server"` jest niesprawdzalna z przyczyn STRUKTURALNYCH
**Problem:** W plikach akcji siedziało **55 funkcji pomocniczych**, z których **ani jedna** nie miała
testu — w tym rzeczy o cichej cenie pomyłki: znak salda wg rodzaju elementu portfela, normalizacja
godzin podania leku, granice okresu rozliczeniowego. Wyglądało to na niedbalstwo. Nie było.
**Rozwiązanie:** Plik oznaczony `"use server"` **nie może wyeksportować niczego poza funkcją
asynchroniczną** — a reguła biznesowa asynchroniczna nie jest, bo tylko liczy. Taka reguła jest więc
**przymusowo prywatna**: fizycznie nie ma jak wejść do testu. Wyprowadzenie jej do zwykłego pliku
(`modules/<x>/domain/`) rozwiązuje problem w całości; sama zmiana miejsca wystarcza.
**Lekcja:** Kontrast dowodzi, że to struktura, nie dyscyplina: reguły, które **zdołały** trafić do
`modules/*/lib/`, mają testy w **dwóch przypadkach na trzy**; reguły uwięzione w plikach akcji — w
**zero na 55**. Zanim uznasz brak testów za kwestię nawyków, sprawdź, czy kod w ogóle **da się**
zaimportować. Gdy jakiejś warstwy nikt nie testuje, pierwsze pytanie brzmi „czy się da", a nie
„czemu nikt nie chce".

## 2026-08-15 — Licznik widzi tylko to, co ma nazwę
**Problem:** Bramka miała zamrozić dług, licząc funkcje pomocnicze w plikach akcji (wzorcem zapadki
z 068). Licznik pokazywał 55 i po wyprowadzeniu 21 reguł zszedł dokładnie do 34 — wyglądało to na
komplet. Przy ręcznym sprawdzaniu modułów zaklasyfikowanych jako „bez reguł" w Magazynowaniu
znalazła się klasyfikacja **ABC** (progi 80/95 od udziału narastającego), martwy zapas i trend
ruchów — wszystko pisane **wprost w ciele akcji, bez nazwy**. Licznik ich nie widział i nigdy nie
zobaczy, bo wzorzec szuka `^function `.
**Rozwiązanie:** Reguły wyprowadzone razem z resztą; granica pomiaru **zapisana w manifeście
i w specyfikacji** („zapadka liczy pomocniki nazwane"), a nie przemilczana. Dodatkowo: kandydaci na
„bez reguł" sprawdzeni ręcznie, bo to jedyny sposób, w jaki to wyszło.
**Lekcja:** Licznik mierzy **swój wzorzec**, nie zjawisko. „Zeszło do zera" znaczy „mój wzorzec nic
już nie łapie" — a to co innego niż „problemu nie ma". Przy każdej zapadce trzeba wypisać wprost,
czego **nie** obejmuje, i sprawdzić ręcznie przynajmniej kilka przypadków sklasyfikowanych jako
puste. Pozycja „nie ma tu nic" bez podania, **gdzie w takim razie to jest**, to nie rozstrzygnięcie,
tylko brak sprawdzenia.

## 2026-08-15 — Pierwszy test starej reguły utrwala, a nie poprawia
**Problem:** Pierwszy test pierwszej wyprowadzonej reguły zapalił się na czerwono: `normalizeDays("")`
zwraca `"0"`, czyli **niedzielę**, bo `Number("")` to zero. Pusty wybór dni zapisuje nawyk jako
„tylko w niedziele". Odruch: poprawić przy okazji, skoro i tak dotykam pliku.
**Rozwiązanie:** Test **utrwala stan zastany** z komentarzem wyjaśniającym, dlaczego jest podejrzany,
a obserwacja trafia do manifestu i dziennika. Przebieg przenosił reguły, nie zmieniał zachowania —
a to, czym ma być pusty wybór („codziennie" czy „bez wskazania"), jest decyzją właściciela.
**Lekcja:** Test pisany do **istniejącej** reguły ma najpierw opisać, co ona **robi**, a nie co
**powinna robić**. Wmieszanie poprawki w refaktor daje zmianę zachowania schowaną w commicie
„przeniesienie kodu" — najgorszy możliwy nośnik. Utrwalony dziwny przypadek jest tani i sam się
upomni: gdy ktoś to naprawi, test zapali się na czerwono i **o to chodzi**.

## 2026-08-12 — Zielony test, który dowodził, że nowy kod się NIE uruchomił
**Problem:** Po przełączeniu rozstrzygania dostępu z pary `ownerId`/`ownerTeamId` na `workspaceId`
tabela prawdy (25 komórek, punkt odniesienia z poprzedniego przebiegu) przeszła **w całości** za
pierwszym razem. Wyglądało to na dowód równoważności. Było odwrotnie: fixture tworzy użytkowników
wprost przez Prismę, z pominięciem zdarzenia logowania, więc **nie mieli przestrzeni osobistych**.
Wyzwalacz wypełniający `workspaceId` nie miał czego wpisać, kolumna zostawała pusta, a nowa logika
schodziła **gałęzią awaryjną** na starą regułę. Test mierzył stary mechanizm i potwierdzał, że jest
zgodny sam ze sobą.
**Rozwiązanie:** Fixture zakłada przestrzenie (`ensurePersonalWorkspace`, `syncTeamWorkspace`)
**przed** utworzeniem zasobów. Dopiero wtedy wyszła prawdziwa różnica — jedna komórka, dokładnie ta
przewidziana w specyfikacji.
**Lekcja:** Gdy zmiana ma **warunkową gałąź awaryjną** („użyj nowego, a jeśli danych brak — starego"),
zielony test nie odróżnia „nowe działa poprawnie" od „nowe się nie wykonało". Przed uwierzeniem
w wynik trzeba sprawdzić, **którą gałęzią poszedł** — najprościej: zepsuć nową ścieżkę i zobaczyć,
czy test w ogóle zauważy. Fixture, który omija normalną drogę powstawania danych (tworzy rekordy
wprost, z pominięciem zdarzeń), będzie systematycznie trafiał w gałąź awaryjną.

## 2026-08-12 — Kompilator nie widzi BRAKU pola opcjonalnego
**Problem:** Nowa nullowalna kolumna (`workspaceId`) musiała być odtąd wypełniana przy każdym
tworzeniu rekordu. Pierwszy odruch — dopisać ją w miejscach zapisu — rozbił się o liczby: 224
wywołania `create`/`createMany`/`upsert` w 75 plikach. Gorzej: takiej zmiany **nie da się
sprawdzić kompilatorem**. TypeScript zgłosi pole ZŁEGO typu, ale pole opcjonalne, którego po prostu
NIE MA, jest dla niego poprawne. Pominięcie w jednym z 224 miejsc byłoby całkowicie bezobjawowe.
Drugi odruch — rozszerzenie klienta Prismy (`$extends`) — wygląda na „jedno miejsce", ale widzi
tylko zapisy przez ten egzemplarz klienta i tylko na najwyższym poziomie: omijają je zapisy
zagnieżdżone, surowy SQL, seedy w migracjach i każdy przyszły `new PrismaClient()`.
**Rozwiązanie:** Wyzwalacz `BEFORE INSERT` w bazie — jedna funkcja PL/pgSQL, wyzwalacz na każdej
objętej tabeli. Nie omija go żadna ścieżka zapisu, bo działa poniżej ORM-a. Bramka pilnuje wobec
tego **kompletności mechanizmu** (czy każda tabela z kolumną ma wyzwalacz), a nie miejsc wywołań —
bo wywołań nie da się pominąć. Jedna funkcja obsługuje tabele z różnym zestawem kolumn własności
dzięki `to_jsonb(NEW)`: brakujący klucz to po prostu `NULL`, bez dynamicznego SQL-a.
**Lekcja:** Kiedy wymaganie brzmi „to ma być odtąd ustawiane wszędzie", zadaj najpierw pytanie
**czym zmierzysz pominięcie**. Jeśli odpowiedź brzmi „kompilatorem", sprawdź, czy kompilator to
naprawdę widzi — przy polu opcjonalnym nie widzi. Wtedy przenieś mechanizm o poziom niżej (tam,
gdzie ominięcie jest niemożliwe) zamiast rozsiewać go po miejscach wywołań i pilnować bramką, kto
zapomniał. Wykrywanie pominięcia jest gorsze od uczynienia go niemożliwym.

## 2026-08-12 — Kolumna w Prismie łamie komponent typowany na CAŁY model
**Problem:** Migracja 054 dokładała `workspaceId` do 45 modeli — zmiana wyłącznie w bazie, bez
jednej linii w kodzie aplikacji. `next build` padł mimo to: `TagChip` deklarował `tag: Tag`, a
`TagsManager` rysuje podgląd etykiety, **której jeszcze nie ma w bazie**, więc podaje literał
obiektowy. Nowa kolumna weszła do wygenerowanego typu i literał przestał go spełniać.
Wcześniejsze bramki tego nie złapały: build odpala `tsc --noEmit -p tsconfig.test.json` (typy
TESTÓW), a typy aplikacji sprawdza dopiero `next build` — czyli najdroższy krok całego łańcucha.
**Rozwiązanie:** Zamiast dopisać `workspaceId: null` do literału, zwężono propsa do
`Pick<Tag, "name" | "color">` — komponent czytający dwa pola nie ma powodu wymagać kompletu kolumn
tabeli. Dopisanie pola załatałoby jedno wystąpienie i wróciłoby przy każdej następnej kolumnie
(w tym w etapie 4, gdy `workspaceId` stanie się wymagane).
**Lekcja:** Dwie rzeczy. (1) **„Zmiana tylko w schemacie" nie istnieje**, dopóki typy Prismy są
propsami komponentów — planując migrację kolumny, policz na to, że coś się nie skompiluje.
(2) Przed uruchomieniem pełnego builda odpal `npx tsc --noEmit` (czyli `npm run typecheck`) —
łańcuch bramek go NIE zawiera, a wywala się na tym samym błędzie kilka minut później.

## 2026-08-12 — Ręcznie pisany SQL musi sam uwzględnić `@@map`
**Problem:** Migracja 0227 dokładała `workspaceId` do 45 tabel: instrukcje `ADD COLUMN` wygenerowała
Prisma, a 73 `UPDATE`-y backfillu pisałem ręcznie — po nazwach **modeli**. Migracja padła na
`relation "ProjectGroup" does not exist`. `ProjectGroup` jest zmapowany przez `@@map("TaskView")`
i jest jedynym takim modelem w całym schemacie, więc 44 tabele przeszły, a wywaliła się jedna.
Naprawa wymagała jeszcze skasowania nieudanego wiersza w `_prisma_migrations`, bo `migrate deploy`
uznaje migrację za rozpoczętą i nie próbuje jej ponownie.
**Rozwiązanie:** Backfill przepisany po nazwach TABEL (parser czyta `@@map` ze schematu), a test
kompletności wyprowadza listę tabel ze `schema.prisma` — również z uwzględnieniem `@@map` — zamiast
powtarzać ją ręcznie.
**Lekcja:** Kiedy w jednym pliku migracji mieszasz DDL z `prisma migrate diff` z własnym SQL-em,
mieszasz **dwie konwencje nazw**. Prisma pisze tabelami, ty piszesz tym, co masz przed oczami
w schemacie. Zanim napiszesz ręczny `UPDATE`/`INSERT` na wielu tabelach, sprawdź
`grep '@@map' prisma/schema.prisma` — jeden wyjątek na kilkadziesiąt tabel jest niewidoczny przy
przeglądaniu, a widoczny dopiero jako błąd wdrożenia.

## 2026-08-12 — `React.cache` poza kontekstem żądania nie degraduje się, tylko rzuca
**Problem:** Cache per żądanie dla sprawdzania dostępu oparliśmy na `React.cache`, zakładając (i tak
zapisując w planie), że poza kontekstem żądania „degraduje się do zwykłego wywołania". Nieprawda:
w środowisku bez runtime'u Reacta `cache` **nie jest nawet funkcją** i pierwsze wywołanie kończy się
`(0 , import_react.cache) is not a function`. Ponieważ `requireAccess` siedzi na ścieżce każdego
sprawdzenia dostępu, oznaczałoby to wywalenie **każdego zadania w tle i każdego skryptu**.
**Rozwiązanie:** Degradacja napisana wprost: `perRequest(fn)` używa `React.cache`, gdy ta istnieje,
a w przeciwnym razie zwraca funkcję niezmienioną. Wyszło przy pierwszym uruchomieniu testu tabeli
prawdy — czyli dokładnie tam, gdzie plan wymagał sprawdzenia zachowania POZA żądaniem.
**Lekcja:** „Degraduje się łagodnie" jest **założeniem, nie właściwością** — dopóki nie zobaczysz go
na czerwono, jest zdaniem o tym, jak chciałbyś, żeby biblioteka działała. Reguła praktyczna: jeśli
mechanizm ma działać w dwóch środowiskach (żądanie i skrypt/zadanie w tle), test musi go uruchomić
w **obu**, a nie tylko w tym, w którym i tak nic by się nie stało.

## 2026-08-12 — Opcjonalny identyfikator w guardzie = ciche wracanie do starej reguły
**Problem:** Przełączając `assertTaskAccess` na wspólne sprawdzanie dostępu, dałem nowej sygnaturze
`id?: string` z fallbackiem do starej logiki „gdy brak identyfikatora". Wyglądało to na ostrożność,
a było **dziurą w migracji**: każdy wołający, którego `select` nie pobiera `id` (a takich się nie
widzi — kompilator ich nie zgłasza), po cichu jechałby starą regułą i nowy mechanizm nigdy by się
tam nie uruchomił. Nie objawiłoby się to niczym, dopóki obie reguły dają ten sam wynik.
**Rozwiązanie:** `id` **wymagane** w typie. Kompilator natychmiast wskazał jedno takie miejsce
(`reorderTask` z `select` bez `id`), które inaczej zostałoby na starej ścieżce.
**Lekcja:** Przy przełączaniu mechanizmu **fallback do starego zachowania jest wrogiem, nie siatką
bezpieczeństwa** — zamienia niekompletną migrację w stan nierozróżnialny od kompletnej. Jeśli nowa
ścieżka czegoś wymaga, wymagaj tego w typie i pozwól kompilatorowi wypisać listę miejsc do poprawy.

## 2026-08-12 — `migrate diff` dopisany do migracji bez czytania skasował indeksy z surowego SQL-a
**Problem:** Migrację nowych tabel wygenerowałem przez
`prisma migrate diff --from-migrations … --to-schema-datamodel` i **dopisałem jej wyjście do pliku
bez przeczytania**. Diff nie zawierał tylko nowych tabel: dorzucił `DROP INDEX "Note_title_trgm_idx"`,
`DROP INDEX "Note_content_trgm_idx"` oraz trzy `ALTER COLUMN "updatedAt" DROP DEFAULT` na
niezwiązanych tabelach. Powód jest logiczny: te obiekty istnieją **tylko w migracjach pisanych
surowym SQL-em**, bo `schema.prisma` nie umie ich wyrazić — więc z punktu widzenia diffa schemat
„nie chce ich mieć". Skutek na produkcji byłby cichy i kosztowny: wyszukiwanie notatek spada
z indeksu GIN na skan sekwencyjny, a nikt tego nie zauważa poza wolniejszą stroną.
**Objaw, który mnie zmylił:** dwa testy `notesFts.integration` zaczęły padać. Wziąłem to najpierw za
stan lokalnej bazy i **odtworzyłem indeksy ręcznie** zamiast szukać przyczyny — po czym przy
następnym `migrate deploy` zniknęły znowu. Dopiero `grep "DROP INDEX" prisma/` pokazał sprawcę: moją
własną, świeżo napisaną migrację.
**Rozwiązanie:** Pięć niezamówionych instrukcji usunięte, a w migracji został komentarz **wymieniający
je z nazwy** wraz z powodem, dla którego ich tam nie ma. Pełny cykl przeliczony od zera (usunięcie
tabel + wpisu w `_prisma_migrations` + `migrate deploy`) z jawnym sprawdzeniem, że indeksy trigramowe
**przeżywają** migrację.
**Lekcja:** `migrate diff --to-schema-datamodel` to **propozycja doprowadzenia bazy do schematu**, a
nie „DDL mojej zmiany". Wszystko, co żyje wyłącznie w surowym SQL-u — a więc dokładnie to, co jest
wypisane w `src/lib/db/schema-drift-allowed.json` — diff zaproponuje **skasować**. Zasada: po
wygenerowaniu DDL przeczytaj go w całości i zostaw wyłącznie instrukcje dotyczące swojej zmiany;
`grep -E "^(DROP|ALTER)"` na nowej migracji zajmuje sekundę i wyłapuje to od razu. Druga lekcja:
**padający test to hipoteza o przyczynie, a nie stan środowiska do obejścia** — naprawa objawu
(odtworzenie indeksów) ukryła defekt na jeden cykl.

## 2026-08-12 — Bramka rozjazdu schematu milczała dokładnie tam, gdzie była potrzebna
**Problem:** `check:schema-drift` tworzy bazę cienia poleceniem `CREATE DATABASE` i toleruje błąd
tylko wtedy, gdy jego treść zawiera „already exists". Rola bez uprawnienia `CREATEDB` dostaje jednak
`permission denied to create database` **także wtedy, gdy baza cienia już istnieje** (założona przez
administratora). Bramka uznawała to za „nie da się przygotować cienia" i **pomijała całą kontrolę**,
kończąc się sukcesem. Efekt: w środowisku o ograniczonych uprawnieniach — czyli tym, w którym rozjazd
najłatwiej przeoczyć — bramka nie sprawdzała niczego, a build świecił na zielono.
**Rozwiązanie:** Zamiast ufać treści błędu, sprawdzamy stan faktyczny: jeśli `CREATE DATABASE` się nie
udało, próbujemy **połączyć się z bazą cienia**. Połączenie działa → jedziemy dalej; nie działa →
dopiero wtedy pomijamy. Po poprawce bramka po raz pierwszy realnie się uruchomiła i **od razu
wyłapała**, że wygenerowana migracja kasuje indeksy trigramowe (wpis wyżej).
**Lekcja:** Bramka, która potrafi się „pominąć", musi mieć powód pominięcia **sprawdzony, a nie
wywnioskowany z komunikatu błędu**. Komunikat opisuje jedną nieudaną próbę, nie stan świata. I ogólniej:
gdy bramka kończy się słowem „pominięty", to nie jest zielone — to jest brak pomiaru, i warto
policzyć, jak często tak kończy.

## 2026-08-11 — Wspólny rejestr leniwych loaderów też jest plikiem zbiorczym
**Problem:** Wkłady modułów do migawki pulpitu wpięliśmy polem `dashboard` w `module.server.ts` —
tak jak `ai`, `jobs` i `calendar`. Graf kompilacji strony głównej urósł z **1889 do 2117 modułów**,
mimo że nowego kodu doszło jedenaście małych plików. Powód: `MODULE_SERVER` to obiekt **czterech
leniwych loaderów na moduł**, a webpack w trybie dev kompiluje cele `import()` osiągalne ze
statycznie zaimportowanego pliku. Pulpit, importując rejestr **dla jednego pola**, wciągnął
egzekutory asystenta i handlery zadań w tle siedemnastu modułów, których nie wywołuje ani razu.
**Rozwiązanie:** Własny korzeń kompozycji dla tej jednej troski — `src/lib/dashboardContributors.ts`
z jedenastoma leniwymi importami i bez pozostałych trzech pól. Graf: **1903**, czyli +14 wobec stanu
sprzed zmiany — dokładnie tyle, ile doszło nowych plików. Pole `dashboard` zniknęło z
`ModuleServerContributions`, a wpięcie pilnuje bramka `check:module-registry` **w obie strony**.
**Lekcja:** To ta sama lekcja co „kontrakt modułu jest barrelem", tylko **piętro wyżej**: każdy
wspólny obiekt zbierający leniwe loadery **wielu trosk** jest plikiem zbiorczym. Konsument jednej
troski płaci grafem za wszystkie. Jeśli korzeni kompozycji jest kilka (asystent, zadania, kalendarz,
pulpit), każdy powinien sięgać po **swoje** wkłady, a nie po wspólny rejestr. Diagnoza zawsze ta
sama: `next dev` i liczba modułów per trasa.

## 2026-08-11 — Zrzut ze skryptu nie jest dowodem, gdy kod czyta użytkownika z sesji
**Problem:** Do porównania „przed/po" przebudowie pulpitu zrobiliśmy zrzut migawki skryptem
uruchamiającym wyodrębnioną funkcję z `userId` w parametrze. Wyszło **6 niezerowych pól z 20**.
Wyglądało jak ubogi fixture, a było czymś innym: siedem z jedenastu bloków woła **kontrakty modułów**,
czyli Server Actions, które użytkownika wywodzą z **sesji**, a nie z parametru. Poza kontekstem
żądania rzucają „headers was called outside a request scope", a `try/catch` w każdym bloku zamienia
to na ciche zera. Drugi wariant tej samej pułapki: fixture siał dane na nowym koncie, a bloki czytały
konto z ciasteczka — znowu zera.
**Rozwiązanie:** Punkt odniesienia zrzucony **tymczasową trasą diagnostyczną** (włączaną tylko przy
`E2E_TEST_MODE=1`) odpytaną na działającym serwerze z ciasteczkiem sesji; fixture nauczony siać na
istniejącym koncie (`--email=`). Wynik: 19 z 20 pól niezerowych. Trasa skasowana po porównaniach.
**Lekcja:** **Parametr `userId` w sygnaturze nie znaczy, że kod go używa.** Zanim uznasz zrzut za
punkt odniesienia, policz pola niezerowe i wytłumacz **każde** zero — zrzut z zerami zgadza się
z zerami po przebudowie nawet wtedy, gdy zgubisz połowę wkładów. Gdy mierzony kod dotyka sesji,
mierz go **w kontekście żądania**, nie ze skryptu.

## 2026-08-11 — Kontrakt modułu jest plikiem ZBIORCZYM: import stałej wciągnął cały serwer
**Problem:** Po przeniesieniu agregatu kalendarza na składanie z deklaracji `collect.ts` (wewnątrz
modułu Kalendarz) zaczął importować **korzeń kompozycji**, żeby zebrać wkłady wszystkich modułów.
To odwrócona zależność: moduł → korzeń → wszystkie moduły. Sama w sobie brzmi niewinnie, ale
`contract.ts` re-eksportował ten agregat, a kontrakt jest **plikiem zbiorczym** — więc import
**jednej stałej** (`MODULE_META` w `NotificationBell`, komponencie powłoki obecnym na każdej stronie)
wciągał do grafu cały kod serwerowy aplikacji. Graf strony logowania — która z modułami nie ma nic
wspólnego — urósł z **2120 do 2775 modułów**, a kompilacja każdej trasy w trybie dev zwolniła 2–4×.
Pełny zestaw klikaczy: 12,6 → 25,0 min.
**Rozwiązanie:** Odwrócenie zależności z powrotem. Moduł Kalendarz zostawia sobie **czyste składanie**
(`assembleCalendar` — sortowanie i mapowanie), a zbieranie wkładów robi warstwa kompozycji
(`src/lib/calendarAgenda.ts`). Kontrakt przestał re-eksportować agregat. Graf strony logowania spadł
do **1771 modułów**, czyli **poniżej** stanu sprzed przebudowy.
**Lekcja:** Kontrakt modułu to **barrel** — kto importuje z niego cokolwiek, płaci za wszystko, co on
re-eksportuje. Dokładanie do kontraktu funkcji o ciężkim grafie opodatkowuje **każdego** konsumenta,
także tego, który chciał tylko stałej. I reguła ogólniejsza: **moduł nigdy nie sięga po korzeń
kompozycji.** Jeśli kod potrzebuje listy wszystkich modułów, to nie jest kod modułu — nawet jeśli
dotyczy jego dziedziny. Diagnoza: `next dev` loguje liczbę modułów per trasa (`Compiled /x in Ys
(N modules)`) i to jest najszybszy sposób, żeby zobaczyć spuchnięty graf.

## 2026-08-11 — Leniwy `import()` w deklaracji modułu spowolnił CAŁĄ aplikację 2×, a build tego nie pokazał
**Problem:** Deklaracja modułu (`module.ts`) dostała trzy leniwe pola serwerowe — `ai`, `jobs`,
`calendar` — każde jako `() => import("./…")`. Leniwość miała wystarczyć, żeby kod serwerowy nie
trafił do przeglądarki. Nie wystarczyła: `MODULES` jest importowane przez `ModuleSidebar`, czyli
**komponent kliencki**, więc webpack musi objąć cele tych dynamicznych importów kompilacją klienta.
W produkcji tree-shaking je odsiewa (`next build` pokazał **88,1 → 88,7 kB**, czyli „bez zmian"),
ale **tryb deweloperski kompiluje je przy każdej stronie**. Efekt: pełny zestaw klikaczy urósł
z 12,7 do 26,0 minuty, spec smoke z 46 do 125 sekund, a sześć testów ścieżki szczęśliwej zrobiło się
czerwonych przez przekroczone limity czasu — mimo że aplikacja działała poprawnie.
**Rozwiązanie:** Wkład serwerowy wyprowadzony do osobnego `module.server.ts` i osobnego korzenia
kompozycji `src/lib/modules.server.ts`, którego klient nie dotyka. `module.ts` zawiera wyłącznie to,
co wolno wysłać do przeglądarki. Po poprawce smoke wrócił do 52 s.
**Lekcja:** „Leniwy import nie trafia do bundla" jest **nieprawdą** po stronie kompilacji — leniwy
import zmienia moment ładowania, nie przynależność do grafu. Jeśli plik jest osiągalny z komponentu
klienckiego, wszystko, co importuje (choćby dynamicznie), staje się częścią kompilacji klienta.
I druga rzecz: **`next build` nie jest miarą wydajności deweloperskiej** — rozmiar bundla może stać
w miejscu, gdy praca aplikacji spada dwukrotnie. Regresję wydajności widać tylko w pomiarze czasu,
a jedynym uczciwym sposobem przypisania jej przyczynie jest **uruchomienie tego samego zestawu na
kodzie sprzed zmiany**, w tym samym środowisku, jeden po drugim.

## 2026-08-11 — Znowu build równolegle z klikaczami, mimo własnego ostrzeżenia w liście zadań
**Problem:** Uruchomiłem klikacze w tle, a w „wolnej chwili" odpalił `npm run build`, który zaczyna od
`rm -rf .next`. Zestaw pokazał **23 czerwone zamiast 14**, w tym sześć testów ścieżki szczęśliwej,
z czasami po 40–70 sekund na test. Wyglądało to jak poważna regresja przebudowy; było wyrwaniem
serwerowi spod nóg katalogu, z którego serwuje. Reguła „nigdy build równolegle z klikaczami" była
wypisana **w nagłówku mojej własnej listy zadań** (lekcja z 047).
**Rozwiązanie:** Powtórzenie zestawu bez niczego w tle.
**Lekcja:** Reguła zapisana w dokumencie nie broni się sama, gdy proces w tle nie daje sygnału zajętości.
Zanim odpalisz cokolwiek dotykającego `.next`, sprawdź `ps aux | grep playwright` — jedno polecenie
kosztuje sekundę, a mylna diagnoza „regresja w przebudowie" kosztuje godziny. Podejrzanie długie czasy
testów (dziesiątki sekund tam, gdzie zwykle są sekundy) to sygnatura walki o zasób, nie błędu w kodzie.

## 2026-08-11 — Rozbicie promptu na wkłady zgubiło narzędzie, które nie ma implementacji
**Problem:** Katalog narzędzi odczytu asystenta rozbito na wkłady modułowe, generując wiersze promptu
z listy narzędzi **mających handler**. `web_search` handlera nie ma — trasa agenta obsługuje je
osobno, bo idzie do internetu, nie do bazy. Jego wiersz katalogu wyparował, więc model przestałby
wiedzieć, że narzędzie w ogóle istnieje. Build i `tsc` były zielone; nic tego nie widziało.
**Rozwiązanie:** Wiersz dopisany do wkładu przekrojowego, z komentarzem, że narzędzie **celowo** nie
ma tam implementacji. Złapał to test `buildReadToolsPrompt`, który asertuje obecność trzech narzędzi
przekrojowych w prompcie.
**Lekcja:** Gdy rozbijasz katalog na kawałki, źródłem prawdy o **kompletności** jest stara lista, a nie
nowa struktura. Wygeneruj z listy „przed", odejmij „po" i sprawdź resztę — zamiast zakładać, że każdy
wpis miał odpowiednik w kodzie. Wpis opisujący coś, czego nie ma w tym samym miejscu, ginie pierwszy.

## 2026-08-11 — „Baza cienia" i allowlista: dwa miejsca, w których odruch dokłada za dużo
**Problem:** Przy składaniu rejestru zadań w tle z deklaracji odruchowo dopisałem do wkładu platformy
`skins.generate` — bo plik handlera leżał obok pozostałych. Tyle że tego typu **nigdy nie było**
w `JOB_HANDLERS`: trasa woła go synchronicznie. Wpis poszerzyłby `ENQUEUABLE_TYPES`, czyli listę tego,
co klient może zakolejkować z przeglądarki — a to granica bezpieczeństwa, nie wygoda.
**Rozwiązanie:** Porównanie z zrzutem sprzed zmiany (12 typów przed, 12 po) wyłapało nadmiarowy wpis
od razu. Handler został jako zwykły moduł wołany z trasy, bez wpisu w mapie.
**Lekcja:** Przy refaktorze listy, która jest **allowlistą**, porównanie „przed/po" nie jest
formalnością — jest jedyną rzeczą stojącą między refaktorem a cichym poszerzeniem uprawnień.
„Plik leży obok" nie znaczy „należy do tej samej listy".

## 2026-08-11 — Test, który startuje workera, wiesza cały zestaw
**Problem:** Po przejściu rejestru zadań na składanie z deklaracji test kolejki dostał poprawkę
wołającą `ensureJobWorker()` — żeby wstrzyknąć rezolwer handlerów. Zestaw testów przestał się kończyć:
`npm run test:unit` wisiał do timeoutu bez jednego komunikatu o błędzie.
**Rozwiązanie:** `ensureJobWorker()` odpala pętlę `setInterval`, która trzyma proces Node przy życiu.
W teście wstrzykujemy sam rezolwer (`setJobHandlerResolver`), bez startowania pętli.
**Lekcja:** Test, który wywołuje funkcję „ensure/start/init" produkcyjnego runtime'u, dziedziczy jego
cykl życia. Objaw jest mylący — nie „test failed", tylko cisza do timeoutu. Gdy zestaw nagle wisi,
szukaj najpierw tego, co ostatnia zmiana **wystartowała**, a nie tego, co sprawdza.

## 2026-08-05 — Bramka rozjazdu schematu KASOWAŁA lokalną bazę deweloperską
**Problem:** `npm run build` wywracał się na ostatnim kroku (`scripts/migrate.js`) błędem Prismy
**P3005 „The database schema is not empty"**, mimo że chwilę wcześniej `prisma migrate deploy`
przeszedł czysto. Objaw wskazywał na migracje, a winowajcą była bramka uruchamiana **wcześniej**
w tym samym buildzie: `check-schema-drift.js` podawał jako `--shadow-database-url` **to samo
połączenie co robocze**. Prisma czyści bazę cienia przed odtworzeniem migracji, więc każde
uruchomienie bramki (a więc każdy build i każde `npm run check:schema-drift`) **kasowało schemat
lokalnej bazy razem z `_prisma_migrations`**. Potem `migrate deploy` widział 147 tabel bez tabeli
migracji i słusznie odmawiał.
**Rozwiązanie:** Baza cienia to teraz **osobna** baza `<db>_shadow`, tworzona przez bramkę
(`CREATE DATABASE`, powtórzone „already exists" ignorowane). Jeśli roli brakuje `CREATEDB`,
bramka **pomija sprawdzenie** zamiast sięgać po bazę roboczą — lepiej stracić jedno sprawdzenie
niż czyjeś dane. W sandboksie wystarczyło `ALTER ROLE omnia CREATEDB;`.
**Lekcja:** „Baza cienia" u Prismy znaczy **kasowana baza**. Nigdy nie podawaj tam `DATABASE_URL`.
I gdy build pada na kroku N, sprawdź, czy kroku N nie zepsuł krok N-1 — kolejność w potoku bramek
jest częścią diagnozy, a P3005 potrafi wskazać na zupełnie niewinne miejsce.

## 2026-08-05 — Moduł ma TRZY historyczne miejsca, a bramka pilnowała dwóch
**Problem:** Po fali 3 bramka `check-module-registry` chwaliła się, że żaden moduł nie ma kodu poza
swoim katalogiem — sprawdzała jednak tylko `src/actions/<id>.ts` i `src/components/<id>/`. Trzecie
historyczne miejsce, **`src/lib/<id>/`**, zostało pominięte, więc falę przetrwały `src/lib/tasks/`
i `src/lib/shopping/`. Najgorszy skutek: `lib/tasks/access.ts` importowało
`@/modules/tasks/contract`, czyli **własny publiczny kontrakt modułu Zadania** — obejście C-02
okrężną drogą przez alias, którego linter nie widzi, bo plik formalnie leży poza modułem.
**Rozwiązanie:** Pliki jednomodułowe przeniesione do `modules/<x>/lib/` (import na ścieżkę
względną), a bramka patrzy już na wszystkie trzy miejsca. Katalogi realnie współdzielone
(`lib/news`, `lib/health`, `lib/home`) mają **jawną listę wyjątków z powodem** — bramka nie zgaduje,
tylko żąda decyzji.
**Lekcja:** Kiedy bramka ma dowodzić „nie ma kodu poza katalogiem", wypisz najpierw **wszystkie**
miejsca, w których ten kod historycznie mieszkał, i sprawdź każde. Bramka pilnująca podzbioru
wygląda dokładnie tak samo jak bramka pilnująca całości — do dnia, w którym coś przez nią przejdzie.

## 2026-08-05 — Skrypt przepisujący importy myli PLIK z KATALOGIEM o tej samej nazwie
**Problem:** Przy przenoszeniu modułów skrypt zamieniający `@/actions/services` na nową ścieżkę
przepisał **także** `@/actions/services/disputes` — bo wzorzec świadomie dopuszcza `/` po aliasie
(inaczej nie objąłby katalogów). Gdy plik i katalog mają tę samą nazwę, oba lecą w to samo miejsce
i importy jednego z nich wskazują nieistniejącą ścieżkę. Zdarzyło się **cztery razy w jednej fali**:
`actions/services.ts` + `actions/services/`, `lib/services.ts` + `lib/services/`, `lib/portfel.ts` +
`lib/portfel/`, `lib/calendar.ts` + `lib/calendar/`.
**Rozwiązanie:** Każdą złapał `tsc` natychmiast — to jest ten przypadek, w którym kontrola typów
naprawdę wystarcza za dowód poprawności. Po przenosinach katalogi dostały inne nazwy (`parts/`,
`core/`), a pliki weszły do modułu jako `lib/<nazwa>.ts` albo `lib/index.ts`, więc kolizja już nie
wraca.
**Lekcja:** Przed przeniesieniem sprawdź, czy w źródle nie ma pary „plik X.ts + katalog X/". Jeśli
jest — przenieś je **osobno i w innej kolejności niż alfabetyczna**, albo od razu nadaj katalogowi
inną nazwę. I nie ufaj liczbie „przepisano N importów": ona nie wie, że część trafiła nie tam.

## 2026-08-05 — Bramka trzymająca ścieżki jest czuła na refaktor przenoszący
**Problem:** Trzeci raz w tej przebudowie bramka wywróciła się na przenosinach: `check-ai-coverage`
i kontrola zaszytych kolorów miały **zaszyty korzeń skanowania** (047), a `check-content-memory`
trzyma ścieżki plików **w manifeście** — po przeniesieniu Wiadomości i Pogody zażądała klasyfikacji
dla „nowych" plików, choć klasyfikacja istniała pod starą ścieżką.
**Rozwiązanie:** Ścieżki w manifeście zaktualizowane; klasyfikacje bez zmian. W przypadku
`check-ai-coverage` (047) trzeba było dołożyć drugi korzeń skanowania.
**Lekcja:** Planując refaktor przenoszący, **przejrzyj bramki pod kątem ścieżek** — i w kodzie,
i w manifestach — zanim ruszysz pliki. Bramka ze sztywną ścieżką albo przestaje sprawdzać (groźne,
bo cicho), albo żąda ponownej klasyfikacji (uciążliwe, ale widoczne). Pierwszy wariant jest znacznie
gorszy, więc warto go szukać aktywnie.

## 2026-08-05 — „Dostępne w nawigacji" ma dwie poprawne postacie
**Problem:** Test `scenario-qa-tester-access` twierdził, że moduł QA jest niedostępny dla
uprawnionego użytkownika. Sprawdzał `getByRole("link", { name: "QA" })`. QA ma jednak
`defaultEnabled: false`, więc nie jest w głównej nawigacji — siedzi w zwiniętej sekcji „Więcej…"
i renderuje się tam jako **przycisk** (służy do dołożenia modułu do menu, a nie do przejścia).
Test szukał wyłącznie linku, więc nie znajdował niczego i wyglądało to na brak uprawnień.
**Rozwiązanie:** Asercja akceptuje obie postacie (link **albo** przycisk) i najpierw rozwija sekcję.
Poprawka po stronie testu — zachowanie aplikacji jest zamierzone.
**Lekcja:** Gdy test sprawdza „czy X jest dostępne", opisz **wszystkie** postacie, w jakich produkt
to pokazuje. Test opisujący jedną z nich nie sprawdza dostępności, tylko konkretny wariant
renderowania — i myli brak wariantu z brakiem funkcji.

## 2026-08-05 — Przynależność pliku ustala się po konsumentach, nie po nazwie
**Problem:** Przy przenoszeniu modułów do `src/modules/` kuszące było zabranie wszystkiego, co ma
pasującą nazwę. `lib/habitStats.ts` brzmi jak Nawyki, `lib/medicationSchedule.ts` jak Zdrowie,
`actions/tags.ts` jak Notatki. Sprawdzenie konsumentów pokazało co innego: `habitStats` używają
`actions/medications`, `actions/notifications` i `kitchenExecutor`; `medicationSchedule` — **agregat
kalendarza** i narzędzia asystenta; tagi — Kuchnia. Przeniesienie któregokolwiek zmusiłoby cudzy kod
do importu kontraktu modułu, do którego ten plik nie należy.
**Rozwiązanie:** Wszystkie trzy zostały tam, gdzie były, a decyzja i powód trafiły do `plan.md`,
kontraktów i dziennika przebudowy — przed napisaniem kodu, nie po. Tagi mają docelowo trafić do
warstwy słowników platformy, razem z kategoriami i jednostkami; to osobne zadanie.
**Lekcja:** Przed przeniesieniem pliku do modułu wypisz jego **importujących**. Nazwa pliku mówi,
czym plik miał być; lista konsumentów mówi, czym jest. Przeniesienie „bo pasuje nazwą" betonuje
przypadkowe sprzężenie zamiast je rozwiązać — i wychodzi dopiero, gdy ktoś próbuje przenieść moduł
po drugiej stronie tej zależności.

## 2026-08-05 — Bramka granic sprawdza swoje sondy, nie repozytorium
**Problem:** Po każdym przeniesionym module odpalałem `check:boundaries` i był zielony. Dopiero
`next lint` na końcu fali pokazał realne naruszenie: `HealthHomePage` importował sąsiedni komponent
tego samego modułu przez alias (`@/modules/health/ui/HealthAiOptInToggle`), a nie ścieżką względną.
Bramka tego nie widziała, bo ona **tworzy własne pliki-sondy** i sprawdza, czy ESLint na nie
reaguje — nie skanuje kodu repozytorium.
**Rozwiązanie:** Import zamieniony na `./HealthAiOptInToggle`. Ważniejsze: do rytuału po każdym
module dochodzi `next lint --dir src`, a nie sam `check:boundaries`.
**Lekcja:** Bramka typu „udowodnij, że reguła działa" i lint typu „sprawdź kod" odpowiadają na dwa
różne pytania. Zielona pierwsza znaczy tylko tyle, że reguła jest sprawna — nie że nikt jej nie
łamie. W rytuale weryfikacyjnym potrzebne są obie.

## 2026-08-05 — `next build` i serwer dev klikaczy walczą o katalog `.next`
**Problem:** Żeby zaoszczędzić czas, odpaliłem `next build` w trakcie trwającego przebiegu
klikaczy (`scripts/e2e-web.sh` trzyma serwer deweloperski). Build padł z `Cannot find module
'./1682.js'`, a przebieg klikaczy wykrzaczył się na `ENOENT … webpack/client-development-fallback`
i pokazał **38 czerwonych zamiast realnych ~19** — czyli wynik nie do odczytania w obie strony.
**Rozwiązanie:** `rm -rf .next`, czysty build, a potem osobny, samotny przebieg klikaczy.
**Lekcja:** `next build` i serwer deweloperski dzielą `.next` i nawzajem sobie go psują. Nigdy nie
zrównoleglaj builda z klikaczami w tym samym katalogu roboczym — oszczędność kilku minut kosztuje
dwa bezużyteczne wyniki i jeszcze jeden pełny, 13-minutowy przebieg.

## 2026-08-04 — `next lint` przy zepsutej konfiguracji kończy się kodem 0
**Problem:** Do `.eslintrc.json` trafił blok `overrides` z wymyślonym kluczem `$komentarz`
(chcieliśmy skomentować regułę granic modułów). Walidator schematu ESLinta odrzucił konfigurację,
`next lint` wypisał „ESLint configuration in .eslintrc.json is invalid" — **i zakończył się kodem 0**.
Build był zielony, a reguła blokująca import przez granicę modułu nie działała w ogóle. Wykrył to
dopiero ręczny test negatywny: plik celowo łamiący regułę przeszedł bez błędu.
**Rozwiązanie:** Komentarze w `.eslintrc.json` piszemy jako `//` (ESLint czyta plik przez
`strip-json-comments`), a nie jako zmyślone klucze. Ważniejsze: powstała bramka
`scripts/check-boundaries.js`, która nie *czyta* konfiguracji, tylko ją **wywołuje** — tworzy pliki
łamiące obie reguły granic i wymaga od ESLinta realnego błędu, a przy okazji sprawdza dwa przypadki,
które muszą przechodzić (kontrakt obcego modułu, własne wnętrze). Sprawdzone: wyłączenie reguły ORAZ
zepsucie konfiguracji czerwienią bramkę.
**Lekcja:** Zielony lint nie znaczy „reguła działa" — może znaczyć „lint się nie uruchomił".
Reguła, na której opiera się architektura, potrzebuje **testu negatywnego wpiętego w build**, a nie
jednorazowego sprawdzenia przy pisaniu. Test wykonany raz chroni przez jeden dzień.

## 2026-08-04 — `tsc --noEmit` nie widzi plików testowych
**Problem:** Po przeniesieniu `lib/permissions.ts` → `platform/auth/permissions.ts` test
`src/lib/__tests__/permissions.test.ts` importował `../permissions` — ścieżką **względną**, której
skrypt przepisujący aliasy `@/…` nie dotknął. `npx tsc --noEmit` był czysty, a test przestał się
uruchamiać. Wyszło to dopiero po 40 sekundach `npm run test:unit` (1 fail na 599). Ten sam problem
powtórzył się drugi raz w tym samym przebiegu, przy zmianie nazw funkcji RBAC.
**Rozwiązanie:** `tsconfig.json` wyklucza `src/**/*.test.ts`, więc typecheck z definicji pomija testy.
Powstał `tsconfig.test.json` (dziedziczy po głównym, ale z `target: ES2022` — testy działają w Node
i iterują po `Set`/`Map`) plus `npm run check:test-types` wpięte w `build`.
**Lekcja:** Po refaktorze przenoszącym pliki czysty `tsc` **nie jest** dowodem, że nic się nie
zerwało — sprawdź, co konfiguracja wyklucza. I: skrypt przepisujący importy po aliasach nie dotknie
importów względnych, więc po każdej fali przenosin trzeba osobno przejrzeć `../`.

## 2026-08-04 — Bramka ze sztywnym korzeniem skanowania gubi kod, który się przeprowadził
**Problem:** `check-ai-coverage.js` skanował wyłącznie `src/actions/`, a kontrola zaszytych kolorów
w `check-ui-contract.js` wyłącznie `src/components/`. Przeniesienie modułu do `src/modules/<x>/`
(refaktor czysto organizacyjny, zero zmian logiki) **wypisało jego akcje z pokrycia AI i z kontroli
dostępu**, a jego widok z zakazu zaszytych kolorów — bez jednego czerwonego komunikatu. Liczba
sprawdzanych akcji spadła z 550 do 547 i tylko dlatego dało się to zauważyć.
**Rozwiązanie:** Obie bramki dostały dodatkowy korzeń (`src/modules/*/actions`, `src/modules/*/ui`).
Bramka pokrycia dodatkowo wykrywa **kolizję nazw plików akcji**, bo klucz manifestu to sama nazwa
pliku — dwa `tasks.ts` w różnych katalogach scaliłyby się w jeden wpis i połowa akcji zniknęłaby
z kontroli bez słowa.
**Lekcja:** Bramka bezpieczeństwa ze **sztywną ścieżką** przestaje działać przy pierwszej
przeprowadzce kodu — i to po cichu, bo brak plików do sprawdzenia wygląda jak brak naruszeń.
Planując refaktor przenoszący, przejrzyj bramki pod kątem zaszytych korzeni **zanim** ruszysz pliki,
i dokładaj do bramek liczbę sprawdzonych elementów, żeby spadek dało się zobaczyć.

## 2026-08-04 — Reguła granic modułów nie odróżni „swojego" od „cudzego" po aliasie
**Problem:** Reguła `no-restricted-imports` miała blokować import wnętrza obcego modułu
(`@/modules/inny/actions/x`), ale przepuszczać import własnego wnętrza. Przy aliasach jest to
niewykonalne jedną regułą: plik w `modules/qa` importujący `@/modules/qa/actions/qa` wygląda dla
lintera **identycznie** jak import cudzego wnętrza. Wyjściem byłby osobny blok `overrides` na każdy
z 21 modułów — konfiguracja, która rozjedzie się przy pierwszym nowym module.
**Rozwiązanie:** Wewnątrz modułu importujemy **ścieżką względną** (`./actions/x`), na zewnątrz
wyłącznie kontraktem. Wtedy jedna reguła wystarcza dla wszystkich modułów, a granica jest widoczna
w samym imporcie: `./` = moje, `@/modules/…` = cudze. Przy okazji: wzorzec `@/modules/*/!(contract)`
z planu nie działa — dopasowywanie wzorców w `no-restricted-imports` nie obsługuje extglob;
działa para „szeroki wzorzec + negacja": `["@/modules/*/**", "!@/modules/*/contract"]`.
**Lekcja:** Konwencja importu to nie kosmetyka — decyduje o tym, czy granicę **da się** egzekwować
jedną regułą. Projektując granicę, sprawdź najpierw, czym linter dysponuje, zanim zaprojektujesz
kształt importów.

## 2026-08-04 — Platforma, która musi wiedzieć coś o module, przyjmuje to parametrem
**Problem:** `filterAccessibleFavorites` (warstwa platformy) importowało `isPathLocked`, żeby ukryć
ulubione widoki bez uprawnienia. Po przeniesieniu modułów pełna wiedza „która ścieżka wymaga jakiego
uprawnienia" wylądowała w korzeniu kompozycji — a platformie nie wolno importować modułów. Kuszące
było zostawienie w platformie wariantu „historycznego" jako domyślnego.
**Rozwiązanie:** Predykat przychodzi **parametrem wymaganym**. Gdyby był opcjonalny z domyślnym
wariantem częściowym, zapomniane przekazanie dawałoby **cichy przeciek RBAC** (ulubiony do modułu bez
uprawnienia po prostu by się pokazał) zamiast błędu kompilacji. Funkcje o niepełnym obrazie dostały
prefiks `legacy` w nazwie — kto po nie sięgnie, ma to widzieć.
**Lekcja:** Przy odwracaniu zależności w kodzie decydującym o dostępie **nie dawaj wartości
domyślnej**. Domyślna zamienia błąd kompilacji w dziurę bezpieczeństwa, której nikt nie zobaczy.

## 2026-08-04 — Bramka pilnuje kodu, ale nie podpowiada, czego użyć
**Problem:** Po 045 aplikacja miała kontrakt widoku wymuszany bramką `check:ui-contract`: nowy moduł
bez `ModuleView` nie przechodził builda. Mimo to `CLAUDE.md` — jedyny dokument, który czyta każda
kolejna sesja — nie zawierał ani jednej wzmianki o `ModuleView`, `ConfirmProvider` czy nowych
rodzinach tokenów skórki. Bramka mówiła „nie tak", ale nic nie mówiło „a jak".
**Rozwiązanie:** Opis kontraktu widoku, zakazu `window.confirm()` i silnika skórek trafił do
`CLAUDE.md`, a twarde reguły — do konstytucji pipeline'u jako `C-33`/`C-34`/`C-35`. Bramka i dokument
to teraz para: jedno wykrywa naruszenie, drugie tłumaczy właściwą drogę.
**Lekcja:** Bramka bez dokumentacji zamienia się w przeszkodę, którą się obchodzi, a nie w regułę,
którą się rozumie. Dodając bramkę wymuszającą nowy wzorzec, w tym samym zadaniu dopisz do dokumentu
architektury, CO ma być użyte zamiast — inaczej następna osoba pozna regułę dopiero z czerwonego
builda i najtańszym wyjściem będzie dla niej wpis wyjątku w manifeście.

## 2026-08-04 — Wspólny komponent bez konsumenta wygląda w raporcie jak zrobiony
**Problem:** Przebieg 045 dowiózł `ConfirmDialog`, `Field`, `DataList` i `BulkActionBar` — wszystkie
zgodne z planem, otypowane, w playgroundzie, build zielony. Etap `/verify` odrzucił to jednak jako
DO POPRAWY, bo **żadnego z nich nie używał ani jeden moduł**: w kodzie nadal siedziały 52 wywołania
natywnego `window.confirm()`, a stan pusty istniał w dwóch implementacjach obok siebie. Bramki tego
nie łapały, bo bramka sprawdza istnienie i poprawność, a nie ADOPCJĘ.
**Rozwiązanie:** Trzy różne odpowiedzi zależnie od przypadku. `ConfirmDialog` dostał `ConfirmProvider`
z API obietnicowym (`if (!(await confirmDialog(…))) return;`), bo podmiana MUSIAŁA być jednolinijkowa
w miejscu wywołania — inaczej nikt nie zrobiłby jej w 52 plikach. Zdublowane `EmptyState` i `Field`
zamieniono w cienkie nakładki na wspólne implementacje: jedna implementacja, dwa wejścia, zero
przepisywania 21 wywołań. `DataList` i wspólny `BulkActionBar` po prostu **usunięto** — nie miały
konsumenta i nie było go w zasięgu.
**Lekcja:** Przy budowie systemu komponentów „gotowe" znaczy **wpięte**, nie „istnieje". Komponent
bez konsumenta jest gorszy niż jego brak: w galerii ogłasza wspólne rozwiązanie, którego nikt nie
stosuje, więc następna osoba i tak napisze swoje. Planując taki system, zaplanuj MIGRACJĘ pierwszego
konsumenta w tym samym zadaniu — a jeśli migracja jest droga, przewidź nakładkę na stare API zamiast
nowego wywołania w każdym pliku.

## 2026-08-04 — Obietnica bez rozstrzygnięcia przy współdzielonym oknie dialogowym
**Problem:** `ConfirmProvider` trzymał `resolve` bieżącej obietnicy w jednym `useRef`. Drugie
wywołanie `confirm()`, zanim pierwsze zostało rozstrzygnięte, nadpisywało tę referencję — i pierwsza
obietnica **nigdy się nie domykała**. Handler usuwania zostawał na `await` na zawsze, razem
z otwartym `startTransition`, więc widok wisiał w stanie oczekiwania do przeładowania strony.
Scenariusz nie jest teoretyczny: skróty klawiszowe działają dalej pod modalem.
**Rozwiązanie:** Przed nadpisaniem referencji domykamy poprzednią obietnicę odmową
(`resolveRef.current?.(false)`). Użytkownik i tak widzi już inne pytanie, więc „nie" jest jedyną
bezpieczną odpowiedzią dla porzuconego wywołania.
**Lekcja:** Każde API obietnicowe oparte na POJEDYNCZYM `useRef` z `resolve` ma tę pułapkę. Zawsze
pytaj: „co się stanie przy drugim wywołaniu przed rozstrzygnięciem pierwszego?". Odpowiedź „to się nie
zdarzy" jest fałszywa wszędzie tam, gdzie istnieją skróty klawiszowe, podwójne kliknięcia albo
odświeżanie w tle.

## 2026-08-04 — Wspólny pasek widoku: powłoka nie może go narysować, ale może go wypełnić
**Problem:** W 043 właściciel poprosił, żeby przycisk zapisu widoku był „wyraźnie widoczny w pasku
bieżącego widoku". Odpowiedź brzmiała „nie da się" — `AppShell` renderuje `<main>{children}</main>`
i nie zna tytułu modułu, więc pasek narysowany w powłoce dałby PODWÓJNE NAGŁÓWKI w ~20 modułach.
Przycisk trafił wtedy na górę nawigacji, a odstępstwo odnotowano w recenzji. Ten sam wniosek
powtórzyłby się przy każdym kolejnym elemencie wspólnym (świeżość danych, obecność, udostępnianie).
**Rozwiązanie:** Odwrócenie zależności. Powłoka nie RYSUJE paska, tylko UDOSTĘPNIA jego zawartość
przez kontekst (`ViewChromeProvider`), a rysuje go `ModuleView` osadzony w stronie modułu. Moduł
nadal nie wie, co w pasku siedzi — dostaje ramę, nie listę widgetów. Koszt: jeden kontekst.
**Lekcja:** Gdy „powłoka nie może tego wiedzieć" blokuje wspólny element UI, sprawdź, czy problemem
nie jest kierunek zależności. Powłoka nie musi znać modułu, żeby dołożyć coś do jego widoku —
wystarczy, że moduł zna kontrakt. To samo odwrócenie pozwala potem dołożyć udostępnianie i wykrywanie
konfliktów bez wracania do dwudziestu modułów.

## 2026-08-04 — Rozszerzenie tokenów skórki nie może luzować blokady wstrzyknięcia CSS
**Problem:** Skórka miała objąć gradienty, cienie i krzywe ruchu, a wszystkie trzy WYMAGAJĄ nawiasów
(`linear-gradient(`, `rgba(`, `cubic-bezier(`). Dotychczasowa sanityzacja blokowała nawiasy globalnie,
z wyjątkiem `rgb/hsl`. Odruch „poluzujmy blokadę nawiasów" otworzyłby `url(...)`, `paint(...)`
i `element(...)` — a od tej wersji skórkę można ZAIMPORTOWAĆ Z PLIKU i wygenerować modelem, czyli
źródło bywa obce.
**Rozwiązanie:** Zamiast luzować blokadę globalną — whitelista funkcji PER RODZAJ tokenu. Tło
przyjmuje wyłącznie funkcje gradientu, cień wyłącznie funkcje koloru, krzywa ruchu wyłącznie
`cubic-bezier` i słowa kluczowe. Limit długości podniesiony tylko tam, gdzie wartość jest z natury
długa (gradient 240 znaków), nie wszędzie. `--font-family-*` w ogóle nie przyjmuje tekstu — tylko
słowo kluczowe z zamkniętej listy stosów systemowych, bo w `font-family` cudzysłowy i przecinki są
legalne, więc każda reguła wychodzi albo dziurawa, albo bezużyteczna.
**Lekcja:** Gdy nowy typ danych wymaga znaku, który dotąd był zakazany, nie znoś zakazu — zawęź
kontekst, w którym znak jest dozwolony. I traktuj wyjście modelu dokładnie jak plik od obcej osoby:
przechodzi przez tę samą walidację, bez taryfy ulgowej.

## 2026-08-04 — Istniejące testy jako straż przed „ulepszeniem", które jest regresją
**Problem:** Rozszerzając tokeny skórki o `rem`/`em` i większe zakresy, poluzowałem wspólne wyrażenie
dla rozmiarów. Dwa istniejące testy natychmiast padły: `--radius: 8em` i `--radius: 1000px` zaczęły
przechodzić.
**Rozwiązanie:** Rozdzielenie na dwa wyrażenia. Zaokrąglenia i gęstość zostają WĄSKIE (px, max trzy
cyfry), szerszą jednostkę dostał wyłącznie nowy rodzaj `length` (odstępy, wymiary). Testy miały rację:
promień w `em` skaluje się z rozmiarem tekstu (pułapka przy zmianie gęstości), a `1000px` to nie
zaokrąglenie, tylko awaria układu.
**Lekcja:** Gdy rozszerzasz walidację, nie rozszerzaj jej „hurtem" na wszystkie pola tego samego
kształtu. Padający stary test przy dodawaniu funkcji to najczęściej informacja, że granica była
przemyślana — sprawdź DLACZEGO ją postawiono, zanim ją przesuniesz.

## 2026-08-04 — Ikona pogody liczona z pola, którego zapytanie w ogóle nie pobierało
**Problem:** Właściciel zgłosił: „mam deszcz, a moduł pogody pokazuje tylko chmurkę i 82%".
Pierwszy odruch — „pewnie zły warunek w mapowaniu kodów WMO" — był fałszywym tropem. Mapowanie było
poprawne. Kafel „Teraz" liczył ikonę **wyłącznie** z syntetycznego `weather_code` dostawcy, a blok
`current` w zapytaniu do Open-Meteo brzmiał
`temperature_2m,apparent_temperature,weather_code,wind_speed_10m,is_day` — **ani jednego pola
o opadzie**. Kod pogody bywa „pochmurno" w tej samej chwili, w której ten sam model raportuje opad,
więc aplikacja fizycznie nie miała z czego poznać deszczu. Drugie, niezależne kłamstwo: liczba „82%"
obok chmurki to było `precipProbMax`, czyli **dobowe maksimum**, ale bez podpisu czytało się jak
„szansa opadu teraz". Trzecia sprawa: warianty nocne ikon dodane w 038 objęły kody 0/1/2, ale
pominęły mżawkę (51–55) i przelotny deszcz (80–82), które też używają ikony ze słońcem (🌦️) — więc
po zmroku dalej gdzieniegdzie świeciło słońce.
**Rozwiązanie:** Dociągnięcie `precipitation,rain,showers,snowfall` do **tego samego** zapytania
(zero dodatkowego ruchu sieciowego) i jedna funkcja `observedWmo()`, z której korzystają wszyscy
konsumenci — ekran, czujki i asystent. Korekta jest celowo **wąska**: kody `>= 51` (dostawca już
opisuje opad lub burzę) zostają nietknięte, bo nadpisywanie burzy „deszczem" gubiłoby ostrzeżenie;
podmieniamy tylko kody `<= 48` przy zmierzonym opadzie ≥ 0,1 mm. Próg jest istotny — bez niego
wilgoć na granicy czułości (0,05 mm) kazałaby ikonie krzyczeć „deszcz" przy suchym chodniku. Pola
opadu są `number | null`, nie `number`, bo **brak danych musi znaczyć „nie wiem", a nie „nie pada"** —
`?? 0` wyłączałoby korektę tak samo jak zmierzona susza. Liczby na kafelku rozdzielone i podpisane:
„Teraz · opad X mm/h · szansa opadu Y%" (Y z bieżącej godziny) osobno od „Dziś · … · opady maks. Z%".
**Lekcja:** Zanim zaczniesz szukać błędu w logice, **sprawdź, czy dane, na których ta logika pracuje,
w ogóle są pobierane**. Tutaj cała warstwa mapowania była bezbłędna, a mimo to wynik był nieprawdą —
bo wejście było niepełne. I szerzej: **każda liczba na ekranie musi mieć jawny horyzont czasowy**.
„82%" bez podpisu to nie jest informacja niepełna, to jest informacja fałszywa, bo użytkownik
przypisze jej horyzont sam — ten najbliższy, czyli „teraz".

## 2026-08-04 — Poziomy gest i natywne przewijanie: rozstrzygaj na końcu gestu, nie w trakcie
**Problem:** Strumień wiadomości miał dostać przesuwanie palcem w bok jako skrót skoku do sąsiedniego
tematu. Typowy sposób implementacji — nasłuch `touchmove` z `preventDefault()`, żeby „przejąć" gest —
psuje na telefonie przewijanie w pionie: przeglądarka traci płynne, natywne przewijanie i ruch zaczyna
skakać. Drugi problem był subtelniejszy: strumień synchronizuje wybór tematu z przewijaniem
(obserwator przecięć) **i** przewija do tematu po jego wybraniu. Te dwa kierunki się nakręcają — skok
uruchamia płynną animację, obserwator widzi po drodze każdą mijaną sekcję i przestawia wybór na
przypadkową, co wygląda jak „uciekający" wybór tematu.
**Rozwiązanie:** (1) Gest rozstrzygany **dopiero w `touchend`**, na podstawie kształtu całego ruchu:
`|dx| > 60 px` **i** `|dx| > 1.5 × |dy|`. W `touchmove` nie robimy nic, więc przewijanie w pionie
zostaje w 100% natywne. Dodatkowo gest zaczęty na przycisku/linku/polu jest ignorowany — to próba
użycia tego elementu, nie nawigacja. (2) Strażnik `programmaticUntil` (~700 ms): obserwator ignoruje
zmiany przez czas trwania przewinięcia sterowanego kodem. (3) Ten sam skok dostępny **przyciskami**,
więc gest jest skrótem, a nie jedyną drogą — na desktopie i przy obsłudze klawiaturą nic nie ginie,
a w razie problemów z ergonomią da się go wyciszyć bez utraty funkcji.
**Lekcja:** Gest poziomy na obszarze, który przewija się w pionie, **rozstrzygaj po zakończeniu
ruchu**, nigdy przez `preventDefault` w trakcie. I zawsze, gdy dwie rzeczy synchronizują się
nawzajem (A zmienia B, B zmienia A), potrzebny jest **jawny strażnik na zmianę sterowaną kodem** —
inaczej dostajesz sprzężenie zwrotne, które objawia się jako „samo się przestawia".

## 2026-08-02 — `<style>{CSS}</style>` w Reakcie psuje hydratację CAŁEJ aplikacji
**Problem:** Nowa funkcja (ulubione widoki) zachowywała się losowo: gwiazdka bywała nieklikalna,
popover znikał zaraz po otwarciu, a skrót `Alt+1` nie nawigował, mimo że zdarzenie docierało
z poprawnymi flagami, a `Alt+0` działał. Wyglądało to na błąd w nowym kodzie — nie było nim.
W konsoli przeglądarki siedziało: `Text content does not match server-rendered HTML` ze stosu
`at style at AICommandSheet`, a zaraz po nim `There was an error while hydrating. … the entire root
will switch to client rendering`.
**Rozwiązanie:** Przyczyną było `<style>{MARKDOWN_STYLES}</style>`. React **escapuje cudzysłowy
w tekstowym dziecku** przy renderowaniu na serwerze (`content: &quot;•&quot;`), a na kliencie już nie
(`content: "•"`) — powstaje rozjazd, React porzuca drzewo z serwera i przemontowuje cały korzeń.
Każde przemontowanie kasowało stan lokalny komponentów (otwarty popover) i psuło instancję routera
(`router.push` z natywnego listenera stawał się bezczynny). Poprawka: `<style
dangerouslySetInnerHTML={{ __html: MARKDOWN_STYLES }} />` w 15 miejscach — treść jest statyczną stałą
autorstwa dewelopera, więc jest to bezpieczne, a serwer i klient generują identyczny HTML.
**Lekcja:** Nie wstawiaj CSS jako **tekstowego dziecka** `<style>` w Reakcie, jeśli reguły zawierają
cudzysłowy (`content:`, `font-family: "…"`). Używaj `dangerouslySetInnerHTML` albo trzymaj CSS
w prawdziwym arkuszu. I szerzej: **zanim zaczniesz debugować własny nowy kod, sprawdź konsolę pod
kątem błędu hydratacji** — jeden taki błąd degraduje całą aplikację (traci renderowanie serwerowe,
gubi stan, rozstraja router), a objawy pojawiają się w zupełnie niezwiązanych miejscach.

## 2026-08-02 — Dotyk udaje najechanie i ZOSTAWIA ślad (`:hover` na ekranie dotykowym)
**Problem:** Checkbox zaznaczania zadania był ujawniany klasą `opacity-0 group-hover:opacity-100`.
Na telefonie dotknięcie wiersza w celu **przewinięcia listy** zapalało checkbox — i zostawiało go
zapalonym aż do dotknięcia gdzie indziej. Właściciel zgłosił to jako „checkboxy pojawiają się
i znikają w dziwnych momentach", co brzmi jak błąd stanu Reacta, a jest czystym CSS.
**Rozwiązanie:** Ujawnianie ograniczone do urządzeń z prawdziwym wskaźnikiem — wariant arbitralny
Tailwinda `[@media(hover:hover)]:group-hover:opacity-100`. Przy okazji wyszło drugie, cichsze
zachowanie: `opacity-0` **nie wyłącza zdarzeń wskaźnika**, więc niewidoczny checkbox był nadal
klikalny i dotknięcie „pustego" miejsca obok tytułu zaznaczało zadanie bez żadnego sygnału.
Doszło `pointer-events-none` w tej samej gałęzi.
**Lekcja:** Przeglądarka mobilna emuluje `:hover` po dotknięciu i **trzyma go**. Każde
`group-hover`/`hover:` ujawniające element interaktywny musi być zamknięte w `@media (hover: hover)`,
inaczej na telefonie zachowuje się losowo. I zawsze: element ukryty przez `opacity` nadal łapie
kliknięcia — ukrywanie wizualne to nie to samo co wyłączenie.

## 2026-08-02 — `rows` liczone po `\n` nie widzi zawijania tekstu
**Problem:** Pole edycji opisu zadania miało wysokość `rows={Math.max(3, description.split("\n").length)}`.
Wyglądało to na „rośnie razem z treścią", ale liczyło **wyłącznie znaki nowej linii**. Jeden długi
akapit bez `\n`, zawijający się na kilkanaście wierszy, dostawał `rows=3` i wewnętrzny pasek
przewijania — dokładnie to, na co narzekał właściciel.
**Rozwiązanie:** Pomiar rzeczywistej wysokości treści: `el.style.height = "auto"` i dopiero potem
`el.style.height = min(el.scrollHeight, 60vh)`. Reset do `"auto"` jest **obowiązkowy** —
`scrollHeight` nigdy nie jest mniejszy niż bieżąca wysokość elementu, więc bez niego pole rośnie
przy pisaniu, ale **nigdy nie maleje** przy kasowaniu tekstu. Dopasowanie odpalane z ref-callbacku
(synchronicznie po zamontowaniu, bez mrugnięcia) i z `onChange`.
**Lekcja:** Liczba wierszy tekstu ≠ liczba znaków nowej linii. Jedyne wiarygodne źródło wysokości
zawijanego tekstu to `scrollHeight` — i zawsze z resetem wysokości przed odczytem.

## 2026-08-02 — Nieodwracalne kasowanie pod ikoną bez potwierdzenia
**Problem:** Przycisk „Wyczyść (n)" na liście zakupów wołał `clearDoneItems`, które robi
`prisma.item.deleteMany({ where: { listId, status: "DONE" } })` — **twarde usunięcie, bez zapisu do
`TrashItem`**. Jedno przypadkowe dotknięcie ikony kosza kasowało bezpowrotnie wszystkie kupione
pozycje listy, bez pytania i bez możliwości odzyskania.
**Rozwiązanie:** Potwierdzenie w istniejącym `Modal` (wzorzec sąsiedniego „Zakończ zakupy" w tym
samym pliku), z **liczbą pozycji** i wprost napisaną informacją, że operacji nie da się cofnąć.
**Lekcja:** Zanim uznasz brak potwierdzenia za drobiazg UX, sprawdź, co akcja robi po stronie
serwera. Operacja zbiorcza + `deleteMany` + brak wpięcia w kosz = zmiana nieodwracalna, a przy
nieodwracalnych potwierdzenie jest wymogiem, nie ozdobą. Warto też traktować to jako sygnał: skoro
moduł ma kosz (`lib/trash.ts`), to akcja masowo kasująca dane jest kandydatem do soft-delete.

## 2026-08-02 — `useSearchParams` w powłoce aplikacji zabiera renderowanie po stronie serwera
**Problem:** Gwiazdka „dodaj do ulubionych" musi znać **pełny** adres bieżącej strony, razem
z `?query` (bo ulubiony widok to „projekt X w statusie Y"). Naturalny odruch to `useSearchParams()`.
Komponent siedzi jednak w `AppShell`, czyli **opakowuje każdą stronę aplikacji** — a w Next.js
App Router `useSearchParams` bez granicy Suspense spycha całe poddrzewo w renderowanie po stronie
klienta.
**Rozwiązanie:** Adres czytany z `window.location.pathname + window.location.search` w `useEffect`
zależnym od `usePathname()`. Pierwszy render nie zna query (gwiazdka jest wtedy nieaktywna przez
ułamek sekundy), co jest w pełni akceptowalne dla przycisku, a powłoka zostaje renderowana na
serwerze.
**Lekcja:** `useSearchParams` jest w porządku w liściu drzewa, ale w komponencie powłoki jest
kosztowny. Gdy potrzebujesz query wyłącznie do reakcji na zdarzenie użytkownika (a nie do
pierwszego renderu), przeczytaj je z `window.location` w efekcie.

## 2026-08-02 — Skrót z Altem zjada polskie znaki, bo AltGr to Ctrl+Alt
**Problem:** Ulubione widoki miały dostać skróty `Alt+1..9`. Naiwny warunek `if (e.altKey)`
przechwytywałby **wpisywanie polskich znaków**: na klawiaturze polskiej (programisty) `AltGr`
jest raportowany jako `ctrlKey && altKey`, więc `ą ć ę ł ń ó ś ź ż` to technicznie „Alt + litera".
W aplikacji, której cały interfejs jest po polsku, byłby to błąd trafiający w każdego użytkownika.
**Rozwiązanie:** Warunek `e.altKey && !e.ctrlKey && !e.metaKey` (czysty Alt) plus pominięcie
zdarzeń, gdy aktywny element to `input`/`textarea`/`contenteditable`. Dodatkowo cyfra czytana
z `e.code` (`"Digit1"`), a nie z `e.key` — przy wciśniętym Alt układ klawiatury potrafi zwrócić
w `key` znak specjalny zamiast cyfry.
**Lekcja:** `Alt` nie jest bezpiecznym modyfikatorem dla skrótów w aplikacji pisanej po polsku,
dopóki jawnie nie wykluczysz `ctrlKey`. Do identyfikacji klawisza fizycznego używaj `e.code`,
a nie `e.key`, który zależy od układu i modyfikatorów.

## 2026-08-02 — Nazwa ma opisywać zachowanie, nie „być jednolita"
**Problem:** Właściciel poprosił o ujednolicenie nazewnictwa: w Notatkach pojemniki nazywają się
„Grupy", więc może wszędzie powinny być „Foldery"? Kuszące było zamienić słowo w całej aplikacji.
**Rozwiązanie:** Rozstrzygnął **model danych**, nie estetyka. `Note.groupId` to pojedynczy klucz —
notatka leży w dokładnie jednym pojemniku, czyli w **folderze**. `ProjectGroup.projectIds` to lista —
projekt może należeć do wielu pojemników naraz, czyli do **grup**. Zmieniono więc tylko Notatki
(„Grupy" → „Foldery"), a Zadania zostały przy „Grupach projektów". Kuchnia („Książki kucharskie")
i Języki („Talie") zostały bez zmian jako nazwy dziedzinowe.
**Lekcja:** „Jednolite nazewnictwo" to jednolita **zasada**, a nie jedno słowo wszędzie. Jeśli
„folder" i „grupa" zachowują się inaczej (jedno miejsce vs wiele), użycie jednego słowa na oba
uczy użytkownika fałszywego modelu. Przed zmianą nazwy sprawdź kardynalność w schemacie.

## 2026-08-02 — Trzecia kolumna w siatce: `grid-row: span N` robi puste wiersze
**Problem:** Strona główna miała mieć układ 3 kolumn, gdzie trzecia (asystent) jest ciągła, a sekcje
płyną w dwóch pierwszych. Odruchowe rozwiązanie — `gridColumn: 3; gridRow: "1 / span 99"` —
kompiluje się i wygląda sensownie, ale tworzy 99 **wierszy domyślnych**; przy `gap` odstępy między
nimi sumują się w wielką pustą przestrzeń pod treścią.
**Rozwiązanie:** Asystent wyjęty z siatki: kontener to `flex` (`flex-col xl:flex-row`), w którym
pierwszym dzieckiem jest siatka sekcji (`flex: 1`), a drugim kolumna asystenta o stałej szerokości.
Siatka sekcji dostała `minmax(0, 1fr)`/`minWidth: 0`, bo domyślne `1fr` ma `min-width: auto` i długi
nieprzełamywalny tekst rozpycha ją w przewijanie poziome.
**Lekcja:** Do „jednej ciągłej kolumny obok płynącej treści" używaj flexa, nie `grid-row: span`.
A przy każdej siatce z treścią tekstową pamiętaj o `minmax(0, 1fr)` — inaczej `min-width: auto`
cicho psuje responsywność.

## 2026-08-02 — `NULL != NULL` w PostgreSQL, czyli „systemowy" wiersz bez ochrony
**Problem:** Tryb odświeżania sekcji AI miał mieć wartość domyślną systemową (ustawianą przez
administratora) i wartość per użytkownik. Naturalny wzorzec z tego repo („Dictionary Ownership
Levels") mówi: wiersz z pustym właścicielem = rekord systemowy. Tabela ma `@@unique([ownerId,
sectionKind])`, więc wyglądało to na rozwiązane.
**Rozwiązanie:** W PostgreSQL `NULL` nie jest równy `NULL`, więc indeks unikalny **nie chroni**
wierszy, w których kolumna jest `NULL` — dałoby się wstawić dowolnie wiele „systemowych" wierszy dla
tej samej sekcji, a odczyt brałby losowy. Zamiast obchodzić to indeksem częściowym, domyślne
systemowe poszły do jednego klucza w `Config` (`ai_section_default_modes`, JSON) — tą samą drogą, co
`assistant_followups_enabled` (0214) i `ai_cost_badge_enabled` (0215). Efekt uboczny jest zaletą:
zapis użytkownika i zapis administratora to dwie **rozłączne** tabele, więc „moje" nigdy nie nadpisuje
„systemowego" z konstrukcji, a nie przez warunek, który łatwo zgubić przy kolejnej sekcji.
**Lekcja:** Zanim oprzesz „rekord systemowy" na `NULL` w kluczu unikalnym, sprawdź, czy ten klucz w
ogóle działa dla `NULL`. W PostgreSQL nie działa. Dla pojedynczej wartości globalnej `Config` jest
prostszy i uczciwszy niż wiersz-widmo w tabeli użytkowników.

## 2026-08-02 — Komponent kliencki nie może zaimportować pliku, który dotyka Prismy
**Problem:** `sectionMode.ts` powstał jako jeden plik: typ trybu, etykiety po polsku i funkcje
czytające bazę (`resolveSectionMode`). Etykiet potrzebował `AiContentMeta` — komponent `"use client"`.
Import etykiety ciągnie CAŁY moduł, więc do przeglądarki poszłaby też Prisma.
**Rozwiązanie:** Podział na dwa pliki: `sectionMode.ts` (czysty słownik pojęć — typ, etykiety, lista
sekcji, strażnik typu) i `sectionModeResolver.ts` (wszystko, co czyta bazę). Ten sam podział, który
w repo już istnieje: `lib/llm/effort.ts` kontra `lib/llm/resolver.ts`.
**Lekcja:** Przy nowym module pomocniczym od razu zadaj pytanie „czy klient będzie tego potrzebował".
Jeśli tak — stałe i typy idą do osobnego, czystego pliku. Import **typu** (`import type`) jest
bezpieczny w obie strony, bo znika przy kompilacji; import **wartości** przenosi cały graf zależności.

## 2026-08-02 — „Czeka na kliknięcie" musi być osobnym typem, nie pustym wynikiem
**Problem:** Sekcje AI miały przestać generować treść przy samym wejściu na stronę. Najprostsze
podejście to zwracać pustą treść i pozwolić UI się domyślić. Dokładnie ten skrót zemścił się w 038:
awaria i „nic nie znaleziono" wyglądały tak samo, więc użytkownik ponawiał w nieskończoność.
**Rozwiązanie:** `rememberedContent` zwraca **drugi wariant typu** (`PendingContent` z `pending:
true`), który w ogóle nie ma pola `value`. Kompilator wymusza obsłużenie tego stanu, zanim ktokolwiek
sięgnie po treść. Oba warianty rozdzielają **przeciążenia**: wywołanie bez trybu nigdy nie zwróci
oczekiwania, więc pięć istniejących miejsc dało się przełączać pojedynczo, a nie jednym commitem.
**Lekcja:** Gdy dokładasz do wyniku nowy STAN (a nie nową wartość), zrób z niego osobny wariant typu.
Flaga obok pustej wartości pozwala go zignorować; brak pola `value` — nie pozwala. A przeciążenia są
tanim sposobem, żeby zmiana sygnatury nie wymusiła jednego wielkiego commita.

## 2026-08-01 — `flex-1` z `truncate`, ale bez `min-w-0` — czyli poziomy scroll „nie wiadomo skąd"
**Problem:** Na telefonie moduł Wiadomości dawał się przewijać w bok, choć po prawej stronie nic nie
było widać. Zgłoszenie brzmiało: „może coś rozciąga stronę za daleko w prawo, ale nie widać nawet
co". Szukanie „co wystaje" na oko nie dawało nic, bo faktycznie nic nie wystawało.
**Rozwiązanie:** Winowajcą był `<span className="flex-1 truncate">` z adresem RSS w ustawieniach
źródeł. Element `flex-1` dostaje `min-width: auto`, więc **nie potrafi zwęzić się poniżej swojej
treści** — długi adres ustawiał minimalną szerokość wiersza, a ten rozpychał całą stronę. `truncate`
(`overflow: hidden` + `text-overflow`) nigdy nie miał czego przycinać, bo element zawsze był dokładnie
tak szeroki jak tekst. Naprawą jest jedno `min-w-0` na tym elemencie — nie `overflow-x-hidden` na
kontenerze strony, bo to zamiata przyczynę pod dywan i psuje przewijanie czegokolwiek w środku.
**Lekcja:** `truncate` na dziecku flexa **nie działa bez `min-w-0`** — to nie jest ozdoba, tylko
warunek konieczny. I druga rzecz, diagnostyczna: gdy strona przewija się w bok, a „nic nie wystaje",
podejrzewaj element, który sam się nie pokazuje, tylko **ustawia minimalną szerokość** rodzicowi.
Tekst ucina wtedy krawędź ekranu, a nie CSS — więc wzrokowo wszystko wygląda poprawnie.

## 2026-08-01 — Postgres w piaskownicy nie przeżywa restartu procesu sesji
**Problem:** Po restarcie procesu roboczego sesji `npm run test:unit` pokazał 30 czerwonych testów,
których wcześniej nie było. Wyglądało to na regresję po zmianach w kolejce zadań i module Wiadomości
— akurat tam, gdzie dotykałem schematu bazy.
**Rozwiązanie:** To nie była regresja. Testy DB-gated pomijają się po cichu, gdy `DATABASE_URL` nie
jest ustawiony (`skip: !HAS_DB`), więc wcześniejsze „514 passed, 0 failed" oznaczało 27 testów
**pominiętych**, a nie przechodzących. Gdy wyeksportowałem `DATABASE_URL` do bramek, testy się
odpaliły — ale lokalny Postgres nie żył po restarcie procesu (`pg_isready` → „no response",
`pg_ctlcluster 16 main start` zgłosił „Removed stale pid file"). Po podniesieniu bazy: 560/560.
**Lekcja:** Przy nagłej fali czerwonych testów sprawdź NAJPIERW, czy zmieniło się środowisko, a nie
kod — zwłaszcza gdy liczba testów w podsumowaniu też się zmieniła (514 → 517 → 560). Rosnąca liczba
testów przy tym samym drzewie kodu znaczy, że coś, co dotąd było pomijane, właśnie zaczęło się
wykonywać. I drugie: „0 failed" przy niezerowym „skipped" to nie jest zielony wynik, tylko wynik
częściowy — podsumowanie trzeba czytać w całości.

## 2026-08-01 — Pobieranie per temat zamiast wspólnej puli mnoży koszt przez liczbę tematów
**Problem:** Moduł Wiadomości odświeżał się „per temat": dla każdego tematu przechodził po wszystkich
źródłach i pobierał każdy kanał RSS. Przy 3 tematach i 5 źródłach to 15 pobrań tego samego materiału,
a gorące tematy pobierały wszystko jeszcze raz przy każdym wejściu na zakładkę — łącznie ~20 pobrań
na cykl. Do tego każde źródło szło osobnym wywołaniem modelu z całym stanem wiedzy w prompcie.
**Rozwiązanie:** Rozcięcie „pobrania" od „analizy". Każde źródło pobierane RAZ do wspólnej puli
(`NewsArticle`), potem JEDNO tanie wywołanie (`dispatch`) przypisuje całą pulę do wszystkich tematów
naraz, a droższe modele pracują dopiero na wybranym materiale. Gorące tematy czytają pulę, więc
wejście na widok nie kosztuje ani jednego żądania do portali.
**Lekcja:** Gdy pętla wygląda jak `dla każdego X: dla każdego Y: pobierz Y`, sprawdź, czy Y naprawdę
zależy od X. Jeśli nie — to nie jest pętla, tylko ten sam zasób pobierany N razy. Koszt takiego
układu rośnie iloczynem, a nie sumą, i widać go dopiero przy kilku pozycjach w każdym wymiarze.

## 2026-08-01 — Wskaźnik postępu w pamięci komponentu znika przy odświeżeniu strony
**Problem:** Wieloetapowe odświeżanie ma pokazywać, na czym stoi („Pobieram źródła (3/5)…"). Stan
etapu naturalnie ląduje w `useState` komponentu — i wtedy odświeżenie strony albo przejście na inną
zakładkę kasuje go, choć przebieg leci dalej. Użytkownik wraca i widzi ekran, który udaje, że nic
się nie dzieje.
**Rozwiązanie:** Etap musi mieszkać tam, gdzie mieszka sama praca — w kolejce. Kolumna `Job.progress`
(migracja 0218), `ctx.progress(text)` w handlerze, zwrot etapu przez `GET /api/jobs/[id]`. Kolumna
trafiła do `Job`, a nie do tabel modułu, bo to brak warstwy kolejki: każdy wieloetapowy handler ma
ten sam problem. Zapis etapu jest świadomie nieblokujący i połyka błąd — utrata podpisu pod paskiem
postępu nie jest powodem, żeby zmarnować całą, kosztowną pracę handlera.
**Lekcja:** Jeśli praca przeżywa zamknięcie strony, to jej stan też musi. Odwrotnie: stan trzymany w
komponencie jest obietnicą, że praca kończy się razem z widokiem — a przy zadaniach w tle to
nieprawda. I jeszcze: dopisanie kolumny do już zastosowanej migracji rozjeżdża sumę kontrolną
(`migrate deploy` odpali plik drugi raz), więc korekta idzie NOWĄ migracją, nawet gdy stara jest
sprzed kilku minut.

## 2026-07-31 — Awaria zapisana do pamięci podręcznej udaje deterministyczny brak wyników
**Problem:** Sekcja „Co robić?" w Pogodzie zwracała „Brak propozycji na tę porę". Właściciel próbował
ponad pięć razy — za każdym razem to samo. Powtarzalność sugerowała, że model po prostu nic nie
wymyśla dla tych warunków, czyli błąd w prompcie albo w danych pogodowych.
**Rozwiązanie:** Powtarzalność była **objawem, nie wskazówką**. Łańcuch: budżet 1200 tokenów
okazał się za mały (przy modelu rozumującym tokeny rozumowania wliczają się do tego samego limitu),
więc odpowiedź była **ucięta** w połowie JSON-a → `parseJsonLoose` zwracał `null` → kod robił
`parsed?.ideas ?? []`, zamieniając awarię w pustą listę → UI pokazywało „Brak propozycji". A kluczowe:
`chatComplete` zapisywał odpowiedź do pamięci podręcznej **bez sprawdzenia flagi `truncated`, którą
sam wystawia**. Uszkodzona treść wracała więc z cache przy każdej kolejnej próbie — natychmiast i
identycznie. Naprawa trzywarstwowa: nie cache'ujemy odpowiedzi uciętych (to naprawia WSZYSTKICH
konsumentów `cache: true`, nie tylko Pogodę), `truncated` i nieparsowalny JSON rzucają błąd zamiast
zwracać pustkę, a UI ma osobny, wyraźny stan awarii.
**Lekcja:** Gdy błąd jest **idealnie powtarzalny**, sprawdź najpierw, czy nie patrzysz na zapamiętany
wynik — cache potrafi zamienić jednorazową awarię w pozornie deterministyczne zachowanie i wysłać cię
w pościg za nieistniejącą przyczyną. Druga rzecz, ważniejsza: `?? []` na wyniku parsowania to
**zamiatanie awarii pod dywan**. Pusty wynik i nieudany odczyt muszą być rozróżnialne, bo dla
użytkownika „nie ma pomysłów" i „coś się zepsuło" to dwa zupełnie różne komunikaty — a pierwszy
skłania go do bezsensownego ponawiania.

## 2026-07-31 — `onClick={fn}` przekazuje zdarzenie jako pierwszy argument
**Problem:** Po dodaniu opcjonalnego parametru `force` do funkcji ładującej treść
(`loadTips(force = false)`) TypeScript zaczął protestować na istniejącym `onClick={loadTips}`.
**Rozwiązanie:** React przekazuje do handlera obiekt zdarzenia, więc `onClick={loadTips}` wołało
`loadTips(mouseEvent)` — a obiekt zdarzenia jest **prawdziwy**, więc `force` byłby zawsze włączony i
każde kliknięcie wymuszałoby generowanie od nowa, niwecząc całą oszczędność. Poprawka:
`onClick={() => loadTips()}`.
**Lekcja:** Dokładając opcjonalny parametr do funkcji używanej jako handler zdarzenia, przejrzyj
wszystkie miejsca przekazane „przez referencję". Ten błąd nie objawia się wywaleniem, tylko cichym
włączeniem opcji — tutaj wykrył go kompilator, ale gdyby parametr był typu `unknown` albo `any`,
przeszedłby niezauważony aż do rachunku za tokeny.

## 2026-07-31 — „Sprzyja" przy mokrym weekendzie: zły status to był efekt źle postawionego pytania
**Problem:** Obserwator pogody „Bardzo mokry weekend" pokazywał status **Sprzyja** z uzasadnieniem
„weekend suchy". Wyglądało to na halucynację modelu — dwa zdania na kafelku wprost sobie przeczyły.
**Rozwiązanie:** Model nie zmyślał. Prompt kazał mu ocenić skalę `good (warunki sprzyjające) / warn /
bad / info`, więc dla obserwatora opisującego zjawisko **negatywne** (mokry weekend, przymrozki,
burze, upały) sucha prognoza to poprawnie „good" — a UI tłumaczyło `good` na „Sprzyja". Naprawa nie
polegała na dokręceniu promptu w tej samej skali, tylko na zmianie **pytania**: status opisuje teraz
`met/partial/unmet/unknown` („czy warunek obserwatora zachodzi"), a prompt dostał dwa przykłady
graniczne — mokry weekend przy suchej prognozie to `unmet`, burza przy obserwatorze burz to `met`,
„mimo że to zła wiadomość".
**Lekcja:** Gdy odpowiedź modelu przeczy sama sobie, najpierw sprawdź, **o co go pytasz**, a nie jak
mocno go prosisz. Skala wartościująca („sprzyja/odradzane") nałożona na obiekt, który sam bywa
negatywny, produkuje sprzeczność przy każdej poprawnej odpowiedzi. Druga rzecz: neutralna skala
wymaga podpowiedzi w UI — zielone „Spełnione" przy nadchodzącej burzy myli tak samo, dopóki nie
napiszesz wprost, że zieleń znaczy „zgodnie z Twoim pytaniem", a nie „dobrze".

## 2026-07-31 — Bramka widoczności kosztu AI nie może żyć tam, gdzie nie ma sesji
**Problem:** Licznik kosztu miał się pokazywać wszędzie, gdzie moduł woła model. Naturalne wydawało
się wpięcie bramki (`visibleUsage`, pytającej `auth()` o uprawnienie admina) tam, gdzie zużycie
powstaje — czyli również w handlerach zadań w tle (`lib/jobs/handlers/*`).
**Rozwiązanie:** Handlery chodzą w workerze **bez sesji użytkownika**, więc `auth()` zwraca tam
`null` i bramka zawsze zgasiłaby licznik — analityka magazynu, plan tygodnia i OCR nigdy nie
pokazałyby kosztu, bez żadnego błędu w logach. Rozdzieliliśmy więc **wytwarzanie** zużycia od
**decyzji o pokazaniu**: handler zapisuje surowe zużycie w `Job.result`, a `GET /api/jobs/[id]` —
jedyne miejsce z sesją — stosuje `visibleUsage` przy odczycie i usuwa pole, gdy pokazać go nie wolno.
**Lekcja:** Zanim wpniesz kontrolę dostępu w jakiś punkt kodu, sprawdź, **czy w tym punkcie w ogóle
istnieje tożsamość użytkownika**. Kod w tle jej nie ma, a bramka bez sesji nie wywala się głośno —
po prostu zawsze odmawia, co wygląda jak „funkcja nie działa". Reguła praktyczna: dane wytwarzaj przy
źródle, filtruj na granicy odczytu.

## 2026-07-31 — Zwykły cudzysłów w polskim tekście zamyka literał JS
**Problem:** Dwa razy pod rząd `tsc` sypnął serią błędów składni („Unterminated string literal") po
dopisaniu polskiego tekstu do promptu i do stanu pustego w JSX.
**Rozwiązanie:** Polskie cudzysłowy to para **„…”** (U+201E i U+201D). Otwierający „ jest bezpieczny,
ale jako zamykający łatwo wpisać zwykłe `"` — i wtedy w literale `"...„Co robić?" ..."` ten znak
kończy string, a reszta zdania staje się kodem. Poprawka: konsekwentnie ” jako zamykający.
**Lekcja:** W tym repo teksty są po polsku i cudzysłowy trafiają do stringów TS oraz do JSX. Pisząc
cytat wewnątrz literału, użyj pary typograficznej „…” — nie mieszaj jej z `"`. Ten sam znak w treści
JSX dodatkowo zapala `react/no-unescaped-entities`, więc pomyłkę widać dopiero na lincie.

## 2026-07-31 — Nie animuj `top` elementu `fixed` przy klawiaturze: przeglądarka robi to sama
**Problem:** Po wygładzeniu przejścia CSS okno asystenta nadal „szarpało", choć skoku już nie było.
Pierwsza miara z nagrania (najciemniejszy wiersz w pasie) pokazała oscylację — ale ta miara potrafi
przeskakiwać między sąsiednimi liniami tekstu i udawać ruch, więc nie nadawała się na dowód.
**Rozwiązanie:** Powtórzony pomiar korelacją znormalizowaną między kolejnymi klatkami (z oceną
jakości dopasowania, ufamy tylko wynikom ≥0,97): treść wykonuje wahadło o amplitudzie 80–130 px przez
~14 klatek i **sumuje się do zera** (+1 px na koniec). Skoro treść okna jest wyrównana do góry,
animacja `height` nie może nią ruszać — oscylowała więc górna krawędź, czyli `top`. Przyczyna:
przeglądarka SAMA przesuwa element `position: fixed`, gdy jedzie widoczny obszar; nasza
280-milisekundowa animacja `top` ciągnęła go równolegle, obie korekty się sumowały i znosiły. Naprawa:
animujemy WYŁĄCZNIE `height`, `top` wraca do zapisu natychmiastowego.
**Lekcja:** Zanim zaczniesz animować właściwość elementu `position: fixed` na mobile, sprawdź, czy
przeglądarka już jej nie animuje za Ciebie — dwie korekty tej samej wielkości nie dodają płynności,
tylko tworzą dzwonienie. I metodycznie: **suma przesunięć równa zeru to sygnatura konfliktu**, nie
niedokończonego ruchu; jeśli element wraca dokładnie tam, gdzie zaczął, szukaj drugiej siły, a nie
złego czasu trwania. Trzecia rzecz: pierwszą wersję pomiaru trzeba było odrzucić — miara oparta na
„najciemniejszym wierszu" nie odróżnia ruchu od zmiany treści, korelacja z oceną jakości odróżnia.

## 2026-07-31 — „Płynna" dolna część okna była złudzeniem: obraz czasoprzestrzenny zamiast wrażeń
**Problem:** Zgłoszenie brzmiało: kompozytor (dół okna asystenta) przesuwa się przy klawiaturze
płynnie, a nagłówek skacze — więc może da się zadokować nagłówek „tak samo, pasywnie". Trop wyglądał
bardzo sensownie i prowadziłby do szukania nieistniejącego mechanizmu.
**Rozwiązanie:** Z nagrania ekranu zbudowany **obraz czasoprzestrzenny**: z każdej klatki wycięty ten
sam wąski pionowy pasek, sklejone w poziomie (oś X = czas, Y = pozycja na ekranie). Tor każdej
poziomej krawędzi staje się wtedy linią, którą widać gołym okiem. Wynik: gładkie łuki rysuje
WYŁĄCZNIE sama klawiatura; linie kompozytora urywają się i pojawiają na nowej wysokości dokładnie tak
samo skokowo jak nagłówek. Wrażenie płynności brało się stąd, że skok kompozytora ląduje tam, gdzie
dojeżdża klawiatura — oko śledzi klawiaturę i scala oba ruchy. Nie było czego kopiować.
**Lekcja:** Gdy dwa elementy „zachowują się inaczej", nie szukaj różnicy w kodzie, zanim nie
zmierzysz, czy ta różnica w ogóle istnieje. Obraz czasoprzestrzenny z nagrania (ffmpeg + kilkanaście
linii w PIL) kosztuje minuty i zamienia „widzę, że tamto jest płynne" w twardy tor ruchu. Druga
lekcja, z tej samej tury: utrzymywanie dołu listy CO KLATKĘ podczas animowanej zmiany wysokości samo
tworzy artefakt (~17 wymuszonych przewinięć w trakcie 280 ms) — treść przeskakuje w innym rytmie niż
ramka. Pinowanie ma sens na starcie zmiany i po jej zakończeniu, nie w środku.

## 2026-07-31 — iOS podaje ruch klawiatury JEDNYM skokiem: brakujące klatki trzeba dorysować samemu
**Problem:** Osiem podejść do drgającego nagłówka asystenta (kompensacja `offsetTop`, zapis w
zdarzeniu, `resizes-content`, `h-full`, `overflow: hidden`, wysokość powłoki z pomiaru, pętla `rAF`)
i za każdym razem to samo pytanie bez odpowiedzi: czy problem jest w danych, które dostajemy, czy w
tym, co z nimi robimy. Rozważano nawet próbkowanie co 10 ms zamiast co klatkę.
**Rozwiązanie:** Sonda dostała dwa liczniki dla pojedynczego ruchu klawiatury: `kroki` (ile RÓŻNYCH
wartości `offsetTop` przyszło) i `maxSkok` (największa różnica między kolejnymi). Odczyt z urządzenia:
**`kroki 1`, `maxSkok 291`** — iOS zmienia geometrię DOKŁADNIE RAZ, od razu o pełne 291 px, i nie
podaje ani jednej wartości pośredniej, choć klawiatura jedzie płynnie ~0,3 s. Nasze okno dostawało
więc końcową geometrię w jednej klatce i teleportowało się do niej w trakcie jazdy klawiatury. Skoro
brakujących klatek nikt nam nie da, dorysowujemy je sami: przejście CSS (280 ms, krzywa
wyhamowująca) na `top`/`height`, włączane dopiero po pierwszym zapisie geometrii, żeby nie animować
samego otwarcia okna. Pętla `rAF` zostaje, ale w innej roli: utrzymuje dół rozmowy przez czas trwania
przejścia i obsłuży przeglądarki raportujące ruch stopniowo.
**Lekcja:** Zanim zaczniesz stroić CZĘSTOTLIWOŚĆ (co klatkę? co 10 ms?), zmierz **rozdzielczość
źródła** — ile różnych wartości w ogóle przychodzi. Przy `kroki 1` każde próbkowanie, od 1 ms do 16 ms,
zwraca ten sam wynik, więc cała dyskusja o szybkości jest bezprzedmiotowa. Dwa liczniki (ile zmian,
jak duży skok) kosztowały kilkanaście linii i rozstrzygnęły to, czego osiem prób nie rozstrzygnęło.
Ogólniej: gdy nie wiadomo, czy winne są dane, czy ich obsługa, tanim pomiarem jest policzenie zdarzeń
na wejściu — nie kolejna zmiana na wyjściu.

## 2026-07-31 — iOS nie wysyła zdarzeń `visualViewport` co klatkę: korektę trzeba domknąć pętlą `rAF`
**Problem:** Nagłówek asystenta drgał przy animacji klawiatury mimo poprawnej geometrii — sonda
pokazywała `okno.top` równe 0.0 w KAŻDEJ klatce, także tam, gdzie na ekranie widać przesunięcie.
Wniosek „to kompozytor rysuje w złym miejscu, z JavaScriptu się tego nie dogoni" był przedwczesny.
**Rozwiązanie:** iOS wysyła zdarzenia `visualViewport` na POCZĄTKU i KOŃCU ruchu, a nie co klatkę.
Korekta wpięta wyłącznie w zdarzenia zostawia więc cały środek animacji z geometrią sprzed ruchu — a
`okno.top` wychodziło 0.0 dlatego, że między zdarzeniami po prostu nie było czego zmieniać, nie
dlatego, że wszystko było dobrze. Po każdym zdarzeniu (oraz po `focusin`/`focusout` w oknie) domykamy
ruch ograniczoną w czasie pętlą `requestAnimationFrame` (500 ms, z pominięciem klatek bez zmiany
wartości, żeby nie pisać stylu i nie wołać `onGeometryChange` 60 razy na sekundę bez potrzeby).
**Lekcja:** Zanim ogłosisz „przeglądarka rysuje źle, nic nie zrobimy", sprawdź, czy Twój kod w ogóle
miał szansę cokolwiek zrobić w tych klatkach. Dowód leżał pod ręką przez cały czas: sonda
diagnostyczna czyta w `rAF` **z komentarzem, że zdarzenia mogą nie pokryć klatek animacji** — i ten
sam wniosek nie został zastosowany do samej korekty. Druga rzecz: cudza podpowiedź potrafi w 90%
opisywać stan już wdrożony; wartość jest w tych 10%, więc zestaw ją punkt po punkcie z kodem, zamiast
wdrażać w całości („przebuduj architekturę") albo odrzucać w całości.

## 2026-07-31 — Sprawdź `min-height` flexa, ZANIM go dodasz: `overflow: auto` już to załatwia
**Problem:** Podejrzenie, że wiersz wiadomości w oknie asystenta nie kurczy się przy klawiaturze, bo
brakuje mu `min-h-0` (klasyczna pułapka: element flexa ma domyślnie `min-height: auto` i odmawia
zejścia poniżej rozmiaru treści, przez co rozpycha kontener).
**Rozwiązanie:** Nie było czego naprawiać. Specyfikacja flexboxa (§4.5) stosuje automatyczny rozmiar
minimalny **tylko wtedy, gdy `overflow` w danej osi jest `visible`** — a lista ma `overflow-y: auto`,
co samo zeruje to minimum. `min-h-0` byłoby tu martwym kodem udającym naprawę.
**Lekcja:** `min-h-0` obok `overflow-auto` to odruch przepisywany z poradników. Zanim dołożysz „na
wszelki wypadek" regułę pod diagnozę, sprawdź, czy warunek z definicji w ogóle zachodzi — inaczej
zostaje w kodzie linijka, która niczego nie robi, a przy następnym błędzie sugeruje, że temat jest
już obsłużony.

## 2026-07-31 — `height: 100%` też nie pomogło: układ kurczy się, ale blok bazowy już nie
**Problem:** Zamiana `h-screen` na `h-full` w powłoce aplikacji miała odebrać dokumentowi
przewijalność przy klawiaturze. Pomiar po zmianie: `scrollY` spadło z 335 tylko do **291** — dokument
nadal przewijalny — a przy schowanej klawiaturze pojawił się jasny pasek u dołu ekranu, bo
`visualViewport.height` zaczęło zaniżać wysokość o ~44 px.
**Rozwiązanie:** Liczby tłumaczą, dlaczego: przy `interactive-widget=resizes-content` Safari zmniejsza
`window.innerHeight` (812 → 477), ale **blok bazowy (ICB) zostaje przy dawnej wysokości**, więc
`html { height: 100% }` to nadal 768 px. Nadwyżka 768 − 477 = **291** — dokładnie zmierzone `scrollY`.
Sama wysokość procentowa więc nie wystarczy. Zamiast tego blokujemy przewijanie wprost: `overflow:
hidden` na elemencie `html` na czas otwartego okna pełnoekranowego (przywracane przy zamknięciu).
**Lekcja:** „Zmniejszony układ" nie znaczy „zmniejszony blok bazowy" — `innerHeight`, `100vh`, `100%`
i `visualViewport.height` potrafią rozjechać się we WSZYSTKICH kombinacjach. Nie licz na to, że jedna
jednostka załatwi sprawę; jeśli celem jest „dokument ma się nie przewijać", powiedz to wprost przez
`overflow`, zamiast liczyć na arytmetykę wysokości. I mierz po każdej zmianie — ta „naprawa" wyglądała
poprawnie w rozumowaniu, a wprowadziła nowy defekt widoczny gołym okiem.

## 2026-07-31 — `100vh` nie kurczy się przy `resizes-content`, więc dokument stawał się przewijalny
**Problem:** Nagłówek asystenta wciąż drgał przy klawiaturze, mimo ustawienia
`interactive-widget=resizes-content`. Pięć podejść „na wyczucie" nie trafiło w przyczynę.
**Rozwiązanie:** Nakładka diagnostyczna z odczytem geometrii co klatkę (`ViewportProbe`) dała liczby,
które rozstrzygnęły sprawę **co do piksela**:
```
spoczynek:   vv.h 812  vv.top 0    win.h 812  scrollY 0
klawiatura:  vv.h 477  vv.top 291  win.h 477  scrollY 335
```
`win.h` spadło z 812 na 477 — czyli **Safari HONORUJE `resizes-content`** i zmniejsza układ strony.
Ale powłoka aplikacji (`AppShell`) miała `h-screen`, czyli `100vh`, a `vh` odnosi się do „dużego"
widoku i **zostaje 812**. Powłoka wystawała więc 335 px poza układ, dokument stawał się przewijalny
i iOS przewijał go dokładnie o tę nadwyżkę: `scrollY` = 335 = 812 − 477. To przewinięcie ciągnęło za
sobą elementy `position: fixed` — stąd drgnięcie. Naprawa: `h-screen` → `h-full` (`height: 100%`),
bo `%` śledzi układ (`html, body { height: 100% }`), więc nie ma czego przewijać.
**Lekcja:** `100vh` i `100%` to NIE to samo, gdy układ strony może się kurczyć. Przy
`interactive-widget=resizes-content` (albo dowolnej zmianie układu) `vh` zostaje przy „dużym" widoku
i cicho robi z dokumentu element przewijalny — a na iOS przewijanie ciągnie za sobą `position: fixed`.
Dla powłok pełnoekranowych używaj `height: 100%` (albo `100dvh`), nigdy `100vh`.
**Lekcja metodyczna:** trzy zgadywanki kosztowały jeden regres; jedna nakładka wypisująca liczby co
klatkę rozstrzygnęła wszystko w pięć minut. Przy błędach widocznych tylko na urządzeniu **najpierw
zbuduj pomiar**, potem naprawiaj.

## 2026-07-31 — Nie ścigaj przesunięcia widocznego obszaru — powiedz przeglądarce, żeby go nie robiła
**Problem:** Nagłówek asystenta drgał przy każdym wysunięciu klawiatury. Trzy podejścia (kompensacja
przez `rAF`, kompensacja synchroniczna, brak kompensacji) nie usunęły drgnięcia, bo wszystkie
próbowały ŚCIGAĆ zmianę, która dzieje się poza nami. Porównanie z aplikacją, gdzie nagłówek stoi jak
wmurowany, pokazało skalę różnicy: u nas znikał na ~8 klatek.
**Rozwiązanie:** Źródłem kłopotu jest domyślne zachowanie `interactive-widget=resizes-visual`: układ
strony zostaje tej samej wysokości, a przeglądarka PRZESUWA widoczny obszar, żeby odsłonić pole
tekstowe. Element `position: fixed` liczy się względem układu, więc wyjeżdża poza ekran, a każda
korekta z `visualViewport` spóźnia się o kilka klatek. Ustawienie `interactiveWidget:
"resizes-content"` (Next: `export const viewport`) sprawia, że kurczy się sam UKŁAD — pole tekstowe
nigdy nie jest pod klawiaturą, więc przeglądarka nie ma po co niczego przesuwać, a `offsetTop`
zostaje zerem. Wskazówka jest ignorowana przez przeglądarki, które jej nie znają, więc dotychczasowa
kompensacja zostaje jako zabezpieczenie.
**Lekcja:** Zanim napiszesz kod kompensujący zachowanie przeglądarki, sprawdź, czy nie da się tego
zachowania **wyłączyć deklaratywnie**. Ściganie animacji przeglądarki z JS zawsze przegrywa o klatkę.
Uwaga metodyczna: porównanie „u nich działa" bywa mylące — referencyjna aplikacja okazała się
NATYWNA, więc dostaje geometrię klawiatury od systemu i nie ma tego problemu w ogóle. Warto to
najpierw ustalić, żeby wiedzieć, czy porównanie jest uczciwe.

## 2026-07-30 — Wniosek z jednej klatki okazał się fałszywy: kompensacja `offsetTop` jest KONIECZNA
**Problem:** Na podstawie jednej klatki (strona widoczna NAD oknem asystenta) uznałem, że winna jest
nasza kompensacja `top: visualViewport.offsetTop`, i ją usunąłem. Efekt: znacznie gorzej. Drugie
nagranie pokazało, że przy otwartej klawiaturze okno stoi **~360 px za wysoko** — widać z niego tylko
pole tekstowe, a pod spodem całą stronę z kafelkami i dolnym paskiem zakładek. I to nie w trakcie
animacji, tylko w stanie USTALONYM.
**Rozwiązanie:** Kompensacja wróciła. iOS potrafi zostawić widoczny obszar przesunięty na stałe przy
otwartej klawiaturze, a element `position: fixed` liczy się względem UKŁADU strony — bez `top:
offsetTop` renderuje się o to przesunięcie za wysoko. To, co widziałem na tamtej klatce, było
zjawiskiem PRZEJŚCIOWYM (zdarzenie `visualViewport` wyprzedza realne przesunięcie o kilka klatek),
a nie dowodem, że kompensacja jest zbędna.
**Lekcja:** Nie uogólniaj z **jednej klatki animacji** na stan ustalony — to dwa różne reżimy.
Zanim usuniesz istniejącą kompensację, sprawdź osobno, jak wygląda stan SPOCZYNKU bez niej; „skoro
w trakcie animacji przeszkadza, to jest zbędna" jest błędem wnioskowania. Przy diagnozie z nagrania
rozdzielaj klatki przejściowe od ustalonych i opisuj każdy reżim osobno.

## 2026-07-30 — To nasza „kompensacja" spychała okno, a nie przeglądarka — rozstrzygnięte z nagrania ekranu
**Problem:** Mimo dwóch podejść okno asystenta nadal przeskakiwało przy rozwijaniu i zwijaniu
klawiatury. Opis słowny („wyjeżdża ponad ekran i się poprawia") pasował do kilku różnych przyczyn.
**Rozwiązanie:** Właściciel nagrał ekran iPhone'a. Film rozłożony na klatki (ffmpeg z pakietu
`imageio-ffmpeg`, bo w obrazie nie ma ffmpeg) + analiza dopasowaniem wzorca pokazały: stany spoczynku
są POPRAWNE, a cała wada mieści się w ~0,3–0,5 s animacji. Rozstrzygająca była jedna klatka: nad
oknem asystenta widać **kartę pulpitu ze strony pod spodem**. Przesunięcie widocznego obszaru przez
przeglądarkę nie może tego zrobić — rusza okno i stronę RAZEM. Odsłonić stronę nad oknem mógł tylko
nasz własny `top: visualViewport.offsetTop`: na czas animacji `offsetTop` skacze do wartości rzędu
wysokości klawiatury, a my posłusznie spychaliśmy okno o tyle w dół. Naprawa: sterujemy **wyłącznie
wysokością** (`--vv-height`), `top` zostaje zerowy. Przeglądarka sama trzyma element `fixed` przy
widocznym obszarze, a w spoczynku `offsetTop` wraca do zera — kompensacja nic nie dawała, a psuła.
**Lekcja:** Przy błędach widocznych tylko na urządzeniu **poproś o nagranie ekranu i analizuj klatki**
— to tańsze niż kolejne podejście „na wyczucie" (tu: trzy nieudane). I nie „kompensuj" tego, co
przeglądarka robi sama: zanim dodasz korektę pozycji, sprawdź, czy bez niej cokolwiek jest nie tak.
Odruch „skoro API podaje `offsetTop`, to trzeba go odjąć/dodać" jest tu wprost szkodliwy.

## 2026-07-29 — Okno „skacze" przy klawiaturze, bo korekta układu idzie przez stan Reacta
**Problem:** Po przypięciu okna asystenta do `visualViewport` przy rozwijaniu i zwijaniu klawiatury
było widać przeskok: okno najpierw wyjeżdżało w górę ponad ekran, a chwilę później wracało na miejsce
i poprawiało wysokość. W innych aplikacjach z czatem nic takiego się nie dzieje.
**Rozwiązanie:** Element `position: fixed` jest pozycjonowany względem UKŁADU strony, a iOS przy
klawiaturze przesuwa **widoczny obszar** względem tego układu — więc okno realnie wyjeżdża nad ekran
i musi zostać skorygowane. Korekta szła przez `requestAnimationFrame` → `setState` → render, czyli
trafiała do stylu **klatkę (albo więcej) później** — dokładnie tyle, ile trwa widoczny przeskok.
Naprawa: geometrię pisze do elementu sam hook, **synchronicznie w obsłudze zdarzenia**
`visualViewport` (`usePinToVisualViewport`). Żeby React nie nadpisywał świeżych wartości przy
kolejnych renderach, `top`/`height` idą przez **zmienne CSS** (`--vv-top`, `--vv-height`): komponent
deklaruje `top: var(--vv-top, 0px)` raz (stały napis, nie ma czego diffować), a hook zmienia tylko
wartość zmiennej. Wsparcie dla API liczone jest w `ref` podczas renderu, nie w stanie — inaczej
pierwsza klatka po otwarciu pokazywała jeszcze stary układ (`85vh`). Dorzucone też utrzymywanie dołu
rozmowy: gdy obszar wiadomości maleje, najnowsza wiadomość inaczej wyjeżdża poza widok (z tolerancją,
by nie szarpać kogoś, kto czyta historię wyżej).
**Lekcja:** Reakcja na `visualViewport` to **korekta układu, nie zmiana stanu aplikacji** — musi
trafić do DOM w tym samym zdarzeniu. Stan Reacta i `rAF` są tu o klatkę za późno i użytkownik to
widzi. Gdy imperatywny zapis miałby konkurować z Reactem o tę samą właściwość CSS, rozdziel role
zmienną CSS: React deklaruje `var()`, kod pisze wartość.

## 2026-07-29 — Pełny ekran przy `viewport-fit=cover` wchodzi pod zegar i wycięcie na kamerkę
**Problem:** Po przestawieniu okna asystenta na pełny ekran telefonu nagłówek wraz z przyciskami
znalazł się POD systemowym zegarem i wycięciem na przednią kamerkę — akcje były nieklikalne.
**Rozwiązanie:** Aplikacja deklaruje `viewportFit: "cover"` (`layout.tsx`), więc treść sięga fizycznej
krawędzi ekranu — każdy element przyklejony do góry musi sam dołożyć `env(safe-area-inset-top)`.
Mobilny top bar w `AppShell` robił to od dawna; nowe okno pełnoekranowe o tym „zapomniało".
**Poprawka drugiego podejścia (ta sama sesja):** pierwsza wersja dawała
`max(0px, calc(env(safe-area-inset-top) - <offsetTop>px))`, w przekonaniu, że po przewinięciu strony
pod klawiaturę górna krawędź okna schodzi poniżej wycięcia. **Błąd.** Widoczny obszar
(`visualViewport`) zawsze renderuje się od FIZYCZNEJ góry ekranu — `offsetTop` mówi tylko, jak daleko
w dokumencie znajduje się ta krawędź, a nie że odsunęła się od wycięcia. Objaw był dokładnie taki:
bez klawiatury nagłówek w porządku, po jej wysunięciu zegar znów go zasłaniał. Margines musi być
BEZWARUNKOWY: `paddingTop: env(safe-area-inset-top)`.
**Lekcja:** Przy `viewport-fit=cover` każdy nowy element pełnoekranowy potrzebuje marginesów
bezpiecznej strefy — góra i dół osobno, i **bez „optymalizowania" ich pod stan klawiatury**. Wycięcie
jest własnością EKRANU, nie dokumentu, więc żadne przewinięcie ani zmiana `visualViewport` go nie
przesuwa. Zanim napiszesz własny element pełnoekranowy, sprawdź sąsiedni przyklejony do tej samej
krawędzi (tu: `AppShell`) i skopiuj wzorzec zamiast wymyślać arytmetykę.

## 2026-07-29 — Lektor serwerowy milczy na iPhonie, bo `new Audio()` po `await` traci zgodę użytkownika
**Problem:** W trybie rozmowy asystent czytał odpowiedzi głosem przeglądarki, ale głos serwerowy
(`/api/tts`) na telefonie po prostu milczał — bez błędu w konsoli, `play()` odrzucane cicho.
**Rozwiązanie:** iOS przyznaje prawo do odtwarzania dźwięku **elementowi**, który powstał i dostał
`play()` w geście użytkownika. Nasz kod robił `await fetch("/api/tts")`, a dopiero potem
`new Audio(url).play()` — do tego momentu „zgoda" z kliknięcia już wygasła i dotyczyła elementu, który
wtedy jeszcze nie istniał. Naprawa: JEDEN współdzielony element `<audio>` odblokowywany w geście
(`primeSpeechPlayback()` — cichy WAV jako data-URI, `play()` + `pause()`), a potem tylko podmiana
`src` na kolejne nagrania. `stopServerAudio()` zwalnia objectURL przez `removeAttribute("src")` +
`load()`, **nie niszcząc** elementu — inaczej trzeba by odblokowywać go od nowa.
**Lekcja:** Na iOS nie twórz elementu audio/wideo po `await`. Odblokuj jeden trwały element w samym
geście użytkownika i później tylko podmieniaj mu źródło.

## 2026-07-29 — `vh`/`dvh` nie kurczą się przy klawiaturze — okno „ucieka" w górę
**Problem:** Arkusz asystenta na telefonie miał `height: 85vh`. Po wysunięciu klawiatury ekranowej
okno zostawało tej samej wysokości, system przewijał całą stronę, żeby odsłonić pole tekstowe, i
efekt był taki, że okno uciekało w górę, a nagłówek znikał.
**Rozwiązanie:** `vh` (a na iOS także `dvh`) liczy się z *layout viewport*, który przy klawiaturze się
NIE zmienia. Miarą tego, co realnie widać, jest `window.visualViewport` (`height` + `offsetTop`).
Nowy hook `useVisualViewport()` czyta je z throttlingiem na `requestAnimationFrame` (zdarzenia
`resize`/`scroll` sypią się seriami w trakcie animacji klawiatury), a arkusz jest do nich przypięty
inline — dzięki temu po prostu maleje, oddając miejsce klawiaturze.
**Lekcja:** Do elementów pełnoekranowych współistniejących z klawiaturą używaj `visualViewport`, nie
jednostek `vh`/`dvh`. Brak API (starsza przeglądarka) = zostań przy dotychczasowym układzie, zamiast
zgadywać wysokość.

## 2026-07-29 — `INSERT` w migracji pada na `id`, bo Prisma nadaje `cuid` w aplikacji, nie w bazie
**Problem:** Migracja 0214 dopisywała jeden wiersz do `Config` i wywaliła deploy:
`null value in column "id" of relation "Config" violates not-null constraint`.
**Rozwiązanie:** `@default(cuid())` w `schema.prisma` to domyślna wartość **klienta Prisma**, a nie
`DEFAULT` w bazie — surowy `INSERT` w SQL-u musi podać `id` sam:
`gen_random_uuid()::text` (tak jak robią to migracje seedujące uprawnienia i raporty).
**Lekcja:** W każdej ręcznej migracji seedującej wypisuj kolumnę `id` jawnie. I sprawdzaj migracje
`prisma migrate deploy` na LOKALNYM Postgresie — ten błąd jest niewidoczny dla `tsc` i dla lintera,
a na produkcji przerwałby deploy.

## 2026-07-29 — „Coś kombinuje z kursorem" — inwentarz zamiast zgadywania
**Problem:** Właściciel pytał wprost, co w kodzie manipuluje karetką w polu wiadomości asystenta,
bo kursor zachowywał się dziwnie na iPhonie. Wcześniejsze próby „poprawiania fokusu" tylko mnożyły
hipotezy.
**Rozwiązanie:** Zamiast zgadywać — pełne przeszukanie komponentu pod `focus`, `blur`, `caret`,
`setSelectionRange`, `scrollIntoView`, `pointerdown`+`preventDefault`. Wynik: **cztery** miejsca,
z czego żadne nie ustawia pozycji karetki w pustym polu (`caretColor` = sam kolor; `focus()` +
`setSelectionRange(end,end)` tylko przy przywracaniu szkicu; `blur()` po wysłaniu; `autoFocus`
w zmianie nazwy rozmowy). Prawdziwą przyczyną był UKŁAD: zmienny `padding-bottom` kompozytora
i wysokość `85vh`. Inwentarz trafił do `specs/036-*/verify.md`.
**Lekcja:** Gdy objaw dotyczy „czegoś, co kombinuje", zrób najpierw **kompletny inwentarz** miejsc,
które mogłyby to robić, i wypisz go z uzasadnieniem. Pusta lista jest równie cenną odpowiedzią jak
znaleziony winowajca — i zamyka temat na przyszłe zgłoszenia.

## 2026-07-29 — „Pusta lista = daj wszystko" zamieniło oszczędność w nadpłatę
**Problem:** Optymalizacja miała pomijać katalog akcji dla zwykłej uprzejmości („cześć") i zaczynała
od przekazania **pustej** listy modułów. Pomiar pokazał, że tura wychodzi o 108 tokenów **droższa**
niż przed zmianą.
**Rozwiązanie:** `buildReadToolsPrompt([])` traktuje pustą listę jako bezpieczny fallback „nie wiem,
które moduły — daj pełny katalog", więc zamiast uciąć prompt, rozdmuchaliśmy go. Przekazanie modułu
podstawowego (`context[0]`, znany bez wywoływania routera) dało zmierzone **4441 → 2673 tokenów**.
**Lekcja:** Zanim potraktujesz „puste" jako „nic", sprawdź, co robi z tym funkcja po drugiej stronie —
bezpieczne fallbacki bywają odwrotnością oszczędności. I mierz efekt optymalizacji, zamiast go zakładać.

## 2026-07-28 — Karetka na iPhonie skacze, bo układ zmienia się w momencie pojawienia klawiatury
**Problem:** Po kliknięciu w pole wiadomości asystenta na iPhonie kursor pojawiał się raz PONAD polem,
raz bardzo nisko, a po wpisaniu pierwszego znaku wskakiwał na właściwe miejsce.
**Rozwiązanie:** Winne było „sprytne" rozwiązanie safe-area: stopka kompozytora miała
`paddingBottom: composerFocused ? undefined : "max(0.75rem, env(safe-area-inset-bottom))"`, czyli
wysokość elementu zmieniała się DOKŁADNIE w tej klatce, w której iOS animuje klawiaturę i wylicza
pozycję karetki. Naprawa: stały, bezwarunkowy `padding-bottom` (stan `composerFocused` usunięty).
**Lekcja:** Nie zmieniaj wysokości/paddingu elementu w reakcji na fokus pola tekstowego na iOS —
przeglądarka liczy pozycję karetki w trakcie animacji klawiatury i dostaje nieaktualny układ. Margines
na systemową kreskę iPhone'a ma być stały; „oszczędzanie" go przy otwartej klawiaturze kosztuje więcej
niż daje.

## 2026-07-28 — Pamięć podręczna promptu, która nigdy nie trafia, podnosi koszt o 25%
**Problem:** W logu każde wywołanie agenta miało `cache zapis/odczyt` = `5284/0` — prompt był
zapisywany do pamięci podręcznej dostawcy przy KAŻDYM wywołaniu i nigdy z niej nie czytany.
**Rozwiązanie (diagnoza; wdrożenie świadomie odłożone do decyzji właściciela):** prefiks systemowy jest
budowany dynamicznie — `buildSystemPrompt(selectedModules)` wstawia katalog akcji tylko tych modułów,
które wybrał router, więc przy innym poleceniu prefiks jest INNY i nie ma czego trafić. Zapis kosztuje
1,25× ceny wejścia, odczyt 0,1× — przy zerowej trafialności to czysta nadpłata 25% na każdym wywołaniu.
**Lekcja:** `cache_control` opłaca się tylko dla prefiksu STAŁEGO między wywołaniami. Zanim oznaczysz
prompt jako cache'owany, sprawdź w logach stosunek zapisów do odczytów — sam zapis bez odczytu jest
droższy niż brak pamięci podręcznej. Gdy prompt ma część stałą i zmienną, cache'uj wyłącznie stały
prefiks, a zmienne katalogi trzymaj za nim.

## 2026-07-28 — Bramka jako test kompletności refaktoru
**Problem:** Prompty agenta (katalog akcji, protokół, zasady) siedziały w pliku trasy Next.js, który
nie może eksportować nic poza handlerami — więc nie dało się ich zaimportować ani policzyć bez
przepisywania ręcznie. Audyt zużycia tokenów wymagał dokładnie tej treści, którą dostaje model.
**Rozwiązanie:** Przeniesienie 1:1 do `src/lib/ai/agentPrompt.ts`. Bramka `check-action-coverage.js`
czytała katalog z pliku trasy po `indexOf("const ACTION_CATALOG")`, więc po przenosinach od razu
pokazała **15 akcji zamiast 160** — czyli natychmiast wykryła, że przeniesienie zmieniło powierzchnię.
Po przestawieniu bramki na nowy plik znów 160 akcji i 373 parametry.
**Lekcja:** Statyczna bramka czytająca konkretny plik jest darmowym testem kompletności refaktoru —
jej „fałszywy alarm" po przenosinach to sygnał, że coś REALNIE się przesunęło. Przy takich zmianach
dowód neutralności warto zrobić wprost: porównać treść bloku przed i po (`git show`), znak po znaku.

## 2026-07-27 — Koszt liczony z tokenów, których UI w ogóle nie pokazywał
**Problem:** W rozbiciu kosztu pod odpowiedzią asystenta dwa wywołania tego samego modelu
(claude-haiku-4-5) o podobnej liczbie tokenów miały kwoty różniące się dwudziestokrotnie:
`router 317+15=332 tok. → $0,0004` obok `agent 181+125=306 tok. → $0,0090`. Wyglądało to jak błąd
w liczeniu kosztów.
**Rozwiązanie:** Rachunek się zgadzał — `estimateCostUsd` wliczał tokeny PAMIĘCI PODRĘCZNEJ promptu
(zapis 1,25× ceny wejścia, odczyt 0,1×), ale rozbicie w UI pokazywało wyłącznie `prompt+completion`.
Zgłoszone $0,0090 to ~6,5 tys. tokenów zapisu do cache przy 306 widocznych. Naprawa polegała na
POKAZANIU wszystkich składowych (`estimateCost` zwraca `parts`, komponent wypisuje wejście / wyjście /
zapis / odczyt), a nie na zmianie arytmetyki. Przy okazji cennik przeniesiono z kodu do bazy
(`LlmModelPrice`), a model spoza cennika pokazuje „koszt nieznany" zamiast zera.
**Lekcja:** Gdy użytkownik zgłasza „liczby się nie zgadzają", najpierw sprawdź, czy pokazujesz
WSZYSTKIE dane wejściowe rachunku. Kwota, której nie da się odtworzyć z tego, co widać na ekranie,
jest dla użytkownika błędem — nawet gdy jest poprawna. I nie licz kosztu jako 0 dla nieznanej stawki:
zero to konkretna informacja („darmowe"), a nie brak informacji.

## 2026-07-27 — Kursor pola tekstowego przebijający się nad rozwiniętym menu
**Problem:** Menu wyboru poziomu pracy asystenta (`position: absolute`, `z-index: 6`) zachodziło na
pole wpisywania wiadomości i migający kursor pola był widoczny NAD menu. Podbijanie `z-index` nic nie
dawało.
**Rozwiązanie:** To nie był problem warstw. Przyciski kompozytora mają `onPointerDown` +
`preventDefault` (`keepKeyboardOpen`), żeby na telefonie nie znikała klawiatura — więc fokus ZOSTAJE
w polu, a przeglądarka rysuje karetkę w warstwie kompozytora systemu, ponad HTML-em. Rozwiązanie:
`caretColor: "transparent"` na czas otwartego menu (fokus i klawiatura zostają, znika sam kursor).
**Lekcja:** Karetki tekstowej nie przykryjesz `z-index`-em — jest rysowana poza drzewem CSS. Gdy
element nakłada się na sfokusowane pole, chowaj karetkę (`caretColor`), a nie podbijaj warstwy.
Zanim zaczniesz licytować `z-index`, sprawdź, czy problem w ogóle dotyczy kontekstu nakładania.

## 2026-07-27 — Model wymyślił parametr akcji, bo katalog nie miał jak wyrazić prośby
**Problem:** W podglądzie akcji „dodaj notatkę do grupy" widniał techniczny parametr `groupName`.
Szukanie go w kodzie nic nie dawało — nie było go ani w katalogu akcji, ani w kontrakcie, ani w
executorze. Model go WYMYŚLIŁ, bo `create_note { title, content? }` nie przyjmowało grupy; executor
parametr ignorował, więc notatka po cichu lądowała poza grupą.
**Rozwiązanie:** Trzy warstwy: (1) katalog i executor przyjmują `groupName` (naprawa funkcji, nie
tylko etykiety), (2) `fieldSpec()` ukrywa parametr bez polskiej etykiety zamiast pokazywać nazwę z
kodu — bramka statyczna nie zna parametrów wymyślonych, (3) nowa bramka w `check-action-coverage.js`
wymusza etykietę dla każdego parametru z katalogu.
**Lekcja:** Techniczna nazwa w UI bywa objawem BRAKU w katalogu akcji, nie zapomnianej etykiety —
sprawdź najpierw, czy akcja w ogóle przyjmuje to, o co prosi użytkownik. I pamiętaj, że bramka
statyczna zabezpiecza tylko to, co jest w kodzie: przy danych generowanych przez model potrzebny jest
dodatkowo bezpieczny domyślny wariant w runtime.

## 2026-07-27 — Zmiana klucza głównego tabeli konfiguracyjnej w idempotentnej migracji
**Problem:** Dodanie wymiaru „poziom" do `LlmAssignment` wymagało zamiany jednokolumnowego klucza
głównego (`operationType`) na złożony (`operationType`, `level`) — na żywej tabeli, migracją, która
musi dać się odpalić ponownie bez błędu.
**Rozwiązanie:** `ADD COLUMN IF NOT EXISTS "level" TEXT NOT NULL DEFAULT 'standard'` (istniejące
wiersze stają się poziomem standardowym), a podmiana klucza w bloku `DO $$` warunkowanym
`array_length(conkey, 1) = 1` w `pg_constraint` — drugi przebieg widzi klucz już złożony i nic nie
robi. Nowe indeksy unikalne tworzone PO backfillu właścicieli, żeby nie trafić na duplikaty.
**Lekcja:** Idempotentność migracji na kluczach i ograniczeniach robi się przez sprawdzenie STANU w
`pg_constraint`/`pg_indexes`, nie przez `IF NOT EXISTS` (którego `ADD CONSTRAINT` nie ma). Kolejność
ma znaczenie: najpierw dane (backfill), potem ograniczenia unikalności.

## 2026-07-26 — Równoległa sesja zajęła ten sam numer speca i migracji
**Problem:** Podczas pracy nad feature'em „effort/temperature" druga sesja zmergowała do `develop`
inny feature też ponumerowany **032** (katalog TTS) razem z migracją **0210**. Moja gałąź miała
`specs/032-llm-effort-temperature` i `prisma/migrations/0210_llm_effort`, więc po `git fetch`
`git merge --ff-only` odbił się („Not possible to fast-forward"), a `check:migrations` wywaliłby
build na duplikacie numeru.
**Rozwiązanie:** Przed merge PRZENUMEROWAŁEM swoje artefakty na wolne numery (spec 032 → 033,
migracja `0210_llm_effort` → `0211_llm_effort`) — bezpiecznie, bo moja migracja nie była nigdzie
zaaplikowana poza lokalną bazą deweloperską (C-11 zabrania renamować tylko migracje JUŻ
zaaplikowane). Potem zwykły `git merge origin/develop` i ręczne rozwiązanie 6 konfliktów: w
`resolver.ts`/`llmConfig.ts` obie zmiany są komplementarne (ich filtr dostawców tylko-TTS + moje
`effort`), w `agent/route.ts` trzeba było ZŁOŻYĆ dwa nowe parametry tych samych funkcji
(`isFinalRun` ich, `boostEffort` mój), w `doświadczenia.md` zachować OBA zestawy wpisów.
**Lekcja:** Numer migracji i numer speca to zasoby GLOBALNE — przy pracy równoległej sprawdzaj
`origin/develop` **przed** pushem, nie tylko na starcie. Gdy trzeba przenumerować, zrób to PRZED
merge (inaczej rozwiązujesz konflikty dwa razy). Przy konflikcie w pliku, gdzie obie strony dodały
parametr do tej samej funkcji, nie wybieraj „naszej/ich" wersji — złóż sygnaturę z obu i sprawdź
KAŻDE wywołanie. I pamiętaj: `git diff origin/develop HEAD` w trakcie nierozwiązanego merge porównuje
do commitu PRZED merge, więc wygląda, jakby czyjaś praca ginęła — patrz na stan roboczy
(`git diff origin/develop -- plik`).

## 2026-07-26 — „Effort" nie jest jednym parametrem: wspólna skala zamiast surowej wartości
**Problem:** Zgłoszenie brzmiało „dodaj możliwość ustawienia effort", ale u każdego dostawcy to co
innego: Anthropic ma rozszerzone myślenie z budżetem tokenów (`thinking.budget_tokens`), modele
rozumujące zgodne z OpenAI mają `reasoning_effort`, a llama na Groqu nie ma tego wcale. Gdyby admin
wpisywał surową wartość, literówka albo model bez wsparcia dawałyby **400** — a 400 jest
NIEPRZEJŚCIOWY (`isRetryableLlmStatus` → false), więc przerywa łańcuch fallbacku i wywala całego
agenta. Opcjonalne ustawienie potrafiłoby więc położyć asystenta.
**Rozwiązanie:** Jedna opisowa skala (brak/niski/średni/wysoki) + tłumaczenie na parametr dostawcy w
jednym miejscu (`src/lib/llm/effort.ts`) z **konserwatywną** tabelą możliwości (wysyłamy tylko przy
pewnej rodzinie modelu). Trzy warstwy obrony: tabela, jednorazowa degradacja bez wysiłku przy 400
rozpoznanym jako odrzucenie tego parametru, oraz domyślne „brak" (bez ruchu admina zero zmian).
Panel mówi wprost, że dla wybranego modelu ustawienie zostanie pominięte.
**Lekcja:** Gdy „jeden parametr" ma różne API u różnych dostawców, nie wystawiaj go surowo — wystaw
INTENCJĘ (skala) i tłumacz ją w jednym choke-poincie. I zawsze sprawdź, czy błąd, którym dostawca
odrzuci nowy parametr, jest przejściowy: jeśli nie, potrzebna jest jawna degradacja, bo inaczej
opcjonalne ustawienie zabiera funkcję główną.

## 2026-07-26 — Anthropic: `max_tokens` musi być WIĘKSZY od budżetu myślenia
**Problem:** Włączenie rozszerzonego myślenia (`thinking.budget_tokens`) przy zachowanym
`max_tokens: 1024` daje 400 — budżet myślenia jest częścią `max_tokens`, więc odpowiedź nie miałaby
gdzie się zmieścić. Łatwo to przeoczyć, bo w naszej konfiguracji `max_tokens` ustawia admin osobno.
**Rozwiązanie:** `applyEffort` podnosi `max_tokens` do `budget + 1024`, gdy skonfigurowana wartość
jest mniejsza (i **nie** obniża, gdy admin ustawił większą). Objęte testem jednostkowym.
**Lekcja:** Parametry modelu bywają powiązane — dokładając jeden, sprawdź jego warunki brzegowe
względem już wysyłanych. Test „ciało żądania spełnia niezmiennik dostawcy" jest tu tańszy niż
diagnozowanie 400 z produkcji.

## 2026-07-26 — Polski cudzysłów zamykający ” w literale TS (drugi raz ta sama pułapka)
**Problem:** `it("poziom „brak" nigdy nic nie dokłada", …)` — otwierający „ jest znakiem
typograficznym, ale zamykający wpisałem jako zwykły `"`, co PRZEDWCZEŚNIE kończy literał. `esbuild`
wywala się dopiero przy uruchomieniu testów: „Expected ) but found nigdy". Ten sam błąd trafił mnie
wcześniej w tej samej sesji przy testach kontraktu akcji.
**Rozwiązanie:** Konsekwentnie para „ … ” (oba typograficzne) albo brak cudzysłowu w nazwie testu.
**Lekcja:** W plikach TS trzymaj polskie cudzysłowy PARAMI („ z ”). Gdy komunikat kompilatora wskazuje
nieoczekiwane słowo w środku zdania po polsku — szukaj cudzysłowu zamykającego, nie składni.

## 2026-07-26 — `kind` dostawcy to nie jest jego tożsamość: zapis lektora wyłączał cały asystent
**Problem:** Katalog TTS opisuje pięciu dostawców, ale **dwaj** (OpenAI i Groq PlayAI) mają ten sam
`LlmProvider.kind = "openai_compat"`. Kod dopasowywał pozycję katalogu po samym `kind`, więc
`applySpeechProvider` przy zapisie lektora OpenAI robiło `findFirst({ where: { kind } })` — i trafiało
w **domyślny wiersz Groqa**, tego samego, który obsługuje `dispatch`/`reasoning`/`vision`/`generation`.
Następnie nadpisywało mu `baseUrl` na `api.openai.com`, zostawiając klucz Groqa. Skutek: administrator
włącza lektora, a **cały asystent zaczyna zwracać 401** — bez żadnego związku widocznego dla niego.
Ten sam błąd sprawiał, że panel pokazywał przy OpenAI „klucz zapisany" (bo widział klucz Groqa, więc
pole klucza się nie renderowało) oraz że konfiguracja Groq PlayAI oferowała użytkownikom głosy OpenAI.
Trzecia odsłona wyszła dopiero przy sprzątaniu martwego kodu: `parseServerVoiceValue` walidował głos
przeciw stałej liście OpenAI, więc wybór poprawnego głosu Azure zwracał `null` i UI brało go za głos
przeglądarki — lektor serwerowy nigdy się nie włączał.
**Rozwiązanie:** Tożsamością pozycji katalogu jest **`kind` + `baseUrl`**. Wspólny
`providerMatchesSpec` (w `lib/tts/catalog.ts`) obsługuje ODCZYT i ZAPIS, więc panel nie może pokazać
czegoś innego, niż zrobi przycisk. Fallback po samym rodzaju został, ale **tylko dla rodzajów
jednoznacznych** (`isKindUnique` — Azure/Google/ElevenLabs), gdzie ratuje zmianę regionu w adresie.
Walidacja głosu przeniesiona na serwer (`updateAssistantPrefs`, `synthesizeSpeech`), bo dopuszczalna
lista zależy od konfiguracji administratora, a nie od stałej w kodzie.
**Lekcja:** Zanim użyjesz pola jako klucza wyszukiwania **przed zapisem**, sprawdź, czy jest unikalne w
zbiorze, po którym szukasz — „rodzaj/typ" prawie nigdy nie jest. Szczególnie groźne jest to przy
`findFirst` + `update`, bo cicho modyfikuje **cudzy** rekord. Weryfikacja tego nie złapała, bo testowała
na dostawcy o rodzaju unikalnym (Azure) — przy wspólnym zasobie testuj zawsze przypadek **kolizji**,
a nie ten wygodny.

## 2026-07-26 — „Zamknij i zacznij nowy czat" bez przerwania żądania = osierocona odpowiedź
**Problem:** Zmiana cyklu życia rozmowy asystenta (zamknięcie kończy rozmowę, ponowne otwarcie daje
nowy wątek) wprowadziła regresję: `handleClose` czyścił `turns` i `conversationId`, ale NIE przerywał
trwającego żądania do agenta. `AICommandSheet` siedzi w `AppShell` i nigdy się nie odmontowuje, więc
sprzątanie z `useEffect(() => () => abortRef.current?.abort(), [])` nigdy nie odpalało. Efekt:
zamknięcie asystenta w trakcie „myślę" → odpowiedź przychodziła po chwili i dopisywała się do świeżo
wyczyszczonego wątku, przy `convoIdRef === null`, czyli BEZ zapisu do historii. Po ponownym otwarciu
użytkownik widział samotną wypowiedź asystenta w rzekomo nowej rozmowie, której nie było w historii.
**Rozwiązanie:** `handleClose` przerywa generowanie (`abortRef.current?.abort()`, wyzerowanie refa,
`setBusy(false)`) przed wyczyszczeniem wątku — bez powrotu do nasłuchu głosowego, bo asystent się
zamyka. Klient już wcześniej cicho ignorował `AbortError`, więc nie pojawia się żadna tura błędu.
**Lekcja:** Jeśli komponent żyje przez cały czas działania aplikacji (jest w `AppShell`), sprzątanie
w `useEffect` z pustą tablicą zależności to martwy kod — nigdy się nie wykona. Każde „zamknij/zresetuj"
w takim komponencie musi jawnie anulować to, co jest w locie. Przy zmianie cyklu życia widoku
sprawdzaj wszystkie asynchroniczne operacje, które mogą wrócić PO resecie stanu.

## 2026-07-26 — Ucięta odpowiedź LLM czytana jako „zły format" → pętla naprawcza za 0,81 zł
**Problem:** Użytkownik poprosił asystenta: „znajdź najważniejsze zadanie, opisz dlaczego jest ważne,
ale zapisz to od tyłu". Dostał „Nie udało się dokończyć w limicie kroków". W logach: 6 wywołań
`claude-sonnet-5`, każde z `completion = 1200` tokenów (czyli dokładnie `AGENT_MAX_TOKENS`), prompt
rosnący za każdym razem o ~38 tokenów, koszt ~0,81 zł, zero wyniku. Pierwsza (błędna) hipoteza była
taka, że agent nie umie rozwiązać nazwy projektu na identyfikator — ale `resolveProjectRef` istnieje
od paczki 025 i w tym przebiegu ZADZIAŁAŁO (dane wróciły). Prawdziwa przyczyna: odpowiedź modelu była
**ucinana na limicie tokenów**, więc przestawała być poprawnym JSON-em protokołu. Pętla widziała tylko
„nieprawidłowy JSON" i wysyłała komunikat korekcyjny „zwróć poprawny JSON" — model znów pisał długo,
znów go ucięło, i tak w kółko aż do wyczerpania limitu kroków.
**Rozwiązanie:** `chatComplete` zwraca teraz `truncated` (z `finish_reason === "length"` dla API zgodnych
z OpenAI i `stop_reason === "max_tokens"` dla Anthropic — `src/lib/llm/truncation.ts`). Pętla agenta
przy ucięciu mówi modelowi PRAWDĘ („odpowiedź została ucięta, odpowiedz znacznie krócej") i daje na to
**jedną** próbę; przy drugim ucięciu oddaje treść częściową z adnotacją. Dodatkowo licznik
`unproductiveIterations` przerywa przebieg po dwóch iteracjach bez nowego wyniku, a niedokończony
przebieg zamyka się podsumowaniem „co ustaliłem / co mnie zablokowało / jak dopytać" zamiast zdania o
limicie kroków. `AGENT_MAX_TOKENS` zostało bez zmian — leczymy przyczynę, nie objaw.
**Lekcja:** „Model zwrócił nieprawidłowy JSON" i „modelowi zabrakło miejsca na odpowiedź" to DWIE różne
awarie i wymagają dwóch różnych reakcji. Zanim wpiszesz retry na parsowanie odpowiedzi LLM, sprawdź
`finish_reason`/`stop_reason` — bez tego każdy retry generuje tę samą, znów uciętą odpowiedź i płacisz
za pętlę. Sygnał diagnostyczny: `completion` w logu równe DOKŁADNIE limitowi `max_tokens` w kilku
wywołaniach z rzędu oraz prompt rosnący o stałą, małą liczbę tokenów (to komunikat korekcyjny).

## 2026-07-26 — Argument `*Id` w read-toolu asystenta przyjmujący nazwę = cicha pustka
**Problem:** Agent naturalnie mówi nazwami („na liście moje", „w projekcie Omnia") i wstawia je w
argumenty typu `listId`/`noteId`/`taskId`/`recipeId`. Zapytanie `where: { id: "moje" }` nie pasuje do
niczego, więc narzędzie zwracało PUSTĄ listę albo `null` — a asystent na tej podstawie twierdził, że
„nic tam nie ma", albo próbował jeszcze raz. Rozwiązywanie nazw istniało tylko dla `list_tasks`.
**Rozwiązanie:** Wspólny rdzeń `matchNamedRef` w `src/lib/ai/refResolve.ts` (id → nazwa dokładna →
jednoznaczna nazwa częściowa → błąd), wpięty w `get_task`, `list_items`, `get_note`, `get_recipe`.
Kluczowe: błąd **rozróżnia** „nie znalazłem" (z listą dostępnych nazw) od „pasuje kilka" (z listą
trafień) — dopiero wtedy agent dopytuje zamiast zgadywać. Przy okazji wyszła luka w dotychczasowym
`resolveProjectRef`: pusta referencja przechodziła przez `includes("")`, więc przy jednym kandydacie
rozwiązywała się „na oślep".
**Lekcja:** Read-tool asystenta nigdy nie powinien cicho zwracać pustki, gdy dostał argument, którego
nie umiał zinterpretować — cisza jest gorsza od błędu, bo zamienia się w pewne siebie kłamstwo
w odpowiedzi. Argument nazwany `*Id` w narzędziu LLM traktuj jako „id ALBO nazwa", i to najpierw
jako id (żeby prawidłowe id nie poszło ścieżką dopasowania po nazwie).

## 2026-07-26 — Mobilna klawiatura: pierwsze dotknięcie ikony pod polem tylko ją zwijało
**Problem:** W asystencie na telefonie, przy otwartej klawiaturze, dotknięcie mikrofonu/aparatu/wyboru
trybu pod polem wiadomości nie wywoływało akcji — najpierw zwijało klawiaturę (bo przycisk odbierał
fokus polu), układ podskakiwał i dotknięcie nie trafiało już w przycisk. Akcję trzeba było wywołać
dwa razy.
**Rozwiązanie:** `onPointerDown={(e) => e.preventDefault()}` na przyciskach dolnego wiersza kompozytora
— blokuje domyślne przeniesienie fokusu, więc klawiatura zostaje otwarta, a `onClick` odpala się
normalnie (desktop bez zmian). Wyjątki świadome: przycisk wysyłania dostaje to samo plus jawne
`blur()` po wysłaniu (jedno dotknięcie = wyślij + zamknij klawiaturę), a rozmowa głosowa zostaje bez
`preventDefault`, bo tam użytkownik przechodzi z pisania na mówienie.
**Lekcja:** Na mobile „przycisk obok pola tekstowego" to zawsze dwa zdarzenia: utrata fokusu i klik.
Jeśli akcja ma zadziałać przy pierwszym dotknięciu, blokuj utratę fokusu na `pointerdown` — nie
próbuj tego naprawiać `setTimeout`-em ani ponownym `focus()` po kliknięciu.

---

## 2026-07-25 — `tsc --noEmit` NIE łapie reguły „use server": eksport nie-funkcji wywala build
**Problem:** W `src/actions/feedback.ts` i `assistantPrefs.ts` wystawiłem `export const
FEEDBACK_PROJECT_CONFIG_KEY` / `export const ASSISTANT_INSTRUCTIONS_MAX`. `npx tsc --noEmit`
przechodził na zielono, `npm run check:*` też — a `next build` padał na webpacku:
„Only async functions are allowed to be exported in a »use server« file".
**Rozwiązanie:** Stałe zostały prywatne (bez `export`). Eksport `interface`/`type` jest OK (typy są
wymazywane), problem dotyczy WARTOŚCI runtime.
**Lekcja:** W pliku z `"use server"` eksportuj WYŁĄCZNIE funkcje async (i typy). Nie polegaj na
`tsc` jako bramce dla plików akcji — to reguła kompilatora Next/SWC, nie TypeScriptu, więc
zobaczysz ją dopiero w `next build`. Stałe współdzielone z klientem trzymaj w `src/lib/*`.

## 2026-07-25 — Eksport w pliku „use server" to publiczny endpoint (audyt kontroli dostępu)
**Problem:** Audyt 544 akcji wykrył, że `notifyUser({userId, …})` i `orphanCategoryIcons(name,
userId)` żyły w plikach `"use server"` jako funkcje pomocnicze przyjmujące CUDZE `userId`. Ponieważ
każdy eksport w takim pliku jest zdalnie wołalny, dowolny zalogowany użytkownik mógł wysłać
powiadomienie innej osobie albo „osierocić" jej ikony kategorii. Dodatkowo `getNoteGroups`,
`getTags` i `getSuggestionsForPrefix` czytały dane bez ŻADNEGO sprawdzenia sesji.
**Rozwiązanie:** `notifyUser` → przeniesione do `src/lib/notify.ts` (zwykły moduł serwerowy, bez
`"use server"` — legalnie powiadamia inne osoby, więc nie da się jej ograniczyć do własnego konta).
`orphanCategoryIcons` → wymuszone `userId` z sesji. Pozostałe → `requireAuth()`. Bramka
`check:ai-coverage` wymaga teraz dla KAŻDEJ akcji pola `access` **oraz** faktycznego wywołania
guardu w kodzie (`guardedVia` dla cienkich nakładek), więc nowa akcja bez sprawdzenia = build pada.
**Lekcja:** Traktuj każdą eksportowaną funkcję w `"use server"` jak publiczny endpoint — nawet gdy
„jest tylko helperem wołanym z innej akcji". Helper przyjmujący `userId` jako parametr to sygnał
ostrzegawczy: albo wymuś id z sesji, albo wyprowadź go z pliku akcji do `src/lib/`. Sama deklaracja
w manifeście nie jest dowodem — bramka musi sprawdzać KOD.

## 2026-07-25 — „Znikające" głosy lektora: `getVoices()` zwraca coraz KRÓTSZĄ listę
**Problem:** Na Chrome/Windows lista głosów najpierw pokazywała kilka polskich (działał jeden),
a po chwili zostawał tylko ten działający. Wyglądało to jak błąd Omnii („czemu głosy znikają?").
**Rozwiązanie:** `speechSynthesis.getVoices()` przy pierwszym odczycie oddaje też głosy ZDALNE
silnika (`localService:false`), których przeglądarka nie potrafi odtworzyć, a po dociągnięciu
silników zwraca listę krótszą. UI brał każdą odpowiedź za prawdę. `getAvailableVoices()`
akumuluje teraz głosy po `voiceURI` między odczytami (koniec migania), ale ZWRACA tylko te obecne
w aktualnej odpowiedzi, odsiewa `localService:false` (z zabezpieczeniem: jeśli dla polskiego nie
zostałby żaden głos, przywraca zdalne) i sortuje polskie na początek.
**Lekcja:** Web Speech `getVoices()` jest ASYNCHRONICZNE **i niestabilne** — nie cache'uj pierwszej
odpowiedzi ani nie zastępuj listy w całości. Nie pokazuj użytkownikowi głosów, których nie da się
odtworzyć: obietnica wyboru, który nie działa, jest gorsza niż krótsza lista. Realny wybór
polskich głosów daje tylko synteza serwerowa (u nas: typ operacji `speech` w `/admin/llm`).

## 2026-07-25 — Zgłoszenia użytkowników nigdy nie docierały do admina (własny projekt „Omnia")
**Problem:** `ensureOmniaProject()` szukało projektu „Omnia" **właściciela sesji** i tworzyło go,
gdy nie istniał. Efekt: zgłoszenie zwykłego użytkownika lądowało w JEGO nowym projekcie „Omnia",
więc admin nigdy go nie widział. Druga droga (główny robaczek → agent → `create_task` z
`projectName:"Omnia"`) dla użytkownika bez dostępu kończyła się odmową albo tym samym skutkiem.
**Rozwiązanie:** Jedna akcja `submitFeedbackTask` z JEDNYM, wąskim odstępstwem dostępowym (tylko
zapis, tylko do wyznaczonego projektu, bez prawa odczytu) + `Config.feedback_project_id` z
fallbackiem na projekt „Omnia" konta z rolą ADMIN. Dla agenta osobna akcja `submit_feedback`
(zamiast `create_task`), żeby wyjątek nie rozlał się na tworzenie zwykłych zadań. Propozycję
„Otwórz w zadaniach" pokazujemy tylko przy realnym dostępie.
**Lekcja:** „Skrzynka na zgłoszenia" to inny model dostępu niż zwykły zasób: zapis dla wszystkich,
odczyt dla nikogo. Nie realizuj tego przez rozluźnienie guardu istniejącej akcji ani przez
uprawnienie RBAC (da się je przypadkiem rozszerzyć) — zrób osobną akcję z odstępstwem opisanym w
jednym miejscu. I sprawdź, czy „wspólny" zasób jest naprawdę wspólny: `findFirst({ownerId: user.id})`
cicho tworzy osobny byt per użytkownik.

## 2026-07-25 — Scalenie dwóch sekcji akcji asystenta przy append-only historii czatu
**Problem:** Po wykonaniu akcji asystent pokazywał DWIE sekcje: turę `plan` z „✓ Wykonano" oraz osobną
turę `results` z listą wyników i „Cofnij" — podwójna informacja. Chcieliśmy jedną dynamiczną sekcję, ale
historia rozmowy w DB (`AiMessage`) jest **append-only** (`appendAiMessage`) — nie da się zaktualizować
istniejącej wiadomości `plan`, więc naiwne scalenie na żywo wracałoby jako dwie tury po przeładowaniu.
**Rozwiązanie:** Na żywo wynik wchodzi do TEJ SAMEJ tury `plan` (`{done:true, results}`), a do DB dalej
dopisujemy wiadomość `results` (append-only bez zmian). Kluczowe: przy **hydratacji** (`loadConversation`)
zamieniono `.map` na pętlę, która scala wiadomość `results` w poprzedzającą turę `plan` (a znacznik
`{undo:true}` ustawia `undone`). Bardzo stare rozmowy bez poprzedzającego planu renderują `results` jako
samodzielną turę (wsteczna zgodność). Prefiks 🐛/🐛✨ w tytule zgłoszenia: dla robaczka Asystenta tytuł
ustawiamy wprost na kliencie; dla głównego robaczka (tytuł generuje agent) — instrukcja w promptcie PLUS
deterministyczne domknięcie: `create_task` w trybie zgłoszenia dostaje prefiks 🐛 przy wykonaniu, jeśli
model go pominie.
**Lekcja:** Przy append-only historii nie „aktualizuj wstecz" — scalaj przy ODCZYCIE (hydratacji), a stan
na żywo trzymaj w jednej turze. Emoji/prefiksów generowanych przez LLM nie zostawiaj na łasce modelu —
wymuś je w jednym choke-poincie po stronie klienta (tu: `handleExecute`).

## 2026-07-25 — Prod build pada na bramce, której `next build` nie odpala (`check-ai-coverage`)
**Problem:** Lokalnie weryfikowałem `npx next build` (przechodził), ale Render odpala `npm run build`,
który ma DŁUŻSZY łańcuch bramek: `copy-* → check-action-coverage → check-ai-coverage → check-migrations
→ next lint → prisma generate → next build → migrate.js`. Nowe Server Actions `getUsdPlnRate`/
`setUsdPlnRate` (029) nie miały wpisu w `src/lib/ai/action-coverage.json`, więc `check-ai-coverage.js`
wywalił build na produkcji (deploy nie wszedł; stary build dalej serwował).
**Rozwiązanie:** Dodano wpisy `llmConfig:getUsdPlnRate` (read) i `llmConfig:setUsdPlnRate` jako
`excluded`/`admin` (akcje admin-only, nie dla asystenta), wzorem `get/setCostAlertThreshold`. Ponowna
promocja na master.
**Lekcja:** Po dodaniu JAKIEJKOLWIEK Server Action weryfikuj lokalnie CAŁYM łańcuchem bramek, nie samym
`next build`. Minimum bez ruszania prod DB: `node scripts/check-action-coverage.js && node scripts/
check-ai-coverage.js && node scripts/check-migrations.js && npx next lint --dir src && npx next build`
(pomiń tylko ostatni `migrate.js`, który rusza prod DB — C-13). Każda nowa mutująca/odczytowa akcja =
wpis w `action-coverage.json`, inaczej `npm run build` (a więc Render) pada.

## 2026-07-23 — Koszt asystenta AI: wyniki narzędzi narastają w kontekście pętli agenta
**Problem:** Asystent (`/api/llm/home/agent`) wysyłał do modelu bardzo dużo tokenów. Największy ZMIENNY
koszt to nie prompt systemowy (już routowany per-moduł i cache'owany), lecz **surowe wyniki narzędzi**:
krok `query` robił `JSON.stringify(results)` i wstrzykiwał je jako wiadomość, która **zostawała w tablicy
`messages` na wszystkie kolejne iteracje** — więc w pętli `query→query→answer` te same dane szły do modelu
wielokrotnie (narost ~kwadratowy), a duże listy leciały bez limitu rekordów.
**Rozwiązanie:** Dwie czyste, testowalne dźwignie w nowym `src/lib/ai/agentContext.ts`: (1)
`compactToolResults` — limit `PER_TOOL_MAX_RECORDS=12` + bezpiecznik `TOOL_RESULT_MAX_CHARS=3500` z
**jawnym** znacznikiem „pokazano X z Y — zawęź zapytanie" (model wie, że dane niepełne — nie zgaduje po
cichu); (2) `collapseUsedToolData` — przed każdym wywołaniem modelu starsze bloki wyników zwijane do
stuba, pełny zostaje tylko OSTATNI. Delimiter „NIEUFNE DANE" zachowany (prompt-injection). Wskaźnik kosztu
w oknie czatu (`MetaFooter`) rozszerzony o USD, a `AgentMeta`=`UsageMeter` (nowy `accrueUsage` w
`usage.ts`) sumuje koszt ze WSZYSTKICH wywołań tury (fast-path + router + pętla), więc zgadza się z sumą
w `AiCall`.
**Lekcja:** W agentowej pętli narzędziowej licz koszt nie tylko promptu systemowego, ale przede wszystkim
**akumulacji wyników w kontekście**. Trzymaj efekt uboczny (skracanie/zwijanie) w JEDNYM, czystym miejscu
i wystaw go jako osobny moduł — wtedy łatwo go przetestować bez importu całego route'a (next/prisma/auth).
Odchudzanie promptu rób konserwatywnie (tylko deduplikacje), bo opisy pól narzędzi i reguły to najczęstsze
źródło regresji zachowania.

## 2026-07-23 — Efekt uboczny w wywołującym, nie w warstwie domenowej → asystent AI omijał spawn cyklicznego zadania
**Problem:** Domknięcie zadania cyklicznego tworzy kolejne wystąpienie, ale ta logika (`completeRecurringTask`)
była wpięta TYLKO w ścieżki UI: przełącznik statusu (`toggleTaskStatus`) i operacje zbiorcze (`bulkUpdateTasks`).
Asystent AI woła `updateTask(id, { status: "DONE" })` bezpośrednio (executor `update_task`/`update_task_status`),
a `updateTask` samo w sobie następnika NIE tworzyło — więc oznaczenie zadania cyklicznego jako „zrobione" przez
AI gubiło kolejne wystąpienie. Ten sam wzorzec „logika biznesowa w wywołującym, nie w warstwie domenowej"
powtarzał się w petach: executor AI `log_treatment_done` **reimplementował** liczenie następnego terminu
(`parseRecurringRule`+`computeNextDue`) i osobno tworzył `petCareLog`, zamiast wołać domenowe `completeTreatment`
— ryzyko cichego rozjazdu (inna baza terminu, inne traktowanie `endDate`).
**Rozwiązanie:** Centralizacja efektu w JEDNYM miejscu egzekucji. W `updateTask` dodano jedyny punkt tworzenia
następcy przy „prawdziwym przejściu" (`patch.status==="DONE" && existing.status!=="DONE" && existing.recurring`);
logikę create'a wydzielono do prywatnego `spawnRecurringSuccessor`, a czyste wyliczanie dat/pól następnika do
testowalnej `computeRecurringSuccessor` w `lib/recurrence.ts`. `completeRecurringTask` stało się cienkim wrapperem
nad `updateTask` (przekazuje odstępstwa anchor/override wewnętrznym 3. parametrem), więc jest DOKŁADNIE jeden
spawn niezależnie od wejścia (UI/bulk/AI). Warunek „prawdziwego przejścia" oddziela pierwsze domknięcie (spawn)
od późniejszej edycji daty wykonania już-DONE (to obsługuje istniejący blok 022/023 na następcy) — brak dubletu.
W petach executor AI woła teraz `completeTreatment(t.id)`. Health/Habits sprawdzone — ich executory już wołały
akcje domenowe (`logDose`/`unlogDose`/`toggleHabitDay`), parytet OK.
**Lekcja:** Efekty uboczne (spawn cyklicznego następnika, `completedAt`, przeliczenia) trzymaj w warstwie
domenowej (akcja/serwis), nigdy w wywołującym (UI/executor AI). Test „czy ta akcja z KAŻDEGO wejścia daje ten
sam wynik?" wychwytuje takie pułapki. Gdy jest kilka wejść (UI, operacje zbiorcze, asystent AI) — zbiegają się
one do jednej funkcji domenowej; jeśli któraś ścieżka „obchodzi" tę funkcję i robi swoje, to bug czekający na
zgłoszenie. Przy centralizacji uważaj na podwójne wyzwolenie: dozwolony jest DOKŁADNIE jeden punkt efektu.

## 2026-07-23 — Anthropic: `temperature` deprecated w nowych modelach → 400 wywala agenta
**Problem:** Po przełączeniu dostawcy LLM na Anthropic asystent przestał odpowiadać („Asystent
chwilowo nie może połączyć się z modelem AI"). Diagnostyka: operacje `dispatch` (Haiku 4.5) przechodziły
200, ale operacja `reasoning` (home_agent) na `claude-sonnet-5` padała **400** z treścią
„`temperature` is deprecated for this model". Warstwa `chatComplete`/`chatStream` zawsze wstawiała do
ciała żądania Anthropic pole `temperature: opts.temperature ?? cfg.temperature ?? undefined`. Ponieważ
400 jest nieprzejściowy (`isRetryableLlmStatus` → false), przerywał łańcuch fallbacku — cały agent padał,
mimo że tańsze modele działały.
**Rozwiązanie:** W `src/lib/llm/chat.ts` wyodrębniono budowę ciała żądania do czystych, testowalnych
funkcji `openAiBody()` / `anthropicBody()`. Builder Anthropic **nie wysyła `temperature`** (Messages API
użyje domyślnej) — dla obu wariantów (jednorazowy i `stream:true`). Ścieżka OpenAI-compatible (Groq/OpenAI)
bez zmian. Dodano test `__tests__/anthropicBody.test.ts` (Anthropic bez `temperature`, OpenAI z
`temperature`).
**Lekcja:** Nowsze modele Anthropic (Claude 5 / Opus 4.x) odrzucają `temperature` — nie przekazuj tego
parametru do dostawcy Anthropic. Ogólniej: budowę ciała żądania per-dostawca trzymaj w jednej,
testowalnej funkcji i pamiętaj, że błąd 4xx (nieprzejściowy) przerywa fallback — pojedynczy zły parametr
potrafi wyłączyć całą operację, mimo działających modeli zapasowych.

## 2026-07-23 — Asystent AI: nazwa projektu ≠ id, i limity TPM różnią się per model
**Problem:** Dwa niezależne błędy w czacie asystenta. (1) Na „zadania z projektu LZ" agent wywoływał
`list_tasks` z `projectId:"LZ"` (nazwa, nie cuid) — read-tool filtrował po surowej wartości, zwracał
pustą listę i asystent twierdził „nie ma zadań", choć były. (2) Zapytania agenta (~7,5k tok) wpadały w
limity Groq: 70b wyczerpywał dzienny TPD (429), a fallback na 8b-instant (limit 6000 TPM) odbijał 413
„Request too large" — bo `tpmLimiter` capował WSZYSTKIE modele jednym `DEFAULT_TPM=12000`, więc za duże
zapytanie przechodziło rezerwację i lądowało na modelu, który z definicji nie mógł go obsłużyć. Efekt:
mylące „nie mogę się połączyć" zamiast uczciwego „wyczerpany limit dzienny".
**Rozwiązanie:** (1) Helper `resolveProjectRef(userId, ref)` w `agentTools.ts` — rozwiązuje id-lub-nazwę
(dokładne id → dokładna nazwa case-insensitive → jednoznaczne częściowe) w granicach dostępu; brak/wiele
dopasowań → `throw` z listą dostępnych nazw (łapane przez `runReadTool` → `{error}` → agent robi
`clarify`). Wpięte w `list_tasks` (get_task nie ma parametru projektu). (2) Limity TPM per-model w
`tpmLimiter.ts` (`modelTpmLimit()`: 70b=12000, 8b=6000) + w `chatComplete` pomijanie modelu, w którym
szacowane `prompt+maxTokens` przekracza jego limit — z zachowaniem POPRZEDNIEJ realnej porażki jako
`last` (uczciwy komunikat), a gdy pominięto wszystkie → jasny PL „Zapytanie było zbyt duże". Plus
przycięcie promptu (historia: budżet 2500 znaków + `MAX_HISTORY_MESSAGES` 12→8) i osobny komunikat dla 413.
**Lekcja:** (a) Gdy narzędzie AI przyjmuje „id", warto pozwolić podać też NAZWĘ i rozwiązać ją serwerowo
(zero kosztu tokenów, zero halucynacji id) — a brak dopasowania sygnalizować agentowi błędem, nie cichą
pustką. (b) Limity dostawcy (TPM/TPD) różnią się per model — fallback musi je znać i NIE kierować
zapytania do modelu, który go nie zmieści; inaczej degradacja produkuje gorszy błąd niż oryginał.
**Uwaga składniowa:** `READ_TOOLS_PROMPT` to template literal (backticki) — nie wstawiaj w opisach
narzędzi tekstu w backtickach (``\`projectId\```), bo urywa string (TS1005).

## 2026-07-22 — Kotwica „od daty wykonania": korekta daty wykonania musi przeliczyć termin następcy
**Problem:** Kotwica cykliczności `COMPLETION` („licz od daty wykonania") liczy termin następnego
wystąpienia w chwili domknięcia i zapisuje go na sztywno na następcy. Po 021/022 datę wykonania da się
poprawić po fakcie — 022 synchronizował `lastCompletedAt` następcy, ale NIE jego `dueDate`. Dla kotwicy
COMPLETION termin następcy zostawał policzony od starej daty i rozjeżdżał się z poprawioną (np. korekta
o 12 dni wstecz → następne zadanie dalej 12 dni za daleko).
**Rozwiązanie:** W `updateTask`, w bloku sync 022, dla `rule.anchor === "COMPLETION"` (jawna niepusta
data + istniejące poprzednie `completedAt`) pobieramy aktywnego (`status != DONE`) bezpośredniego
następcę (`previousTaskId`) i przeliczamy jego `dueDate = computeNextDue(newCompletedAt, rule)` —
ale TYLKO gdy jego termin jest „nietknięty", tj. `successor.dueDate === computeNextDue(oldCompletedAt,
rule)` (heurystyka: równość terminów wyłącza ręczne zmiany i „Następne w tej dacie"). Start następcy
przesuwamy o tę samą różnicę (`newNextDue - oldNextDue`). DUE / zrobiony następca / niecykliczne —
nietknięte.
**Lekcja:** Gdy wartość jest DENORMALIZOWANA i liczona od innego pola przy zdarzeniu (tu: termin
następcy liczony od daty wykonania przy domknięciu), późniejsza edycja pola źródłowego musi przeliczyć
wszystkie zależne wartości, nie tylko część. „Czy użytkownik ruszył wartość ręcznie?" najtaniej
rozpoznać przez równość z tym, co system by policzył — bez dodatkowej flagi w schemacie.

## 2026-07-22 — Cykliczne: bulk „Zrobione" musi rolować przez akcję cykliczną + link wystąpień
**Problem:** Po 020/021 zostały luki w modelu cyklicznym: (a) masowa zmiana statusu na „Zrobione"
(`bulkUpdateTasks`) robiła surowy `prisma.task.update`, więc NIE generowała kolejnego wystąpienia
(klik z listy/szczegóły robiły to przez `completeRecurringTask`); (b) nie było powiązania między
wystąpieniami, więc edycja daty zrobienia domkniętego cyklicznego nie mogła zaktualizować „daty
ostatniego zrobienia" (`lastCompletedAt`) jego następcy.
**Rozwiązanie:** Dodano nullable self-FK `Task.previousTaskId` (relacja `TaskRecurrence`, `onDelete:
SetNull`, migracja 0208) — `completeRecurringTask` ustawia go na nowym wystąpieniu obok
`lastCompletedAt`. `bulkUpdateTasks` przy `→DONE` na zadaniu z `recurring` woła teraz
`completeRecurringTask(id, { completionDate })` zamiast surowego update (usuwa `status` z `data`,
resztę pól/tagów nakłada normalnie). `updateTask` po jawnej edycji `completedAt` robi
`updateMany({ where: { previousTaskId: id }, data: { lastCompletedAt } })` — synchronizuje następcę.
**Lekcja:** Gdy operacja ma spójne „szybką ścieżkę" (`completeRecurringTask`) i „wolną ścieżkę"
(surowy bulk update), bulk NIE może iść skrótem — musi wołać tę samą akcję domenową, inaczej gubi
efekty uboczne (tu: generację następnego wystąpienia). Denormalizowaną wartość (`lastCompletedAt`)
trzymaj spójną przez trwały link (`previousTaskId`) + sync przy edycji, a nie licz jej w locie.

## 2026-07-22 — Edytowalna data wykonania: jawny `completedAt` musi bić derivację ze statusu
**Problem:** Data wykonania (`completedAt`) miała stać się edytowalna (szczegóły + bulk + wybór przy
oznaczaniu). Pułapka: `updateTask` wyprowadza `completedAt` z przejścia statusu (→DONE = teraz), a
`data` budowane było przez `{ ...patch }`. Gdyby `completedAt` weszło razem z patchem, a potem wyliczona
wartość by je nadpisała (albo odwrotnie), edycja daty byłaby ignorowana lub niespójna.
**Rozwiązanie:** W `updateTask` `completedAt` NIE wchodzi już przez `{ ...patch }` — wyłuskujemy je
(`const { completedAt: explicit, ...restPatch } = patch`) i ustawiamy jawnie: `final = explicit !==
undefined ? explicit : derived`. Jawnie podana data (edycja w szczegółach / oznaczanie z datą) ma
PIERWSZEŃSTWO nad wyliczoną ze statusu; brak podanej → zachowanie jak dotąd (→DONE=teraz, →inny=null).
`bulkUpdateTasks` dostał opcjonalny wspólny `completedAt`: przy `status→DONE` `data.completedAt =
scalar.completedAt ?? new Date()`. UI: pole „Ukończone" w `TaskDetail` (type=date, wzór pola „Start")
oraz opcjonalne pole daty w panelu „Status" bulku (stosowane, gdy `s.isTerminal`). Szybkie odhaczanie w
wierszu bez zmian („teraz").
**Lekcja:** Gdy pole jest zarazem WYLICZANE (z innego pola) i EDYTOWALNE, nie wpuszczaj go przez
`{ ...patch }` — wyłuskaj i jawnie ustal priorytet (jawna wartość > wyliczona), inaczej jedno cicho
nadpisze drugie. `resolveStatuses` zwraca `isTerminal` per status — używaj tego zamiast dublować logikę
„czy status zamykający".

## 2026-07-22 — „Sort zrobionych po dacie" nie dawał różnicy — brakowało WIDOCZNEJ daty na wierszu
**Problem:** Przycisk „Sortuj zrobione po dacie wykonania" (druga zgłoszona próba) nadal „nie dawał
różnicy". Poprzednia poprawka (018) tylko rozwijała zwiniętą sekcję. Realna przyczyna: wiersze zadań w
sekcji „Zrobione" NIE pokazywały daty wykonania, więc nawet poprawny reorder „wyglądał tak samo", a
domyślna kolejność bywała zbliżona do kolejności wg daty. Dodatkowo właściciel chciał, by data była
„datą OSTATNIEGO wykonania" — czyli aktywne zadanie cykliczne też powinno pokazywać datę poprzedniego
wykonania (a przy przetaczaniu cyklu powstaje NOWY rekord z `completedAt = null`).
**Rozwiązanie:** (1) Nowa kolumna `Task.lastCompletedAt` (migracja 0207, nullable) — `completeRecurringTask`
ustawia ją na nowym wystąpieniu = data wykonania właśnie zamkniętego. (2) `TaskRow` pokazuje dyskretny
znacznik „✓ <data>" gdy `completedAt ?? lastCompletedAt` istnieje (widoczna data w sekcji „Zrobione" i
data ostatniego wykonania na aktywnych cyklicznych). (3) `CompletedSection` sortuje po tej efektywnej
dacie malejąco i zmienia nagłówek przy aktywnym sorcie („— wg daty wykonania"), zachowując auto-rozwinięcie
z 018. Efekt: klik daje jednoznaczną, widoczną różnicę (kolejność + daty + nagłówek).
**Lekcja:** „Sortowanie nie działa" bywa naprawdę „nie widać PO CZYM sortujemy" — zanim dłubiesz w
logice sortu, pokaż użytkownikowi klucz sortowania (tu: datę) na elemencie; sam reorder bez widocznego
klucza wygląda jak brak zmiany. Gdy „ostatnie wykonanie" ma dotyczyć bytu, który przy zdarzeniu tworzy
NOWY rekord (cykliczne zadania → nowe wystąpienie), potrzebujesz trwałego pola przenoszonego na następcę,
bo `completedAt` nowego rekordu jest puste.

## 2026-07-22 — Przepisanie kompozytora asystenta na układ „Chat with Claude" (dwuwierszowa karta)
**Problem:** Kompozytor asystenta był jednowierszową „pigułką" (`[+] · pole flex-1 · mikrofon · wyślij`)
z uporczywym błędem karetki na iOS (kursor nad polem do pierwszego wpisania) — kolejne punktowe naprawy
nie pomagały, a jedna (VisualViewport) zepsuła płynność przewijania. Właściciel poprosił o przepisanie
od nowa na wzór „Chat with Claude".
**Rozwiązanie:** Nowy układ **dwuwierszowej karty** w `AICommandSheet.tsx`: WIERSZ 1 = pole tekstowe
pełnej szerokości (auto-rozrost przez istniejący `useEffect` na `scrollHeight`), WIERSZ 2 = wiersz akcji
(lewo: aparat `capture="environment"` + galeria; prawo: mikrofon dyktowania + główny przycisk
Stop/Wyślij[`ArrowUp`]/Rozmowa-głosowa). Ikona „Ustawienia asystenta" przeniesiona z menu „+" do
GÓRNEGO paska nagłówka (panel `showPrefs` już był u góry — przeniesiono sam wyzwalacz); menu „+" i stan
`showPlus` usunięte. Kluczowe dla karetki: pole NIE jest przy dolnej krawędzi karty (pod nim statyczny
wiersz akcji), a margines na kreskę iPhone siedzi na ZEWNĘTRZNEJ stopce warunkowo od fokusu — żadnego
`env(safe-area-inset-bottom)` pod fokusowanym polem. Bez dynamicznej zmiany wysokości na scroll
(płynne przewijanie). Zero zmian w agencie/LLM. Właściciel rezygnował z „dodaj plik" (tylko obrazy).
**Lekcja:** Gdy punktowe łatki nie domykają błędu układu, czasem szybciej i czyściej jest przepisać
fragment na sprawdzony wzorzec (tu: dwuwierszowa karta jak w Claude) niż mnożyć obejścia. Trzymaj pole
wejścia z treścią pod spodem (statyczny wiersz akcji), a insety safe-area poza fokusowanym polem —
to strukturalnie eliminuje „kursor nad polem" na iOS. Zachowaj istniejące handlery przy przepisaniu
UI — zmieniaj układ, nie logikę.

## 2026-07-22 — Surowy komunikat dostawcy przeciekał NIE-429 ścieżką + iOS „kursor nad polem" po zdjęciu zoomu
**Problem:** (1) Mimo poprawki 017 (uczciwy PL komunikat przy 429) użytkownik znów zobaczył surowy tekst
dostawcy („Rate limit reached for model …"). Przyczyna: w `agent/route.ts` ładny komunikat robił się
TYLKO dla `status === 429`; gałąź `else` zwracała `providerMsg || "Błąd LLM"`, czyli surową treść. Po
wyczerpaniu łańcucha fallbacku (Z-133) limit potrafi odbić z innym statusem (503/502) → przeciek. Drugi
przeciek: `catch` strumienia SSE wysyłał `e.message` wprost. (2) Kursor w asystencie pojawiał się NAD
polem do pierwszego wpisania. KLUCZOWA diagnoza właściciela: problem pojawił się DOKŁADNIE, gdy
dodaliśmy dolny `paddingBottom: env(safe-area-inset-bottom)` do stopki kompozytora (żeby pole nie było
zasłonięte kreską iPhone). Przy oryginalnym `py-3` (bez safe-area) karetka była POPRAWNA. Czyli offset
karetki bierze się z dodatkowego paddingu POD fokusowanym polem w bottom-sheecie iOS — Safari liczy
scroll-into-view z tym paddingiem i przesuwa karetkę w górę o ~jego wysokość.
**Rozwiązanie:** (1) Na granicy prezentacji NIGDY nie zwracamy surowej treści dostawcy (C-41): limit
rozpoznajemy po statusie 429 LUB po treści (`/rate.?limit|per day|per minute|tpd|tpm|quota/`), reszta →
ogólny uprzejmy PL komunikat; surowe idzie tylko do `console.warn`. `catch` SSE też daje ogólny
komunikat + `console.error`. (2) Margines safe-area dokładamy TYLKO gdy pole NIE ma fokusu
(`composerFocused ? undefined : "max(0.75rem, env(safe-area-inset-bottom))"`, sterowane `onFocus`/
`onBlur`). Przy zamkniętej klawiaturze pole czyści kreskę iPhone; przy pisaniu (klawiatura otwarta,
kreski i tak nie ma) geometria wraca do `py-3` — tej, przy której karetka była poprawna.
**Odrzucona ścieżka:** próba „podnoszenia sheeta nad klawiaturę" przez `window.visualViewport`
(paddingBottom nakładki + dynamiczny `maxHeight`) NIE naprawiła karetki, a dodatkowo brzydko szarpała
scrollem czatu (sheet zmieniał wysokość na każdym evencie `scroll` VisualViewport). Usunięta.
**Lekcja:** Komunikaty błędów mapuj na przyjazne NA KAŻDEJ gałęzi (429 i „reszta"), nie tylko w
happy-casie — inaczej surowy tekst dostawcy przecieka bokiem; rozpoznawaj limit też po TREŚCI, bo status
bywa inny po fallbacku. Przy błędzie karetki „kursor nad polem" na iOS podejrzewaj DOLNY padding/inset
pod fokusowanym polem w kontenerze `position: fixed` — usuń go na czas fokusu, zamiast budować
skomplikowaną logikę VisualViewport. I słuchaj dokładnej obserwacji właściciela „zaczęło się, gdy…" —
to była najkrótsza droga do przyczyny.

## 2026-07-22 — Anty-zoom 16px odsłonił błąd pudełka pola + `calc(pad + safe-area)` zawyża odstęp
**Problem:** Po wymuszeniu 16px na polach (reguła anty-zoom) kompozytor asystenta AI dostał dwa
regresyjne defekty: (1) pole „za wysoko" — stopka miała `paddingBottom: calc(0.75rem +
env(safe-area-inset-bottom))`, czyli DODAWAŁA cały inset do istniejącego `py-3`, przez co na iPhonie
pole unosiło się ~34px za wysoko; (2) kursor pojawiał się NAD polem do pierwszego wpisania — textarea
miała stałą `height: 38` (border-box, padding 9px → 20px na treść), a linia 16×1.4 = 22.4px nie mieści
się w 20px, więc karetka wychodziła nad pole; dopiero auto-rozrost (useEffect na scrollHeight) po
pierwszym wpisaniu ustawiał poprawną wysokość.
**Rozwiązanie:** (1) `paddingBottom: max(0.75rem, env(safe-area-inset-bottom))` — czyści home indicator
bez nadmiarowego odstępu (na desktopie i tak = 0.75rem). (2) Usunięto stałą `height: 38` z textarea;
wysokość liczy wyłącznie auto-rozrost + `minHeight: 40`, więc linia 16px mieści się od pierwszego
renderu (przy okazji znika walka React↔useEffect o `height`).
**Lekcja:** Do odstępu na `safe-area-inset` używaj `max(padding, env(...))`, nie `calc(padding +
env(...))` — suma zawyża. Wymuszając globalnie 16px na polach sprawdź komponenty ze STAŁĄ wysokością
liczoną pod mniejszy font (tu 38px pod 15px) — 16px z lineHeight 1.4 potrzebuje ~40px, inaczej karetka/
tekst wychodzą poza pudełko. Nie ustawiaj `height` inline na polu, którym i tak steruje auto-rozrost.

## 2026-07-22 — Style inline `font-size` omijają globalną regułę anty-zoom iOS + zwinięta grupa maskuje działający sort
**Problem:** (1) Mimo istniejącej reguły `@media (pointer: coarse){ input,select,textarea{ font-size:16px } }`
asystent AI nadal przybliżał (zoom iOS) przy focusie pola. Przyczyna: kompozytor w `AICommandSheet.tsx`
ma font-size ustawiony **inline** (`style={{ fontSize: 15 }}`), a styl inline ma wyższą specyficzność
niż reguła z arkusza bez `!important` — więc efektywny rozmiar to 15px < 16px i Safari przybliżał. To
samo dotyczyło `SmartTextarea` (inline `fontSize:14`). (2) Ikona „Sortuj zrobione po dacie wykonania"
wyglądała na niedziałającą — po kliknięciu żadnej różnicy w widoku. Sort działał poprawnie, ale sekcja
„✓ Zrobione / Anulowane" jest **domyślnie zwinięta** (`defaultOpen={false}`), więc przesortowana lista
była schowana.
**Rozwiązanie:** (1) Dodano `!important` do reguły anty-zoom w `globals.css` (tylko `pointer: coarse`),
żeby wygrywała z inline `fontSize < 16` — globalnie, dla wszystkich pól teraz i w przyszłości, bez
tropienia każdego z osobna. Pinch-zoom nietknięty (brak `maximum-scale`/`user-scalable`). (2)
`CompletedSection` rozwija grupę, gdy sort jest aktywny: `defaultOpen={sortBy === "completedAt"}` +
`key={sortBy}` (remount przy przełączeniu → ponowne zastosowanie `defaultOpen`). Przy okazji: pasek
akcji masowych zadań dostał `overflow-x-auto [&>*]:flex-shrink-0` (mieści się przewijaniem na mobile),
a stopka kompozytora asystenta `paddingBottom: calc(0.75rem + env(safe-area-inset-bottom))`
(nad kreską iOS).
**Lekcja:** Globalna reguła CSS na pole formularza NIE zadziała, jeśli komponent ustawia właściwość
inline — inline bije arkusz bez `!important`. Przy regułach „na wszystkie pola" (anti-zoom, kolory)
zakładaj, że gdzieś jest inline i użyj `!important` w wąsko scope'owanej regule (`pointer: coarse`).
Gdy funkcja „nie daje efektu w widoku", sprawdź, czy wynik nie jest schowany (zwinięta grupa/panel) —
zanim uznasz logikę za zepsutą.

## 2026-07-21 — Groq ma limit DZIENNY (TPD), nie tylko minutowy — degradacja na lżejszy model
**Problem:** Po pacingu (016) asystent dalej padał. Produkcyjny log `/admin/ai-calls` pokazał inny
limit niż zakładaliśmy: `429 … on tokens per day (TPD): Limit 100000, Used ~98300`. To **dzienny** limit
darmowego Groqa na modelu reasoning (llama-3.3-70b): każde wywołanie reasoning kosztuje 6–8k tokenów,
więc ~13–16 interakcji wyczerpuje CAŁY dzień; potem 429 aż do północy UTC. Retry i pacing minutowy tego
NIE ruszą (dziennego okna nie da się przeczekać w kilka sekund). Komunikat „chwilowy limit… spróbuj za
chwilę" był w tym wypadku nieprawdą.
**Rozwiązanie:** (1) Degradacja: do łańcucha `resolveLlmChain("reasoning")` dołożono ostatnie ogniwo —
Groq `llama-3.1-8b-instant` (osobny budżet; w logach działał, gdy 70b padał). `chatComplete` sam próbuje
8b po 429 na 70b, więc asystent zwykle i tak odpowiada (świadoma zgoda właściciela na słabszą odpowiedź).
(2) Uczciwy komunikat: `classifyRateLimitKind` rozpoznaje w treści błędu „per day/TPD" vs „per minute/TPM"
i `rateLimitUserMessage` zwraca polski komunikat — dzienny („po północy UTC / ustaw płatny model w
Admin → LLM") vs minutowy („spróbuj za chwilę"). Nigdy surowy tekst dostawcy (C-41).
**Lekcja:** Zanim uznasz limit dostawcy za „chwilowy", sprawdź w treści błędu, czy to per-minute czy
per-day — to zupełnie inne strategie (przeczekać sekundy vs przełączyć model / poczekać do jutra). Na
darmowym tierze o ciasnym limicie dziennym miej gotowy fallback na lżejszy model z osobnym budżetem;
docelowo płatny model znosi problem. I dawaj użytkownikowi PRAWDĘ o rodzaju limitu.

## 2026-07-21 — Diagnostyka asystenta: nieudane wywołania LLM były NIELOGOWANE + pacing pod TPM Groqa
**Problem:** Zgłoszenie „nadal nie działa" po redukcji promptu. Nie dało się dojść przyczyny, bo
`recordAiCall` logował do `AiCall` **tylko udane** wywołania (kod w `chatComplete` był w gałęzi
`if (res.ok)`), więc 429/5xx nie zostawiały śladu → „brak logów agenta dla rozmowy, która padła".
Dodatkowo nie było wiązania wpisów z rozmową (`conversationId`), więc nie dało się odtworzyć przebiegu
krok po kroku. Osobno: sama redukcja promptu nie gwarantuje, że kilka wywołań tej samej minuty nie
przebije TPM (przy większym modelu / dłuższej historii).
**Rozwiązanie:** (1) `AiCall` rozszerzony o `status`, `errorText`, `conversationId`, `attempts`
(migracja 0206) i logowanie **także** nieudanych wywołań; `conversationId` przepchnięty z klienta przez
route agenta do `chatComplete` (callAgent/routeModules/classifyIntent). (2) Panel `/admin/ai-calls`
(admin) pokazuje surowy log per rozmowa z przyciskiem „Kopiuj". (3) Pacing pod TPM: `lib/llm/tpmLimiter.ts`
— kroczące okno 60 s rezerwuje szacowane tokeny PRZED wysłaniem do Groqa (wykrywanie po `groq.com` w
baseUrl; Anthropic bez pacingu), więc kilka wywołań minuty czeka zamiast dostać 429. „Wolniej, ale
działa" — zgodnie z decyzją właściciela.
**Lekcja:** Log per-wywołanie MUSI obejmować błędy — inaczej najważniejszy przypadek (padło) jest
niewidoczny. Wiąż wpisy z jednostką pracy (rozmowa), żeby dało się odtworzyć przebieg. Przy dostawcy z
ciasnym TPM nie wystarczy retry ani redukcja — dołóż **pacing** (rezerwacja tokenów w oknie), bo retry w
kilka sekund nie przeczeka okna minuty.

## 2026-07-21 — „Przeciążony asystent" na „pokaż zadania otagowane X" — limit TPM był STRUKTURALNY, nie chwilowy
**Problem:** Mimo poprawek ze spec 010 (retry z backoffem + filtr po tagu w `list_tasks`) polecenie „pokaż
zadania otagowane »raj«" nadal kończyło się komunikatem „Asystent jest teraz przeciążony…", choć zadania z
tym tagiem istniały (brak logów agenta = padało już na pierwszym wywołaniu). Przyczyna: 010 założyło, że
limit Groqa (12000 TPM) jest **chwilowy** i wystarczy go „przeczekać" retry. W rzeczywistości pełny katalog
~50 narzędzi odczytu (`READ_TOOLS_PROMPT`, ~2000 tok.) trafiał do KAŻDEGO wywołania modelu — a proste
zapytanie odczytowe odpala **dwa** wywołania (query→answer, ~5–6k tok. każde). Dwa takie wywołania w jednej
minucie przebijały 12000 TPM **za każdym razem** — 8-sekundowy retry nie miał szans, bo okno się nie zwalniało.
**Rozwiązanie:** Odchudzono prompt agenta: `buildReadToolsPrompt(modules)` filtruje katalog narzędzi odczytu
do modułów wybranych przez router (`READ_TOOL_MODULE` + `CORE_READ_TOOLS`), dokładnie tak, jak
`buildActionCatalog` już filtruje akcje. Dla zapytania o zadania prompt spada z ~2000 do ~kilkuset tokenów
narzędzi/wywołanie → dwa wywołania mieszczą się poniżej TPM. `READ_TOOLS_PROMPT` został źródłem prawdy
(builder tylko filtruje jego wiersze — bez transkrypcji, bez ryzyka rozjazdu).
**Lekcja:** Gdy „chwilowy" limit dostawcy odbija **powtarzalnie** i to samo polecenie ginie za każdym razem —
to nie jest chwilowość, tylko **strukturalne** przekroczenie budżetu na wywołanie/minutę; retry tego nie
naprawi. Najpierw policz, ile tokenów i ile wywołań generuje JEDNO polecenie (Groq wlicza `max_tokens` i cały
prompt do TPM), i **redukuj zapotrzebowanie** (filtruj kontekst do potrzebnego zakresu), zamiast dokładać
kolejny retry. Brak logów agenta = pada przed pierwszą myślą → patrz na rozmiar pierwszego wywołania.

## 2026-07-20 — Przeciążona ikona kosza: `Trash2` znaczyła i „usuń", i „otwórz Kosz/odzyskiwanie"
**Problem:** Ta sama ikona `Trash2` była używana w dwóch sprzecznych znaczeniach: **„usuń element"**
(~65 miejsc, wszystkie moduły — spójnie) oraz **„otwórz Kosz `/trash`" (odzyskiwanie)** — w nagłówkach
Zadań i Notatek. W pasku akcji, obok innych ikon-koszy, które usuwają, link do Kosza czytał się jak
„usuń" (na mobile bez tooltipa — całkiem myląco). Dodatkowo Kosz jest globalny, ale osiągalny tylko z 2
z ~20 modułów i znikąd globalnie.
**Rozwiązanie:** Skróty do Kosza w nagłówkach Zadań/Notatek dostały **osobną ikonę `ArchiveRestore`**
(jednoznacznie „przywracanie"), a `Trash2` zostaje **wyłącznie** dla akcji usuwania. Tooltip/aria
doprecyzowane („Kosz — przywróć usunięte"). Strona Kosza była już OK: przywracanie = `RotateCcw`,
opróżnianie/trwałe usunięcie = `Trash2` (prawdziwe delete).
**Lekcja:** Jedna ikona = jedno znaczenie. Kosz jako *lokalizacja* (Bin) i kosz jako *akcja usuń* to
dwie różne rzeczy — nie oznaczaj ich tym samym glifem w tym samym kontekście (pasek akcji). Gdy
weryfikujesz spójność ikonografii, grepnij **wszystkie** użycia glifu i rozdziel „akcja" od
„nawigacja/lokalizacja". Do „odzyskiwania" użyj ikony restore (`ArchiveRestore`/`RotateCcw`), nie kosza.

## 2026-07-20 — Mobile UX: hover-only akcje, niewidoczny feedback transition i ukryty scroll poziomy
**Problem:** Trzy wzorce psuły UX na dotyku: (1) w Wiadomościach (`NewsPage`) akcje tematu Edytuj/Usuń
były `hidden group-hover:block` — na telefonie (brak hover) **nigdy** się nie pokazywały i były za małe
(13px); (2) w `TaskDetail` przycisk „Zapisz" cykliczności wołał `updateTask` przez `useTransition`, ale
jedyny sygnał (`Loader2` w nagłówku) był na mobile niewidoczny — wyglądało, jakby nic się nie stało; (3)
pasek akcji listy zadań (`TasksPage`) miał `overflow-x-auto`, ale bez żadnej wskazówki, że da się go
przewinąć — część ikon była poza kadrem i „nieodkrywalna".
**Rozwiązanie:** (1) `hidden group-hover:block` → widoczne domyślnie + `md:hidden md:group-hover:block`
(hover chowa je tylko na desktopie), ikony 16px, `p-1.5` na cel dotyku; (2) lokalny stan
`recurringSaving/recurringSaved` + `setTimeout` — przycisk pokazuje w miejscu „Zapisywanie…" → „Zapisano"
(zielony, ~1.5 s) → „Zapisz"; (3) wrapper `relative` + stan `actionScroll{left,right}` liczony ze
`scrollWidth/clientWidth/scrollLeft` (`onScroll` + resize) i dekoracyjny fade `linear-gradient(...,
var(--bg-surface), transparent)` na krawędzi (`pointer-events:none`, `aria-hidden`).
**Lekcja:** Na dotyku `group-hover` jest niedostępny — akcje kontekstowe rób widoczne domyślnie i chowaj
dopiero od `md` w górę. Globalny spinner z `useTransition` bywa na mobile niewidoczny — dawaj feedback
**w miejscu akcji** (stan przycisku). Kontener `overflow-x-auto` bez wizualnej wskazówki = ukryte funkcje;
zanikający gradient (kolor = tło paska, `pointer-events:none`) sygnalizuje scroll bez psucia estetyki i
skinowalności.

---

## 2026-07-20 — Łamanie długich URL w markdown: catch-all przez dziedziczony overflow-wrap
**Problem:** Po dodaniu `overflow-wrap:anywhere` tylko do `.md-p/.md-li/.md-td/.md-link` długie linki w
treści wiedzy (module Wiadomości, `KnowledgePanel` → `markdownToHtml` → klasa `markdown-body`) DALEJ
rozpychały sekcję, jeśli URL trafił do **nagłówka** (`.md-h1..h6`) albo **inline-code** (`.md-code`),
których nie objąłem. Łatanie klasa-po-klasie było niekompletne.
**Rozwiązanie:** `overflow-wrap` i `word-break` są **dziedziczone**, więc jedna reguła na kontenerze —
`.markdown-body { overflow-wrap: anywhere; word-break: break-word; min-width: 0; }` — wymusza łamanie we
WSZYSTKICH potomkach naraz (nagłówki, code, cytaty, linki). Bloki kodu (`white-space: pre`) i tak się nie
łamią i scrollują przez `.md-pre` (`overflow-x:auto`) — dziedziczenie ich nie psuje.
**Lekcja:** Gdy chcesz wymusić właściwość TEKSTOWĄ (overflow-wrap, word-break, white-space, color) na
całym poddrzewie — ustaw ją raz na kontenerze i wykorzystaj dziedziczenie, zamiast łatać każdą klasę
elementu z osobna (łatwo pominąć nagłówek/kod). Do łamania URL-i: `overflow-wrap: anywhere` na wrapperze.

## 2026-07-20 — UX dodawania w Omnii: quick-capture (tytuł) + pełny formularz na klik, nie mini-form
**Problem:** Inline mini-formularz „szybkiego dodawania" zadania (tytuł + priorytet + pole daty + „+") gniótł
się na mobile — natywne pole daty (16px anty-zoom) i „+" nie mieściły się w jednym rzędzie.
**Rozwiązanie:** Analiza innych modułów (Health `EventForm`, Flota, Contacts) pokazała spójny wzorzec:
JEDEN pełny formularz inline dla add+edit, otwierany przyciskiem. Tasks ma już taki pełny formularz
(`TaskDetail`, otwierany kliknięciem zadania). Dlatego uprościłem quick-add do jednego czystego rzędu
`[priorytet][tytuł][+]` (szybkie przechwytywanie — mocna strona listy zadań), a WSZYSTKIE pozostałe pola
(termin, projekt, powtarzalność, podzadania) przeniosłem do `TaskDetail`. Efekt: brak gniecenia na mobile,
zachowana szybkość, spójność z resztą aplikacji.
**Lekcja:** Nie upychaj wielu pól w inline pasku dodawania na mobile. Dla list o wysokiej częstości dodawania
(zadania) trzymaj quick-capture = sam tytuł; szczegóły w pełnym formularzu edycji (jeden komponent add=edit),
jak robią to inne moduły. „Mniej pól w pasku, reszta w formularzu" > „wszystko w jednym rzędzie".

## 2026-07-20 — Wykluczenie z modalOpen nie wystarczy: panel z-50 i tak zasłania FAB (z-index)
**Problem:** Po oznaczeniu mobilnego podglądu zadania `data-omnia-overlay` (żeby `modalOpen` się nie
zapalał i FAB asystenta się renderował) ikony asystenta i „zgłoś błąd" DALEJ były niewidoczne na mobile.
Powód: sam fakt renderowania nie wystarcza — panel podglądu jest `fixed inset-0 z-50`, a pływające
przyciski miały `zIndex 41` (asystent) i `39` (feedback), więc panel je **zasłaniał**. Co gorsza,
regresja: wcześniej (gdy panel liczył się jako modal) feedback wskakiwał na `z-10001` i BYŁ widoczny —
po wykluczeniu spadł na 39 i zniknął.
**Rozwiązanie:** Dodałem do `useOverlayState` sygnał `panelOpen` (obecność `[data-omnia-overlay="panel"]`)
i podbijam z-index przycisków TYLKO gdy panel otwarty: FAB `panelOpen?55:41`, feedback
`modalOpen?10001:(panelOpen?54:39)`. Wartości dobrane między panelem (50) a toastami (60), więc przyciski
są nad panelem, ale pod toastami. Marker zmieniłem z „taskdetail" na generyczny „panel".
**Lekcja:** „Odblokowanie renderu" (wykluczenie z detekcji modalu) to połowa sprawy — element i tak musi
mieć **wyższy z-index** niż nakładka, nad którą ma być widoczny. Przy pływających przyciskach trzymaj
świadomą skalę z-index (panel 50 < FAB 55 < toast 60) i podbijaj kontekstowo, nie globalnie (globalne
podbicie wchodziłoby nad menu nawigacyjne, też z-50).

## 2026-07-20 — Przepełnienie długim URL: break-words za słabe w gridzie, trzeba overflow-wrap:anywhere
**Problem:** Mimo `min-w-0` na kolumnie treści i `break-words` na tytule/streszczeniu newsów długie linki
bez spacji dalej rozpychały sekcję (poziomy scroll). `break-words` (`overflow-wrap: break-word`) NIE
zmniejsza rozmiaru min-content elementu, więc w kontenerze grid/flex liczonym od min-content długi token
i tak wymuszał szerokość.
**Rozwiązanie:** Przełączyłem łamanie na `overflow-wrap: anywhere` (Tailwind arbitralnie
`[overflow-wrap:anywhere]`) — to JEDYNY wariant, który wpływa na min-content i pozwala kontenerowi się
zwęzić. Dodatkowo `min-w-0 overflow-hidden` na karcie jako twarda gwarancja (residualny overflow się
przycina, nie rozpycha strony).
**Lekcja:** Do łamania długich URL używaj `overflow-wrap: anywhere`, nie `break-word` — tylko `anywhere`
redukuje min-content, co jest kluczowe w grid/flex. `break-all` odpada (brzydko tnie zwykłe słowa).

## 2026-07-20 — Pływający FAB asystenta znikał także na desktopie przy szczegółach zadania
**Problem:** Ikona asystenta AI (Sparkles FAB) chowała się przy otwartych szczegółach zadania i na
mobile, i na komputerze. Chowanie steruje `useOverlayState`, który wykrywa „modal treściowy" przez
`document.querySelector('[class~="fixed"][class~="inset-0"]:not([data-omnia-overlay])')`. Mobilny panel
szczegółów w `TasksPage.tsx` ma klasy `md:hidden fixed inset-0 z-50` — i choć `md:hidden` ukrywa go na
desktopie wizualnie, **element wciąż jest w DOM**, a `querySelector` matchuje po atrybucie `class`, nie po
`display`. Dlatego FAB znikał również na komputerze.
**Rozwiązanie:** Oznaczyłem wrapper mobilnego panelu `data-omnia-overlay="taskdetail"` — selektor
`:not([data-omnia-overlay])` go pomija, więc `modalOpen` nie zapala się przy szczegółach zadania (FAB
zostaje widoczny na obu platformach). Świadomie zrobiliśmy z panelu szczegółów wyjątek od reguły
„chowaj FAB nad modalem" — to ekran roboczy, nie przelotny dialog.
**Lekcja:** Detekcja stanu UI przez `querySelector` po klasach `fixed inset-0` łapie też elementy ukryte
przez `md:hidden` (bo są w DOM). Przy responsywnych „modalach mobilnych" trzeba je jawnie wykluczać
(`data-omnia-overlay`) albo montować warunkowo, inaczej fałszywie zmieniają stan na desktopie.

## 2026-07-20 — Anty-zoom iOS: reguła CSS musi przebić specyficzność utility Tailwinda
**Problem:** iOS Safari auto-przybliża widok przy focusie pola z `font-size < 16px` (wiele pól używa
`text-sm`/`text-xs`). Naiwna reguła `input { font-size: 16px }` (specyficzność 0,0,0,1) **nie zadziała** —
utility Tailwinda `.text-xs` (0,0,1,0) ją przebija i pole zostaje 14/12px, więc zoom dalej występuje.
**Rozwiązanie:** Reguła w `globals.css` w `@media (pointer: coarse)` z selektorem
`input:not([type="checkbox"]):not([type="radio"]), select, textarea { font-size: 16px }` — `input:not(...)`
ma specyficzność ~0,0,2,1, więc wygrywa z `.text-xs` **bez** `!important`. Celujemy tylko w `pointer:
coarse` (dotyk), desktop zostaje z gęstszym tekstem; **nie** ruszamy `maximum-scale`/`user-scalable`, więc
pinch-zoom (dostępność) zachowany.
**Lekcja:** Nadpisując Tailwindowe utility surowym CSS-em pilnuj specyficzności — użyj selektora
elementowego z `:not(...)`/atrybutami zamiast sięgać po `!important`. Anty-zoom rób przez font-size 16px
na dotyku, nie przez blokowanie skalowania.

---

## 2026-07-20 — „Brak brancha develop" — mylny wniosek z niepełnego lokalnego klonu
**Problem:** Przy domykaniu zadania stwierdziłem, że w repo nie ma brancha `develop`, bo `git branch -a`
pokazywał tylko `master` i branch roboczy. Na tej podstawie pominąłem przepływ przez `develop` i na „Tak"
właściciela poszedłem od razu na `master`. `develop` jednak ISTNIEJE na origin — lokalny klon miał
zawężony refspec (pobrane tylko `master` + branch roboczy), więc `remotes/origin/develop` nie było w
lokalnych refach.
**Rozwiązanie:** Odpytałem zdalne repo wprost: `git ls-remote --heads origin` — pokazało `refs/heads/develop`.
`develop` był przodkiem `master`, więc dociągnąłem go czystym fast-forwardem (`git checkout develop &&
git merge --ff-only master && git push origin develop`). Teraz `develop == master`.
**Lekcja:** NIGDY nie orzekaj „brak brancha X" na podstawie `git branch -a` w klonie sesyjnym — może mieć
niepełny refspec. Prawdę o zdalnych branchach daje `git ls-remote --heads origin` (albo `git fetch origin <branch>`).
Sprawdź to, ZANIM zdecydujesz o pominięciu `develop` czy pushu na `master`.

## 2026-07-20 — Asystent AI przeredagowywał opis zadania wpisany przez użytkownika
**Problem:** Przy tworzeniu zadania z asystenta (także przy zgłoszeniach admina o bugu/zmianie aplikacji)
opis był „lekko redagowany" — zamieniany na formę bezosobową i „poprawiany" gramatycznie. Właściciel chciał,
by opis pozostał DOKŁADNIE taki, jak wpisał user (tytuł generowany z treści jest OK, kontekst zgłoszenia
nadal doklejany).
**Rozwiązanie:** Źródłem redakcji NIE był kod akcji — `executeTasksAction`/`createTask` zapisują
`description` wiernie. Redagował LLM, bo prompt mu na to pozwalał. Poprawiono instrukcje w trzech promptach:
`agent/route.ts` (sekcja `create_task` — „lekka redakcja" → **verbatim**; oraz reguła bulk-add), oraz
`AICommandSheet.tsx` (prompt zgłoszenia admina — opis admina verbatim + doklejony kontekst). Dodatkowo
`lib/ai/fastPath.ts` (skrócona ścieżka `create_task`) dostała klauzulę verbatim dla spójności.
**Lekcja:** Gdy asystent „zmienia" treść wpisaną przez usera, szukaj przyczyny w **promptach systemowych
LLM**, nie w kodzie Server Action (który zwykle zapisuje dane 1:1). Pamiętaj, że tworzenie zadania ma DWIE
ścieżki generujące `description`: pełny agent (`agent/route.ts`) i deterministyczny fast-path
(`fastPath.ts`) — instrukcję trzeba zsynchronizować w obu, inaczej zachowanie zależy od tego, którą ścieżką
poszło polecenie.

## 2026-07-19 — Strona admina nie scrollowała się (AppShell `<main>` = overflow-hidden)
**Problem:** `/admin/ai-coverage` nie dało się przewinąć — długa treść była ucięta. Przyczyna: w
`AppShell` kontener `<main>` jest `flex-1 overflow-hidden flex flex-col`, więc to **strona** musi być
własnym kontenerem przewijania. Moja strona miała root jako zwykły wyśrodkowany `<div>` (maxWidth +
margin auto), bez `overflow`, więc nadmiar treści był chowany bez scrolla.
**Rozwiązanie:** Root strony owinięty w `className="flex-1 overflow-y-auto"` (tak jak istniejące
`SystemHealthPage`/`AuditLogPage`), a wyśrodkowany `maxWidth`-owy kontener wrzucony do środka.
**Lekcja:** W tym projekcie `<main>` w `AppShell` jest `overflow-hidden` — KAŻDA strona treściowa musi
sama zapewnić scroll, dając swojemu korzeniowi `flex-1 overflow-y-auto`. Nie polegaj na scrollu body.
Wzoruj się na istniejących stronach admina, zamiast wymyślać własny layout korzenia.

## 2026-07-19 — Nie każdy model ma ownerId/ownerTeamId — resolver po nazwie może wysypać zapytanie
**Problem:** Dodając akcje AI dla grup projektów i grup notatek użyłem generycznego `resolveByName`
(zakłada `ownerId` + `ownerTeamId`). Ale `ProjectGroup` ma **tylko `ownerId`** (brak zespołu), a
`NoteGroup` jest **globalny** (`getNoteGroups` nie filtruje po właścicielu). Zapytanie `where` z
`ownerTeamId` na modelu bez tej kolumny wywala Prisma w runtime.
**Rozwiązanie:** Rezolwery dopasowane do modelu: dla `ProjectGroup` filtr `{ ownerId: userId, name }`
(bez `ownerOr`), dla `NoteGroup` filtr `{ name }` (globalny). Zawsze sprawdzaj model w `schema.prisma`
(pola własności) ZANIM użyjesz wspólnego `resolveByName`/`ownerOr`.
**Lekcja:** Wzorzec współwłasności `ownerId`/`ownerTeamId` NIE jest uniwersalny — część modeli jest
user-only, część globalna. Przed dołożeniem resolvera po nazwie zajrzyj do schematu; generyczny helper
zakładający zespół rozbije modele bez `ownerTeamId`.

## 2026-07-19 — Pokrycie AI musi obejmować też ODCZYTY (nie tylko mutacje)
**Problem:** Bramka pokrycia (poprzedni wpis) pilnowała tylko akcji ZAPISU. Ale asystent ma umieć
pokazać wszystko, co użytkownik PRZEGLĄDA — a wiele odczytów nie było wystawionych (np. `getWeather` =
prognoza, budżety/cele, kosz, tagi do wyliczenia, pełny przepis). Nowe możliwości pobierania danych też
mogłyby „przeciekać" bez integracji z AI.
**Rozwiązanie:** Rozszerzono `check-ai-coverage.js` i manifest `action-coverage.json` o ODCZYTY
(get*/list*/search* → `kind:"read"`), z tym samym reżimem `ai|pending|excluded` i tą samą bramką
build'u. Raport `docs/ai/pokrycie-akcji.md` rozdziela mutacje i odczyty. Dodano 10 read-tooli
(get_weather, list_budgets, list_goals, list_task_tags, list_note_tags, get_recipe, list_care_agenda,
list_maintenance, list_hot_topics, list_trash) i 6 mutacji (update/delete budżetu i celu, update/unlog
leku). Uwaga techniczna: read-tool NIE może wołać funkcji robiącej wewnętrzne wywołanie LLM
(`describeDay`) — to zagnieżdżony koszt/TPM w pętli agenta; `get_weather` zwraca surowe liczby
(Open-Meteo), a interpretację robi sam agent. Pułapka składniowa: sekwencja `*/` w komentarzu blokowym
JS (np. „list*/search*") przedwcześnie zamyka komentarz — pisz „list.../search...".
**Lekcja:** „AI umie wszystko co użytkownik" = ZAPIS **i** ODCZYT. Jedna bramka pokrycia z rozróżnieniem
rodzaju (mutation/read) trzyma oba wymiary mierzalne (liczniki) i wymusza triage każdej nowej akcji —
także nowego `get*/list*`.

## 2026-07-19 — Brak bramki pokrycia: akcje użytkownika nie były wystawiane dla AI
**Problem:** Asystent nie potrafił wielu rzeczy, które użytkownik robi ręcznie (np. otagować zadania —
`updateTaskTags`), bo możliwości AI utrzymywane są RĘCZNIE w 3 miejscach (katalog w prompt'cie,
egzekutory, whitelist fast-path), a jedyny guard (`check-action-coverage.js`) pilnował tylko spójności
katalog↔egzekutor. NIC nie pilnowało, czy KAŻDA mutująca Server Action jest w ogóle wystawiona dla AI,
więc nowe możliwości użytkownika „przeciekały" bez integracji z asystentem.
**Rozwiązanie:** Dodano bramkę pokrycia: `scripts/check-ai-coverage.js` + manifest
`src/lib/ai/action-coverage.json`, w którym KAŻDA mutująca Server Action (`src/actions/*`) musi mieć
status `ai` (wystawiona) / `pending` (luka do zrobienia) / `excluded` (świadomie nie dla AI, z powodem).
Build PADA, gdy ktoś doda nową mutującą akcję i jej nie sklasyfikuje — więc nowa możliwość użytkownika
nie prześlizgnie się bez decyzji o AI. Skrypt (flaga `--report`) generuje czytelną roadmapę luk w
`docs/ai/pokrycie-akcji.md`. Wpięto w `npm run build` obok pozostałych `check:*`. Domknięto pierwszą
partię luk (12 akcji: tagowanie zadań/notatek, podzadania, kontakty CRM, budżety/cele portfela,
jadłospis→zakupy, przenoszenie pozycji, odarchiwizacja/„zakończ zakupy"). Wzmocniono prompt agenta o
regułę ŁAŃCUCHA AKCJI (jedno polecenie → wiele kroków, także między modułami, referencja po nazwie do
elementów tworzonych w tym samym planie).
**Lekcja:** Gdy zdolności AI są utrzymywane osobno od „prawdy" (Server Actions), potrzebna jest BRAMKA
pokrycia, nie tylko dobre chęci. Wzorzec: enumeruj źródło prawdy (mutujące akcje), wymagaj świadomej
klasyfikacji każdej z nich w manifeście, wywalaj build na nieklasyfikowanej nowej akcji. Dzięki temu
„AI umie wszystko co użytkownik" staje się mierzalnym, egzekwowalnym stanem (licznik ai/pending), a nie
jednorazową obietnicą.

## 2026-07-19 — Limit 429 NIE był przejściowy: „pokaż zadania otagowane X" zapętlał agenta
**Problem:** Po pierwszym fixie (retry + łagodny komunikat) komenda „pokaż zadania otagowane raj"
**zawsze** kończyła się „Asystent przeciążony", nawet po ponawianiu — podczas gdy „jak się masz?"
i „dodaj zadanie" działały. To wykluczyło hipotezę „przejściowy limit". Prawdziwa przyczyna: read-tool
`list_tasks` **nie miał filtra po tagu ani nie zwracał tagów** — agent nie mógł spełnić prośby, więc
**zapętlał się** (do MAX_ITERATIONS=6 iteracji), a każda iteracja to pełne wywołanie modelu
`reasoning` (~4k promptu + rezerwacja `max_tokens` 2800). Kilka takich wywołań w jednej minucie
przekraczało limit Groq 12000 TPM — stąd „Used 8761 + Requested 10243" i STAŁA porażka tej konkretnej
komendy (a nie losowa). Do tego stała rezerwacja `max_tokens=2800` na KAŻDE wywołanie pętli (Groq wlicza
`max_tokens` do TPM) niepotrzebnie zbliżała do limitu przy zapytaniach wieloetapowych (query→answer = 2
wywołania).
**Rozwiązanie:** (1) `src/lib/ai/agentTools.ts` — `list_tasks` dostał argument `tag` (filtr
`tags: { some: { tag: { name: { contains, mode:"insensitive" } } } }`) i zwraca teraz pole `tags`
(nazwy etykiet); opis narzędzia w `READ_TOOLS_PROMPT` zaktualizowany, żeby agent wiedział, że dla
„zadania otagowane X" ma użyć `tag`. Dzięki temu komenda kończy się w 1–2 wywołaniach zamiast pętli.
(2) `src/app/api/llm/home/agent/route.ts` — rezerwacja tokenów odpowiedzi jest teraz mała domyślnie
(`AGENT_MAX_TOKENS=1200`), a duży zapas (`REPORT_MAX_TOKENS=2800`) włączamy TYLKO gdy tekst prośby
wygląda na raport (`/raport|podsumow|zestawieni|streść/i`) — mniejsza presja na TPM przy zwykłych
zapytaniach, bez regresji długich raportów.
**Lekcja:** Gdy 429/limit trafia **jedną konkretną** komendę za każdym razem (a inne działają), to NIE
jest przejściowy limit — to komenda, której agent nie umie spełnić i **pętli** się, spalając TPM.
Najpierw sprawdź, czy read-tool w ogóle POTRAFI odpowiedzieć na pytanie (tu: brak filtra po tagu), i czy
`max_tokens` nie jest rezerwowany hojnie na każde wywołanie (Groq liczy to do TPM). Retry/łagodny
komunikat to tylko siatka bezpieczeństwa — nie zastąpi usunięcia przyczyny pętli.

## 2026-07-19 — Asystent AI zwracał surowy błąd Groq 429 (limit TPM) zamiast odpowiedzi
**Problem:** Zapytanie do asystenta ("pokaż zadania otagowane raj") padało z surowym komunikatem dostawcy
`Rate limit reached for model llama-3.3-70b-versatile … tokens per minute (TPM): Limit 12000, Used 8761,
Requested 10243`. Limit TPM u Groq jest **przejściowy** (okno minuty zwalnia się po chwili), a mimo to
`chatComplete` oddawał surowy błąd użytkownikowi. Istniejący łańcuch fallbacku (Z-133) próbuje tylko
INNEGO modelu — przy jednym skonfigurowanym modelu 429 przechodził wprost do UI, a `AICommandSheet`
wyświetlał go 1:1.
**Rozwiązanie:** (1) W `src/lib/llm/chat.ts` dodano owijacz `fetchWithRetry` używany przez wszystkie 4
funkcje dostawcy (openAi/anthropic × complete/stream): przy błędzie przejściowym (429/5xx/sieć) odczekuje
i ponawia TEN SAM model — respektując nagłówek `Retry-After` (z capem `LLM_RETRY_CAP_MS=8000` na
pojedyncze oczekiwanie i twardym limitem `LLM_MAX_RETRIES=2`), a bez nagłówka używa backoffu
wykładniczego z jitterem. Retry jest ZAGNIEŻDŻONY w pojedynczym wywołaniu modelu, więc łańcuch fallbacku
działa bez zmian (najpierw retry, potem dopiero next model). (2) W `src/app/api/llm/home/agent/route.ts`
(`runAgentLoop` catch) status 429 mapujemy na łagodny polski komunikat zamiast surowego tekstu dostawcy —
jedno miejsce obsługuje tryb zwykły i strumieniowy (SSE), bo oba idą przez `runAgentLoop`; klient bez zmian.
**Lekcja:** Limity szybkości dostawcy LLM (429/TPM) to błąd PRZEJŚCIOWY — najpierw ponów z backoffem
(respektując `Retry-After`, z twardym capem i limitem prób), dopiero potem fallback/komunikat. Retry rób
na poziomie `fetch` (jedno miejsce dla wszystkich dostawców i trybów, też streaming — status sprawdzasz
zanim skonsumujesz body). Nigdy nie pokazuj użytkownikowi surowej treści błędu dostawcy — zawsze własny,
polski komunikat (C-41: brak ryzyka wycieku klucza/szczegółów). Ponawiaj TYLKO statusy przejściowe
(429/≥500), nie 4xx poza 429.

## 2026-07-19 — Dokumentacja myliła środowiska Render (który URL/tier to test, a który prod)
**Problem:** CLAUDE.md podawał `worldofmag.onrender.com` jednocześnie jako „Live URL" i „auto-deploy on `master`" oraz „free tier", podczas gdy sekcja git-workflow traktowała ten sam URL jako środowisko **testowe** (`develop`). Drugi serwis (`omnia-prod.onrender.com`) figurował tylko w allowed origins, bez wskazania, że to produkcja. Tier per-środowisko nie był nigdzie jasno rozpisany — trzeba go było wywnioskować z luźnej uwagi „Render prod nie usypia".
**Rozwiązanie:** Ujednolicono mapowanie w CLAUDE.md (tabela „Environments & tiers") i w runbooku: `develop` → test → `worldofmag.onrender.com` → **free** (usypia po 15 min); `master` → produkcja → `omnia-prod.onrender.com` → **płatny** (nie usypia). Poprawiono też roadmapę (migracja prod na płatny tier = zrobione).
**Lekcja:** Gdy są dwa serwisy Render pod jednym projektem, trzymaj **jedną tabelę** gałąź → URL → tier jako źródło prawdy i nie rozrzucaj tych faktów po „Live URL"/„allowed origins"/uwagach. „Free tier usypia, prod nie" to jedyny twardy sygnał różnicujący tier — zapisz go wprost, nie zostawiaj do wywnioskowania.

## 2026-07-18 — Offline: katalog list widać, ale nie da się wejść w listę (nawigacja SPA = RSC z sieci)
**Problem:** Po naprawie instalacji SW aplikacja wstawała offline i katalog `/shopping` był widoczny, ale
kliknięcie w konkretną listę nic nie dawało. Przyczyna: w App Routerze wejście w `/shopping/[id]` przez
`<Link>` to nawigacja **SPA**, która pobiera payload **RSC** z sieci — offline to pada. Do tego dokument
HTML tej listy zwykle **nie był w cache**, bo online wchodziło się w listę klikając (SPA pobiera tylko RSC,
nie cały dokument), więc nawet twarda nawigacja nie miała czego zserwować (fallback pokazywał znów katalog).
**Rozwiązanie:** (1) **warm-up** w `OfflineSyncManager` dodatkowo `fetch('/shopping/'+id)` dla każdej
aktywnej listy → SW buforuje **dokument HTML** każdej listy (zwykły fetch bez nagłówka RSC = pełny HTML);
(2) w katalogu (`ShoppingHomePage`) linki do list offline renderujemy jako **twardą nawigację `<a>`** zamiast
`<Link>` (helper `CardLink`), więc przeglądarka robi pełne przejście → SW serwuje zbuforowany dokument →
`ShoppingPage` wstaje i przełącznik czyta ze snapshotu; (3) `caches.match(..., { ignoreVary: true })` w
fallbacku SW, bo Next dodaje `Vary: RSC,…` i bez tego match po nawigacji mógłby nie trafić w dokument.
**Lekcja:** Offline w Next App Router **nawigacja SPA nie zadziała** (RSC leci po sieci). Żeby offline wejść
w dynamiczną trasę: (a) **zbuforuj jej dokument HTML** proaktywnie (`fetch(url)` przy okazji warm-upu — samo
odwiedzenie przez SPA online NIE cache'uje dokumentu), i (b) offline nawiguj **twardo** (`<a>`, nie `<Link>`),
żeby SW mógł ten dokument zserwować. Pamiętaj o `ignoreVary` przy match, bo Next varii po nagłówkach RSC.

## 2026-07-18 — Service worker w ogóle się nie instalował (martwe URL-e w `cache.addAll`)
**Problem:** Po dodaniu trybu offline Zakupów okazało się, że aplikacja i tak **nie wstawała offline**.
Przyczyna zastana: `public/sw.js` w `install` robił `cache.addAll(SHELL)`, a `SHELL` zawierał
**nieistniejące** ścieżki `/icons/icon-192.png` i `/icons/apple-touch-icon.png` (realne ikony są pod
`/pwa-icon/*` i `/apple-touch-icon/*`). `cache.addAll` jest **atomowy** — jeden 404 odrzuca całą obietnicę,
więc `event.waitUntil` w `install` padał, a wtedy **service worker w ogóle się nie aktywuje**. Efekt: nic
się nie cache'owało (nawet poprawny `/_next/static`), więc offline nie działało wcale.
**Rozwiązanie:** (1) `SHELL` zawężony do **istniejących** tras `["/", "/shopping"]`; (2) precache zrobiony
**odpornie** — `Promise.allSettled(SHELL.map((u) => cache.add(u)))` zamiast `addAll`, więc pojedynczy
błędny URL nigdy nie wywróci instalacji; (3) dodany fallback nawigacyjny (offline nawigacja bez trafienia
w cache → cached `/shopping`→`/`), by aplikacja zawsze wstała; (4) bump `CACHE` do `worldofmag-v4`.
**Lekcja:** `cache.addAll` to „wszystko albo nic" — **jeden martwy URL w precache = cały SW nie wstaje**.
Do precache używaj `Promise.allSettled` z `cache.add` per-URL i wpisuj tam **tylko** trasy, które na pewno
istnieją. Gdy „offline nie działa", najpierw sprawdź, czy SW w ogóle się **zainstalował/aktywował**
(DevTools → Application → Service Workers), a nie dopiero logikę fetch.

## 2026-07-18 — Zakupy offline: service worker nie cache'ował `/_next/`, a LWW psuł własne kolejne zmiany
**Problem:** Przy dodawaniu trybu offline do Zakupów (feature 009-shopping-offline-sync) wyszły dwie
nieoczywiste pułapki. (1) Istniejący `public/sw.js` w handlerze `fetch` **wychodził wcześnie dla
każdego `/_next/`** (`return;`), więc bez sieci nie ładowały się hashowane bundle JS/CSS — aplikacja
w ogóle **nie wstawała offline**, mimo że strona `/shopping` była w SHELL. (2) Reguła „ostatni zapis
wygrywa" liczona jako `item.updatedAt > op.ts` **gubiła kolejne własne zmiany offline** tej samej
pozycji: pierwszy zaaplikowany `op` podbijał `updatedAt` do `now()` serwera, więc następny `op`
(z wcześniejszym `ts` klienta) był błędnie uznawany za „serwer nowszy" i pomijany — np. sekwencja
NEEDED→IN_CART→DONE lądowała na IN_CART, a offline add→edit tracił edycję.
**Rozwiązanie:** (1) W `sw.js`: `/_next/static/*` (immutable, content-hashed) serwujemy **cache-first**
(i dopisujemy do cache przy pierwszym pobraniu), pozostałe `/_next/` → sieć; żądania RSC (`headers RSC=1`)
i `/api/` nadal pomijane; bump `CACHE` do `worldofmag-v3`. (2) LWW liczymy **tylko przy pierwszym
dotknięciu** danej pozycji w batchu synchronizacji: trzymamy `Map<itemId, "applied"|"conflict">` — nasze
kolejne operacje na tej samej pozycji wygrywają bez porównania z `updatedAt` (bo to my ją przed chwilą
zmieniliśmy), a konflikt z innym klientem wykrywamy tylko względem stanu serwera **sprzed** batcha.
**Lekcja:** Offline-first PWA nie zadziała, jeśli service worker nie cache'uje **statycznych bundli
`/_next/static`** — sam HTML strony to za mało. A przy „last-write-wins" po `updatedAt` pamiętaj, że
**własne, kolejno odtwarzane operacje same podbijają znacznik czasu** — konflikt licz względem stanu
sprzed synchronizacji (pierwsze dotknięcie), inaczej klient „konfliktuje sam ze sobą" i gubi ostatnią zmianę.

## 2026-07-17 — Asystent klasyfikował prośby o ODCZYT jako akcje tworzące (fast-path)
**Problem:** „Podaj mi zadanie, jakie mógłbym zrobić" kończyło się propozycją dodania (pustej) pozycji
do listy zakupów, zamiast przeszukania zadań i podania konkretnej propozycji. Winny był
`fastPath.classifyIntent`: tani klasyfikator (op:"dispatch") czasem błędnie mapował prośbę o
wyszukanie na prostą akcję create (`add_item`/`create_task`), a bywało, że z pustym payloadem
(„dodaj nic"). Dodatkowo fast-path dla `add_item` z założenia budował tylko `rawText` (bez `listName`)
— więc gdy user wskazał listę po nazwie, wskazanie ginęło.
**Rozwiązanie:** trzy deterministyczne strażniki w `fastPath.ts` (bez dodatkowego kosztu LLM):
(1) **strażnik intencji odczytu** — regex kotwiczony na początku wypowiedzi
(`podaj|pokaż|znajdź|ile|jakie|zaproponuj|…`) → od razu `complex` (pełny agent robi query+answer);
(2) **strażnik pustego payloadu** — prosta akcja bez kluczowej treści (`rawText`/`title`/`name`/
`amount`…) → `complex`; (3) **nazwana lista przy `add_item`** (`\blist[aąeęiy]\w*`) → `complex`, żeby
agent wypełnił `listName` (executor `resolveOrCreateList` już go priorytetyzuje). Do tego reguły w
`buildSystemPrompt` agenta: „QUERY-FIRST" (prośby o wyszukanie realizuj filtrowanym query, nigdy akcją
tworzącą; filtruj po stronie narzędzia, nie „mieli" całości) i „SZANUJ WSKAZANY KONTENER".
**Lekcja:** Fast-path (mały model dispatch) NIE jest wiarygodny przy rozróżnianiu „odczyt vs zmiana"
ani przy pustych payloadach — postaw przed nim **tanie, deterministyczne strażniki** (regex intencji +
walidacja payloadu). Nadmiarowe zepchnięcie do `complex` jest bezpieczne (pełny agent i tak poprawnie
obsłuży tworzenie) — koszt to tylko latencja, nie błędne działanie. Gdy szybka ścieżka gubi parametr
(np. `listName`), lepiej oddać ją agentowi niż „po cichu" wykonać niepełną akcję.

---

## 2026-07-16 — iOS Safari: rozpoznawanie mowy nie kończy tury po ciszy (mikrofon otwarty, brak odpowiedzi)
**Problem:** Po naprawie 007 na iPhone dalej: „mówię pierwszą rzecz, a nie przestaje nasłuchiwać i nie
odpowiada". Nasz `createSpeechListener` dostarczał transkrypt dopiero w `onend`, licząc, że
`continuous=false` sam zatrzyma rozpoznawanie po ciszy (jak na Chrome). Na iOS Safari `continuous=false`
**nie domyka niezawodnie** — mikrofon zostaje otwarty, `onend` nie odpala, a bywa też, że `isFinal`
nigdy nie jest ustawione (mamy tylko `interim`). Efekt: wskaźnik utyka na „Słucham…", nic nie leci do
agenta.
**Rozwiązanie:** własne wykrywanie końca tury **timerem ciszy** w `createSpeechListener`: każdy
`onresult` resetuje licznik `SILENCE_MS` (1500 ms); po pauzie sami domykamy turę — `stop()` (zwolnij
mikrofon) + `onFinal(finalText || lastInterim)`. Dodatkowo `NO_SPEECH_MS` (8000 ms) od startu, by nie
trzymać mikrofonu bez końca, gdy nic nie powiedziano. `onend` (Chrome) zostaje jako druga ścieżka —
`delivered`/`aborted` chroni przed podwójnym dostarczeniem. Kluczowe: dostarczamy **final ALBO ostatni
interim**, bo iOS często nie oznacza `isFinal`.
**Lekcja:** Na iOS Safari NIE polegaj na `onend`/`isFinal` do zamknięcia tury rozpoznawania — steruj
**własnym timerem ciszy** i dostarczaj najlepszy dostępny tekst (final || interim). `continuous=false`
na iOS ≠ „auto-stop po ciszy" jak na Chrome.

## 2026-07-16 — Rozmowa głosowa Asystenta milczała/zacinała się na iPhone (iOS Safari, Web Speech)
**Problem:** Tryb rozmowy głosowej (spec 005/006) działał na Chrome, ale na iPhone (Safari/WebKit —
silnik KAŻDEJ przeglądarki na iOS) Asystent **milczał** i pętla **zacinała się** po pierwszej turze,
choć przycisk się pokazywał. Błędnie zakładaliśmy, że hands-free jest wykonalny „tylko na Chrome".
Faktyczne przyczyny to wąskie ograniczenia iOS Safari, których nie obsługiwaliśmy: (a) `speechSynthesis.
speak()` wywołane **poza gestem** użytkownika jest przez WebKit **po cichu wyciszane** — nasza pierwsza
wypowiedź padała dopiero po asynchronicznej odpowiedzi agenta (bez gestu) → cisza; (b) tryb
`continuous` rozpoznawania jest na iOS zawodny, a **natychmiastowy** restart `recognition.start()` po
zakończeniu tury bywa blokowany/rzuca „already started"; (c) głosy syntezy ładują się asynchronicznie
(`voiceschanged`).
**Rozwiązanie:** (1) `primeSpeech()` w `@/lib/tts` — „odblokowanie" syntezy **w geście** włączenia
trybu (cicha wypowiedź `volume=0` + `getVoices()` + `resume()`); wołane z `toggleVoice` (handler
kliknięcia). (2) Rozgrzewka głosów przez `voiceschanged`. (3) `resume()` po każdym `speak()` (iOS/Safari
wpada w stan „paused"). (4) Restart nasłuchu przez `scheduleListen()` = `setTimeout(startListening,
250ms)` — bufor, którego iOS wymaga między turami; **pierwszy** start i barge-in zostają **synchroniczne
w geście** (zgoda na mikrofon na iOS). Wykrywanie wsparcia zostaje **po istnieniu API**, nie po nazwie
przeglądarki (żadnego UA-sniffingu).
**Lekcja:** Web Speech na iOS Safari **jest** dostępne, ale gestozależne: `speak()` trzeba odblokować w
geście (potem gra programowo), a `recognition.start()` — pierwszy w geście, kolejne z małym opóźnieniem
i świeżym egzemplarzem (`continuous=false`). Nie zakładaj „to działa tylko w Chrome" — to zwykle **brak
priming/handlingu iOS**, nie brak platformy. Weryfikacja mowy wymaga **realnego iPhone** (Web Speech nie
działa w headless CI).

## 2026-07-15 — Kolizja `declare global { Window }` dla SpeechRecognition (build TS)
**Problem:** Nowy helper `src/lib/speechRecognition.ts` (tryb rozmowy głosowej Asystenta) miał własny
blok `declare global { interface Window { SpeechRecognition?: ISpeechRecognitionCtor; … } }`. Taki
sam blok deklarują już `SmartTextarea.tsx` i `AITaskInput.tsx`. Dopóki wszystkie trzy `ISpeechRecognition`
były **strukturalnie identyczne**, TypeScript łączył je bez problemu. Mój interfejs dodał metodę
`abort()` → typ `ISpeechRecognitionCtor` przestał być strukturalnie równy tamtym, a globalne złączenie
pola `Window.SpeechRecognition` wysypało build: „Subsequent property declarations must have the same
type" (błąd raportowany w `AITaskInput.tsx`, choć źródłem był nowy plik).
**Rozwiązanie:** Nie augmentować globalnego `Window` w helperze. Konstruktor czytamy lokalnym rzutem:
`const w = window as unknown as { SpeechRecognition?: …; webkitSpeechRecognition?: … }` w funkcji
`getRecognitionCtor()`. Dzięki temu szerszy typ (z `abort()`) żyje lokalnie i nie zderza się z węższymi
deklaracjami w innych plikach.
**Lekcja:** `declare global { interface Window { … } }` **łączy się globalnie po wszystkich plikach**.
Gdy kilka modułów deklaruje to samo pole `window.*` z lokalnym interfejsem, każda **strukturalna**
różnica (dodana metoda/pole) łamie build w losowym z tych plików. Dla API przeglądarki nieobecnych w
`lib.dom` (np. `SpeechRecognition`) czytaj je **lokalnym rzutem `as unknown as {...}`**, nie globalną
augmentacją — zwłaszcza gdy istnieją już inne deklaracje tego samego pola.

## 2026-07-15 — Nagłówek Zadań ucinał akcje na iPhone (overflow-hidden rodzica)
**Problem:** W dziale Zadania na wąskim ekranie (iPhone) prawy pasek akcji nagłówka pakuje 8+ ikon
(kosz, grupowanie, sortowanie, szukaj, powiadomienia, statusy, przełącznik Lista/Kanban/Timeline,
admin „Kopiuj prompt dla Claude Code", akcje projektu). Nagłówek to jeden rząd o stałej wysokości
(`flex items-center justify-between h-12`) bez zawijania, a rodzic ma `overflow-hidden` — więc nadmiar
był **przycinany**, a trailing akcje (m.in. „Kopiuj prompt") wypadały poza kadr i były nieklikalne.
**Rozwiązanie:** Odizolować poziomy scroll do samego kontenera akcji: `min-w-0 overflow-x-auto
[&>*]:flex-shrink-0` na `<div className="flex items-center gap-2">`. `min-w-0` pozwala kontenerowi
ustąpić szerokości, `overflow-x-auto` daje przewijanie (cienki globalny scrollbar 6px), a
`[&>*]:flex-shrink-0` trzyma ikony i pogrupowane przełączniki w intrinsic rozmiarze (rząd się przewija,
nie ściska). Na desktopie klasa jest inertna (treść się mieści) → zero regresu. Wzorzec był już w tym
samym pliku: pasek „wiele projektów" używa `overflow-x-auto`.
**Lekcja:** Gdy pasek akcji o stałej wysokości siedzi w kontenerze z `overflow-hidden`, nadmiar znika
bez śladu (żadnego scrolla). Na mobile rządom akcji dawaj `min-w-0 overflow-x-auto` + `flex-shrink-0`
na dzieciach, zamiast liczyć, że wszystko się zmieści.

## 2026-07-15 — Weryfikacja builda: świeży klon + globalna Prisma 7 kontra schema Prisma 5
**Problem:** Przy lokalnej weryfikacji (`prisma migrate deploy`) leciał błąd P1012: „datasource property
`url`/`directUrl` is no longer supported" — bo `npx prisma` sięgnął po **globalnie** zainstalowaną
Prisma **7.8.0**, a repo pinuje Prisma **5.22** (schema używa składni `url = env(...)` z datasource,
usuniętej w 7). Dodatkowo świeży klon **nie miał `node_modules`** (`npm install` nie był uruchomiony w
sesji), więc lokalnego `node_modules/.bin/prisma` też nie było.
**Rozwiązanie:** Najpierw `npm install`, potem wywoływać **lokalny** binarny Prisma z projektu:
`node_modules/.bin/prisma migrate deploy` / `generate` (v5.22, akceptuje `url` w datasource). Zmienne
`DATABASE_URL`/`DIRECT_URL` **wyeksportować do shella** (migrate/skrypty nie czytają `.env.local`).
Build weryfikować do kroku `node_modules/.bin/next build` (nie pełny `npm run build`, bo ten na końcu
odpala `migrate.js` — patrz C-13).
**Lekcja:** W sandboxie/świeżym klonie nie ufaj `npx prisma` — może trafić na globalną, nowszą wersję
niezgodną ze schematem. Zawsze `npm install` + `node_modules/.bin/prisma`. Postgres lokalny:
`pg_ctlcluster 16 main start`, rola+baza `omnia/omnia_dev`, eksport env do shella.

---

## 2026-07-15 — Filtry działały tylko w jednym z trzech układów tego samego zbioru zadań
**Problem:** W dziale Zadania pasek filtrów (zakładki statusów + tagi) działał wyłącznie w widoku
Lista. W Kanbanie i na Timeline zaznaczenie tagu nic nie robiło, a przełączanie zakładek „nic nie
zmieniało”. Przyczyna: `TasksPage` filtrował status+tagi **wewnątrz** `TaskList`, a do `KanbanBoard`
i `TimelineView` wpuszczał surowe `displayedTasks` (tylko wynik wyszukiwania). Kontrolki były
widoczne, ale martwe.
**Rozwiązanie:** Filtrowanie przeniesione **przed** rozgałęzienie na układy — w `TasksPage`
policzone `kanbanTasks` (filtr tagów; wszystkie kolumny statusów, także terminalne, by kolumna
„Zrobione” się wypełniała — dlatego bez zawężania po zakładce) i `timelineTasks` (zakładka statusu +
tagi), przekazane do widoków. W Kanbanie zakładki statusu ukryte nowym propem `TaskFilters
showStatusTabs=false` (kolumny i tak reprezentują statusy). `KanbanBoard`/`TimelineView` bez zmian.
**Lekcja:** Gdy ten sam zbiór ma kilka układów (lista/kanban/timeline), filtruj **u źródła** (w
kontenerze, przed wyborem widoku), a nie w jednym z widoków — inaczej pozostałe dostają niefiltrowane
dane i kontrolki filtrów kłamią. Uważaj na semantykę „ALL”: lista wyklucza statusy terminalne, ale
Kanban ich potrzebuje (kolumny), więc nie da się bezmyślnie współdzielić jednego zbioru.

---

## 2026-07-14 — Spec-driven pipeline: gdzie żyją komendy/agenty i jak podać przewodnik do panelu admina
**Problem:** Zadanie: zbudować spec-driven pipeline (`/specify /plan /tasks /implement /verify /review`)
dla Claude Code + przewodnik w panelu admina. Dwie pułapki: (1) `/verify` i `/review` **kolidują
nazwami** z wbudowanymi skillami harnessu; (2) deployowany (standalone) serwer Next **nie czyta
dowolnych plików repo** w runtime, a przewodnik-źródło leży w `.claude/spec-pipeline/` w **katalogu
głównym repo**, o poziom wyżej niż `worldofmag/` — więc nie da się go po prostu `fs.readFileSync` ze
strony.
**Rozwiązanie:** Komendy jako `.claude/commands/*.md`, agenty jako `.claude/agents/*.md`, twarde
reguły w `.claude/spec-pipeline/constitution.md` (numerowane `C-NN`, wyciągnięte z `CLAUDE.md`),
artefakty w `specs/<NNN-slug>/`. Kolizję nazw świadomie akceptujemy — w tym repo `/verify` i `/review`
mają być etapami pipeline'u Omnii (komendy projektowe współistnieją z wbudowanymi). Przewodnik do
panelu admina podany **tym samym wzorcem co `/admin/docs`**: skrypt `scripts/copy-spec-pipeline.js`
czyta `../.claude/spec-pipeline/{README,constitution}.md` (ścieżka **`..`** bo build leci z
`worldofmag/`) i piecze do `src/generated/spec-pipeline.ts` (wpięte w `build`, commitowane by `dev`
działał na świeżym klonie); strona `/admin/spec-pipeline` **reużywa `AdminDocsViewer`** (ten sam
kształt `AdminDoc[]`).
**Lekcja:** Cokolwiek w panelu admina ma pokazać plik z repo — nie czytaj FS w runtime, tylko upiecz
go generatorem do `src/generated/*.ts` w kroku `build` (jak `copy-docs`/`copy-audyt`) i reużyj
istniejącego viewera. Pamiętaj o `..` w ścieżce generatora (build startuje w `worldofmag/`, a `.claude`
jest o poziom wyżej). Nowy generator MUSI trafić do `build` w `package.json`, inaczej prod pokaże
starą treść.

## 2026-07-14 — `jsx-a11y/alt-text` fałszywie flaguje ikonę `Image` z lucide-react (nie tylko `<img>`)
**Problem:** Reguła `jsx-a11y/alt-text` zgłaszała „Image elements must have an alt prop" na `<Image size={12} />`, gdzie `Image` to **ikona z `lucide-react`**, a nie element `<img>` ani `next/image`. Reguła patrzy na *nazwę* elementu JSX (`Image`), więc każdy komponent nazwany `Image` dostaje ostrzeżenie — mimo że alt nie ma tu sensu. Osobno: te same pliki miały prawdziwe `<img>` w `ImageResponse` (generatory ikon PWA/OG) bez `alt`.
**Rozwiązanie:** Dla ikony lucide — **alias importu** `import { Image as ImageIcon } from "lucide-react"` + zamiana użyć na `<ImageIcon />` (usuwa fałszywe trafienie u źródła, bez `eslint-disable`). Dla realnych `<img>` w `ImageResponse` — dodać `alt=""` (dekoracyjne). Przy okazji: warningi `react/no-unescaped-entities` (proste `"` zamykające polski cudzysłów) naprawione **chirurgicznie po dokładnym `line:col` z lintera** (codemod podmieniający pojedynczy znak → typograficzny „ / "), a NIE globalnym replace `"`→`"` (globalny trafiłby też w atrybuty JSX i by je zepsuł). Single-char→single-char = kolumny kolejnych trafień w tej samej linii pozostają stabilne.
**Lekcja:** Zanim „naprawisz" a11y-warning, sprawdź czy element to naprawdę `<img>` — reguła jedzie po nazwie, więc komponent/ikona o nazwie `Image` daje fałszywy alarm (alias importu to czysta naprawa). Masowe naprawy tekstu w JSX rób po `line:col` z lintera, nie regexem globalnym — inaczej ruszysz cudzysłowy w atrybutach. (Dodatkowo, znany artefakt środowiska: długi `next build` potrafi ubić lokalny Postgres → testy DB nagle „Can't reach database server"; `pg_ctlcluster 16 main start` i ponów — to nie regres kodu.)

## 2026-07-14 — Limit uczciwości kolejki musi być SPRAWDZANY PO dedupe (inaczej idempotentny re-submit pada na limicie)
**Problem:** Dokładając limit aktywnych zadań na użytkownika (`maxActivePerOwner`, ochrona kolejki przed zapchaniem przez jednego usera przy 100+ userach) pierwsza wersja sprawdzała limit na samym początku `enqueue`, PRZED lookupem po `dedupeKey`. Skutek: gdy user jest przy limicie, a klient ponawia to samo zadanie z tym samym `dedupeKey` (np. re-submit/retry pollingu), enqueue rzucało `QuotaError` zamiast zwrócić istniejące, już zakolejkowane zadanie — czyli legalny idempotentny call był blokowany. Test „dedupe pomija limit" to złapał (owner miał już 2 aktywne, `maxActivePerOwner:1` → rzut mimo trafienia w klucz).
**Rozwiązanie:** Kolejność w `enqueue`: **najpierw** dedupe (jeśli istnieje AKTYWNE zadanie z tym kluczem → zwróć je i wyjdź), **dopiero potem** limit. Trafienie w dedupeKey to „to samo zadanie", więc z definicji nie powiększa kolejki i nie może podlegać limitowi. Limit rzuca typowany `QuotaError` mapowany na HTTP 429 w trasie `/api/jobs`; klient (`runJob`) już propaguje `error` z odpowiedzi, więc UI dostaje czytelny komunikat. Zweryfikowane testem integracyjnym (limit=2 → trzeci rzuca; świeży owner + dedupe przy limicie=1 → zwraca to samo zadanie).
**Lekcja:** Przy dokładaniu bramek (rate-limit / quota / fairness) do ścieżki, która ma też idempotencję, **zawsze najpierw rozstrzygnij idempotencję, potem bramkę**. Bramka liczy „nowe" zadania; dedup-hit nie jest nowym zadaniem. Odwrotna kolejność cicho psuje retry/polling dokładnie w momencie, gdy limit jest najbardziej aktywny (user pod obciążeniem). Test „bramka nie blokuje dedupe" jest tani i wart napisania od razu.

## 2026-07-02 — `instrumentation.ts` jest bundlowany też dla EDGE → import łańcucha z `node:crypto` wywala build (a tsc/testy tego NIE łapią)
**Problem:** Wpiąłem start workera kolejki w `instrumentation.ts` (`await import("@/lib/jobs/worker")` po guardzie `NEXT_RUNTIME==="nodejs"`). `tsc --noEmit` i testy przeszły, ale **deploy na Render padł** na `next build`: „Module not found: Can't resolve 'crypto'" z import-trace `instrumentation.ts → worker → handlers → chat → resolver/secrets/cache`. Powód: Next kompiluje `instrumentation.ts` także dla runtime **EDGE**, a webpack **śledzi nawet dynamiczne importy** przy bundlowaniu (guard `NEXT_RUNTIME` blokuje WYKONANIE, nie BUNDLOWANIE). `secrets.ts`/`cache.ts` używają node-owego `crypto`, którego w edge nie ma → błąd kompilacji. Wcześniejszy import w instrumentation (`observability/report`) nie ciągnął crypto, więc problem pojawił się dopiero po dołożeniu łańcucha LLM.
**Rozwiązanie:** NIE startować workera z `instrumentation.ts`. Start przeniesiony do tras API (`/api/jobs` POST i `/api/jobs/[id]` GET — runtime **Node**) przez idempotentny `startJobWorker()`: pierwszy enqueue/polling odpala workera, `setInterval` żyje dalej w procesie serwera (Render prod nie usypia). Trasy API mogą bez problemu ciągnąć crypto (są Node). Zweryfikowane realnym `./node_modules/.bin/next build` (exit 0) — nie samym `tsc`.
**Lekcja:** Zmiany w `instrumentation.ts`, `middleware.ts` i wszystkim, co może trafić do bundla EDGE, **MUSISZ** weryfikować pełnym `next build`, bo `tsc`/testy nie robią webpackowego bundlowania per-runtime i przepuszczą „Can't resolve 'crypto'/'fs'/…". Guard `NEXT_RUNTIME==="nodejs"` chroni wykonanie, ale nie wycina modułu z edge-bundla — Node-only zależności (crypto/fs/net) trzymaj z DALA od instrumentation; startuj je leniwie z tras/akcji (runtime Node). Wzorzec „lazy start on first API hit" (idempotentny singleton) jest odporniejszy niż instrumentation dla rzeczy ciągnących natywne moduły.

## 2026-07-02 — Kolejka Job: `SKIP LOCKED`, migracja z `migrate diff` chce usunąć „dryfujące" indeksy, i pułapka testów z globalnym `claimNext`
**Problem:** Budując kolejkę zadań w tle (T-17/Z-131) natrafiłem na trzy rzeczy. (1) Generując migrację tabeli `Job` przez `prisma migrate diff --from-url $DB --to-schema-datamodel` dostałem w wyniku NIE tylko `CREATE TABLE "Job"`, ale też `DROP INDEX "Note_*_trgm_idx"` — bo indeksy trigramowe (Z-240) to świadomy dryf spoza `schema.prisma`, więc diff „chce je posprzątać". Ślepe wklejenie migracji skasowałoby FTS notatek. (2) Testy współbieżności kolejki (`Promise.all([claimNext(), claimNext()])`) przechodziły uruchamiane SAME, ale padały w zestawie — bo `node --test` odpala pliki RÓWNOLEGLE, a `claimNext` jest GLOBALNY (bierze dowolne QUEUED), więc test z jednego pliku „podkradał" zadania enqueue'owane przez drugi plik. (3) `UPDATE ... WHERE id=(SELECT ... FOR UPDATE SKIP LOCKED LIMIT 1) RETURNING *` to właściwy sposób na atomowe, wieloworkerowe pobranie jednego zadania bez podwójnego wzięcia.
**Rozwiązanie:** (1) Z wyniku `migrate diff` wziąłem TYLKO fragment `CREATE TABLE`/`CREATE INDEX` dla `Job`, świadomie POMIJAJĄC `DROP INDEX` trigramów (z komentarzem w migracji, że to celowe — dryf zaakceptowany). Zweryfikowane: po `migrate deploy` i tabela `Job`, i oba indeksy `*_trgm_idx` istnieją. (2) Scaliłem wszystkie testy kolejki/workera w JEDEN plik (w obrębie pliku `node:test` idzie sekwencyjnie, `concurrency:false`), więc równoległe pliki nie kolidują; żaden inny plik nie enqueue'uje jobów. (3) Claim przez `$queryRawUnsafe` z `SKIP LOCKED`; `attempts++` przy przejęciu (crash-loop nie ponawia w nieskończoność), odzysk „osieroconych" RUNNING po `visibility timeout`.
**Lekcja:** Po `prisma migrate diff` ZAWSZE przejrzyj wynik — przy świadomym dryfie (surowe indeksy/rozszerzenia spoza schematu) diff będzie chciał je DROP-nąć; bierz tylko interesujący Cię fragment. Testy komponentu z GLOBALNYM stanem współdzielonym (kolejka, `claimNext` bez filtra) trzymaj w jednym pliku (sekwencyjnie), bo `node --test` równolegli pliki — inaczej „kradną" sobie rekordy. Wieloworkerowa kolejka na Postgresie = `FOR UPDATE SKIP LOCKED` + inkrement prób przy claimie + visibility-timeout na odzysk po crashu; to skaluje się do N instancji bez zmian (można wynieść workera do osobnej usługi bez ruszania logiki).

## 2026-07-02 — FTS notatek: trigram (pg_trgm) zamiast tsvector — bo tsvector wymusza duplikację logiki dostępu w surowym SQL
**Problem:** Z-240 chciało indeksowanego wyszukiwania notatek zamiast skanującego `ILIKE`. Kuszące było „prawdziwe" FTS (tsvector+GIN+ranking), ale `getNotes` ma nietrywialny `where`: własność (`OR ownerId / ownerTeamId in getAccessibleTeamIds`), filtry grupy/tagów/pinned. tsvector wymagałby zapytania przez `$queryRaw` (Prisma nie filtruje po wygenerowanej kolumnie tsvector), a więc **przepisania logiki DOSTĘPU na surowy SQL** — a to security-sensitive (łatwo o rozjazd z regułą Prisma → wyciek/utrata widoczności). Do tego zmiana z substring (ILIKE) na token/word-match zmienia zachowanie (user wpisujący „mle" nie znajdzie „mleko").
**Rozwiązanie:** Wariant **trigramowy**: `CREATE EXTENSION pg_trgm` + indeksy GIN `gin_trgm_ops` na `title`/`content` (migracja `0201`). `gin_trgm_ops` przyspiesza `col ILIKE '%q%'` (także z wiodącym wildcardem), więc **ZERO zmian zapytania** — filtr zostaje w Prisma z całą logiką dostępu, wyniki identyczne, tylko szybciej przy skali. Ranking trafności zrobiony **app-level** czystą funkcją `noteSearchScore`/`rankNotesBySearch` (tytuł ~3×, całe pole/prefiks/początek słowa > środek, liczba trafień) wpiętą w `getNotes` tylko przy `search`. Weryfikacja użycia indeksu: `SET enable_seqscan=off; EXPLAIN … ILIKE '%q%'` → `Bitmap Index Scan on Note_title_trgm_idx` (na małej tabeli planer sam wybrałby seq scan — dlatego w teście wymuszamy `enable_seqscan=off`).
**Lekcja:** Gdy trzeba „zaindeksować szukanie", a getter ma złożoną autoryzację w `where` — **pg_trgm (ILIKE-accelerated) bije tsvector**, bo nie zmusza do przepisania zapytania (a więc i reguł dostępu) na surowy SQL. tsvector rezerwuj na przypadki, gdzie naprawdę potrzebujesz stemmingu/rankingu po stronie DB i możesz bezpiecznie odtworzyć scoping. Ranking trafności zrób app-level (czysta, testowalna funkcja) zamiast `ts_rank` w rawie. Test „czy indeks działa" pisz z `enable_seqscan=off` (mała tabela = planer i tak seq-scanuje). ŚWIADOMY DRYF: extension + indeksy wyrażeniowe nie mieszczą się w `schema.prisma` → udokumentuj w migracji i NIE odpalaj `migrate dev` na prodzie.

## 2026-07-02 — Zmiana „Terminu" zadania przepadała: `datetime-local` + doklejone `"T12:00:00"` = Invalid Date
**Problem:** W szczególe zadania modyfikacja terminu nic nie robiła. Pole „Termin" to `type="datetime-local"` (wartość np. `"2026-07-02T14:30"`), a handler robił `new Date(v + "T12:00:00")` → `new Date("2026-07-02T14:30T12:00:00")` = **Invalid Date** → `updateTask({dueDate: InvalidDate})` cicho nie zapisywał. Doklejanie południa jest poprawne TYLKO dla pola `type="date"` (samo `"YYYY-MM-DD"`). Dodatkowo wyświetlanie używało `new Date(x).toISOString().slice(0,16)` = **UTC**, więc pole pokazywało złą godzinę (dla usera w UTC+2 przesuniętą), a przy każdej zmianie i tak sklejało niepoprawny string.
**Rozwiązanie:** Wydzielony `src/lib/dateInput.ts`: `toDateTimeLocalValue`/`toDateValue` (format w strefie LOKALNEJ przez `getFullYear/getMonth/...`, NIE `toISOString`) + `parseDateInput(v, {dayOnly?})` (`new Date(v)` dla datetime-local — parsuje jako czas lokalny; `+"T12:00:00"` tylko dla dayOnly). Handlery w `TaskDetail`: termin = `parseDateInput(v)`, start = `parseDateInput(v,{dayOnly:true})`. 7 testów: round-trip instant→pole→instant zachowuje instant, `datetime-local` nie daje Invalid Date, puste→null.
**Lekcja:** `toISOString()` NIE służy do zasilania pól `datetime-local`/`date` — daje UTC (zły czas w polu) i kusi do sklejania. Formatuj/parsuj lokalnie. Kluczowa różnica: `new Date("YYYY-MM-DDTHH:mm")` (bez strefy) parsuje jako **lokalny**, a `new Date("YYYY-MM-DD")` jako **UTC-północ** — dlatego pole „date" (dzień) doklejaj do lokalnego południa, a pole „datetime-local" parsuj wprost. Zawsze zrób round-trip test (wyświetl→zapisz→wyświetl), bo cichy `Invalid Date` nie rzuca wyjątku, tylko „nic się nie dzieje".

## 2026-07-02 — Import przepisu z URL: generyczny 422 maskował „LLM nieskonfigurowany"
**Problem:** Import przepisu (`/api/llm/kitchen/import-url`) zwracał zawsze `422 „Nie udało się rozpoznać przepisu"`, nawet gdy realną przyczyną był brak skonfigurowanego modelu LLM (na środowisku testowym `develop` bez `groq_api_key`). `extractWithLLM` robił `if (!result.ok) return null`, a `chatComplete` na braku konfiguracji zwraca `{ok:false, status:503, message:"LLM nie jest skonfigurowany…"}` — ten sygnał ginął, mapując się na to samo 422 co „strona nie jest przepisem". User nie miał jak się domyślić, że wystarczy ustawić model w Admin → LLM (dokładnie ten sam anty-wzorzec, co dawne „brak nowych" w Wiadomościach).
**Rozwiązanie:** `extractWithLLM` zwraca teraz `{recipe, llmError?:{status,message}}` zamiast gołego `null`; trasa rozróżnia: `llmError.status===503` → „Import z AI niedostępny (model nieskonfigurowany/chwilowy błąd) — ustaw w Admin → LLM", `429` → „wyczerpano budżet AI", inaczej → generyczny 422 „brak danych przepisu w treści" (bo wtedy LLM ODPOWIEDZIAŁ, tylko strona nie jest przepisem — np. Cloudflare/JS-shell z serwerowego fetcha Rendera).
**Lekcja:** Funkcja, od której zależy „czy w ogóle coś się stanie", nie może cicho zwracać `null` na każdej ścieżce — rozróżniaj „usługa niedostępna/niekonfigurowana" (5xx/429 → powiedz userowi CO zrobić) od „brak wyniku" (poprawne, ale pusto). Propaguj `status/message` z warstwy LLM aż do odpowiedzi HTTP. Uwaga na środowiska: `develop`/`master` mają OSOBNĄ konfigurację w `Config` (klucze per-env) — funkcja działająca lokalnie potrafi zwracać 422/503 na deployu tylko dlatego, że tam nie ustawiono `groq_api_key`.

## 2026-06-28 — Egzekwowanie dostępu w ~20 getterach bez ryzyka: konwencja `user.id` (read) vs `userId` (write)
**Problem:** Domknięcie granularnych ról domownika (T-12/Z-194) wymagało wpięcia `getAccessibleTeamIds(userId, moduleId)` w gettery-odczyty kilkunastu modułów team-aware ZAMIAST `getUserTeamIds(userId)`. Naiwny `replace_all getUserTeamIds` zepsułby też gardy zapisów (`assertXAccess`) — wtedy ograniczenie widoczności zmieniłoby też prawo do edycji (inny zakres niż chciany), a do tego część plików miała ten wzorzec rozsiany po 6–20 miejscach (ryzyko ślepej, masowej edycji = dokładnie „large refactor", przed którym ostrzega pętla).
**Rozwiązanie:** Odkryta KONWENCJA repo: gettery-odczyty wołają `getUserTeamIds(user.id)` (z `.id`, bo mają obiekt `user` z `requireAuth`), a prywatne gardy `assertXAccess(id, userId)` wołają `getUserTeamIds(userId)` (parametr). Więc precyzyjny `s/getUserTeamIds\(user\.id\)/getAccessibleTeamIds(user.id, "MODUŁ")/g` per plik trafia WYŁĄCZNIE w odczyty, zostawiając gardy-zapisy nietknięte. Tam gdzie był wspólny helper czytający scope (`ownershipFilter`/`scopeWhere` w flota/portfel/medications) — jeden swap w helperze. Zmiana w 100% wstecznie zgodna (default `moduleAccess=null` → `getAccessibleTeamIds`==`getUserTeamIds`), więc nawet ślepo jest BEZPIECZNA: nowe zachowanie aktywuje się dopiero, gdy rodzic ograniczy dziecko. Po swapie sprawdź, czy `getUserTeamIds` nadal używane (gardy) — jeśli plik miał TYLKO `user.id` (np. `lists.ts`, `portfelReports.ts`), usuń je z importu (strict tsc wywali nieużywany). Test DB na samym prymitywie `getAccessibleTeamIds` (a nie 11 getterach) pokrywa całą warstwę. `tasks` (model projectMembers/entity, NIE `ownerTeamId`+`getUserTeamIds`) i `contacts` (user-only) świadomie poza zakresem.
**Lekcja:** Przed masowym swapem rozdziel ŚCIEŻKI po sygnaturze wywołania (`user.id` vs `userId`) — to często naturalna granica read/write w tym repo i pozwala bezpiecznie `sed`-ować tylko jedną klasę. Feature gated kolumną z bezpiecznym defaultem (null=stare zachowanie) jest „bezpieczny nawet ślepo" — to odblokowuje zrobienie szerokiego egzekwowania bez deployowej weryfikacji. Testuj prymityw (jedna funkcja, której używają wszystkie gettery), nie każdy getter z osobna. I zawsze po zdjęciu ostatniego użycia symbolu — sprzątnij import (strict).

## 2026-06-28 — Usunięcie konta właściciela zespołu: rozwiąż własność PRZED `user.delete()` (FK RESTRICT)
**Problem:** `deleteMyAccount` twardo blokował usunięcie konta, jeśli user był właścicielem jakiegokolwiek zespołu („najpierw przekaż własność"). Decyzja właściciela (T-04/Z-051): zamiast blokady — auto-transfer własności na następcę, a zespół „solo" usuwać. Pułapka: `Team.ownerId` ma FK `onDelete: Restrict`, więc próba `user.delete()` gdy user jest właścicielem ZESPOŁU rzuci błędem FK. Trzeba rozwiązać własność każdego zespołu PRZED skasowaniem usera, w tej samej transakcji.
**Rozwiązanie:** W `purgeUserData` (transakcja) jako PIERWSZY krok `resolveOwnedTeams(tx, userId)`: dla każdego `team.ownerId===userId` — jeśli są inni członkowie, wybierz następcę czystą funkcją `pickTeamSuccessor` (najstarszy stażem ADMIN → fallback najstarszy członek), ustaw mu rolę OWNER i `team.ownerId=następca` (membership odchodzącego i tak kaskaduje przy `user.delete`); jeśli solo — `tx.team.delete()`, co przez `ownerTeam onDelete:Cascade` sprząta WSZYSTKIE zasoby team-owned (listy/notatki/przepisy/…) i członkostwa. Reguła wyboru wydzielona do `src/lib/teams/ownership.ts` (6 testów jednostkowych) + 2 testy DB-gated (transfer zachowuje zasoby i preferuje ADMIN-a nad starszym MEMBER-em; solo kasuje kaskadowo). Zdjęta blokada w `deleteMyAccount`; UI nie wymagało zmian (nie pre-sprawdzało własności).
**Lekcja:** Zanim skasujesz encję z przychodzącym FK `RESTRICT` (tu `Team.ownerId`→User), MUSISZ wcześniej w tej samej transakcji albo przepiąć ten FK (transfer), albo usunąć rekord-rodzica. Sprawdź kierunki `onDelete` zależnych relacji: `ownerTeam` (zasoby) = Cascade → usunięcie zespołu solo czyści zasoby „za darmo"; gdyby był SetNull, zasoby by osierociały i trzeba by je kasować jawnie. Logikę wyboru (następca) trzymaj jako czystą funkcję (testowalną bez DB), a integrację z FK pokryj 1-2 testami DB-gated na realnych kaskadach.

## 2026-06-28 — ESLint jako bramka: osierocone `eslint-disable @typescript-eslint/*` = 9 fałszywych errorów
**Problem:** Włączając ESLint jako bramkę (T-02; w repo NIE było ani configu, ani `eslint`/`eslint-config-next` w zależnościach) `next lint` dał 9 **errorów** „Definition for rule '@typescript-eslint/no-explicit-any' was not found". To NIE realne błędy — w kodzie były komentarze `// eslint-disable-next-line @typescript-eslint/no-explicit-any` (z poprzednich sesji), ale reguła nie była zarejestrowana, więc ESLint traktuje odwołanie do nieznanej reguły jako error. Blokowałyby bramkę mimo zera realnych problemów.
**Rozwiązanie:** W `.eslintrc.json` (extends `next/core-web-vitals`) dołożyć `"plugins": ["@typescript-eslint"]` — sama rejestracja pluginu (jest jako tranzytywna zależność `eslint-config-next`) sprawia, że reguły `@typescript-eslint/*` „istnieją" (domyślnie off), więc dyrektywy disable stają się poprawnymi no-opami. Kosmetykę (`no-unescaped-entities`, `exhaustive-deps`, `no-img-element`, `alt-text`) zdegradować do `warn`, `rules-of-hooks` zostawić `error`. Bramka jawna: krok `next lint --dir src` w `build` + `eslint.ignoreDuringBuilds:true` w `next.config` (żeby `next build` nie lintował drugi raz). Stan: 0 errorów, 64 warningi → zielona; realny błąd (np. hook warunkowy) ją wywala (zweryfikowane sondą wstrzykniętą i usuniętą).
**Lekcja:** „Definition for rule not found" to nie bug w kodzie, tylko brak rejestracji pluginu, którego dotyczą istniejące dyrektywy `eslint-disable`. Włączając ESLint w projekcie z historią takich komentarzy — najpierw zarejestruj `@typescript-eslint` (plugin), inaczej dostaniesz errory z niczego. Bramka = jedno miejsce: jawny `next lint` + `ignoreDuringBuilds:true`, kosmetyka jako `warn` (nie przepisuj 64 pozycji), realne klasy (`rules-of-hooks`) jako `error`. `next lint` z samymi warningami zwraca 0 (nie wywala buildu).

## 2026-06-28 — DnD listy `@dnd-kit/sortable`: przeciągaj za UCHWYT + optymistyczna kolejność jako lista ID
**Problem:** Dodając ręczną kolejność DnD pozycji zakupów (T-03/Z-221) trzeba było pogodzić trzy rzeczy: (1) wiersz jest mocno interaktywny (klik=fokus, dblclick=edycja, toggle statusu, menu „przenieś") — gdyby cały wiersz był `draggable`, dotyk/klik na treści wszczynałby drag; (2) po zapisie kolejności serwer rewaliduje propsy, więc naiwny `useState(items)` migałby (stara kolejność z propsów na chwilę wraca); (3) zmiana statusu/treści pozycji musi nadal docierać do widoku mimo lokalnej, optymistycznej kolejności.
**Rozwiązanie:** (1) `useSortable` z `setActivatorNodeRef` na osobnym UCHWYCIE (`GripVertical`, widoczny na hover/focus, `touch-none`, `onClick stopPropagation`) — przeciąga TYLKO uchwyt, reszta wiersza działa normalnie; `disabled: isEditing`. (2)+(3) Optymistyczny stan to **lista ID** (`orderIds`), a render bierze świeże OBIEKTY z propsów przez `Map(id→item)` — kolejność lokalna, treść z serwera. `useEffect` resyncuje `orderIds` TYLKO przy zmianie składu (add/del: zachowaj istniejące, dopnij nowe na koniec), nie przy każdej zmianie propsów → brak migotania, bo po rewalidacji serwer zwraca tę samą kolejność. Sensory Pointer(distance 6)/Touch(delay 200, tolerance 8 — long-press na mobile, by scroll działał)/Keyboard (a11y). Zapis: `arrayMove` + akcja `reorderItems(listId, category, ids)` ustawiająca `order=index` w transakcji; sort listy `[order ASC, priority DESC, createdAt ASC]` (default 0 = wstecznie zgodne).
**Lekcja:** Sortowalna lista z interaktywnymi wierszami: przeciągaj za dedykowany uchwyt (`setActivatorNodeRef`), nie za cały wiersz. Optymistyczny porządek trzymaj jako listę ID + lookup obiektów z propsów (rozdziel „kolejność" od „treści"), a resync rób tylko przy zmianie SKŁADU, nie przy każdej rewalidacji — inaczej miga. Na mobile `TouchSensor` z `delay` (long-press), żeby zwykły scroll palcem nie chwytał elementów. Kolumnę sortującą daj z bezpiecznym defaultem (0 = stary sort), żeby feature był w 100% wstecznie zgodny dopóki user nic nie przeciągnie.

## 2026-06-28 — Świeży klon: `npm install` pada na pobraniu silników Prisma przez proxy (ECONNRESET)
**Problem:** Na świeżym kontenerze (brak `node_modules`) `npm install` wywalał się `ECONNRESET` — ale NIE na rejestrze npm. Same paczki JS pobierają się OK (`registry.npmjs.org` jest na liście `noProxy` agent-proxy → bezpośrednio). Padał `postinstall` `@prisma/engines` (`scripts/postinstall.js`), który ściąga binarne silniki z `binaries.prisma.sh` — host NIE jest w `noProxy`, więc leci przez MITM-proxy, a Node-owy downloader dostaje reset (`curl` ten sam URL ciągnie bez problemu — 200). Efekt: cały `npm install` robił rollback, `node_modules` zostawało puste → nie dało się odpalić nawet `tsc`.
**Rozwiązanie:** (1) `npm install --ignore-scripts` — pobiera WSZYSTKIE paczki JS (rejestr działa), pomija postinstall (w tym pobieranie silników). (2) Silniki Prisma ściągnąć ręcznie `curl` i podłożyć: `curl -o libquery_engine.so.node.gz "https://binaries.prisma.sh/all_commits/<HASH>/debian-openssl-3.0.x/libquery_engine.so.node.gz"` (HASH = z DEBUG `prisma:fetch-engine:download`), `gunzip`, `mv` na `libquery_engine-debian-openssl-3.0.x.so.node`; analogicznie `schema-engine.gz` (chmod +x). Pliki trzeba podłożyć w DWÓCH miejscach: `node_modules/@prisma/engines/` ORAZ `node_modules/prisma/` (CLI ma osobną kopię — `prisma generate` sprawdza własną ścieżkę). (3) `NODE_EXTRA_CA_CERTS=/root/.ccr/ca-bundle.crt` + `npm config set cafile` dla zaufania CA proxy. Gdy silniki są na dysku, `prisma generate`/`migrate deploy` NIE pobierają nic → przechodzą.
**Lekcja:** Rozróżniaj WARSTWY `npm install`: pobranie z rejestru (npm, `noProxy` → działa) vs postinstall ściągające binaria spoza rejestru (Prisma/Playwright/esbuild — przez proxy, bywa ucinane). Gdy `ECONNRESET` w `npm install` — sprawdź w debug-logu, NA CZYM padł (`error path … node_modules/@prisma/engines`), bo to nie rejestr. Obejście: `--ignore-scripts` + ręczne `curl` binariów (host odpowiada na curl) podłożone w obu ścieżkach (`@prisma/engines` i `prisma`). To samo dotyczy każdego pakietu z natywnym download-postinstall.

## 2026-06-28 — Wirtualizacja listy w obrębie scrolla strony: `scrollMargin` + `scrollToIndex` zamiast `scrollIntoView`
**Problem:** Owijając najdłuższą płaską listę (Kontakty) w `@tanstack/react-virtual` (T-11/Z-071) trafiłem na dwie pułapki specyficzne dla tego repo: (1) cała strona to JEDEN kontener przewijania (`pageContainerStyle` = `flex:1; overflowY:auto`), a nad listą siedzą nagłówek + wyszukiwarka w tym samym scrollu — naiwny wirtualizer pozycjonowałby wiersze od góry scrolla, ignorując tę treść; (2) istniejąca nawigacja j/k robiła `rowRefs.get(id).scrollIntoView()` — po wirtualizacji wiersze poza oknem NIE istnieją w DOM, więc ref jest pusty i klawisz „nie dowscrollowuje".
**Rozwiązanie:** (1) `scrollMargin` = offset wrappera listy względem kontenera przewijania, liczony w `useLayoutEffect` (`list.getBoundingClientRect().top - sc.getBoundingClientRect().top + sc.scrollTop`) i przeliczany, gdy nad listą zmienia się treść (dep `adding`/`contacts.length`) + listener `resize`; wiersz pozycjonowany `translateY(vi.start - virtualizer.options.scrollMargin)`. (2) Nawigacja klawiaturą woła `virtualizer.scrollToIndex(idx, {align:"auto"})` zamiast `scrollIntoView`. (3) Wiersze różnej wysokości (tagi/notatki + tryb edycji zamienia wiersz na wyższy formularz) → dynamiczny pomiar `ref={virtualizer.measureElement}` + `data-index`, `estimateSize` tylko jako punkt startowy. Odstęp między wierszami wliczony w pomiar przez `paddingBottom` mierzonego wrappera (nie `gap` flexa, którego absolutne pozycjonowanie nie respektuje).
**Lekcja:** Wirtualizacja działa świetnie dla list „load-all + filtr po stronie klienta" (renderujesz okno, nie cały DOM) — to one są celem, nie listy keyset-paginowane. W tym repo, gdzie `<main>` deleguje scroll do strony, wirtualizer MUSI dostać `scrollMargin` (treść nad listą) i `getScrollElement` = kontener strony, a każda istniejąca nawigacja oparta o `scrollIntoView`/ref przechodzi na `scrollToIndex` (wiersze poza oknem nie są w DOM). Dynamiczne wysokości → `measureElement`+`data-index`, odstępy w `paddingBottom` mierzonego elementu.

## 2026-06-27 — Zalecenia audytu bywają JUŻ spełnione architekturą — weryfikuj przed implementacją
**Problem:** Realizując tracker po kolei trafiłem na Z-134 („tańszy model dla `dispatch`") i Z-135 („monitoring kosztów AI") jako rzekomo „do zrobienia". W rzeczywistości OBA były już spełnione istniejącą architekturą: Z-134 przez warstwę operationType (`lib/llm/resolver.ts` mapuje `dispatch`→`llama-3.1-8b-instant`, `reasoning`→70B; wszystkie trasy dispatch wołają `op:"dispatch"`), Z-135 przez `getUnitEconomics` (`actions/metrics.ts` — koszt AI/MAU z `AiUsage`). Wcześniej analogicznie Z-073/Z-176/Z-031/Z-220 (agent Explore podawał je błędnie jako niezrobione).
**Rozwiązanie:** Przed implementacją KAŻDEGO zalecenia — grep realnego kodu pod mechanizm (np. `grep '"dispatch"'`, `getUnitEconomics`), nie ufać ani trackerowi (bywa nieaktualny), ani świeżemu agentowi (nie krzyżuje z kodem). Jeśli spełnione → oznaczyć ✅ z notą „już spełnione przez X", zero nowego kodu.
**Lekcja:** Tracker/agent to wskazówki, nie wyrocznia. Pętla per-zalecenie zaczyna się od „udowodnij, że NIE jest zrobione" (grep kodu), dopiero potem implementacja. Bonus (diagnostyka EXPLAIN, Z-037): `EXPLAIN (FORMAT JSON)` BEZ `ANALYZE` waliduje plan + nazwy tabel/kolumn bez WYKONANIA zapytania → dummy id wystarcza do sanity-checku SQL nawet na pustej bazie (i jest bezpieczne na prod).

## 2026-06-27 — slugify: polskie „ł" nie rozkłada się w NFD
**Problem:** `slugify` wykonawcy usług (`lib/services/helpers.ts`) robił `normalize("NFD")` + strip combining marks, ale `ł/Ł` (U+0142/0141) to OSOBNE litery, nie „l + znak diakrytyczny" — NFD ich NIE rozkłada. Efekt: po `[^a-z0-9]→-` „Łódź" → „odz", „Wałbrzych" → „wa-brzych" (ł zjadane jako separator). Cicho psuło polskie slugi w publicznych URL-ach `/providers/[slug]`.
**Rozwiązanie:** Po `toLowerCase()` dołożyć jawny `.replace(/ł/g, "l")` PRZED filtrem `[^a-z0-9]`. Testy `serviceHelpers.test` lockują „Łódź"→„lodz" oraz rozkładalne (ą/ę/ó/ś/ż/ź/ć/ń)→bazowe litery. Zero wpływu na istniejące slugi (są zapisane; slugify biegnie tylko przy tworzeniu/zmianie nazwy).
**Lekcja:** NFD rozkłada TYLKO znaki z kanonicznym rozkładem (ó=o+́, ą=a+̨…), ale NIE ł/Ł, đ, ø, ß. Dla polskich/europejskich slugów dołóż jawne mapowanie tych liter przed strip-em diakrytyków. Funkcje normalizacji tekstu testuj na pełnym polskim alfabecie, nie tylko ASCII.

## 2026-06-27 — Jawna polityka onDelete (Z-033/036): naprawa „cichych sierot" własności
**Problem:** Audyt zgłaszał „~108 FK bez jawnego `onDelete`" i sugerował dużą migrację 108 kluczy. W praktyce: (1) liczba NIEAKTUALNA — poprzednie sesje RODO (Z-264/301/370) już dodały polityki, zostało 13 FK bez polityki + 16 błędnych; (2) realny BUG to `onDelete: SetNull` na RELACJACH WŁASNOŚCI (`owner`/`ownerTeam`) 10 modeli (Notes/Recipes/Cookbooks/MealPlans/LanguageDecks/HealthEvents/MedicationSchedules/Habits + ShoppingList/TaskProject bez polityki) — usunięcie konta zostawiało rekord-sierotę (ownerId=NULL, niewidoczny, niezgodny z RODO), gdy ~20 innych modeli własności miało już Cascade. Pułapka grepa: `@relation(fields:` NIE łapie relacji NAZWANYCH (`@relation("OwnedNotes", fields:...)`) → fałszywe „tylko 1 FK bez polityki". Poprawny wzorzec: `fields: \[`.
**Rozwiązanie:** Zawężenie do tego, co audyt naprawdę chciał („relacje własności i powiązania z User — resztę zostawić"): 20 FK własności SetNull/brak → **Cascade**; 9 relacji aktora/zespołu → JAWNE onDelete = DOTYCHCZASOWA domyślność (optional→SetNull, required→Restrict) → pokrycie **200/200 FK przy ZERO zmian w DB** (potwierdzone: `migrate diff --from-schema-datamodel before --to-schema-datamodel after --script` dało DOKŁADNIE 40 ALTER = 20×(drop+add), tylko własność). Bezpieczna edycja 29 linii: skrypt Node z regexem PER unikalna nazwa relacji + asercja „dokładnie 1 trafienie" (nie sed na ślepo). Migracja ręczna `0196` (numer z `npm run next:migration`). Weryfikacja BEZ deployu na lokalnym Postgresie: `migrate deploy` + `pg_constraint.confdeltype='c'` + **test kaskady asercją PO ID rekordu** (NIE po ownerId — SetNull też zwolniłby ownerId i dałby fałszywy PASS; tylko sprawdzenie, że RZĄD zniknął, wykrywa regresję sieroctwa). Drift-check: flaga to `--from-url $DB` (nie `--from-database`).
**Lekcja:** Liczby z audytu bywają nieaktualne — najpierw POLICZ realny stan (`grep 'fields: \[' | grep -v onDelete`), nie ufaj „108". Najmniejszy poprawny zakres bije ślepą masową migrację: zmieniaj tylko własność (→Cascade), relacje aktora rób JAWNE = dotychczasowa domyślność (0 ALTER, pokrycie 100%). Testy kaskady FK ZAWSZE asercją po ID rekordu, nie po kolumnie FK. SQL migracji bez DB: `migrate diff` schema↔schema. Pre-existing drift wykryty przy okazji (`Workshop*.updatedAt` DB-default z migr. 0095 bez deklaracji w schemacie — tylko 2 z 10 tabel-z-defaultem driftują; runtime OK bo `@updatedAt` ustawiane app-level) — udokumentowany, nie „naprawiany" bez pewności kierunku.

## 2026-06-24 — Masowa migracja N plików: podagenci edit-only + commit centralny; burst kontra limit
**Problem:** Z-114 = ~22 modale „ad-hoc" do migracji na wspólny `ui/Modal`. Robienie bezpośrednio wykończyłoby kontekst głównej pętli (każdy duży plik „wisi" do końca rozmowy i jest przeliczany w każdej turze); pojedynczo = wolno. Próba „4 agentów naraz" trafiła w limit Anthropic w połowie — jeden urwał się na rozjechanym JSX (niedomknięty `<Modal>`), dwa zostawiły sam dodany import.
**Rozwiązanie:** Wzorzec orkiestracji do masowej, mechanicznej roboty: podagenci z ROZŁĄCZNYMI paczkami plików, **edit-only** (zakaz `git`/`npm`/`typecheck`/commit — współdzielone drzewo!), każdy najpierw czyta JEDEN już-zmigrowany przykład z repo (wzorzec 1:1). Orchestrator po powrocie WSZYSTKICH: `typecheck` całości + grep (`<Modal` jest / `fixed inset-0` zniknął) + JEDEN commit. Recovery po urwaniu na limicie: `git checkout` plików rozjechanych/ledwo-tkniętych, commit tylko ukończonych (kompilujących). Na końcu **sweep `fixed inset-0`** potwierdza, że reszta trafień to NIE-modale.
**Lekcja:** Do migracji N-plików: podagenci edit-only + weryfikacja/commit CENTRALNIE (nie pozwól agentom robić git na wspólnym drzewie — wyścigi). Limit Anthropic to OKNO zużycia WSPÓLNE dla agentów i głównej pętli — nie odpalaj zbyt wielu naraz (burst go przebije). Agenci NIE oszczędzają tokenów (mają narzut: własny system-prompt + raport), oszczędzają KONTEKST głównej pętli — używaj ich, gdy wąskim gardłem jest Twój kontekst, nie surowe tokeny. Modal-migracja: tylko prawdziwe dialogi (nakładka+panel ze `stopPropagation`); POMIJAJ dropdowny/skanery/nav-overlay/palety/immersyjne/pełnoekranowe przejęcia. Mapowanie: nagłówek→`title`, przyciski→`footer` (dwustronne w `justify-between` `width:100%`), treść→`children` (usuń wrapper `px-* py-* flex gap-*` — Modal daje padding+gap; kilka rodzeństwa → `<>`).

## 2026-06-24 — Audyt c.d.: weryfikuj założenia agenta przy realnym kodzie; pułapki ICU i DB-testów
**Problem:** Przy „dobijaniu" autonomicznych zaleceń audytu (po skanie agentem Explore) część typowań agenta nie trzymała się kodu: (a) Z-251 „testy parsera składników" — `parseIngredients` to wywołanie LLM (`llm.kitchen`), nie czysta funkcja; (b) Z-382 „N+1 w kalendarzu" — `lib/calendar.ts` to tylko `isoDay`/`monthRange`, agregacja już zoptymalizowana; (c) Z-264 „PetSale RODO" — to NIE luka (model ma FK `onDelete:Cascade` do User i Pet), w odróżnieniu od Contact/ServiceFavorite (bez FK, naprawione w Z-370). Dodatkowo test `formatMoney` (pl-PL) pękał: separator tysięcy bywa OBECNY (pełne ICU „1 234,50") albo NIE (małe ICU „1234,50").
**Rozwiązanie:** Każde zalecenie weryfikuj GREP/Read w realnym `src/` ZANIM dotkniesz — nazwy plików w audycie/od agenta bywają zgadnięte (np. agent typował `src/actions/wallet.ts`, jest `portfel.ts`). Wynik Z-400: soft-delete/Kosz (`TrashModule` w `lib/trash.ts`) pokrywa TYLKO `notes`+`tasks` — reszta kasuje twardo; rozszerzenie = większy follow-up (restore per-moduł + decyzja, które encje odzyskiwalne). Z-264 zamknięte testem regresji kaskady. Testy `Intl.NumberFormat`: usuwaj CAŁĄ białą spację (`/\s/g`→"") i NIE asercuj separatora tysięcy (zależy od buildu ICU); sprawdź realny output przez `node -e` zamiast zgadywać.
**Lekcja:** „Audyt mówi X" ≠ „w kodzie jest X" — weryfikuj przy źródle. Testy liczb/dat/walut: asercje odporne na ICU (strip whitespace, regex zamiast równości, daty względne z dniem ≤28 by uniknąć brzegu miesiąca/29 lutego). Testy DB-gated lokalnie: `pg_ctlcluster 16 main start` + rola/baza `omnia/omnia_dev` (superuser dla prostoty) + `migrate deploy` LOKALNYM binarnym prisma 5 (NIE `npx prisma` — ściąga prisma 7!) → `DATABASE_URL=… npm run test:unit` odpala też DB-gated (256→272 z DB).

## 2026-06-24 — Z-232 finał: trzecia klasa list (NAWIGACYJNE) — hub `onEnter` + guard; Magazyn partial
**Problem:** Listy CZYSTO nawigacyjne (kafelek=`<Link>` do detalu: Zwierzęta/Flota/Portfel/Warsztaty/Języki) były pomijane w Z-232 — hub miał tylko toggle/edit/delete, brak akcji „otwórz". Magazyn: wiersz otwiera arkusz edycji (akcje nie in-place), lista grupowana w wielu sekcjach (lowStock/expiring/per-magazyn).
**Rozwiązanie:** Rozszerzono kontrakt huba o **`onEnter`** (Enter=„otwórz"). KLUCZOWY guard w hooku: nie odpalaj `onEnter`, gdy `document.activeElement` to realna kontrolka (`button`/`a`/`select`/`[role=button]`) — inaczej Enter na zogniskowanym przycisku/linku hijackowałby natywną aktywację (podwójne zadziałanie). Listy nawigacyjne: `focused` (−1) w rodzicu, `onNavigateUp/Down`, `onEnter`→`router.push(detal)`, `onQuickAdd`→otwórz formularz; karta `<Link>` dostaje ring sterowany `focused` (`borderColor`/`background`) + `onMouseEnter=setFocused` (ZAMIAST inline hover-swap — inaczej mysz i klawiatura walczą o styl). Magazyn (wiele sekcji): spłaszcz główną listę do `orderedItems` + `Map(id→index)`, by policzyć GLOBALNY indeks fokusu w renderze grupowanym (indeks lokalny sekcji by się mylił); `Enter`/`e`=otwórz arkusz, `a`=dodaj, `/`=szukaj (ref na input); ring przez `outline` (przycisk bez bordera → brak skoku layoutu).
**Lekcja:** Hub ma teraz TRZY klasy list: (1) prosta lista akcji (toggle/edit/delete), (2) strona wielolistowa (wybierz główną encję), (3) NAWIGACYJNA (`onEnter`→push). Dla nawigacyjnej: `onEnter` + guard na kontrolki + ring z `focused`/`onMouseEnter`. Dla list z wieloma sekcjami licz globalny indeks przez `Map(id→index)` na spłaszczonej liście, nie indeks lokalny sekcji. Częściowy keyset jest OK, gdy akcje są w arkuszu/detalu — daj to, co pasuje (j/k+Enter+a+/), nie udawaj toggle/delete. Po wznowieniu sesji Edit wymaga realnego Read pliku (sam Grep nie wystarcza — „File has not been read yet").

## 2026-06-24 — Rollout Z-232 c.d.: akcje w karcie → wynieś do rodzica; strony wielolistowe; dialog-guard
**Problem:** Druga fala Z-232 (Zdrowie, Leki, Przepisy) odsłoniła trzy pułapki, których nie było w prostych listach (Kontakty/Nawyki/Dostawcy): (1) w `HealthHomePage`/`MedicationsPage` akcje (cykl statusu, usuń, aktywny/wstrzymany) były ZAMKNIĘTE w komponencie karty — `EventCard`/`ScheduleCard` miały własny `useRouter` + `remove`/`cycleStatus`/`toggleActive` — więc hub wołany z rodzica nie miał jak ich odpalić na zogniskowanym wierszu. (2) Strony mają PO KILKA list (Zdrowie: nadchodzące + minione; Leki: dawki „na dziś" + harmonogramy) — jeden `focused`/`onToggleStatus` nie obsłuży wszystkich naraz. (3) `RecipeList` miał własny `keydown` tylko na `/`+`n` z blokadą przy otwartych dialogach importu — a hub blokuje tylko pisanie w `input`/`textarea`, NIE Twoje dialogi.
**Rozwiązanie:** (1) Wynieś akcje karty do rodzica jako handlery `(entity) => …` i przekaż propami (`onCycleStatus`/`onDelete`/`onToggleActive`); karta staje się prezentacyjna + `onMouseEnter={onFocus}` + ring `borderColor: focused ? "var(--border-focus)" : "var(--border)"`. Model `focused` (number, −1) i `ordered[focused]` trzymaj w rodzicu — focus i akcje MUSZĄ być w jednym miejscu. (2) Lista jednorodna (Zdrowie: ten sam typ encji w 2 sekcjach) → spłaszcz do jednego `ordered=[...upcoming,...past]` i licz indeks globalnie (`upcoming.length + j` dla minionych). Listy RÓŻNOTYPOWE (Leki: `DoseSlot` vs `MedicationSchedule`) → zawęź `j/k` do listy GŁÓWNYCH encji (harmonogramy: `x`=aktywny, `e`, `d`), a szybką listę (odhaczanie dawek) zostaw pod myszą/dotykiem. (3) Przy migracji inline→hub odtwórz appowe guardy W handlerach: `onQuickAdd: () => { if (!dialogOpen) … }`. Usuń osierocony `useEffect` z importu, bo `tsc` (strict) wywali nieużywany symbol.
**Lekcja:** Wpięcie huba to nie tylko `useKeyboardShortcuts({…})` — NAJPIERW sprawdź, gdzie żyją akcje. Jeśli w karcie, wynieś je do rodzica (focus + akcje w jednym miejscu, karta prezentacyjna). Strona z wieloma listami wymaga decyzji „która lista słucha klawiszy": jednorodne spłaszcz i indeksuj globalnie, różnotypowe — wybierz główną encję, reszta pod myszą. Hub gwarantuje TYLKO guard pisania; każdy inny stan blokujący (dialog/sheet) replikuj w handlerach. Weryfikacja bez proda: `npm run typecheck` (czyste `tsc --noEmit`), NIE `npm run build` (jego `migrate.js` rusza Neon). Magazyn (`StorageList`) świadomie POMINIĘTY: wiersz otwiera arkusz edycji (usuń/zmiana są w arkuszu, nie in-place) + sekcje lowStock/expiring/grouped — to nie „czysty cel", nie forsowano (zgodnie z wcześniejszą lekcją).

## 2026-06-24 — Rollout skrótów: szukaj „shadow hubów" (własny listener duplikujący useKeyboardShortcuts)
**Problem:** Przy rolloutcie keyboard-nav (Z-232) Nawyki (`HabitsPage`) wyglądały na „bez skrótów", ale miały WŁASNY `window.addEventListener("keydown")` z j/k/n/a/space/x/e i stanem `focused` — czyli reimplementację huba, nie jego brak. Naiwny rollout dołożyłby drugi listener (konflikt globalny) zamiast zastąpić istniejący.
**Rozwiązanie:** Przed wpięciem huba do modułu: `grep -rl 'addEventListener("keydown"' src/components`. Nawyki zmigrowane na `useKeyboardShortcuts` (usunięty inline listener), przy okazji dochodzi `d`=usuń (wersja inline go nie miała). Reszta trafień to legit handlery komponentowe (Esc w modalu, paleta, StudySession, edytory, mapa sklepu) — nie ruszać.
**Lekcja:** „Moduł bez skrótów" to często moduł z własnym, zdryfowanym listenerem. Rollout współdzielonego huba zaczynaj od grepa po inline `keydown`: trafienia w listach to cele MIGRACJI (zastąp, nie dokładaj), a inline-handlery modali/edytorów są słusznie osobne. Migracja przy okazji wyrównuje braki w skrótach (tu: brakujące `d`=usuń). Uwaga też na listy CZYSTO nawigacyjne (np. talie Języków = `<Link>` do detalu) — hub (toggle/edit/delete) tam nie pasuje, bo brak akcji „otwórz/Enter"; nie forsuj.

## 2026-06-24 — Rollout keyset (Z-071): czyste cele są rzadkie — nie wpychaj go na siłę
**Problem:** Helper keyset (`lib/pagination.ts`, Z-070) jest gotowy, ale „rollout na kolejne listy" (Z-071) ma mało czystych celów. Przegląd kandydatów: ruch magazynowy (`StorageMovement`) — embed z `take: 20` (już ograniczony); powiadomienia — sort `readAt asc nulls first, createdAt desc` (nie czysto-chronologiczny, kursor `id` nie pozycjonuje); feed aktywności na Home — bounded widget (`.slice(0,10)`, over-fetch 30 pod filtr uprawnień po stronie klienta); `NewsItem` per topic — bez `take`, ALE karmi agregację „bieżący stan wiedzy = max(version)" liczoną ze WSZYSTKICH itemów (paginacja by ją rozjechała). Listy modułów (tasks/notes) ładują całość i filtrują/sortują po stronie klienta — keyset się z tym gryzie.
**Rozwiązanie:** Nie forsowałem keysetu tam, gdzie nie pasuje. Czysty cel (audit log) już go ma; pozostałe listy są albo bounded, albo mają sort nie-monotoniczny, albo karmią agregację po całości, albo są client-filtered.
**Lekcja:** Keyset (kursorowy) pasuje TYLKO do czysto-chronologicznej, append-only listy z deterministycznym `orderBy [pole desc, id desc]`, której konsument NIE musi widzieć całości naraz. Zanim wpniesz keyset, sprawdź 4 dyskwalifikatory: (1) lista już ograniczona `take`/`slice` (bounded widget — nie trzeba), (2) sort nie-monotoniczny po kluczu kursora (np. unread-first), (3) konsument agreguje po WSZYSTKICH wierszach, (4) filtrowanie/sortowanie po stronie klienta (load-all). Trafienie któregokolwiek = keyset to zła odpowiedź; nie dokładaj „Load older" do widgetu dla samej zasady.

## 2026-06-24 — useKeyboardShortcuts: kontrakt „wszystkie handlery wymagane" blokował rollout (Z-232)
**Problem:** `useKeyboardShortcuts(handlers)` wymagał KOMPLETU 10 handlerów (`ShortcutHandlers` bez opcjonalności), więc każdy nowy moduł musiał stubować nawet bezsensowne dla siebie akcje (`onToggleStatus: () => {}`, `onCommandPalette: () => {}` — tak robią Notes/Shopping/Tasks). To czyniło rollout keyboard-first (Z-232, tylko 3/~20 modułów) drogim. Dodatkowo hook robił `e.preventDefault()` przed każdym handlerem bezwarunkowo — stub `onCommandPalette: () => {}` POŁYKAŁ Ctrl+K (preventDefault + no-op), więc moduł bez własnej palety blokował globalną.
**Rozwiązanie:** `ShortcutHandlers` → wszystkie pola opcjonalne; hook woła handler i blokuje klawisz TYLKO gdy handler jest podany (`if (handlers.onX) { preventDefault(); onX() }`). Ctrl+K zawsze `return` (by nie wpaść w `case "k"` = nawigacja w górę), ale `preventDefault` tylko gdy jest `onCommandPalette`. Istniejące 3 callery przekazują komplet → zero zmian zachowania (potwierdza tsc). Rollout na Kontakty wpina tylko sensowne akcje (j/k/e/d/a/f/Esc), pomijając toggle/filterTab/palette.
**Lekcja:** Hook-kontrakt „wszystkie callbacki wymagane" to anty-wzorzec dla rzeczy adoptowanej przyrostowo — zrób pola opcjonalne i **blokuj domyślną akcję klawisza dopiero, gdy faktycznie go obsługujesz** (inaczej globalny listener typu Ctrl+K połknie pusty stub). Kolejność: najpierw enabler (opcjonalny kontrakt, zachowanie istniejących callerów 1:1, weryfikacja tsc), potem rollout modułu — interakcję (czy `j/k` faktycznie przesuwa zaznaczenie) i tak trzeba domknąć e2e.

## 2026-06-17 — Rozbicie pliku Server Actions ("use server") — barrel NIE może mieć "use server"
**Problem:** Rozbijając `actions/services.ts` (1400 linii, 48 Server Actions, `"use server"`) chciałem zostawić `actions/services.ts` jako barrel re-eksportujący akcje z plików per-obszar, by nie ruszać 16 importerów. Próba `export { x } from "./services/disputes"` w pliku z `"use server"` → **build fail**: „Only async functions are allowed to be exported in a 'use server' file". Plik `"use server"` może eksportować WYŁĄCZNIE async-funkcje (akcje) — żadnych re-eksportów, stałych, typów-wartości.
**Rozwiązanie:** Wzorzec docelowy: każdy obszar to osobny plik `"use server"` z samymi akcjami (np. `actions/services/disputes.ts`), a `actions/services.ts` staje się **zwykłym barrelem BEZ `"use server"`**: `export * from "./services/<obszar>"`. Nie-akcyjny barrel MOŻE re-eksportować Server Actions (tożsamość akcji bierze się z modułu definiującego, nie z barrela), więc publiczny import `@/actions/services` działa bez zmian u konsumentów. Plumbing (mappery, resolvery, stałe) i typy MUSZĄ wyjść do zwykłych modułów (`@/lib/services/helpers`, `@/lib/services`), bo nie wolno ich trzymać w plikach `"use server"`. Efekt: services.ts 1400→20 linii (barrel), 11 plików akcji per-obszar.
**Lekcja:** Plik `"use server"` = tylko async-akcje. Aby rozbić taki plik zachowując publiczną ścieżkę importu: (1) wynieś typy/helpery do zwykłych modułów, (2) zrób pliki per-obszar `"use server"`, (3) zamień oryginał na **nie-`"use server"` barrel** `export *`. Migruj przyrostowo (każdy obszar to osobny plik `"use server"` + ewentualnie redirect jego importerów), a barrel wprowadź na końcu, gdy oryginał nie ma już własnych akcji. Brak e2e dla modułu = weryfikacja tylko build+tsc (build łapie naruszenia „use server").

## 2026-06-17 — Bezpieczny rozbiór monolitu (1467 linii) przy zachowaniu guardu spójności
**Problem:** `execute/route.ts` (egzekutor akcji AI) urósł do 1467 linii — jeden `executeAction` z łańcuchem `if (type === "...")` dla ~20 modułów, a `check-action-coverage.js` skanował TYLKO ten plik szukając `type === "..."`. Naiwne przeniesienie handlera do osobnego pliku wywaliłoby build (guard zgłosiłby „akcja bez obsługi"), a bloki tego samego modułu były rozproszone po 2-3 miejscach (grupa „bazowa" + „DODATKOWE AKCJE CRUD" po wspólnym `teamOr`).
**Rozwiązanie:** Najpierw **enabler**: guard skanuje teraz też `src/lib/ai/executors/*.ts` (podąża za przeniesionym kodem). Potem rozbiór w 8 małych, osobno commitowanych slice'ach: (1) wspólna infra → `shared.ts` (typy `ActionResult`/`ExecOutcome`, resolvery), (2-8) po 1-3 domeny → `XExecutor.ts`. Dla domen rozproszonych: executor scala WSZYSTKIE grupy, dispatch w pierwszym miejscu robi `return`, pozostałe (nieosiągalne) grupy kasujemy; każdy executor liczy własny `ownerOr` przez `ownerOrArr`. Po każdym slice: `tsc` + `check:actions` + `build` + porównanie baseline testów. Efekt: 1467→148 linii (−90%), 15 executorów, `executeAction` = czysty dispatcher.
**Lekcja:** Rozbijając monolit pilnowany przez statyczny guard, **najpierw naucz guard podążać za kodem** (skanuj katalog docelowy), dopiero potem przenoś — inaczej każdy krok wywala build. Przenoś **małymi, osobno commitowanymi slice'ami z pełną weryfikacją po każdym** (guard łapie pominiętą akcję, tsc typy, build całość). Czyste przeniesienie = zachowuj logikę 1:1 (nawet nieużywane `const`); refaktor kosmetyczny rób osobno.

## 2026-06-17 — Liczba testów jednostkowych „spadła" po refaktorze — to był artefakt środowiska, nie regresja
**Problem:** Po wyodrębnieniu wspólnej infrastruktury egzekutora AI (`executors/shared.ts`) `npm run test:unit` pokazał `191 tests / 184 pass / 7 skipped`, podczas gdy wcześniej w sesji widziałem `221 / 221 / 0`. Wyglądało na regresję (zniknęło 30 testów + 7 skipów).
**Rozwiązanie:** `git stash` + uruchomienie testów na ZACOMMITOWANYM stanie sprzed refaktoru dało identyczne `191/184/7` — czyli mój refaktor nic nie zepsuł. Wcześniejsze „221" wzięło się stąd, że `test:unit` był odpalany **w tym samym poleceniu shella zaraz po `next build`** (i po seedzie/migracji dev-Postgresa przez e2e). Część testów jest data-driven po wierszach z bazy, więc stan dev-DB zmienia liczbę zarejestrowanych subtestów; 7 testów to środowiskowe skipy (DB/sieć).
**Lekcja:** Regresję testową weryfikuj porównaniem do **zacommitowanego baseline’u** (`git stash` → test → `stash pop`), nie do liczby zapamiętanej wcześniej w sesji. Nie licz na stabilną liczbę testów, gdy (a) `test:unit` leci w tym samym poleceniu co `build`, (b) testy dotykają dev-DB, którą e2e migruje/seeduje. Dla czystego baseline’u odpalaj `test:unit` osobno.

## 2026-06-17 — Nawigacja klient-side (setState) w stronie RSC ładującej dane per-URL → inne „strony" puste/stałe
**Problem:** W planie posiłków (`MealPlanWeek`) nawigacja tygodni (`goPrev/goNext/goToday`) robiła **tylko** `setAnchorDate(...)` po stronie klienta — bez zmiany URL. Tymczasem `app/kitchen/plan/page.tsx` (RSC) ładuje wpisy **dokładnie dla jednego tygodnia** z `searchParams.week` (albo „dziś"). Skutek: po przejściu na inny tydzień siatka pokazywała nowe daty, ale `entries` (prop) zostawały ze startowego tygodnia → inne tygodnie wyglądały na puste; a posiłek dodany poza bieżącym tygodniem znikał po najbliższej rewalidacji, bo serwer przeładowywał tydzień z URL (niezmieniony), nie oglądany. Brak testu e2e na nawigację tygodni sprawił, że to umknęło mimo statusu „Done".
**Rozwiązanie:** Nawigacja STERowana URL-em — `router.push('/kitchen/plan?week=<dateKey>')`; serwer przeładowuje `entries`+`weekCost` dla oglądanego tygodnia. Lokalny `anchorDate` zostawiony dla natychmiastowej zmiany siatki + `useEffect([initialWeek])` resynchronizuje go po przeładowaniu (URL = jedno źródło prawdy). Dodany test e2e: klik „Następny tydzień" → URL ma `?week=YYYY-MM-DD`.
**Lekcja:** Jeśli strona RSC ładuje dane na podstawie `searchParams`, to **cała nawigacja po tych danych musi przechodzić przez URL** (`router.push`/`<Link>`), nie przez lokalny `useState`. Stan lokalny zmienia tylko to, co widać, nie to, co serwer załaduje — i cicho rozjeżdża widok z danymi. Każdy taki „przełącznik zakresu" (tydzień/miesiąc/strona/filtr) zasługuje na test e2e sprawdzający zmianę URL.

## 2026-06-17 — Nowe pole modelu trzeba podpiąć we WSZYSTKICH ścieżkach create (nie tylko add/update)
**Problem:** Dodając `unitPrice` do `RecipeIngredient` (Z-252, koszt przepisu) łatwo było podpiąć je tylko w `addIngredient`/`updateIngredient` i zapomnieć o pozostałych miejscach, które tworzą składniki: zbiorczy `create` w `createRecipe` (mapowanie `data.ingredients`) oraz `duplicateRecipe` (kopiowanie `src.ingredients`). Pominięcie któregokolwiek = pole po cichu gubione przy tworzeniu/duplikowaniu przepisu (build by przeszedł, bo pole jest opcjonalne).
**Rozwiązanie:** Przed zakończeniem zadania `grep` po nazwie modelu + `create:`/`.create(`/`.map(` w pliku akcji — w `recipes.ts` były **4** ścieżki zapisu składnika (add, update, bulk-create w createRecipe, copy w duplicateRecipe). Wszystkie cztery dostały `unitPrice`. Migracja: dodatkowa kolumna nullable (`ADD COLUMN IF NOT EXISTS ... DOUBLE PRECISION`) — bezpieczna, bez backfillu.
**Lekcja:** Po dodaniu pola do modelu z wieloma punktami tworzenia rekordu zrób szybki audyt wszystkich `create`/`createMany`/`.map(` dla tego modelu (zwłaszcza ścieżki „duplikuj"/„importuj"). Opcjonalne pole nie wysypie buildu, więc brak go zauważysz dopiero jako zgubione dane.

## 2026-06-17 — Kolumna właściciela BEZ FK do User → ciche osierocenie przy usuwaniu konta (RODO)
**Problem:** Analiza twardego usuwania konta (Z-051) była sterowana **regułami FK** (`ON DELETE CASCADE`/`SET NULL`/`RESTRICT`) — i dla modeli z FK do `User` to działa. Ale przy weryfikacji Z-370 (Kontakty w RODO) okazało się, że `Contact.ownerId` oraz `ServiceFavorite.userId` to kolumny właściciela, które **nie mają w ogóle klucza obcego do `User`** (potwierdzone zapytaniem do `pg_constraint`). Skutek: po `user.delete()` rekordy te nie były ani kasowane (brak CASCADE), ani zerowane (brak SET NULL), ani blokujące (brak RESTRICT) — po prostu **zostawały jako sieroty** wskazujące na nieistniejącego usera. Dla kontaktów to dane osób trzecich → realne naruszenie „prawa do bycia zapomnianym".
**Rozwiązanie:** W `purgeUserData` dodano jawne `tx.contact.deleteMany({ where: { ownerId } })` i `tx.serviceFavorite.deleteMany({ where: { userId } })` przed `tx.user.delete()`. Test `purge.test.ts` rozszerzony o seed kontaktu usera A (asercja: skasowany) i usera B (asercja: nietknięty — izolacja). 3/3 zielone, tsc czysty.
**Lekcja:** Przy kasowaniu/anonimizacji danych konta NIE polegaj wyłącznie na regułach FK — model może mieć kolumnę właściciela (`ownerId`/`userId`) **bez** zadeklarowanego FK (w tym repo to się zdarza, bo część relacji jest „luźna"). Zrób osobny przegląd wszystkich kolumn `ownerId`/`userId`/`authorId` w `schema.prisma` i dla każdej bez `@relation`/FK dołóż jawny `deleteMany`. Inaczej RODO-purge zostawia sieroty po cichu.

## 2026-06-16 — Mylący prefiks `use` na zwykłej funkcji łamie rules-of-hooks (ESLint) — WeatherPage
**Problem:** Pomiar ESLint (Z-011) wykrył błąd `react-hooks/rules-of-hooks` w `WeatherPage.tsx`: „React Hook `useGeolocation` cannot be called inside a callback". W rzeczywistości `useGeolocation` to **zwykły helper** (woła `navigator.geolocation.getCurrentPosition` + `setCoords`/`showToast`, BEZ żadnych hooków React) — ale nazwany z prefiksem `use`, więc ESLint (i czytelnik) traktuje go jak hook i widzi naruszenie zasad hooków przy wołaniu w callbacku `onUseGeo`. Działało w runtime, ale to realny dług/pułapka.
**Rozwiązanie:** Zmiana nazwy `useGeolocation` → `requestGeolocation` (w definicji i wywołaniu). Zero zmiany zachowania, znika false-positive i mylące nazewnictwo. (Przy okazji: pełny ESLint na dojrzałym kodzie dał 74 problemy, gł. kosmetyczne `react/no-unescaped-entities` + `exhaustive-deps` + kwestie konfiguracji pluginu @typescript-eslint — pełne wdrożenie odłożone do pliku decyzji jako Z-011.)
**Lekcja:** Prefiks `use` REZERWUJ wyłącznie dla prawdziwych hooków React. Zwykłe funkcje-akcje (`requestX`, `detectX`, `handleX`) nazywaj bez `use` — inaczej `react-hooks/rules-of-hooks` rzuca false-positive przy wołaniu w callbackach/warunkach, a kod wprowadza w błąd co do reguł hooków.

## 2026-06-16 — `userDayBounds().end` o ~1 s za późno: `formatToParts` gubi milisekundy (wykryte testem)
**Problem:** Dopisując testy `lib/userTime.ts` (granice doby w strefie usera) okazało się, że `end` doby wychodzi `00:00:00.998` NASTĘPNEGO dnia zamiast `23:59:59.999`. Przyczyna: `tzOffsetMs` liczył offset przez `Intl.DateTimeFormat.formatToParts`, które **nie zwraca milisekund** — `Date.UTC(...,second)` obcinało ms, dając offset zaniżony o ułamek sekundy; `zonedWallToUtc` dodawał ten błąd, więc koniec doby (`…:59.999`) przeskakiwał o ~1 s. `start` (ms=0) był OK, dlatego bug nie rzucał się w oczy. Efekt: zdarzenia w pierwszej ~1 s nowej doby mogły wpaść w „dziś".
**Rozwiązanie:** W `tzOffsetMs` doliczyć ms instantu: `Date.UTC(p.year, p.month-1, p.day, hour, p.minute, p.second, at.getUTCMilliseconds())` (offsety stref to pełne minuty, więc ms instantu = ms zegara ściennego). 5 testów deterministycznych (tz+base jawnie) na UTC/CEST/CET + przejście doby + `userTomorrowStart`.
**Lekcja:** `Intl.DateTimeFormat.formatToParts` NIE ma `millisecond` — licząc offset/round-trip czasu zachowaj ms osobno (z instantu), inaczej granice doby (`…:59.999`) rozjadą się o ~1 s. Testy granic czasu pisz deterministycznie: przekazuj strefę i bazową datę jawnie (nie polegaj na strefie runnera), asercje na `toISOString()`.

## 2026-06-16 — XSS w rendererze markdown: linki `[x](javascript:…)` nie miały allowlisty schematów
**Problem:** Przy dopisywaniu testów bezpieczeństwa `lib/markdown.ts` (Z-057) wyszło, że globalne escapowanie `&`/`<` chroni przed wstrzyknięciem TAGÓW, ale **linki markdown nie były ograniczone do bezpiecznych schematów** — tylko obrazy miały regułę „tylko http(s)". `[klik](javascript:alert(1))` zamieniało się na `<a href="javascript:alert(1)">` (XSS po kliknięciu). Dodatkowo href **nie escapował `"`**, więc `[x](https://a"onmouseover=alert(1))` mogło wyjść z atrybutu (attribute injection). Renderer jest używany w raportach, AI, QA, przepisach — wejście bywa z modeli LLM i treści użytkownika.
**Rozwiązanie:** W `inlineFormat` link renderowany jako `<a>` **tylko** dla schematów `http(s)://` / relatywny `/` / kotwica `#` / `mailto:` (inaczej zostaje literalnym tekstem, jak obrazy spoza http(s)); href dodatkowo `"`→`%22`. 7 testów (`src/lib/__tests__/markdown.test.ts`): brak surowego `<script>`/`<img onerror>`, obraz/link http(s) OK, `javascript:`/`data:` zablokowane, brak attribute-injection, kod escapuje `>`, tabele/nagłówki/bold renderują.
**Lekcja:** W każdym własnym rendererze markdown/HTML **niezależnie kontroluj schematy URL w `href` i `src`** (allowlista http(s)/relatywny/mailto), nie tylko escapuj `<`/`&` — `javascript:`/`data:` w linku to klasyczny XSS, który escapowanie tagów przepuszcza. I escapuj cudzysłów w wartościach atrybutów. Jeśli jeden typ (obrazy) ma allowlistę, a drugi (linki) nie — to luka.

## 2026-06-16 — CI padał: `node --test "glob"` wymaga Node ≥22 (Node 20 nie rozwija glob → 0 s crash)
**Problem:** Pierwszy run CI (job `verify`) padł na kroku `test:unit` w ~0 s, mimo że lokalnie przechodzi. Workflow miał `node-version: 20`. Skrypt `test:unit` = `node --import tsx --test "src/**/*.test.ts"`. **Glob-pattern w argumencie `node --test` jest wspierany dopiero od Node 22** — Node 20 traktuje `"src/**/*.test.ts"` jako literalną ścieżkę, której nie ma → natychmiastowy błąd (ENOENT) i exit≠0. Lokalnie mam Node 22, więc nie wyszło. (Osobno padł job `e2e-smoke` — Playwright wymaga zaseedowanych userów E2E, co robi projekt `setup:db`; ustawiony jako nieblokujący do walidacji.)
**Rozwiązanie:** `node-version: 22` w obu jobach CI (zgodnie z lokalnym env, gdzie wszystko jest zielone). E2E oznaczone `continue-on-error: true` (sygnał, nie wywala gate'u) do pierwszej walidacji smoke na realnym runnerze.
**Lekcja:** Trzymaj wersję Node w CI **zgodną z lokalną** (gdzie weryfikujesz) — różnica major potrafi zmienić zachowanie narzędzi. Konkretnie: `node --test` z glob-em wymaga **Node ≥22**; na starszym Node użyj jawnej listy plików, katalogu, albo runnera, który sam rozwija glob. Po dodaniu workflow **sprawdź pierwszy run przez GitHub MCP** — CI „napisane" ≠ „działające".

## 2026-06-16 — Dryf schema↔DB przy indeksach: `@@index` brakuje w schema, ale indeks JEST w bazie
**Problem:** Przy Z-030 (indeksy `ownerId`/`ownerTeamId`) skan `schema.prisma` wykazał brak `@@index` na `Note` (i 6 innych modelach). Dodałem migrację `CREATE INDEX "Note_ownerId_idx" …`, a `migrate deploy` padł: `ERROR: relation "Note_ownerId_idx" already exists` (42P07). Indeks **istniał w bazie** mimo braku `@@index` w schemacie (dryf — wcześniejsza migracja go stworzyła, a `@@index` nigdy nie trafił do schema). Migracja idzie w transakcji, więc padł CAŁY plik (także poprawne `CREATE INDEX` dla Team/ShoppingList zostały wycofane), a migracja wylądowała w stanie *failed* (blokuje kolejne `migrate deploy`).
**Rozwiązanie:** `prisma migrate resolve --rolled-back "0186_owner_indexes"`, potem przepisać migrację na **`CREATE INDEX IF NOT EXISTS`** (idempotentnie pomija istniejące, tworzy brakujące) i ponowny `migrate deploy`. `@@index` zostawiłem w schemacie dla Note — teraz schema odzwierciedla realny stan DB (dryf naprawiony). Zweryfikowane: 9/9 indeksów obecnych, `migrate status` = „up to date".
**Lekcja:** Przed migracją indeksów **sprawdzaj realne indeksy w bazie** (`pg_indexes`/`information_schema`), nie tylko `@@index` w schema.prisma — potrafią się rozjechać. Indeksy w migracjach pisz z **`IF NOT EXISTS`** (idempotentnie), bo `migrate deploy` jest transakcyjny i jedno `already exists` wywala całą partię oraz zostawia migrację w stanie failed (kolejne deploy zablokowane do `migrate resolve`).

## 2026-06-16 — Twarde usunięcie konta (RODO art. 17): SET NULL osierociłby dane, więc kasuj jawnie
**Problem:** `prisma.user.delete()` nie wystarcza do RODO art. 17. Realne reguły FK do `User` (sprawdzone zapytaniem do `pg_constraint`) dzielą się na trzy grupy: **CASCADE** (znika z userem — OK), **RESTRICT** (`Team.ownerId`, `TeamInvitation.invitedById/invitedUserId` — blokują `user.delete()`), i **SET NULL** (Note, Recipe, ShoppingList, Habit, HealthEvent, MedicationSchedule, LanguageDeck, Cookbook, MealPlanEntry, TaskProject, Task, Report). SET NULL jest groźny: po usunięciu usera te osobiste rekordy **zostają w bazie z `ownerId=null`** (osierocone), czyli dane osobowe NIE są usunięte — łamie art. 17. Druga pułapka: sesja to **JWT**, więc usunięcie rekordu User nie unieważnia ciasteczka.
**Rozwiązanie:** `purgeUserData(userId)` (czysta funkcja w `src/lib/privacy/purge.ts`, testowalna lokalnie) w transakcji: (1) usuń RESTRICT-y (zaproszenia), (2) **jawnie skasuj** treści SET-NULL po `ownerId=user`/`authorId=user` (tylko osobiste — dane zespołów mają `ownerId=null`, więc filtr ich nie tknie → izolacja zachowana), zadania w kolejności komentarze/share→zadania→projekty, (3) `user.delete()` (kaskada reszty). `deleteMyAccount` (action) dokłada: potwierdzenie e-mailem, **blokadę gdy user jest właścicielem zespołu** (graceful degradation — przekazanie własności to decyzja usera), i `signOut({redirectTo})` (czyści JWT). `AuditLog` (bez FK, zrzut e-maila) celowo zostaje. Zweryfikowane tymczasowym skryptem na lokalnym Postgresie (user A skasowany w całości, user B i jego zespół nietknięte).
**Lekcja:** Przy „twardym usuwaniu" nie ufaj samej kaskadzie — **odpytaj bazę o realne `confdeltype`** każdego FK do usuwanej encji. `ON DELETE SET NULL` = rekord zostaje osierocony (dla danych osobowych to błąd RODO) → kasuj go jawnie, filtrując po właścicielu osobistym, żeby nie ruszyć danych zespołów. Pamiętaj o strategii sesji: przy **JWT** po usunięciu konta trzeba wymusić `signOut`, bo ciasteczko samo nie wygaśnie.

## 2026-06-16 — IDOR na zadaniach bez projektu (guard tylko `if (task.projectId)`) — audyt Z-052/Z-190
**Problem:** Podczas audytu autoryzacji Server Actions (zalecenia Z-052/Z-190) statyczny skan per-funkcja dał 10 „podejrzanych”, z czego 9 to false-positive (guard przez `auth()`+`where:{userId}`, `hasPermission(ADMIN)`, albo `assertCanEditSkin` — wzorce, których nie łapał mój regex `assert*Access`). Ale 1 był realny i **systemowy**: `Task` nie ma `ownerId` (własność = `projectId` LUB `createdById`/`assigneeId`), a wszystkie mutacje po `id` w `tasks.ts` guardowały tylko `if (task.projectId) assertProjectAccess(...)`. Zadania osobiste (`projectId=null`) omijały kontrolę → każdy zalogowany mógł je edytować/usuwać/przejmować po `id`. `reorderTask` nie sprawdzał właściciela **w ogóle** (tylko `requireAuth`).
**Rozwiązanie:** Helper `assertTaskAccess(task, userId)` w `tasks.ts`: jeśli `projectId` → `assertProjectAccess`; w przeciwnym razie `createdById===userId || assigneeId===userId` (parytet z `getAllUserTasks`), inaczej rzut „Access denied”. Podmieniłem nim wszystkie `if (task.projectId) assertProjectAccess(...)` (getTask, updateTask, updateTaskTags, deleteTask, toggleTaskStatus, addTaskComment, shareTask, shareTaskByEmail, removeTaskShare), dodałem brakujący guard w `completeRecurringTask` i `reorderTask`. tsc/next build/testy zielone.
**Lekcja:** Gdy model NIE ma `ownerId`, a własność jest „przez rodzica LUB pola osobiste”, guard `if (parentId)` jest dziurą dla rekordów bez rodzica — kontrola dostępu musi pokrywać **oba** tory własności i być spójna ze stroną odczytu (ten sam zestaw warunków co `getAll*`). Skan statyczny anty-IDOR ma duży odsetek false-positive (różne, równoważne wzorce guardów) — traktuj go jako „listę do ręcznej weryfikacji”, nie wyrocznię; realnym strażnikiem regresji są testy izolacji (Z-172), nie statyka.

## 2026-06-15 — „Książka” admina jako pliki w repo + pieczenie; równoległe subagenty padają na limicie sesji
**Problem:** Trzeba było dodać obszerny, admin-only dokument („Analiza/Audyt”) wersjonowany w repo (nie w bazie). Dwie pułapki: (1) statyczny HTML w `public/` byłby publiczny (łamie „tylko admin”), a `next build` z `npx` na świeżym klonie ściągał Next 16 zamiast projektowego Next 14 (brak `node_modules` → najpierw `npm install`, potem `./node_modules/.bin/next build`); (2) zrównoleglenie pisania treści przez 5 subagentów `general-purpose` skończyło się tym, że **limit sesji ubił je w trakcie** — z ~22 zaplanowanych rozdziałów na dysk trafił tylko 1, reszta pracy (research) przepadła w transkryptach agentów.
**Rozwiązanie:** Wzorzec jak istniejące `/admin/docs`: źródło = Markdown w `content/audyt/*.md` + `manifest.json`, „upiekłem” je skryptem `scripts/copy-audyt.js` do `src/generated/audyt-book.ts` (wpięte w `build`, commitowane), a trasa `/admin/audyt` (bramka `module.admin`) renderuje aktywny rozdział istniejącym, bezpiecznym `markdownToHtml` (zero surowego HTML). Status rozdziału liczę z obecności pliku → dodanie `.md` = rozdział „gotowy”. Po wpadce z agentami przeszedłem na pisanie bezpośrednie + **commit po każdej partii rozdziałów** (re-bake `copy-audyt.js` + `git add` + commit), żeby kolejny ewentualny limit niczego nie kasował. Przy okazji: renderer `markdown.ts` **już** wspiera `#`–`######` i listy zagnieżdżone — notka w CLAUDE.md była nieaktualna (poprawiona).
**Lekcja:** Dokument „w repo, nie w bazie, tylko dla admina” = pliki Markdown + skrypt pieczący do `src/generated/` + bramkowana trasa renderująca przez `markdownToHtml` (parytet z `/admin/docs`, zero ryzyka runtime-fs i zero publicznego wycieku). Przy dużych zadaniach NIE polegaj na równoległych subagentach jako jedynym nośniku postępu — **commituj przyrostowo**, bo limit sesji potrafi uciąć agenty i ich praca (poza tym, co już zapisali na dysk) znika. Weryfikuj build projektowym Nextem (`./node_modules/.bin/next build` po `npm install`), nie `npx next` (ściąga najnowszy major).

## 2026-06-14 — Zmiana statusu/terminu zadania zamykała otwarte szczegóły/edycję
**Problem:** W `TasksPage` panel szczegółów wyliczał `openTask` wyłącznie z propu `tasks` (lista filtrowana serwerowo). Gdy zmiana statusu lub terminu wypchnęła zadanie z bieżącego widoku (ukończenie w widoku aktywnych, zmiana terminu poza „Dziś"/„Nadchodzące"), `revalidatePath` odświeżał `tasks`, zadania już w nim nie było, `tasks.find` zwracał `undefined`, `openTask` stawał się `null` i panel szczegółów/edycji **zamykał się sam**. Istniał już dokładnie ten sam mechanizm-obejście, ale tylko dla świeżo utworzonych zadań (`justCreated`).
**Rozwiązanie:** Dodano „migawkę" ostatniej znanej wersji otwartego zadania (`openTaskSnapshot`): dopóki zadanie jest w widoku, migawka jest odświeżana; gdy z niego wypadnie, panel pokazuje migawkę zamiast się zamykać (z listy zadanie i tak znika). Migawkę wiążemy z aktualnym `openTaskId` (żeby nie pokazać poprzedniego zadania) i czyścimy przy zamknięciu panelu. Formularz `TaskDetail` i tak trzyma własny stan lokalny, więc edycja działa dalej na poprawnym `task.id`.
**Lekcja:** Panel szczegółów/edycji nie może wyliczać otwartego rekordu wprost z listy filtrowanej serwerowo — każda mutacja, która zmienia przynależność rekordu do widoku, usunie go z listy i zamknie panel. Trzymaj „sticky" referencję otwartego rekordu (ostatnia znana wersja) jako fallback. Gdy w kodzie jest już lokalne obejście dla jednego przypadku (tu `justCreated`), to sygnał, że problem jest ogólniejszy — uogólnij je, zamiast mnożyć łatki.

## 2026-06-08 — Narzędzie „wskazywania" do chrome to był błąd: chrome jest POD modalem
**Problem:** W poprzednim kroku admiński tryb wskazywania (wskaż element → zgłoś) przeniosłem z pływającego FAB do chrome (przycisk w górnym pasku mobile + wpis w panelu admina, na desktopie tylko skrót). Dwa realne błędy: (1) na mobile pasek górny jest **pod modalem** (`fixed inset-0 z-50`), więc przy otwartym modalu przycisku nie dało się kliknąć — a wskazywanie elementu W MODALU to główny przypadek użycia; (2) na desktopie funkcja została bez widocznego wejścia (sam skrót Ctrl+Shift+B), co jest niewykrywalne.
**Rozwiązanie:** Przywróciłem **pływający** przycisk (admin-only), bo tylko on może wynieść się NAD modal. Logika świadoma modali (`useOverlayState`): w spoczynku 44 px nad asystentem, `z-index 39` (asystent 41 może go lekko zasłonić, nigdy odwrotnie), z odstępem; gdy otwarty jest modal treściowy — asystent chowa swój FAB, a ten wskakuje w jego główne miejsce i na `z-index 10001` (nad modalem `z-50`), więc da się kliknąć i wskazać element w modalu. Pływający FAB jest widoczny na desktopie i mobile naraz (rozwiązuje brak wejścia na desktopie). Zepsuty przycisk z górnego paska usunąłem; dzwonek powiadomień ZOSTAJE w chrome (nie ma wymogu działania nad modalem). Wpis w panelu admina + skrót zostały jako dodatkowe wejścia.
**Lekcja:** Element, który z definicji musi działać NAD modalem (overlay-owe „wskaż element", globalne akcje na modalu), NIE może mieszkać w chrome (pasek/sidebar/menu) — chrome renderuje się pod modalem (`z` < 50). Taki trigger musi być pływający z `z-index` ponad warstwą modali (i najlepiej świadomy modali: chować się/relokować). Przenosząc funkcję „z rogu do nawigacji" sprawdź najpierw, czy nie ma ona przypadku użycia wymagającego bycia nad modalem — jeśli ma, zostaje pływająca.

## 2026-06-08 — Trzy FAB-y w jednym rogu: powiadomienia + admin-zgłoszenie wyniesione do chrome
**Problem:** Po dołożeniu (na develop) pływającego dzwonka powiadomień w prawym dolnym rogu zebrały się trzy pływające przyciski (asystent AI, dzwonek, admiński „zgłoś błąd"), a dzwonek i przycisk admina miały **identyczną pozycję** (`right-5`, `bottom-[132px] md:bottom-[84px]`) — kolizja. Sam stos trzech FAB-ów to też zła UX: róg powinien mieć jedną główną akcję.
**Rozwiązanie:** Decyzja UX (wariant „hybryda"): róg = wyłącznie asystent AI. Dzwonek i admiński trigger to elementy *chrome*, nie akcje główne, więc wyszły z rogu do nawigacji. `NotificationBell` zrobiono **osadzalnym** (prop `placement`): `sidebar` → wiersz w stopce sidebara (panel rozwija się W GÓRĘ, `bottom:100%+8px; left`), `topbar` → kompaktowa ikona w górnym pasku mobile (panel W DÓŁ, `top:100%+8px; right`); wrapper zmieniony z `fixed` na `relative`. Renderowany w dwóch miejscach (sidebar desktop + górny pasek mobile) — bezpieczne, bo `syncReminders` jest idempotentne (`upsert` po `dedupeKey`), więc podwójny skan nie duplikuje powiadomień. Admiński „tryb wskazywania" **stracił stały pływający przycisk** — uruchamiają go: skrót Ctrl/Cmd+Shift+B (już był), wpis w panelu admina i admiński przycisk w górnym pasku (mobile), oba przez nową magistralę zdarzeń `feedbackBus` (`window` CustomEvent `omnia:feedback-start` → listener w `FeedbackInspector`, analogicznie do `assistantBus`). `FeedbackInspector` renderuje teraz tylko overlay trybu (podświetlenie + pasek), bez FAB.
**Lekcja:** Powiadomienia i narzędzia admina to *chrome*, nie akcje główne — nie pakuj ich jako FAB do rogu z akcją sygnaturową (jeden róg = jedna akcja). Komponent z własnym panelem zrób osadzalnym (prop `placement` + przełączana kotwica panelu w zależności czy siedzi u góry, czy u dołu ekranu) zamiast zaszywać `position:fixed`. Funkcję bez stałego przycisku da się wygodnie wyzwalać z wielu miejsc lekką magistralą `window`-CustomEvent (taniej niż Context). I zanim wyrenderujesz stanowy komponent w dwóch miejscach naraz — upewnij się, że jego efekt montażu (tu skan terminów) jest idempotentny.

## 2026-06-07 — Quick-add zadania (pole nad listą) dublował logikę tytuł/treść poza asystentem AI
**Problem:** Regułę „pojedynczy tekst → treść, tytuł generowany" wdrożono najpierw tylko w prompcie asystenta AI (`agent/route.ts`). Ale szybkie pole „Dodaj zadanie…" nad listą zadań (`QuickAddTask`) omija asystenta i woła `createTask` bezpośrednio — wrzucało cały wpisany tekst do `title`, a `description` zostawiało puste. Czyli ta sama luka istniała w drugim, niezależnym punkcie wejścia.
**Rozwiązanie:** `QuickAddTask.handleSubmit` traktuje teraz wpisany tekst jako `description` i generuje zwięzły `title` przez nowy route `/api/llm/tasks/title` (wzorzec skopiowany z `/api/llm/notes/title`, op „dispatch"). Fallback offline: lokalny `deriveLocalTitle` (pierwszy wiersz przycięty do ~60 zn.), więc brak LLM nie blokuje dodania. Zachowano wyjątek dla krótkiego, jednowierszowego wpisu (≤50 zn., bez `\n`) — to po prostu sam tytuł (np. „kup mleko"), bez wołania LLM i bez dublowania w opisie — spójnie z regułą wyjątku w prompcie agenta.
**Lekcja:** Reguła UX dotycząca tworzenia rekordu musi być wdrożona w KAŻDYM punkcie wejścia, nie tylko w asystencie AI. Po zmianie zachowania asystenta sprawdź szybkie pola dodawania (QuickAdd*) w modułach — one wołają Server Actions bezpośrednio i łatwo o nich zapomnieć.

---

## 2026-06-07 — AI: pojedynczy tekst przy tworzeniu zadania/notatki = treść, tytuł generowany
**Problem:** Gdy użytkownik dyktuje asystentowi jeden blok tekstu bez wyraźnego rozdzielenia „tytuł" vs „treść", AI wrzucało cały tekst jako tytuł (zwłaszcza dla notatek — `create_note` w katalogu akcji nie miało żadnej wskazówki redakcyjnej), zamiast potraktować go jako zawartość i wygenerować zwięzły tytuł.
**Rozwiązanie:** Zmiana wyłącznie w prompcie agenta (`ACTION_CATALOG_BY_MODULE` w `src/app/api/llm/home/agent/route.ts`) — executor przepuszcza title/description/content 1:1, więc o mapowaniu decyduje model. Do `create_task` i `create_note` dodano regułę „TYTUŁ vs TREŚĆ": jeden tekst → traktuj jako treść (description/content), title wygeneruj jako krótką etykietę; wyjątek dla wyraźnie krótkiego samego tytułu.
**Lekcja:** Reguły mapowania pól przy tworzeniu rekordów przez AI to kwestia promptu, nie kodu — i muszą być spójne między analogicznymi akcjami (to, co dodano dla zadań w 0097, trzeba było replikować dla notatek). Przy dodawaniu wskazówki redakcyjnej dla jednej akcji sprawdź bliźniacze akcje w tym samym katalogu.

---

## 2026-06-08 — Regex z flagą `u` / `\p{...}` wywala build (target TS < es6)
**Problem:** `text.replace(/[^\p{L}\p{N}\s]/gu, " ")` w komponencie nauki języków wywaliło `next build`: „This regular expression flag is only available when targeting 'es6' or later". Repo ma starszy target TS — unicode property escapes (`\p{L}`) i flaga `u` są niedozwolone.
**Rozwiązanie:** zamiast `\p{L}\p{N}` + flaga `u` — usuwanie diakrytyków przez `normalize("NFD").replace(/[̀-ͯ]/g, "")` i strip interpunkcji jawną listą znaków (`/[.,;:!?()…—–\-_"'„"«»]/g`) bez flagi `u`. Polskie litery (ł, ż) zostają, bo nie są dekomponowane przez NFD i nie ma ich na liście interpunkcji.
**Lekcja:** w tym repo NIE używaj flagi regex `u` ani `\p{...}` (target TS to blokuje, podobnie jak iterację po Map). Diakrytyki: NFD + `[̀-ͯ]`. Interpunkcja: jawna lista znaków, nie `\P{L}`.

---

## 2026-06-07 — Iteracja po `Map`/`Set` wywala build (target TS) + lokalny Postgres jako weryfikowalny build w sandboxie
**Problem:** (1) `for (const [k, v] of someMap)` w akcji serwerowej wywaliło `next build`: „Map can only be iterated through with '--downlevelIteration' or '--target' es2015+". Konfiguracja TS repo na to nie pozwala. (2) Realny problem przekrojowy: w sandboxie web nie ma `DATABASE_URL`, więc `npm run build` (który kończy się `scripts/migrate.js` = `prisma migrate deploy`) zawsze padał — nie dało się zweryfikować zmian.
**Rozwiązanie:** (1) zamiast iterować po `Map` użyj `Array.from(map.values())` (lub `.entries()` opakowane w `Array.from`). (2) Postawiono lokalny Postgres 16 (jest w obrazie, `pg_ctlcluster 16 main start`), rola+baza `omnia/omnia_dev`, `.env.local` z `DATABASE_URL`/`DIRECT_URL` na `127.0.0.1:5432`, `npx prisma migrate deploy` zaaplikował wszystkie migracje. Od tego momentu pełny `npm run build` przechodzi lokalnie i każda zmiana jest weryfikowalna — bez dotykania produkcji.
**Lekcja:** Nie iteruj bezpośrednio po `Map`/`Set` w tym repo — `Array.from(...)`. A gdy trzeba realnie zbudować/odpalić appkę w sandboxie, postaw lokalny Postgres i wskaż go w `.env.local` zamiast walczyć z brakiem bazy (eksportuj te zmienne też do shella, bo `scripts/migrate.js` nie ładuje `.env.local`).

---

## 2026-06-07 — „Spaghetti" wymagań: zadania odwołujące się do starszych raportów, których stan już się zdezaktualizował
**Problem:** Dwa zgłoszenia administratora (marketplace Fixly/Booksy + „dokończ wskazania raportu architektury 2026-05-31") zazębiały się i odwoływały do raportów sprzed tygodnia. Raporty luk (`omnia-luki-wdrozeniowe-2026-06-01`) opisywały stan na 01.06, a od tego czasu doszły całe moduły (Magazynowanie, Warsztaty, Wiadomości, Pogoda, Skiny) i przebudowa asystenta na czat — więc backlog liczony „z pamięci/ze starego raportu" byłby fałszywy. Ryzyko: zaplanować implementację rzeczy już zrobionych lub odwrotnie.
**Rozwiązanie:** Zanim cokolwiek zaplanowano, **zweryfikowano każdą sporną pozycję bezpośrednio w kodzie** (grep modeli `Notification`/`Contact`/`Service*`, odczyt `src/actions/calendar.ts` pod kątem agregowanych źródeł, lista komponentów `tasks/`). Powstał jeden scalający raport `omnia-master-plan-domkniecie-2026-06-07` z kolumną statusu ✅/🟡/❌ **opartą na audycie kodu**, a nie na poprzednich raportach. Treść raportu trzymana w pliku `docs/reports/<slug>.md` i **generowana z niego** do migracji seedującej skryptem (jedno źródło prawdy, brak rozjazdu plik↔baza). Dollar-quoting `$omnia_master_plan$` + walidacja braku kolizji znacznika w treści przed zapisem.
**Lekcja:** Gdy zadanie odwołuje się do starszego raportu „co zostało do zrobienia", NIGDY nie ufaj jego statusom wprost — zweryfikuj w kodzie aktualny stan (migracje potrafią wyprzedzić raporty o tygodnie). Przy raportach kopiowanych do migracji generuj SQL z pliku md skryptem, nie ręcznie, i sprawdzaj kolizję dollar-tagu.

---

## 2026-06-07 — Współistnienie pływających przycisków (asystent vs admin-zgłoszenie) i ich zachowanie nad modalami
**Problem:** Admiński FAB „zgłoś błąd" (robaczek) nakładał się na magiczną ikonę asystenta i — bo był później w DOM przy równym `z-40` — **zasłaniał ją** (miało być odwrotnie: główna akcja na wierzchu). Dodatkowo oba FAB-y mają sens nad modalem (admin musi móc wskazać element w modalu), ale przy `z-40` chowały się pod nakładkami modali (`z-50`), a magiczna ikona nie powinna być w ogóle dostępna „dialog na dialogu".
**Rozwiązanie:** Wspólny hook `useOverlayState` (`src/hooks/useOverlayState.ts`) z `MutationObserver` na `document.body` wykrywa otwarte nakładki. Modale w tej apce **nie ustawiają `role="dialog"`** — dzielą wzorzec `fixed inset-0 z-50+`, więc detekcja idzie po selektorze klas `[class~="fixed"][class~="inset-0"]`. Nakładki, które NIE są „modalami treściowymi" (sam asystent, menu mobilne, `ActionDrawer`) oznaczyłem `data-omnia-overlay` i wykluczam z detekcji. Hierarchia: magiczna ikona `z-index 41` (nad adminem 39, z odstępem — magiczna może lekko zasłonić admina, nigdy odwrotnie). Gdy otwarty **modal treściowy**: magiczną ikonę chowamy, a admiński FAB skacze w główne miejsce po niej i nad modal (`z-index 10001`). Gdy otwarty **asystent**: admiński FAB chowamy (by nie zasłaniał), a overlay asystenta + `ActionDrawer` podniosłem do `z-index 9990/9991`, żeby asystent otwarty z trybu wskazywania renderował się NAD modalem, z którego admin wskazał element (kontekst i tak jest już przechwycony jako tekst).
**Lekcja:** Gdy modale nie mają wspólnego `role`/markera, detekcję „czy jest otwarty modal" oprzyj na ich realnym wspólnym wzorcu klas (`fixed inset-0`) przez `MutationObserver`, a wyjątki (własne nakładki) wyklucz znacznikiem `data-*` zamiast oznaczać 30+ modali. Przy stosie pływających przycisków ustal jawną hierarchię `z-index` (główna akcja > pomocnicza) — nie polegaj na kolejności w DOM. I uważaj na podnoszenie `z-index` nakładki, która ma „dzieci-modale" (tu `ActionDrawer` jeździ na asystencie): podnieś je razem, inaczej dziecko zniknie pod rodzicem.

## 2026-06-07 — Admin „tryb wskazywania" do zgłaszania błędów: otwieranie self-contained chatu z zewnątrz + przechwytywanie kliknięć
**Problem:** Admin miał móc włączyć tryb, kliknąć dowolny element UI, a aplikacja miała rozpoznać „miejsce" i otworzyć asystenta (`AICommandSheet`) z gotowym kontekstem, by z opisu admina zrobić zadanie w projekcie „Omnia". Dwie trudności: (1) `AICommandSheet` trzyma cały stan lokalnie (`isOpen`, wątek) i jest montowany raz w `AppShell` — nie było żadnego mechanizmu otwarcia go z innego komponentu; (2) w trybie wskazywania klik musi podświetlać element i być przechwycony, ale NIE może wywołać normalnej akcji aplikacji (np. nawigacji).
**Rozwiązanie:** (1) Lekka **magistrala zdarzeń** `window` (`src/lib/ai/assistantBus.ts`, `openAssistant({feedbackContext})` → `CustomEvent("omnia:assistant-open")`) zamiast refaktoru na React Context — `AICommandSheet` dodaje jeden `useEffect` z listenerem, który otwiera sheet i seeduje wątek kartą „co trafiło do kontekstu". Tryb zgłoszenia trzymany w `useRef` (nie state), bo `handleSend` i listener muszą widzieć aktualną wartość bez re-bindu; pierwsza wiadomość admina jest opakowywana w prompt „utwórz JEDNO zadanie w projekcie Omnia, tytuł wygeneruj z opisu" i leci zwykłą ścieżką agent→plan→`ActionDrawer` (zero zmian w agencie/executorze — `create_task` + `projectName:"Omnia"` już działały; `ensureOmniaProject()` tworzy projekt z góry). (2) `FeedbackInspector` (montowany w `AppShell` tylko gdy `isAdmin`) zakłada listenery `pointermove`/`click`/`keydown` w **fazie capture** (`addEventListener(..., true)`) i robi `preventDefault()+stopPropagation()` — dzięki capture łapie zdarzenie zanim dojdzie do handlerów aplikacji. Własny UI (pasek/anuluj) oznaczony `data-feedback-ui` i pomijany w handlerach, żeby dało się go kliknąć.
**Lekcja:** Żeby sterować komponentem o lokalnym stanie z zewnątrz bez przebudowy drzewa — wystarczy `window` CustomEvent + jeden listener w środku (tańsze niż Context/lifting state). Do globalnego „inspect mode" przechwytuj zdarzenia w **fazie capture** z `stopPropagation`, inaczej klik odpali akcje aplikacji; a własne kontrolki overlay’a wyklucz znacznikiem (`data-*`). I gdy się da, podłączaj nową funkcję pod istniejący pipeline (agent→plan→ActionDrawer) zamiast dorabiać równoległą ścieżkę — tu cała „twórczość" to tylko dobrze sformułowany prompt.

## 2026-06-06 — Daty w podglądzie akcji asystenta: surowy ISO zamiast formatu dla człowieka
**Problem:** Zadanie „Prezentacja daty w Magicznej ikonie" miało **pusty opis** — zrozumiałem je błędnie (data w nagłówku asystenta) i zaimplementowałem nie to. Właściwy cel: w podglądzie wykrytych akcji (`ActionDrawer`) parametry-daty pokazywały się jako **surowy string ISO z JSON-a** (`2026-06-08T00:00:00.000Z`), bo edytor renderował każdy parametr jednolicie jako `String(v)` w zwykłym `<input>`. Format maszynowy, nieczytelny i niewygodny do edycji.
**Rozwiązanie:** W `ActionDrawer` wykrywam wartości-daty **po wartości** (regex ISO + walidacja `new Date`), nie po nazwie klucza — działa dla dowolnego pola (`dueDate`/`scheduledAt`/`expiresAt`…) bez listy nazw. Render natywnym pickerem: `datetime-local` gdy jest znaczący czas, `date` dla samej daty/północy (`T00:00:00Z` to typowo termin dzienny). Picker pokazuje datę w formacie lokalnym (pl) + etykieta `toLocaleDateString("pl-PL", …)`. Dla daty bez czasu `Date` budowany lokalnie (`new Date(y,m-1,d)`), by dzień się nie przesuwał. Picker oddaje `YYYY-MM-DD`/`YYYY-MM-DDTHH:mm` — backend i tak robi `new Date(String(...))`, więc executor bez zmian. Błędną pierwszą zmianę wycofałem `git revert`; błędny raport (migracja 0095) zastąpiłem nową migracją 0096 (DELETE starego wiersza + INSERT właściwego), bo **migracje są append-only** — nie usuwa się zastosowanych plików, korektę robi się nową migracją.
**Lekcja:** Gdy zadanie ma pusty/niejasny opis — dopytaj zanim zaimplementujesz, zwłaszcza przy ogólnikowym tytule („prezentacja X"). Daty z JSON-a (ISO) nigdy nie pokazuj userowi jako stringa — wykrywaj je po wartości i renderuj natywnym `date`/`datetime-local` (lokalny format + edycja), pamiętając o budowaniu daty bez czasu lokalnie (inaczej strefa przesuwa dzień). A poprawki już wypchniętych migracji/seedów rób **nową** migracją (DELETE+INSERT), nie edycją/usuwaniem starej — bo `prisma migrate deploy` śledzi je po nazwie.

## 2026-06-06 — Opis zadania tworzonego przez AI: wierne przepisanie zamiast streszczenia
**Problem:** Gdy użytkownik dyktował zadanie asystentowi AI (krok „plan" → `ActionDrawer` → `create_task`), pole `description` nowego zadania bywało puste albo streszczone — model gubił fakty, liczby i szczegóły z oryginalnej wypowiedzi. Oczekiwanie: opis ma zawierać DOKŁADNIE to, co padło jako treść zadania, jedynie lekko zredagowane (forma bezosobowa, gramatyka), bez streszczania i bez zmiany znaczenia.
**Rozwiązanie:** `description` trafia 1:1 do `Task.description` (executor nic z nim nie robi), więc to czysto kwestia promptu. W katalogu akcji `tasks` (`buildActionCatalog` w `agent/route.ts`) przy `create_task` dodano wyraźną regułę: `description` = wierne przepisanie treści polecenia, dozwolona tylko lekka redakcja (bezosobowość + gramatyka/interpunkcja), zakaz streszczania/skracania/pomijania faktów; `title` zostaje krótką etykietą. Pominięcie `description` tylko gdy user podał sam tytuł.
**Lekcja:** Gdy pole z akcji AI ma być „wierną kopią wypowiedzi", nie zakładaj że model sam to zrobi — domyślnie streszcza. Trzeba w prompcie jawnie rozdzielić rolę pól (krótki `title` vs pełny `description`) i wprost zabronić streszczania/pomijania faktów. Najpierw sprawdź, czy executor przepuszcza wartość bez modyfikacji — jeśli tak, naprawa jest wyłącznie w prompcie, nie w kodzie.

## 2026-06-06 — System skórek (motywów) bez FOUC i z bezpiecznym aplikowaniem zmiennych CSS
**Problem:** Aplikacja miała jeden zahardkodowany ciemny motyw (`<html class="dark">`, zmienne w `:root`). Trzeba było dodać 5 skórek systemowych (w tym jasną) + skórki użytkownika (zapis/współdzielenie/reużycie), tak by zmiana motywu była natychmiastowa, bez migotania, a dane skórki (kolory wpisywane przez usera) nie mogły wstrzyknąć się do CSS. Dodatkowo ~30-40% komponentów hardkodowało `color: "#fff"` na przyciskach akcentowych — to nie był token, więc skórka nie mogła nim sterować.
**Rozwiązanie:** Skórka = **częściowa mapa `zmienna CSS → wartość`** trzymana w DB (`Skin.tokens` jako JSON string). Aplikowana **inline na `<html>`** w `layout.tsx` (server component) — element `<html>` JEST `:root`, więc inline style nadpisuje reguły `:root` z `globals.css` najwyższym priorytetem i jest w pierwszym HTML-u (zero FOUC). Pominięte zmienne dziedziczą domyślne ciemne wartości → skórka „Ciemny" to po prostu `{}`. `color-scheme`, `--font-size-base` (gęstość) i `--radius` też zrobione tokenami; ikonę natywnego date-pickera (jasny SVG) zawężono do `html[data-skin-scheme="dark"]`, bo na jasnej skórce była niewidoczna. Bezpieczeństwo: każda wartość przechodzi `sanitizeTokenValue` (whitelista kluczy + regex na hex/rgb()/px/`light|dark` + twarda blokada `;{}<>`), więc nie da się wyjść z deklaracji inline-style. Sweep: `color: "#fff"` → `var(--on-accent)` w 67 plikach (perl -pi), bo to był zawsze tekst na akcencie.
**Lekcja:** Do motywowania bez migotania aplikuj zmienne CSS **inline na elemencie `<html>`** (to `:root`), renderowane po stronie serwera — nie potrzeba osobnych plików CSS per-motyw ani klas, a pominięte zmienne automatycznie dziedziczą domyślne. Gdy user wpisuje wartości lądujące w inline-style, **zawsze** waliduj whitelistą kluczy + regexem wartości (blokuj `;{}<>`), inaczej masz wektor CSS-injection. I tokenizuj nie tylko tła/teksty, ale też `color: #fff` na akcentach (→ `--on-accent`) — bez tego jasne motywy się sypią.

## 2026-06-06 — Otwieranie panelu nowego zadania w widokach wirtualnych: optymistyczny fallback
**Problem:** Po szybkim dodaniu zadania (`QuickAddTask`) panel szczegółów miał się otwierać, by ustawić resztę parametrów. Działało na liście projektu, ale w widokach wirtualnych (Dziś/Nadchodzące/Zaległe) nowe zadanie trafia do Skrzynki bez terminu, a te widoki filtrują `tasks` po `dueDate` na serwerze — więc świeże zadanie nie wchodziło do listy. `openTask = tasks.find(id)` zwracało `null` i panel się nie otwierał.
**Rozwiązanie:** `createTask` już zwraca pełny obiekt zadania, więc `QuickAddTask` przekazuje go w callbacku `onCreated(task)` (nie samo `id`). `TasksPage` trzyma go w stanie `justCreated` i używa jako **fallback**: `openTask = tasks.find(id) ?? (justCreated.id===id ? justCreated : null)`. Panel otwiera się zawsze; gdy rewalidacja dociągnie zadanie do `tasks` (np. po ustawieniu terminu na dziś), `tasks.find` wygrywa jako świeższe źródło. `justCreated` czyszczone efektem `if (!openTaskId) setJustCreated(null)` — łapie każdą ścieżkę zamknięcia (X, Esc, wstecz/popstate, usunięcie). Bezpieczne, bo `TaskDetail` trzyma własny stan i re-synchronizuje tylko przy zmianie `task.id`, więc stały (potencjalnie nieaktualny) obiekt fallbacku nie nadpisze edycji użytkownika.
**Lekcja:** Gdy element UI (panel/podgląd) renderuje się tylko gdy encja jest w przefiltrowanej liście, a właśnie ją utworzyłeś — nie zakładaj, że rewalidacja wstawi ją do tej konkretnej listy (filtry serwerowe mogą ją wykluczyć). Przekaż zwrócony obiekt i użyj go jako optymistycznego fallbacku, preferując świeższą wersję z listy. I czyść taki stan jednym efektem na `null`-owanie klucza, zamiast w każdym handlerze zamknięcia z osobna.

## 2026-06-05 — Per-lista statusy w widokach ZBIORCZYCH: scal konfigurację + rozwiązuj per-zadanie
**Problem:** Po wdrożeniu własnych statusów per-lista zadanie z takim statusem w widokach obejmujących wiele list (Wszystkie/Dziś/Nadchodzące/Zaległe/Grupy) było widoczne tylko w zakładce „Wszystkie" (brak zakładki dla custom-statusu), a w panelu szczegółów dropdown pokazywał surowe `id` zamiast nazwy. Przyczyna: strona dla widoków wirtualnych przekazywała `DEFAULT_STATUS_CONFIG` (bez własnych statusów), a `statusMetaFor` na nieznanym kluczu zwraca fallback `label = key`. Dodatkowo `TASK_INCLUDE` nie pobierał `project.statusConfig`, więc komponenty nie miały skąd wziąć właściwej konfiguracji per zadanie. Drugi, ukryty błąd: przeniesienie zadania do innej listy „osieracało" custom-status (docelowa lista go nie zna).
**Rozwiązanie:** (1) `aggregateStatusConfig(projects, tasks)` scala definicje własnych statusów ze wszystkich list w zakresie (klucze `c_<rand>` są globalnie unikalne) i dokłada do zakładek tylko te custom, które realnie występują wśród zadań; strona używa go dla widoków wirtualnych (realny projekt nadal swojej konfiguracji). (2) `TASK_INCLUDE.project` pobiera `statusConfig`, a `TaskRow`/`TaskDetail` rozwiązują status względem WŁASNEJ listy zadania (`task.project.statusConfig`), nie konfiguracji strony — dropdown pokazuje statusy właściwej listy, nie obce. (3) `updateTask` przy zmianie `projectId` resetuje osierocony custom-status do pierwszego włączonego statusu celu (statusy systemowe są uniwersalne, zostają).
**Lekcja:** Funkcja „per-lista X" prawie zawsze ma drugą połowę: widoki ZBIORCZE, które łączą wiele list. Zaprojektuj od razu dwie ścieżki — scaloną konfigurację dla nagłówków/zakładek/filtrów ORAZ rozwiązywanie per-element wg encji-źródła (zadanie zna swój projekt). I pamiętaj o przenoszeniu między listami: wartość zależna od listy (status, kategoria) musi być re-walidowana wobec celu, inaczej osierocieje.

## 2026-06-05 — Własne statusy zadań per-lista bez migracji DB (rozszerzenie JSON-a)
**Problem:** Statusy zadań były 6 zaszytych wartości (`SYSTEM_TASK_STATUSES`), a `TaskStatus` to ścisły union używany w całym module. Trzeba było pozwolić użytkownikowi dodawać/usuwać własne statusy (systemowe tylko włączać/wyłączać), z nazwą/kolorem/ikoną/flagą „zamykający". Kuszące było dodanie modelu `TaskStatus` w Prisma — ale `Task.status` to już `String`, a konfiguracja statusów listy już siedzi w polu JSON `TaskProject.statusConfig`.
**Rozwiązanie:** Dołożyłem `custom: CustomTaskStatus[]` do tego samego JSON-a (zero migracji). `ProjectStatusConfig.enabled/chain` rozluźnione z `TaskStatus[]` do `string[]` (klucze custom `c_<rand>` się mieszczą). Nowe resolwery `resolveStatuses`/`statusMetaFor(key, config)` zastąpiły zaszyte `statusMeta`/`STATUS_ICONS`/`TASK_STATUS_FILTER_LABELS` w renderze (TaskRow/Filters/List/Detail/Page) — wszystkie biorą metadane z konfiguracji listy. Blokada usunięcia w użyciu: server action liczy `task.count({ projectId, status: key })` dla usuwanych kluczy. Ikony przez mały rejestr `StatusIcon.tsx` (nazwa→komponent Lucide).
**Lekcja:** Gdy „rozszerzalna lista" już ma konfigurację w polu JSON, dokładaj do tego JSON-a, nie nową tabelę. Przy poszerzaniu ścisłego unionu (`TaskStatus`→`string`) jedno miejsce psuje build kaskadą — zrób centralny resolwer (`statusMetaFor`) i przekazuj `config` w dół zamiast importować zaszyte stałe. I uważaj przy czyszczeniu importów ikon: usunięcie `Clock` z importu wywaliło build, bo był jeszcze użyty przy „szacowanym czasie" — sprawdź `grep -oE '<Ikona\b'` przed wycięciem.
## 2026-06-05 — „Widoki" → „Grupy projektów" wplecione w listę projektów (i @@map zamiast rename tabeli)
**Problem:** Zapisane „Widoki wielu projektów" działały, ale użytkownik myślał o tym jako o **grupach projektów** żyjących w samej liście projektów (grupa = folder, który rozwijasz i klikasz po wspólny widok), a osobna sekcja „Widoki" nie trafiała w tę intuicję. Trzeba było zmienić prezentację i nazwę pojęcia bez ryzykownej migracji już-wdrożonej (na `develop`) tabeli.
**Rozwiązanie:** Model danych został ten sam (wiele-do-wielu, `projectIds` JSON) — tylko przemianowany w kodzie `TaskView` → `ProjectGroup` przez Prisma **`@@map("TaskView")`**, więc tabela w DB się nie zmienia (zero ALTER TABLE RENAME, zero ryzyka na żywym środowisku); migracja dodaje jedynie kolumnę `color`. Sidebar przebudowany: grupy jako rozwijalne **foldery** nad listą projektów (chevron + stan rozwinięcia w localStorage `tasks.groups.expanded`), klik w grupę → wspólny widok `/tasks/multi?group=<id>`, a przy każdym projekcie dyskretny **znacznik przynależności** (kropki w kolorze grup, tooltip z nazwami) — widać obie strony relacji (grupa→projekty po rozwinięciu, projekt→grupy po kropkach). Reużyte wzorce: chevron z `TaskGroup`/`NoteGroupSection`, persist localStorage z `MealPlanWeek`/`NotesPage`, kolor grupy jak `NoteGroup.color`.
**Lekcja:** Gdy zmiana jest głównie **konceptualno-prezentacyjna** (zmiana nazwy encji, inny układ), a model danych zostaje — przemianuj w kodzie przez `@@map`, nie ruszaj nazwy tabeli (rename na wdrożonej DB to zbędne ryzyko). I projektując nawigację: jeśli użytkownik mówi „to ma być w liście X jako element Y", oddaj dokładnie tę strukturę (foldery w liście), zamiast trzymać to w osobnej sekcji — intuicja > elegancja osobnego panelu.

## 2026-06-04 — Widok wielu projektów: trwały + samoopisowy zamiast „na sesję"
**Problem:** Pierwsza wersja widoku wielu projektów trzymała wybór projektów tylko w URL (`?projects=a,b`) generowanym z trybu zaznaczania w sidebarze — czyli de facto „na sesję", bez możliwości zapisania i nazwania zestawu. Dodatkowo nagłówek pokazywał tylko „🗂 Wiele projektów (2)", więc użytkownik widział zadania, ale NIE wiedział, z których projektów pochodzą (a przy `groupBy=priority` z localStorage znikały też nagłówki grup per-projekt).
**Rozwiązanie:** Wprowadziłem trwały model `TaskView` (per-user, `projectIds` jako JSON string[]) + CRUD w `taskViews.ts`; sidebar dostał sekcję „Widoki" z inline edytorem (nazwa + emoji + checkboxy projektów) i hover edit/delete — wiele nazwanych widoków na stałe. Trasę `/tasks/multi` rozszerzyłem o `?view=<id>` (obok back-compat `?projects=`). Kluczowy fix UX: zawsze widoczny „pasek zakresu" pod nagłówkiem z chipami projektów (klik → pojedynczy projekt), niezależny od trybu grupowania — odpowiada na pytanie „z czego to jest" bez polegania na nagłówkach grup.
**Lekcja:** „Pokaż kilka X naraz" prawie zawsze znaczy też „zapisz ten zestaw" — rób od razu trwałą, nazwaną encję per-user (wzorzec JSON-string listy id jak `statusConfig`/`UserMenuPref`), nie stan w URL/sesji. I dla każdego widoku-agregatu dodawaj jawny, zawsze widoczny opis zakresu (chipy), bo grupowanie bywa przełączane i samo nie wystarcza.

## 2026-06-04 — Względny bump priorytetu zadań w asystencie (i backtick w template literalu)
**Problem:** Magiczna ikona przy „podnieś priorytet o 1 dla zadań X, Y, Z" musiała przez `update_task` ustawić bezwzględną wartość priorytetu — LLM zgadywał wspólny poziom i gubił to, że każde zadanie miało INNY priorytet wyjściowy (powinien wzrosnąć o 1 względem siebie). Przy okazji dodając opis akcji do katalogu w `agent/route.ts` wkleiłem `` `steps` `` z backtickami WEWNĄTRZ template literala (katalog akcji to jeden wielki backtick-string) → `next build` padał na „Syntax Error" w SWC bez czytelnego wskazania linii.
**Rozwiązanie:** Dodałem dedykowaną akcję `shift_task_priority { steps, taskId? }` analogiczną do `shift_task_due_date` — executor czyta obecny priorytet zadania i przesuwa go o `steps` po drabinie NONE<LOW<MEDIUM<HIGH<URGENT z klampem do zakresu. Dzięki temu LLM proponuje osobny shift per zadanie i nie musi znać/zgadywać wartości wyjściowych. Backticki w opisie zamieniłem na cudzysłowy.
**Lekcja:** Operacje „o N względem obecnego" rób jako osobny typ akcji liczony po stronie executora (jak shift due-date), nie każ LLM-owi liczyć delty na wartościach bezwzględnych. I NIGDY nie używaj backticków w stringach katalogu akcji — cały katalog to template literal, wewnętrzny backtick zamyka go i wywala build dopiero w SWC.

## 2026-06-04 — Lokalna weryfikacja buildu bez prod-DB i bez Prisma 7
**Problem:** `npm run build` kończy się `node scripts/migrate.js`, który robi `prisma migrate deploy` na PRAWDZIWEJ bazie (Neon) — nie wolno tego puszczać lokalnie. Do tego `datasource.provider = "postgresql"`, więc obiecywany w docsach SQLite (`file:./dev.db`) nie zadziała wprost z `db:push`. Dodatkowo `npx prisma generate` bez zainstalowanych `node_modules` ściąga Prisma 7, która odrzuca składnię `url`/`directUrl` ze schematu Prisma 5 (P1012).
**Rozwiązanie:** Najpierw `npm install` (postinstall sam odpala lokalną Prisma 5 `generate` i waliduje schemat). Do sprawdzenia kodu wystarczy podzbiór pipeline'u: `node scripts/check-action-coverage.js` + `npx next build` z dowolnymi (atrapowymi) `DATABASE_URL`/`DIRECT_URL`/`AUTH_SECRET` — strony są `force-dynamic`, więc build nie odpytuje bazy (błędy `UntrustedHost` przy prerenderze są nieszkodliwe). Pomijamy `migrate.js`.
**Lekcja:** „Sprawdź build" lokalnie = `next build`, nie pełne `npm run build` (które dotyka prod). Zawsze używaj lokalnej Prisma z `node_modules` (po `npm install`), nie globalnego `npx prisma`.

## 2026-06-04 — Generyczny harmonogram leków = jedna tabela z `kind` (MEDICATION|CARE)
**Problem:** Wymaganie „poddział leki + dawkowanie, ale na tej samej zasadzie zmiana opatrunku/paznokcie" mogło skusić do dwóch osobnych modeli albo do per-modułowego silnika cykliczności.
**Rozwiązanie:** Jeden model `MedicationSchedule` z polem `kind` i „płaską" cyklicznością (`freqType` DAILY/WEEKLY/HOURLY + `interval` + `daysOfWeek` CSV + `timesOfDay` JSON + okno `startDate/endDate`), rozwijaną do slotów przez czysty helper `src/lib/medicationSchedule.ts` (reużywa `habitStats`: `isoDate`/`parseDays`). Ten sam helper karmi agendę „na dziś", Kalendarz i read-tool AI — bez duplikacji logiki dni/godzin.
**Lekcja:** Gdy „dwie rzeczy działają na identycznej zasadzie", różnicuj je polem-dyskryminatorem, a logikę trzymaj w jednej czystej funkcji współdzielonej przez UI/serwer/AI. Dzień licz LOKALNIE ("YYYY-MM-DD") jak Nawyki, nie w UTC.

## 2026-06-04 — Polski cudzysłów „…" w stringu JS rozwala build (swc: „Expected unicode escape")
**Problem:** Dwukrotnie przy edycji promptów/tekstów wstawiłem `„tekst"` w środku stringa JS w podwójnych cudzysłowach (`"… „od czego zacząć".\n"`). Prosty `"` (U+0022) po polskim otwierającym `„` PRZEDWCZEŚNIE zamyka string, a dalszy `\n` daje błąd składni `Expected unicode escape`. swc wskazywał mylną linię (np. 9:1 albo środek innego stringa), co utrudniało namiar.
**Rozwiązanie:** W literałach JS używaj polskiego cudzysłowu zamykającego `”` (U+201D), nie prostego `"`: `„od czego zacząć”`. Alternatywnie escape `\"` albo backticki. Przy zagadkowym „Expected unicode escape"/„Syntax Error" w pliku z polskim tekstem szukaj prostego `"` wewnątrz `"…"`.
**Lekcja:** Polski tekst w stringach JS = pole minowe na proste cudzysłowy. Trzymaj się pary `„ … ”` (curly) w treści, a `"` rezerwuj na granice stringa. To powtórka — wpisane, by nie tracić czasu trzeci raz.

## 2026-06-04 — Rozrost asystenta: katalog akcji vs executor i odchudzanie promptu
**Problem:** „Magiczna ikona" ma ~90 akcji opisanych w wielkim stringu-katalogu (`agent/route.ts`) i wykonywanych łańcuchem `if` (`execute/route.ts`) — utrzymywane w dwóch miejscach, łatwo o rozjazd (agent proponuje akcję, której executor nie zna → „Nieznany typ akcji" w runtime). Dodatkowo cały katalog (~4k tokenów) leciał w KAŻDEJ iteracji pętli, podbijając koszt/latencję.
**Rozwiązanie:** (1) `scripts/check-action-coverage.js` w buildzie pilnuje, że każdy typ z katalogu ma obsługę w executorze (statycznie, bez DB). (2) Katalog rozbity per-moduł + tani router (op „dispatch") wybiera moduły istotne dla polecenia i wstrzykuje tylko ich sekcje. KLUCZOWE: router ma fallback do pełnego katalogu (błąd/pusto/≤3 moduły) i zawsze dorzuca moduł podstawowy — w najgorszym razie zachowanie = jak przed zmianą (zero regresji).
**Lekcja:** Gdy dwie powierzchnie (prompt-katalog i dispatcher) muszą być zgodne — dodaj tani guard w buildzie, nie licz na pamięć. Optymalizując prompt LLM przez „selekcję kontekstu", zawsze zostaw bezpieczny fallback do pełnego kontekstu, żeby błąd selekcji nie psuł funkcji, a jedynie nie dawał oszczędności.

---

## 2026-06-03 — Magiczna ikona pokazywała surowe id w parametrach akcji (tryb agenta)
**Problem:** Zgłoszenie dotyczyło starej (sprzed przebudowy) magicznej ikony: dodanie produktu do listy zakupów pokazywało akcję z parametrem `id`, który nic nie mówi użytkownikowi. Weryfikacja obecnej implementacji: tryb prosty (`interpret`→`execute`) jest czysty — prompt emituje wyłącznie nazwy (`listName`, `projectName`, `vehicleName`, …) + `searchQuery`, a backend rozwiązuje je na id. ALE tryb **agenta** (`/api/llm/home/agent`) wciąż mógł odtworzyć ten błąd: `ACTION_CATALOG` jawnie instruował model, by „CELOWAĆ w konkretne rekordy przez id z wyników (taskId/itemId/noteId/listId)", a te surowe cuid trafiały do `ActionDrawer` i były pokazywane użytkownikowi (read-only, ale wciąż nieczytelne).
**Rozwiązanie:** Nie tykamy backendu (resolvery id-first z fallbackiem po nazwie są zweryfikowane pod kątem bezpieczeństwa — id z klienta nigdy nie jest ufane, Server Action asertuje dostęp). Zamiast tego: (1) `ActionDrawer` w ogóle nie renderuje parametrów `*Id` — i tak przechodzą dalej do backendu dla precyzyjnego namiaru, więc nic nie tracimy, a użytkownik nie widzi śmieci; (2) prompt agenta każe dla każdej akcji celującej w istniejący rekord ZAWSZE wypełnić czytelny `searchQuery` (nazwa/tytuł) obok opcjonalnego id — to ten tekst widzi użytkownik. Precyzja namiaru zachowana, czytelność naprawiona.
**Lekcja:** Po przebudowie funkcji weryfikuj zgłoszenie na ŻYWYM kodzie, a nie na opisie sprzed zmiany — bug mógł przewędrować do innej ścieżki (tu: z trybu prostego do trybu agenta). Identyfikatory techniczne to detal backendu; trzymaj je z dala od warstwy prezentacji, zamiast pokazywać „read-only". Naprawiaj na najwęższej możliwej warstwie (UI + prompt), nie ruszając zweryfikowanej logiki dostępu.

---

## 2026-06-03 — Streaming odpowiedzi agenta przy protokole JSON-tool-loop (SSE)
**Problem:** Asystent (magiczna ikona) działa w pętli „LLM zwraca JSON ze `step` → wykonaj narzędzia → powtórz". Chcieliśmy strumieniować odpowiedź (UX jak w topowych asystentach), ale prawdziwy streaming tokenów koliduje z protokołem JSON — nie da się renderować częściowo sparsowanego obiektu `{ "step": "answer", "answer": "…ucięte" }`.
**Rozwiązanie:** Nie strumieniujemy tokenów finalnej odpowiedzi (to wymagałoby porzucenia JSON-a). Zamiast tego wydzieliliśmy pętlę do `runAgentLoop(messages, userId, onThought?)` i strumieniujemy **myśli pośrednie na żywo** przez SSE: każda iteracja, gdy jej JSON się sparsuje, woła `onThought(thought)`, a klient (czytnik `res.body.getReader()` + split po `\n\n`) pokazuje „Sprawdzam zadania… / Szukam w internecie…". Finalny wynik leci jako zdarzenie `{type:"final", body}`. Tryb nstrumieniowy to ta sama pętla z `body.stream=true` zwracająca `new Response(ReadableStream, {headers: text/event-stream})`; tryb zwykły (JSON) został nietknięty jako fallback. Klient degraduje do JSON, gdy `content-type` nie jest `event-stream` (np. proxy zbuforuje SSE).
**Lekcja:** Przy protokole JSON-tool-loop strumieniuj **postęp/rozumowanie**, nie tokeny finalnego pola — to daje 90% odczucia „na żywo" bez łamania parsowania. Zawsze zostaw nieblokujący fallback do trybu jednorazowego (JSON), bo SSE bywa buforowane przez warstwy pośrednie (Render). Jedna implementacja pętli, dwa opakowania (JSON / SSE) — zero duplikacji logiki.

---

## 2026-06-03 — Asystent-czat: lokalny build (SQLite vs Postgres) + higiena kontekstu
**Problem:** Przy rozbudowie „magicznej ikony" do pełnego czatu pojawiły się dwa wyboje. (1) `prisma db push` z `.env.local` (file:./dev.db) padał: `Environment variable not found: DIRECT_URL` oraz `Datasource db: PostgreSQL` — Prisma CLI czyta `.env` (nie `.env.local`), a datasource jest na sztywno `postgresql`, więc lokalnie nie da się ot tak pushnąć SQLite. (2) Pełna historia rozmowy wstrzykiwana do LLM w każdej turze grozi przepełnieniem okna kontekstu (Groq llama-3.3-70b ≈ 32k).
**Rozwiązanie:** (1) Do samego typecheck/buildu wystarczy `npx prisma generate` (nie łączy się z bazą) + atrapa `DATABASE_URL`/`DIRECT_URL` w `.env`. Schemat rozmów (`AiConversation`/`AiMessage`) wjeżdża na prod migracją Postgres (`0078_…`, idempotentną przez `DO $$ … EXCEPTION WHEN duplicate_object`), bo `migrate.js` z `npm run build` rusza dopiero po `next build`. Build weryfikujemy `npx next build` (bez kroku migrate na prod DB). (2) Do agenta przekazujemy tylko ostatnie `MAX_HISTORY_MESSAGES` tur (poziom wyświetlania), a nie surowy transkrypt narzędzi — historia żyje w DB, do modelu idzie przycięty kontekst.
**Lekcja:** `npm run build` w tym repo dotyka prod DB (migrate.js) — do lokalnej weryfikacji używaj `npx tsc --noEmit` + `npx next build`. Prisma CLI ≠ Next.js w kwestii plików env. Persystencję rozmowy trzymaj w bazie, ale do LLM zawsze wysyłaj przycięte, zwięzłe okno — nie cały transkrypt.

---

## 2026-06-03 — Mikrofon (dyktowanie) nie wyłącza się po zatwierdzeniu/wyjściu z pola
**Problem:** W `QuickNoteBar` i `NoteRow` przycisk mikrofonu żyje wewnątrz sekcji warunkowej (`expanded` / tryb edycji). Zatwierdzenie (zapis notatki), Anuluj i Escape zwijały/zamykały tę sekcję, ale **nie zatrzymywały obiektu `SpeechRecognition`** — nagrywanie leciało dalej, a przycisk Stop znikał z DOM. Użytkownik musiał ponownie wejść w to samo miejsce, włączyć i wyłączyć mikrofon, żeby go w końcu uciszyć. `SmartTextarea` nie zatrzymywał dyktowania przy Ctrl+Enter ani przy unmount.
**Rozwiązanie:** Dyktowanie zatrzymujemy w punkcie, w którym znika UI mikrofonu: `reset()` w `QuickNoteBar` woła `stopVoiceInput()`; w `NoteRow` `handleSave()` woła `stopVoiceInput()` + efekt `useEffect` zatrzymujący `recognition` gdy `isEditing` zejdzie na false (łapie Anuluj/Escape); `SmartTextarea` przy Ctrl+Enter najpierw `stopRecording()`. Dodatkowo każdy z komponentów ma efekt cleanup na unmount (`useEffect(() => () => recognitionRef.current?.stop(), [])`). W `NoteRow` zapisaliśmy też `recognitionRef.current = rec` w `startVoiceEdit`, żeby cleanup go obejmował.
**Lekcja:** Zasób imperatywny z własnym cyklem życia (Web Speech API, WebSocket, `setInterval`) nie znika razem z warunkowo renderowanym przyciskiem — trzeba go jawnie zatrzymać w każdej ścieżce wyjścia (submit/cancel/escape) ORAZ na unmount. Stan `isRecording` ≠ faktyczny stan silnika rozpoznawania; sterujemy realnym obiektem, nie tylko flagą UI.

---

## 2026-06-03 — Spread `Set` w strict mode (downlevelIteration) + niezależny dolny pasek
**Problem:** `[...new Set(arr)]` w `menuPrefs.ts` wywaliło `error TS2802` — przy ustawionym `target` < es2015 spread iterowalnych (Set/Map) wymaga `--downlevelIteration`. Osobny temat: dolny pasek mobilny współdzielił kolejność z menu (`enabled.slice(0,4)`), więc nie dało się go ułożyć niezależnie.
**Rozwiązanie:** Zamiast spreadu użyłem `Array.from(new Set(...))` (działa niezależnie od targetu). Dolny pasek dostał własne pole `MenuPrefs.tabBar` (JSON w `UserMenuPref.tabBar`) + helper `resolveTabBar`, niezależne od `order`/`disabled`.
**Lekcja:** W tym repo (strict, starszy target) deduplikuj przez `Array.from(new Set(...))`, nie przez `[...set]`. A gdy dwie powierzchnie (menu boczne vs dolny pasek) mają „przypadkiem" tę samą kolejność — to znak, że brakuje osobnego stanu; lepiej dać im niezależne preferencje niż wyprowadzać jedną z drugiej.
---

## 2026-06-03 — Asystent AI (magiczna ikona): agent obsługiwał tylko 4 z 9 modułów akcji
**Problem:** Główny przepływ magicznej ikony (`AICommandSheet`) korzysta WYŁĄCZNIE z `/api/llm/home/agent`, a ten miał `MODULES = ["shopping","tasks","notes","pets"]` i katalog akcji tylko dla tych modułów. Tymczasem `/api/llm/home/execute` od dawna potrafi wykonać też `habits`, `portfel`, `kitchen`, `flota`, `magazynowanie` (i taki sam komplet dokumentuje stara trasa `interpret`). Efekt: stojąc np. w `/portfel` i mówiąc „dodaj wydatek 50 zł" agent nie miał pojęcia o module portfel, a `normalizeActions` po cichu rzutowało nieznany moduł na `shopping`. Dodatkowo `deriveContextFromPath` rozpoznawało tylko 5 ścieżek — na `/portfel`, `/flota`, `/kitchen`, `/habits` asystent „nie wiedział, gdzie jest".
**Rozwiązanie:** Zrównano zasięg agenta z możliwościami `execute`: rozszerzono `MODULES`, dopisano sekcje katalogu akcji (habits/portfel/kitchen/flota/magazyn) i regułę wyboru modułu podstawowego (jak w `interpret`). Rozszerzono `deriveContextFromPath` o wszystkie moduły akcji (helper `ctx(primary)` ustawia bieżący moduł jako podstawowy, a resztę jako dodatkowe — polecenia międzymodułowe działają z każdego ekranu). Dodano pętlę korekty planu: agent zwraca teraz transkrypt także przy `step:"plan"`, a klient odsyła go z polem `refine`, by przeplanować całość bez zamykania przeglądu akcji.
**Lekcja:** Gdy istnieją dwie warstwy „rozumienia" (agent/interpret) i jedna „wykonania" (execute), ich zakresy MUSZĄ być trzymane w jednym źródle prawdy albo świadomie zsynchronizowane — inaczej warstwa wykonawcza cicho obsługuje akcje, których planista nigdy nie wyprodukuje. Przy dokładaniu modułu do `execute` zawsze sprawdź też katalog agenta, listę `MODULES`, `normalizeActions` i mapę kontekstu UI.

---

## 2026-06-03 — Magazynowanie 2.0: konflikt peer-deps @zxing i fałszywie „czysty" typecheck po cd
**Problem:** (1) `npm i @zxing/browser@latest @zxing/library@latest` padało na ERESOLVE — `@zxing/browser@0.2.0` wymaga peer `@zxing/library@^0.22.0`, a `@latest` to 0.23.0. (2) Po serii `git commit` uruchamianych z `cd /home/user/home && …` katalog roboczy powłoki Bash został w `/home/user/home`, więc kolejne `npx tsc --noEmit -p tsconfig.json` zwracało „path does not exist: tsconfig.json" — a `grep` po tym pustym wyjściu pokazywał 0 błędów, czyli FAŁSZYWIE „czysto".
**Rozwiązanie:** (1) Przypięto zgodne wersje: `@zxing/browser@0.2.0` + `@zxing/library@0.22.0` (peer spełniony, bez `--legacy-peer-deps`). (2) Każdą komendę typecheck/build poprzedzam jawnym `cd /home/user/home/worldofmag` i liczę błędy przez `grep -c "error TS"`.
**Lekcja:** Przy parach paczek z `peerDependencies` (jak @zxing/browser↔library) NIE używaj `@latest` na obu — przypnij wersje spełniające peer. I pamiętaj, że `cwd` powłoki Bash bywa „lepki" między wywołaniami: jeśli wynik narzędzia zależy od katalogu (tsc z `-p`), zawsze ustaw `cd` w tej samej komendzie, bo inaczej puste/błędne wyjście udaje sukces.

---

## 2026-06-02 — Ikona kalendarza/zegara niewidoczna w trybie ciemnym (pola date/time)
**Problem:** Natywne pola `input[type="date"|"datetime-local"|"time"]` renderowały wbudowaną ikonę pickera (kalendarz/zegar) w prawie czarnym kolorze, więc na ciemnym tle motywu była praktycznie niewidoczna.
**Rozwiązanie:** Najpierw ustawiłem `color-scheme: dark` + `filter: invert(1)` na `::-webkit-calendar-picker-indicator` — ale to NIE zadziałało: `color-scheme: dark` już renderuje ikonę na biało, a `invert(1)` zamieniał ją z powrotem na czarno (dwie poprawki znosiły się nawzajem). Ostateczny fix: zostawiam `color-scheme: dark`, usuwam invert i podmieniam ikonę na własny jasny SVG (`background-image` z `stroke=%23e8e8e8`) — osobny kalendarz dla date/datetime/month/week i zegar dla time. Deterministyczne, niezależne od tego jak przeglądarka traktuje color-scheme.
**Lekcja:** Nie łącz `color-scheme: dark` z `filter: invert()` na tej samej ikonie pickera — color-scheme już ją rozjaśnia, więc invert ją z powrotem zaciemnia. Gdy chcesz pewny, jednolity wygląd ikony date/time w dark mode, podmień ją własnym jasnym SVG przez `background-image` na `::-webkit-calendar-picker-indicator`, zamiast polegać na inwersji koloru bazowego.

## 2026-06-02 — Zadania cykliczne: kolejne wystąpienie tylko z panelu, nie z listy
**Problem:** Logika „oznacz cykliczne jako zrobione → utwórz kolejne wystąpienie" (`completeRecurringTask`) była wpięta tylko w panel szczegółów (`TaskDetail.handleStatusChange`). Oznaczenie zrobione z listy (checkbox / skrót `x`/spacja) szło przez `toggleTaskStatus` → `updateTask`, więc cyklicznie zadanie po prostu zmieniało status i NIE powstawało następne. Dodatkowo nowe wystąpienie nie kopiowało tagów ani `startDate`.
**Rozwiązanie:** W `toggleTaskStatus` przy wejściu w `DONE` dla zadania z `recurring` deleguję do `completeRecurringTask` (jedna ścieżka prawdy). `completeRecurringTask` kopiuje teraz tagi i przesuwa `startDate` o tę samą różnicę co termin (zachowane wyprzedzenie). Dodałem `RecurringRule.anchor` (`DUE`|`COMPLETION`) + selektor w UI — następny termin liczony od terminu albo od daty wykonania.
**Lekcja:** Gdy jakieś zachowanie ma „specjalną" logikę (np. cykliczność przy DONE), upewnij się, że WSZYSTKIE ścieżki UI prowadzące do tego stanu przez nią przechodzą (panel + lista + skrót), a nie tylko jedna. Najlepiej skupić to w jednej funkcji domenowej i z niej korzystać wszędzie.

## 2026-06-02 — Akcje chowane pod `hover` są niedostępne na dotyku (mobile)
**Problem:** Usuwanie/zmiana nazwy projektu istniały tylko w bocznym menu (`TasksSideNav`), gdzie przyciski pokazują się dopiero `onMouseEnter` (hover). Na telefonie nie ma hovera, a sub-nav zadań w mobilnym menu i tak zwracał `null` — więc tych akcji NIE dało się wykonać na mobile.
**Rozwiązanie:** Dodałem `ProjectActionsMenu` (zwykły przycisk „⋮" + menu, zamykane klikiem w tło) w nagłówku listy zadań — działa identycznie myszą i dotykiem. Do przenoszenia (projekt zadania, lista produktu) użyłem natywnych `<select>` — natywny picker OS to najlepszy UX na mobile.
**Lekcja:** Każda akcja ukryta pod `hover` to potencjalnie funkcja niedostępna na mobile. Krytyczne akcje dawaj jako trwale widoczne przyciski/menu (klik, nie hover) i sprawdzaj, czy mobilna ścieżka (sub-nav/menu) w ogóle je renderuje.

## 2026-06-02 — Komunikat usuwania projektu kłamał o kasowaniu zadań
**Problem:** `TasksSideNav` pokazywał `confirm("Usunąć projekt i wszystkie zadania?")`, ale relacja `Task.projectId` ma `onDelete: SetNull` — zadania NIE są kasowane, tylko tracą przypisanie (i nadal są widoczne w „Wszystkie", bo `getAllUserTasks` zwraca też `createdById = user`). Komunikat straszył utratą danych, której nie było.
**Rozwiązanie:** Doprecyzowałem ostrzeżenie (liczba zadań + „nie zostaną usunięte, stracą przypisanie, pozostaną w «Wszystkie»"), dodałem ochronę przed usunięciem Skrzynki (`isInbox`) po stronie akcji i obsługę błędu w UI. Przy okazji: `updateTask` przepuszczał zmianę `projectId` bez sprawdzenia dostępu do celu — dodałem `assertProjectAccess(patch.projectId)`.
**Lekcja:** Treść `confirm`/ostrzeżenia musi odpowiadać realnej semantyce relacji w schemacie (`SetNull` ≠ `Cascade`). Gdy dodajesz UI zmieniające FK (np. przeniesienie do innego projektu/listy), w akcji sprawdź dostęp zarówno do źródła, jak i do celu, oraz rewaliduj obie ścieżki.

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

## 2026-06-01 — Nowe strony nie scrollują się na telefonie (brak własnego kontenera scrolla)
**Problem:** W modułach Wiadomości i Pogoda nie dało się przewijać palcem w pionie na telefonie (w innych działach działało). Strony miały root `<div className="mx-auto max-w-6xl px-4 py-6">` bez własnego kontenera przewijania.
**Rozwiązanie:** `AppShell` ustawia `<main>` jako `overflow-hidden` i deleguje scroll do każdej strony — wzorcowy kontener to `pageContainerStyle` (`flex:1; overflowY:auto`). Owinięto treść obu stron w `<div className="flex-1 overflow-y-auto">` (zewnętrzny scroll) + wewnętrzny `mx-auto max-w-*` (centrowanie). Bez tego treść była przycinana przez `overflow-hidden` na `<main>`.
**Lekcja:** W tym repo `<main>` nie scrolluje — KAŻDA strona modułu musi mieć własny kontener `flex-1 overflow-y-auto` (albo użyć `pageContainerStyle` z `@/components/ui/home`). Tworząc nowy moduł, nie zaczynaj od gołego `mx-auto max-w-*` — to działa na desktopie tylko gdy treść się mieści, a na mobile od razu blokuje przewijanie.

## 2026-06-02 — Wiadomości: „brak nowych" zamiast inicjalizacji bazy wiedzy (ciche fail bootstrapu)
**Problem:** Użytkownik zawsze dostawał „Brak nowych istotnych wiadomości" — nawet dla tematu bez bazy wiedzy, gdzie powinna ruszyć inicjalizacja „jak Wikipedia". Przyczyna: `bootstrapKnowledge` zwracało `false`, gdy nie udało się pobrać ŻADNEGO materiału (feedy RSS bywają błędne, a fallback DuckDuckGo jest blokowany z IP serwerowni Render bez klucza Brave). `refreshTopic` przy `bootstrapped===0` pokazywał generyczny komunikat. Efekt: baza nigdy się nie inicjalizowała, moduł sprawiał wrażenie „martwego".
**Rozwiązanie:** (1) Inicjalizacja zawsze tworzy wersję 1 — gdy są materiały, opiera się na nich; gdy ich brak, LLM pisze obszerną wersję wstępną z wiedzy ogólnej z adnotacją „do weryfikacji". (2) Czytelny błąd, gdy LLM nieskonfigurowany (`LlmError` z `status===503` → komunikat „ustaw model w Admin → LLM"), zamiast cichego „brak nowych". (3) Pozbyto się okna 24h na rzecz znacznika `lastPublishedAt` (najnowsza data publikacji w bazie) — pobieramy tylko nowsze. (4) Zatwierdzenie wiadomości DOPISUJE datowaną sekcję (data publikacji w mediach), nie przepisuje treści.
**Lekcja:** Funkcja, od której zależy „czy w ogóle coś się stanie", nie może po cichu zwracać `false` na każdej ścieżce błędu — rozróżniaj „brak wyników" od „nie dało się wykonać" i albo zawsze dostarcz wynik minimalny (degrade), albo zgłoś czytelny błąd. Generyczny komunikat „brak nowych" maskował trzy różne realne awarie (zły RSS, zablokowany DDG, brak LLM).

---

## 2026-06-03 — Zmiany z jednego urządzenia niewidoczne na innym bez twardego refresh (PWA iOS)
**Problem:** Dane dodane/zmienione/usunięte na urządzeniu A nie pojawiały się na urządzeniu B (ani w drugiej karcie) dopóki użytkownik nie zrobił pełnego przeładowania strony. Przełączenie modułu z menu i powrót też nie odświeżało. Najgorzej w PWA wyciągniętym na ekran główny iPhone'a (Safari standalone) — nie ma paska przeglądarki ani przycisku odświeżania, więc trzeba było ubić całą aplikację. Przyczyny: (1) Server Actions + `revalidatePath()` odświeżają dane TYLKO dla klienta, który wykonał mutację — inne urządzenia nie są powiadamiane; (2) Router Cache Next.js serwuje zcache'owany payload RSC przy nawigacji w obrębie aplikacji.
**Rozwiązanie:** Globalny komponent kliencki `DataFreshness` (montowany raz w `AppShell`) woła `router.refresh()` przy powrocie do aplikacji (`visibilitychange`→visible, `focus`, `pageshow`) oraz cyklicznie co 45 s, ale tylko gdy karta jest widoczna. Throttle `MIN_GAP_MS` 3 s eliminuje podwójny refresh gdy `focus` i `visibilitychange` strzelają naraz; pełny cleanup listenerów + `clearInterval` na unmount. Dodatkowo `experimental.staleTimes: { dynamic: 0 }` w `next.config.mjs` wyłącza ponowne użycie Router Cache dla stron dynamicznych → nawigacja w aplikacji zawsze pobiera świeże dane. Realtime (SSE/WebSocket) świadomie odrzucone — nie współgra z Render free tier (usypianie po 15 min, limity połączeń).
**Lekcja:** W Next.js App Router `revalidatePath()` to NIE jest synchronizacja między urządzeniami — odświeża wyłącznie sesję, która wykonała mutację. Cross-device świeżość bez infrastruktury realtime osiąga się przez `router.refresh()` na zdarzeniach powrotu do aplikacji + lekki polling, a staleności nawigacji w obrębie SPA pozbywa się `staleTimes`. W PWA standalone na iOS NIE MA ręcznego odświeżania — `visibilitychange` jest tam jedynym pewnym haczykiem na „wróciłem do appki, daj świeże dane".

---

## 2026-06-10 — `npx next build` z roota repo: cwd resetuje się między turami + zabłąkane `.next/`
**Problem:** W trakcie sesji `Bash` zwracał cwd `/home/user/home` (root repo), choć wcześniej budowałem z `worldofmag/`. Odpalenie `npx next build` z roota dało „Couldn't find any `pages` or `app` directory" i — co gorsza — npm zaczął ŚCIĄGAĆ `next@16` (bo w roocie nie ma node_modules), a sam start builda zdążył utworzyć `.next/trace`+`.next/trace-build` w roocie. Repo-root `.gitignore` NIE ignorował `.next/` (tylko `worldofmag/.gitignore` to robi), więc `git add -A` wciągnął te artefakty do commita i poszły na `develop`.
**Rozwiązanie:** (1) Każdą komendę zależną od katalogu pisz z jawnym `cd /home/user/home/worldofmag && …` w tej samej linii — cwd Basha potrafi się zresetować między wywołaniami (szczególnie po `git checkout` gałęzi). (2) Usunięto artefakty `git rm -r --cached .next` + dodano `.next/` do **root** `.gitignore`. (3) Przed `git add -A` sprawdzaj `git status --short`, czy nie ma śmieci spoza `worldofmag/`.
**Lekcja:** Nie zakładaj, że cwd Basha trzyma się między turami — prefiksuj `cd <abs-path> &&`. Polecenia narzędziowe (`next`, `prisma`) odpalaj wyłącznie z `worldofmag/`, nigdy z roota (root nie ma node_modules → npm próbuje pobrać pakiet z sieci, co i tak jest blokowane). I pamiętaj, że root repo ma osobny, ubogi `.gitignore` — artefakty buildu spoza `worldofmag/` nie są tam ignorowane.

## 2026-06-10 — Lokalny Postgres (weryfikacja buildu) bywa „down" po czasie — trzeba go wznowić
**Problem:** `npm run build` (pełny, z `scripts/migrate.js`) zaczął padać `P1001: Can't reach database server at 127.0.0.1:5432` mimo że wcześniej w sesji działał. Kontener uśpił/zrestartował klaster Postgresa (był `down` wg `pg_lsclusters`), a do tego zostawił stale pid file.
**Rozwiązanie:** `sudo pg_ctlcluster 16 main start` (sam komunikat „Removed stale pid file" jest nieszkodliwy) → klaster `online` → build przechodzi. `next build` (sam kompilator+typy) NIE potrzebuje DB i przechodzi nawet gdy Postgres leży — DB jest potrzebna dopiero w kroku `migrate deploy` pełnego `npm run build`.
**Lekcja:** W zdalnym sandboxie lokalny Postgres do weryfikacji buildu nie jest trwały — jak `migrate.js` zacznie zgłaszać P1001, najpierw `pg_lsclusters` i ewentualnie `pg_ctlcluster 16 main start`, dopiero potem panikuj. Do szybkiej iteracji nad kodem wystarcza `npx next build` (bez DB); pełny `npm run build` rób przed mergem, gdy DB stoi.

## 2026-06-10 — A2: szyfrowanie kluczy API zalezy od stalego AUTH_SECRET/CONFIG_SECRET
**Problem:** Wdrazajac szyfrowanie sekretow w spoczynku (AES-256-GCM, klucz wyprowadzony z env
`CONFIG_SECRET`||`AUTH_SECRET`), latwo przeoczyc, ze ZMIANA tego env-sekretu czyni wszystkie
zaszyfrowane klucze nieodszyfrowywalnymi (deszyfracja zwraca pusty string → „LLM nie skonfigurowany").
**Rozwiazanie:** `decryptSecret` jest wstecznie kompatybilne (wartosci bez prefiksu `enc:v1:` =
plaintext, zwracane bez zmian), wiec stare klucze dzialaja do pierwszego ponownego zapisu (ktory je
szyfruje). Przy zlym kluczu deszyfracja zwraca "" (nie rzuca), wiec system degraduje sie lagodnie, a
nie crashuje. WAZNE operacyjnie: `AUTH_SECRET` na Render musi byc STALY — jego rotacja wymaga
ponownego wpisania wszystkich kluczy API w panelu admina.
**Lekcja:** Szyfrowanie „at rest" wiaze dane z kluczem z env — udokumentuj to i nigdy nie rotuj
`AUTH_SECRET` bez planu ponownego wprowadzenia sekretow. Funkcje deszyfrujace rob tolerancyjne
(plaintext-passthrough + brak wyjatku na zlym kluczu), by migracja byla bezszwowa, a awaria miekka.

## 2026-06-10 — Pusta migracja zapisana jako „applied" → potem nie da sie dodac tresci
**Problem:** Przez reset cwd Basha `mkdir`+`cat > migration.sql` trafilo do ZLEJ sciezki (root repo),
a w `worldofmag/prisma/migrations/0161.../migration.sql` powstal PUSTY plik. `prisma migrate deploy`
zastosowal pusta migracje (no-op) i zapisal ja w `_prisma_migrations` jako applied. Gdy pozniej
dopisalem prawidlowy SQL do tego pliku, kolejny `migrate deploy` (w `npm run build`) probowal go
uruchomic → kolizja (CREATE TABLE na istniejacej tabeli / checksum mismatch) → FAILED record blokujacy
build.
**Rozwiazanie:** (1) tabele utworzylem recznie `psql -f migration.sql`; (2) pogodzilem stan migracji:
`prisma migrate resolve --rolled-back 0161_...` a potem `--applied 0161_...` (skoro tabela juz
istnieje, nie chcemy jej uruchamiac ponownie). Build przeszedl. Na prodzie migracja zastosuje sie
swiezo z prawidlowa trescia — problem byl wylacznie lokalnym artefaktem.
**Lekcja:** ZAWSZE twórz migracje z `cd .../worldofmag &&` w tej samej linii i OD RAZU wypełnij SQL —
nigdy nie zostawiaj pustego `migration.sql`, bo Prisma zapisze go jako applied i nie pozwoli go pozniej
„dopelnic". Jak juz sie stanie: `migrate resolve --rolled-back` → `--applied` (gdy schemat zgadza sie
recznie) zamiast walczyc z `migrate deploy`.

## 2026-06-13 — Drive OAuth: osobny flow zamiast scope w głównym loginie + redirect_uri/refresh_token
**Problem:** Integracja Dysku Google wymagała serwerowego zapisu plików (drive.file), ale sam „link z prawem do edycji" nie działa serwerowo (Drive API wymaga OAuth/konta serwisowego). Kuszące było dorzucenie scope Drive do istniejącego Google providera NextAuth — to jednak wymusiłoby zgodę na Drive u KAŻDEGO usera przy logowaniu, a `auth.config.ts` jest edge-safe i współdzielony z middleware (Drive client nie wejdzie tam czysto). Dodatkowo łatwo zapomnieć, że refresh_token Google zwraca tylko przy `access_type=offline` + `prompt=consent`, a callback bez zarejestrowanego redirect_uri zwraca `redirect_uri_mismatch`.
**Rozwiązanie:** Osobny, opcjonalny flow OAuth (`/api/drive/connect` → consent → `/api/drive/callback`) uruchamiany przyciskiem w Ustawieniach, niezależny od NextAuth; tokeny per-user w `DriveConnection`, automatyczny refresh. Upload zwraca URL do proxy (`/api/drive/file/<id>`) wstawiany w istniejące pola string — zero zmian schematu modułów. redirect_uri budowany z origin żądania (działa na localhost i prod), `state` w cookie httpOnly chroni przed CSRF.
**Lekcja:** Incremental authorization (osobny przycisk „Połącz") jest czystsze niż rozszerzanie scope głównego loginu, gdy nowe uprawnienie jest opcjonalne i nie każdy go potrzebuje — nie ruszasz krytycznej ścieżki auth ani middleware. Przy Google OAuth pamiętaj o trójce: `access_type=offline` + `prompt=consent` (żeby dostać refresh_token) oraz zarejestrowany redirect_uri w Cloud Console (inaczej `redirect_uri_mismatch`). Lokalnie `prisma` CLI czyta `.env`, a Next `.env.local` — i globalny `npx prisma` może być nowszej majora niż projekt (użyj `./node_modules/.bin/prisma`).

---

## 2026-06-13 — `force-static` na stronie pod AppShell → puste menu (sidebar bez sesji)
**Problem:** Klik „Jak używać?" w Mapach sklepów prowadził na `/shopping/stores/guide`, po czym menu boczne pokazywało tylko kilka pozycji (Reports itd.), a strona robiła się „czarna". Przyczyna: ta strona miała `export const dynamic = "force-static"` (jedyna taka w `src/app`). Prerender na etapie buildu odbywa się BEZ sesji, więc `AppShell`/`ModuleSidebar` renderowały się z pustą listą uprawnień → blokowały wszystkie pozycje wymagające `module.*`, zostawały tylko te bez wymogu permission.
**Rozwiązanie:** usunięcie `export const dynamic = "force-static"` — strona stała się dynamiczna (jak reszta aplikacji), więc ma dostęp do sesji i pełnego menu. Treść strony i tak była statyczna, nic nie stracono. W build output trasa zmienia się z `○ (Static)` na `ƒ (Dynamic)`.
**Lekcja:** W App Routerze layout (`AppShell`) zależny od `auth()`/sesji NIE współgra z `force-static` na stronie potomnej — statyczny prerender „zamraża" widok bez użytkownika, co psuje wszystko, co zależy od uprawnień (sidebar, gating). Stron renderowanych pod uwierzytelnionym shellem nie oznaczaj `force-static`; jeśli chcesz cache, rozważ ISR/segmentowe opcje, ale nie pełną statykę. Szybki wykrywacz: `grep -rn force-static src/app`.

---

## 2026-06-14 — Widok „Dziś" w Zadaniach: doba liczona w strefie serwera (UTC) vs daty zapisywane niespójnie
**Problem:** Zadanie przesunięte o JEDEN dzień w przyszłość nadal pokazywało się na liście „Dziś" (przesunięte o kilka dni — znikało poprawnie). `getTodayTasks`/`getOverdueTasks` oraz liczniki na `/tasks` liczyły granice doby przez `new Date(); setHours(0/23…)`, czyli w strefie **serwera** (Render = UTC). Tymczasem daty `dueDate` zapisywane były jako instanty UTC niespójnie: `TaskRow` używał lokalnego południa (`+"T12:00:00"`), ale `TaskDetail`/`QuickAddTask`/`AITaskInput` robiły `new Date("YYYY-MM-DD")` = **UTC-północ**. Dla użytkownika w UTC+2 instant „jutra" potrafił wpaść w UTC-owe okno „dziś", a tylko granica +1 dnia jest na to wrażliwa (kilka dni = daleko od granicy).
**Rozwiązanie:** Granice doby liczone w strefie **użytkownika**: helper `src/lib/userTime.ts` (`userDayBounds`/`userTomorrowStart`) zwraca instanty UTC odpowiadające lokalnej północy/23:59:59.999, na podstawie ciasteczka `tz` (IANA z `Intl.DateTimeFormat().resolvedOptions().timeZone`, ustawiane raz w `AppShell`; fallback `Europe/Warsaw`). Offset strefy z `Intl.DateTimeFormat(..., {timeZone}).formatToParts` (poprawnie wokół DST). Dodatkowo znormalizowano zapis wybranego dnia do lokalnego południa wszędzie (jak w `TaskRow`), by instant jednoznacznie należał do doby użytkownika.
**Lekcja:** Nigdy nie mieszaj „dnia liczonego w strefie serwera" z instantami UTC zapisywanymi w strefie klienta — `setHours` na serwerze (UTC) to cicha pułapka dla widoków „dziś/jutro". Albo licz granice doby w strefie użytkownika (cookie `tz` + `Intl`), albo trzymaj daty „dniowe" jako stały punkt (np. lokalne południe) i porównuj po dniu. Objaw „błąd tylko przy przesunięciu o 1 dzień, przy kilku dniach OK" to klasyczny sygnał problemu z granicą doby/strefą, nie z logiką filtra.

---

## 2026-07-15 — Spec-driven pipeline: jeden moment pytań + automatyczne przechodzenie między etapami
**Problem:** Pipeline (`/specify /plan /tasks /implement /verify /review`) wymagał od właściciela ręcznego
wpisywania kolejnych komend, a pytania (`AskUserQuestion`) mogły paść na każdym etapie — rozproszone,
uciążliwe. Dodatkowo przycisk „kopiuj prompt dla Claude Code" w Zadaniach kopiował **stary** prompt
(analizuj+implementuj+raport, z nieaktualnym `db:push (dev SQLite)`), zamiast uruchamiać pipeline.
**Rozwiązanie:** (1) Konfrontacja z oficjalnymi źródłami — struktura komend/agentów (`.claude/commands/*.md`
z frontmatterem `description`/`argument-hint`, `.claude/agents/*.md` z `name`/`description`/`tools`) jest
zgodna z dokumentacją Claude Code; metodyka wzorowana na **GitHub Spec Kit** (`/specify→/plan→/tasks→
/implement`), a nasze `/verify` i `/review` to dodatkowe bramki, zaś Spec-Kitowy `/clarify` **zwinęliśmy do
jednego momentu pytań w `/specify`**. (2) `/specify` zbiera **wszystkie** decyzje w JEDNYM `AskUserQuestion`
(opcja rekomendowana zawsze **pierwsza** + etykieta `(zalecane)`), po czym **sam** woła kolejny etap przez
narzędzie **Skill** (`plan`→`tasks`→`implement`→`verify`→`review`); każdy etap kończy się auto-przejściem,
a `/verify`/`/review` przy brakach zawracają do `/implement`. Etapy pośrednie mają zakaz zadawania pytań —
wybierają rekomendowany domyślny i jadą dalej, zatrzymanie tylko przy realnym ryzyku nieodwracalnej szkody.
(3) `OMNIA_LLM_PROMPT` w `src/lib/omniaClipboard.ts` przepisany: wklejony do Claude Code instruuje
uruchomienie `/specify` z tytułami/opisami zadań jako zakresem funkcji. Przewodnik (`.claude/spec-pipeline/
README.md`) + strona `/admin/spec-pipeline` opisują nowy model; po edycji README trzeba **przegenerować**
`src/generated/spec-pipeline.ts` (`node scripts/copy-spec-pipeline.js`), bo `dev` czyta wersję commitowaną.
**Lekcja:** Auto-przechodzenie między komendami w Claude Code robi się tak, że komenda na końcu **wywołuje
skill następnej** (komendy z `.claude/commands/*.md` są też widoczne jako skille) — nie licz na to, że model
„sam się domyśli". Żeby pytania padały raz: skoncentruj `AskUserQuestion` w pierwszej komendzie i w kolejnych
jawnie zabroń pytań (Szymon prawie zawsze bierze opcję rekomendowaną — dawaj ją pierwszą i oznaczaj
`(zalecane)`). I pamiętaj o regeneracji `src/generated/*.ts` po każdej zmianie źródła przewodnika.

---

## 2026-07-15 — Spec-driven pipeline: spójność artefaktów (C-54) + furtka pytań (C-55)
**Problem:** Po pierwszej iteracji pipeline miał dwie luki: (1) etapy pośrednie miały **twardy zakaz
pytań** (wyjątek tylko „utrata danych"), więc przy naprawdę ważnej, nieprzewidzianej decyzji na późnym
etapie pipeline **zgadywał** zamiast spytać; (2) „zawracanie" przy nowych ustaleniach nie było
jednolitą regułą — nie było jasne, że gdy implementacja/plan wykryje błąd we wcześniejszym artefakcie,
trzeba **poprawić ten artefakt** (spec/plan), a nie obejść problem w kodzie.
**Rozwiązanie:** Dodano dwie reguły do `constitution.md` (sekcja G): **C-54 — spójność artefaktów i
zawracanie** (`spec.md → plan.md → tasks.md → kod` to łańcuch prawdy; etap, który wykryje błąd wyżej,
aktualizuje ten plik i przelicza w dół; pętle `/verify`→`/implement`, `/review`→`/implement` wbudowane)
oraz **C-55 — jeden moment pytań z wąską furtką** (pytania skoncentrowane w `/specify`; dalej autonomia,
ale wolno zadać JEDNO zbiorcze pytanie, gdy decyzja jest jednocześnie: istotna, nieprzewidziana na
starcie, kosztowna przy złym wyborze i nierozstrzygalna z artefaktów/kodu). Każda komenda odwołuje się
do C-54/C-55 zamiast powtarzać prozę; przewodnik (README) i strona `/admin/spec-pipeline` opisują
„trzy zasady UX" (jeden moment pytań z furtką / auto-przejścia z zawracaniem / spójność artefaktów).
Subagent `omnia-implementer` (nie ma jak wołać `AskUserQuestion`) **oddaje** furtkową decyzję wołającemu.
**Lekcja:** W autonomicznym pipeline nie stawiaj „nigdy nie pytaj" — to zmusza model do zgadywania.
Lepszy jest **wysoki próg z furtką**: domyślnie autonomia + rekomendowany domyślny, ale jawnie
dozwolone jedno zbiorcze pytanie przy naprawdę ważnej, niejednoznacznej decyzji. I zawsze trzymaj
**spójność artefaktów** — nowe ustalenie na późnym etapie ma wracać do właściwego pliku (spec/plan),
inaczej zostaje rozjazd „kod robi X, spec mówi Y". Reguły przebiegu warto trzymać w konstytucji
(numerowane), by komendy tylko się do nich odwoływały. Po edycji README pamiętaj o
`node scripts/copy-spec-pipeline.js` (regeneracja `src/generated/spec-pipeline.ts`).

---

## 2026-07-15 — Spec pipeline: /review bez ręcznego approve + obowiązkowe pytanie o merge do master
**Problem:** Właściciel chciał, by `/review` przechodził automatycznie (sam wystawiał werdykt, bez jego
approve — jak reszta etapów), a cały pipeline **zawsze** kończył się jednym pytaniem
„Mistrzu Magu, czy zrobić merge develop do master?" (promocja na produkcję).
**Rozwiązanie:** `/review` wystawia werdykt sam; po APPROVE robi merge do `develop` (standing
authorization, bez pytania), a na sam koniec zadaje **jedno** `AskUserQuestion` o promocję `develop →
master` z opcją „Nie — zostaw na develop" jako rekomendowaną pierwszą (`master` = produkcja, C-52). Na
„Tak" pipeline robi `checkout master` → `merge --no-ff develop` → `push` (jedyny moment dotknięcia
`master`). W konstytucji: C-52 rozszerzone o obowiązkowe pytanie domykające, a C-55 dostał „wyjątek
sankcjonowany" — to pytanie jest zawsze zadawane i nie łamie zasady „jednego momentu pytań".
Przy okazji: dodane w JSX zdanie w cudzysłowach drukarskich („…") łapało warning
`react/no-unescaped-entities` — rozwiązane przez wrzucenie tekstu w wyrażenie-string `{"…"}` (nie dokłada
do puli ~64 kosmetycznych warningów, które i tak są na roadmapie do sprzątnięcia).
**Lekcja:** W autonomicznym pipeline „approve" na końcu ma wystawiać sam recenzent — approve właściciela
to tylko **bramka produkcyjna** (`develop → master`), i tę robimy jednym, zawsze-zadawanym pytaniem z
bezpiecznym domyślnym „Nie". Cudzysłowy drukarskie w tekście JSX pakuj w `{"…"}`, żeby nie budzić
`react/no-unescaped-entities`.

## 2026-07-20 — Iteracja po `Set` w Server Action wywala `next build` (downlevelIteration)
**Problem:** Nowa akcja `bulkUpdateTasks` używała `for (const pid of affectedProjectIds)` po `Set<string>`.
`next build` (typecheck) padał: „Type 'Set<string>' can only be iterated through when using the
'--downlevelIteration' flag or with a '--target' of 'es2015' or higher" — tsconfig projektu ma niższy
target/brak downlevelIteration.
**Rozwiązanie:** Zamiana na `Array.from(set).forEach(...)`. `lint` tego nie łapie — wychodzi dopiero na
kroku „Checking validity of types" w `next build`.
**Lekcja:** W kodzie `src/` nie iteruj `Set`/`Map` przez `for...of` ani span spreadem w gorących
miejscach — używaj `Array.from(...)`. Realny typecheck daje dopiero `next build`, nie sam `lint`.

## 2026-07-25 — Ucinany w połowie JSON wyników narzędzi wpędzał agenta w pętlę powtórek
**Problem:** Bezpiecznik znakowy bloku wyników narzędzi (`compactToolResults`) ucinał serializowany
JSON w POŁOWIE, gdy pojedyncze pole (np. opis zadania będący zgłoszeniem błędu ze zrzutem rozmowy)
było ogromne. Model dostawał niedomknięty JSON, nie rozumiał wyniku i ponawiał to samo `get_task`
aż do wyczerpania limitu kroków („Nie udało się dokończyć w limicie kroków"). Osobno: pojedyncza
niesforna odpowiedź modelu (proza wokół JSON, trailing comma) kończyła całą turę błędem
„LLM zwrócił nieprawidłowy format" (502).
**Rozwiązanie:** (1) Skracanie długich pól PER-POLE (`trimLongStrings`, marker „SKRÓCONO z N znaków
— pełna treść: get_task/get_note po id") — blok zawsze pozostaje poprawnym JSON-em; bezpiecznik
blokowy zostaje tylko jako ostateczność. (2) Deduplikacja wywołań narzędzi w obrębie tury (mapa
tool+args → wynik + marker POWTÓRKA). (3) Tolerancyjne parsowanie odpowiedzi protokołu
(`extractJsonLoose`: płotki, zbalansowany blok `{…}` w prozie, trailing commas) + 3 próby naprawy
z przyczyną błędu, a po nich degradacja do zwykłego kroku `answer` (`salvageAnswerText`) zamiast 502.
**Lekcja:** Limity znakowe stosuj na poziomie PÓL, nie na serializowanym JSON-ie — ucięty JSON to
dla modelu szum, który generuje kosztowne pętle. Odpowiedzi LLM parsuj tolerancyjnie i zawsze miej
ścieżkę degradacji do tekstu: użytkownik ma dostać treść, nie kod błędu. Powtórzone wywołania
narzędzi w jednej turze to sygnał zgubionego kontekstu — deduplikuj je i mów modelowi wprost,
że to powtórka.

## 2026-08-03 — Rejestr ze stanem = pętla renderów, która gubi kliknięcia w innym module
**Problem:** Po wpięciu wspólnego rejestru skrótów (`ShortcutsProvider`) padł klikacz zupełnie
niezwiązanej funkcji: przełącznik ulubionych zamykał się po kliknięciu pozycji, ale `router.push`
nie nawigował. Objawy wyglądały jak awaria nawigacji, nie skrótów. Dopiero podpięcie
`page.on("console")` w teście pokazało prawdziwą przyczynę: `Warning: Maximum update depth
exceeded`. Prowider trzymał listę zarejestrowanych skrótów w `useState` i publikował ją przy każdej
(wy)rejestracji. Komponent przekazujący **niestabilną tablicę** wpadał wtedy w pętlę:
rejestracja → `setState` → render prowidera → render dzieci → nowa tablica → rejestracja…
Aplikacja renderowała się bez końca i gubiła kliknięcia.
**Rozwiązanie:** Prowider **nie ma stanu**. Rejestr trzyma **referencje** do tablic
(`{ current: RegisteredShortcut[] }`), a `useShortcuts` odświeża `ref.current` przy każdym renderze
i rejestruje się **raz**, przy montowaniu. Lista do ściągawki liczy się **na żądanie**
(`getShortcuts()`), w momencie jej otwarcia. Wartość kontekstu jest stała, więc zmiana rejestru
nigdy nie przerysowuje konsumentów.
**Lekcja:** Rejestr, do którego komponenty się zapisują, **nie powinien trzymać zawartości
w stanie Reacta** — inaczej każdy niestabilny argument staje się pętlą renderów. Trzymaj referencje,
rejestruj raz, licz migawkę na żądanie. I szerzej: gdy pada test funkcji, której nie dotykałeś,
**najpierw zajrzyj do konsoli przeglądarki** — pętla renderów i rozjazd hydratacji objawiają się
w zupełnie niezwiązanych miejscach (por. wpis z 2026-08-02).

## 2026-08-03 — Skróty na gołe cyfry bez sprawdzania modyfikatorów
**Problem:** `Alt+1` (skok do ulubionego) jednocześnie przełączał zakładkę filtra. `useKeyboardShortcuts`
miał `switch (e.key)` z `case "1".."5"` za samym `if (typing) return;` — **bez sprawdzania
modyfikatorów** — a skróty ulubionych żyły w osobnym listenerze na `window`.
**Rozwiązanie:** Jedno miejsce prawdy (`lib/shortcuts/registry.ts`): goły klawisz pasuje **tylko**
gdy `!altKey && !ctrlKey && !metaKey`; `Shift` NIE blokuje (bez niego nie da się wpisać `?`);
skrót `Alt+…` wymaga `!ctrlKey`, bo na polskiej klawiaturze **AltGr = Ctrl+Alt**. Pierwszeństwo
skrótów strony przed globalnymi wymagało JEDNEGO dyspozytora — dwa listenery na `window` go nie dają,
bo komponent strony montuje się po powłoce i jego listener odpala się jako drugi.
**Lekcja:** Skrót na goły klawisz zawsze wymaga jawnego „i żadnego modyfikatora". Gdy w aplikacji
są dwa niezależne listenery klawiatury, kolizja jest kwestią czasu — potrzebny jest jeden dyspozytor
z jawną kolejnością.

## 2026-08-03 — CSS Grid wyrównuje wiersze, więc zostawia dziury na pulpicie
**Problem:** Kafelki pulpitu o różnej wysokości w `grid-cols-2` zostawiały pod niższym kafelkiem
pustą przestrzeń na całą różnicę wysokości wiersza — właściciel zgłosił to jako „dziwny układ
komponentów", zauważając, że w trybie edycji (jedna kolumna) wygląda lepiej.
**Rozwiązanie:** Układ wielokolumnowy CSS (`columns-1 md:columns-2`) + `break-inside: avoid`
na kafelkach. W kolumnach `gap` nie działa w pionie, więc odstęp daje `margin-bottom`.
**Lekcja:** Siatka jest do układów, w których wiersze mają się wyrównywać. Do „ciasnego pakowania"
kafelków o różnej wysokości służy układ wielokolumnowy — bez JavaScriptu i bez biblioteki masonry.
