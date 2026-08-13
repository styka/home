# Spec: zakres własności w jednym miejscu — etap 3B, krok 1 z dwóch

- **ID:** 057-zakres-wlasnosci-jeden-helper · **Data:** 2026-08-13
- **Moduł(y):** wszystkie moduły z własnością + `platform/auth`

## 1. Problem / potrzeba

056 przełączyło **rozstrzyganie dostępu** na `workspaceId`. Zakresy list zostały na parze kolumn:
warunek `OR: [{ ownerId }, { ownerTeamId: { in: teamIds } }]` jest **wpisany ręcznie w 79 miejscach
w 52 plikach**. Dopóki tak jest, etap 3B to 79 osobnych zmian, z których każda może się różnić
o szczegół, a jedynym sprawdzeniem byłby kompilator — ten sam kształt problemu, który w 055
rozwiązał wyzwalacz zamiast 224 poprawek.

**Rozdz. 8.2 obiecuje coś odwrotnego:** *„Dziś każde zapytanie musi obsłużyć oba przypadki. Po
zmianie: `where: { workspaceId: { in: mySpaces } }`."* Żeby ta obietnica dała się zrealizować
**jedną zmianą**, warunek musi najpierw istnieć w **jednym miejscu**.

**Dlaczego krok 1 z dwóch.** Przenoszenie 79 warunków i jednoczesna zmiana ich znaczenia to zmiana,
w której nie da się odróżnić błędu przenosin od błędu reguły — dokładnie ten problem 050 rozwiązało
kolejnością „najpierw wyodrębnij bez zmiany struktury, potem zrzuć punkt odniesienia, dopiero potem
przełącz". Ten przebieg **wyodrębnia**. Przełączenie helpera na przestrzenie to krok 2 (058) — jeden
plik, z tabelą prawdy.

## 2. Cel i miary sukcesu

- **Cel:** jeden helper wyrażający „zasoby, które widzę", użyty wszędzie; **zero zmian zachowania**.
- **Sukces:** zero ręcznie pisanych par `ownerId`/`ownerTeamId` w zapytaniach modułów (poza
  świadomymi wyjątkami z uzasadnieniem); bramka pilnująca, że nie wrócą; komplet bramek i build.

## 3. Historyjki użytkownika

- Jako **właściciel systemu** chcę, żeby kolejny krok najgroźniejszego zadania przebudowy był
  zmianą **jednego pliku**, a nie siedemdziesięciu dziewięciu miejsc.
- Jako **użytkownik** nie chcę zauważyć niczego.

## 4. Kryteria akceptacji

- [ ] **AC-1** — Given zapytanie o zasoby użytkownika, when używa helpera, then zwraca **dokładnie
      ten sam** zbiór rekordów co przed zmianą; dowód nie może opierać się wyłącznie na kompilacji.
- [ ] **AC-2** — Given oba dzisiejsze kształty warunku (bezwarunkowy `in: teamIds` i wariant
      `teamIds.length > 0 ? … : []`), then helper pokrywa oba, bo są **równoważne** — `in: []`
      nie pasuje do niczego; równoważność ma być **sprawdzona**, nie założona.
- [ ] **AC-3** — Given nowe zapytanie pisane ręcznie parą kolumn, when uruchamiam build, then
      **build pada**; świadomy wyjątek wymaga wpisu z uzasadnieniem, a wpis martwy też jest błędem.
- [ ] **AC-4** — Given zasoby **słownikowe** (widoczne także jako systemowe, `ownerId = null`),
      then zachowują swoją odrębną regułę — helper ogólny **nie może** ich objąć, bo dołożyłby
      dostęp do rekordów systemowych tam, gdzie go nie było.
- [ ] **AC-5** — Given komplet bramek i build, then przechodzą; liczniki **160 / 551 / 35 / 35**
      bez spadku; zero zmian widocznych dla użytkownika.
- [ ] **AC-6** — Given dziennik, then krok odnotowany wraz z tym, co robi 058.

## 5. Zakres

**W zakresie:** helper zakresu własności w platformie; migracja wszystkich ręcznych wystąpień
w `src/modules/**` i `src/lib/**`; bramka; dowód równoważności.

**Poza zakresem:** **przełączenie helpera na `workspaceId`** (058 — to jest sedno etapu 3B, ale
osobno); guardy pojedynczego rekordu (`assert…Access`) — te przeszły już przez 052/056; zasoby
słownikowe (AC-4); `NOT NULL` i usunięcie kolumn (etap 4).

## 6. Wpływ na Omnia

**RBAC:** bez zmian. **Własność:** bez zmian — ten przebieg **nic nie zmienia w regule**, tylko
przenosi jej zapis. **Baza:** bez migracji. **AI:** read-toole korzystają z tych samych zapytań,
więc obejmuje je ta sama zmiana.

## 7. Zgodność z konstytucją

**C-21** (własność), **C-36** (platforma nie zna modułu — helper przyjmuje `userId`/`teamIds`
parametrami, nie sięga po katalog modułów), **C-50**, **C-51**, **C-53** (najmniejsza zmiana:
przeniesienie, nie przepisanie).

## 8. Decyzje właściciela

Przebieg w pełni automatyczny. Przyjęte: **wyodrębnienie i przełączenie idą osobno** — z tego
samego powodu, dla którego 050 najpierw wyodrębniło migawkę pulpitu, a dopiero potem ją rozbiło.

## 9. Ryzyka

- **Sweep po 52 plikach** → zmiana czysto mechaniczna, a helper zwraca **strukturalnie identyczny**
  obiekt; równoważność obu kształtów sprawdzona testem, nie założona.
- **Helper obejmie coś, czego nie powinien** (rekordy słownikowe z `ownerId = null`) → AC-4:
  odrębna reguła zostaje odrębna; bramka nie może wymuszać helpera tam, gdzie jest zły.
- **Bramka zbyt szeroka** → wyjątek jawny, uzasadniony i sprawdzany w obie strony (wzorzec
  `mirror-coverage.json`).
