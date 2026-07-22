# Spec: Przepisanie kompozytora asystenta AI (układ jak „Chat with Claude")

- **ID:** 019-assistant-composer-rewrite
- **Status:** draft
- **Autor sesji:** Claude Code (spec-driven pipeline)
- **Data:** 2026-07-22
- **Moduł(y):** Asystent AI (Home / okno asystenta)

> **Zasada speca:** opisujemy **CO i DLACZEGO**, nigdy **JAK**. Bez nazw plików, komponentów, CSS.

## 1. Problem / potrzeba
Kompozytor (pole wpisywania) asystenta AI ma **uporczywy błąd karetki na iOS**: po tapnięciu w pole
kursor pojawia się **nad** polem, a „wskakuje" do środka dopiero po rozpoczęciu pisania (czasem
losowo, przy kolejnych tapnięciach). Kilka prób punktowej naprawy nie rozwiązało problemu, a jedna
pogorszyła płynność przewijania czatu. Właściciel chce **świeżego, poprawnego** kompozytora
zaprojektowanego od nowa, działającego i wyglądającego **analogicznie do czatu „Chat with Claude"**
(dwuwierszowa karta nad klawiaturą — załączone 4 screeny referencyjne), który przy okazji trwale
usuwa błąd karetki.

## 2. Cel i miary sukcesu
- Cel: kompozytor asystenta w układzie dwuwierszowym (pole tekstowe u góry, wiersz akcji na dole),
  z poprawnie działającą karetką na iOS i płynnym przewijaniem czatu.
- Sukces mierzymy:
  - Po tapnięciu w pole kursor jest **od razu w polu** (przy pierwszym i każdym kolejnym tapnięciu).
  - Pole **rośnie** wraz z ilością tekstu (wielolinijkowo), a po osiągnięciu maksimum przewija się.
  - Przewijanie wątku czatu jest płynne (bez „szarpania").
  - Akcje (zrób zdjęcie / dodaj zdjęcie / dyktowanie / wyślij / rozmowa głosowa) są dostępne w
    czytelnym dolnym wierszu, a ustawienia asystenta są w górnym pasku okna.

## 3. Historyjki użytkownika
- Jako użytkownik na telefonie chcę, żeby po dotknięciu pola kursor był od razu w środku, żebym mógł
  pisać bez dezorientacji.
- Jako użytkownik chcę, żeby pole rosło razem z moją wiadomością (jak w Claude), żeby widzieć całą
  wpisywaną treść.
- Jako użytkownik chcę mieć pod polem czytelne ikony: zrób zdjęcie, dodaj zdjęcie, dyktowanie oraz
  główny przycisk wyślij/rozmowa głosowa — bez zbędnego menu „+".
- Jako użytkownik chcę mieć ustawienia asystenta w górnym pasku okna (obok historii rozmów), a nie
  ukryte w kompozytorze.

## 4. Kryteria akceptacji (testowalne)
- [ ] **AC-1 (karetka)** — Given asystent otwarty na iOS, when użytkownik tapie w pole wpisywania (raz
  i ponownie po zamknięciu/otwarciu klawiatury), then karetka pojawia się **wewnątrz** pola od razu,
  bez fazy „kursor nad polem" (żadnego offsetu do pierwszego wpisania).
- [ ] **AC-2 (auto-rozrost)** — Given puste pole, when użytkownik wpisuje tekst na wiele linii, then
  pole **rośnie** wraz z treścią do rozsądnego maksimum, a powyżej maksimum treść przewija się
  wewnątrz pola; po wysłaniu pole wraca do wysokości jednej linii.
- [ ] **AC-3 (układ dwuwierszowy)** — Given otwarty kompozytor, then jest to karta nad klawiaturą z
  **polem tekstowym u góry** i **osobnym dolnym wierszem akcji** (jak „Chat with Claude").
- [ ] **AC-4 (akcje w dolnym wierszu)** — Given dolny wiersz akcji, then po lewej są ikony **zrób
  zdjęcie (aparat)** i **dodaj zdjęcie (z galerii)**, a po prawej **mikrofon (dyktowanie)** oraz
  **główny okrągły przycisk**: gdy w polu jest tekst → **wyślij**; gdy pole puste → **wejście w tryb
  rozmowy głosowej**. Obie ikony zdjęć prowadzą do istniejącego rozpoznawania obrazu.
- [ ] **AC-5 (ustawienia w nagłówku)** — Given górny pasek okna asystenta, then znajduje się tam
  ikona **Ustawienia asystenta AI** (obok historii rozmów / nowej rozmowy / zamknięcia); w
  kompozytorze **nie ma** już menu „+" ani ikony ustawień.
- [ ] **AC-6 (płynne przewijanie)** — Given wątek z wieloma wiadomościami, when użytkownik przewija
  czat (klawiatura otwarta i zamknięta), then przewijanie jest płynne, a kompozytor nie „skacze".
- [ ] **AC-7 (zachowana funkcjonalność)** — Given nowy kompozytor, then nadal działają: wysyłanie i
  Stop generowania, dyktowanie mowy (dopisuje tekst), tryb rozmowy głosowej, podgląd i wysyłka
  dołączonego zdjęcia, panel ustawień asystenta, historia rozmów, nowa rozmowa, zgłaszanie problemu
  (admin), streaming myśli agenta na żywo.
- [ ] **AC-8 (kreska iPhone)** — Given klawiatura zamknięta na iPhonie, then pole nie jest zasłonięte
  systemową kreską (home indicator); **jednocześnie** nie może to psuć karetki (AC-1).
- [ ] **AC-9 (desktop bez regresji)** — Given desktop, then układ, autofokus i wysyłka działają jak
  dotąd, bez regresji.

## 5. Zakres
**W zakresie:**
- Przeprojektowanie **fragmentu kompozytora** okna asystenta na układ dwuwierszowy (pole + dolny
  wiersz akcji) wzorowany na „Chat with Claude".
- Poprawne działanie karetki na iOS (naprawa strukturalna) i płynne przewijanie czatu.
- Ikony akcji: **zrób zdjęcie (aparat)** i **dodaj zdjęcie (z galerii)** — obie do istniejącego
  pipeline'u rozpoznawania obrazu; **dyktowanie**; **główny przycisk** wyślij/rozmowa głosowa.
- **Przeniesienie ikony „Ustawienia asystenta AI"** z kompozytora do górnego paska okna asystenta.
- Zachowanie całej dotychczasowej logiki agenta/wysyłki/dyktowania/głosu/historii/streamingu.

**Poza zakresem (świadomie):**
- **Ikona „dodaj plik" i obsługa plików innych niż obrazy** — właściciel z niej rezygnuje (decyzja
  poniżej). Zostają tylko zdjęcia.
- Zmiana logiki agenta/LLM, promptów, protokołu narzędzi, modeli danych.
- **Wybór modelu w kompozytorze** (u Claude „Opus 4.8 High") — Omnia routinguje modele w Admin → LLM,
  nie w kompozytorze.
- Pełna obsługa dokumentów (upload do Drive / czytanie treści plików) — osobny, przyszły feature.

## 6. Wpływ na Omnia
- **Uprawnienie / RBAC:** bez zmian — asystent działa w istniejącym kontekście (Home), bez nowego slugu.
- **Własność danych:** nie dotyczy — brak nowych danych/modeli; rozmowy nadal per-user jak dziś.
- **Asystent AI:** brak nowej `AIAction`/read-toola — zmiana jest **wyłącznie w warstwie kompozytora
  (UI)** okna asystenta; logika agenta i wysyłki obrazu bez zmian (C-23 nie dotyczy).
- **Kalendarz / powiadomienia / trash:** nie dotyczy.

## 7. Zgodność z konstytucją
- **C-30 (motyw przez zmienne CSS)** — karta, ikony i przyciski używają zmiennych CSS; tekst na
  akcentach = `var(--on-accent)`; zero hardcodu kolorów.
- **C-31 (mobile-first, safe-area, klawiatura)** — kluczowa: AC-1/AC-2/AC-3/AC-6/AC-8 to wprost
  poprawne zachowanie mobilne, respektowanie `env(safe-area-inset-bottom)` **bez** psucia karetki.
- **C-32 (teksty PL)** — etykiety/aria po polsku.
- **C-53 (minimalizm)** — przepisujemy tylko kompozytor + przenosimy jedną ikonę; bez nowych
  zależności, bez zmian w agencie, bez „przy okazji" refaktorów logiki.
- **C-50 (build zielony)** — zmiana musi przejść build (weryfikacja do `next build`).
- **C-51 (wpis do `doświadczenia.md`)** — dopisujemy lekcję o właściwej, strukturalnej naprawie
  karetki (i o tym, czego NIE robić — dynamiczny inset/VisualViewport pod fokusowanym polem).

## 8. Otwarte pytania / decyzje właściciela
**Zadane i rozstrzygnięte na `/specify` (C-55):**
- „Co ma robić ikona »dodaj plik«?" → **Właściciel rezygnuje z dodawania plików innych niż obrazy.**
  W kompozytorze zostają **tylko** akcje zdjęć (zrób zdjęcie + dodaj zdjęcie). Brak ikony „dodaj
  plik". Reszta zakresu bez zmian.

**Założenia przyjęte domyślnie (rozsądny domyślny, C-53):**
- „Zrób zdjęcie" i „Dodaj zdjęcie" to **dwie osobne ikony** prowadzące do tego samego istniejącego
  rozpoznawania obrazu (aparat vs galeria) — zgodnie z referencyjnym układem i intencją właściciela.
- Główny przycisk zachowuje dzisiejsze zachowanie: **wyślij** przy tekście, **rozmowa głosowa** przy
  pustym polu (jak w obecnym asystencie i w Claude).

## 9. Ryzyka
- **Ryzyko:** przepisanie kompozytora nie usuwa błędu karetki na iOS (nie da się go zweryfikować w
  sandboxie). Mitygacja: układ strukturalny jak w Claude (pole NIE przy samej dolnej krawędzi karty —
  pod nim jest wiersz akcji; margines na kreskę iPhone **nie** pod fokusowanym polem) + weryfikacja
  właściciela na urządzeniu na środowisku testowym (`develop`) przed promocją.
- **Ryzyko:** regresja istniejących funkcji przy przepisaniu (dyktowanie, głos, wysyłka obrazu,
  streaming). Mitygacja: zachowujemy istniejące handlery i stan; zmieniamy tylko układ/prezentację.
- **Ryzyko:** utrata płynności przewijania (jak przy odrzuconym VisualViewport). Mitygacja: brak
  dynamicznej zmiany wysokości karty na zdarzeniach przewijania.
