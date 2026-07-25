# Spec: Ujednolicenie UX dynamicznych sekcji akcji asystenta AI + zgłaszanie problemów z asystentem

- **ID:** 029-assistant-dynamic-actions-ux
- **Status:** draft
- **Autor sesji:** Claude Code (spec-driven pipeline)
- **Data:** 2026-07-25
- **Moduł(y):** Home / Asystent AI (czat) + feedback („robaczki")

> **Zasada speca:** opisujemy **CO i DLACZEGO**, nigdy **JAK**. Zero nazw plików, tabel, bibliotek,
> endpointów.

## 1. Problem / potrzeba

Dynamiczne sekcje asystenta AI — te, w których asystent proponuje akcje, a po zatwierdzeniu je wykonuje
— są dla użytkownika niespójne i przegadane:

- Ta sama informacja o wykonaniu pojawia się **dwa razy**: raz jako „wykonano" w sekcji propozycji, a
  potem jeszcze raz jako **osobna sekcja** z listą wykonanych akcji i przyciskiem „cofnij".
- Nad stopką pokazuje się **dodatkowy „ładny" opis** (np. „Utworzenie zadania w projekcie Omnia na
  podstawie zgłoszenia admina") **oraz** rozwijane **„logi rozumowania"**, które powtarzają dokładnie to
  samo w brzydszej, technicznej formie — a surowe logi widzi każdy użytkownik.
- Ikona „odczytaj" (TTS) ma zbędną tekstową labelkę i nie jest wyrównana z linią stopki (model/tokeny).
- Stopka kosztowa (model / tokeny / kwota) budzi wątpliwość, **czy odzwierciedla całość** pracy (całe
  proponowanie akcji + ich wykonanie może korzystać z więcej niż jednego wywołania modelu), i miesza
  sumę z detalami w jednym ciasnym wierszu.
- Druga ikona „robaczka" w headerze asystenta (zgłoszenie problemu **z samym asystentem**) bywa
  niedostępna dla zwykłych userów, ma zbędny tekst pod polem opisu i mylący nagłówek.
- Tytuły zadań tworzonych z obu „robaczków" zaczynają się od stałego prefiksu z datą — nie widać od razu,
  **czego** dotyczą i **skąd** pochodzą.

Efekt: zaśmiecony, zdublowany interfejs, niepewność co do realnego kosztu, gorsza rozpoznawalność zgłoszeń.

## 2. Cel i miary sukcesu

- **Cel:** jeden spójny, dynamiczny wzorzec „sekcji działania asystenta" (propozycja → wykonanie → cofnij
  w JEDNEJ sekcji), czytelna stopka z sumaryczną kwotą i rozwijanymi szczegółami kosztu, logi rozumowania
  tylko dla admina, dostępne dla wszystkich zgłaszanie problemów z asystentem, i rozpoznawalne prefiksy
  emoji w tytułach zgłoszeń.
- **Sukces mierzymy:**
  - Po zatwierdzeniu akcji użytkownik widzi **dokładnie jedną** sekcję informującą o wykonaniu (zero
    duplikatu), z możliwością cofnięcia w tej samej sekcji.
  - W stopce widoczna jest **tylko suma** kosztu; rozbicie (per model/tura/tokeny/koszt) pojawia się po
    interakcji z kwotą — i **sumuje wszystkie** wywołania modelu, które złożyły się na tę odpowiedź.
  - Ikona „odczytaj" jest bez labelki i w jednej linii ze stopką (model/tokeny).
  - Zwykły user nie widzi surowych logów rozumowania; admin dalej ma do nich dostęp.
  - Zwykły user (nie tylko admin) może otworzyć zgłoszenie problemu z asystentem z headera czatu.
  - Tytuł nowego zadania z „robaczka" zaczyna się od 🐛 (feedback) lub 🐛✨ (asystent), potem krótki,
    jasny tytuł — bez prefiksu z datą.

## 3. Historyjki użytkownika

- Jako użytkownik, gdy zatwierdzam zaproponowane akcje, chcę **jednej** czytelnej sekcji „co się dzieje /
  co wykonano / cofnij", żeby nie czytać dwa razy tego samego.
- Jako użytkownik chcę w stopce widzieć **jedną kwotę** kosztu odpowiedzi, a szczegóły rozwinąć na
  żądanie, żeby wiedzieć realnie ile i na jakim modelu kosztowała cała operacja.
- Jako użytkownik chcę, by ikona „odczytaj" była dyskretna (bez labelki) i wyrównana ze stopką.
- Jako właściciel/admin chcę, żeby surowe „logi rozumowania" i diagnostyka modelu były widoczne tylko dla
  mnie, a zwykły user dostawał czysty, ładny widok.
- Jako zwykły użytkownik chcę móc zgłosić problem **z asystentem AI** z poziomu jego headera.
- Jako właściciel chcę, żeby tytuły zgłoszeń od razu (od pierwszego znaku) mówiły, że to zgłoszenie z
  „robaczka" i czy dotyczy asystenta.

## 4. Kryteria akceptacji (testowalne)

- [ ] **AC-1** — Given asystent zaproponował akcje i użytkownik je zatwierdził, when akcje się wykonają,
  then w wątku pojawia się **jedna** sekcja pokazująca wynik wykonania (co wykonano) z możliwością
  cofnięcia — **nie** pojawia się druga, osobna sekcja powtarzająca tę samą informację.
- [ ] **AC-2** — Given sekcja akcji jest w trakcie/po wykonaniu, when patrzę na jej stan, then widok jest
  dynamiczny: jeden komponent przechodzi przez stany „proponowane → wykonywanie → wykonano/cofnięto" bez
  dublowania treści.
- [ ] **AC-3** — Given odpowiedź asystenta z sekcją TTS, when patrzę na pasek stopki, then ikona
  „odczytaj" jest **bez** tekstowej labelki i znajduje się **w jednej linii** z informacją o
  modelu/tokenach.
- [ ] **AC-4** — Given odpowiedź, której koszt jest znany, when patrzę na stopkę, then widzę **tylko
  sumaryczną kwotę** (bez rozbicia inline).
- [ ] **AC-5** — Given stopka z kwotą, when klikam w kwotę (lub sąsiadujący element), then rozwija się
  czytelne rozbicie: per wywołanie modelu — model, tokeny (prompt/completion/total), koszt — oraz suma,
  która zgadza się z kwotą w stopce.
- [ ] **AC-6** — Given odpowiedź powstała z więcej niż jednego wywołania modelu, when otwieram szczegóły
  kosztu, then wszystkie wywołania są uwzględnione, a suma = kwocie w stopce (koszt nie jest zaniżony do
  jednego wywołania).
- [ ] **AC-7** — Given jestem zwykłym użytkownikiem (bez `module.admin`), when asystent tworzy sekcję
  działania, then **nie** widzę surowych „logów rozumowania" ani szczegółów diagnostyki wywołań modelu.
- [ ] **AC-8** — Given jestem adminem, when rozwijam szczegóły, then dalej mam dostęp do logów rozumowania
  / diagnostyki (bez regresji względem dziś).
- [ ] **AC-9** — Given zatwierdzam sekcję akcji, when akcja się wykona, then nad stopką **nie** ma już
  osobnego „ładnego" opisu planu powielającego treść sekcji (dla zwykłego usera) — informacja jest w
  jednej sekcji.
- [ ] **AC-10** — Given jestem zwykłym użytkownikiem, when otwieram header asystenta AI, then ikona
  „zgłoś problem z asystentem" jest dostępna i działa (nie jest ukryta za `module.admin`).
- [ ] **AC-11** — Given otwarte zgłoszenie problemu z asystentem, when patrzę na formularz, then pod polem
  opisu **nie** ma tekstu „Do zadania dołączymy pełny zrzut tej rozmowy i logi połączeń z backendem.", a
  nagłówek brzmi „Zgłoś problem z Asystentem AI (opis opcjonalny)".
- [ ] **AC-12** — Given zgłaszam problem głównym „robaczkiem" (feedback o elemencie), when powstaje
  zadanie, then jego tytuł zaczyna się od `🐛 ` a dalej jest krótki, jasny tytuł z opisu — bez prefiksu z
  datą.
- [ ] **AC-13** — Given zgłaszam problem „robaczkiem" z headera asystenta, when powstaje zadanie, then
  jego tytuł zaczyna się od `🐛✨ ` a dalej krótki, jasny tytuł.
- [ ] **AC-14** — Given którakolwiek z powyższych zmian dotyczy „dynamicznej sekcji działania" asystenta,
  when asystent tworzy taką sekcję w **dowolnym** scenariuszu (nie tylko przy zadaniu z feedbacku admina),
  then obowiązuje ten sam, ujednolicony wygląd i zachowanie.

## 5. Zakres

**W zakresie:**
- Scalenie sekcji „propozycja akcji + wykonanie + cofnij" w jeden dynamiczny komponent (bez podwójnej
  informacji o wykonaniu), stosowany globalnie we wszystkich dynamicznych sekcjach działania asystenta.
- Stopka: ikona „odczytaj" bez labelki i w linii ze stopką; w stopce tylko suma kosztu; rozwijane
  szczegóły kosztu (per wywołanie modelu: model/tokeny/koszt + suma) po kliknięciu w kwotę/element obok.
- Poprawność danych o koszcie/modelu: suma obejmuje wszystkie wywołania modelu składające się na daną
  odpowiedź (jeśli dziś jest zaniżona/niepełna — skorygować).
- Ograniczenie surowych „logów rozumowania" i diagnostyki wywołań modelu do admina; usunięcie
  duplikującego „ładnego" opisu planu przy stopce dla zwykłego usera.
- Zgłaszanie problemu z asystentem („robaczek" w headerze czatu): dostępne dla wszystkich userów; usunięty
  tekst pod polem opisu; zmieniony nagłówek na „Zgłoś problem z Asystentem AI (opis opcjonalny)".
- Prefiksy emoji w tytułach zadań tworzonych z obu „robaczków": `🐛 ` (feedback) / `🐛✨ ` (asystent),
  potem krótki wygenerowany tytuł; usunięcie stałego prefiksu z datą.

**Poza zakresem (świadomie):**
- Zmiana logiki agenta/pętli narzędzi ponad to, co potrzebne, by poprawnie **zsumować i pokazać** koszt.
- Zmiana samego mechanizmu routingu modeli (`/admin/llm`) — korzystamy z istniejącego.
- Zmiany w treści/zakresie zapisywanego do zadania „zrzutu rozmowy" (poza usunięciem widocznego tekstu
  informacyjnego pod polem i prefiksem tytułu).
- Nowe modele danych, jeśli obecne dane telemetryczne o wywołaniach modelu wystarczą do rozbicia kosztu.

## 6. Wpływ na Omnia

- **Uprawnienie / RBAC:** bez nowego slugu. Wykorzystujemy istniejący `module.admin` do bramkowania
  surowych logów rozumowania/diagnostyki (widoczność „tylko admin"). „Robaczek" asystenta przestaje być
  admin-only — dostęp dla każdej sesji (auth) (por. C-22).
- **Własność danych:** bez zmian w modelu współwłasności — feature jest UX-owy, per-user w kontekście
  własnej rozmowy (por. C-21). Zadania z „robaczka" powstają jak dziś (istniejący przepływ tworzenia
  zadania), zmienia się tylko tytuł (prefiks).
- **Asystent AI:** nie wprowadzamy nowej `AIAction` ani read-toola (por. C-23) — zmiana dotyczy
  prezentacji sekcji akcji i telemetrii kosztu, nie katalogu akcji. (Jeśli plan wykryje potrzebę drobnej
  korekty w przekazywaniu metadanych kosztu z warstwy agenta do UI — pozostaje to bez zmiany kontraktu
  `AIAction`.)
- **Kalendarz / powiadomienia / trash:** nie dotyczy.

## 7. Zgodność z konstytucją

- **C-01/C-02** — całość w `worldofmag/`, importy przez alias `@/*`.
- **C-30** — kolory i wygląd sekcji/stopki przez zmienne CSS (motyw/skiny), zero hardcodowanych hexów;
  tekst na kolorowych elementach = `var(--on-accent)`.
- **C-31** — dynamiczna sekcja i rozwijane szczegóły kosztu działają mobile-first (dotykowe cele,
  brak dwóch sidebarów, `Esc` zamyka), zgodnie z resztą czatu.
- **C-32** — wszystkie teksty po polsku (nagłówki, etykiety, tooltipy).
- **C-40/C-41** — dane o modelu/koszcie pochodzą z istniejącej telemetrii DB-driven routingu; nie
  hardcodujemy providera/modelu ani nie ujawniamy kluczy.
- **C-53** — minimalizm: scalamy istniejące sekcje i korygujemy telemetrię, bez nowych abstrakcji/zależności.
- **C-50/C-51/C-52** — „gotowe" = zielony `npm run build`; lekcje do `doświadczenia.md`; merge do
  `develop`, a na końcu automatyczna promocja do `master`.

## 8. Otwarte pytania / decyzje właściciela

Rozstrzygnięte w `/specify` (jedyny moment pytań):
- **Logi rozumowania → tylko admin.** Zwykły user widzi wyłącznie ujednoliconą, „ładną" sekcję akcji;
  surowe logi rozumowania i diagnostyka wywołań modelu są bramkowane `module.admin`.
- **Prefiksy tytułów → `🐛 ` (feedback) / `🐛✨ ` (asystent AI).** Po prefiksie krótki, jasny tytuł
  wygenerowany z opisu; stały prefiks z datą usunięty.

Założenia przyjęte domyślnie (bez pytania, do korekty przez furtkę C-55 tylko jeśli okażą się błędne):
- Rozbicie kosztu odsłaniamy **po kliknięciu w kwotę** w stopce (popover/rozwinięcie), zgodnie z sugestią
  właściciela („po kliknięciu w tą kwotę albo w coś obok").
- „Cofnij" pozostaje dostępne w scalonej sekcji (nie usuwamy możliwości cofnięcia — łączymy tylko widok).
- Nie tworzymy nowych modeli danych, jeśli istniejąca telemetria wywołań modelu wystarcza do sumy i rozbicia.

## 9. Ryzyka

- **Zaniżony/niepełny koszt** — jeśli dziś stopka pokazuje koszt tylko jednego wywołania, poprawa sumy
  wymaga zebrania telemetrii ze wszystkich wywołań danej odpowiedzi. Ograniczamy: opieramy się na już
  zbieranej diagnostyce wywołań; jeśli czegoś brakuje, plan wskaże minimalne uzupełnienie bez zmiany
  kontraktu akcji.
- **Regresja widoczności dla admina** — chowając logi przed userem, nie możemy odebrać ich adminowi.
  Kryterium AC-8 to pilnuje.
- **Globalna zmiana wyglądu sekcji** — scalenie dotyczy każdej dynamicznej sekcji działania; ryzyko, że
  jakiś rzadszy scenariusz (poza „zadanie z feedbacku") zostanie pominięty. AC-14 wymusza jednolitość.
- **Emoji w tytułach** — muszą przejść jako zwykły tekst przez cały przepływ zapisu tytułu (bez zamiany na
  „?"). Weryfikacja na realnym zadaniu.
