# Spec: Asystent-kompan — rozmowa zamiast samych akcji, dopracowany tryb głosowy, czysty composer

- **ID:** 006-assistant-companion-voice-polish
- **Status:** draft <!-- draft | planned | in-progress | verified | done -->
- **Autor sesji:** Claude Code (spec-driven pipeline)
- **Data:** 2026-07-16
- **Moduł(y):** Home / Asystent AI (magiczna ikona, `AICommandSheet` + agent home). Rozwija/naprawia
  spec 004 (odczyt na głos) i 005 (tryb rozmowy głosowej).

> **Zasada speca:** opisujemy **CO i DLACZEGO**, nigdy **JAK**. Zero nazw plików, tabel, bibliotek.

## 1. Problem / potrzeba
Po ręcznych testach właściciela ujawniły się trzy słabości Asystenta (magiczna ikona):
1. **Zbyt „akcyjny", za mało konwersacyjny.** Już w zwykłym czacie pisanym Asystent niemal każde
   wejście zamienia na plan akcji, zamiast po prostu **rozmawiać** mając dostęp do danych. Ma być
   **kompanem** — odpowiadać na pytania i konwersować jak typowy asystent (ChatGPT/Gemini), a akcje
   proponować **tylko** gdy użytkownik wyraźnie chce coś zmienić, i **dopytywać**, gdy brakuje
   istotnego szczegółu (np. do której listy dodać zadanie).
2. **Tryb rozmowy głosowej (005) niedopracowany.** Brakuje płynnego, „chatgptowego" odczucia:
   rozmowa ma toczyć się dalej po pauzie, a **wykryte akcje mają być widoczne w czacie i możliwe do
   korekty głosem** — bez zasłaniania widoku wielkim „orbem". Trzeba to rozwiązać UX-owo: jasny, ale
   **nie-zasłaniający** wskaźnik trybu głosowego, przy zachowaniu widoczności kart akcji do
   potwierdzenia.
3. **Composer na smartfonie przeładowany.** Dolny pasek czatu ma tyle kontrolek (zdjęcie, mikrofon/
   rozmowa, wysyłka, ustawienia…), że **pole tekstowe jest bardzo wąskie**, a elementy mają brzydkie
   wyrównanie. Potrzebny mistrzowski, mobile-first redesign.

## 2. Cel i miary sukcesu
- **Cel:** Asystent, który **naturalnie rozmawia** (odpowiada/konwersuje domyślnie), a akcje wykonuje
  **świadomie** — tylko przy wyraźnym poleceniu i z dopytaniem przy niejasności; dopracowany
  hands-free tryb głosowy z **widocznym i korygowalnym** potwierdzaniem akcji „w locie"; oraz **czysty,
  nie-przeładowany** composer, wygodny na telefonie.
- **Sukces mierzymy (obserwowalnie):**
  - Zwykłe pytanie/rozmowa (np. „co u mnie dziś?", „jestem zmęczony, co odpuścić?") kończy się
    **odpowiedzią/rozmową**, a nie kartą akcji.
  - Wyraźne polecenie zmiany (np. „dodaj mleko do zakupów") dalej kończy się propozycją akcji; a gdy
    brakuje szczegółu (np. jest kilka list zadań), Asystent **najpierw dopytuje**, zamiast zgadywać.
  - W trybie głosowym po krótkiej pauzie Asystent sam odpowiada/pyta; wykryte akcje pojawiają się jako
    **karty w wątku**, rozmowa **toczy się dalej**, a użytkownik może je **potwierdzić lub poprawić
    głosem**; wskaźnik trybu głosowego jest widoczny, ale **nie zasłania** kart akcji.
  - Na telefonie **pole tekstowe jest wyraźnie szersze** niż dziś, a kontrolki są równo, czytelnie
    rozmieszczone (drugorzędne akcje zgrupowane).

## 3. Historyjki użytkownika
- Jako użytkownik chcę **porozmawiać** z Asystentem (zadać pytanie, poradzić się, pogadać o moich
  danych), żeby dostać odpowiedź/rozmowę, a nie od razu listę akcji do potwierdzenia.
- Jako użytkownik chcę, żeby Asystent **sam z siebie dopytał**, gdy moje polecenie jest niejasne
  (np. do której z kilku list zadań dodać), żeby nie zgadywał i nie robił tego źle.
- Jako użytkownik chcę w trybie rozmowy głosowej mówić z **naturalnymi pauzami** i słyszeć odpowiedź,
  gdy skończę — jak w ChatGPT — żeby rozmowa była płynna.
- Jako użytkownik chcę **widzieć w czacie** akcje wykryte podczas rozmowy głosowej i móc je
  **poprawić głosem** („nie, do listy Apteka", „usuń drugą pozycję"), żeby nie tracić kontroli nad tym,
  co się wykona.
- Jako użytkownik chcę wiedzieć, że **jestem w trybie rozmowy głosowej** (czytelny wskaźnik/animacja),
  ale żeby nie zasłaniał mi kart akcji do zatwierdzenia.
- Jako użytkownik na telefonie chcę **wygodnie pisać** do Asystenta — z odpowiednio szerokim polem
  tekstowym i uporządkowanymi, nie-tłoczącymi się kontrolkami.

## 4. Kryteria akceptacji (testowalne)
Format Given/When/Then — każde da się zweryfikować w `/verify`.

**A. Asystent-kompan (dotyczy czatu pisanego i głosowego — wspólny agent):**
- [ ] **AC-1** — Given czat z Asystentem, when zadaję **pytanie** lub prowadzę zwykłą rozmowę (bez
  intencji zmiany danych), then Asystent odpowiada **tekstem/rozmową** (nie proponuje planu akcji).
- [ ] **AC-2** — Given czat, when wydaję **wyraźne polecenie zmiany** danych (np. „dodaj…", „oznacz…",
  „usuń…"), then Asystent proponuje **akcje do potwierdzenia** (jak dotąd; potwierdzenie nadal wymagane).
- [ ] **AC-3** — Given polecenie zmiany, któremu **brakuje istotnego szczegółu** rozstrzygającego cel
  (np. istnieje kilka list zadań, a użytkownik nie wskazał której), when Asystent to wykryje, then
  **najpierw dopytuje** (pytanie doprecyzowujące), zamiast zgadywać i od razu proponować akcję.
- [ ] **AC-4** — Given rozmowa towarzyska/emocjonalna (np. „jestem zmęczony"), when piszę do Asystenta,
  then odpowiada **po ludzku/konwersacyjnie** (może zaproponować pomoc), a **nie** kartą akcji.
- [ ] **AC-5** — Zmiana zachowania **nie łamie** istniejących, jednoznacznych poleceń: „dodaj mleko do
  listy Zakupy" (gdy cel jest jednoznaczny) dalej od razu kończy się propozycją akcji, bez zbędnego
  dopytywania.

**B. Dopracowany tryb rozmowy głosowej:**
- [ ] **AC-6** — Given włączony tryb rozmowy głosowej, when mówię i robię **krótką pauzę** (przestaję
  mówić), then Asystent traktuje to jako koniec mojej kwestii i **odpowiada/pyta** (turn-taking po ciszy).
- [ ] **AC-7** — Given rozmowa głosowa, when Asystent wykryje akcje, then pojawiają się one jako
  **karty do potwierdzenia w wątku czatu**, a **rozmowa głosowa toczy się dalej** (nie ma twardej
  pauzy blokującej) — zgodnie z decyzją właściciela.
- [ ] **AC-8** — Given w wątku są niepotwierdzone karty akcji (z rozmowy głosowej), when mówię
  **korektę** (np. „nie, do listy Apteka" / „usuń drugą pozycję" / „zmień ilość na 2"), then Asystent
  **aktualizuje wykryte akcje** zgodnie z korektą (karty się zmieniają), zanim cokolwiek się wykona.
- [ ] **AC-9** — Given niepotwierdzone karty akcji, when je **potwierdzę** (głosem lub dotykiem), then
  akcje wykonują się przez istniejący mechanizm (akcje niszczące nadal wymagają świadomego
  potwierdzenia — nic nie wykonuje się „samo").
- [ ] **AC-10** — Given tryb rozmowy głosowej jest włączony, when patrzę na ekran, then widzę
  **czytelny wskaźnik/animację** trybu głosowego (np. subtelnie pulsujący element sygnalizujący
  słucham/mówię), który **nie zasłania** kart akcji ani treści wątku.
- [ ] **AC-11** — Given odpowiedź Asystenta w trybie głosowym, then jest **wypowiadana na głos**, a
  wątek dalej zapisuje się jako **czat tekstowy** (posty użytkownika i Asystenta), tak że po zamknięciu/
  ponownym otwarciu okna cała rozmowa jest widoczna tekstowo (zachowanie z 005 utrzymane).
- [ ] **AC-12** — Given brak wsparcia mowy w przeglądarce, then tryb głosowy jest **ukryty/nieaktywny**
  bez błędu, a czat pisany działa normalnie (zachowanie z 005 utrzymane).

**C. Czysty composer (mobile-first):**
- [ ] **AC-13** — Given czat z Asystentem na **wąskim ekranie (telefon)** w trybie pisania, then
  **pole tekstowe jest wyraźnie szersze/wygodniejsze** niż w obecnej wersji, a kontrolki są **równo i
  czytelnie** rozmieszczone (brak ściśnięcia, brak „brzydkiego" wyrównania).
- [ ] **AC-14** — Given przeprojektowany composer, then wszystkie dotychczasowe funkcje pozostają
  **dostępne** (pisanie/wysyłka, dodanie zdjęcia, tryb rozmowy głosowej, dyktowanie, ustawienia/
  preferencje) — mogą być zgrupowane/schowane, ale nic nie znika.
- [ ] **AC-15** — Given composer na **desktopie**, then układ pozostaje spójny i estetyczny (redesign
  nie psuje widoku desktopowego), z zachowaniem motywu (zmienne CSS, teksty PL).

## 5. Zakres
**W zakresie:**
- Zmiana **domyślnego zachowania wspólnego agenta** Home: konwersacja/odpowiedź jako domyślny tryb;
  akcje tylko przy wyraźnej intencji zmiany; pytanie doprecyzowujące, gdy brakuje istotnego
  szczegółu rozstrzygającego cel (np. wybór listy/projektu/zwierzęcia). Dotyczy czatu pisanego i
  głosowego (to ten sam agent).
- **Dopracowanie trybu rozmowy głosowej (005):** turn-taking po pauzie; **ciągły przepływ** rozmowy
  przy wykrytych akcjach (karty w wątku, bez twardej pauzy); **korekta akcji głosem**; **nie-zasłaniający**
  wskaźnik/animacja trybu głosowego współistniejący z kartami akcji; utrzymanie zapisu jako czat
  tekstowy i degradacji bez wsparcia.
- **Widoczne, korygowalne potwierdzanie akcji w trybie głosowym** — karty akcji w wątku (potwierdź/
  odrzuć/popraw), tak by nie były zasłonięte przez wskaźnik trybu.
- **Redesign composera** (mobile-first, spójny na desktopie): szersze pole tekstowe, uporządkowane
  kontrolki (drugorzędne akcje mogą być zgrupowane/schowane), estetyka aplikacji (zmienne CSS), PL.

**Poza zakresem (świadomie):**
- Zmiana modelu/dostawcy LLM ani routingu operacji (`/admin/llm`) — tuning dotyczy **instrukcji/
  zachowania** agenta, nie doboru modelu.
- Nowe zdolności agenta (nowe rodzaje akcji/`AIAction`, nowe read-toole) — korygujemy zachowanie i UX,
  nie rozszerzamy katalogu akcji.
- Serwerowa/chmurowa synteza i rozpoznawanie mowy — pozostajemy przy wbudowanej mowie przeglądarki
  (jak 004/005); żadnych nowych usług/kluczy.
- Automatyczny „barge-in" głosem w trakcie, gdy Asystent mówi (przerywanie mową) — pozostaje przerwanie
  **gestem** (jak 005). Korekta akcji dotyczy tur po wypowiedzeniu odpowiedzi.
- Wielojęzyczność rozmowy — domyślnie polski (jak 005).
- Zmiany w innych modułach/odczytach (np. Languages) — bez zmian.

## 6. Wpływ na Omnia
- **Uprawnienie / RBAC:** bez zmian — funkcja żyje w istniejącym Asystencie (`module.home`), brak
  nowego sluga (C-22 nie dotyczy). Strony i tak wymagają sesji.
- **Własność danych:** brak nowego modelu/migracji — rozmowa zapisuje się do **istniejącej** historii
  Asystenta (`AiConversation`/`AiMessage`, per-użytkownik); stan trybu głosowego pozostaje **ulotny/
  kliencki** (jak 005). Zmiana zachowania agenta to **instrukcje**, nie dane. (C-10/C-21 nie dotyczą —
  do potwierdzenia w `/plan`; domyślnie brak migracji.)
- **Asystent AI:** **nie** dodajemy nowej `AIAction` ani read-toola (C-23 pozostaje spełnione — katalog
  akcji bez zmian, `check:actions` zielone). Zmieniamy **instrukcje/reguły decyzji** agenta (kiedy
  answer/clarify vs plan) i **warstwę UX** potwierdzania/korekty akcji oraz composer.
- **Kalendarz / powiadomienia / trash:** nie dotyczy bezpośrednio; akcje wywołane w rozmowie korzystają
  z tych samych ścieżek co dotąd (w tym istniejącego soft-delete przy usuwaniu).

## 7. Zgodność z konstytucją
Kluczowe reguły:
- **C-01/C-02** — praca wyłącznie w `worldofmag/`, importy przez alias `@/*`.
- **C-20** — jeśli pojawi się jakakolwiek mutacja danych, przez Server Action + `revalidatePath`; tu
  domyślnie brak nowej mutacji (zmiana instrukcji agenta + UI kliencki).
- **C-23** — brak nowej `AIAction`; katalog i egzekutory bez zmian → `check:actions` zielone.
- **C-30** — wskaźnik trybu głosowego, karty akcji i composer wyłącznie na zmiennych CSS
  (`var(--accent-*)`, `var(--text-*)`, `var(--on-accent)`), bez hardcodu hexów; działa w skórkach.
- **C-31** — **mobile-first**: redesign composera przede wszystkim pod telefon (szersze pole, cele
  dotyku, `env(safe-area-inset-bottom)`), brak drugiego sidebaru; wskaźnik trybu i karty akcji czytelne
  na wąskim ekranie.
- **C-32** — wszystkie teksty/etykiety/aria po polsku; rozpoznawanie mowy `pl-PL`. Prompty agenta
  traktują nazwy kategorii jako polskie słowa.
- **C-53** — minimalizm i reużycie: korygujemy istniejący agent (instrukcje) i istniejący
  `AICommandSheet`/`ActionDrawer`/tryb głosowy z 005; bez nowych zależności i nadmiarowych abstrakcji.
- **C-50/C-52** — „gotowe" = zielony `npm run build`; auto-merge do `develop`; na końcu pytanie o `master`.
- **C-54** — spec 006 świadomie **modyfikuje decyzję z 005** (pauza pętli przy planie → ciągły przepływ
  z korygowalnymi kartami); artefakty 005 pozostają jako historia, 006 jest źródłem prawdy dla tej zmiany.

## 8. Otwarte pytania / decyzje właściciela
Zebrane **na `/specify`** (jedyny moment pytań, C-55):
- **Zachowanie akcji w trybie głosowym** → **„Rozmowa płynie dalej"**: wykryte akcje to karty do
  potwierdzenia w wątku, rozmowa toczy się dalej, korekta głosem możliwa, nic nie wykonuje się bez
  wyraźnego potwierdzenia. *(Świadoma zmiana względem 005, które twardo pauzowało pętlę na podglądzie
  planu.)*

Przyjęte rozsądne domyślne (odnotowane jako decyzje właściciela; UX jawnie **oddelegowany** przez
właściciela — „zrób to jak specjalista od UX"):
- **Zakres zmiany zachowania agenta** = **wspólny agent** (czat pisany i głosowy), bo właściciel wprost
  wskazał, że problem jest „już na etapie samego chatu".
- **Wskaźnik trybu głosowego** = **subtelny, nie-zasłaniający** element (np. pulsujący pasek/kropka w
  obrębie composera lub nagłówka), a nie pełnoekranowy orb — dokładna forma pozostaje decyzją
  projektową (`/plan`), byle spełniała AC-10 (widoczny, nie zasłania kart akcji).
- **Composer** = redesign mobile-first z **grupowaniem drugorzędnych akcji** (np. „+"/menu na zdjęcie/
  ustawienia), szersze pole tekstowe; forma pozostaje decyzją projektową (`/plan`), byle spełniała
  AC-13..AC-15.
- **Mechanika mowy** = wbudowana w przeglądarkę (jak 004/005), język polski.
- **Korekta akcji głosem** = przez istniejący mechanizm „popraw plan przez AI" (agent przeplanowuje
  akcje na podstawie wypowiedzianej korekty) — szczegóły w `/plan`.

## 9. Ryzyka
- **Nadmierne rozluźnienie** (agent przestaje proponować akcje nawet przy wyraźnym poleceniu) → AC-2/
  AC-5 pilnują, że jednoznaczne polecenia dalej dają akcje; tuning instrukcji, nie usuwanie zdolności.
- **Nadmierne dopytywanie** (irytujące pytania przy oczywistych poleceniach) → AC-3 dotyczy tylko
  **istotnego, rozstrzygającego** braku (np. wybór spośród wielu list); przy jednoznacznym celu — bez
  pytania (AC-5).
- **Regres jakości akcji** (klasyfikator/`fastPath` mógł wcześniej „na skróty" tworzyć akcje) → zmiana
  ma zachować trafność wyraźnych poleceń; weryfikacja scenariuszami AC.
- **UX kolizja wskaźnik ↔ karty akcji** (orb zasłania potwierdzenia) → AC-10 wymaga nie-zasłaniającego
  wskaźnika; projektujemy tak, by karty akcji były zawsze widoczne i dostępne.
- **Korekta akcji głosem** bywa niejednoznaczna → korekta przechodzi przez agenta (przeplanowanie) i
  dalej wymaga potwierdzenia; błędne rozpoznanie nie wykona akcji „samo".
- **Regres composera na desktopie** → AC-15 pilnuje spójności desktopu; redesign mobile-first nie może
  zepsuć szerokiego widoku.
- **Wsparcie Web Speech** (Safari/iOS) → degradacja jak w 005 (AC-12).
