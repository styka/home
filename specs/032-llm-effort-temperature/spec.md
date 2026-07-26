# Spec: Effort i temperature modeli LLM w konfiguracji + tryb „maksymalny" asystenta

- **ID:** 032-llm-effort-temperature
- **Status:** draft
- **Autor sesji:** Claude Code (spec-driven pipeline)
- **Data:** 2026-07-26
- **Moduł(y):** Admin (konfiguracja LLM), Home / asystent AI (poziom pracy asystenta)

> **Zasada speca:** opisujemy **CO i DLACZEGO**, nigdy **JAK**. Zero nazw plików, tabel, bibliotek,
> endpointów. Jeśli piszesz o implementacji — to należy do `plan.md`, nie tutaj.

## 1. Problem / potrzeba

Administrator decyduje dziś w panelu wyłącznie o tym, **który dostawca i model** obsługuje dany typ
operacji. Nie ma żadnego wpływu na to, **jak intensywnie** model ma pracować ani jak bardzo
kreatywne mają być odpowiedzi — a to właśnie te pokrętła decydują o jakości i koszcie. Skrajnie:
ten sam model potrafi odpowiedzieć powierzchownie albo przemyśleć problem, i dziś nie da się tego
wybrać. Miejsca do przechowania części tych ustawień w systemie już są, ale nigdy nie zostały
wystawione w interfejsie, więc leżą martwe.

Symetrycznie brakuje tego użytkownikowi: przełącznik przy polu wiadomości asystenta ma dziś tylko
„taniej" i „normalnie". Nie ma kierunku „w drugą stronę" — nie da się poprosić o maksimum jakości
przy trudnym zadaniu, mimo że przy prostych da się poprosić o oszczędność.

## 2. Cel i miary sukcesu

- **Cel:** administrator ustawia dla każdego typu operacji nie tylko dostawcę i model, ale też
  poziom wysiłku modelu, temperaturę i limit długości odpowiedzi; użytkownik może jednym kliknięciem
  poprosić asystenta o pracę z podniesionym wysiłkiem.
- **Sukces mierzymy:**
  - Admin zmienia poziom wysiłku dla typu operacji bez znajomości API dostawcy i **bez ryzyka**, że
    nieobsługiwany parametr wywali asystenta.
  - Ustawienia wysiłku/temperatury/limitu są widoczne w panelu, zapisywane i **faktycznie
    wpływają** na wywołanie modelu (widać to w diagnostyce wywołań AI).
  - Użytkownik ma w przełączniku trzy poziomy zamiast dwóch, a wybór „maksymalny" realnie podnosi
    wysiłek modelu w całej rozmowie.
  - Konfiguracja bez ustawionego wysiłku zachowuje się **dokładnie jak dziś** (brak regresji).

## 3. Historyjki użytkownika

- Jako **administrator** chcę ustawić poziom wysiłku modelu dla konkretnego typu operacji, żeby
  droga „myślenia" była stosowana tam, gdzie ma sens, a nie przy prostym parsowaniu tekstu.
- Jako **administrator** chcę ustawić temperaturę, żeby operacje wymagające przewidywalności były
  deterministyczne, a te twórcze — swobodniejsze.
- Jako **administrator** chcę ograniczyć długość odpowiedzi modelu, żeby kontrolować koszt operacji.
- Jako **administrator** chcę widzieć wprost, że wybrany dostawca **nie obsługuje** danego pokrętła,
  zamiast ustawiać coś, co zostanie zignorowane albo — gorzej — wywoła błąd.
- Jako **użytkownik asystenta** chcę przy trudnym pytaniu przełączyć asystenta na tryb maksymalny,
  żeby dostał więcej „miejsca na myślenie", i wiedzieć, że to droższy wybór.
- Jako **użytkownik asystenta** chcę, żeby w trybie maksymalnym żadne pytanie nie było po cichu
  obsłużone najprostszym modelem.

## 4. Kryteria akceptacji (testowalne)

### Panel administratora

- [ ] **AC-1** — Given panel konfiguracji LLM, when administrator otwiera przypisanie modelu do typu
  operacji, then obok dostawcy i modelu widzi trzy dodatkowe ustawienia: **poziom wysiłku**,
  **temperaturę** i **limit długości odpowiedzi**.
- [ ] **AC-2** — Given poziom wysiłku, when administrator go wybiera, then ma do dyspozycji jedną,
  wspólną skalę opisową (brak / niski / średni / wysoki) — **bez** konieczności znajomości nazw
  parametrów dostawcy.
- [ ] **AC-3** — Given wybrany dostawca, który **nie** obsługuje wysiłku (albo temperatury), when
  administrator patrzy na to ustawienie, then interfejs czytelnie informuje, że dla tego dostawcy
  będzie ono pominięte — a system faktycznie go nie wysyła.
- [ ] **AC-4** — Given administrator ustawił wysiłek/temperaturę/limit i zapisał, when wykonywana
  jest operacja tego typu, then wywołanie modelu zawiera odpowiedni parametr dostawcy przetłumaczony
  ze wspólnej skali (i **tylko** taki, jaki dostawca rozumie).
- [ ] **AC-5** — Given typ operacji bez ustawionego wysiłku (stan po wdrożeniu), when wykonywana jest
  operacja, then wywołanie wygląda **identycznie jak przed zmianą** — żaden nowy parametr nie jest
  dosyłany.
- [ ] **AC-6** — Given nieprawidłowa wartość (temperatura poza dozwolonym zakresem, limit ujemny lub
  absurdalnie duży, nieznany poziom wysiłku), when administrator próbuje zapisać, then zapis jest
  odrzucony z czytelnym komunikatem po polsku, a poprzednia konfiguracja pozostaje nietknięta.
- [ ] **AC-7** — Given zmiana ustawień modelu, when zostaje zapisana, then trafia do dziennika
  audytu, tak jak pozostałe zmiany konfiguracji systemu.
- [ ] **AC-8** — Given ustawiony wysiłek dla operacji, when administrator zagląda do diagnostyki
  wywołań modelu, then może potwierdzić, z jakim poziomem wysiłku operacja została wykonana.

### Asystent AI

- [ ] **AC-9** — Given przełącznik poziomu pracy asystenta, when użytkownik go otworzy, then widzi
  **trzy** opcje: oszczędny, standardowy i maksymalny — każda z krótkim opisem konsekwencji
  (szybkość / jakość / koszt).
- [ ] **AC-10** — Given tryb maksymalny, when asystent wykonuje operację, then poziom wysiłku jest
  **podniesiony o jeden stopień** względem tego, co administrator ustawił dla danego typu operacji
  (jeśli już jest najwyższy — zostaje najwyższy).
- [ ] **AC-11** — Given tryb maksymalny, when użytkownik zadaje proste pytanie odczytowe, then
  **nie** następuje automatyczne zejście na tańszy model — pytanie obsługuje model przypisany do
  rozumowania.
- [ ] **AC-12** — Given tryb maksymalny wybrany na jednym urządzeniu, when użytkownik otworzy
  asystenta na innym, then wybór jest zachowany (ustawienie per użytkownik, po stronie serwera).
- [ ] **AC-13** — Given dowolny zalogowany użytkownik (nie tylko administrator), when otwiera
  przełącznik, then tryb maksymalny jest dla niego dostępny; domyślnym trybem pozostaje standardowy.
- [ ] **AC-14** — Given dostawca skonfigurowany dla asystenta, który nie obsługuje wysiłku, when
  użytkownik wybierze tryb maksymalny, then rozmowa działa normalnie (parametr pominięty), bez błędu
  i bez fałszywej obietnicy w interfejsie.

### Bramki

- [ ] **AC-15** — Given wszystkie zmiany, when uruchomiony zostanie `npm run build` (do kroku
  poprzedzającego migrację produkcyjną), then przechodzi bez błędów wraz z istniejącymi bramkami
  (spójność akcji, kontrakt akcji, kontrola dostępu, numeracja migracji, lint).

## 5. Zakres

**W zakresie:**

1. **Wspólna, opisowa skala wysiłku** (brak / niski / średni / wysoki) jako sposób konfigurowania
   „effortu" niezależnie od dostawcy, wraz z tłumaczeniem jej na parametr właściwy dla danego
   dostawcy przy wywołaniu modelu.
2. **Wystawienie w panelu administratora** — dla każdego typu operacji: poziom wysiłku, temperatura
   i limit długości odpowiedzi (dwa ostatnie mają już miejsce w systemie, ale nie są widoczne).
3. **Informacja o możliwościach dostawcy** — panel mówi wprost, które pokrętła dany dostawca
   ignoruje, zamiast pozwalać ustawiać coś bez efektu.
4. **Walidacja ustawień** przy zapisie, z polskimi komunikatami.
5. **Trzeci poziom pracy asystenta („maksymalny")** — podniesiony wysiłek + rezygnacja z
   automatycznego zejścia na tańszy model przy prostych pytaniach; dostępny dla wszystkich
   użytkowników, zapisywany per użytkownik.
6. **Widoczność w diagnostyce** — poziom wysiłku, z jakim wykonano wywołanie, daje się odczytać w
   logu wywołań modelu.

**Poza zakresem (świadomie):**

- Surowe, dowolne parametry dostawcy wpisywane z ręki (odrzucone przez właściciela: literówka lub
  parametr nieobsługiwany przez model daje błąd nieprzejściowy, który przerywa łańcuch fallbacku i
  wywala asystenta).
- Nowy, osobny typ operacji „rozumowanie pogłębione" (odrzucone: więcej konfiguracji do utrzymania,
  a zgłoszenie tego nie wymaga).
- Automatyczne dobieranie wysiłku przez system w zależności od trudności pytania — wysiłek pozostaje
  decyzją administratora i użytkownika.
- Wykrywanie możliwości modelu przez odpytywanie API dostawcy — możliwości opisujemy po stronie
  Omnii, per dostawca.
- Zmiany w cennikach/rozliczaniu kosztów poza tym, co już jest raportowane.
- Ograniczanie droższego trybu do wybranych ról (odrzucone: ma być dostępny dla każdego).

## 6. Wpływ na Omnia

- **Uprawnienie / RBAC:** konfiguracja modeli pozostaje pod istniejącym uprawnieniem
  administratora; wybór poziomu pracy asystenta jest dostępny każdemu zalogowanemu użytkownikowi
  (bez nowych slugów — C-22).
- **Własność danych:** poziom pracy asystenta jest **per użytkownik** (rozszerzenie istniejącego
  zestawu ustawień asystenta o trzecią wartość). Konfiguracja modeli jest **systemowa**.
- **Asystent AI:** bez nowych rodzajów akcji i bez nowych narzędzi odczytu. Zmienia się wyłącznie
  to, **z jakimi parametrami** wołany jest model — dobór modelu nadal należy do administratora
  (C-40).
- **Kalendarz / powiadomienia / trash:** nie dotyczy.
- **Audyt:** zmiany konfiguracji modeli trafiają do dziennika audytu (C-25).
- **Koszty:** podniesiony wysiłek zwiększa koszt tury. Tryb maksymalny jest świadomym wyborem
  użytkownika, domyślnie wyłączonym, a koszt tury jest już pokazywany w stopce odpowiedzi.

## 7. Zgodność z konstytucją

- **C-01, C-02** — praca w `worldofmag/`, importy przez alias.
- **C-10, C-11, C-12** — jeśli potrzebna będzie nowa kolumna na poziom wysiłku, wymaga **ręcznie
  napisanej migracji** z unikalnym numerem; poziom wysiłku jako wartość tekstowa z zawężającym typem
  TypeScript, **nigdy** enum Prisma.
- **C-13** — weryfikacja tylko na lokalnej bazie; nigdy przeciw produkcyjnej.
- **C-20** — zapis konfiguracji i ustawień użytkownika przez Server Actions z `revalidatePath()`.
- **C-25** — zmiany konfiguracji w dzienniku audytu.
- **C-30, C-31, C-32** — nowe kontrolki wyłącznie na zmiennych CSS, użyteczne na telefonie
  (przełącznik asystenta siedzi w kompozytorze), wszystkie teksty po polsku.
- **C-40** — **reguła krytyczna dla tego feature'a:** routing modeli pozostaje sterowany z bazy przez
  panel administratora. Poziom pracy asystenta **nie wybiera modelu** — modyfikuje parametry
  wywołania i typ operacji. Zero hardkodowanego dostawcy ani modelu.
- **C-50, C-51** — „gotowe" = zielony build; nieoczywiste problemy trafiają do `doświadczenia.md`.
- **C-53** — minimalizm: wykorzystujemy istniejące, martwe pola zamiast dokładać nowe struktury;
  jedna wspólna skala zamiast osobnej konfiguracji per dostawca; brak nowych zależności.

## 8. Otwarte pytania / decyzje właściciela

Wszystkie pytania zadano w jednym momencie na etapie `/specify` (C-55). Odpowiedzi właściciela
(wszystkie zgodne z rekomendacją):

- [x] **Sposób wystawienia „effortu"** → **wspólna skala tłumaczona per dostawca**. Administrator
  wybiera brak / niski / średni / wysoki, a Omnia tłumaczy to na parametr właściwy dla dostawcy;
  dostawca bez wsparcia → parametr pominięty + informacja w panelu. Surowe pole tekstowe świadomie
  odrzucone (ryzyko błędu 400 przerywającego fallback).
- [x] **Znaczenie trybu droższego** → **podniesiony wysiłek ORAZ rezygnacja z automatycznego zejścia
  na tańszy model przy prostych pytaniach odczytowych.** Spójne znaczenie „drożej = maksymalna
  jakość na każdym pytaniu".
- [x] **Zakres pól w panelu** → **wysiłek + temperatura + limit długości odpowiedzi.** Dwa ostatnie
  mają już miejsce w systemie i wreszcie zaczną działać; limit to realne narzędzie kontroli kosztów.
- [x] **Dostępność trybu droższego** → **każdy zalogowany użytkownik** (symetrycznie do trybu
  oszczędnego; domyślny pozostaje standardowy, więc nikt nie zapłaci więcej przez przypadek).

Założenia przyjęte samodzielnie (rozstrzygnięte rozsądnym domyślnym, C-55):

- Nazwa trzeciego poziomu w interfejsie: **„Maksymalny"** (obok „Oszczędny" i „Standardowy"), z
  krótkim opisem mówiącym wprost, że jest droższy.
- Poziom wysiłku ustawiany jest **per typ operacji** (tam, gdzie już jest dostawca i model), a nie
  globalnie dla dostawcy — tak działa cała dotychczasowa konfiguracja.
- Tryb oszczędny pozostaje **bez zmian** (nadal kieruje wszystko do modelu najprostszych operacji);
  nowy poziom działa „w drugą stronę".
- Domyślną wartością wysiłku po wdrożeniu jest **brak** — dzięki temu zachowanie systemu nie zmienia
  się, dopóki administrator świadomie czegoś nie ustawi.

## 9. Ryzyka

- **Nieobsługiwany parametr wywala asystenta** → to główne ryzyko tej zmiany (błąd 400 jest
  nieprzejściowy i przerywa łańcuch fallbacku). Ograniczamy: wspólna skala plus opis możliwości per
  dostawca po stronie Omnii; parametru, którego dostawca nie rozumie, po prostu nie wysyłamy.
- **Regresja w istniejących wywołaniach** → dokładamy parametry do ścieżki, którą chodzi cały
  asystent. Ograniczamy: domyślny „brak wysiłku" oznacza wywołanie identyczne jak dziś (AC-5), a
  temperatura dla dostawcy, który jej nie przyjmuje, dalej **nie** jest wysyłana (istniejąca lekcja
  z `doświadczenia.md`).
- **Niekontrolowany wzrost kosztów** → tryb maksymalny podnosi koszt tury i wyłącza oszczędność na
  prostych pytaniach. Ograniczamy: domyślnie wyłączony, świadomy wybór, koszt widoczny w stopce
  odpowiedzi, istniejące limity zapytań i budżetu pozostają w mocy.
- **Zbyt duży limit długości odpowiedzi** ustawiony przez pomyłkę → walidacja zakresu przy zapisie
  (AC-6).
- **Fałszywa obietnica w interfejsie** („ustawiłem wysoki wysiłek, a nic się nie zmienia") →
  wymagana czytelna informacja o pominięciu parametru (AC-3) i możliwość potwierdzenia w diagnostyce
  wywołań (AC-8).
