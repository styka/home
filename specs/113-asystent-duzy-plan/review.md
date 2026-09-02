# Recenzja: 113 — Asystent dowozi DUŻY plan

- **Spec:** ./spec.md · **Plan:** ./plan.md · **Zadania:** ./tasks.md (14/14) · **Weryfikacja:** ./verify.md
- **Data:** 2026-09-02
- **Diff:** `2f6910f..HEAD` — 14 plików, +1248 / −40 (z czego ~540 linii to artefakty pipeline'u, ~145 testy)

## Ustalenia

---

### U-1 · correctness · NAPRAWIONE — kompletny plan oznaczany jako niepełny
**Plik:** `src/platform/ai/agentProtocol.ts` (`odzyskajAkcjeZUcietego`) + `route.ts` (`planZUcietego`)

Odzysk zwracał tylko listę akcji, a `planZUcietego` **bezwarunkowo** ustawiał `niepelny: true`.

**Scenariusz awarii:** model kończy plan polem po tablicy akcji (`{"step":"plan","actions":[…],
"thought":"Przenios`) i zostaje ucięty **na tym polu**. Tablica akcji jest wtedy **domknięta**, więc
odzyskujemy **wszystkie** akcje — a mimo to użytkownik dostaje komunikat „Plan jest niepełny…
poproś o dokończenie reszty". Reszty nie ma; wysyłamy go po nic.

**Dlaczego to zgłaszam mimo rzadkości:** to jest **dokładnie ta klasa błędu, którą ten przebieg
naprawia** — mówienie użytkownikowi nieprawdy o tym, dlaczego coś się skończyło. Zgłoszenie zaczęło
się od „zabrakło kroków", które też było nieprawdą.

**Poprawka:** `odzyskajAkcjeZUcietego` zwraca `{ akcje, kompletna }`, gdzie `kompletna` mówi, czy
tablica zdążyła się domknąć; `niepelny = !kompletna`. Odpowiedź nadal była ucięta — ale plan jest
całością i nie kłamiemy na jego temat. **Próba potwierdzająca uruchomiona** przed poprawką (zwracał
2 akcje z flagą „niepełny"); nowy test pilnuje obu przypadków.

---

### U-2 · observation · świadomie zostawione — odzysk bierze OSTATNIĄ uciętą odpowiedź
**Plik:** `route.ts`, blok degradacji

Gdy pierwsza próba zostanie ucięta, model dostaje polecenie „odpowiedz ZNACZNIE krócej"; jeśli druga
też zostanie ucięta, odzyskujemy z **niej**. Teoretycznie mogła zawierać mniej akcji niż pierwsza.

Nie naprawiam, bo: (a) druga próba dochodzi do skutku dopiero, gdy pierwsza się nie sparsowała,
(b) trzymanie „najlepszego dotąd odzysku" to dodatkowy stan w pętli, której złożoność jest tu
głównym ryzykiem, (c) po podniesieniu budżetu do 4000 dwukrotne ucięcie jest scenariuszem
brzegowym. Odnotowane, żeby następna osoba nie uznała tego za przeoczenie.

---

### U-3 · observation · POZA ZAKRESEM — `navigate` i `report` nadal mogą kręcić się bez licznika
**Plik:** `route.ts`, gałęzie `navigate` (zły adres) i `report` (pusta treść)

Obie robią `continue` bez inkrementowania żadnego licznika, więc mogą spalić wszystkie iteracje —
tak jak „Nieznany step" przed 113. **To jest defekt sprzed 113**, innego rodzaju niż zgłoszony
(dotyczy kroków POPRAWNYCH, ale niewykonalnych), i naprawianie go tutaj byłoby poszerzaniem zakresu
bez zgłoszenia (C-53). Zapisuję jako znany kandydat na osobny przebieg, a nie ukrywam.

---

### Sprawdzone i CZYSTE

| Obszar | Wynik |
|---|---|
| **Ścieżka SSE (domyślna dla czatu!)** | ✅ Sprawdzona osobno, bo to najbardziej prawdopodobne miejsce cichej regresji: `send({type:"final", body: result.body})` przekazuje **całe** body, a klient robi `applyResponse(evt.body)` — **żadnej białej listy pól**, więc `niepelny` dociera także w streamingu |
| **Guardy dostępu (C-21/C-17)** | ✅ Nietknięte — 113 nie dotyka ani jednego zapytania do bazy |
| **`AIAction` bez egzekutora (C-23)** | ✅ `check:actions`: 164 akcje, **tyle samo co przed** — 113 nie dodaje żadnej |
| **Odzyskane akcje omijają walidację?** | ✅ Nie. Przechodzą przez `normalizeActions` (odrzuca obiekty bez `type`) i dalej przez kontrakt akcji w egzekutorze — tę samą bramkę co akcje z planu pełnego |
| **Akcje niszczące** | ✅ `DESTRUCTIVE_ACTION_TYPES` i logika 041 bez zmian; plan częściowy idzie tą samą ścieżką do panelu potwierdzenia |
| **Zachowanie progów 080 / raportu** | ✅ Policzone: `wsadowe` → max(1200,4000)=4000 (jak było), `raport` → max(1200,2800)=2800 (jak było). Usunięcie trzech stałych **przeniosło** regułę, nie zmieniło jej |
| **Skanowanie tablicy akcji** | ✅ Świadome stringów i escape'ów — testy pokrywają klamrę w opisie (`{co 3 miesiące}`) i urwanie wewnątrz stringu z escapowanym cudzysłowem |
| **`\|\| "{}"` — obrona dwuwarstwowa** | ✅ Próba mutacyjna: nawet po cofnięciu T-1 `czyUzytecznyKrok({})` = `false`, więc flaga ucięcia przetrwa. Jedna zmiana nie stoi na jednej linijce |
| **Bezpieczeństwo (C-41)** | ✅ Nowy log `agent.loop.bezKroku` niesie wyłącznie liczniki; zero treści promptu, zero kluczy |
| **C-30/C-31** | ✅ Zero kolorów i zero zmian układu; jedyna zmiana UI to doklejone zdanie |
| **C-32** | ✅ `planNiepelny` w `messages/pl.json` przez `useTranslations`; `check:i18n` zielony |
| **Martwy kod (C-53)** | ✅ Trzy stałe **usunięte**, nie dołożone. `planZUcietego` to jeden helper wołany z dwóch miejsc |

## Bramki po poprawce recenzji

| Komenda | Wynik |
|---|---|
| `tsc --noEmit -p tsconfig.test.json` | ✅ |
| `npm run test:unit` | ✅ **1365/1365** (10 nowych testów) |
| `next lint --dir src` | ✅ 0 błędów |
| `next build` | ✅ Compiled successfully |
| 13 bramek repo + `check:perf` | ✅ (pełna tabela w `verify.md`) |

## Werdykt

**APPROVE Z UWAGAMI.**

Jedno realne ustalenie (U-1) — znalezione we własnym diffie, tej samej natury co zgłoszenie
(nieprawdziwy komunikat o przyczynie), naprawione i pokryte testem. Dwa pozostałe to świadomie
zostawione obserwacje: jedna brzegowa (U-2), druga **sprzed 113 i poza zakresem** (U-3), zapisana
zamiast przemilczana.

Uwagi przechodzące dalej — **żadna nie blokuje merge**, obie to potwierdzenie zachowania modelu,
którego sandbox wykonać nie może:

1. Powtórzyć na `develop` „załóż psa Raj na podstawie zadań" — sprawdzić, że tura kończy się
   **planem** z profilem, przeniesionymi obowiązkami i listą informacji nieprzenoszalnych
   (AC-10, AC-11).
2. Porównać sumę z `AiCall` z punktem odniesienia **1,42 zł** (AC-13; projekcja: 0,59–0,95 zł).
