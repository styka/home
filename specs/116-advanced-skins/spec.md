# Spec: Advanced Skins — zaawansowane skórki generowane z języka naturalnego

- **ID:** 116-advanced-skins
- **Status:** draft
- **Autor sesji:** Claude Code (spec-driven pipeline)
- **Data:** 2026-08-29
- **Moduł(y):** Skórki (platforma/ustawienia wyglądu) + panel admina

> **Zasada speca:** opisujemy **CO i DLACZEGO**, nigdy **JAK**.

## 1. Problem / potrzeba

Dzisiejsza skórka to płaska mapa ~60 zmiennych CSS — potrafi zmienić kolory, typografię,
gęstość i tło gradientowe, ale nie potrafi zmienić aplikacji w „coś, co wygląda jak inna
aplikacja": nie ma stylowania per komponent i per stan, nie ma wariantów układu (sidebar
z prawej, nawigacja pozioma), nie ma grafik (tekstury, tła, dekoracje — `url(` jest celowo
zakazane), nie ma responsywnych różnic ani wersjonowania formatu. Właściciel chce, by
użytkownik opisał wygląd słowami („statek kosmiczny", „bajkowy róż", „gra RPG"), a LLM
przełożył to na głęboką, bezpieczną definicję wyglądu — bez ręcznego edytora setek
parametrów.

## 2. Cel i miary sukcesu

- Cel: obok dzisiejszych skórek (odtąd „proste" — działają bez zmian) istnieje drugi typ,
  **skórka zaawansowana**: wersjonowana, walidowalna definicja wyglądu generowana przez LLM
  z opisu w języku naturalnym, obejmująca tokeny, style komponentów ze stanami, warianty
  układu, grafiki (referencje do trwałych assetów), zachowanie responsywne i ruch.
- Sukces mierzymy:
  - użytkownik wpisuje jedno zdanie opisu → dostaje podgląd → zapisuje i aktywuje skórkę
    zaawansowaną bez dotykania żadnego parametru technicznego;
  - dwie różne intencje („sci-fi panel" vs „słodki róż") dają wizualnie odległe wyniki
    różniące się nie tylko kolorami: także układem, komponentami, teksturą/grafiką;
  - wszystkie istniejące skórki proste działają identycznie jak przed zmianą
    (regresja = 0), a błędna/niepełna skórka zaawansowana nigdy nie psuje aplikacji —
    najgorszy wynik to wygląd domyślny.

## 3. Historyjki użytkownika

- Jako użytkownik chcę opisać wygląd słowami („futurystyczny statek kosmiczny"), żeby
  dostać kompletną skórkę bez konfigurowania parametrów.
- Jako użytkownik chcę zobaczyć podgląd wygenerowanej skórki przed zapisaniem/aktywacją,
  żeby nie „utknąć" w nieudanym wyglądzie.
- Jako użytkownik chcę móc wrócić jednym gestem do wyglądu domyślnego, nawet gdy aktywna
  skórka jest zepsuta lub nieczytelna.
- Jako użytkownik chcę, żeby moje dotychczasowe (proste) skórki dalej działały i były
  edytowalne jak dotąd.
- Jako właściciel skórki chcę ją udostępnić (publicznie/zespołowi) tak samo jak dziś proste.
- Jako admin chcę widzieć liczbę skórek obu typów, liczbę i łączny rozmiar assetów,
  największe i nieużywane (osierocone) assety — i móc bezpiecznie usunąć nieużywane.
- Jako admin chcę wgrać własną grafikę jako asset systemowy (np. teksturę), żeby skórki
  mogły z niej korzystać zanim podłączymy generator obrazów.

## 4. Kryteria akceptacji (testowalne)

- [ ] **AC-1** — Given istniejące skórki proste (w tym 9 systemowych), when wdrożenie
  Advanced Skins, then każda z nich renderuje się identycznie (te same tokeny na `<html>`),
  picker i edytor działają bez zmian.
- [ ] **AC-2** — Given użytkownik w ustawieniach wyglądu, when wpisze opis w języku
  naturalnym i uruchomi generowanie, then powstaje definicja skórki zaawansowanej zgodna ze
  schematem, pokazywana jako podgląd; zapis i aktywacja następują dopiero po decyzji
  użytkownika.
- [ ] **AC-3** — Given definicja skórki zaawansowanej z polami: tokeny, style komponentów
  (min. przycisk, karta, pole tekstowe, nawigacja/pasek boczny) ze stanami (hover, focus,
  disabled, error/success), wariant układu, referencje assetów, ustawienia ruchu — when
  skórka jest aktywna, then wszystkie te warstwy realnie wpływają na wygląd aplikacji.
- [ ] **AC-4** — Given definicja zawierająca wartości niedozwolone (niebezpieczne funkcje
  CSS, nieznane pola, przekroczone limity, odwołanie do nieistniejącego assetu), when
  walidacja, then pola niebezpieczne/nieznane są odrzucane z czytelną listą odrzuceń,
  a pojedyncze błędne pole nie unieważnia całej skórki (degradacja do wartości domyślnej).
- [ ] **AC-5** — Given skórka zaawansowana z wariantem układu „sidebar po prawej" albo
  „nawigacja pozioma u góry", when aktywna, then powłoka renderuje wybrany wariant na
  desktopie, a mobile zachowuje działający układ (top bar + dolny pasek) bez regresji.
- [ ] **AC-6** — Given grafika wgrana jako asset (albo dostarczona przez przyszły
  generator), when dwie skórki użyją tej samej zawartości binarnej, then w magazynie
  istnieje jedna kopia (deduplikacja po treści), a asset jest serwowany z nagłówkami
  pozwalającymi na trwałe cache'owanie przeglądarki.
- [ ] **AC-7** — Given asset używany przez co najmniej jedną skórkę, when admin próbuje go
  usunąć, then system odmawia i wskazuje skórki, które go używają; asset nieużywany daje
  się usunąć.
- [ ] **AC-8** — Given panel admina, when admin otwiera zarządzanie skórkami, then widzi:
  liczbę skórek prostych i zaawansowanych, liczbę assetów, łączny rozmiar, listę assetów
  z rozmiarem/typem/właścicielem/datą oraz oznaczone osierocone.
- [ ] **AC-9** — Given aktywna skórka zaawansowana, która odwołuje się do usuniętego
  assetu albo ma uszkodzoną definicję, when użytkownik otwiera aplikację, then aplikacja
  renderuje się poprawnie (fallback do wartości domyślnych), bez pustej strony i bez błędu.
- [ ] **AC-10** — Given użytkownik z `prefers-reduced-motion`, when aktywna skórka
  definiuje animacje/przejścia, then ruch jest zredukowany zgodnie z preferencją systemową.
- [ ] **AC-15** — Given definicja skórki zawierająca animacje przypisane do konkretnych
  elementów aplikacji (np. wejście karty, hover przycisku, puls poświaty nawigacji,
  animacja ładowania) wybrane z katalogu nazwanych animacji z parametrami (czas, krzywa,
  intensywność), when skórka jest aktywna, then te elementy animują się zgodnie z definicją,
  a animacja spoza katalogu lub z parametrami poza limitami jest odrzucana walidacją.
- [ ] **AC-11** — Given wygenerowana skórka o zbyt niskim kontraście tekstu, when podgląd,
  then użytkownik widzi ostrzeżenie o czytelności (weryfikacja kontrastu), a aktywacja
  pozostaje możliwa świadomie.
- [ ] **AC-12** — Given generowanie skórek przez LLM, when użytkownik wywołuje je wielokrotnie,
  then obowiązują istniejące limity szybkości i budżet AI (koszt raportowany jak w innych
  funkcjach AI).
- [ ] **AC-13** — Given definicja skórki zaawansowanej, then zawiera wersję schematu,
  a definicja w starszej wersji schematu jest nadal odczytywalna (mechanizm migracji lub
  odczyt zgodny wstecz).
- [ ] **AC-14** — Given eksport skórki zaawansowanej do pliku i ponowny import, then
  powstaje równoważna skórka (bez assetów binarnych lub z ich ponownym powiązaniem —
  zachowanie jawnie zakomunikowane), a import obcego pliku przechodzi pełną walidację.

## 5. Zakres

**W zakresie:**
- Drugi typ skórki („zaawansowana") obok istniejącej („prosta") — jedna wspólna lista,
  wspólny picker, wspólne udostępnianie (własna / zespołowa / publiczna / systemowa).
- Deklaratywny, wersjonowany format definicji: tokeny globalne → tokeny/style semantycznych
  komponentów ze stanami → warianty układu (zamknięta lista) → referencje assetów →
  responsywne różnice (desktop/tablet/mobile) → ruch i animacje per element/komponent
  (katalog nazwanych animacji: wejściowe, hover, ładowanie, mikrointerakcje — z parametrami
  czasu/krzywej/intensywności, z poszanowaniem reduced motion).
- Warstwa kontrolowanych nadpisań stylów ograniczona do semantycznych celów i białej listy
  właściwości (bez dowolnego CSS, bez selektorów spoza katalogu).
- Trwały magazyn assetów graficznych w bazie danych z deduplikacją po treści, limitami
  rozmiaru pojedynczego assetu i kwotą per użytkownik; serwowanie z trwałym cache.
- Abstrakcja generatora obrazów (provider konfigurowalny w panelu LLM; na start „brak" —
  skórki używają gradientów/tekstur CSS i assetów wgranych ręcznie przez admina; workflow
  „wykryj brakujące grafiki → wygeneruj → podepnij" przewidziany w formacie definicji).
- Generowanie skórki z opisu w języku naturalnym (dla każdego użytkownika, w ustawieniach
  wyglądu), z podglądem przed zapisem i aktywacją; koszt i limity jak w innych funkcjach AI.
- Walidacja każdej definicji przy zapisie i przy odczycie; fallback per pole; ostrzeżenie
  kontrastowe; twarde limity rozmiaru definicji.
- Observability dla admina (liczby, rozmiary, osierocone assety) + usuwanie nieużywanych
  assetów; blokada usunięcia używanego.
- Testy: regresja skórek prostych, walidacja schematu, odrzucanie niebezpiecznych wartości,
  fallback, referencje assetów, deduplikacja.
- Dokumentacja developerska: architektura, format, jak dodać komponent/właściwość/provider
  obrazów, jak system ma być używany przez LLM.

**Poza zakresem (świadomie):**
- Podłączenie konkretnego dostawcy generowania obrazów (przygotowana abstrakcja + miejsce
  konfiguracji; provider dojdzie osobną zmianą).
- Swobodna rekompozycja DOM / dowolne przenoszenie komponentów między regionami — układ
  zmienia się wyłącznie przez zamkniętą, rozszerzalną listę wariantów.
- Dowolny custom CSS pisany przez LLM/użytkownika (dopuszczone są wyłącznie kontrolowane
  nadpisania z białych list).
- Ręczny edytor wizualny parametrów skórki zaawansowanej (użytkownik nie edytuje definicji).
- Zmiana ikon na wygenerowane grafiki (istniejący zestaw ikon zostaje; skórka może wpływać
  na ich rozmiar/kolor przez tokeny).
- Automatyczne odrzucanie skórek o słabym kontraście (tylko ostrzeżenie — decyzja
  użytkownika).
- Deduplikacja „podobnych" (nie identycznych) grafik.

## 6. Wpływ na Omnia

- **Uprawnienie / RBAC:** bez nowego sluga — wygląd należy do `module.settings`
  (ustawienia) i `module.admin` (panel admina), jak dziś skórki proste.
- **Własność danych:** jak istniejące skórki — `Skin` jest jedną z pięciu tabel, które
  celowo zachowały `ownerId`/`ownerTeamId` (wiersze systemowe bez właściciela); skórki
  zaawansowane i assety przyjmują ten sam model (user / team / system, `isPublic`).
- **Asystent AI:** generowanie skórki to operacja „kliknięciem" poza katalogiem `AIAction`
  (jak dzisiejszy generator skórek prostych) — bez nowej `AIAction`; koszt i pamięć treści
  wg istniejących zasad AI.
- **Kalendarz / powiadomienia / trash:** kalendarz i powiadomienia — nie dotyczy. Trash:
  usunięcie skórki zaawansowanej zachowuje dzisiejsze zachowanie skórek (twarde usunięcie
  z czyszczeniem preferencji); przeniesienie skórek do kosza poza zakresem.

## 7. Zgodność z konstytucją

- **C-10/C-11/C-15** — nowe modele (typ skórki, definicja, assety) = ręczne migracje SQL
  z kolejnym wolnym numerem.
- **C-12** — typ skórki, typ assetu, status — `String` + unia TS, nigdy enum Prisma.
- **C-20** — wszystkie mutacje jako Server Actions z `revalidatePath`.
- **C-21** — własność wg wzorca tabeli `Skin` (wyjątkowej — zachowany `ownerId`);
  nie „kończyć migracji" na tych tabelach.
- **C-30** — nowe warstwy wyglądu przez zmienne CSS/warianty, zero hardcodowanych hexów;
  tekst na akcencie przez `--on-accent`.
- **C-31** — warianty układu nie mogą zepsuć mobile (jeden sidebar, dolny pasek, cele
  dotyku, safe-area).
- **C-33** — zmiany układu przez poszerzenie ramy/powłoki, nie wyjątki per moduł.
- **C-40/C-41** — provider generowania (tekst i przyszłe obrazy) DB-driven przez panel LLM;
  klucze szyfrowane i maskowane.
- **C-50** — build ze wszystkimi bramkami przechodzi; nowe pliki wołające LLM dostają wpisy
  w manifestach pokrycia (koszt, pamięć treści).
- **C-53** — minimalizm: rozszerzamy istniejący system skórek (jedna tabela skórek, jeden
  picker), nie budujemy równoległego.
- **C-54/C-55** — spójność artefaktów; decyzje właściciela zebrane w §8.

## 8. Otwarte pytania / decyzje właściciela

Zebrane w jedynym momencie pytań (2026-08-29):
- **Magazyn assetów: baza danych (Neon)** — dedykowany magazyn z deduplikacją po treści,
  limitami rozmiaru i kwotą per użytkownik; serwowanie przez aplikację z trwałym cache.
  (Google Drive odrzucony: per-user, publiczne skórki traciłyby grafiki; S3 odrzucony:
  nowa infrastruktura wbrew C-53.)
- **Układ: zamknięty zestaw wariantów** publikowany przez powłokę (np. sidebar
  lewo/prawo, nawigacja pozioma, style list/kart); LLM wybiera z listy; lista rozszerzalna
  w kolejnych wersjach schematu.
- **Dostęp: każdy użytkownik** może generować skórki zaawansowane (limity + budżet AI);
  admin dostaje observability i zarządzanie assetami.
- **Generator obrazów: sama abstrakcja teraz**, provider „brak" na start; konfiguracja
  w panelu LLM, podłączenie dostawcy osobną zmianą.

Założenia przyjęte domyślnie (rekomendacje bez pytania):
- Skórki zaawansowane żyją w tej samej tabeli/liście co proste (jeden picker, jedno
  udostępnianie); typ rozróżnia pole rodzaju.
- Eksport/import skórki zaawansowanej przenosi definicję; assety binarne wiążą się po
  treści (jeśli identyczny asset istnieje) albo są jawnie raportowane jako brakujące.
- Ostrzeżenie kontrastowe nie blokuje aktywacji (spójne z tym, że dziś styled skin też
  może być słaby — ale komunikat musi być widoczny).
- Ikony pozostają z istniejącego zestawu (Lucide) — bez wymiany zestawu ikon w tej wersji.

## 9. Ryzyka

- **Wstrzyknięcie CSS/XSS przez definicję z LLM** → LLM traktowany jako niezaufany klient:
  biała lista pól, właściwości i funkcji per rodzaj wartości (rozszerzenie dzisiejszej
  sanityzacji), zakaz dowolnych selektorów, limity długości, walidacja przy zapisie
  ORAZ przy odczycie; assety serwowane wyłącznie jako zweryfikowane typy graficzne.
- **Rozrost bazy przez grafiki** → limity rozmiaru pojedynczego assetu i kwota per
  użytkownik, deduplikacja po treści, panel osieroconych + usuwanie, licznik rozmiaru dla
  admina.
- **Wariant układu psuje któryś z ~20 modułów** → zmiany wyłącznie w powłoce/ramie
  (zamknięta lista wariantów), testy e2e krytycznych ścieżek, mobile nietknięty tam, gdzie
  wariant dotyczy desktopu.
- **Regresja skórek prostych** → zero zmian w ich ścieżce odczytu/zapisu; testy regresyjne
  na renderowaniu tokenów i pickerze.
- **Skórka nieczytelna „więzi" użytkownika** → zawsze dostępny powrót do wyglądu
  domyślnego (żaden wariant układu nie może ukryć wejścia do ustawień), fallback przy
  błędzie definicji.
- **Koszt LLM** → istniejące limity szybkości, budżety AI i raportowanie kosztu; jedna
  generacja = jedno kliknięcie (bez automatycznych regeneracji).
