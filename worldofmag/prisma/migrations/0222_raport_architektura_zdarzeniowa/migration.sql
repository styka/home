-- 0222: raport administracyjny — architektura zdarzeniowa, cofalność zmian, podgląd na żywo.
-- Bez DDL. Idempotentny seed raportu (C-14): slug globalnie unikalny, ON CONFLICT DO UPDATE,
-- żeby ponowne wdrożenie odświeżało treść zamiast ją duplikować.
INSERT INTO "Report" ("id","title","slug","content","category","authorId","createdAt","updatedAt")
VALUES (gen_random_uuid()::text,
  'Omnia — architektura zdarzeniowa, cofanie zmian i podgląd na żywo (2026-08-03)',
  'omnia-architektura-zdarzeniowa-cofanie-live-2026-08-03',
  $raport_arch_0803$# Omnia — architektura zdarzeniowa, cofanie zmian i podgląd na żywo

> **Po co ten raport.** Odpowiada na trzy pytania administratora: (1) czy aplikacja jest **sterowana
> zdarzeniami**, (2) czy zmiany danych są **cofalne jak w dokumentach Google**, (3) co trzeba zrobić,
> żeby dane **zapisywały się automatycznie i odświeżały na żywo na wszystkich urządzeniach**.
>
> Raport opisuje **stan faktyczny na 2026-08-03**, sprawdzony w kodzie, a nie stan pożądany. Każde
> twierdzenie ma wskazany plik. Na końcu są warianty rozwoju z kosztem i ryzykiem oraz — osobno —
> lista rzeczy, **których nie da się osiągnąć tanio**.

---

## 1. Streszczenie dla zabieganych

| Pytanie | Odpowiedź krótka |
|---------|------------------|
| Czy Omnia jest sterowana zdarzeniami? | **Nie.** Jest sterowana **żądaniami**. Zdarzenia występują lokalnie (kolejka zadań, magistrale w przeglądarce), ale nie ma dziennika zdarzeń, z którego odtwarza się stan. |
| Czy zmiany są cofalne? | **Częściowo.** Cofalne są **usunięcia** (kosz z retencją) i **edycje notatek** (historia wersji). Zwykła edycja pola w pozostałych ~19 modułach jest **nieodwracalna**. |
| Czy dane odświeżają się na żywo na innych urządzeniach? | **Tak, ale z opóźnieniem do ~45 sekund** i tylko przy widocznej karcie. To działa od dawna — nie jest to funkcja do zbudowania od zera. |
| Czy jest automatyczny zapis? | **Nie ma go jako zasady.** Część miejsc zapisuje po debounce, większość wymaga kliknięcia „Zapisz". |

**Najważniejszy wniosek.** Trzy pytania właściciela brzmią jak jedna funkcja („zróbmy jak w Google
Docs"), ale to **trzy niezależne inwestycje o skrajnie różnym koszcie**. Podgląd na żywo jest tani
i w 80% już zrobiony. Cofanie edycji jest średnio drogie i daje się wprowadzać moduł po module.
Edycja współbieżna w stylu Google Docs jest droga, wymaga trwałych połączeń i — przy jednym głównym
użytkowniku — **nie ma dla kogo działać**. Kolejność inwestycji powinna być dokładnie odwrotna do
kolejności, w jakiej te pytania padły.

---

## 2. Czy Omnia jest sterowana zdarzeniami? — stan faktyczny

**Nie w sensie architektonicznym.** Wzorzec aplikacji to klasyczne „żądanie → mutacja → rewalidacja":

- **Mutacje to Server Actions.** W `src/actions/` jest **68 plików** kończących mutacje wywołaniem
  `revalidatePath()`. To jest cały mechanizm propagacji zmiany: akcja zapisuje do bazy przez Prismę
  i unieważnia cache ścieżki. **Nie powstaje żaden zapis „co się stało"** — powstaje tylko nowy stan.
- **Baza trzyma stan bieżący, nie historię.** Kolumny są nadpisywane w miejscu. Nie ma tabeli zdarzeń,
  nie ma numerów wersji encji, nie ma możliwości odtworzenia stanu z przeszłości przez odtworzenie
  dziennika.

**Co jednak jest zdarzeniowe — i warto o tym wiedzieć, zanim ktoś powie „nie mamy nic":**

- **Kolejka zadań** (`Job`, `src/lib/jobs/*`, panel `/admin/jobs`). Zadania są zlecane, wykonywane
  asynchronicznie przez proces roboczy (`src/lib/jobs/worker.ts`, `setInterval` w procesie serwera)
  i raportują postęp przez `ctx.progress(text)` → kolumna `Job.progress`. Rejestr `JOB_HANDLERS`
  (`src/lib/jobs/handlers.ts`) jest jednocześnie listą tego, co klient w ogóle może zlecić. To jest
  prawdziwe przetwarzanie sterowane komunikatem — tyle że ograniczone do zadań w tle (odświeżanie
  Wiadomości, wnioskowanie faktów o użytkowniku).
- **Strumień zdarzeń istnieje dokładnie w jednym miejscu** — asystent AI. Trasa
  `src/app/api/llm/home/agent/route.ts` przy `stream:true` zwraca **SSE**, a `AICommandSheet` czyta go
  przez `EventSource`, pokazując myśli agenta na żywo. To dowód, że **infrastruktura pod strumienie
  jest w aplikacji sprawdzona** — nie trzeba jej wymyślać od zera, gdyby zapadła decyzja o (c).
- **Magistrale zdarzeń w przeglądarce** (`src/lib/ai/assistantBus.ts`,
  `src/lib/favorites/favoritesBus.ts`, `src/lib/ai/feedbackBus.ts`) — luźne wiązanie komponentów
  powłoki. To wzorzec zdarzeniowy, ale **wyłącznie w obrębie jednej karty przeglądarki**; nic z tego
  nie przechodzi przez sieć.

**Wniosek.** „Sterowanie zdarzeniami" w Omnii jest **taktyką lokalną, nie architekturą**. Nie ma
dziennika zdarzeń, więc nie ma z czego odtwarzać stanu ani czego cofać.

---

## 3. Czy zmiany danych są cofalne?

To pytanie ma dwie różne odpowiedzi, bo **„cofnięcie usunięcia" i „cofnięcie edycji" to dwa różne
mechanizmy** — i Omnia ma tylko pierwszy z nich (plus jeden wyjątek).

### 3.1. Co JEST cofalne dzisiaj

| Mechanizm | Gdzie | Co obejmuje |
|-----------|-------|-------------|
| **Kosz (miękkie usuwanie)** | `TrashItem`, `src/lib/trash.ts`, `src/actions/trash.ts`, ekran `/trash` | Usunięcia w wielu modułach zapisują **migawkę JSON** encji z licznikiem dni retencji; `restoreTrashItem` przywraca. Dostępne też `purgeTrashItem` i `emptyTrash`. |
| **Historia wersji notatek** | `NoteRevision` (`noteId`, `title`, `content`, `createdAt`) | **Jedyny** moduł z prawdziwą historią **edycji**. Można obejrzeć i przywrócić poprzednią treść notatki. |
| **Ślad zmian administracyjnych** | `AuditLog`, `src/lib/audit.ts`, `/admin/audit` | Zmiany RBAC i konfiguracji. To **dziennik do czytania, nie do cofania** — nie ma operacji „przywróć stan sprzed wpisu". Model celowo nie ma klucza obcego do `User` (zapamiętuje e-mail aktora), więc historia przeżywa usunięcie konta. |

### 3.2. Czego NIE ma

**Cofania edycji poza notatkami.** Zmiana kwoty we wpisie Portfela, statusu zadania, wagi zwierzęcia,
ilości w magazynie — nadpisuje poprzednią wartość **bezpowrotnie**. Nie ma `Ctrl+Z`, nie ma „przywróć
poprzednią wersję", nie ma nawet informacji, że pole kiedykolwiek miało inną wartość.

**To jest sedno różnicy wobec dokumentów Google**, o którą pyta administrator. W Dokumentach Google
cofalna jest **każda zmiana każdego znaku**, bo edytor nie zapisuje stanu — zapisuje **strumień
operacji**. Omnia zapisuje stan. Dopóki to się nie zmieni, „cofanie jak w Google" jest niedostępne
**z definicji**, a nie z powodu brakującego przycisku.

### 3.3. Automatyczny zapis

Nie ma go jako zasady systemowej. Występuje punktowo — np. wersja robocza wiadomości do asystenta
zapisuje się na 2-sekundowym debounce do `AiConversation.draft`, dzięki czemu wraca na innym
urządzeniu. Poza takimi wyspami obowiązuje klasyczny formularz z przyciskiem zapisu. **Warto zauważyć
zależność:** automatyczny zapis bez historii wersji jest **niebezpieczny** — odbiera użytkownikowi
ostatnią linię obrony, jaką jest „nie kliknę Zapisz". Jeśli automatyczny zapis ma wejść szeroko,
**musi wejść razem z dziennikiem zmian**, nie przed nim.

---

## 4. Czy dane odświeżają się na żywo na wielu urządzeniach?

**Tak — i to jest część, która działa lepiej, niż mogłoby się wydawać.**

`src/components/shell/DataFreshness.tsx` (montowany raz w `AppShell`) wywołuje `router.refresh()`:

- przy każdym powrocie do aplikacji — `visibilitychange`, `focus`, `pageshow` (to ostatnie obsługuje
  wznowienie z bfcache i tryb PWA na ekranie głównym iPhone'a, gdzie nie ma paska przeglądarki),
- **cyklicznie co 45 sekund**, wyłącznie gdy karta jest widoczna,
- z 3-sekundową ochroną przed podwójnym odświeżeniem.

`router.refresh()` pobiera na nowo komponenty serwerowe **bez przeładowania strony**, więc nie gubi
stanu klienta ani kursora w polu edycji.

**Co to znaczy w praktyce.** Zmiana zrobiona na telefonie pojawia się na komputerze:
- **natychmiast**, jeśli przełączysz się na kartę z Omnią (odświeżenie na `focus`),
- **w ciągu ≤45 sekund**, jeśli karta jest otwarta i widoczna,
- **nigdy**, dopóki karta jest w tle lub urządzenie śpi — to świadomy kompromis, żeby nie budzić
  darmowego serwera i nie palić baterii.

**Czego nie ma:** wypychania zmian z serwera (push). Serwer nie ma jak powiedzieć „coś się zmieniło" —
to klient pyta. Dlatego opóźnienie ≤45 s jest **twardą granicą obecnego rozwiązania**, a nie
niedoróbką do poprawienia parametrem.

---

## 5. Warianty rozwoju — koszt i ryzyko

Warianty (a) i (b) są **już wdrożone** (rozdział 4). Realna oś decyzji zaczyna się od (c).

### (a) Rewalidacja + odświeżanie przy powrocie do karty — ✅ JEST
Koszt: 0 (zrobione). Opóźnienie: natychmiast po powrocie do karty.

### (b) Odpytywanie cykliczne wybranych widoków — ✅ JEST (globalnie, co 45 s)
Koszt: 0 (zrobione). Możliwy tani ruch: **skrócenie interwału dla wybranych ekranów** (np. wspólna
lista zakupów w trakcie zakupów — 10 s zamiast 45 s). Ryzyko: przy darmowym planie Rendera każde
odpytanie to realne zapytanie do bazy Neon; agresywne skracanie interwału to prosta droga do
wyczerpania limitów. **Koszt: godziny. Ryzyko: niskie.**

### (c) Wypychanie zmian strumieniem (SSE) dla wybranych modułów
Serwer utrzymuje otwarte połączenie i wysyła „zmieniło się X" → klient robi `router.refresh()`.
Infrastruktura jest sprawdzona (agent AI już nadaje SSE), więc nie zaczynamy od zera.
**Miejsca do zmiany:** nowa trasa `src/app/api/events/route.ts`, punkt rozgłaszania w Server Actions
(najlepiej **jeden** wspólny hak wywoływany obok `revalidatePath`), odbiornik w `AppShell` obok
`DataFreshness`.
**Koszt: dni.** **Ryzyko: średnie, ale konkretne** — środowisko testowe (`develop`) stoi na **darmowym
planie Rendera i zasypia po 15 minutach bezczynności**, więc trwałe połączenie tam z definicji będzie
się rwać; produkcja (`master`) jest na planie płatnym i nie zasypia, ale przy jednej instancji
rozgłaszanie musi żyć w pamięci procesu — po każdym wdrożeniu połączenia trzeba odtworzyć.
**Uwaga o proporcjach:** to skraca opóźnienie z 45 s do ~1 s. Warto zapytać, dla ilu ekranów te 44
sekundy naprawdę robią różnicę.

### (d) Dziennik zmian per encja — fundament cofania
Wzorzec **już istnieje w repo**: `NoteRevision`. Rozszerzenie go na kolejne moduły to za każdym razem:
nowy model `*Revision` + ręczna migracja SQL + zapis poprzedniej wartości w Server Action + UI
„historia / przywróć".
**Koszt: dni na moduł** (kilka tygodni dla wszystkich). **Ryzyko: niskie technicznie, wysokie
kosztowo** — przy ~20 modułach to dwadzieścia niemal identycznych implementacji.
**Zalecenie:** jeśli w to iść, to **nie** modułami po kolei, tylko **jednym wspólnym mechanizmem**
(jedna tabela wersji z `entityType`/`entityId` + migawką JSON — dokładnie tak, jak działa już
`TrashItem`) i **tylko dla encji, gdzie utrata edycji naprawdę boli**: Portfel, Zdrowie, pomiary
zwierząt. Rozlewanie tego na wszystko to koszt bez odbiorcy.

### (e) Pełny event sourcing / CRDT — „jak w Google Docs"
Stan przestaje być prawdą, prawdą staje się strumień operacji; edycja współbieżna wymaga CRDT albo
transformacji operacyjnej + trwałego połączenia + rozwiązywania konfliktów.
**Koszt: miesiące. Ryzyko: bardzo wysokie.** To **przepisanie warstwy danych całej aplikacji**, nie
funkcja. Wszystkie 68 plików akcji, wszystkie zapytania Prismy i cały model uprawnień wymagałyby
przeprojektowania.

---

## 6. Czego NIE da się osiągnąć tanio — i co jest pułapką przy tej skali

Ta sekcja istnieje po to, żeby raport nie był reklamą.

1. **Edycji współbieżnej w stylu Google Docs nie da się zrobić tanio. Nigdy.** To nie jest kwestia
   biblioteki. CRDT/OT wymaga przeprojektowania modelu danych, trwałych połączeń i obsługi konfliktów.
   Każde „szybkie" podejście (np. „ostatni zapis wygrywa") **nie jest cofaniem zmian — jest cichą
   utratą pracy** i w praktyce byłoby krokiem wstecz wobec dzisiejszego formularza z przyciskiem.
2. **Omnia to system w praktyce jednoosobowy.** Współwłasność zespołowa istnieje
   (`ownerId`/`ownerTeamId`), ale realny konflikt „dwie osoby edytują to samo pole w tej samej
   sekundzie" niemal nie występuje. **Najdroższy wariant rozwiązuje problem, którego ta aplikacja nie
   ma.** To jest główna pułapka tego zestawu wymagań.
3. **Trwałe połączenia i darmowy plan hostingu wykluczają się.** Środowisko testowe zasypia po 15
   minutach. Każde rozwiązanie oparte na SSE/WebSocket będzie tam wyglądało na zepsute, co utrudni
   ocenę, czy działa — a ocenia się właśnie na `develop`.
4. **Dwadzieścia modułów to dwadzieścia implementacji, jeśli nie ma wspólnego mechanizmu.** To
   najczęstszy sposób, w jaki taka zmiana wymyka się spod kontroli: pierwszy moduł zajmuje dwa dni,
   dwudziesty nigdy nie powstaje, a aplikacja zostaje niespójna. Cokolwiek robimy — **jeden wspólny
   mechanizm albo nic**.
5. **Automatyczny zapis bez historii wersji pogarsza sytuację.** Odbiera użytkownikowi ostatnią linię
   obrony („nie kliknę Zapisz") i nie daje nic w zamian. Kolejność ma znaczenie: **najpierw dziennik
   zmian, potem automatyczny zapis.**
6. **Skrócenie interwału odpytywania to koszt bazy, nie koszt kodu.** Zmiana 45 s → 5 s to
   dziewięciokrotnie więcej zapytań do Neona z każdej otwartej karty. Przy darmowym planie to realne
   ryzyko wyczerpania limitów.

---

## 7. Zalecana kolejność (gdyby właściciel zdecydował się działać)

1. **Nic nie rób z podglądem na żywo, dopóki nie wskażesz konkretnego ekranu**, na którym 45 sekund
   przeszkadza. Wtedy skróć interwał **tylko tam** (wariant b, godziny pracy).
2. **Jeden wspólny dziennik zmian** wzorowany na `TrashItem` (migawka JSON + `entityType`/`entityId`),
   wpięty **najpierw w Portfel, Zdrowie i pomiary zwierząt** — tam utrata edycji boli najbardziej
   (wariant d, dni).
3. **Automatyczny zapis dopiero po pkt. 2** i tylko w formularzach objętych dziennikiem.
4. **SSE (wariant c) rozważ dopiero wtedy**, gdy realnie pojawi się drugi aktywny użytkownik.
5. **Wariantu (e) nie zaczynaj bez osobnej specyfikacji i świadomej zgody na miesiące pracy.**

---

## 8. Wskazane miejsca w kodzie (do ewentualnych zmian)

| Obszar | Pliki |
|--------|-------|
| Propagacja zmian po mutacji | `src/actions/*` (68 plików z `revalidatePath`) |
| Odświeżanie po stronie klienta | `src/components/shell/DataFreshness.tsx`, `src/components/shell/AppShell.tsx` |
| Przetwarzanie asynchroniczne | `src/lib/jobs/handlers.ts` (`JOB_HANDLERS`), `src/lib/jobs/worker.ts`, model `Job` |
| Istniejący strumień (wzorzec dla SSE) | `src/app/api/llm/home/agent/route.ts`, `src/lib/llm/chat.ts` |
| Cofanie usunięć | `src/lib/trash.ts`, `src/actions/trash.ts`, model `TrashItem` |
| Jedyna historia edycji | model `NoteRevision`, moduł Notatek |
| Ślad zmian administracyjnych | `src/lib/audit.ts`, model `AuditLog`, `/admin/audit` |

---

## 9. Odpowiedź w jednym akapicie

Omnia **nie jest** sterowana zdarzeniami — jest sterowana żądaniami, a baza trzyma stan bieżący,
nie historię. Cofalne są **usunięcia** (kosz z retencją) i **edycje notatek** (historia wersji);
każda inna edycja jest nieodwracalna. Dane **odświeżają się** na innych urządzeniach — przy powrocie
do karty natychmiast, w tle do 45 sekund — ale serwer niczego nie wypycha. Żeby dostać „cofanie jak
w Dokumentach Google", trzeba przestać zapisywać stan, a zacząć zapisywać zmiany; to jest
przeprojektowanie warstwy danych, nie funkcja do dołożenia. Rozsądna ścieżka to **jeden wspólny
dziennik zmian dla kilku modułów, w których utrata edycji naprawdę boli** — a nie pełna architektura
zdarzeniowa dla aplikacji, która ma jednego aktywnego użytkownika.$raport_arch_0803$,
  'general', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("slug") DO UPDATE SET "content"=EXCLUDED."content","title"=EXCLUDED."title","updatedAt"=CURRENT_TIMESTAMP;
