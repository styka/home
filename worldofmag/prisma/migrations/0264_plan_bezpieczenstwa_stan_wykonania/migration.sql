-- 105 — AKTUALIZACJA STANU W RAPORCIE „Plan domknięcia bezpieczeństwa".
--
-- Migracja 0263 wprowadziła raport z tabelą stanu, w której wszystkie pozycje stały jako
-- „do zrobienia". Cztery są już zrobione, jedna odłożona decyzją właściciela.
--
-- Treści raportu NIE zmieniamy przez edycję migracji 0263 — migracja już zastosowana nie zmienia się
-- nigdy (C-11). Zamiast tego podmieniamy końcowy rozdział `UPDATE`-em.
--
-- IDEMPOTENTNE bez `ON CONFLICT`: instrukcja ucina treść na nagłówku „## Stan wykonania" i dokleja
-- nowy blok, który zaczyna się tym samym nagłówkiem. Powtórne wykonanie utnie w tym samym miejscu
-- i doklei to samo — wynik jest identyczny.

UPDATE "Report"
SET
  "content" = left("content", position('## Stan wykonania' in "content") - 1) || $stan$## Stan wykonania

**Zaktualizowano:** sierpień 2026, po wdrożeniu punktów 1, 3, 4 i 8.

| # | Zadanie | Kto | Stan |
|---|---|---|---|
| 1 | Aktualizacja zależności | 🤖 | ✅ **zrobione** — wszystkie trzy podatności krytyczne zamknięte |
| 2 | Drugi składnik logowania | 🧑 | ⬜ **czeka na Ciebie** |
| 3 | Odcięcie logowania testowego | 🤖 | ✅ **zrobione** |
| 4 | Limit żądań do feedu kalendarza | 🤖 | ✅ **zrobione** |
| 5 | Dokończenie szyfrowania kluczy | 🤝 | 🟡 **wskaźnik gotowy — czeka na Twoje kliknięcia** |
| 6 | Własna zmienna na klucz szyfrujący | 🤝 | ⏸️ **odłożone** świadomą decyzją |
| 7 | Polityka bezpieczeństwa treści | 🤖 | ⬜ do zrobienia |
| 8 | Powtórka audytu | 🤝 | ✅ **zrobione** — przypomnienie kwartalne założone |
| 9 | Potwierdzenie w panelach | 🧑 | ⬜ **czeka na Ciebie** |

---

## Co się zmieniło w tym wdrożeniu

**Punkt 1 — zależności.** `npm audit fix` bez `--force`. Plik `package.json` pozostał nietknięty;
zmienił się wyłącznie plik blokady, w 13 pakietach. **Bilans: 12 podatności → 7, w tym wszystkie
trzy krytyczne zamknięte.** Pozostałe siedem to jeden łańcuch wymagający Next 16.

Ponieważ biblioteka logowania przeskoczyła o siedem wersji roboczych, logowanie zostało sprawdzone
osobno — przechodzi, łącznie z faktycznym zalogowaniem konta administratora i konta o ograniczonych
uprawnieniach.

**Punkt 3 — logowanie testowe.** Doszedł drugi warunek. Rzecz, która wyglądała na oczywistą, była
pułapką: warunkiem **nie** jest tryb produkcyjny, bo klikacze serwują aplikację właśnie w trybie
produkcyjnym — taka bramka wyłączyłaby logowanie testowe w samych testach. Rozróżnienie, o które
chodzi, brzmi „czy to maszyna hostingu".

**Punkt 4 — feed kalendarza.** Limit stoi **przed** odczytem z bazy i liczy po adresie źródłowym.
Liczenie po użytkowniku byłoby możliwe dopiero po trafieniu w token, czyli dokładnie za późno.

**Punkt 5 — jawne klucze.** Panel pokazuje teraz przy każdym ustawionym kluczu, czy jest
zaszyfrowany — w konfiguracji systemu i przy dostawcach modeli. Wcześniej dymek przy kluczu
**twierdził**, że jest zaszyfrowany, nie sprawdzając tego. Stan pokazujemy przy każdym kluczu, nie
tylko przy jawnym: sam brak ostrzeżenia jest dwuznaczny.

**Punkt 6 — odłożony świadomie.** Obecny stan działa poprawnie; ryzyko materializuje się dopiero
przy rotacji sekretu sesji. Kolejność kroków opisana wyżej w tym raporcie pozostaje aktualna na
moment, w którym zdecydujesz się to domknąć.

**Punkt 8 — powtórka.** Założone przypomnienie kwartalne (1 stycznia, kwietnia, lipca i października).
Uruchomi przegląd zależności, sprawdzenie nowych modułów i tras, przegląd punktów końcowych bez sesji
oraz aktualizację stanu tego planu.

---

## Twoja lista — stan aktualny

1. **Drugi składnik logowania** na kontach Google, Render i Neon *(punkt 2 — najważniejsze)*.
2. **Klucze oznaczone jako JAWNE** — wejdź w konfigurację i przy każdym takim kliknij zapis.
   Wartości nie trzeba zmieniać; sam zapis je zaszyfruje. Jeśli żaden klucz nie jest tak oznaczony,
   ten punkt jest już zamknięty i nie musisz nic robić.
3. **Dwa potwierdzenia w panelach** *(punkt 9)* — szyfrowanie połączenia z bazą i przekierowanie na
   HTTPS.

Pozostałe pozycje po mojej stronie: **polityka bezpieczeństwa treści** (punkt 7) i — jeśli
zdecydujesz — **osobna zmienna na klucz szyfrujący** (punkt 6).
$stan$,
  "updatedAt" = CURRENT_TIMESTAMP
WHERE "slug" = 'plan-domkniecia-bezpieczenstwa'
  AND position('## Stan wykonania' in "content") > 0;
