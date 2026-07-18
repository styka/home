# Spec: Ikona akcji w nagłówku okna asystenta AI

- **ID:** 001-assistant-header-icon
- **Status:** draft
- **Autor sesji:** Claude Code (spec-driven pipeline)
- **Data:** 2026-07-18
- **Moduł(y):** Home / Asystent AI (`AICommandSheet`)

> **Zasada speca:** opisujemy **CO i DLACZEGO**, nigdy **JAK**.

## 1. Problem / potrzeba
W oknie globalnego asystenta AI, w prawym górnym rogu, jest sekcja akcji okna (nowa rozmowa,
historia rozmów, zamknij). Właściciel chce, żeby w tej sekcji — blisko ikony historii czatów —
pojawiła się dodatkowa **ikona akcji**. Naturalnym brakiem w tej sekcji jest szybki dostęp do
**ustawień asystenta**: panel ustawień już istnieje, ale jest schowany w menu „+" przy polu
tekstowym (na dole), więc trudno go znaleźć.

## 2. Cel i miary sukcesu
- Cel: w nagłówku okna asystenta AI dochodzi jedna ikona-akcja obok istniejących (historia, nowa
  rozmowa, zamknij), otwierająca istniejący panel ustawień asystenta.
- Sukces mierzymy: użytkownik otwiera ustawienia asystenta z nagłówka okna w **1 kliknięcie**
  (dziś: „+" → „Ustawienia asystenta" = 2 kliknięcia).

## 3. Historyjki użytkownika
- Jako użytkownik asystenta AI chcę mieć w nagłówku okna ikonę do ustawień, żeby szybko wejść w
  stałe preferencje bez szukania ich w menu „+".

## 4. Kryteria akceptacji (testowalne)
- [ ] **AC-1** — Given otwarte okno asystenta AI, when patrzę na sekcję akcji w nagłówku (prawy
  górny róg, przy ikonie historii rozmów), then widzę **dodatkową ikonę** obok dotychczasowych
  (nowa rozmowa / historia / zamknij).
- [ ] **AC-2** — Given otwarte okno asystenta, when klikam nową ikonę, then otwiera się (i po
  ponownym kliknięciu zamyka) istniejący panel ustawień asystenta („Stałe preferencje" + głos
  lektora) — ten sam, który był dotąd dostępny z menu „+".
- [ ] **AC-3** — Given nowa ikona, then ma `title`/`aria-label` po polsku i jej kolory pochodzą ze
  zmiennych CSS (motyw/skórka), a nie z zahardkodowanych hexów.
- [ ] **AC-4** — Given ekran mobilny (`md:hidden`), when otwieram okno asystenta, then nagłówek z
  nową ikoną nie łamie układu (ikony mieszczą się w rzędzie akcji).

## 5. Zakres
**W zakresie:**
- Jedna dodatkowa ikona-akcja w rzędzie akcji nagłówka okna asystenta AI (`AICommandSheet`),
  otwierająca istniejący panel ustawień asystenta (`showPrefs`).

**Poza zakresem (świadomie):**
- Zmiana samego panelu ustawień, dodawanie nowych ustawień.
- Zmiana ikon/akcji w innych oknach czy modułach (w tym w module Zdrowie — karta „Dostęp
  asystenta AI do danych zdrowotnych" już ma ikonę i nie jest przedmiotem tego zadania).
- Nowe ikony generowane / brandowe; używamy istniejącego zestawu `lucide-react`.

## 6. Wpływ na Omnia
- **Uprawnienie / RBAC:** brak zmian — asystent jest dostępny jak dotąd; żadnego nowego slug'a.
- **Własność danych:** nie dotyczy — zmiana czysto UI, bez modelu danych i bez migracji.
- **Asystent AI:** nie dotyczy warstwy AIAction/read-tooli — to tylko element UI okna asystenta;
  brak nowej `AIAction`.
- **Kalendarz / powiadomienia / trash:** nie dotyczy.

## 7. Zgodność z konstytucją
- **C-01/C-02** — praca w `worldofmag/`, importy przez alias `@/*`.
- **C-30** — kolory ikony ze zmiennych CSS (`var(--text-muted)`/`var(--accent-*)`), nie hex; brak
  `#fff` na tekście/ikonie.
- **C-31** — układ mobilny: rząd akcji nagłówka nie może się rozjechać; min. cel dotyku zachowany.
- **C-32** — teksty (`title`/`aria-label`) po polsku.
- **C-53** — minimalizm: brak nowych zależności, brak nowej logiki — reużywamy istniejący
  `showPrefs`/`setShowPrefs` i zaimportowaną już ikonę `Settings`.
- **C-50/C-52** — „gotowe" = `npm run build` zielony, potem auto-merge do `develop`.

## 8. Otwarte pytania / decyzje właściciela
- [x] **Gdzie doda ikonę?** — Odpowiedź właściciela (jedyny moment pytań): „header okna asystenta
  AI, blisko ikon do pokazywania historii chatów — sekcja z akcjami dla okna asystenta AI". („Healer"
  w oryginalnym zgłoszeniu to literówka od „header".)
- [x] **Jaka to ma być ikona/akcja?** — nie doprecyzowano; przyjęto rozsądny domyślny (C-55: decyzja
  tania i odwracalna, nie wymaga kolejnego pytania): **ikona ustawień (gear)** otwierająca istniejący,
  dziś schowany w menu „+" panel „Ustawienia asystenta". Gdyby właściciel chciał inną akcję/ikonę —
  zmiana jest jednolinijkowa.

## 9. Ryzyka
- Duplikacja wejścia do ustawień (nagłówek + menu „+") → świadoma, to skrót; menu „+" zostaje bez zmian.
- Zatłoczenie rzędu akcji na wąskich ekranach → ikony są małe (16px), rząd i tak mieści 3; 4. ikona
  bezpieczna. Weryfikujemy w AC-4.
