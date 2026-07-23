# Spec: Wymuszanie automatycznych efektów zmiany statusu — centralnie, niezależnie od miejsca wywołania

- **ID:** 027-status-side-effects-central
- **Status:** draft
- **Autor sesji:** Claude Code (spec-driven pipeline)
- **Data:** 2026-07-23
- **Moduł(y):** Tasks (główny) + Pets (zabiegi/rutyny), Health/Leki (dawki), Habits (nawyk↔zadanie) — audyt cross-module

> **Zasada speca:** opisujemy **CO i DLACZEGO**, nigdy **JAK**. Nazwy plików/funkcji użyte niżej tylko
> jako współrzędne błędu; konkretny projekt techniczny należy do `plan.md`.

## 1. Problem / potrzeba
Efekty, które „dzieją się same" przy zmianie zadania, są dziś zaszyte w wywołujących (UI), a nie w
warstwie domenowej. Skutek: gdy tę samą operację wykona **inne wejście** — przede wszystkim asystent AI —
efekt uboczny się **nie odpala**. Zgłoszony objaw: asystent zmienia status zadania **cyklicznego** na
„zrobione" i **nie tworzy kolejnego wystąpienia** (spawn cyklicznego następnika żyje tylko w ścieżkach
UI: przełącznik statusu i operacje zbiorcze). Analogiczny wzorzec istnieje poza zadaniami — np. asystent
odhaczając zabieg zwierzęcia **reimplementuje** liczenie następnego terminu zamiast użyć logiki domenowej,
co grozi rozjazdem. To rodzina „pułapek", nie pojedynczy błąd — ta sama akcja z różnych miejsc daje różny
wynik. Musi być pod kontrolą aplikacji, nie wywołującego.

## 2. Cel i miary sukcesu
- Cel: automatyczne efekty uboczne zmiany statusu/domknięcia są **wymuszone centralnie w warstwie
  domenowej** danego modułu, więc **każde** wejście (UI, asystent AI, operacje zbiorcze, kalendarz,
  ewentualne API) daje **identyczny** rezultat.
- Sukces mierzymy:
  - Domknięcie zadania cyklicznego przez asystenta AI tworzy następne wystąpienie **tak samo** jak przez UI.
  - Brak zduplikowanej logiki cykliczności/efektów w wywołujących — jedno źródło prawdy per efekt.
  - Testy jednostkowe potwierdzają parytet „AI ścieżka == UI ścieżka" dla objętych operacji.

## 3. Historyjki użytkownika
- Jako użytkownik chcę, żeby powiedzenie asystentowi „oznacz "podlać kwiaty" jako zrobione" zamknęło
  bieżące wystąpienie **i** zaplanowało następne — dokładnie jak kliknięcie w interfejsie.
- Jako użytkownik chcę, żeby ustawienie/zdjęcie statusu „zrobione" spójnie ustawiało/kasowało datę
  wykonania niezależnie od tego, gdzie tego dokonam.
- Jako właściciel systemu chcę mieć pewność, że każda akcja zmieniająca stan zadania (i analogiczne
  akcje cykliczne w innych modułach) przechodzi przez jedną, wspólną ścieżkę, więc nowe wejścia nie
  „gubią" efektów ubocznych.

## 4. Kryteria akceptacji (testowalne)
Format Given/When/Then — weryfikowane w `/verify`.
- [ ] **AC-1** — Given zadanie cykliczne w statusie innym niż „zrobione", when asystent AI zmienia jego
      status na „zrobione" (przez akcję zmiany statusu **lub** ogólną edycję zadania z `status=DONE`),
      then powstaje kolejne wystąpienie wyliczone tą samą regułą co przy domknięciu w UI, a bieżące
      zostaje domknięte z datą wykonania.
- [ ] **AC-2** — Given to samo zadanie cykliczne, when domykam je w UI (przełącznik statusu) oraz — w
      osobnym scenariuszu — operacją zbiorczą, then wynik (następnik + data wykonania bieżącego) jest
      **identyczny** jak w AC-1.
- [ ] **AC-3** — Given zadanie w statusie „zrobione", when dowolnym wejściem zmieniam status na inny niż
      „zrobione", then data wykonania zostaje wyczyszczona; a gdy zmieniam na „zrobione" — zostaje
      ustawiona; reguła jest identyczna dla wszystkich wejść.
- [ ] **AC-4** — Given zabieg/rutyna cykliczna zwierzęcia, when asystent AI odhacza go jako wykonany,
      then następny termin i znacznik „ostatnio wykonano" są policzone przez **tę samą** logikę domenową
      co odhaczenie w UI (brak osobnej, równoległej implementacji w ścieżce AI).
- [ ] **AC-5** — Given przegląd wszystkich akcji zmieniających status/„domknięcie" w objętych modułach
      (zadania; zabiegi/rutyny zwierząt; odhaczanie dawek/pielęgnacji; nawyk↔zadanie), when analiza jest
      gotowa, then każdy zidentyfikowany efekt uboczny ma **jedno** miejsce egzekucji, a rozjazdy są albo
      naprawione, albo świadomie odnotowane jako „poza zakresem" z uzasadnieniem.
- [ ] **AC-6** — Given istniejące zachowania (statusy własne per-lista, kotwica daty „COMPLETION"/„DUE"
      przy cyklicznych, przenoszenie zadania między projektami z normalizacją custom-statusu), when
      wprowadzam centralizację, then te zachowania pozostają **bez regresji** (potwierdzone testami/`build`).
- [ ] **AC-7** — Given `npm run build`, when kończę implementację, then przechodzi (do kroku `next build`;
      `check:actions`, `check:migrations`, testy jednostkowe zielone).

## 5. Zakres
**W zakresie:**
- **Tasks:** przeniesienie efektów ubocznych domknięcia/zmiany statusu (spawn cyklicznego następnika,
  ustawianie/kasowanie daty wykonania, normalizacja custom-statusu przy zmianie projektu) do jednej
  ścieżki domenowej tak, by ogólna edycja zadania ze statusem „zrobione" (używana przez asystenta AI)
  zachowywała się identycznie jak przełącznik statusu i operacje zbiorcze.
- **Pets:** doprowadzenie odhaczania zabiegu/rutyny przez asystenta AI do wywołania tej samej logiki
  domenowej co UI (koniec z równoległą implementacją liczenia następnego terminu).
- **Health/Leki i Habits:** audyt akcji „odhaczenia/zmiany stanu" pod kątem tego samego wzorca; naprawa,
  jeśli występuje rozjazd między wejściami; w przeciwnym razie odnotowanie parytetu.
- **Audyt przekrojowy** wszystkich akcji zmiany statusu/domknięcia w objętych modułach z listą
  znalezionych pułapek i decyzją (naprawione / poza zakresem).
- Testy jednostkowe potwierdzające parytet ścieżek (AI == UI == bulk) dla objętych operacji.

**Poza zakresem (świadomie):**
- Zmiana samego modelu reguł cykliczności, kotwic dat czy semantyki statusów (to działa — patrz specy
  022/023); centralizujemy egzekucję, nie zmieniamy reguł.
- Nowe funkcje użytkowe, nowe statusy, nowe pola w bazie ponad to, co konieczne do centralizacji.
- Refaktory „przy okazji" w modułach nieobjętych wzorcem efektów cyklicznych/domknięcia (C-53).
- Zmiany UX/wyglądu — zachowanie ma być identyczne, tylko spójne między wejściami.

## 6. Wpływ na Omnia
- **Uprawnienie / RBAC:** bez zmian — korzystamy z istniejących `module.tasks`, `module.pets`,
  `module.health`, `module.habits`. Brak nowego slugu (C-22 n/d).
- **Własność danych:** bez zmian — istniejący model `ownerId`/`ownerTeamId` i guardy dostępu (C-21)
  zostają; centralizacja nie może osłabić kontroli dostępu.
- **Asystent AI:** kluczowy beneficjent — istniejące `AIAction` (zmiana statusu/edycja zadania,
  odhaczenie zabiegu, log dawki) mają dawać ten sam efekt co UI. Nie planujemy nowych typów `AIAction`;
  każdy istniejący egzekutor musi wołać wspólną ścieżkę domenową (C-23 — komplet egzekutorów bez zmian).
- **Kalendarz / powiadomienia / trash:** pośrednio — poprawne tworzenie następnika utrzymuje spójność
  agendy/przypomnień; centralizacja musi zachować istniejącą synchronizację (`revalidatePath`, reminder
  sync) bez podwójnego wyzwalania.

## 7. Zgodność z konstytucją
- **C-20** — wszystkie mutacje pozostają Server Actions z `revalidatePath()`; wspólna ścieżka domenowa
  nie może omijać inwalidacji cache.
- **C-53 (minimalizm)** — najmniejsza zmiana dająca parytet: konsolidacja istniejącej logiki, bez nowych
  abstrakcji ponad potrzebę i bez refaktorów niezwiązanych z efektami cyklicznymi/domknięcia.
- **C-54 (spójność artefaktów)** — audyt może odsłonić kolejne pułapki; wtedy aktualizujemy spec/plan/tasks,
  a nie „obchodzimy" problem w kodzie.
- **C-12** — statusy pozostają `String` + union TS; żadnych enumów Prisma.
- **C-21/C-23** — kontrola dostępu i komplet egzekutorów AI zachowane.
- **C-50/C-51** — „gotowe" = zielony `build`; każdy naprawiony rozjazd → wpis do `doświadczenia.md`.

## 8. Otwarte pytania / decyzje właściciela
- Rozstrzygnięte na `/specify`: **zakres = cross-module** (refaktor/wymuszenie centralne dla wszystkich
  analogicznych efektów cyklicznych: zadania + pety + leki + nawyki), a nie tylko punktowa łatka błędu AI.
- Założenie domyślne (bez dalszych pytań, C-55): jeśli audyt wykryje moduł, w którym centralizacja
  wymagałaby zmiany reguł domenowych (a nie tylko miejsca ich egzekucji), traktujemy to jako „poza
  zakresem" i odnotowujemy — nie zmieniamy semantyki działającej cykliczności.

## 9. Ryzyka
- **Podwójne wyzwolenie efektu** (np. następnik tworzony dwa razy, gdy centralna ścieżka i stary kod
  zadziałają razem) → usuwamy zduplikowaną logikę u wywołujących, testy parytetu wychwytują dublet.
- **Regresja zachowań krawędziowych** (kotwica „COMPLETION" vs „DUE", statusy własne per-lista, przenoszenie
  między projektami) → pokrycie istniejących i nowych testów jednostkowych; oparcie o specy 022/023.
- **Ukryte wejścia** pomijające warstwę domenową → audyt (AC-5) ma je wyliczyć; nieobjęte świadomie
  trafiają do „poza zakresem" z uzasadnieniem.
