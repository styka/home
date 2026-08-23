# 084 — Weryfikacja

> Etap 5. Sprawdzam ZACHOWANIE, nie kompilację. Liczby pochodzą z pomiarów w przeglądarce
> (Chromium headless), a nie z lektury kodu.

## 1. Bramki

| Komenda | Wynik |
|---|---|
| `check:migrations` (0256) | ✅ |
| `check:schema-drift` | ✅ na lokalnym Postgresie (C-13 — nigdy prod) |
| `check:i18n`, `check:ui-contract`, `check:pagination`, `check:owner-columns` | ✅ |
| `check:boundaries`, `check:module-registry`, `check:logs`, `check:client-safe` | ✅ |
| `check:cost-badge`, `check:content-memory`, `check:ai-coverage`, `check:actions` | ✅ |
| `check:tailwind-content`, `check:route-gating`, `check:e2e-waits` | ✅ |
| `tsc --noEmit` (aplikacja + testy) | ✅ |
| `next lint --dir src` | ✅ |
| `next build` | ✅ |
| `check:perf` | ✅ 1175 kB najcięższa trasa, suma 65821 kB — w paśmie ±5% |
| testy jednostkowe | ✅ **1164** (1153 sprzed przebiegu + 11 nowych) |
| klikacz — pełna suita | ⚠️ 144 zielone / 2 czerwone — patrz §4 |

## 2. Kryteria akceptacji

### A. Lektor — usterka odtwarzania

| AC | Werdykt | Dowód |
|---|---|---|
| **AC-1** — dźwięk po jednym dotknięciu | ✅ | Dostępność dostawcy rozstrzygana przy montowaniu (`getSpeechOptions`), więc przy nieskonfigurowanym TTS pierwsze zdanie idzie przeglądarką **synchronicznie w geście**. Dodatkowo „Słuchaj" **zaczyna czytać**, a nie tylko otwiera pasek — dotąd trzeba było kliknąć drugi raz. |
| **AC-2** — nigdy cisza bez komunikatu | ✅ | Klikacz `news-czytnik`: z podstawioną, milczącą syntezą interfejs pokazuje komunikat i „Odtwórz ponownie", nie licznik. Sprawdzony **w obie strony** — po usunięciu zgłaszania ciszy test pada. 5 testów jednostkowych `czujkaCiszy` pilnuje też strony odwrotnej: działająca mowa NIE może być zgłoszona jako cisza. |
| **AC-3** — zmiana głosu bez przerwania | ✅ | Czujka uzbraja się raz na całą wypowiedź, także gdy po drodze zmienia się ścieżka z serwerowej na przeglądarkową; komunikat o zejściu na głos systemowy leci raz (mechanizm z 080, zachowany). |

**Znalezione i naprawione przyczyny milczenia — cztery, nie jedna:** lektor nie konfigurował własnego
głosu (dziedziczył zmienną modułową po asystencie); zatrzask z 080 ratował drugie zdanie, którego
nigdy nie było; brak syntezy wołał `onEnd`, więc lektor przelatywał porcję w milczeniu przy rosnącym
liczniku; pusty `catch` przy niesprawnej syntezie nie zgłaszał nic.

### B. Lektor — UX odsłuchu

| AC | Werdykt | Dowód |
|---|---|---|
| **AC-4** — pasek przyklejony do dołu | ✅ | Klikacz: `[data-news-lektor]` ma `position: fixed` i stoi przy dolnej krawędzi. Świadomie `fixed`, nie `sticky` — zmierzone: `sticky bottom-0` na końcu treści był 4000 px poniżej ekranu, czyli przyklejał się dopiero wtedy, gdy nie był już potrzebny. |
| **AC-5** — brak osobnej sekcji z treścią | ✅ | Klikacz: `[data-sentence]` ma **zero** wystąpień. Czytane zdanie podświetla się w karcie (`<mark>`, kolory zmiennymi CSS), dopasowane po TREŚCI — obie strony dzielą `lib/speech/sentences`. |
| **AC-6** — przełącznik przy wiadomościach | ✅ | Ikona celownika w przyklejonym nagłówku sekcji, widoczna gdy lektor czyta z tego tematu. **Jeden stan**, dwa wejścia: po dodaniu drugiego wejścia stan musiał wyjść z lektora do widoku, inaczej przełącznik pokazywałby co innego, niż robi widok. |
| **AC-7** — samoczynne wyłączenie | ✅ | Nasłuch `scroll` na ramie widoku, z tym samym strażnikiem czasu co obserwator sekcji — bez niego przewinięcia lektora gasiłyby podążanie natychmiast po włączeniu. |
| **AC-8** — przerwa między pozycjami | ✅ | 400 ms na granicy bloków, stała (suwak do regulowania ciszy to kontrolka, której nikt nie dotknie drugi raz — C-53). |
| **AC-9** — zapowiedź źródła bez powtórzeń | ✅ | Zapowiedź tylko przy ZMIANIE portalu, tym samym mechanizmem (`lead`) co zapowiedź tematu — nie drugim obok niego. |
| **AC-10** — rozróżnialne wejścia | ✅ | „Słuchaj" ma obramowanie akcentem i wagę główną, „Oznacz wszystkie" zostaje przyciskiem tekstowym, między nimi separator. |

### C. Nawigacja po tematach

| AC | Werdykt | Dowód |
|---|---|---|
| **AC-11** — wybór przewija | ✅ | `skoczDoTematu` woła wyłącznie `przewinDo`; przewijamy tylko ramę widoku (lekcja z 082 zachowana). |
| **AC-12** — brak strzałek | ✅ | `onSasiad` nie jest podawany. Prop **zostaje** w komponencie wspólnym dla innych konsumentów (C-53). |
| **AC-13** — zawsze wszystkie tematy | ✅ | Filtrowanie po temacie usunięte z `widoczneWiadomosci`/`widocznaOs`; klucz `temat` znikł z adresu i z propsów trasy. Nie istnieje stan, w którym część tematów jest niewidoczna. |

### D. Pasek widoku

| AC | Werdykt | Dowód |
|---|---|---|
| **AC-14** — chrom zajmuje mniej miejsca | ✅ *(kryterium skorygowane, patrz spec)* | Klikacz: świeżość i skróty **nie stoją** rozłożone w pasku (0 elementów), są w menu. Gwiazdka została w pasku — uzasadnienie w §5. |
| **AC-15** — nic nie znika | ✅ | Klikacz: po otwarciu menu obie pozycje są na miejscu; gwiazdka dostępna wprost. |
| **AC-16** — filtry mają więcej miejsca | ✅ | Chrom kurczy się z 3 elementów do 2; zmierzona strefa chromu przed zmianą: 43 px przy ekranie 360 px (12% szerokości). |

### E. Telefon

| AC | Werdykt | Dowód |
|---|---|---|
| **AC-17** — zero poziomego przewijania | ✅ | Klikacz przy 360 px: **zero** elementów szerszych od swojego pola widzenia, przed i po przewinięciu. Punkt odniesienia sprzed zmiany: **24 rozpychacze, w tym korzeń strony 377 px przy ekranie 360**. Sprawdzone w obie strony — po przywróceniu ujemnego marginesu test pada z listą 16 elementów. |
| **AC-18** — czytelne wejście do listy | ✅ | Wyzwalacz ma `flex-1` (bierze dostępną szerokość zamiast mierzyć treść) i stałą etykietę „Tematy". |
| **AC-19** — widoczne nazwy zakładek | ✅ | Klikacz: wszystkie trzy zakładki mają szerokość > 20 px przy 360 px. |
| **AC-20** — przełącznik treści się mieści | ✅ | Poniżej `lg` zwija się do ikon; `aria-label` niesie pełną nazwę, więc chowamy tekst, nie funkcję. |

### F. Jakość treści

| AC | Werdykt | Dowód |
|---|---|---|
| **AC-21** — awaria partii nie ubija etapu | ✅ | 6 testów jednostkowych `partieStreszczen`, w tym wprost: trzy partie, środkowa rzuca, pozostałe i tak zostają streszczone. Pętla wyszła do czystej funkcji, żeby dało się to sprawdzić bez Prismy i dostawcy modelu. |
| **AC-22** — tytuły po polsku | ✅ | Pole `title` w tym samym wywołaniu co streszczenie; pominięty tytuł zostawia oryginał. |
| **AC-23** — widoczny brak streszczenia | ✅ | Kolumna `summaryFailed` (migracja 0256) + znacznik na karcie. Kolumna, nie wyliczenie: skrót z kanału bywa poprawnym zdaniem, więc z treści nie da się orzec, czy to streszczenie. |

### G. Gorące tematy

| AC | Werdykt | Dowód |
|---|---|---|
| **AC-24** — układ jak w pozostałych zakładkach | ✅ | Wspólny `NaglowekSekcji` (od 083). |
| **AC-25** — odsiewanie propozycji | ✅ | Odciski monitorowanych **i** odrzuconych, liczone tą samą funkcją. |
| **AC-26** — dodana propozycja znika | ✅ | Wynika z AC-25, bez osobnego stanu „przeniesione" — dodany temat przestaje być propozycją, bo jest tematem. |
| **AC-27** — zarządzanie obiema listami | ✅ | Panel monitorowanych z „przestań monitorować" (za `confirmDialog`, C-34) obok istniejącego panelu odrzuconych. |

**Podsumowanie: 27/27 spełnione** (AC-14 wg skorygowanego brzmienia).

## 3. Zgodność z konstytucją

C-01, C-02/C-36 ✅. **C-10..C-13** ✅ jedna migracja addytywna, numer z narzędzia, weryfikacja
wyłącznie lokalnie. **C-12** ✅ `summaryFailed` to `Boolean` (fakt dwustanowy), nie status.
**C-20/C-21** ✅ bez nowych mutacji; istniejące zachowują guardy. **C-30** ✅ podświetlenie i znacznik
wyłącznie zmiennymi CSS. **C-31** ✅ zero poziomego przewijania (zmierzone), `env(safe-area-inset-bottom)`
na pasku lektora, cele dotyku. **C-32** ✅. **C-33** ✅ menu chromu i dwa wiersze poszerzają RAMĘ, nie
robią wyjątku w module. **C-34** ✅. **C-51** ✅ cztery wpisy. **C-53** ✅ nie usuwam `onSasiad` z
komponentu wspólnego, nie dokładam stanu „przeniesione", nie daję ustawienia długości przerwy, nie
przebudowuję infrastruktury testów. **C-54** ✅ trzy korekty artefaktów zapisane na miejscu (AC-18,
AC-21 na etapie planu; AC-14 na etapie implementacji).

## 4. Regresje i znane ograniczenia

Pełna suita klikacza: **144 zielone / 2 czerwone**.

Obie czerwone (`favorites/fav-AC4`, `shortcuts/sc-AC9`) to **wyścig o wspólny stan**, nie regresja
funkcji — i mam na to dowód pomiarowy: **każdy z tych plików uruchomiony osobno jest zielony**
(favorites 14/14, shortcuts 7/7, view-state 11/11). Trzy specyfikacje czyszczą ulubione „do zera"
i zapisują własne wpisy na tym samym koncie administratora, w równoległych workerach.

Przy okazji naprawiłem **dwa zastane błędy** w ich pętlach czyszczących, oba maskowane przypadkiem aż
do teraz: brak wykluczenia gwiazdki bieżącego widoku (klikanie jej przełącza `/settings` w kółko —
naprawione w `favorites` w 098, przetrwało w dwóch pozostałych) i brak zawężenia do treści strony,
przez co `count()` liczył ukryty mobilny overlay powłoki.

**Samego wyścigu nie naprawiam** i mówię to wprost: usunięcie go wymaga osobnego konta na plik albo
szeregowego przebiegu, czyli zmiany infrastruktury testów — to osobna praca, nie doklejka na końcu
dużego przebiegu (C-53).

### Czego NIE dało się sprawdzić

- **Prawdziwy iPhone / WebKit.** Nie ma go w środowisku i polityka sieci nie pozwala go pobrać.
  Mechanizm naprawy sprawdziłem podstawiając milczącą syntezę w Chromium; **ostateczne potwierdzenie,
  że lektor odzywa się na telefonie właściciela, należy do właściciela.** Czujka ciszy jest
  zaprojektowana tak, żeby działała niezależnie od przyczyny — właśnie dlatego, że przyczyny na
  docelowym urządzeniu nie zobaczę.
- **Żywotność kanałów RSS** — proxy odrzuca `CONNECT`; ograniczenie zastane.

## 5. Werdykt końcowy

**GOTOWE Z UWAGAMI.**

27/27 kryteriów spełnionych, komplet bramek zielony, 1164 testy jednostkowe, dwa nowe testy klikacza
sprawdzone **w obie stronę**. Dwie uwagi, obie zaraportowane wprost, nie zamiecione:

1. **AC-14 zostało skorygowane w trakcie implementacji** — gwiazdka nie weszła do menu, bo warstwa
   w warstwie okazała się krucha. Chrom kurczy się z trzech elementów do dwóch, a nie do jednego.
2. **Dwa testy klikacza pozostają czerwone w pełnym przebiegu**, zielone w izolacji — zastany wyścig
   o wspólne konto, z dowodem pomiarowym i wskazaną trwałą naprawą.
