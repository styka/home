# Spec: Granice modułów — Faza 1 przebudowy (pionowy wycinek)

- **ID:** 046-granice-modulow-faza-1
- **Status:** draft
- **Autor sesji:** Claude Code (spec-driven pipeline)
- **Data:** 2026-08-04
- **Moduł(y):** przekrojowo — nowa warstwa `platform`, moduły pilotażowe (Truck, QA, Kontakty, Raporty), rejestr modułów

> **Zasada speca:** opisujemy **CO i DLACZEGO**, nigdy **JAK**.

---

## 1. Problem / potrzeba

Dodanie modułu do Omnii wymaga dziś dotknięcia **ośmiu równoległych list**: rejestru modułów,
uprawnień, nawigacji bocznej, mobilnego paska, manifestu kontraktu widoku, katalogu akcji asystenta,
kafelków pulpitu i agregatu kalendarza. Żadna z nich nie wie o pozostałych, więc pominięcie jednej
daje moduł, który „prawie działa" — jest w nawigacji, ale niewidoczny dla asystenta, albo odwrotnie.
Rozdział 7 dokumentu architektury docelowej nazywa to **właściwym powodem całej przebudowy**:
kosztem dodania kolejnego modułu.

Druga strona tego samego problemu: **nic nie broni granic między modułami**. Dowolny plik może dziś
zaimportować dowolny inny, więc moduły są splecione przez przypadek, a nie przez zamiar. Rozdz. 14
mówi wprost, że reguła egzekwująca granice **nie jest opcjonalna** — granice bez egzekwowania erodują
w tygodnie i to najczęstszy sposób, w jaki takie przebudowy się marnują.

Faza 0 (siatka bezpieczeństwa) jest ukończona, więc refaktor przenoszący pliki jest wreszcie
bezpieczny: klikacz pokrywa 21/21 modułów, test izolacji najemcy stoi na 37 modelach, a rozjazd
schematu wykrywa bramka w buildzie.

## 2. Cel i miary sukcesu

**Cel:** udowodnić **cały wzorzec docelowej architektury na pionowym wycinku** — warstwa `platform`,
kilka modułów przeniesionych do własnych katalogów z kontraktem, reguła lintu egzekwująca granice
i jedna deklaracja, z której wynika rejestr, uprawnienia i nawigacja. Reszta modułów staje się wtedy
mechanicznym powtórzeniem, a nie projektowaniem.

**Sukces mierzymy:**
- Dodanie **modułu pilotażowego** wymaga zmian w **jednym katalogu** i **zera** zmian w innych
  modułach — sprawdzalne przez usunięcie jego wpisów z list globalnych i zielony build.
- Import przez granicę modułu **nie przechodzi lintu** — sprawdzalne testem negatywnym.
- **Zero zmian zachowania widocznego dla użytkownika** — klikacz 21/21 zielony przed i po.
- Liczba miejsc do dotknięcia przy dodaniu modułu pilotażowego spada z **8 do 1**.

## 3. Historyjki użytkownika

- Jako **właściciel** chcę, żeby dołożenie nowego modułu było tanie, bo to jest powód, dla którego
  ta przebudowa w ogóle się dzieje.
- Jako **kolejna sesja Claude Code** chcę, żeby lint powiedział mi „nie wolno", zanim spleciemy dwa
  moduły przez przypadek — bo wtedy jest to jedna poprawka, a nie dwadzieścia.
- Jako **właściciel** chcę, żeby przenoszenie plików nie zmieniło ani jednego ekranu — refaktor,
  który przy okazji coś psuje, jest gorszy niż brak refaktoru.

## 4. Kryteria akceptacji (testowalne)

**Warstwa platformy**

- [ ] **AC-1** — Given warstwa wspólnych zdolności, when patrzę na jej zawartość, then znajdują się
      w niej wyłącznie rzeczy, które **nie znają żadnego modułu** (sesja, baza, kolejka, kosz, audyt,
      powiadomienia, stan widoku, skróty, ulubione, system komponentów).
- [ ] **AC-2** — Given warstwa platformy, when uruchamiam kontrolę zależności, then **żaden** jej plik
      nie importuje niczego z katalogu modułów — zależność idzie wyłącznie w jedną stronę.

**Granice modułów**

- [ ] **AC-3** — Given moduł pilotażowy, when patrzę na jego katalog, then zawiera on wszystko, czego
      moduł potrzebuje (akcje, komponenty, logika, kontrakt), a jego trasa w aplikacji jest cienka —
      pobiera sesję i dane, renderuje widok, nie zawiera logiki.
- [ ] **AC-4** — Given próba zaimportowania wnętrza jednego modułu z innego modułu, when uruchamiam
      lint, then dostaję **błąd** z komunikatem wskazującym właściwą drogę (kontrakt modułu).
- [ ] **AC-5** — Given import **kontraktu** innego modułu, when uruchamiam lint, then przechodzi —
      reguła blokuje wnętrze, nie współpracę.
- [ ] **AC-6** — Given reguła granic, when nowy moduł powstaje poza katalogiem modułów, then jest to
      wykrywalne, a nie milcząco dozwolone.

**Jedna deklaracja zamiast ośmiu list**

- [ ] **AC-7** — Given moduł pilotażowy, when usuwam jego wpisy z globalnych list (rejestr, uprawnienia,
      nawigacja), then moduł **nadal działa** — bo te informacje wynikają z jego deklaracji.
- [ ] **AC-8** — Given deklaracja modułu, when dodaję do niej pole (np. inną etykietę), then zmiana
      jest widoczna wszędzie tam, gdzie moduł się pojawia, bez edycji drugiego pliku.
- [ ] **AC-9** — Given moduł bez deklaracji, when uruchamiam budowanie, then bramka to zgłasza —
      deklaracja jest wymagana, nie zalecana.

**Brak regresji**

- [ ] **AC-10** — Given przeniesione moduły, when uruchamiam klikacz ścieżki szczęśliwej, then
      **21/21 modułów** otwiera się bez błędu, tak samo jak przed przeniesieniem.
- [ ] **AC-11** — Given cała aplikacja, when uruchamiam komplet bramek i budowanie, then wszystko
      przechodzi — w tym kontrakt widoku, pokrycie akcji AI, kontrola dostępu i rozjazd schematu.
- [ ] **AC-12** — Given przeniesienie plików, when porównuję zachowanie modułu przed i po, then
      **nie zmieniło się nic widocznego dla użytkownika** — refaktor i zmiana funkcji nigdy w jednym
      commicie.

**Dziennik**

- [ ] **AC-13** — Given dziennik przebudowy, when go czytam po tym przebiegu, then wiem dokładnie,
      które moduły są przeniesione, które czekają i dlaczego akurat tyle.

## 5. Zakres

**W zakresie:**

1. **Warstwa platformy** — wydzielenie wspólnych zdolności, które nie znają modułów, wraz z regułą
   jednokierunkowej zależności.
2. **Przeniesienie modułów pilotażowych** — czterech najmniej sprzężonych (Truck, QA, Kontakty,
   Raporty), moduł po module, **osobny commit na moduł**, bez zmiany zachowania.
3. **Kontrakt modułu** — jedno miejsce, przez które moduł jest widziany z zewnątrz.
4. **Reguła lintu egzekwująca granice** — import wnętrza obcego modułu jest błędem; import kontraktu
   przechodzi. Rozdz. 14: **nie jest opcjonalna**.
5. **Deklaracja modułu** — jedno źródło, z którego wynikają rejestr, uprawnienia i nawigacja; bramka
   wymuszająca jej obecność dla modułów przeniesionych.
6. **Aktualizacja dziennika przebudowy** o stan i uzasadnienie zakresu.

**Poza zakresem (świadomie):**

- **Przeniesienie pozostałych 17 modułów.** W repozytorium jest **636 plików** w warstwach, które
  Faza 1 przenosi, i **2325 importów** do przepisania. Dokument sam ostrzega: *„Nie rób Fazy 1 ani
  Fazy 2 jednym commitem"* i *„Faza 1 rozlewa się i blokuje development — moduł po module, każdy
  osobno mergowany"*. Ten przebieg **dowodzi wzorca na czterech modułach**; pozostałe są wtedy
  mechanicznym powtórzeniem sprawdzonej procedury, a nie projektowaniem. Lista czekających modułów
  jest jawna w dzienniku i w manifeście bramki — żaden nie ginie.
- **Migracja asystenta AI na katalog składany z deklaracji** (zadanie 8). Dokument stawia je jako
  **ostatnie w fazie**, po przeniesieniu wszystkich modułów — składanie katalogu z deklaracji, gdy
  cztery moduły mają deklarację, a siedemnaście nie, dałoby katalog niepełny i gorszy niż obecny.
- **Zdarzenia domenowe i publikacja przez worker** (reguła R2 z rozdz. 7) — to Faza 4. Ten przebieg
  wprowadza granice **importu**, nie zmienia sposobu, w jaki moduły na siebie wpływają.
- **Warstwa domenowa `domain/`** — zadanie 19 z Fazy 3.
- **Jakakolwiek zmiana zachowania.** Błąd zauważony przy przenoszeniu naprawiamy **osobnym commitem**,
  przed albo po (rozdz. 13, lista „czego NIE robić").

## 6. Wpływ na Omnia

- **Uprawnienie / RBAC:** bez nowych slugów. Zmienia się **skąd** bierze się przypisanie uprawnienia
  do modułu (z deklaracji zamiast z osobnej listy), nie **jakie** ono jest. — por. `C-22`.
- **Własność danych:** bez zmian. Faza 1 nie dotyka `ownerId`/`ownerTeamId` — to Faza 2. — por. `C-21`.
- **Asystent AI:** bez nowych `AIAction` i bez zmian w katalogu akcji. Przeniesienie plików nie może
  zmienić tego, co asystent potrafi. — por. `C-23`.
- **Kalendarz / powiadomienia / trash:** bez zmian funkcjonalnych; jeśli któraś z tych zdolności
  trafia do warstwy platformy, zmienia się wyłącznie jej położenie.
- **Migracje:** **żadne**. Faza 1 nie dotyka schematu bazy.

## 7. Zgodność z konstytucją

| Reguła | Dlaczego kluczowa tutaj |
|--------|------------------------|
| **C-01** | Cała praca w `worldofmag/`; legacy `src/` w katalogu głównym repo pozostaje nietknięte — przy refaktorze przenoszącym setki plików to nie jest formalność. |
| **C-02** | Alias `@/*` jest tym, co czyni przeniesienie plików wykonalnym: importy się zmieniają, ale nie na ścieżki względne. |
| **C-53** | Największe ryzyko tego przebiegu. Refaktor kusi, żeby „przy okazji" poprawić napotkany kod — i właśnie dlatego dokument tego zabrania. Przenosimy, nie ulepszamy. |
| **C-50** | „Gotowe" = zielony build. Przy 2325 importach to jedyny wiarygodny dowód, że nic nie pękło. |
| **C-33** | Kontrakt widoku i jego bramka muszą przeżyć przeniesienie — manifest jest kluczowany modułem, więc zmiana ścieżek plików go dotyka. |
| **C-12** | Nowe rodzaje (np. kategoria zdolności platformy) jako `String` + unia TS. |
| **C-32** | Komunikat reguły lintu po polsku — to on ma nauczyć następną osobę właściwej drogi. |
| **C-51** | Refaktor tej skali odsłoni pułapki; każda ląduje w dzienniku lekcji. |
| **C-54** | Jeśli przenoszenie pokaże, że podział na platformę i moduły jest w czymś błędny — poprawiamy spec i plan, a nie obchodzimy problem wyjątkiem w kodzie. |

## 8. Otwarte pytania / decyzje właściciela

Właściciel polecił prowadzić pipeline **automatycznie do końca** i wcześniej doprecyzował: *„zrób to
tak, by efekt końcowy był najlepszy; możesz odpalać pipeline tyle razy, ile potrzeba"*. Pytań nie
zadaję (`C-55`); decyzje przyjęte samodzielnie i wiążące dla tego przebiegu:

- [x] **Zakres: pionowy wycinek zamiast pełnej Fazy 1.** 636 plików i 2325 importów nie da się
      przenieść w jednym przebiegu w sposób, który dałoby się uczciwie zweryfikować. Wycinek dowodzi
      **całego** wzorca (platforma + moduł + kontrakt + lint + deklaracja), więc reszta jest
      powtórzeniem. Ryzyko „Faza 1 rozlewa się i blokuje development" jest w dokumencie wymienione
      wprost, z zaleceniem „moduł po module, każdy osobno mergowany".
- [x] **Moduły pilotażowe: Truck, QA, Kontakty, Raporty** — kolejność z rozdz. 13 („od najmniej
      sprzężonych"). Każdy ma jeden plik akcji i 1–3 komponenty, więc przeniesienie jest sprawdzalne
      wzrokiem.
- [x] **Reguła lintu włączana od razu**, zakresowo dla modułów przeniesionych. Rozdz. 14: granice bez
      egzekwowania erodują w tygodnie — reguła „potem" znaczy „nigdy".
- [x] **Zadanie 8 (asystent AI) odłożone** — dokument stawia je jako ostatnie w fazie, po wszystkich
      modułach.

## 9. Ryzyka

| Ryzyko | Ograniczenie |
|--------|--------------|
| **Przeniesienie plików cicho psuje moduł** — 2325 importów, każdy to okazja do literówki | Kontrola typów wyłapie zerwany import natychmiast; klikacz 21/21 potwierdza zachowanie; osobny commit na moduł, więc wycofanie dotyczy jednego modułu |
| **Refaktor miesza się ze zmianą funkcji** — wymienione w dokumencie jako ryzyko o wysokim prawdopodobieństwie | Zasada „nigdy w jednym commicie" zapisana w zakresie; napotkany błąd naprawiamy osobno |
| **Reguła lintu blokuje więcej, niż powinna** i praca staje | Reguła zakresowa: dotyczy wyłącznie modułów przeniesionych. Moduł jeszcze nieprzeniesiony działa jak dotąd |
| **Deklaracja modułu dubluje listy zamiast je zastąpić** — czyli dziewiąte miejsce zamiast jednego | AC-7 wymaga USUNIĘCIA wpisów z list globalnych i zielonego buildu; sama obecność deklaracji nie wystarcza |
| **Wycinek zostaje wycinkiem** i za trzy miesiące połowa modułów jest w starym układzie | Lista czekających modułów jest jawna w dzienniku i w manifeście bramki; bramka raportuje ją przy każdym budowaniu, tak jak zrobiła to bramka kontraktu widoku w 045 |
| **Manifest kontraktu widoku rozjeżdża się po przeniesieniu plików** | Ścieżki w manifeście aktualizowane razem z przeniesieniem; bramka `check:ui-contract` wywali się, jeśli wskazany plik nie istnieje |
