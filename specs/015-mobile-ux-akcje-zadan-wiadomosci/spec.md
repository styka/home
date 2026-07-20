# Spec: Poprawki UX/UI mobile — pasek akcji zadań, feedback zapisu cykliczności, ikony Wiadomości

- **ID:** 015-mobile-ux-akcje-zadan-wiadomosci
- **Status:** draft
- **Autor sesji:** Claude Code (spec-driven pipeline)
- **Data:** 2026-07-20
- **Moduł(y):** Tasks (`/tasks`), Wiadomości (`/wiadomosci`)

> **Zasada speca:** opisujemy **CO i DLACZEGO**, nigdy **JAK**.

## 1. Problem / potrzeba
Trzy niezależne, ale spójne tematycznie usterki UX zgłoszone przez właściciela — głównie na mobile:
1. **Pasek ikon zmieniających widok listy zadań** jest niespójny: ikony pojawiają się/znikają zależnie
   od kontekstu (m.in. dla grupy z wieloma listami) bez czytelnej logiki, część opcji nie ma sensu w
   danym widoku, a na wąskim ekranie cały rząd przewija się poziomo — użytkownik nie wie, że można go
   scrollować, więc część akcji jest „niewidoczna".
2. **Zapis ustawień cykliczności zadania** na mobile nie daje żadnego widocznego potwierdzenia — po
   dotknięciu „Zapisz" wygląda, jakby nic się nie stało.
3. **Ikony akcji na liście tematów w Wiadomościach** są za małe i praktycznie niedostępne na mobile
   (chowają się do najechania kursorem, którego na dotyku nie ma).

Efekt: użytkownik gubi funkcje i nie ma pewności, czy jego akcja zadziałała — sprzeczne z filozofią
„zero zbędnych kliknięć, pełna czytelność".

## 2. Cel i miary sukcesu
- Cel: na mobile wszystkie akcje paska widoku zadań są odkrywalne, sensowne w danym kontekście i
  spójne; zapis cykliczności daje natychmiastowy, widoczny feedback; akcje tematów Wiadomości są
  dotykalne i odpowiednio duże.
- Sukces mierzymy:
  - użytkownik na telefonie widzi wskazówkę, że pasek ikon można przewinąć, i dociera do każdej akcji;
  - po zapisaniu cykliczności użytkownik dostaje jednoznaczny sygnał sukcesu (≤1 s);
  - edycja/usuwanie tematu Wiadomości jest osiągalne dotykiem bez najeżdżania kursorem.

## 3. Historyjki użytkownika
- Jako użytkownik na telefonie chcę widzieć, że pasek ikon nad listą zadań da się przewinąć, żeby nie
  przegapić żadnej akcji zmiany widoku.
- Jako użytkownik chcę, żeby w danym widoku listy zadań pojawiały się tylko te ikony/opcje, które mają
  w nim sens, żeby pasek był przewidywalny i nie mylił mnie znikającymi przyciskami.
- Jako użytkownik ustawiający cykliczność zadania na telefonie chcę natychmiast zobaczyć, że zapis się
  udał, żeby mieć pewność, że nie muszę klikać ponownie.
- Jako użytkownik przeglądający tematy w Wiadomościach na telefonie chcę móc dotknąć akcji edycji/
  usunięcia tematu, bo nie mam kursora do „hover".

## 4. Kryteria akceptacji (testowalne)
- [ ] **AC-1** — Given lista zadań na wąskim ekranie z paskiem akcji szerszym niż ekran, when pasek
  jest przewijalny poziomo, then użytkownik widzi trwałą, estetyczną wskazówkę przewijania (np.
  zanikający gradient/„fade" na krawędzi) sygnalizującą, że są kolejne ikony poza kadrem.
- [ ] **AC-2** — Given dowolny widok listy zadań (pojedyncza lista, widoki wirtualne dziś/nadchodzące/
  zaległe/wszystkie, grupa wielu list), when otwieram pasek akcji, then widoczne są wyłącznie akcje
  sensowne w tym kontekście, a reguła ich pokazywania/ukrywania jest spójna i udokumentowana w planie
  (żadna akcja nie znika „przypadkiem").
- [ ] **AC-3** — Given zadanie z otwartymi ustawieniami cykliczności, when dotykam „Zapisz" na mobile,
  then w ≤1 s pojawia się widoczne potwierdzenie zapisu (np. zmiana stanu przycisku / komunikat), tak
  że użytkownik jednoznacznie wie, że akcja się powiodła.
- [ ] **AC-4** — Given lista tematów w Wiadomościach na urządzeniu dotykowym, when przeglądam temat,
  then akcje edycji i usunięcia tematu są widoczne i dotykalne bez „hover", a ich cel dotyku spełnia
  minimum mobilne (por. C-31).
- [ ] **AC-5** — Given te same ekrany na desktopie, when korzystam z nich myszą/klawiaturą, then
  dotychczasowe zachowanie i estetyka nie ulegają regresji (zmiany nie psują widoku desktopowego).

## 5. Zakres
**W zakresie:**
- Pasek akcji/ikon zmiany widoku nad listą zadań: uporządkowanie logiki widoczności poszczególnych
  ikon per kontekst (w tym grupa wielu list) oraz czytelna wskazówka przewijania poziomego na mobile.
- Widoczny feedback po zapisie ustawień cykliczności zadania (szczególnie mobile).
- Dostępność i rozmiar akcji na liście tematów w module Wiadomości na mobile/dotyku.

**Poza zakresem (świadomie):**
- Zmiana samego zestawu widoków zadań (Lista/Kanban/Timeline) czy dodawanie nowych trybów.
- Zmiana logiki cykliczności zadań (reguł powtarzania) — dotykamy tylko warstwy feedbacku UI.
- Przeprojektowanie całego modułu Wiadomości poza wskazaną listą tematów.
- Globalny system „toast/snackbar" dla całej aplikacji, jeśli nie jest konieczny do spełnienia AC-3
  (dopuszczalne rozwiązanie lokalne, minimalne — C-53).

## 6. Wpływ na Omnia
- **Uprawnienie / RBAC:** bez zmian — korzystamy z istniejących `module.tasks` i `module.news`.
- **Własność danych:** bez zmian — brak nowych modeli/kolumn; to zmiany czysto prezentacyjne
  (feedback zapisu korzysta z istniejących Server Actions).
- **Asystent AI:** nie dotyczy (brak nowej `AIAction`/read-toola).
- **Kalendarz / powiadomienia / trash:** nie dotyczy.

## 7. Zgodność z konstytucją
- **C-31 (mobile-first / cele dotyku)** — sedno zadań 1 i 3: odkrywalność scrolla, brak zależności od
  hover na dotyku, minimalny cel dotyku.
- **C-30 (motyw przez zmienne CSS)** — wskazówka „fade"/gradient i stany feedbacku wyłącznie na
  `var(--*)`, bez hardcodowanych hexów (skinowalność).
- **C-32 (teksty po polsku)** — ewentualne komunikaty potwierdzenia po polsku.
- **C-20 (Server Actions + `revalidatePath`)** — feedback zapisu nie omija istniejącego przepływu akcji.
- **C-53 (minimalizm)** — najmniejsze możliwe zmiany, bez nowych zależności i refaktorów „przy okazji".
- **C-50/C-52** — „gotowe" = zielony `npm run build`; po tym auto-merge do `develop`.

## 8. Otwarte pytania / decyzje właściciela
Brak pytań wymagających właściciela — zgłoszenie jest jednoznaczne, a warianty rozstrzygamy
rekomendowanymi domyślnymi (C-55). Przyjęte założenia:
- **Wskazówka scrolla (zad. 1):** zanikający gradient/„fade" na krawędzi paska (subtelny, estetyczny),
  zamiast strzałek czy widocznego paska przewijania.
- **Widoczność ikon per kontekst (zad. 1):** utrzymujemy obecną zasadę „pokazuj akcję tam, gdzie ma
  sens" (np. grupowanie po priorytetach tylko w widokach zbiorczych, zaznaczanie wielu tylko w
  układzie Lista), ale ujednolicamy i dokumentujemy ją w planie; usuwamy tylko realne niespójności.
- **Feedback zapisu (zad. 2):** lokalny, minimalny sygnał sukcesu (stan przycisku „Zapisano" +
  krótki komunikat), bez wprowadzania globalnego systemu powiadomień, jeśli nie jest konieczny.
- **Akcje tematów Wiadomości (zad. 3):** na dotyku akcje są zawsze widoczne (nie tylko na hover) i
  powiększone do mobilnego celu dotyku; na desktopie zachowujemy dotychczasowe „pokaż na hover".

## 9. Ryzyka
- **Regresja desktopu** przy zmianach mobilnych → AC-5 pilnuje braku regresji; zmiany warunkowane
  breakpointami/wariantami, nie globalne.
- **Niespójny feedback** (zad. 2) mógłby wejść w kolizję z istniejącym stanem „zapisywania" w
  `TaskDetail` → plan ma wpiąć się w istniejący mechanizm `run(...)`/pending, a nie tworzyć równoległy.
- **„Fade" zasłaniający treść** → gradient dekoracyjny, nieprzechwytujący kliknięć (pointer-events),
  zgodny ze skórką.
