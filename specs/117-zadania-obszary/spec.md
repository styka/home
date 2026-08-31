# Spec: Obszary w module Zadania + trwała odzyskiwalność usuniętych zasobów

- **ID:** 117-zadania-obszary
- **Status:** draft
- **Autor sesji:** Claude Code (spec-driven pipeline)
- **Data:** 2026-08-31
- **Moduł(y):** Tasks (obszary) + platforma kosza / panel admina (odzyskiwalność)

> **Zasada speca:** opisujemy **CO i DLACZEGO**, nigdy **JAK**. Zero nazw plików, tabel, bibliotek,
> endpointów.

## 1. Problem / potrzeba

Duże projekty w module Zadania są dziś płaską listą (z podzadaniami), przez co zadania z różnych
wątków tematycznych mieszają się ze sobą. Właściciel potrzebuje **obszarów** — hierarchicznej
struktury porządkującej zadania wewnątrz projektu (obszar może zawierać zadania i/lub kolejne
obszary) — oraz możliwości **przeglądania projektu po obszarach**.

Dodatkowo (decyzja właściciela z tego przebiegu): **żaden zasób użytkownika nie może być trwale
usuwany z bazy danych**. Dzisiejszy kosz po upływie retencji lub po „opróżnij kosz" kasuje wpisy
bezpowrotnie — to ma się zmienić, a admin ma dostać miejsce, z którego przywróci usunięte zasoby
użytkowników.

## 2. Cel i miary sukcesu

- Cel 1: użytkownik porządkuje zadania projektu w drzewo obszarów i przegląda projekt po obszarach
  w trzech przełączalnych widokach.
- Cel 2: usunięcie dowolnego zasobu trafiającego do kosza nigdy nie kończy się trwałą utratą danych;
  admin może przywrócić zasób nawet po opróżnieniu kosza przez użytkownika.
- Sukces mierzymy:
  - przypisanie obszaru zadaniu ≤ 2 kliknięcia z edycji zadania;
  - przełączenie widoku „wg obszarów" ≤ 1 kliknięcie z widoku projektu;
  - po „opróżnij kosz" i upływie retencji admin nadal widzi i przywraca usunięty zasób;
  - żadna ścieżka użytkownika nie wykonuje nieodwracalnego usunięcia danych zasobu.

## 3. Historyjki użytkownika

- Jako właściciel projektu chcę tworzyć w projekcie obszary i pod-obszary (drzewo), żeby pogrupować
  zadania tematycznie.
- Jako użytkownik chcę przypisać zadaniu dowolny obszar z drzewa projektu (albo żaden), żeby zadanie
  miało swoje miejsce w strukturze.
- Jako użytkownik chcę przeglądać projekt „wg obszarów" jako zwijane sekcje odzwierciedlające drzewo
  (domyślny wariant), żeby widzieć całość struktury na jednym ekranie.
- Jako użytkownik chcę alternatywnie wejść w obszar (drill-down: jego zadania + pod-obszary,
  z drogą powrotną) albo mieć drzewo obszarów obok listy (panel boczny na desktopie), i przełączać
  się między tymi trzema wariantami; wybór ma być zapamiętany.
- Jako użytkownik usuwający obszar chcę wybrać: scal zawartość do obszaru nadrzędnego **albo** usuń
  całe poddrzewo — i w obu przypadkach móc to cofnąć z kosza.
- Jako admin chcę mieć miejsce, w którym widzę usunięte zasoby użytkowników (także te „opróżnione"
  z kosza lub po retencji) i mogę je przywrócić.

## 4. Kryteria akceptacji (testowalne)

- [ ] **AC-1** — Given projekt bez obszarów, when użytkownik tworzy obszar, a w nim pod-obszar,
  then drzewo pokazuje oba we właściwej hierarchii (dowolna głębokość ≥ 3 poziomy działa).
- [ ] **AC-2** — Given zadanie w projekcie z obszarami, when użytkownik edytuje zadanie i wybiera
  obszar, then zadanie ma dokładnie ten jeden obszar; wybór „brak" odpina obszar.
- [ ] **AC-3** — Given projekt z obszarami i zadaniami (część bez obszaru), when użytkownik włącza
  widok „wg obszarów", then zadania są pogrupowane w zwijane sekcje wg drzewa (wcięcia pod-obszarów),
  zadania bez obszaru widnieją w wyodrębnionej sekcji, a żadne zadanie nie znika ani się nie dubluje.
- [ ] **AC-4** — Given widok „wg obszarów", when użytkownik przełącza wariant na drill-down lub
  panel boczny i wraca do projektu później, then aktywny wariant jest zapamiętany; domyślny wariant
  dla nowego użytkownika to zwijane sekcje.
- [ ] **AC-5** — Given obszar z pod-obszarami i zadaniami, when użytkownik go usuwa, then dostaje
  wybór „scal do rodzica" / „usuń całe poddrzewo"; po scaleniu pod-obszary i zadania wiszą pod
  rodzicem (lub na szczycie drzewa), po usunięciu poddrzewa zadania zostają w projekcie bez obszaru.
- [ ] **AC-6** — Given usunięty obszar (dowolny tryb), when użytkownik otwiera kosz, then może
  przywrócić obszar; przywrócenie odtwarza strukturę objętą tym usunięciem.
- [ ] **AC-7** — Given zasób w koszu, when użytkownik opróżnia kosz albo mija okres retencji,
  then wpis znika z kosza użytkownika, ale dane zasobu **nie są trwale usuwane** z bazy.
- [ ] **AC-8** — Given zasób usunięty i „opróżniony", when admin otwiera panel przywracania,
  then widzi zasób (kto, co, kiedy usunął) i może go przywrócić właścicielowi.
- [ ] **AC-9** — Given projekt współdzielony w przestrzeni zespołowej, when członek z dostępem do
  projektu przegląda go wg obszarów, then widzi te same obszary co właściciel (obszary należą do
  projektu, nie do konta).

## 5. Zakres

**W zakresie:**

- Drzewo obszarów **per projekt** w module Zadania: tworzenie, zmiana nazwy, przenoszenie w drzewie,
  usuwanie (dwa tryby, z wyborem), kolejność rodzeństwa.
- Przypisanie **dokładnie jednego** obszaru zadaniu (lub brak); przypisywać można z edycji zadania.
- Przeglądanie projektu po obszarach w **trzech przełączalnych wariantach** (zwijane sekcje drzewa —
  domyślny; drill-down; panel boczny z drzewem na desktopie), z zapamiętaniem wyboru użytkownika.
- Usuwanie obszarów przez kosz (soft-delete, odzysk w `/trash`).
- **Zmiana systemowa kosza:** opróżnienie kosza i upływ retencji przestają trwale kasować dane —
  zasób znika z widoku użytkownika, ale pozostaje odzyskiwalny.
- **Panel admina do przywracania** usuniętych zasobów użytkowników (wszystkie typy trafiające do
  kosza, nie tylko obszary).

**Poza zakresem (świadomie):**

- Obszary globalne/przekrojowe między projektami (drzewo należy do projektu — decyzja właściciela).
- Wiele obszarów na jedno zadanie.
- Obszary w innych modułach (Notatki itd.).
- Nowe akcje asystenta AI do zarządzania obszarami (odczyt struktury projektu może pozostać bez
  zmian; klasyfikację pokrycia AI uzupełniamy zgodnie z bramką, ale bez budowy nowych akcji).
- Zmiana procedury RODO: **wyjątek od nieusuwalności** — pełne usunięcie konta/danych na żądanie
  (obowiązek prawny) nadal usuwa naprawdę; nieusuwalność dotyczy zwykłych operacji w aplikacji.
- Objęcie koszem modułów, które dziś kasują twardo **z pominięciem kosza** (np. usunięcie projektu
  zadań, list, przepisów) — nieusuwalność w tym przebiegu domykamy dla mechanizmu kosza (wszystko,
  co do niego trafia, nigdy nie znika); audyt i podpięcie pozostałych ścieżek usuwania to osobny,
  kolejny etap (odnotowany do roadmapy).
- Statystyki/raporty per obszar.

## 6. Wpływ na Omnia

- **Uprawnienie / RBAC:** istniejący slug `module.tasks` (obszary to część modułu Zadania).
  Panel przywracania dla admina — istniejący `module.admin`.
- **Własność danych:** obszary dziedziczą własność po projekcie (przestrzeń projektu — osobista lub
  zespołowa); zgodnie z modelem przestrzeni, bez nowego nośnika własności.
- **Asystent AI:** brak nowych akcji (poza zakresem); nowe akcje serwerowe muszą przejść klasyfikację
  bramki pokrycia AI i kontroli dostępu.
- **Kalendarz / powiadomienia:** nie dotyczy.
- **Trash:** tak — obszary idą do kosza; dodatkowo systemowa zmiana semantyki opróżniania/retencji
  (nieusuwalność) i panel admina do przywracania.

## 7. Zgodność z konstytucją

- **C-01/C-02/C-36** — praca w `worldofmag/`, kod obszarów w granicach modułu Tasks; zmiana kosza po
  stronie platformy (platforma nie pozna modułu).
- **C-10/C-11/C-12** — nowe modele/kolumny przez ręczne migracje, sekwencyjny numer, statusy jako
  `String` + unia TS (np. tryb usunięcia, status wpisu kosza).
- **C-20** — mutacje jako Server Actions z `revalidatePath()`.
- **C-21 (w brzmieniu po 079)** — własność przez przestrzeń projektu; dostęp przez istniejące guardy
  projektu.
- **C-24** — soft-delete przez kosz; ta funkcja wręcz zaostrza regułę (zero trwałego kasowania).
- **C-25** — operacje admina na cudzych zasobach (przywracanie) powinny zostawiać ślad audytowy.
- **C-30/C-31/C-33/C-34** — ciemny motyw ze zmiennych, mobile-first (drill-down na telefonie, panel
  boczny tylko desktop), widoki przez `ModuleView`, potwierdzenia przez `confirmDialog`
  (usuwanie z `destructive: true`).
- **C-32** — teksty po polsku przez `t()` / `messages/pl.json`.
- **C-50/C-51/C-52** — build zielony, wpisy do `doświadczenia.md`, merge do `develop` + automatyczna
  promocja na `master`.
- **C-53** — minimalizm: bez przebudowy całych Zadań; trzy widoki realizujemy najmniejszym wspólnym
  mechanizmem.

## 8. Otwarte pytania / decyzje właściciela

Zebrane w jedynym momencie pytań (ten przebieg):

- [x] **Zasięg obszarów:** per projekt (każdy projekt ma własne drzewo).
- [x] **Krotność:** dokładnie jeden obszar na zadanie (albo żaden).
- [x] **UX przeglądania:** wszystkie trzy warianty (zwijane sekcje / drill-down / panel boczny),
  przełączalne; **domyślnie zwijane sekcje drzewa**; wybór zapamiętany.
- [x] **Usuwanie obszaru:** użytkownik wybiera tryb — scal do rodzica albo usuń całe poddrzewo.
- [x] **Nieusuwalność zasobów:** żadne zasoby użytkowników nie znikają trwale z bazy (nawet po
  opróżnieniu kosza / retencji); admin dostaje panel przywracania. Jeśli mechanizm istnieje
  częściowo — doprowadzić do celu w całości.

Założenia przyjęte domyślnie (bez pytania, zgodnie z rekomendacją):

- Wybór wariantu widoku zapamiętujemy per użytkownik (nie per projekt); aktywny wariant jest też
  częścią adresu widoku (żeby widok dało się zapisać w ulubionych), a ostatni wybór staje się
  domyślnym przy wejściu bez parametru — spójnie z wzorcem stanu widoku w aplikacji.
- Wyjątek RODO: prawnie wymagane usunięcie konta/danych pozostaje realnym usunięciem.
- Obszar ma nazwę (bez własnego koloru/emoji w pierwszej wersji — minimalizm C-53).
- Panel boczny z drzewem jest wariantem desktopowym; na telefonie dostępne są zwijane sekcje
  i drill-down.

## 9. Ryzyka

- **Drzewo o dużej głębokości psuje czytelność na telefonie** → wcięcia ograniczone wizualnie,
  drill-down jako wariant mobilny; brak twardego limitu głębokości, ale UI projektowany na 3–4
  poziomy.
- **Zmiana semantyki kosza dotyka wszystkich modułów** → zmiana wyłącznie w warstwie platformowej
  kosza (jedno miejsce), zachowanie widoczne dla użytkownika bez zmian poza tym, że dane są
  odzyskiwalne przez admina; istniejące testy kosza muszą przejść.
- **Rozrost bazy przez nieusuwalność** → świadoma decyzja właściciela; wpisy „opróżnione" są
  oznaczane, nie kasowane; ewentualna archiwizacja to osobna przyszła decyzja.
- **Cykl w drzewie (obszar swoim własnym przodkiem)** → przenoszenie obszaru waliduje, że cel nie
  jest potomkiem przenoszonego; naruszenie odrzucane z komunikatem.
- **Rozjazd trzech widoków (różne liczby zadań)** → wszystkie trzy warianty czytają ten sam zbiór
  zadań projektu; różni się tylko prezentacja (lekcja z Wiadomości 085: filtrować jeden wspólny
  zbiór, nigdy dwa źródła).
