# Rozdział 1 — Przegląd funkcjonalny projektu

## Czym jest Omnia

**Omnia** (produkt znany też jako **WorldOfMag** — „świat maga”) to modularny, osobisty **system do
zarządzania życiem i pracą**. Z pierwotnych 3 modułów urósł do **~20–26 działów** spiętych wspólnym
modelem własności, systemem uprawnień (RBAC), powiadomieniami, koszem (soft-delete), magazynem
plików na Google Drive i **asystentem AI**, który potrafi czytać i modyfikować dane we wszystkich
modułach.

Filozofia produktu w jednym zdaniu: **„operacyjny system dla życia”** — jedno miejsce, w którym
ogarniasz zakupy, zadania, notatki, kuchnię, zwierzęta, zdrowie, nawyki, pojazdy, finanse, naukę
języków, wiadomości, pogodę, magazyn, warsztat, usługi, kontakty i kalendarz.

## Dla kogo

- **Rdzeń (dziś):** developer power-user — właściciel projektu — i wąskie grono 1–50 osób.
- **Cel (po marketingu):** każdy, kto chce **uporządkować życie** (osoby prywatne, rodziny, grupy)
  oraz **mały biznes**, który dawniej nie mógł sobie pozwolić na drogie, branżowe oprogramowanie.
- **Wizja monetyzacji:** funkcje do organizacji życia i podstawowe wersje działów branżowych —
  **za darmo** (utrzymanie z reklam lub opłaty „bez reklam”); zaawansowane funkcje
  pracy/biznesu — **płatne**. Szczegóły w Części IV.

## Filozofia UX

Aplikacja jest celowo „dla power-usera”, z aspiracją do szerokiej dostępności:

- **Keyboard-first** — skróty w stylu vim (`j/k`, `x`, `e`, `d`, `/`, `Ctrl+K` paleta poleceń).
- **Ciemny motyw, minimalizm** — estetyka Linear / GitHub / VS Code; pełna **skinowalność** (motywy
  jasny/sepia/własne przez tokeny CSS).
- **Zero zbędnych kliknięć i animacji.**
- **Mobile-first w warstwie nawigacji** — osobny układ na telefon (górny pasek, dolny tab bar,
  menu pełnoekranowe), wszystko z poszanowaniem `safe-area`.

## Mapa modułów (stan funkcjonalny)

> Pełną, „uczciwą” ocenę dojrzałości każdego modułu daje **Rozdział 3**. Tutaj — co aplikacja
> **robi**, dział po dziale.

### Organizacja życia (rdzeń osobisty)
- **Home / Asystent AI** (`/`) — pulpit z personalizacją + globalny asystent („magiczna ikona”):
  konwersacyjny czat, pamięć rozmów, streaming myśli, odczyt i modyfikacja wszystkich modułów,
  wyszukiwanie w sieci, propozycje raportów. Plus poranny briefing na żądanie.
- **Zakupy** (`/shopping`) — listy, inteligentne parsowanie ilości, kategorie/jednostki/produkty,
  **mapy sklepów** (graf z trasowaniem), ceny i „zakończ zakupy” → księgowanie w Portfelu.
- **Zadania** (`/tasks`) — projekty, własne statusy list, grupy projektów, cykliczność, podzadania,
  **widoki Kanban i Timeline**, tagi, bulk-add.
- **Notatki** (`/notes`) — live-preview markdown, **wikilinki `[[Tytuł]]`** + backlinki, ważone
  wyszukiwanie, załączniki, historia wersji.
- **Kuchnia** (`/kitchen`) — przepisy, plan posiłków, spiżarnia, import (URL/OCR/AI), wartości
  odżywcze, generowanie przepisów i planu tygodnia.
- **Zwierzęta** (`/pets`) — opieka, husbandry, **hodowla + genetyka**, alarmy parametrów terrariów,
  eksport weterynaryjny (PDF + CSV), kalendarz zwierzęcy.
- **Zdrowie** (`/health`) — wizyty + **repozytorium badań** (PDF/obraz) z analizą trendów oraz
  **Leki i pielęgnacja** (dawkowanie, cykliczna pielęgnacja, agenda „dziś”).
- **Nawyki** (`/habits`) — heatmapa, serie, cele tygodniowe, integracja nawyk↔zadanie.
- **Flota** (`/flota`) — pojazdy, paliwo, serwis, załączniki (faktury, OC, dowód).
- **Portfel** (`/portfel`) — elementy/wpisy, **budżety i cele**, raporty miesięczne, **wielowalutowość**
  (kursy, NBP), **auto-wydatki** księgowane z innych modułów.
- **Języki** (`/languages`) — fiszki SRS (SuperMemo-2), TTS/wymowa, tryb pisania, serie nauki.
- **Wiadomości** (`/wiadomosci`) — RSS + filtrowanie LLM, **wersjonowana baza wiedzy** per
  temat/źródło, web-search (Brave/DDG), hot topics.
- **Pogoda** (`/pogoda`) — Open-Meteo, porady „co robić” od LLM, watchery (presety + własne).
- **Magazynowanie** (`/magazynowanie`) — dwa tryby **Dom/Pro**: pozycje, skan kodów, etykiety QR,
  dokumenty PZ/WZ/faktury (OCR), zamówienia, analityka (ABC/dead-stock), partie/loty FEFO.
- **Warsztaty** (`/warsztaty`) — dwa tryby **Dom/Pro**: rejestr sprzętu, katalog sugestii wg profilu,
  przeglądy, dziennik projektów.

### Współpraca, usługi i spójność
- **Usługi / Marketplace** (`/services`) — pełny marketplace usług (model Fixly + Booksy): profile
  wykonawców (badge „zweryfikowany”, publiczny profil + slug), oferty, zlecenia ze statusami,
  **czat**, **wyceny**, **portfolio**, **rezerwacje slotów**, oceny, **płatności/faktury** (spięte z
  Portfelem), ulubieni, kody rabatowe, **firmy wieloosobowe**, **spory + moderacja**.
- **Kontakty / CRM** (`/contacts`) — lekki, osobisty CRM (kontakty z tagami).
- **Kalendarz** (`/calendar`) — **zunifikowana agenda** agregująca terminy zadań, posiłki, leki i
  opiekę zdrowotną, opiekę nad zwierzętami, powtórki SRS i serwis floty w jednym widoku miesiąca.
- **Powiadomienia** — silnik per-użytkownik (dzwonek w chrome), przypomnienia z agendy/terminów,
  działa **bez crona** (sync przy logowaniu/otwarciu).
- **Kosz / Trash** (`/trash`) — zunifikowane odzyskiwanie skasowanych elementów z retencją; nawet
  usunięcia wykonane przez AI są odwracalne.
- **Skórki** (`/settings` + `/admin/skins`) — motywy jako mapy zmiennych CSS, walidowane, 5
  systemowych + własne/współdzielone.

### Narzędzia i pogranicze
- **Raporty** (`/reports`) — dokumenty markdown (systemowe/użytkownika/zespołu); treść w DB **lub**
  na Google Drive użytkownika.
- **QA** (`/qa`) — wewnętrzne scenariusze testowe (Epic → Story → Scenario).
- **Truck** (`/truck`) — trasowanie ciężarowe (klient ORS gotowy, UI minimalny — **częściowe**).
- **Praca / Work** (`/work`) — **stub** (pozycja w menu, „wkrótce”).
- **Panel Admina** (`/admin`) — RBAC, audyt, konfiguracja, LLM, zdrowie systemu, dokumentacja,
  raporty, skórki, kategorie, QA, playground, architektura — oraz **ten audyt**.

## Co spina to w całość (przekrojowo)

- **Wspólny model własności** — każdy zasób należy do użytkownika **lub** zespołu (system 3-poziomowy).
- **RBAC** — uprawnienia `module.*`, role, strażnik samo-wykluczenia admina.
- **Asystent AI** — jeden agent czytający i modyfikujący wszystkie moduły, z przeglądem akcji przed
  wykonaniem i odwracalnością.
- **Powiadomienia, kalendarz, kosz, Drive, skórki** — warstwy działające **w poprzek** modułów.

## Wniosek rozdziału

Funkcjonalnie Omnia jest **zaskakująco kompletna jak na projekt jednoosobowy** — pokrywa szerokość,
której nie powstydziłby się dojrzały zespół. To jednocześnie największa siła (wartość „wszystko w
jednym”) i największe ryzyko (utrzymanie spójności i jakości na taką szerokość). Te dwa wątki — wartość
szerokości vs. koszt jej utrzymania — wracają w niemal każdej debacie tego audytu.
