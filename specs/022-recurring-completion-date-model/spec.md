# Spec: Model daty zrobienia zadań cyklicznych (link wystąpień + bulk rolowanie) + usunięcie ikony sortu

- **ID:** 022-recurring-completion-date-model
- **Status:** draft
- **Autor sesji:** Claude Code (spec-driven pipeline)
- **Data:** 2026-07-22
- **Moduł(y):** Tasks (`/tasks` — akcje, szczegóły, bulk, lista)

## 1. Problem / potrzeba
Po 020/021 zostały luki w modelu zadań cyklicznych: (a) **masowa** zmiana statusu na „Zrobione" NIE
tworzy kolejnego wystąpienia (klik z listy i szczegóły już tworzą); (b) brak **powiązania** między
wystąpieniami, więc „data ostatniego zrobienia" nie da się zsynchronizować, gdy edytujesz datę zrobienia
domkniętego wystąpienia; (c) pole daty zrobienia w szczegółach jest schowane w stopce i nie wygląda jak
pole daty; (d) właściciel rezygnuje z ikony sortowania po dacie zrobienia.

## 2. Cel i miary sukcesu
- Cel: spójny, przewidywalny model „daty zrobienia" (tego zadania) vs „daty ostatniego zrobienia"
  (poprzedniego wystąpienia), działający tak samo dla pojedynczego, bulk i edycji; pole daty czytelne.
- Sukces mierzymy:
  - Masowe „Zrobione" na cyklicznym tworzy kolejne wystąpienie tak jak pojedyncze odhaczenie.
  - Edycja daty zrobienia domkniętego cyklicznego aktualizuje „datę ostatniego zrobienia" jego następcy.
  - Pole daty zrobienia jest pod „Start" i wygląda/zachowuje się jak „Start".
  - Ikona sortowania po dacie zrobienia zniknęła; znacznik „✓ data" na wierszach został.

## 3. Historyjki użytkownika
- Jako użytkownik zamykający masowo zaległe zadania chcę, by cykliczne wśród nich wygenerowały kolejne
  wystąpienia (nie zniknęły z cyklu).
- Jako użytkownik chcę poprawić datę zrobienia domkniętego cyklicznego, a jego aktywny następca ma
  pokazać tę samą „datę ostatniego zrobienia".
- Jako użytkownik chcę mieć datę zrobienia w szczegółach jako normalne pole daty, tuż pod „Start".

## 4. Kryteria akceptacji (testowalne)
- [ ] **AC-1 (bulk roluje cykliczne)** — Given zaznaczenie zawierające zadania cykliczne, when masowo
  ustawiam status „Zrobione", then dla każdego cyklicznego powstaje kolejne wystąpienie (jak przy
  pojedynczym odhaczeniu), a domknięte dostaje datę zrobienia = wspólna podana data (021) albo „dziś".
- [ ] **AC-2 (powiązanie wystąpień)** — Given domknięcie cyklicznego, when powstaje kolejne wystąpienie,
  then jest ono trwale **powiązane** z domkniętym poprzednikiem, a jego „data ostatniego zrobienia"
  równa się dacie zrobienia poprzednika.
- [ ] **AC-3 (rozróżnienie dat)** — „Data zrobienia" dotyczy **tego** zadania (puste, dopóki niezrobione);
  „data ostatniego zrobienia" to data zrobienia **powiązanego poprzednika**. Aktywne (niezrobione)
  cykliczne pokazuje „datę ostatniego zrobienia", a nie własną datę zrobienia.
- [ ] **AC-4 (sync po edycji)** — Given domknięte cykliczne, które ma następcę, when zmieniam jego datę
  zrobienia, then „data ostatniego zrobienia" następcy zostaje zaktualizowana na tę samą datę.
- [ ] **AC-5 (pole w szczegółach pod „Start")** — Given szczegóły zadania, then „data zrobienia" jest
  edytowalnym polem daty **bezpośrednio pod polem „Start"**, wyglądającym i działającym jak „Start"
  (nie w stopce Meta).
- [ ] **AC-6 (data przy oznaczaniu z listy — wariant A)** — Given lista zadań, when odhaczam pojedyncze
  zadanie klikiem ikony statusu lub skrótem `x`, then data zrobienia = „dziś" natychmiast (bez pytania);
  inną datę ustawiam w szczegółach zadania albo masowo w bulku (pole daty z 021).
- [ ] **AC-7 (usunięcie ikony sortu)** — Given pasek narzędzi listy zadań, then **nie ma** już
  przełącznika „Sortuj zrobione po dacie wykonania"; sekcja „Zrobione" wyświetla się w domyślnej
  kolejności; **znacznik „✓ data"** na wierszach pozostaje.
- [ ] **AC-8 (bez regresji)** — Given pojedyncze odhaczanie / terminy / start / inne widoki, then
  działają jak dotąd; zwykłe (niecykliczne) zadania i pola nietknięte.

## 5. Zakres
**W zakresie:**
- Trwałe **powiązanie** kolejnego wystąpienia cyklicznego z domkniętym poprzednikiem.
- **Bulk „Zrobione" roluje cykliczne** (tworzy kolejne wystąpienie), z opcjonalną wspólną datą (021).
- **Synchronizacja** „daty ostatniego zrobienia" następcy po edycji daty zrobienia poprzednika.
- **Przeniesienie/restylowanie** pola „data zrobienia" w szczegółach pod „Start".
- **Usunięcie** ikony/logiki sortowania po dacie zrobienia (znacznik „✓ data" zostaje).

**Poza zakresem (świadomie):**
- Zmiana ogólnej logiki liczenia terminów cyklicznych.
- **Backfill** powiązania i „daty ostatniego zrobienia" dla zadań utworzonych **przed** tą zmianą —
  pojawi się od następnego wykonania.
- Pytanie o datę przy pojedynczym odhaczaniu z listy (wariant A — bez pytania).

## 6. Wpływ na Omnia
- **Uprawnienie / RBAC:** bez zmian — istniejący `module.tasks`, istniejące guardy dostępu (C-21).
- **Własność danych:** bez zmian; działa na istniejących zadaniach użytkownika/zespołu.
- **Zmiana schematu:** **TAK** — potrzebne trwałe pole powiązania kolejnego wystąpienia z poprzednim
  (nullable, self-reference na `Task`), ustawiane przy rolowaniu cyklu. Ręczna migracja (C-10/C-11),
  bez enumów (C-12).
- **Asystent AI:** nie dotyczy — brak nowej `AIAction`/read-toola (zmiany w istniejących akcjach są
  wewnętrzne; sygnatury AI bez zmian).
- **Kalendarz / powiadomienia / trash:** nie dotyczy (przy usuwaniu zadania powiązanie nie może wywalać
  soft-delete — patrz ryzyka).

## 7. Zgodność z konstytucją
- **C-10/C-11/C-12** — nowe pole powiązania = ręczna migracja z sekwencyjnym numerem; zwykły typ (bez enumów).
- **C-20** — rolowanie w bulku i synchronizacja realizowane w Server Actions z `revalidatePath`.
- **C-21** — dostęp przez istniejące guardy zadania.
- **C-24 (soft-delete)** — powiązanie self-reference nie może blokować soft-delete zadania (patrz ryzyka).
- **C-30/C-32** — pole daty/etykieta na zmiennych CSS, teksty PL, wzorzec pola „Start".
- **C-50/C-51** — build zielony; wpis do `doświadczenia.md` (bulk musi rolować przez akcję cykliczną;
  link wystąpień domyka sync „ostatniego zrobienia").

## 8. Otwarte pytania / decyzje właściciela
**Decyzja przyjęta (właściciel przerwał pytanie i polecił kontynuować → wariant rekomendowany A):**
- „Jak wskazać datę zrobienia przy oznaczaniu z listy?" → **Wariant A**: pojedyncze odhaczenie (klik/`x`)
  ustawia „dziś" natychmiast, bez pytania; inną datę wskazuje się w szczegółach zadania i w bulku
  (pole daty z 021). Zachowuje keyboard-first.

**Założenia domyślne (C-53):**
- Granularność daty zrobienia: **dzień** (spójnie z 020/021 i polem „Start").
- „Data ostatniego zrobienia" jest przechowywana denormalizowana (dla wydajności/sortu znacznika) i
  utrzymywana w spójności przez powiązanie (sync przy edycji).

## 9. Ryzyka
- **Ryzyko:** self-reference `Task → Task` może blokować usuwanie/soft-delete poprzednika. Mitygacja:
  powiązanie **nullable** z zerwaniem przy usunięciu (SetNull), żeby nie łamać `deleteTask`/Kosza.
- **Ryzyko:** rolowanie w bulku wywoła `completeRecurringTask` per zadanie — inny kształt niż surowy
  update. Mitygacja: dla cyklicznych → „Zrobione" użyć akcji cyklicznej; niecykliczne i inne statusy
  bez zmian.
- **Ryzyko:** stare zadania bez powiązania. Mitygacja: świadomie poza zakresem (backfill) — spójność od
  następnego wykonania.
- **Ryzyko:** usunięcie ikony sortu nie może zepsuć sekcji „Zrobione". Mitygacja: sekcja wraca do
  domyślnej kolejności; znacznik daty pozostaje.
