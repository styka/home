# Spec: Migawka pulpitu z deklaracji — domknięcie Fazy 1

- **ID:** 050-pulpit-z-deklaracji
- **Status:** draft
- **Autor sesji:** Claude Code (spec-driven pipeline)
- **Data:** 2026-08-11
- **Moduł(y):** trasa pulpitu + osiem modułów wnoszących do niej dane

> **Zasada speca:** opisujemy **CO i DLACZEGO**, nigdy **JAK**.

## 1. Problem / potrzeba

Po 049 na pytanie kontrolne z rozdz. 14 („ile miejsc trzeba dotknąć, żeby dodać moduł?") odpowiedź
brzmi **jeden katalog plus jeden import w korzeniu kompozycji** — z jednym wyjątkiem, i ten wyjątek
psuje całą odpowiedź. **Trasa pulpitu importuje dziewięć razy z modułów** i ma dziesięć gałęzi na
uprawnienia, żeby złożyć migawkę. Moduł, który chce cokolwiek pokazać na stronie głównej, musi
wejść do cudzego pliku.

To ostatnia równoległa lista opisująca moduł. Dopóki istnieje, „8 → 1" jest prawdą z przypisem —
a przypis przy takiej regule z czasem staje się furtką.

## 2. Cel i miary sukcesu

- **Cel:** wkład modułu do migawki pulpitu pochodzi z jego deklaracji, tak jak nawigacja, asystent,
  zadania w tle i kalendarz.
- **Sukces mierzymy:**
  - trasa pulpitu: **zero** importów z modułów (dziś dziewięć) i zero gałęzi na uprawnienie modułu;
  - **migawka identyczna** z punktem odniesienia — porównana wartość po wartości, nie „na oko";
  - graf kompilacji **nie rośnie** (dziś: `/auth/signin` 1771, `/` 1889 modułów);
  - Faza 1 domknięta w całości: żadne miejsce w aplikacji nie wymaga edycji cudzego pliku, żeby
    dodać moduł.

## 3. Historyjki użytkownika

- Jako **właściciel systemu** chcę, żeby moduł pokazujący coś na pulpicie deklarował to u siebie —
  bez „i jeszcze dopisz się do strony głównej".
- Jako **osoba rozwijająca Omnię** chcę, żeby odpowiedź „ile miejsc na moduł" była jedna, bez wyjątku.
- Jako **użytkownik aplikacji** nie chcę zauważyć niczego: ten sam pulpit, te same liczby, ta sama
  kolejność sekcji.

## 4. Kryteria akceptacji (testowalne)

**Dowód PRZED zmianą — to jest sedno tego przebiegu**

- [ ] **AC-1** — Given trasa pulpitu w obecnej postaci, when chcę porównać jej wynik przed i po
      przebudowie, then **istnieje sposób zawołania jej obliczeń jako funkcji** i zrzucenia wyniku.
      Wyodrębnienie jest **czystą przenosiną** — ta sama treść, ta sama kolejność, te same warunki.
- [ ] **AC-2** — Given wyodrębnione obliczenia, when zrzucam ich wynik dla użytkownika z fixture'a,
      then mam **punkt odniesienia zapisany przed** jakąkolwiek zmianą struktury.
      **Bez tego zrzutu dalsze kroki są zablokowane** — przenoszenie dziesięciu bloków obliczeń,
      którego jedynym sprawdzeniem byłby kompilator, jest w tym przebiegu wykluczone (to właśnie
      powód, dla którego 049 tego nie ruszyło).

**Wkład z deklaracji**

- [ ] **AC-3** — Given moduł wnoszący dane do pulpitu, when pulpit je zbiera, then bierze je
      z deklaracji modułu, a nie z listy w trasie.
- [ ] **AC-4** — Given trasa pulpitu po zmianie, when sprawdzam jej importy, then **żaden** nie sięga
      do modułu — ani do wnętrza, ani do kontraktu.
- [ ] **AC-5** — Given moduł bez dostępu (użytkownik nie ma uprawnienia), when pulpit składa migawkę,
      then wkład tego modułu **nie jest wołany**, a wynik jest taki sam jak dziś przy wyłączonej
      gałęzi. Sprawdzanie uprawnień nie może zniknąć ani przenieść się do modułu.

**Brak regresji**

- [ ] **AC-6** — Given punkt odniesienia z AC-2, when porównuję migawkę po przebudowie, then jest
      **identyczna wartość po wartości**.
- [ ] **AC-7** — Given graf kompilacji trybu dev, when mierzę go po zmianie, then `/auth/signin`
      **nie rośnie** wobec 1771 modułów, a wzrost `/` wobec 1889 jest **równy liczbie nowych plików
      źródłowych** — nie kosztem grafu ściągniętego okrężną drogą.
      **Kryterium doprecyzowane w trakcie przebiegu (C-54), z pomiarem, nie z wygody.** Pierwotne
      „`/` nie rośnie" jest nieosiągalne z definicji: jedenaście nowych wkładów to jedenaście nowych
      plików, a pulpit z nich korzysta. Miarą, o którą naprawdę chodzi, jest **brak grafu, którego
      trasa nie używa** — i ona rozstrzygnęła wybór projektowy:

      | wariant | `/auth/signin` | `/` |
      |---|---|---|
      | przed 050 (trasa importowała osiem kontraktów) | 1771 | **1889** |
      | wkłady przez wspólny `MODULE_SERVER` | 1771 | **2117** |
      | wkłady przez własny korzeń kompozycji | 1771 | **1903** |

      Drugi wariant wciągał egzekutory asystenta i handlery zadań w tle siedemnastu modułów, których
      pulpit nie wywołuje ani razu — odrzucony. Trzeci daje **+14 = dokładnie liczba nowych plików**
      (11 wkładów + korzeń kompozycji + składanie migawki + typ w platformie).
- [ ] **AC-8** — Given komplet bramek i budowanie, when je uruchamiam, then wszystko przechodzi,
      a liczniki 160 / 551 / 35 / 35 nie spadają.

**Domknięcie fazy**

- [ ] **AC-9** — Given bramka rejestru, when ktoś opisze moduł w trasie pulpitu „po staremu", then
      **bramka to wykrywa** — tak jak wykrywa egzekutor czy handler poza modułem.
- [ ] **AC-10** — Given dziennik przebudowy, when go czytam, then Faza 1 jest odnotowana jako
      **domknięta w całości**, z odpowiedzią na pytanie kontrolne bez przypisu, i wskazuje pierwszy
      krok Fazy 2.

## 5. Zakres

**W zakresie:**
- Wyodrębnienie obliczeń trasy pulpitu do funkcji (czysta przenosina) + zrzut punktu odniesienia.
- Rozbicie migawki na wkłady ośmiu modułów wnoszących dane, wraz z polem w deklaracji.
- Zachowanie sprawdzania uprawnień **po stronie kompozycji**, nie w module.
- Zaostrzenie bramki rejestru o to ostatnie miejsce.
- Aktualizacja dziennika (rozdz. 15): Faza 1 domknięta, pierwszy krok Fazy 2.

**Poza zakresem (świadomie):**
- **Cała Faza 2** (`Workspace`, `ResourceGrant`, `platform/sharing`, migracja `workspaceId`).
- **Read-toole asystenta przez `requireAccess`** (rozdz. 9.6) — realne zagrożenie przy zasobach
  współdzielonych, ale wykonalne dopiero po zadaniu 10.
- **Zastany dług klikaczy** — właściciel zdecydował (2026-08-11), że rozpiszemy je osobno; ten
  przebieg nie inwestuje w nie czasu.
- Jakakolwiek zmiana wyglądu, zawartości albo kolejności sekcji pulpitu.

## 6. Wpływ na Omnia

- **Uprawnienie / RBAC:** bez nowych slugów. **Sprawdzanie uprawnień zostaje w kompozycji** —
  przeniesienie go do modułu oznaczałoby, że każdy moduł sam decyduje, czy wolno go pokazać, a to
  jest dokładnie ten rodzaj rozproszenia, którego RBAC ma nie mieć (C-22).
- **Własność danych:** bez zmian; wkłady czytają dane tak jak dziś (C-21).
- **Asystent AI:** nie dotyczy — zero nowych akcji i read-tooli.
- **Kalendarz / powiadomienia / trash:** bez zmian.
- **Baza danych:** **bez migracji.**

## 7. Zgodność z konstytucją

- **C-36** — reguła wiodąca; po tym przebiegu obowiązuje **bez wyjątku**, bo znika ostatnie miejsce,
  w którym moduł opisuje się poza swoim katalogiem.
- **C-22** — RBAC pozostaje scentralizowany w kompozycji.
- **C-53** — powtarzamy wzorzec `calendar` z 049; nowe jest tylko jedno pole deklaracji.
- **C-50, C-51** — build zielony; nieoczywiste problemy do `doświadczenia.md`.
- **C-10..C-14** — nie dotyczą: zero zmian schematu.
- **C-54** — jeśli w trakcie okaże się, że jakiś blok migawki nie należy do żadnego modułu
  (np. dane przekrojowe), poprawiamy **spec**, a nie wciskamy go do modułu na siłę.

## 8. Otwarte pytania / decyzje właściciela

Brak pytań. Właściciel zlecił kontynuację automatyczną i **rozstrzygnął z góry decyzję, która jedyna
by tego wymagała**: kolejność „najpierw dowód, potem przenosiny". Pozostałe założenia:

- **Uprawnienia zostają w kompozycji.** Wkład modułu jest wołany dopiero, gdy użytkownik ma dostęp;
  moduł nie dostaje prawa decydowania o swojej widoczności.
- **Wkład serwerowy idzie do serwerowej części deklaracji** — lekcja z 049, gdzie umieszczenie go po
  stronie czytanej przez powłokę spowolniło kompilację każdej trasy 2–4×, czego produkcyjny build
  w ogóle nie pokazywał.
- **Kształt danych migawki się nie zmienia.** Widok pulpitu dostaje dokładnie to samo; ten przebieg
  przestawia, skąd dane przychodzą, a nie czym są.

## 9. Ryzyka

- **Brak dowodu runtime był powodem odłożenia tego zadania** → dlatego AC-1 i AC-2 są warunkiem
  wstępnym, a nie formalnością. Jeśli zrzutu nie da się zrobić, przebieg zatrzymuje się na tym kroku
  i mówi to wprost, zamiast przenosić kod „na kompilator".
- **Osiem bloków obliczeń z różnymi kształtami danych** → przenosimy zapytania bez przepisywania:
  te same warunki, te same pola, ta sama kolejność.
- **Nowe pole deklaracji może powtórzyć błąd z 049** (kod serwerowy w grafie klienta) → AC-7 mierzy
  graf kompilacji, bo produkcyjny build tego nie wykrywa.
- **Część migawki może nie należeć do żadnego modułu** (aktywność, zaproszenia, statystyki admina)
  → wtedy zostaje w kompozycji z zapisanym powodem; celem jest usunięcie **modułowych** gałęzi,
  nie opróżnienie trasy za wszelką cenę.
