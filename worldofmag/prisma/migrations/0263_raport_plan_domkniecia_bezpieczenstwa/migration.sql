-- 103 — RAPORT: PLAN DOMKNIĘCIA BEZPIECZEŃSTWA.
--
-- Rozwinięcie rozdziału 7 raportu „Audyt bezpieczeństwa — sierpień 2026" (migracja 0261): każdy
-- z ośmiu punktów rozpisany na konkretne kroki, z jawnym podziałem na to, co robi Claude Code,
-- i to, co może zrobić wyłącznie właściciel (panele, konta, zmienne środowiskowe).
--
-- Migracja NIE zmienia kształtu bazy: jeden `INSERT` z `ON CONFLICT DO NOTHING` (C-14).
-- Treść nie zawiera żadnej wartości sekretu ani adresu bazy (C-41).

INSERT INTO "Report" ("id", "title", "slug", "content", "category", "storage", "authorId", "teamId", "createdAt", "updatedAt")
VALUES (
  gen_random_uuid()::text,
  'Plan domknięcia bezpieczeństwa — instrukcja wykonania',
  'plan-domkniecia-bezpieczenstwa',
  $plan_bezp$# Plan domknięcia bezpieczeństwa

**Rozwinięcie rozdziału 7** raportu „Audyt bezpieczeństwa — sierpień 2026". Tam była lista *co*
zrobić. Tutaj jest *jak* — krok po kroku, z jawnym podziałem odpowiedzialności.

---

## Jak czytać ten plan

| Znak | Znaczenie |
|---|---|
| **🤖 CLAUDE** | Robię sam: kod, testy, wdrożenie. Nic od Ciebie nie potrzebuję. |
| **🧑 TY** | Tylko Ty możesz to zrobić — wymaga zalogowania do panelu albo decyzji właściciela. |
| **🤝 RAZEM** | Ja przygotowuję, Ty wykonujesz jedną czynność (albo odwrotnie). |

---

## Najpierw najważniejsze: co zostaje na Tobie

Cała reszta to moja robota. **Twoja lista ma cztery pozycje** i żadna nie wymaga wiedzy technicznej:

1. **Włączyć drugi składnik logowania** na trzech kontach: Google, Render, Neon *(punkt 2 — najważniejszy na tej liście)*.
2. **Kliknąć „zapisz" przy kluczach API** w panelu administratora, gdy przygotuję wskaźnik pokazujący, które wymagają odświeżenia *(punkt 5)*.
3. **Wkleić jedną zmienną środowiskową** w panelu Render — w ściśle określonym momencie, bo kolejność ma tu znaczenie *(punkt 6)*.
4. **Zajrzeć w dwa miejsca w panelach** i potwierdzić dwie rzeczy, których nie odczytam z kodu *(punkt 9)*.

---

## Kolejność wykonania

Ułożona według **stosunku korzyści do ryzyka**, a nie według numeracji z audytu. Punkty 1–4 domykają
najwięcej najmniejszym kosztem; punkt 7 jest największy i celowo stoi na końcu.

| # | Zadanie | Kto | Ryzyko wdrożenia |
|---|---|---|---|
| 1 | Aktualizacja zależności | 🤖 | niskie |
| 2 | Drugi składnik logowania | 🧑 | brak |
| 3 | Odcięcie logowania testowego | 🤖 | brak |
| 4 | Limit żądań do feedu kalendarza | 🤖 | niskie |
| 5 | Dokończenie szyfrowania kluczy | 🤝 | niskie |
| 6 | Własna zmienna na klucz szyfrujący | 🤝 | **wysokie, jeśli w złej kolejności** |
| 7 | Polityka bezpieczeństwa treści (CSP) | 🤖 | średnie |
| 8 | Powtórka audytu | 🤝 | brak |
| 9 | Potwierdzenie dwóch rzeczy w panelach | 🧑 | brak |

---

# 1. Aktualizacja zależności · 🤖 CLAUDE

**Co to jest.** Aplikacja korzysta z cudzych bibliotek. W dwunastu z nich znaleziono błędy
bezpieczeństwa — **trzy krytyczne**, wszystkie w bibliotece odpowiedzialnej za **logowanie**.
Najpoważniejszy z nich sprawia, że ciasteczka kontrolne procesu logowania nie są związane
z dostawcą, który je wystawił.

**Dobra wiadomość, którą sprawdziłem dokładnie:** wszystkie trzy krytyczne naprawiają się **bez
zmian łamiących**. Sprawdziłem to pakiet po pakiecie:

| Naprawialne od ręki | Wymagają przejścia na następną główną wersję |
|---|---|
| `@auth/core` — **krytyczna** | `next` — wysoka |
| `@auth/prisma-adapter` — **krytyczna** | `postcss` — wysoka |
| `next-auth` — **krytyczna** | `eslint-config-next` — wysoka |
| `brace-expansion`, `js-yaml`, `nanoid` — wysokie | `@next/eslint-plugin-next`, `glob` — wysokie |
| `esbuild` — niska | |

Czyli jedno polecenie zamyka **wszystkie trzy krytyczne i cztery z ośmiu wysokich**. Pozostałe pięć
to jeden łańcuch: wszystkie zniknąłyby razem z przejściem na Next 16 — to osobne, większe zadanie
(patrz „Co zostaje poza tym planem").

**Jak to zrobię:**
1. `npm audit fix` (bez `--force` — to jest granica między „bezpiecznie" a „przepisujemy aplikację").
2. Pełny `npm run build` — 36 bramek jakości.
3. Pełny zestaw klikaczy, ze szczególną uwagą na **logowanie**.
4. Osobny commit, **tylko z tą zmianą**.

**Dlaczego osobny commit.** To jest bump biblioteki uwierzytelniania. Jeśli coś zepsuje logowanie,
musi być natychmiast widać, co cofnąć — a nie szukać tego w zmianie, w której siedzi pięć innych
rzeczy. Ta zasada jest powodem, dla którego nie zrobiłem tego razem z audytem.

**Jak sprawdzimy, że zadziałało.** Wylogowanie i ponowne zalogowanie przez Google na środowisku
testowym, zanim cokolwiek pójdzie na produkcję.

---

# 2. Drugi składnik logowania · 🧑 TY — **najważniejszy punkt tej listy**

**Co to jest i dlaczego jest pierwszy pod względem wagi.** Cała reszta tego planu chroni aplikację
*od środka*. Ten punkt chroni **klucze do wszystkiego**. Dostęp do konta Render daje konsolę na
serwerze produkcyjnym. Dostęp do konta Neon daje całą bazę. Dostęp do konta Google daje logowanie do
Omnii jako Ty. Żadne zabezpieczenie w kodzie nie ma znaczenia, jeśli ktoś zdobędzie hasło do
któregoś z tych trzech kont.

**Tego nie mogę zrobić za Ciebie** — wymaga zalogowania się na Twoje konta i potwierdzenia na Twoim
telefonie.

**Co zrobić, na każdym z trzech kont:**

1. **Google** — ustawienia konta → sekcja bezpieczeństwa → weryfikacja dwuetapowa. Najlepszy wybór
   to klucz sprzętowy albo aplikacja uwierzytelniająca; **kody SMS są najsłabszą z opcji** (da się
   je przejąć przez przeniesienie numeru) — lepsze niż nic, gorsze niż aplikacja.
2. **Render** — ustawienia konta → uwierzytelnianie dwuskładnikowe.
3. **Neon** — ustawienia konta → zabezpieczenia.

*(Nazwy sekcji bywają zmieniane przez dostawców — szukaj „2FA", „two-factor", „weryfikacja
dwuetapowa".)*

**Przy okazji, w tych samych panelach, sprawdź jedną rzecz:** kto **poza Tobą** ma dostęp do każdego
z tych kont. Stary współpracownik albo nieużywane zaproszenie to ta sama dziura co słabe hasło.

**Zapisz kody zapasowe** w miejscu, do którego masz dostęp bez telefonu. Utrata drugiego składnika
bez kodów zapasowych to utrata dostępu do własnej produkcji.

---

# 3. Odcięcie logowania testowego · 🤖 CLAUDE

**Co to jest.** Klikacze (testy automatyczne) nie potrafią przejść przez ekran logowania Google, więc
aplikacja ma dodatkową, uproszczoną drogę logowania — włączaną zmienną środowiskową
`E2E_TEST_MODE=1`. Na produkcji ta zmienna nie jest ustawiona, więc droga nie istnieje.

**Co jest z tym nie tak.** Zabezpieczenie jest **jednopunktowe**: opiera się wyłącznie na tym, że
nikt nigdy nie ustawi tej zmiennej na produkcji. Pomyłka przy kopiowaniu konfiguracji między
środowiskami wystarczy, żeby otworzyć logowanie bez hasła — po cichu, bez żadnego objawu.

**Jak to zrobię.** Dołożę drugi warunek: uproszczone logowanie działa tylko wtedy, gdy
`E2E_TEST_MODE=1` **oraz** aplikacja nie jest uruchomiona w trybie produkcyjnym. Wtedy nawet
przypadkowe ustawienie zmiennej na produkcji niczego nie otwiera.

**Koszt:** kilka linii. **Ryzyko:** żadne — klikacze chodzą w trybie deweloperskim, więc ich to nie
dotyczy. Sprawdzę to pełnym przebiegiem klikaczy.

---

# 4. Limit żądań do feedu kalendarza · 🤖 CLAUDE

**Co to jest.** Agendę Omnii da się wpiąć do zewnętrznego kalendarza. Klient kalendarza nie ma sesji,
więc uwierzytelnia się **odwoływalnym tokenem w adresie**. Sam token jest w porządku i można go
wymienić — ale **nic nie ogranicza liczby prób jego zgadnięcia**. To jedyna trasa aplikacji, która
działa bez zalogowania.

**Jak to zrobię.** Aplikacja ma już wspólny licznik żądań oparty na bazie (ten sam, który pilnuje
asystenta) — dołożę do niego politykę dla feedu kalendarza i wpięcie w trasę. Limit będzie liczony
po adresie źródłowym, bo przy złym tokenie nie wiadomo jeszcze, o czyj kalendarz chodzi.

**Na co uważam.** Limit musi być na tyle luźny, żeby nie odciąć zwykłego klienta kalendarza, który
odpytuje cyklicznie co kilkanaście minut — i na tyle ciasny, żeby zgadywanie tokenu przestało być
opłacalne. Przy tokenie tej długości nawet niski limit sprowadza zgadywanie do czasu liczonego
w tysiącach lat.

---

# 5. Dokończenie szyfrowania kluczy API · 🤝 RAZEM

**Co to jest.** Klucze do dostawców modeli językowych są w bazie **zaszyfrowane**. Ale szyfrowanie
dołożono później niż same klucze, a mechanizm jest wstecznie zgodny: wartość zapisana wcześniej,
bez znacznika szyfrowania, jest odczytywana jako zwykły tekst. **Działa — ale leży w bazie otwarta**
i taka zostanie, dopóki ktoś jej ponownie nie zapisze.

**Ile takich kluczy masz — nie wiem i nie mogę sprawdzić.** To dane w bazie produkcyjnej, do której
nie mam dostępu. **I to jest właśnie problem:** dziś nie ma jak tego zobaczyć również z panelu.

**Co zrobię ja.** Dołożę w panelu administratora **wyraźny znacznik przy każdym kluczu**:
„zaszyfrowany" albo „jeszcze jawny — zapisz ponownie". Aplikacja ma już funkcję rozpoznającą jedno
od drugiego (`isEncrypted`), tylko **nigdzie jej nie używa** — sprawdziłem. Czyli to jest kilka linii,
a zamienia niewidzialny problem w widoczny.

**Co zrobisz Ty.** Wejdziesz w konfigurację administratora i przy każdym kluczu oznaczonym jako
jawny klikniesz „zapisz" — bez zmiany wartości. Sam zapis go zaszyfruje. To dosłownie tyle.

**Kolejność jest istotna:** ten punkt **musi być zrobiony przed punktem 6**. Powód niżej.

---

# 6. Własna zmienna na klucz szyfrujący · 🤝 RAZEM — **tu kolejność ma znaczenie**

**Co to jest.** Klucze API w bazie są szyfrowane kluczem wyprowadzonym ze zmiennej `CONFIG_SECRET`,
a gdy jej nie ma — z `AUTH_SECRET` (sekretu podpisującego sesje). Dziś `CONFIG_SECRET` nie jest
ustawiony, więc **jeden sekret pełni dwie różne role**.

**Dlaczego to problem.** Rotacja sekretu sesji (rzecz, którą robi się np. po podejrzeniu wycieku)
**unieważnia wtedy wszystkie zapisane klucze API** — przestają się odszyfrowywać. Czyli czynność
naprawcza w jednym obszarze psuje inny. Aplikacja ostrzega o tym przy starcie, ale ostrzeżenie to nie
rozwiązanie.

**⚠️ Pułapka, przez którą ten punkt jest oznaczony jako ryzykowny.** Samo dopisanie `CONFIG_SECRET`
z nową wartością **natychmiast unieważni wszystkie klucze zaszyfrowane dotychczas** — bo zostaną
zaszyfrowane jednym kluczem, a odczytane innym. Efekt: modele przestają działać, a komunikat będzie
mylący („brak klucza"), bo odszyfrowanie zwraca pustą wartość.

**Bezpieczna kolejność — proszę nie zamieniać kroków miejscami:**

1. **Ty:** wchodzisz do konfiguracji administratora i **wypisujesz sobie wartości kluczy API**
   (albo po prostu masz je pod ręką u dostawców).
2. **Ty:** dodajesz w panelu Render zmienną `CONFIG_SECRET` z **długą, losową wartością** (co
   najmniej 32 znaki). Aplikacja się zrestartuje.
3. **Ty:** wchodzisz do konfiguracji administratora i **wklejasz klucze ponownie**. Od tej chwili są
   zaszyfrowane nową, osobną wartością.
4. **Ja:** dopisuję to do dokumentacji odtworzeniowej, żeby przy następnej rotacji nikt nie musiał
   tego odkrywać na nowo.

**Alternatywa, jeśli wolisz uniknąć ryzyka teraz:** ten punkt można **odłożyć**. Dopóki nie rotujesz
`AUTH_SECRET`, obecny stan działa poprawnie — jest mniej elegancki, nie mniej bezpieczny. Ryzyko
materializuje się dopiero w momencie rotacji. **Moja rekomendacja: zrób to, ale spokojnie i nie
w pośpiechu**, najlepiej zaraz po punkcie 5.

---

# 7. Polityka bezpieczeństwa treści (CSP) · 🤖 CLAUDE — **największe zadanie**

**Co to jest.** Nagłówek, w którym aplikacja mówi przeglądarce: „wykonuj wyłącznie skrypty stąd,
ładuj obrazy wyłącznie stamtąd". Gdyby komukolwiek udało się wstrzyknąć obcy skrypt, CSP jest tym,
co go **nie wykona**. To najmocniejsze pojedyncze zabezpieczenie, jakiego aplikacji jeszcze brakuje.

**Dlaczego nie zrobiłem tego przy audycie.** Bo źle napisane CSP **psuje działającą aplikację** —
i to po cichu, w miejscach, których żaden test nie dotyka. Sprawdziłem, co ta aplikacja realnie
robi, i skala jest konkretna:

- **309 plików** używa stylów pisanych wprost w komponentach,
- **20 plików** wstawia gotowy fragment dokumentu (renderowanie tekstu sformatowanego),
- mapy w Pogodzie ładują kafelki z serwera OpenStreetMap,
- skanowanie kodów, dyktowanie i lektor sięgają po sprzęt i dźwięk.

**Co z tego wynika.** Reguła dla stylów **musi** dopuszczać style osadzone — inaczej trzeba przepisać
309 plików, co jest osobnym projektem, a nie zadaniem bezpieczeństwa. Za to reguła dla **skryptów**
— czyli ta, która realnie broni przed wstrzyknięciem — może być ostra od razu. **To jest właściwy
podział: ostro tam, gdzie to chroni, luźno tam, gdzie tylko by przeszkadzało.**

**Jak to zrobię:**
1. Najpierw **tryb obserwacji** — nagłówek, który niczego nie blokuje, tylko *zgłasza*, co by
   zablokował. Zbieramy zgłoszenia z realnego używania aplikacji.
2. Na tej podstawie domykam listę wyjątków — opartą na **faktach z działania**, nie na moim
   domyśle, czego aplikacja używa.
3. Dopiero potem tryb blokujący, osobnym wdrożeniem.

**Dlaczego dwuetapowo.** Bo tylko tak można wdrożyć CSP bez zgadywania. Etap obserwacji jest
całkowicie bezpieczny — nic nie blokuje. **Ty w tym punkcie nie masz nic do zrobienia**, poza
normalnym używaniem aplikacji między etapem 1 a 2.

---

# 8. Powtórka audytu · 🤝 RAZEM

**Co to jest.** Ten audyt opisuje stan na sierpień 2026. Kod się zmienia, biblioteki dostają nowe
podatności, dochodzą moduły — raport zestarzeje się razem z aplikacją.

**Moja propozycja:** przegląd **co kwartał**, plus zawsze przed większym otwarciem aplikacji na nowe
osoby. Za każdym razem mogę:
- przejrzeć zależności pod kątem nowych podatności,
- sprawdzić, czy nowe moduły mają bramkowanie tras i zawężenie własności,
- zaktualizować raport o to, co się zmieniło.

**Czego potrzebuję od Ciebie:** decyzji, czy taki rytm Ci odpowiada. Mogę też **założyć cykliczne
przypomnienie**, które samo uruchomi przegląd — powiedz tylko, czy chcesz.

---

# 9. Dwie rzeczy do potwierdzenia w panelach · 🧑 TY

Te dwie rzeczy w audycie noszą znacznik *[do potwierdzenia]*, bo **nie da się ich odczytać z kodu** —
mieszkają w konfiguracji hostingu. Obie są prawdopodobnie w porządku, ale „prawdopodobnie" to za mało,
żeby wpisać je do raportu jako sprawdzone.

1. **Czy produkcyjny adres bazy wymaga szyfrowania.** Panel Render → zmienne środowiskowe →
   `DATABASE_URL`. Sprawdź, czy adres kończy się na `?sslmode=require`. Dokumentacja projektu tak
   mówi, ale sama wartość jest sekretem po stronie hostingu.
2. **Czy wymuszone jest przekierowanie na HTTPS.** Panel Render → ustawienia usługi. To jest
   domyślne zachowanie i po dołożeniu nagłówka HSTS ma mniejsze znaczenie niż wcześniej — ale warto
   zerknąć.

**Nie musisz mi podawać żadnych wartości** — wystarczy „jest" albo „nie ma". Sekretów nie wklejaj do
rozmowy.

---

## Co zostaje poza tym planem

**Przejście na Next 16.** Zamknęłoby pozostałe pięć podatności (wszystkie „wysokie", żadna
krytyczna). To zmiana łamiąca w silniku, na którym stoi cała aplikacja — osobne zadanie z własnym
planem i własną weryfikacją, nie punkt na liście bezpieczeństwa. Warto zaplanować, ale nie pod
presją: te pięć podatności dotyczy narzędzi budowania i ujawniania punktów końcowych, nie
uwierzytelniania.

**Testy penetracyjne i audyt zewnętrzny.** Ten dokument i poprzedni to przegląd własnego kodu
i konfiguracji. Nie zastępuje spojrzenia z zewnątrz — jeśli aplikacja ma faktycznie trafić do wielu
osób, to jest naturalny następny krok, ale po domknięciu tej listy, nie przed.

---

## Stan wykonania

Ten rozdział będzie aktualizowany razem z postępem — pole „stan" zmienia się z „do zrobienia" na
„zrobione" wraz z kolejnymi wdrożeniami.

| # | Zadanie | Kto | Stan |
|---|---|---|---|
| 1 | Aktualizacja zależności | 🤖 | do zrobienia |
| 2 | Drugi składnik logowania | 🧑 | do zrobienia |
| 3 | Odcięcie logowania testowego | 🤖 | do zrobienia |
| 4 | Limit żądań do feedu kalendarza | 🤖 | do zrobienia |
| 5 | Dokończenie szyfrowania kluczy | 🤝 | do zrobienia |
| 6 | Własna zmienna na klucz szyfrujący | 🤝 | do zrobienia |
| 7 | Polityka bezpieczeństwa treści | 🤖 | do zrobienia |
| 8 | Powtórka audytu | 🤝 | do zrobienia |
| 9 | Potwierdzenie w panelach | 🧑 | do zrobienia |
$plan_bezp$,
  'system',
  'db',
  NULL,
  NULL,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("slug") DO NOTHING;
