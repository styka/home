# Spec: Poprawki UI na mobile — zadania + asystent AI

- **ID:** 018-mobile-ui-bugs
- **Status:** draft
- **Autor sesji:** Claude Code (spec-driven pipeline)
- **Data:** 2026-07-22
- **Moduł(y):** Tasks (`/tasks`), Asystent AI (Home / `AICommandSheet`), warstwa globalna (globals.css)

> **Zasada speca:** opisujemy **CO i DLACZEGO**, nigdy **JAK**. Zero nazw plików, tabel, bibliotek,
> endpointów. (Odwołania do modułów/route'ów poniżej służą tylko wskazaniu granic zgłoszeń.)

## 1. Problem / potrzeba
Administrator (właściciel, Szymon) zgłosił cztery błędy UI/UX widoczne na telefonie (głównie iOS),
które psują codzienne korzystanie z aplikacji:
1. Pasek akcji masowych dla zaznaczonych zadań nie mieści się w całości na wąskim ekranie — część
   przycisków jest niedostępna.
2. Kliknięcie w pole formularza w asystencie AI powoduje niechciane automatyczne przybliżenie (zoom)
   widoku przez iOS Safari — mimo że w innych miejscach zostało to już naprawione.
3. Ikona „Sortuj zrobione po dacie wykonania" na liście zadań nie daje żadnej widocznej różnicy po
   kliknięciu — funkcja wygląda na niedziałającą.
4. Pole wpisywania wiadomości do asystenta AI jest umieszczone tak nisko, że częściowo zasłania je
   systemowa kreska iOS (home indicator).

Te usterki dotykają dwóch najczęściej używanych powierzchni (lista zadań i asystent AI), więc obniżają
komfort korzystania z całej aplikacji na telefonie.

## 2. Cel i miary sukcesu
- Cel: wszystkie cztery zgłoszone usterki mobilne są usunięte, a asystent AI i lista zadań są w pełni
  używalne na telefonie (iOS), bez utraty funkcjonalności na desktopie.
- Sukces mierzymy:
  - Na wąskim ekranie każdy przycisk paska akcji masowych jest osiągalny (widoczny lub dostępny bez
    obcinania).
  - Fokus dowolnego pola wprowadzania danych w aplikacji (w tym w asystencie AI) **nie** wywołuje
    auto-zoomu iOS.
  - Kliknięcie ikony sortowania zrobionych zadań po dacie wykonania zmienia widocznie kolejność
    zrobionych zadań, a stan aktywny przycisku jest czytelny.
  - Pole wpisywania wiadomości do asystenta AI nie jest zasłaniane przez kreskę/home indicator iOS.

## 3. Historyjki użytkownika
- Jako użytkownik na telefonie chcę mieć dostęp do wszystkich akcji na zaznaczonych zadaniach, żeby
  móc wykonać operację masową bez przewijania desktopowej wersji.
- Jako użytkownik na iPhonie chcę, żeby dotknięcie pola tekstowego (np. w czacie asystenta) nie
  przybliżało ekranu, żebym nie musiał ręcznie oddalać widoku po każdym wpisaniu.
- Jako użytkownik chcę, żeby ikona sortowania zrobionych zadań realnie zmieniała ich kolejność i
  pokazywała, czy jest aktywna, żebym wiedział, że funkcja działa.
- Jako użytkownik na iPhonie chcę, żeby pole pisania do asystenta było nad kreską systemową, żebym
  mógł swobodnie pisać i widzieć całą treść pola.

## 4. Kryteria akceptacji (testowalne)
- [ ] **AC-1** — Given lista zadań z zaznaczonymi ≥1 zadaniami na wąskim ekranie (mobile), when pojawia
  się pasek akcji masowych, then wszystkie jego akcje są osiągalne dla użytkownika (żaden przycisk nie
  jest trwale ucięty poza obszarem ekranu).
- [ ] **AC-2** — Given dowolny widok aplikacji na urządzeniu dotykowym (iOS), when użytkownik ustawia
  fokus w polu input/textarea/select (w tym w polu wiadomości asystenta AI), then przeglądarka **nie**
  wykonuje automatycznego przybliżenia widoku.
- [ ] **AC-3** — Given lista zadań zawierająca ukończone zadania z różnymi datami wykonania, when
  użytkownik klika ikonę „Sortuj zrobione po dacie wykonania", then kolejność wyświetlania ukończonych
  zadań zmienia się w widoczny sposób (sortowanie po dacie wykonania), a ponowne kliknięcie przełącza
  stan; przycisk sygnalizuje, czy sortowanie jest aktywne.
- [ ] **AC-4** — Given otwarty asystent AI na urządzeniu iOS z bezpiecznym marginesem dolnym
  (home indicator), when użytkownik patrzy na pole wpisywania wiadomości, then całe pole jest widoczne
  nad kreską systemową (respektuje `safe-area-inset-bottom`).
- [ ] **AC-5** — Given desktop (pointer: fine), when korzystamy z tych samych widoków, then gęstość
  tekstu pól i układ pozostają bez regresji (zmiany dotyczą zachowania mobilnego / dostępności).

## 5. Zakres
**W zakresie:**
- Naprawa przepełnienia paska akcji masowych zaznaczonych zadań na mobile.
- Globalne, spójne wyeliminowanie auto-zoomu iOS przy fokusie pól wprowadzania danych — z naciskiem
  na przypadki, które obecnie „uciekają" istniejącej regule (asystent AI). Przegląd pól
  input/textarea/select pod tym kątem.
- Naprawa działania i czytelności stanu ikony „Sortuj zrobione po dacie wykonania" na liście zadań.
- Poszanowanie `safe-area-inset-bottom` przez pole kompozytora wiadomości asystenta AI.

**Poza zakresem (świadomie):**
- Zmiany logiki sortowania innych sekcji niż „zrobione" oraz nowe opcje sortowania.
- Przeprojektowanie paska akcji masowych czy asystenta AI (tylko naprawy usterek, minimalizm — C-53).
- Zmiany na desktopie inne niż konieczne do braku regresji.
- Nowe uprawnienia, modele danych, migracje, `AIAction` — te usterki są czysto prezentacyjne/kliencie.

## 6. Wpływ na Omnia
- **Uprawnienie / RBAC:** bez zmian — korzystamy z istniejących `module.tasks` i asystenta na Home.
- **Własność danych:** nie dotyczy — brak nowych danych ani zmian modelu współwłasności.
- **Asystent AI:** nie dotyczy warstwy akcji — brak nowej `AIAction`/read-toola; zmiany są wyłącznie w
  prezentacji kompozytora czatu (zoom + safe-area).
- **Kalendarz / powiadomienia / trash:** nie dotyczy.

## 7. Zgodność z konstytucją
- **C-30 (motyw przez zmienne CSS)** — ewentualne poprawki stylów używają istniejących zmiennych, bez
  hardcodowania kolorów.
- **C-31 (mobile-first, safe-area, brak dwóch sidebarów)** — kluczowa: AC-1, AC-2, AC-4 to wprost
  respektowanie zasad mobilnych i `env(safe-area-inset-bottom)`.
- **C-32 (teksty po polsku)** — wszelkie etykiety/aria pozostają po polsku.
- **C-53 (minimalizm)** — najmniejsze możliwe naprawy, bez refaktorów „przy okazji" i nowych zależności.
- **C-50 (definicja gotowe: `npm run build`)** — zmiany muszą przejść build (weryfikacja do `next build`).
- **C-51 (wpis do `doświadczenia.md`)** — po naprawie dopisujemy lekcje (zwłaszcza dlaczego asystent
  „uciekał" globalnej regule anty-zoom).

## 8. Otwarte pytania / decyzje właściciela
Brak pytań do właściciela — zgłoszenia są jednoznaczne (konkretne elementy, route'y, oczekiwane
zachowanie). Decyzje techniczne rozstrzygamy rozsądnym domyślnym zgodnie z C-53/C-55.

**Założenia przyjęte domyślnie (do potwierdzenia w razie potrzeby na późniejszym etapie — C-55):**
- Dla przepełnienia paska akcji (AC-1) preferujemy rozwiązanie zachowujące wszystkie akcje bez ich
  ukrywania (np. dopasowanie układu tak, by mieściły się/były przewijalne) — dokładny wariant dobierze
  `plan.md` wg wzorca sąsiednich pasków mobilnych.
- Auto-zoom (AC-2) naprawiamy globalnie w warstwie stylów/komponentów pól, tak by przypadek asystenta
  był objęty tą samą regułą co reszta aplikacji (bez blokowania pinch-zoomu — dostępność).

## 9. Ryzyka
- **Ryzyko:** wymuszenie 16px na polach na mobile psuje gęsty układ desktopu → ograniczamy zmiany do
  `pointer: coarse` (zgodnie z istniejącą regułą) i weryfikujemy brak regresji (AC-5).
- **Ryzyko:** naprawa paska akcji na mobile psuje wygląd na desktopie → zmiany celujemy w breakpoint
  mobilny, desktop bez zmian.
- **Ryzyko:** asystent „ucieka" globalnej regule anty-zoom z nieoczywistego powodu (inline font-size,
  contenteditable, komponent nietypowy) → `plan` musi wskazać dokładną przyczynę, a nie tylko
  powtórzyć istniejącą regułę.
