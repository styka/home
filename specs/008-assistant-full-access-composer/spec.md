# Spec: Asystent — pełny dostęp do akcji, wyszukiwanie „query-first", composer jak w ChatGPT i ustawienia głosu

- **ID:** 008-assistant-full-access-composer
- **Status:** draft
- **Autor sesji:** Claude Code (spec-driven pipeline)
- **Data:** 2026-07-17
- **Moduł(y):** Home / Asystent AI (magiczna ikona) — warstwa AI (agent/prompt/read-tools/execute) + UI (composer, ustawienia czatu). Bez zmian w modelu danych.

> **Zasada speca:** opisujemy **CO i DLACZEGO**, nigdy **JAK**. Szczegóły realizacji → `plan.md`.

## 1. Problem / potrzeba
Po testach właściciela (rozwinięcie 005/006/007, wszystkie na produkcji) Asystent ma sześć bolączek,
które łącznie psują wrażenie „kompana":
1. **Composer wygląda brzydko.** Dolny pasek czatu jest ciasny i niespójny; ChatGPT ma lepszy,
   czytelny UX (jedna zaokrąglona „pigułka", „+" po lewej, szerokie pole, po prawej mikrofon
   dyktowania i wypełnione okrągłe kółko trybu rozmowy). U nas to samo miejsce jest nieestetyczne.
2. **Gadana instrukcja karty akcji.** W trybie głosowym przy każdej karcie akcji lektor czyta
   „powiedz zatwierdź / odrzuć / podaj poprawkę". To zbędne — przyciski są widoczne — i męczące.
3. **Brak wyboru głosu lektora.** Użytkownik nie może wybrać, którym głosem Asystent czyta na głos.
4. **Zła klasyfikacja / brak realizacji odczytu.** Na prośbę „podaj mi zadanie, jakie mógłbym zrobić"
   Asystent zaproponował dodanie (pustej) pozycji do listy zakupów, zamiast przeszukać zadania i
   pokazać/przeczytać propozycję. Prośby „znajdź / podaj / pokaż mi X" nie są rozpoznawane jako
   odczyt danych.
5. **Niepełne wykorzystanie funkcji aplikacji.** Asystent ma mieć pełny dostęp do wszystkiego, co może
   zrobić użytkownik — w tym do pobierania/wyszukiwania danych — i najpierw używać sparametryzowanych
   funkcji aplikacji (filtry/zapytania), a LLM włączać dopiero na końcu do sformatowania wyniku, a nie
   „mielić" dużych ilości danych przez model.
6. **Ignorowanie wskazanego kontenera.** Gdy użytkownik mówi „dodaj to do listy X" (albo do konkretnego
   projektu/talii itp.), Asystent bywa, że nie celuje w tę nazwaną listę.

## 2. Cel i miary sukcesu
- **Cel:** Asystent zachowuje się jak kompetentny kompan — poprawnie rozpoznaje, kiedy ma **odpowiedzieć
  / wyszukać / odczytać**, a kiedy **zmienić dane**; realizuje wyszukania funkcjami aplikacji; celuje w
  nazwany kontener; ma spójny, ładny composer w stylu ChatGPT i konfigurowalny głos lektora, bez
  zbędnej gadanej instrukcji w trybie głosowym.
- **Sukces mierzymy (obserwowalnie):**
  - Prośba „podaj mi zadanie, jakie mógłbym zrobić" → Asystent **przeszukuje zadania** i pokazuje
    (oraz w trybie głosowym mówi) **konkretną propozycję** — **nie** tworzy przypadkowej akcji dodania.
  - Prośby typu „znajdź / pokaż / ile mam / co mam …" kończą się **odpowiedzią z danych** (odczyt),
    a nie kartą akcji zmiany.
  - „Dodaj X do listy Y" → pozycja ląduje **na liście Y** (gdy Y istnieje).
  - Composer to jedna spójna „pigułka" z widocznym „+", szerokim polem, mikrofonem i kółkiem trybu
    głosowego; żadna dotychczasowa funkcja nie znika; ładny na telefonie.
  - W trybie głosowym po powstaniu karty akcji lektor **nie recytuje** instrukcji obsługi (najwyżej
    krótkie „przygotowałem N akcji" albo nic).
  - W ustawieniach czatu można **wybrać głos** i wybór jest **zapamiętany** oraz używany przy odczycie.

## 3. Historyjki użytkownika
- Jako użytkownik chcę zapytać Asystenta „podaj mi zadanie do zrobienia" i **dostać konkretną
  propozycję z moich zadań**, a nie przypadkową akcję.
- Jako użytkownik chcę, żeby „znajdź/pokaż/ile mam …" **wyszukiwało moje dane** i odpowiadało, zamiast
  proponować zmianę.
- Jako użytkownik chcę, żeby „dodaj X do listy Y" trafiało **do listy Y**.
- Jako użytkownik chcę **ładnego, spójnego composera** (jak w ChatGPT), także na telefonie.
- Jako użytkownik w trybie głosowym **nie chcę** słuchać za każdym razem instrukcji obsługi karty akcji.
- Jako użytkownik chcę **wybrać głos lektora** i żeby ten wybór był **zapamiętany**.

## 4. Kryteria akceptacji (testowalne)
- [ ] **AC-1 (klasyfikacja odczytu)** — Given użytkownik ma ≥1 aktywne zadanie, when napisze/powie
  „podaj mi zadanie, jakie mógłbym zrobić", then Asystent wykonuje **odczyt zadań** (query) i zwraca
  **odpowiedź z konkretną propozycją zadania** (z nazwą istniejącego zadania) — **nie** proponuje
  dodania pozycji do listy zakupów ani innej akcji tworzącej.
- [ ] **AC-2 (intencje find/show)** — Given użytkownik pyta „ile mam …", „pokaż moje …", „znajdź …",
  „co mam zaplanowane …", when zapyta o dane istniejącego modułu, then odpowiedź powstaje z **danych
  pobranych funkcją odczytu** (a nie z karty akcji zmiany) i wskazuje realne rekordy.
- [ ] **AC-3 (query-first, bez „mielenia")** — Given zapytanie wymaga przeszukania danych, when
  Asystent je realizuje, then **najpierw** używa sparametryzowanej funkcji odczytu (filtr/limit/szukaj)
  do zawężenia, a LLM służy **wyłącznie** do sformułowania odpowiedzi z już zawężonego wyniku (nie
  przekazujemy do modelu całych, nieprzefiltrowanych zbiorów).
- [ ] **AC-4 (pełny dostęp)** — Given dowolny moduł, do którego użytkownik ma uprawnienie, when Asystent
  odpowiada na pytanie o dane tego modułu, then ma dostęp do odpowiedniej funkcji odczytu (żaden
  dostępny użytkownikowi obszar danych nie jest „niewidoczny" dla Asystenta z powodu braku narzędzia).
- [ ] **AC-5 (nazwany kontener)** — Given istnieje lista/projekt/talia o nazwie „Y", when użytkownik
  prosi „dodaj X do Y", then utworzona akcja celuje w **kontener „Y"** (dopasowanie po nazwie), a nie w
  domyślny/inny; gdy „Y" nie istnieje, Asystent to sygnalizuje (dopytuje lub tworzy zgodnie z intencją)
  zamiast po cichu dodać gdzie indziej.
- [ ] **AC-6 (composer — wygląd)** — Given otwarty czat Asystenta na desktopie i na telefonie, when
  patrzę na dolny pasek, then widzę jedną spójną, zaokrągloną „pigułkę": „+" (dodatki) po lewej, szerokie
  pole tekstowe z placeholderem w środku, po prawej **mikrofon dyktowania** i **okrągłe kółko trybu
  rozmowy głosowej**; układ jest czytelny, nie „ściśnięty", zgodny z estetyką aplikacji (zmienne CSS).
- [ ] **AC-7 (composer — kompletność funkcji)** — Given nowy composer, when korzystam z Asystenta, then
  **wszystkie** dotychczasowe funkcje działają: wysyłanie, Stop podczas generowania, dodatki spod „+"
  (Zdjęcie / Stałe preferencje), dyktowanie do pola oraz włączanie/wyłączanie trybu rozmowy głosowej.
- [ ] **AC-8 (mniej gadania w trybie głosowym)** — Given tryb rozmowy głosowej, when powstaje karta
  akcji, then lektor **nie recytuje** instrukcji „powiedz zatwierdź/odrzuć/podaj poprawkę"; co najwyżej
  pada krótka informacja typu „przygotowałem N akcji" (lub nic), a wizualne przyciski/wskazówki na
  karcie pozostają.
- [ ] **AC-9 (wybór głosu — ustawienia)** — Given ustawienia czatu Asystenta, when otwieram wybór głosu,
  then widzę listę głosów dostępnych w przeglądarce i mogę wybrać jeden; interfejs działa też gdy głosy
  ładują się asynchronicznie (iOS/Safari).
- [ ] **AC-10 (wybór głosu — trwałość i użycie)** — Given wybrałem głos, when Asystent czyta na głos
  (odpowiedź lub potwierdzenie), then używa **wybranego** głosu; wybór jest **zapamiętany** między
  sesjami na tym urządzeniu; gdy zapamiętany głos jest niedostępny, następuje bezpieczny powrót do
  domyślnego bez błędu.
- [ ] **AC-11 (brak regresji trybu głosowego)** — Given zmiany 4–6 i nowy composer, when prowadzę
  ciągłą rozmowę głosową (Chrome i iOS/Safari), then pętla nasłuch → myślenie → mowa → nasłuch działa
  jak dotąd (żadnej regresji z 005/006/007), a poprawki interpretuję głosem.

## 5. Zakres
**W zakresie:**
- Poprawa **rozpoznawania intencji** odczyt/wyszukanie vs zmiana danych (prompt agenta + szybka
  klasyfikacja) — tak, by prośby „podaj/znajdź/pokaż/ile mam" szły ścieżką odczytu i odpowiedzi.
- **„Query-first"**: najpierw sparametryzowane funkcje odczytu aplikacji (filtry/limit/szukaj), potem
  LLM tylko do formatu odpowiedzi; nie przepuszczać dużych zbiorów przez model.
- **Pełny dostęp** Asystenta do funkcji odczytu wszystkich modułów, do których użytkownik ma
  uprawnienie (w tym te już istniejące — potwierdzić kompletność i widoczność w pętli agenta).
- **Celowanie w nazwany kontener** (lista/projekt/talia itd.) przy akcjach tworzących.
- **Redesign composera** na spójną „pigułkę" w stylu ChatGPT (desktop + mobile), z zachowaniem
  wszystkich funkcji; estetyka na zmiennych CSS/skórkach.
- **Ograniczenie gadanej instrukcji** karty akcji w trybie głosowym.
- **Wybór głosu lektora** w ustawieniach czatu Asystenta: lista głosów przeglądarki, zapisany wybór,
  użycie przy odczycie, obsługa asynchronicznego ładowania i brakującego głosu.

**Poza zakresem (świadomie):**
- Zmiany w modelu danych / migracje / nowe uprawnienia RBAC (nie są potrzebne).
- Nowe akcje **zmieniające** dane w modułach, które ich jeszcze nie mają (skupiamy się na odczycie,
  klasyfikacji i celowaniu; katalog akcji zmian rozwijamy tylko, jeśli okaże się to konieczne do
  respektowania nazwanego kontenera — bez rozszerzania na nowe moduły).
- Regulacja **tempa/wysokości** głosu, wybór języka syntezatora inny niż dotychczasowa logika,
  nagrywanie/streaming audio spoza Web Speech.
- Zmiana silnika rozpoznawania/syntezy mowy (dalej Web Speech API; bez bibliotek zewnętrznych, bez
  różnicowania po nazwie przeglądarki).

## 6. Wpływ na Omnia
- **Uprawnienie / RBAC:** bez zmian — Asystent działa w granicach uprawnień użytkownika; funkcje
  odczytu zwracają wyłącznie dane w zakresie dostępu (ownerId/zespół), zgodnie z istniejącym wzorcem.
- **Własność danych:** bez zmian; wybór głosu to preferencja **per-urządzenie** (patrz §8), nie dane
  współdzielone — nie dotyczy modelu user/team.
- **Asystent AI:** rdzeń zmian — prompt/klasyfikacja intencji, „query-first", kompletność read-tooli,
  celowanie w nazwany kontener; ograniczenie mowy przy karcie akcji; wybór głosu przy odczycie. Bez
  nowej `AIAction` (chyba że okaże się nieunikniona dla nazwanego kontenera — wtedy z executorem, C-23).
- **Kalendarz / powiadomienia / trash:** nie dotyczy.

## 7. Zgodność z konstytucją
- **C-23** — każda ewentualna nowa `AIAction` musi mieć executor (bramka `check:actions`); preferujemy
  brak nowych akcji, użycie istniejących read-tooli i executorów.
- **C-21** — funkcje odczytu respektują własność (ownerId/ownerTeamId) i uprawnienia — Asystent nie
  „widzi" więcej niż użytkownik.
- **C-22** — bez nowych uprawnień/slugów (feature mieści się w `module.home`/istniejących modułach).
- **Skórki / zmienne CSS** — composer i ustawienia stylowane wyłącznie zmiennymi (`var(--*)`,
  `var(--on-accent)` na kolorowych elementach), bez zaszytych kolorów; mobile-first, `hidden md:*`.
- **Web Speech bez UA-sniffingu** — wykrywanie możliwości przez istnienie API, nie po nazwie
  przeglądarki (lekcja z 007); obsługa asynchronicznego ładowania głosów (iOS/Safari).
- **Brak enumów Prismy** — nie dotyczy (bez zmian schematu); stany trybu głosowego dalej jako unia TS.
- **Bez „mielenia" danych przez LLM** — realizacja przez funkcje aplikacji, LLM tylko do formatu.

## 8. Otwarte pytania / decyzje właściciela
Właściciel jest precyzyjny i deleguje UX; poniższe przyjęto jako **domyślne decyzje** (brak realnego
rozwidlenia wymagającego pytania — furtka C-55 pozostaje na wypadek, gdyby plan odsłonił coś istotnego):
- **Trwałość wyboru głosu = per-urządzenie (localStorage).** Głosy Web Speech są specyficzne dla
  urządzenia/przeglądarki (ten sam identyfikator głosu nie istnieje na innym sprzęcie), więc zapis
  w bazie per-użytkownik byłby zawodny między urządzeniami. Wybór trzymamy lokalnie na urządzeniu, z
  bezpiecznym powrotem do domyślnego, gdy zapamiętany głos jest niedostępny.
- **Composer ≈ ChatGPT, ale w estetyce Omnii.** Odwzorowujemy układ z referencji (pigułka, „+",
  szerokie pole, mikrofon, kółko trybu głosowego), lecz kolory/rogi/typografia ze zmiennych
  CSS/skórek — nie kopiujemy dosłownie stylu ChatGPT.
- **Gadana instrukcja karty akcji:** w trybie głosowym **usuwamy** recytowanie obsługi; dopuszczalne
  najwyżej krótkie „przygotowałem N akcji". Instrukcje pozostają **wizualnie** na karcie.
- **Bez zmian schematu/RBAC.** Zakładamy, że pełny dostęp i „query-first" realizujemy istniejącymi
  read-toolami i executorami; nowe akcje tylko jeśli nieuniknione dla nazwanego kontenera.

## 9. Ryzyka
- **Za agresywna klasyfikacja odczytu** mogłaby tłumić realne prośby o zmianę → kryteria AC-1/AC-2 plus
  reguła „przy jasnej intencji zmiany dalej proponuj akcję" (kompan z 006) ograniczają to; testujemy
  oba kierunki (AC-11 „brak regresji").
- **Dopasowanie nazwy kontenera** (literówki, warianty) bywa niejednoznaczne → gdy brak pewnego
  dopasowania, Asystent **dopytuje** zamiast zgadywać (spójne z „DOPYTUJ, NIE ZGADUJ" z 006).
- **Głosy ładują się asynchronicznie** (iOS/Safari) → UI wyboru i odczyt muszą obsłużyć pustą listę na
  starcie i uzupełnienie po `voiceschanged`; brak wybranego głosu = domyślny (AC-9/AC-10).
- **Redesign composera grozi regresją funkcji** (Stop, „+", dyktowanie, tryb głosowy) → AC-7 i AC-11
  pilnują kompletności i braku regresji pętli głosowej.
- **„Mielenie" danych** przy dużych zbiorach → twardo trzymać się „query-first" (limit/filtr przed
  LLM), AC-3.
