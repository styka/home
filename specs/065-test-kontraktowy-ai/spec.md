# Spec: asystent nie jest drogą obejścia uprawnień — zadanie 18

- **ID:** 065-test-kontraktowy-ai · **Data:** 2026-08-13

## 1. Problem / potrzeba

Rozdz. 12.2.1 nazywa to **realnym zagrożeniem**: *„Read-toole asystenta muszą przechodzić przez
`requireAccess`, a nie przez `where: { ownerId }`. Inaczej użytkownik z dostępem `viewer` do
projektu mógłby poprosić asystenta o zmianę zadania — i asystent by ją wykonał, bo działa
»w imieniu użytkownika« bez sprawdzenia roli."* I dodaje zdanie, które przesądza o kształcie
rozwiązania: *„Przy 160 akcjach AI nie da się tego zweryfikować ręcznie."*

Asystent jest najgorszym możliwym miejscem na lukę: czyta **wszystkie** moduły, nie przechodzi
przez UI i dostaje identyfikatory **wprost z rozmowy** — podanie cudzego nic nie kosztuje.

## 2. Kryteria akceptacji

- [ ] **AC-1** — Given każdy plik narzędzi odczytu modułu, then **widać** w nim mechanizm
      zawężenia; brak → **build pada**.
- [ ] **AC-2** — Given mechanizm, którego nie da się rozpoznać z tekstu (np. zawężenie w funkcji
      kontraktu biorącej użytkownika z sesji), then wymagany jest wpis **opisujący mechanizm** —
      decyzja recenzenta zapisana raz, nie zgadywana przez wzorzec.
- [ ] **AC-3** — Given użytkownik z rolą `VIEWER`, when prosi o zmianę zasobu, then **odmowa** —
      sprawdzone zachowaniem, nie obecnością kodu.
- [ ] **AC-4** — Given obcy znający identyfikator zasobu, then odmowa.
- [ ] **AC-5** — Given komplet bramek i build, then przechodzą; liczniki bez spadku.

## 3. Zakres

**W zakresie:** bramka na 16 plikach narzędzi odczytu + manifest wyjątków; test zachowania dla
Zwierząt (drugi moduł z rolami po Zadaniach z 052).

**Poza zakresem:** testy zachowania dla modułów, w których „mam dostęp" i „wolno mi zmieniać" to
**to samo** (dwa stany: moje / nie moje) — tam pomyłka jest znacznie trudniejsza, a bramka
wystarcza; egzekutor akcji zapisujących (osobna warstwa, `check:actions` pilnuje jej pokrycia).

## 4. Zgodność z konstytucją

**C-17**, **C-23**, **C-50**, **C-53**.
