# Spec: Rozmowa głosowa z Asystentem działa na Safari/iPhone (nie tylko Chrome)

- **ID:** 007-voice-safari-ios
- **Status:** draft <!-- draft | planned | in-progress | verified | done -->
- **Autor sesji:** Claude Code (spec-driven pipeline)
- **Data:** 2026-07-16
- **Moduł(y):** Home / Asystent AI (magiczna ikona, `AICommandSheet`, warstwa mowy). Naprawia 005/006.

> **Zasada speca:** opisujemy **CO i DLACZEGO**, nigdy **JAK**.

## 1. Problem / potrzeba
Tryb rozmowy głosowej z Asystentem (005/006) **nie działa na iPhone** (Safari/WebKit — silnik każdej
przeglądarki na iOS). Przycisk się pokazuje, ale Asystent **milczy** (nie słychać odpowiedzi) i pętla
**zacina się** po pierwszej turze. To **błąd implementacji**, nie brak możliwości platformy: Safari
obsługuje mikrofon i mowę i pozwala na ciągłą rozmowę głosową. Konkretne, wąskie ograniczenia iOS
Safari, których dziś nie obsługujemy poprawnie:
1. **Synteza mowy (TTS)** musi być zainicjowana w **geście użytkownika** — wypowiedzi wywołane poza
   gestem WebKit **po cichu odrzuca**. Nasza pierwsza wypowiedź pada dopiero **po** asynchronicznej
   odpowiedzi agenta (bez gestu) → na iPhone cisza.
2. **Rozpoznawanie mowy w trybie `continuous`** jest na iOS zawodne; poprawnie działa model
   „jedna tura → cisza kończy" z **odtworzeniem** rozpoznawania na kolejną turę (z drobnym opóźnieniem).
Efekt: na iPhone rozmowa jest niesłyszalna i przerywa się. Trzeba to naprawić tak, by **ten sam ciągły
tryb hands-free działał również na Safari/iPhone**.

## 2. Cel i miary sukcesu
- **Cel:** ciągła rozmowa głosowa hands-free z Asystentem **realnie działa na Safari/iPhone** tak samo
  jak na Chrome/desktopie — słychać odpowiedzi Asystenta i można do niego mówić w pętli, bez
  ograniczania funkcji do jednej przeglądarki.
- **Sukces mierzymy (obserwowalnie na iPhone/Safari):**
  - Po włączeniu trybu głosowego użytkownik mówi, a odpowiedź Asystenta jest **słyszalna** (TTS gra).
  - Po odpowiedzi Asystent **sam wraca do nasłuchu** i można powiedzieć kolejną kwestię — rozmowa
    nie zacina się po pierwszej turze.
  - Karty akcji, potwierdzanie/korekta (006), zapis jako czat — działają jak na Chrome.
  - Żadna funkcja rozmowy głosowej nie jest sztucznie ograniczona „tylko do Chrome".

## 3. Historyjki użytkownika
- Jako użytkownik na iPhone chcę prowadzić rozmowę głosową z Asystentem tak samo jak na komputerze,
  żeby słyszeć jego odpowiedzi i mówić do niego bez pisania.
- Jako użytkownik chcę, żeby po włączeniu trybu Asystent **odezwał się na głos** (a nie milczał), żeby
  rozmowa miała sens.
- Jako użytkownik chcę, żeby po odpowiedzi Asystent **dalej słuchał**, żebym mógł kontynuować rozmowę
  bez restartowania trybu.

## 4. Kryteria akceptacji (testowalne)
Format Given/When/Then. Weryfikacja **na urządzeniu iPhone (Safari)** dla AC-1..AC-5 (mowa nie działa
w headless CI); AC-6..AC-8 sprawdzalne logiką/regresją.
- [ ] **AC-1** — Given iPhone/Safari z włączonym trybem rozmowy głosowej, when Asystent generuje
  odpowiedź, then jest ona **słyszalnie wypowiadana** (TTS gra), a nie milczy.
- [ ] **AC-2** — Given iPhone/Safari, when wypowiadam kwestię i robię pauzę, then jest ona rozpoznana
  i wysłana do Asystenta (tura użytkownika w wątku) **bez** dodatkowego działania.
- [ ] **AC-3** — Given iPhone/Safari po wypowiedzeniu odpowiedzi przez Asystenta, then Asystent
  **automatycznie wraca do nasłuchu** kolejnej kwestii (pętla nie zacina się po pierwszej turze).
- [ ] **AC-4** — Given iPhone/Safari, when Asystent proponuje akcje, then karta akcji pojawia się w
  wątku, a potwierdzenie/odrzucenie/korekta (głosem lub dotykiem) działa jak na Chrome (zgodnie z 006).
- [ ] **AC-5** — Given iPhone/Safari, then cała rozmowa zapisuje się jako **czat tekstowy** (posty)
  i jest widoczna po ponownym otwarciu — jak dotąd.
- [ ] **AC-6** — Given dowolna wspierana przeglądarka (Chrome/desktop), when używam trybu głosowego,
  then dotychczasowe działanie (ciągły hands-free) pozostaje **bez regresu**.
- [ ] **AC-7** — Given przeglądarka, w której rozpoznawanie i/lub synteza mowy naprawdę nie istnieją,
  then tryb głosowy degraduje się (przełącznik ukryty/nieaktywny) **bez błędu**, a czat pisany działa.
- [ ] **AC-8** — Funkcja rozmowy głosowej **nie jest bramkowana po nazwie/typie przeglądarki** (żadnego
  „tylko Chrome"); włącza się wszędzie, gdzie API mowy są dostępne (w tym Safari).

## 5. Zakres
**W zakresie:**
- **Naprawa TTS na iOS Safari:** „odblokowanie"/rozgrzanie syntezy mowy w **geście** włączenia trybu
  (pierwsza wypowiedź w obrębie dotknięcia), obsługa **asynchronicznego ładowania głosów**, tak by
  kolejne (programowe) wypowiedzi Asystenta były słyszalne na iPhone.
- **Robustny cykl rozpoznawania mowy na Safari/iOS:** model „jedna tura → cisza kończy" (bez
  zawodnego `continuous`), **odtwarzanie** rozpoznawania na kolejną turę z **drobnym opóźnieniem** i
  poprawną obsługą zdarzeń zakończenia/błędu, aby pętla nie zacinała się po pierwszej turze.
- **Ten sam ciągły tryb hands-free na wszystkich wspieranych przeglądarkach** (Chrome i Safari) —
  usunięcie ewentualnych założeń „tylko Chrome"; wykrywanie wsparcia po **istnieniu API**, nie po
  nazwie przeglądarki.
- Utrzymanie zdobyczy 006 (karty akcji w wątku, potwierdzanie/korekta, wskaźnik trybu, composer) i
  zapisu rozmowy jako czat; degradacja tylko gdy API mowy faktycznie nieobecne.

**Poza zakresem (świadomie):**
- Serwerowa/chmurowa synteza i rozpoznawanie mowy — pozostajemy przy **wbudowanej** mowie przeglądarki
  (bez nowych usług/kluczy).
- Zmiana zachowania agenta-kompana (006) — bez zmian.
- Wybór głosu/lektora, tempo, ustawienia mowy per-użytkownik.
- Gwarancja identycznej płynności na **każdej** wersji iOS — dążymy do działania na aktualnym Safari;
  ewentualne różnice starszych wersji odnotowujemy (ryzyka), nie obiecujemy ich wszystkich.

## 6. Wpływ na Omnia
- **Uprawnienie / RBAC:** bez zmian — funkcja w istniejącym Asystencie (`module.home`), brak sluga.
- **Własność danych:** brak nowego modelu/migracji — warstwa mowy jest **kliencka**; rozmowa dalej w
  `AiConversation`/`AiMessage`.
- **Asystent AI:** **nie** wymaga nowej `AIAction`/read-toola (C-23 spełnione bez zmian) — to warstwa
  wejścia/wyjścia (mowa) nad istniejącym agentem/wykonaniem akcji.
- **Kalendarz / powiadomienia / trash:** nie dotyczy.

## 7. Zgodność z konstytucją
- **C-01/C-02** — praca w `worldofmag/`, importy `@/*` (istniejące `@/lib/tts`, helper STT z 005).
- **C-30** — ewentualne elementy UI (np. prośba o dotknięcie/„rozgrzanie") na zmiennych CSS, bez hexów.
- **C-31** — mobile-first: naprawa dotyczy głównie iPhone; przełącznik/wskaźnik działają na wąskim
  ekranie i respektują dotyk.
- **C-32** — teksty/aria po polsku; rozpoznawanie mowy `pl-PL`.
- **C-53** — minimalizm: naprawiamy istniejącą warstwę mowy (`@/lib/tts`, `@/lib/speechRecognition`,
  pętla w `AICommandSheet`); bez nowych zależności; **bez** UA-sniffingu jako bramki funkcji (wykrywanie
  po API). Ewentualne drobne odgałęzienia zachowania dla iOS tylko tam, gdzie wymusza to platforma.
- **C-50/C-52** — „gotowe" = zielony `npm run build`; auto-merge do `develop`; pytanie domykające o `master`.
- **C-54** — 007 koryguje **błędne założenie** z 005/006 (że hands-free jest wykonalny „tylko na
  Chrome"); artefakty 005/006 zostają jako historia, 007 jest źródłem prawdy dla wsparcia Safari.

## 8. Otwarte pytania / decyzje właściciela
Decyzja właściciela (podjęta wprost w rozmowie, po weryfikacji z jego strony): **implementacja ma być
zgodna również z Safari — ciągła rozmowa głosowa (hands-free) musi działać na iPhone/Safari, a nie być
ograniczona do Chrome.** Push-to-talk **nie** jest wymaganym modelem; celem jest ten sam hands-free na
Safari. (To zdejmuje wcześniej rozważaną furtkę „push-to-talk na iOS".)

Przyjęte założenia (odnotowane):
- Wsparcie wykrywamy po **istnieniu API mowy** (rozpoznawanie + synteza), nie po nazwie przeglądarki.
- Mechanika mowy = **wbudowana w przeglądarkę** (jak 004/005/006), język polski.
- Degradacja tylko gdy API faktycznie nieobecne.

## 9. Ryzyka
- **Gest per-wypowiedź na części wersji iOS:** WebKit odrzuca `speak()` poza gestem; standardowy
  „priming" w geście włączenia odblokowuje syntezę na sesję na **większości** aktualnych iOS, ale
  **niektóre wersje** bywają surowsze (chcą gestu przy każdej wypowiedzi). Mitygacja: priming +
  rozgrzewka głosów; jeśli na urządzeniu właściciela synteza po pierwszej turze zamilknie, jest to
  znany, wąski limit platformy do odnotowania — nie „Chrome-only". Weryfikacja na realnym iPhone.
- **Zawodność `continuous` na iOS:** używamy modelu jedno-turowego + odtwarzanie z opóźnieniem;
  ryzyko „already started"/urwań — mitygujemy pojedynczym egzemplarzem rozpoznawania i buforem czasu.
- **Brak testu w CI:** mowa nie działa w headless — weryfikacja końcowa ręczna na iPhone (Safari) i
  regres na Chrome. Bramką automatyczną jest `next build` + brak regresu ścieżki pisanej.
- **Różne wersje iOS/Safari:** dążymy do aktualnego Safari; starsze wersje mogą różnić się płynnością
  (odnotowane, poza twardą gwarancją).
