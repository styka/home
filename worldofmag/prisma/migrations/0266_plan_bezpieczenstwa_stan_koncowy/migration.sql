-- 106 — DOMKNIĘCIE STANU w raporcie „Plan domknięcia bezpieczeństwa".
--
-- Właściciel potwierdził wykonanie swoich trzech pozycji (drugi składnik logowania, przegląd kluczy,
-- potwierdzenia w panelach hostingu i bazy). Po stronie Claude Code doszła poprawka rozpoznawania
-- powodu odmowy lektora i dialog wznowienia pracy. Zostaje jedno zadanie merytoryczne (CSP)
-- i jedno odłożone decyzją właściciela.
--
-- Ta sama technika co w 0264 (C-11: migracji zastosowanej się nie edytuje): ucinamy treść na
-- nagłówku „## Stan wykonania" i doklejamy nowy blok zaczynający się tym samym nagłówkiem, więc
-- powtórne wykonanie daje identyczny wynik.

UPDATE "Report"
SET
  "content" = left("content", position('## Stan wykonania' in "content") - 1) || $stan$## Stan wykonania

**Zaktualizowano:** sierpień 2026, po domknięciu punktów 2, 5 i 9. Otwarty pozostaje **wyłącznie
punkt 7** (polityka bezpieczeństwa treści) oraz świadomie odłożony punkt 6.

| # | Zadanie | Kto | Stan |
|---|---|---|---|
| 1 | Aktualizacja zależności | 🤖 | ✅ **zrobione** — wszystkie trzy podatności krytyczne zamknięte |
| 2 | Drugi składnik logowania | 🧑 | ✅ **zrobione** — potwierdzone przez właściciela |
| 3 | Odcięcie logowania testowego | 🤖 | ✅ **zrobione** |
| 4 | Limit żądań do feedu kalendarza | 🤖 | ✅ **zrobione** |
| 5 | Dokończenie szyfrowania kluczy | 🤝 | ✅ **zrobione** — wskaźnik w panelach, klucze przejrzane |
| 6 | Własna zmienna na klucz szyfrujący | 🤝 | ⏸️ **odłożone** świadomą decyzją |
| 7 | Polityka bezpieczeństwa treści | 🤖 | ⬜ **jedyne otwarte zadanie** |
| 8 | Powtórka audytu | 🤝 | ✅ **zrobione** — przypomnienie kwartalne założone |
| 9 | Potwierdzenie w panelach | 🧑 | ✅ **zrobione** — szyfrowane połączenie z bazą i przekierowanie na HTTPS potwierdzone |

---

## Co się zmieniło w tym wdrożeniu

**Punkty 2, 5 i 9 — Twoja część planu jest zamknięta.** Drugi składnik logowania działa na kontach,
klucze zostały przejrzane w panelu (wskaźnik „zaszyfrowany / jawny" pokazuje stan przy każdym z nich),
a oba potwierdzenia w panelach hostingu i bazy wypadły pomyślnie.

**Lektor — poprawka rozpoznawania powodu odmowy.** Objaw: lektor twierdził, że dostawca **odrzuca
klucz**, przez co powstały dwa nowe klucze bez potrzeby. Przyczyna nie była w kluczu. Część dostawców
mowy (m.in. ElevenLabs) na **wyczerpane kredyty** odpowiada tym samym kodem 401 co na zły klucz,
a prawdziwy powód podaje dopiero w treści odpowiedzi — kod czytał sam kod odpowiedzi i wybierał
najczęstszą interpretację. Teraz treść odpowiedzi jest czytana i to ona rozstrzyga: wyczerpany limit
jest nazywany wyczerpanym limitem. Lekcja jest ogólniejsza niż ta jedna usterka — **kod odpowiedzi
mówi, że się nie udało, nie mówi dlaczego**; przy dostawcach zewnętrznych to rozróżnienie decyduje,
czy komunikat kieruje użytkownika w dobrą stronę, czy w ślepą uliczkę.

**Dialog wznowienia pracy.** Punkt 7 wymaga kilku dni zbierania zgłoszeń, więc nie da się go zrobić
„do końca" w jednej sesji — a przerwana robota przepada razem z kontekstem. Dlatego po wejściu do
aplikacji administrator zobaczy **okno z gotowym promptem do skopiowania**, nie częściej niż raz
dziennie. Świadomie nie jest to powiadomienie: powiadomienie ginie w dzwonku razem z resztą i niesie
zdanie, a nie tekst do wklejenia. Treść promptu mieszka w bazie i zmienia się migracją — tak samo jak
treść tego raportu — więc opisuje zawsze aktualny stan prac. Okno zniknie samo, gdy punkt 7 zostanie
domknięty.

---

## Co zostało

**Punkt 7 — polityka bezpieczeństwa treści (CSP).** Jedyne otwarte zadanie merytoryczne. Rozpoznanie
jest już zrobione i zapisane w prompcie, który zobaczysz w oknie po wejściu do aplikacji: aplikacja
nie wstawia własnych skryptów osadzonych (więc skrypty można ograniczyć ostro), za to 309 plików
pisze style wprost w komponentach (więc style trzeba dopuścić luźno). Wykonanie w trzech etapach:
znacznik jednorazowy w warstwie pośredniej, kilka dni w trybie **tylko-zgłaszaj**, dopiero potem
blokowanie. Twoja rola w środkowym etapie to normalne korzystanie z aplikacji — a zwłaszcza zajrzenie
do Pogody z mapą, skanowania kodów i lektora, bo to one dołożą najwięcej wyjątków.

**Punkt 6 — osobna zmienna na klucz szyfrujący.** Odłożony Twoją decyzją; kolejność kroków opisana
wyżej w tym raporcie pozostaje aktualna na moment, w którym zdecydujesz się to domknąć.

**Poza planem: przejście na Next 16.** Zamknęłoby siedem pozostałych podatności (zero krytycznych),
które wiszą na jednym łańcuchu zależności. To zmiana łamiąca w silniku aplikacji — osobne zadanie
z własnym planem, nie punkt listy bezpieczeństwa.
$stan$,
  "updatedAt" = CURRENT_TIMESTAMP
WHERE "slug" = 'plan-domkniecia-bezpieczenstwa'
  AND position('## Stan wykonania' in "content") > 0;
