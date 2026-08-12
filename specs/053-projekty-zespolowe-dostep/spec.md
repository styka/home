# Spec: Projekty zespołowe przestają być martwe

- **ID:** 053-projekty-zespolowe-dostep
- **Status:** draft
- **Data:** 2026-08-12
- **Moduł(y):** Zadania (+ jedno pole w deklaracji zasobów platformy)

## 1. Problem / potrzeba

052 zbudowało tabelę prawdy kontroli dostępu i **ujawniła ona zastany błąd**: projekt zadań
należący do **zespołu** (`ownerTeamId`) jest niedostępny **dla nikogo** — łącznie z właścicielem
zespołu. Ani guard zapisu, ani ścieżka odczytu asystenta nie czytają tej kolumny; sprawdzają
wyłącznie `ownerId` i członkostwo w projekcie.

Skutek dla użytkownika: **projekt utworzony jako zespołowy jest martwy.** Widać go w bazie, ale
każda operacja kończy się odmową. Funkcja istnieje w modelu danych i nie istnieje w praktyce.

052 świadomie tego nie naprawiło — poprawka uprawnień ukryta w przebudowie uprawnień byłaby nie do
odróżnienia od błędu, a tabela prawdy przestałaby cokolwiek dowodzić. Teraz jest osobno i widać
dokładnie, co się zmienia.

## 2. Cel i miary sukcesu

- **Cel:** członek zespołu może pracować w projekcie zadań należącym do jego zespołu.
- **Sukces:** w tabeli prawdy zmieniają się **wyłącznie zaplanowane komórki** — reszta bez ruchu;
  zmiana jest widoczna jako świadoma różnica wobec punktu odniesienia z 052, nie jako przypadek.

## 3. Historyjki użytkownika

- Jako **członek zespołu** chcę pracować w projekcie zadań mojego zespołu bez proszenia o osobne
  członkostwo w tym projekcie.
- Jako **właściciel/admin zespołu** chcę móc też zarządzać takim projektem (nazwa, usunięcie).
- Jako **osoba spoza zespołu** nie chcę zyskać niczego.

## 4. Kryteria akceptacji

- [ ] **AC-1** — Given projekt należący do zespołu, when członek zespołu wykonuje operację na
      zawartości (dodanie/edycja zadania), then **wolno mu**.
- [ ] **AC-2** — Given ten sam projekt, when **właściciel albo admin zespołu** zmienia nazwę lub
      usuwa projekt, then **wolno mu**; zwykłemu członkowi — **nie**.
- [ ] **AC-3** — Given osoba **spoza** zespołu, when próbuje czegokolwiek, then **odmowa**.
- [ ] **AC-4** — Given tabela prawdy z 052, when porównuję ją po zmianie, then różnią się
      **wyłącznie** komórki dotyczące projektu zespołowego; wszystkie pozostałe **bez zmian**.
- [ ] **AC-5** — Given odczyty asystenta, when członek zespołu pyta o projekty, then widzi projekt
      zespołowy — **lista i sprawdzanie dostępu nie mogą się rozjechać**.
- [ ] **AC-6** — Given komplet bramek i build, when je uruchamiam, then przechodzą, a liczniki
      160 / 551 / 35 / 35 nie spadają.

## 5. Zakres

**W zakresie:** własność zespołowa jako źródło roli na zasobie (pole w deklaracji, obsługa
w platformie), włączenie jej dla Zadań, aktualizacja punktu odniesienia z zapisanym powodem,
zakres list asystenta.

**Poza zakresem:** pozostałe moduły (każdy wymaga własnej tabeli prawdy), `workspaceId` (zadanie 11),
migracja nadań (zadanie 12), UI udostępniania.

## 6. Wpływ na Omnia

RBAC bez zmian (to inny wymiar). Własność danych bez zmian — czytamy istniejącą kolumnę.
Baza: **bez migracji**. Asystent: bez nowych akcji; zmienia się zakres widoczności.

## 7. Zgodność z konstytucją

**C-17** (dostęp rozstrzyga platforma; zmiana reguły wymaga tabeli prawdy), **C-21** (własność
czytana, nie zastępowana), **C-22** (RBAC nietknięty), **C-53** (jeden moduł), **C-54** (zmiana
punktu odniesienia jest świadoma i zapisana).

## 8. Decyzje właściciela

Właściciel zlecił kontynuację automatyczną po tym, jak zgłosiłem tę rozbieżność jako rzecz do
decyzji. Przyjęte rozstrzygnięcie: **własność zespołowa daje dostęp**, bo inaczej kolumna
`ownerTeamId` w projektach zadań nie ma żadnego znaczenia — a to jest stan gorszy niż jej brak.
Stopniowanie: **członek zespołu → `editor`** (praca w projekcie), **właściciel/admin zespołu →
`manager`** (zarządzanie). To najmniejsze rozszerzenie, które czyni funkcję używalną.

## 9. Ryzyka

- **To jest ROZSZERZENIE dostępu** — dokładnie to, czego 052 zabraniało robić mimochodem. Dlatego
  jest osobnym przebiegiem, a AC-4 wymaga, żeby zmieniły się **tylko** zaplanowane komórki.
- **Lista i guard mogą się rozjechać** → AC-5; zakres list i sprawdzanie idą z jednego miejsca.
