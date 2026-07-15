# Spec: Tryb rozmowy głosowej z Asystentem

- **ID:** 005-assistant-voice-conversation
- **Status:** draft <!-- draft | planned | in-progress | verified | done -->
- **Autor sesji:** Claude Code (spec-driven pipeline)
- **Data:** 2026-07-15
- **Moduł(y):** Home / Asystent AI (magiczna ikona, `AICommandSheet`)

> **Zasada speca:** opisujemy **CO i DLACZEGO**, nigdy **JAK**. Zero nazw plików, tabel, bibliotek,
> endpointów.

## 1. Problem / potrzeba
Duże asystenty (ChatGPT, Gemini) mają **tryb rozmowy głosowej** — zamiast pisać, rozmawiasz na
głos: mówisz, asystent słucha, odpowiada głosem i znów słucha, w naturalnej pętli hands-free.
W Omnii Asystent (magiczna ikona) potrafi już **dyktować** pojedynczą kwestię do pola tekstowego
(zamiana mowy na tekst, potem ręczne wysłanie) i **odczytać** gotowy post na głos (spec 004), ale
brakuje **ciągłej rozmowy** — takiej, w której nie trzeba dotykać klawiatury ani ekranu między
kolejnymi wypowiedziami. Właściciel chce czasem po prostu **porozmawiać** z Asystentem zamiast
czatować, tak jak w wymienionych aplikacjach.

## 2. Cel i miary sukcesu
- Cel: w oknie Asystenta jest **tryb rozmowy głosowej** — po jego włączeniu użytkownik prowadzi z
  Asystentem ciągłą rozmowę głosem (mówi → Asystent odpowiada na głos → znów słucha), bez klikania
  między turami; cała rozmowa zapisuje się jako **zwykły czat tekstowy**, a Asystent może w jej
  trakcie **wykonywać akcje** (dodawanie/edycja/usuwanie danych) tak jak w czacie pisanym.
- Sukces mierzymy:
  - Jednym kliknięciem („Rozmowa głosowa") użytkownik wchodzi w tryb i może wypowiedzieć polecenie
    bez dotykania klawiatury; odpowiedź Asystenta zostaje **wypowiedziana na głos automatycznie**,
    po czym Asystent **sam znów słucha** kolejnej kwestii.
  - Każda wypowiedziana tura (użytkownika i Asystenta) pojawia się w wątku jako post tekstowy i
    **przetrwa** zamknięcie/ponowne otwarcie okna (ta sama historia co czat pisany).
  - Gdy Asystent chce wykonać akcję, pętla głosowa **pauzuje** i pokazuje ekran podglądu planu do
    zatwierdzenia; po decyzji użytkownika rozmowa wraca do trybu głosowego.

## 3. Historyjki użytkownika
- Jako użytkownik Omnii chcę włączyć tryb rozmowy głosowej w oknie Asystenta, żeby rozmawiać z nim
  na głos zamiast pisać — analogicznie do ChatGPT/Gemini.
- Jako użytkownik chcę, żeby po mojej wypowiedzi Asystent odpowiedział na głos i **sam** zaczął
  słuchać dalej, żebym mógł prowadzić rozmowę bez dotykania ekranu (hands-free).
- Jako użytkownik chcę móc **przerwać** mówiącego Asystenta swoją wypowiedzią lub jednym gestem
  (barge-in), żeby rozmowa była płynna i naturalna.
- Jako użytkownik chcę, żeby cała rozmowa głosowa zapisała się jako **czat tekstowy** w historii,
  żebym mógł do niej wrócić wzrokiem i kontynuować pisemnie.
- Jako użytkownik chcę móc **wydawać polecenia** w rozmowie (np. „dodaj mleko do listy zakupów"),
  żeby Asystent realnie **wykonał akcję** — z zachowaniem bezpiecznego potwierdzenia jak w czacie.
- Jako użytkownik chcę w każdej chwili **wyłączyć** tryb rozmowy i wrócić do pisania, żeby móc
  swobodnie przełączać się między głosem a klawiaturą.

## 4. Kryteria akceptacji (testowalne)
Format Given/When/Then — każde da się zweryfikować w `/verify`.
- [ ] **AC-1** — Given otwarte okno Asystenta, when patrzę na jego sterowanie, then widzę wyraźny
  przełącznik/przycisk **„Rozmowa głosowa"** włączający tryb rozmowy głosowej (z etykietą po polsku).
- [ ] **AC-2** — Given włączony tryb rozmowy głosowej, when Asystent nasłuchuje, then interfejs
  wyraźnie pokazuje **aktualny stan** rozmowy (słucham / myślę / mówię), tak by było wiadomo, kiedy
  mówić.
- [ ] **AC-3** — Given tryb rozmowy głosowej i stan „słucham", when wypowiadam kwestię i kończę
  mówić, then moja wypowiedź trafia do wątku jako **post użytkownika** i zostaje wysłana do Asystenta
  **bez** dodatkowego kliknięcia.
- [ ] **AC-4** — Given Asystent wygenerował odpowiedź w trybie rozmowy głosowej, then jej treść
  zostaje **wypowiedziana na głos automatycznie** (bez klikania ikony odczytu) i pojawia się w
  wątku jako post Asystenta.
- [ ] **AC-5** — Given Asystent skończył wypowiadać odpowiedź i tryb rozmowy jest nadal włączony,
  then Asystent **automatycznie wraca do nasłuchu** kolejnej kwestii (pętla ciągła hands-free).
- [ ] **AC-6** — Given Asystent właśnie mówi (odczytuje odpowiedź), when zaczynam mówić lub użyję
  gestu przerwania, then bieżąca wypowiedź Asystenta zostaje **przerwana** i rozmowa przechodzi do
  słuchania mojej kwestii (barge-in; nigdy dwa głosy naraz).
- [ ] **AC-7** — Given rozmowa głosowa, when wypowiadam polecenie, które wymaga wykonania akcji
  (dodaj/edytuj/usuń dane), then **pętla głosowa pauzuje** i pojawia się **wizualny podgląd planu**
  (ten sam mechanizm co w czacie pisanym), w którym akcje **niszczące są domyślnie odznaczone**.
- [ ] **AC-8** — Given otwarty podgląd planu wywołany w rozmowie głosowej, when zatwierdzam lub
  odrzucam plan, then akcje wykonują się (lub nie) jak w czacie pisanym, a po zamknięciu podglądu
  rozmowa głosowa **wraca do trybu** (nasłuch), o ile jej nie wyłączyłem.
- [ ] **AC-9** — Given prowadzona rozmowa głosowa, when zamknę okno Asystenta i otworzę je ponownie
  (lub wejdę w tę konwersację z historii), then **wszystkie tury** (użytkownika i Asystenta)
  widoczne są jako posty tekstowe — rozmowa głosowa jest nieodróżnialna w historii od czatu pisanego.
- [ ] **AC-10** — Given włączony tryb rozmowy głosowej, when go wyłączę (przełącznik) **lub** zamknę
  okno Asystenta, then nasłuch i mowa **natychmiast się zatrzymują** (mikrofon zwolniony, brak
  „mówienia w tle"), a okno wraca do zwykłego trybu pisania.
- [ ] **AC-11** — Given przeglądarka **bez** wsparcia rozpoznawania mowy i/lub syntezy mowy, then
  przełącznik trybu rozmowy jest **ukryty lub nieaktywny** z czytelną informacją — brak błędu,
  reszta czatu (pisanie, dyktowanie, odczyt pojedynczych postów) działa bez zmian.
- [ ] **AC-12** — Given tryb rozmowy głosowej, when Asystent zwróci pytanie doprecyzowujące
  (`clarify`), then pytanie zostaje **wypowiedziane na głos**, a Asystent czeka na moją głosową
  odpowiedź jak na kolejną turę (rozmowa się nie zawiesza).

## 5. Zakres
**W zakresie:**
- Przełącznik **„Rozmowa głosowa"** w istniejącym oknie Asystenta (magiczna ikona) — wariant
  **inline** (okno czatu przechodzi w tryb hands-free, wątek nadal widoczny).
- **Ciągła pętla hands-free**: nasłuch → rozpoznanie mowy → wysłanie do istniejącego agenta →
  automatyczne wypowiedzenie odpowiedzi → ponowny nasłuch, aż do wyłączenia trybu.
- **Barge-in**: możliwość przerwania mówiącego Asystenta własną wypowiedzią lub gestem.
- **Wskaźnik stanu** rozmowy (słucham / myślę / mówię) i jednoznaczne wyłączenie trybu.
- **Zapis rozmowy jako czat tekstowy** — reużycie istniejącej historii konwersacji Asystenta
  (posty użytkownika i Asystenta), bez odrębnego magazynu.
- **Wykonywanie akcji w rozmowie** — te same zdolności agenta co w czacie pisanym, z **wizualnym
  podglądem planu** (pauza pętli, akcje niszczące odznaczone domyślnie) i powrotem do rozmowy.
- Wypowiadanie na głos także postów typu pytanie doprecyzowujące / propozycja przejścia / plan /
  raport (czytelna treść tekstowa), z sensownym oczyszczeniem markdownu (reużycie istniejącego
  odczytu na głos).
- Degradacja przy braku wsparcia mowy w przeglądarce (tryb ukryty/nieaktywny, bez błędów).
- Podstawowa dostępność i etykiety po polsku; poprawne zwalnianie mikrofonu przy wyjściu/zamknięciu.

**Poza zakresem (świadomie):**
- **Serwerowa/chmurowa** synteza i rozpoznawanie mowy — korzystamy z wbudowanych mechanizmów
  przeglądarki (jak istniejące dyktowanie i odczyt); żadnych nowych usług/kluczy.
- Wybór głosu/lektora, regulacja tempa i barwy, ustawienia głosu per-użytkownik (jak w spec 004 —
  poza zakresem).
- Rozpoznawanie **kto mówi** (diaryzacja), wykrywanie „słowa budzącego" (wake word) w tle poza
  włączonym trybem, praca w tle przy zamkniętym oknie.
- Tłumaczenie/rozmowa wielojęzyczna w locie — domyślnie język polski (spójnie z istniejącym
  dyktowaniem `pl-PL`); rozpoznawanie innych języków nie jest celem tego zadania.
- Zmiany w module Languages (ma własny odczyt słówek — nie ruszamy) ani odczyt/rozmowa poza czatem
  Asystenta.
- Nowe zdolności agenta (nowe `AIAction`/read-toole) — tryb głosowy korzysta **wyłącznie** z
  istniejącego zestawu akcji i odczytów agenta.

## 6. Wpływ na Omnia
- **Uprawnienie / RBAC:** bez zmian — funkcja żyje wewnątrz istniejącego Asystenta (`module.home`),
  brak nowego sluga `module.*` (C-22 nie dotyczy). Strona i tak wymaga sesji.
- **Własność danych:** brak nowego modelu własności — rozmowa głosowa **zapisuje się do istniejącej
  historii konwersacji Asystenta** (per-użytkownik), tym samym mechanizmem co czat pisany. Jeśli
  utrwalenie trybu (np. „ostatnio używany tryb") okaże się potrzebne, mieści się w istniejących
  preferencjach użytkownika — bez nowej encji współwłasności (C-21). **Decyzja na `/plan`:** czy w
  ogóle utrwalać cokolwiek — domyślnie **nie** (stan trybu jest ulotny, kliencki), a jedynym trwałym
  zapisem są posty czatu (już istniejący model).
- **Asystent AI:** **nie wymaga nowej `AIAction` ani read-toola** — tryb głosowy to warstwa
  wejścia/wyjścia (mowa↔tekst) nad **istniejącym** agentem (`/api/llm/home/agent`) i **istniejącym**
  wykonaniem akcji (`/api/llm/home/execute` + podgląd planu). C-23 (każda `AIAction` ma egzekutor)
  pozostaje spełnione, bo nie dodajemy akcji.
- **Kalendarz / powiadomienia / trash:** nie dotyczy bezpośrednio; akcje wywołane głosem korzystają
  z tych samych ścieżek co czat pisany (w tym istniejącego soft-delete przy usuwaniu).

## 7. Zgodność z konstytucją
Kluczowe reguły dla tego feature'a:
- **C-01 / C-02** — praca wyłącznie w `worldofmag/`, importy przez alias `@/*` (m.in. istniejące
  `@/lib/tts`, komponenty Asystenta).
- **C-20** — jeśli pojawi się jakakolwiek mutacja danych (np. utrwalenie preferencji trybu), idzie
  przez Server Action z `revalidatePath()`; domyślnie jednak stan trybu jest kliencki i nic nie
  utrwalamy (minimalizm).
- **C-23** — **nie** dodajemy `AIAction`; reużywamy istniejący zestaw, więc bramka `check:actions`
  pozostaje zielona.
- **C-30** — stany/kolory wskaźnika i przełącznika z tokenów CSS (`var(--accent-*)`,
  `var(--text-muted)`, `var(--on-accent)`), bez hardcodu hexów; działa w skórkach.
- **C-31** — mobile-first i keyboard-first: przełącznik i wskaźnik czytelne na mobile (cel dotyku
  `py-3`), sensowny skrót klawiszowy/gest do wyjścia (Esc), zgodnie z istniejącym oknem Asystenta.
- **C-32** — wszystkie etykiety/aria/komunikaty po polsku; rozpoznawanie mowy w języku polskim
  (spójnie z istniejącym dyktowaniem).
- **C-53** — minimalizm: **reużywamy** istniejące elementy (odczyt `@/lib/tts`, dyktowanie/
  rozpoznawanie mowy z pola tekstowego, agent, wykonanie akcji, historia konwersacji), **zero nowych
  zależności** i żadnych „przy okazji" refaktorów; dokładamy tylko warstwę spinającą je w pętlę.
- **C-50 / C-52** — „gotowe" = zielony `npm run build`; następnie auto-merge do `develop`, a na końcu
  jedno pytanie domykające o promocję `develop → master`.

## 8. Otwarte pytania / decyzje właściciela
Zebrane **na `/specify`** (jedyny moment pytań, C-55). Odpowiedzi właściciela:
- **Wariant UI trybu rozmowy** → **Przełącznik w oknie czatu** (inline; reużycie istniejącego okna
  Asystenta, wątek widoczny). *(Nie tworzymy osobnego pełnoekranowego widoku.)*
- **Model pętli rozmowy** → **Ciągły hands-free** (po odpowiedzi Asystent sam znów słucha; barge-in
  na przerwanie). *(Nie „naciśnij, by mówić".)*
- **Potwierdzanie akcji w trybie głosowym** → **Wizualny podgląd planu** (pętla pauzuje, pokazuje
  istniejący ActionDrawer, akcje niszczące odznaczone domyślnie). *(Nie potwierdzenie głosem
  „tak/nie".)*

Przyjęte rozsądne domyślne (odnotowane jako decyzje, nie wymagały pytania):
- Język rozmowy = **polski** (`pl-PL`), spójnie z istniejącym dyktowaniem; wielojęzyczność poza
  zakresem.
- Mechanika mowy = **wbudowana w przeglądarkę** (rozpoznawanie + synteza), jak dotychczas; brak
  usług serwerowych i kluczy.
- Stan trybu = **ulotny/kliencki**; jedynym trwałym śladem rozmowy są posty w istniejącej historii
  czatu (żadnego nowego modelu/migracji — do potwierdzenia w `/plan`, domyślnie tak).

## 9. Ryzyka
- **Nierówne wsparcie mowy w przeglądarkach** (rozpoznawanie mowy jest niestabilne w Safari/iOS,
  a Szymon używa macOS 12 i iPhone) → degradacja: gdy rozpoznawanie i/lub synteza niedostępne,
  przełącznik ukryty/nieaktywny z informacją (AC-11); w przeglądarce wspieranej (np. Chrome) tryb
  działa w pełni.
- **Zapętlenie „Asystent słyszy sam siebie"** (echo z głośnika wracające do mikrofonu) → mikrofon
  **nie** nasłuchuje w czasie, gdy Asystent mówi; nasłuch startuje dopiero po zakończeniu wypowiedzi
  (lub po barge-in inicjowanym przez użytkownika).
- **Fałszywe/urwane rozpoznania** (cisza, szum, przypadkowe dźwięki) → jasny wskaźnik stanu, brak
  wysyłki pustych/śmieciowych wypowiedzi, łatwe wyłączenie trybu (AC-10); akcje i tak przechodzą
  przez wizualny podgląd planu (AC-7), więc błędne rozpoznanie **nie** wykona akcji bez potwierdzenia.
- **Nietrywialny cykl życia mikrofonu/mowy** (przełączanie okna, konwersacji, zamknięcie) → twarde
  zatrzymanie nasłuchu i syntezy przy wyjściu/zamknięciu/zmianie konwersacji, aby nic nie działało
  w tle (AC-10) — to samo ryzyko było już adresowane przy dyktowaniu i odczycie.
- **Wypowiadanie długich raportów/tabel** brzmiałoby źle dosłownie → reużycie istniejącego
  oczyszczania markdownu do formy mówionej (z spec 004).
