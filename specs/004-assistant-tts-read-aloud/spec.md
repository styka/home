# Spec: Odczytywanie postów Asystenta na głos

- **ID:** 004-assistant-tts-read-aloud
- **Status:** draft
- **Autor sesji:** Claude Code (spec-driven pipeline)
- **Data:** 2026-07-15
- **Moduł(y):** Home / Asystent AI (magiczna ikona, `AICommandSheet`)

> **Zasada speca:** opisujemy **CO i DLACZEGO**, nigdy **JAK**.

## 1. Problem / potrzeba
Odpowiedzi Asystenta bywają długie (analizy, raporty, briefingi). Użytkownik nie zawsze może/chce
je czytać wzrokiem — chce ich **wysłuchać**, tak jak w aplikacji ChatGPT, gdzie przy poście asystenta
jest przycisk „Read aloud". Dziś w czacie z Asystentem (magiczna ikona) nie ma żadnego sposobu, by
usłyszeć odpowiedź na głos.

## 2. Cel i miary sukcesu
- Cel: przy każdym poście Asystenta w czacie dostępna jest ikona odczytu na głos, która wypowiada
  treść tego posta, a ponowne kliknięcie (lub kliknięcie na innym poście) zatrzymuje/przełącza mowę.
- Sukces mierzymy: w jednym kliknięciu przy dowolnym poście Asystenta użytkownik uruchamia lektora;
  drugie kliknięcie tego samego posta go zatrzymuje; ikona wizualnie pokazuje, który post jest właśnie
  odczytywany.

## 3. Historyjki użytkownika
- Jako użytkownik Omnii chcę kliknąć ikonę głośnika przy odpowiedzi Asystenta, żeby wysłuchać jej
  na głos zamiast czytać.
- Jako użytkownik chcę móc zatrzymać odczyt w każdej chwili (ponowne kliknięcie), żeby przerwać
  lektora, gdy już usłyszałem to, co chciałem.
- Jako użytkownik chcę, żeby uruchomienie odczytu innego posta przerwało poprzedni, żeby nie słyszeć
  dwóch głosów naraz.

## 4. Kryteria akceptacji (testowalne)
- [ ] **AC-1** — Given otwarty czat z Asystentem z co najmniej jednym postem Asystenta zawierającym
  treść, when patrzę na ten post, then widzę przy nim ikonę odczytu na głos (głośnik).
- [ ] **AC-2** — Given post Asystenta z ikoną odczytu, when klikam ikonę, then treść tego posta jest
  wypowiadana na głos (Web Speech API), a ikona zmienia stan na „odtwarzanie / zatrzymaj".
- [ ] **AC-3** — Given trwa odczyt danego posta, when klikam ikonę tego samego posta ponownie, then
  odczyt zostaje zatrzymany, a ikona wraca do stanu wyjściowego.
- [ ] **AC-4** — Given trwa odczyt posta A, when klikam ikonę odczytu posta B, then odczyt A zostaje
  przerwany i rozpoczyna się odczyt B (nigdy dwa głosy naraz).
- [ ] **AC-5** — Given post Asystenta typu bez czytelnej treści tekstowej (lub przeglądarka bez
  wsparcia syntezy mowy), then ikona odczytu nie jest pokazywana albo jest nieaktywna — brak błędu.
- [ ] **AC-6** — Given odczyt dobiega naturalnego końca (cała treść wypowiedziana), then ikona sama
  wraca do stanu wyjściowego bez akcji użytkownika.
- [ ] **AC-7** — Ikona odczytu dotyczy **wyłącznie** postów Asystenta — posty użytkownika jej nie mają.

## 5. Zakres
**W zakresie:**
- Ikona „odczytaj na głos" przy postach Asystenta w czacie z Asystentem (magiczna ikona).
- Start / stop / przełączanie odczytu między postami; auto-powrót ikony po zakończeniu wypowiedzi.
- Wizualne rozróżnienie stanu (bezczynny ↔ trwa odczyt) i podstawowa dostępność (aria-label po polsku).
- Odczyt czytelnej treści tekstowej posta (odpowiedzi, raporty, propozycje przejścia/planu, pytania
  doprecyzowujące itp.), z sensownym oczyszczeniem znaczników markdown, by lektor nie czytał symboli.

**Poza zakresem (świadomie):**
- Wybór głosu/lektora, regulacja tempa i wysokości głosu, ustawienia TTS per-użytkownik.
- Automatyczne odczytywanie każdej nowej odpowiedzi bez kliknięcia.
- Odczyt strumieniowy „w trakcie pisania" odpowiedzi (czytamy gotowy post po jego pojawieniu się).
- TTS w innych miejscach aplikacji (moduł Languages ma własny odczyt słówek — nie ruszamy).
- Odczyt postów użytkownika oraz treści spoza czatu Asystenta.
- Serwerowa/chmurowa synteza mowy — korzystamy z wbudowanej syntezy przeglądarki.

## 6. Wpływ na Omnia
- **Uprawnienie / RBAC:** bez zmian — funkcja żyje wewnątrz istniejącego Asystenta (`module.home`),
  brak nowego sluga (C-22 nie dotyczy).
- **Własność danych:** brak — funkcja czysto kliencka (przeglądarkowa synteza mowy), nic nie zapisuje
  do bazy, brak nowego modelu i migracji (C-10/C-21 nie dotyczą).
- **Asystent AI:** nie wymaga nowej `AIAction` ani read-toola — to warstwa prezentacji istniejących
  postów, nie nowa zdolność agenta (C-23 nie dotyczy).
- **Kalendarz / powiadomienia / trash:** nie dotyczy.

## 7. Zgodność z konstytucją
- **C-01/C-02** — praca wyłącznie w `worldofmag/`, importy przez alias `@/*` (m.in. istniejący
  `@/lib/tts`).
- **C-30** — stan/kolory ikony z tokenów CSS (`var(--text-muted)`, `var(--accent-*)`), bez hardcodu hexów.
- **C-31** — cel dotyku dla ikony zgodny z zasadami mobile (dostatecznie duży, dostępny na dotyk),
  spójny z istniejącymi akcjami przy postach (Kopiuj/Regeneruj).
- **C-32** — etykiety/aria po polsku.
- **C-53** — minimalizm: reużywamy istniejącego helpera `@/lib/tts` (Web Speech API), zero nowych
  zależności; ewentualne drobne rozszerzenie helpera tylko jeśli konieczne (np. sygnał zakończenia).
- **C-50/C-52** — „gotowe" = zielony `npm run build`, następnie auto-merge do `develop`.

## 8. Otwarte pytania / decyzje właściciela
- Brak — funkcja jest jednoznaczna. Przyjęte rozsądne domyślne (odnotowane jako decyzje):
  - Ikona odczytu pojawia się przy **wszystkich** postach Asystenta mających czytelną treść tekstową
    (nie tylko przy „answer"), w rzędzie akcji posta obok istniejących (Kopiuj/Regeneruj).
  - Zachowanie zgodne z ChatGPT: pojedyncza ikona-przełącznik na post (start ↔ stop), globalnie tylko
    jeden aktywny odczyt naraz.
  - Korzystamy z przeglądarkowej syntezy (Web Speech API przez `@/lib/tts`); brak wsparcia = brak
    ikony/nieaktywna, bez komunikatów błędu.

## 9. Ryzyka
- **Różne wsparcie Web Speech API w przeglądarkach** (zwłaszcza Safari/iOS) → degradacja: gdy synteza
  niedostępna, ikona się nie pokazuje / jest nieaktywna (AC-5).
- **Markdown w treści** (nagłówki, tabele, linki) czytany dosłownie brzmiałby źle → oczyszczamy tekst
  do formy mówionej przed przekazaniem do syntezatora.
- **Stan „co jest teraz czytane" po zamknięciu/przełączeniu czatu** → przy zamknięciu arkusza lub
  zmianie konwersacji trwający odczyt zatrzymujemy, by nie „mówił w tle".
