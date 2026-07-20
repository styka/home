# Spec: Asystent AI nie redaguje treści opisu zadania wpisanej przez użytkownika

- **ID:** 012-task-description-verbatim
- **Status:** draft <!-- draft | planned | in-progress | verified | done -->
- **Autor sesji:** Claude Code (spec-driven pipeline)
- **Data:** 2026-07-20
- **Moduł(y):** Home / Asystent AI (`AICommandSheet` + agent) + Tasks (tworzenie zadań, w tym zgłoszenia admina)

> **Zasada speca:** opisujemy **CO i DLACZEGO**, nigdy **JAK**. Zero nazw plików, tabel, bibliotek, endpointów.

## 1. Problem / potrzeba
Gdy użytkownik dodaje zadanie przez asystenta AI, asystent **przeredagowuje** treść opisu, którą wpisał
użytkownik — zamienia ją na formę bezosobową/rzeczową i „poprawia" gramatykę/interpunkcję. To samo dzieje
się, gdy zadanie powstaje jako **zgłoszenie admina** (bug lub prośba o modyfikację aplikacji przez tryb
wskazywania „robaczek"). Dla właściciela to problem: opis miał być **dokładnie tym, co wpisał**. Redakcja
gubi jego oryginalne słowa, ton i intencję — a przy zgłoszeniach o bugach/zmianach w aplikacji zmieniony
opis potrafi zniekształcić sens polecenia dla osoby, która potem je realizuje.

## 2. Cel i miary sukcesu
- Cel: opis zadania tworzonego przez asystenta AI zawiera **oryginalną treść użytkownika w formie
  niezmienionej** (verbatim, dokładnie jak wpisał), a informacje dodatkowe doklejane dziś do opisu
  (np. kontekst zgłoszenia z trybu wskazywania) są **nadal dołączane** — tak jak teraz.
- Sukces mierzymy: dla reprezentatywnych wpisów użytkownika (zdanie w 1. osobie, z literówką, z listą,
  ze slangiem) tekst wpisany przez użytkownika **pojawia się w opisie utworzonego zadania bez zmian
  słów** (brak zamiany na formę bezosobową, brak „poprawek" gramatycznych, brak streszczenia).

## 3. Historyjki użytkownika
- Jako użytkownik dodający zadanie przez asystenta chcę, żeby opis zadania był **dokładnie tym, co
  napisałem**, żeby nie tracić moich oryginalnych słów i intencji.
- Jako **admin zgłaszający buga / prośbę o zmianę aplikacji** (tryb wskazywania) chcę, żeby mój opis
  trafił do zadania **bez przeredagowania**, a kontekst wskazanego miejsca był **nadal** dołączony —
  żeby osoba realizująca zgłoszenie czytała moje własne sformułowanie, nie parafrazę.
- Jako użytkownik chcę, żeby **tytuł** zadania nadal był **generowany zwięźle na podstawie treści** —
  to działa dobrze i ma zostać.

## 4. Kryteria akceptacji (testowalne)
Format Given/When/Then — każde musi dać się zweryfikować w `/verify`.
- [ ] **AC-1** — Given użytkownik prosi asystenta o dodanie zadania podając jednozdaniowy/dłuższy opis
  w pierwszej osobie (np. „muszę oddać książki do biblioteki w piątek"), when asystent proponuje akcję
  utworzenia zadania, then **opis** zadania zawiera tekst użytkownika **słowo w słowo, bez** zamiany na
  formę bezosobową i **bez** „poprawek" gramatyczno-interpunkcyjnych.
- [ ] **AC-2** — Given opis użytkownika zawiera literówki, skróty lub styl potoczny, when powstaje
  zadanie, then te elementy **pozostają nienaruszone** w opisie (nic nie jest „poprawiane", streszczane
  ani pomijane).
- [ ] **AC-3** — Given użytkownik podał tylko jeden tekst (bez wyraźnego rozdziału tytuł/treść), when
  powstaje zadanie, then **tytuł** jest nadal **wygenerowaną, krótką etykietą** na podstawie treści, a
  **treść** = oryginalny tekst użytkownika (zachowane obecne zachowanie „długi tekst → description +
  krótki, wygenerowany title"; niezmieniona pozostaje też reguła, że sam krótki tytuł typu „kup mleko"
  idzie jako title).
- [ ] **AC-4** — Given admin robi zgłoszenie przez tryb wskazywania („robaczek") i wpisuje własny opis
  problemu/prośby, when powstaje zadanie w projekcie „Omnia", then opis zadania zawiera **oryginalny
  tekst admina bez przeredagowania** **oraz** — tak jak dotąd — **kontekst wskazanego miejsca** (route,
  obszar, sekcja, element itd.).
- [ ] **AC-5** — Given zgłoszenie admina jak w AC-4, when powstaje zadanie, then **tytuł** jest nadal
  zwięźle **wygenerowany** przez asystenta (podsumowanie zgłoszenia) — to zachowanie nie zmienia się.
- [ ] **AC-6** — Given wklejona **lista** rzeczy do zrobienia (bulk add: wiele linii/myślników), when
  asystent tworzy po jednym zadaniu na pozycję, then treść każdej pozycji trafia do odpowiedniego pola
  **bez przeredagowania oryginalnego tekstu pozycji** (mapowanie pozycji na osobne zadania zostaje).

## 5. Zakres
**W zakresie:**
- Tworzenie zadań przez asystenta AI (zwykła prośba „dodaj zadanie…") — opis = oryginalna treść
  użytkownika verbatim; tytuł nadal generowany.
- Ścieżka zgłoszenia admina (tryb wskazywania „robaczek": bug / prośba o modyfikację aplikacji) — opis
  admina verbatim + **nadal doklejany** kontekst wskazanego miejsca; tytuł nadal generowany.
- Bulk add zadań — zachowanie mapowania pozycji na osobne zadania z zachowaniem oryginalnej treści
  pozycji (bez przeredagowania).

**Poza zakresem (świadomie):**
- Redagowanie/normalizacja opisów w **innych** modułach (notatki, nawyki, przepisy, warsztaty itd.) —
  tam obecne zachowanie zostaje bez zmian.
- Zmiana sposobu **generowania tytułu** (nadal krótka etykieta z treści — działa dobrze).
- Zmiana zawartości/formatu **kontekstu wskazanego miejsca** doklejanego przy zgłoszeniach admina
  (dołączamy go dalej tak jak teraz).
- Osobna ścieżka „zgłoś problem z czatem" (spec 002) — jej treść to zrzut rozmowy/logów, nie swobodny
  opis użytkownika do redakcji, więc jej nie dotyczy.
- Poprawki opisu przy **edycji** istniejącego zadania (`update_task`) traktujemy tą samą zasadą
  „nie przeredagowuj treści użytkownika", ale nie rozszerzamy zakresu poza to (patrz Decyzje właściciela).

## 6. Wpływ na Omnia
- **Uprawnienie / RBAC:** brak zmian — bez nowego slug'a `module.*` (C-22). Zgłoszenia admina pozostają
  gated istniejącym `isAdmin` (jak dziś `FeedbackInspector`).
- **Własność danych:** bez zmian — zadania powstają w projekcie właściciela przez istniejący przepływ
  (`ownerId`, C-21). Brak nowej encji, brak migracji.
- **Asystent AI:** brak nowej `AIAction` ani read-toola (C-23 nie dotyczy). Zmiana dotyczy wyłącznie
  **sposobu, w jaki asystent wypełnia pole opisu** przy tworzeniu zadania — treść użytkownika trafia do
  opisu wiernie, bez redakcji.
- **Kalendarz / powiadomienia / trash:** nie dotyczy.

## 7. Zgodność z konstytucją
- **C-01/C-02** — praca wyłącznie w `worldofmag/`, importy przez alias `@/*`.
- **C-20/C-21** — tworzenie zadania nadal przez istniejące Server Actions (z `revalidatePath`), własność
  `ownerId` przez istniejący guard; niczego w warstwie danych nie zmieniamy.
- **C-23** — brak nowej akcji AI (istniejący `create_task` wystarcza; zmienia się tylko, czym asystent
  wypełnia `description`).
- **C-32** — teksty i instrukcje po polsku; opis użytkownika traktujemy jako jego własny, oryginalny tekst.
- **C-53** — minimalizm: najmniejsza możliwa zmiana zachowania (bez nowego modelu, migracji, zależności,
  bez „przy okazji" refaktorów).
- **C-50/C-52** — „gotowe" = `npm run build` zielony; potem auto-merge do `develop`.

## 8. Otwarte pytania / decyzje właściciela
Pomysł jest jednoznaczny — nie zadano pytania startowego (C-55). Przyjęte założenia (rozstrzygnięte
domyślnie, rekomendowany wariant):
- [x] **„Verbatim" = dokładnie jak wpisał użytkownik** — bez zamiany na formę bezosobową, bez poprawek
  gramatyczno-interpunkcyjnych, bez streszczania. Zachowujemy oryginalne słowa/ton/literówki.
- [x] **Zakres = moduł Zadania** (tworzenie zadań przez asystenta + zgłoszenia admina), zgodnie z tytułem
  zadania „System Zarządzania Zadaniami". Inne moduły poza zakresem.
- [x] **Tytuł nadal generowany** z treści — bez zmian.
- [x] **Informacje dodatkowe (kontekst zgłoszenia)** doklejane do opisu **jak dotąd** — „tego nie ruszamy".
- [x] **Edycja opisu (`update_task`)** — stosujemy tę samą zasadę „nie przeredagowuj treści użytkownika",
  ale spójnie z minimalizmem nie dokładamy do tego osobnej funkcjonalności; wystarcza, że asystent nie
  parafrazuje treści podanej przez użytkownika.

## 9. Ryzyka
- **Za mało redakcji** → tytuł mógłby wyjść słaby, gdyby ktoś przez pomyłkę usunął też generowanie tytułu.
  Mitygacja: AC-3/AC-5 pilnują, że generowanie tytułu **zostaje** — zmieniamy tylko traktowanie opisu.
- **Model LLM mimo instrukcji „poprawia" tekst** (skłonność do parafrazy). Mitygacja: instrukcja musi być
  dobitna i jednoznaczna („verbatim, zero zmian słów"); `/verify` sprawdza na przykładach z literówką/1. os.
- **Regresja przy zgłoszeniach admina** — gdyby verbatim opis wyparł doklejany kontekst. Mitygacja: AC-4
  wprost wymaga **obu** części (opis verbatim **oraz** kontekst wskazanego miejsca).
