# Spec: Poprawki UX/UI — przepełnienie strony, widoczność ikon/pól, zoom na focus

- **ID:** 014-ux-ui-polish-fixes
- **Status:** draft
- **Autor sesji:** Claude Code (spec-driven pipeline)
- **Data:** 2026-07-20
- **Moduł(y):** Wiadomości (news), Tasks, oraz globalny chrome/AppShell (asystent AI + viewport)

> **Zasada speca:** opisujemy **CO i DLACZEGO**, nigdy **JAK**. Zero nazw plików, tabel, bibliotek,
> endpointów.

## 1. Problem / potrzeba
Administrator zgłosił cztery niezależne defekty UX/UI, które psują codzienne korzystanie z aplikacji na
telefonie i komputerze:
1. Treści w module **Wiadomości** rozpychają stronę w poziomie poza obszar widoku (widoczne szczególnie
   przy dużych zdjęciach i długich linkach) — pojawia się poziomy scroll / obcięcie treści.
2. Ikona **asystenta AI** (globalny przycisk Sparkles) jest **niewidoczna**, gdy otwarte są **szczegóły
   zadania** — i na mobilu, i na komputerze.
3. Pole **daty** przy **ręcznym dodawaniu zadania** jest słabo widoczne (zlewa się z tłem, zwłaszcza w
   niektórych skórkach), podczas gdy inne pola daty (np. w szczegółach zadania) są czytelne nawet bez
   ustawionej wartości.
4. Aplikacja **przybliża widok** (auto-zoom) po kliknięciu w pole formularza — niechciany efekt, głównie
   na iOS/mobile.

To są defekty polerskie, ale realnie utrudniają obsługę i psują wrażenie dopracowania.

## 2. Cel i miary sukcesu
- Cel: usunąć wszystkie cztery defekty tak, aby interfejs był czytelny i nie „uciekał" poza ekran na
  żadnym z docelowych urządzeń (telefon + desktop), w każdej z systemowych skórek.
- Sukces mierzymy obserwowalnie:
  - Wiadomości: brak poziomego scrolla strony niezależnie od rozmiaru zdjęcia/długości linku.
  - Asystent AI: ikona Sparkles jest widoczna i klikalna także przy otwartych szczegółach zadania.
  - Data przy dodawaniu zadania: pole jest wyraźnie widoczne (obramowanie/kontrast) także bez wartości,
    spójnie z polami daty w szczegółach zadania.
  - Zoom: kliknięcie w pole formularza nie powoduje automatycznego przybliżenia widoku.

## 3. Historyjki użytkownika
- Jako użytkownik czytający Wiadomości na telefonie chcę, żeby treść mieściła się w szerokości ekranu,
  żebym nie musiał przewijać w bok ani oglądać obciętych zdjęć/linków.
- Jako użytkownik przeglądający szczegóły zadania chcę wciąż widzieć i móc kliknąć ikonę asystenta AI,
  żeby zapytać go o kontekst bez zamykania szczegółów.
- Jako użytkownik dodający zadanie ręcznie chcę wyraźnie widzieć pole daty, żeby wiedzieć, gdzie ustawić
  termin — tak samo czytelnie jak w szczegółach zadania.
- Jako użytkownik mobilny chcę, żeby dotknięcie pola formularza nie przybliżało całej aplikacji, żeby
  wpisywanie danych było płynne.

## 4. Kryteria akceptacji (testowalne)
- [ ] **AC-1** — Given otwarty artykuł/treść w Wiadomościach zawierający bardzo szerokie zdjęcie lub
  bardzo długi link, when wyświetlam go na wąskim ekranie (mobile), then strona **nie** ma poziomego
  scrolla, zdjęcie skaluje się do szerokości kontenera, a długi link łamie się/zawija zamiast rozpychać
  layout.
- [ ] **AC-2** — Given otwarte szczegóły zadania (mobile i desktop), when patrzę na ekran, then ikona
  asystenta AI (Sparkles) jest widoczna i klikalna (nie jest zasłonięta ani wypchnięta poza widok).
- [ ] **AC-3** — Given formularz ręcznego dodawania zadania, when pole daty jest puste, then pole ma
  wyraźnie widoczne obramowanie/kontrast (jest rozpoznawalne jako pole daty) w każdej systemowej skórce —
  spójnie z polami daty w szczegółach zadania.
- [ ] **AC-4** — Given dowolne pole formularza w aplikacji na urządzeniu mobilnym (iOS), when dotykam go,
  then widok aplikacji **nie** przybliża się automatycznie.
- [ ] **AC-5** — Given powyższe poprawki, when przełączam systemowe skórki (Dark/Light/Casual/Blue/Pink),
  then czytelność pola daty i widoczność ikony asystenta są zachowane (brak hardcode kolorów łamiącego
  skinowalność).

## 5. Zakres
**W zakresie:**
- Poprawka przepełnienia poziomego treści w module Wiadomości (zdjęcia + długie linki/tekst).
- Przywrócenie widoczności ikony asystenta AI przy otwartych szczegółach zadania (mobile + desktop).
- Poprawa widoczności (kontrast/obramowanie) pola daty w formularzu ręcznego dodawania zadania, spójnie z
  pozostałymi polami daty.
- Wyeliminowanie automatycznego przybliżania widoku po focusie pola formularza (globalnie).

**Poza zakresem (świadomie):**
- Globalny audyt przepełnień we **wszystkich** modułach — naprawiamy zgłoszony przypadek (Wiadomości) i
  ewentualne wspólne pierwotne przyczyny, ale nie robimy pełnego przeglądu każdej strony.
- Redesign asystenta AI, formularza zadań ani modułu Wiadomości — to tylko naprawy defektów.
- Zmiany w danych, uprawnieniach, modelach czy migracjach.

## 6. Wpływ na Omnia
- **Uprawnienie / RBAC:** bez zmian — brak nowego slug'a; feature nie dotyka RBAC (C-22 nie dotyczy).
- **Własność danych:** nie dotyczy — brak zmian w danych/modelach (C-21 nie dotyczy, brak migracji).
- **Asystent AI:** nie dotyczy logiki AI/`AIAction` — chodzi wyłącznie o **widoczność** istniejącej ikony
  (C-23 nie dotyczy).
- **Kalendarz / powiadomienia / trash:** nie dotyczy.

## 7. Zgodność z konstytucją
- **C-01** — cały kod w `worldofmag/`.
- **C-30** — kolory i kontrast wyłącznie przez zmienne CSS (`var(--...)`), bez hardcode hexów; pole daty i
  ikona muszą pozostać poprawne we wszystkich skórkach (AC-5).
- **C-31** — mobile-first: naprawy dotyczą głównie zachowania na telefonie (overflow, zoom, widoczność
  ikony na mobile); respektujemy istniejący układ (nie renderujemy dwóch sidebarów, itd.).
- **C-32** — wszelkie ewentualne teksty UI po polsku (tu raczej brak nowych tekstów).
- **C-53** — minimalizm: najmniejsze możliwe poprawki, bez refaktorów „przy okazji" i nowych zależności.
- **C-50 / C-52** — „gotowe" = `npm run build` zielony; po tym auto-merge do `develop`.

## 8. Otwarte pytania / decyzje właściciela
Brak pytań do właściciela — wszystkie cztery to jednoznaczne poprawki defektów o oczywistym stanie
docelowym. Przyjęte założenia domyślne (do potwierdzenia dopiero, gdyby okazały się błędne):
- **Zoom na focus (AC-4):** preferujemy rozwiązanie **nie psujące dostępności** (nie blokujemy trwale
  pinch-zoomu użytkownika) — celem jest brak *auto-zoomu* na focus, a nie odebranie możliwości ręcznego
  przybliżania. Ostateczny sposób realizacji rozstrzyga `plan.md` (C-53, wzorzec przeglądarek).
- **Przepełnienie Wiadomości (AC-1):** naprawiamy w obrębie renderowania treści newsów; jeśli pierwotna
  przyczyna jest wspólna (np. reguła zawijania), poprawka może być wspólna, ale bez szerokiego audytu.

## 9. Ryzyka
- **Zoom vs. dostępność:** twarde wyłączenie skalowania (`user-scalable=no`) naprawiłoby auto-zoom, ale
  odebrałoby pinch-zoom i bywa ignorowane przez iOS → wybieramy podejście przyjazne dostępności (patrz §8).
- **Skórki:** poprawka kontrastu pola daty musi działać we wszystkich skórkach — ryzyko regresji ograniczamy
  używając zmiennych CSS i weryfikacją AC-5, nie hardcode kolorów.
- **Overflow z zawijaniem linków:** agresywne łamanie słów może brzydko łamać zwykły tekst → stosujemy
  łamanie tam, gdzie trzeba (długie URL/tokeny), nie globalnie „na siłę".
