# Spec: koniec cichej utraty pracy — wersjonowanie, zadanie 15 (mechanizm + pilot)

- **ID:** 062-wersjonowanie-konflikty · **Data:** 2026-08-13
- **Moduł(y):** `platform/` + Zadania i Notatki (pilot)

## 1. Problem / potrzeba

Rozdz. 8.5 stawia diagnozę jednym zdaniem: *„żaden model nie ma wersji, więc ostatni zapis wygrywa
po cichu"*. To nie jest ryzyko teoretyczne — rozdz. 4 prostuje wcześniejsze analizy właśnie w tym
punkcie: **współpraca jest częścią produktu**, a nie wyjątkiem. Lista zakupów odhaczana przez
domownika, projekt zadań ze współpracownikiem, notatka redagowana we dwoje.

Dziś dwie osoby edytujące ten sam rekord nie dostają żadnego sygnału: praca jednej z nich znika,
a system zachowuje się tak, jakby nic się nie stało. **Cicha utrata pracy jest najgorszym rodzajem
błędu** — nie ma po niej śladu w logach ani powodu, żeby ktokolwiek jej szukał.

**Dlaczego mechanizm + pilot, a nie wszystkie modele naraz.** Ta sama zasada, którą 052 ustaliło dla
deklaracji zasobów i która sprawdziła się osiem razy w tej sesji: kolumna na czterdziestu modelach,
z których korzysta jeden, to czterdzieści nieużywanych kolumn i zero dowodu. Ten przebieg dowozi
**działający mechanizm** i dwa modele, na których widać, że działa.

## 2. Cel i miary sukcesu

- **Cel:** zapis oparty na nieaktualnej wersji rekordu **nie przechodzi po cichu** — kończy się
  rozpoznawalnym konfliktem, który da się pokazać użytkownikowi.
- **Sukces:** konflikt odróżnialny od „rekord nie istnieje"; równoległy zapis dwóch osób daje
  jeden sukces i jeden konflikt, nigdy dwa sukcesy; bramka nie pozwala ominąć mechanizmu na
  modelu, który go ma.

## 3. Kryteria akceptacji

- [ ] **AC-1** — Given rekord w wersji N, when zapisuję z oczekiwaną wersją N, then zapis
      przechodzi, a wersja rośnie do N+1.
- [ ] **AC-2** — Given dwie osoby czytają wersję N i obie zapisują, then **pierwsza wygrywa**,
      a druga dostaje **konflikt** — nigdy dwa sukcesy i nigdy ciche nadpisanie.
- [ ] **AC-3** — Given zapis na nieistniejącym rekordzie, then błąd mówi „nie istnieje", a **nie**
      „konflikt". Rozróżnienie jest treścią mechanizmu, nie szczegółem — stąd `updateMany`
      zamiast `update` (rozdz. 8.5.1).
- [ ] **AC-4** — Given zapis **bez** podanej oczekiwanej wersji, then zachowuje się jak dotąd
      (wygrywa ostatni). Wymuszenie wersji wszędzie naraz zmieniłoby zachowanie każdej ścieżki
      zapisu w aplikacji; pilot ma pokazać mechanizm, nie przełączyć całość.
- [ ] **AC-5** — Given model, który **ma** kolumnę `version`, when ktoś zapisuje go z pominięciem
      mechanizmu, then **build pada** albo wymaga jawnego, uzasadnionego wyjątku.
- [ ] **AC-6** — Given modele wymienione w rozdz. 8.5.3 jako **świadomie pominięte** (liczniki,
      wpisy dziennikowe, zasoby jednego użytkownika), then wersji **nie dostają**, a powód jest
      zapisany.
- [ ] **AC-7** — Given komplet bramek i build, then przechodzą; liczniki **160 / 551 / 35 / 35**
      bez spadku; zero zmian widocznych dla użytkownika **w tym przebiegu**.
- [ ] **AC-8** — Given dziennik, then odnotowany mechanizm, pilot i to, co robi zadanie 16.

## 4. Zakres

**W zakresie:** kolumna `version` na modelach pilota (zadanie, notatka); błąd konfliktu jako pojęcie
platformy; helper zapisu z warunkiem na wersji; bramka; dowód na równoległym zapisie.

**Poza zakresem:** **`ConflictDialog` i UX wyboru** — to zadanie 16, osobno, bo dotyczy interfejsu,
a nie poprawności zapisu; wersjonowanie pozostałych modeli (kolejne przebiegi, moduł po module);
współredagowanie tekstu w czasie rzeczywistym (rozdz. 8.6 — świadomie odroczone);
**zapis wersji odrzuconej do kosza** (część zadania 16, razem z UI).

## 5. Wpływ na Omnia

**RBAC:** bez zmian. **Baza:** migracja — kolumna `version Int @default(0)` na dwóch modelach.
**Dostęp:** bez zmian. **AI:** asystent zapisuje przez te same akcje; dopóki nie podaje wersji,
zachowuje się jak dotąd (AC-4). **Kosz:** nietknięty w tym przebiegu.

## 6. Zgodność z konstytucją

**C-10, C-11** (ręczna migracja, numer z `next:migration`), **C-12** (bez enumów), **C-13**,
**C-20** (`revalidatePath` nietknięte), **C-21**, **C-50**, **C-51**, **C-53** (mechanizm + pilot,
nie czterdzieści kolumn na zapas).

## 7. Decyzje właściciela

Przebieg automatyczny. Przyjęte: **wersja jest opcjonalna po stronie wołającego** (AC-4).
Ścieżka zapisu, która wersji nie podaje, działa jak dotąd — inaczej ten przebieg zmieniłby
zachowanie każdej akcji w aplikacji naraz, a dowodem byłby wyłącznie kompilator.

## 8. Ryzyka

- **Mechanizm ominięty przez zwykły `update`** → AC-5: bramka pilnuje, że model z kolumną `version`
  jest zapisywany wyłącznie helperem.
- **Konflikt mylony z brakiem rekordu** → AC-3, wprost z rozdz. 8.5.1.
- **Wersja rośnie tam, gdzie nie powinna** (liczniki, dopisywanie) → AC-6 i lista z rozdz. 8.5.3.
