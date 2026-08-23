# Zadania: Lektor, pasek widoku i domknięcie listy z przebiegu 083

- **Plan:** ./plan.md (084-lektor-pasek-i-domkniecie-083)
- **Status:** todo
- **Data:** 2026-08-23

> **Kolejność jest poleceniem właściciela, nie tylko techniką:** najpierw dług z przebiegu 083
> (jakość treści → lektor → gorące tematy), potem cztery usterki z jego testów. Wewnątrz każdej
> części — od najłatwiejszego do najtrudniejszego i zgodnie z zależnościami.

## Legenda
- `[ ]` do zrobienia · `[x]` zrobione · `[~]` w trakcie · `[!]` zablokowane
- `[P]` — niezależne od poprzedniego, można robić równolegle

---

## Faza 0 — Środowisko i fundament danych

- [x] **T-1** — **Punkt odniesienia w przeglądarce.** Zmierz PRZED zmianami, przy 360 px i 1280 px:
  `document.documentElement.scrollWidth` vs `clientWidth` na `/wiadomosci` i `/tasks`, liczbę
  elementów chromu w pasku widoku, szerokość kontenera filtrów. Bez tych liczb AC-16 i AC-17 nie da
  się orzec, a nie zamierzam ich orzekać „na oko" (lekcja z 082).
  *Gotowe, gdy:* liczby zapisane w notatce przebiegu.

- [x] **T-2** — **Migracja 0256** `prisma/migrations/0256_news_item_summary_failed/migration.sql`:
  `ALTER TABLE "NewsItem" ADD COLUMN IF NOT EXISTS "summaryFailed" BOOLEAN NOT NULL DEFAULT false;`
  plus zsynchronizowany `schema.prisma`.
  *Gotowe, gdy:* `npm run check:migrations` i `npm run check:schema-drift` zielone na LOKALNYM
  Postgresie (C-13).

---

## Faza 1 — Dług z 083, część D: jakość treści *(AC-21..AC-23)*

- [x] **T-3** — **Awaria partii nie ubija etapu streszczania.** W `summarizeItems` otocz wywołanie
  modelu `try/catch`: partia, która padła, wraca do kolejnego podejścia zamiast przerywać cały etap.
  Po wyczerpaniu podejść pozycje bez streszczenia dostają `summaryFailed = true`.
  *Gotowe, gdy:* AC-21 — test jednostkowy, w którym jedna partia rzuca, a pozostałe i tak zostają
  streszczone.

- [x] **T-4** — **Tłumaczenie tytułów na polski.** Rozszerz istniejący prompt streszczeń o pole
  `title` w odpowiedzi JSON (przetłumacz; jeśli już po polsku — przepisz bez zmian). To samo
  wywołanie, nie drugie.
  *Gotowe, gdy:* AC-22 — tytuł zapisywany razem ze streszczeniem; test kształtu odpowiedzi.

- [x] **T-5** `[P]` — **Widoczny brak streszczenia.** `NewsItemCard` przy `summaryFailed` pokazuje
  dyskretny znacznik „bez streszczenia — skrót ze źródła" (tekst przez `t()`).
  *Gotowe, gdy:* AC-23 spełnione; `check:i18n` zielone.

- [x] **T-6** — **Commit fazy 1.**

---

## Faza 2 — Dług z 083, część E: lektor *(AC-1..AC-10)*

> Najtrudniejsza faza przebiegu. Kolejność: najpierw **słychać**, potem **wygląda**.

- [ ] **T-7** — **Lektor konfiguruje własny głos.** `NewsReader` przy montowaniu czyta
  `getSpeechOptions()` i woła `setServerVoiceId(...)` — koniec dziedziczenia stanu po asystencie.
  *Gotowe, gdy:* zachowanie lektora nie zależy już od tego, czy asystent był wcześniej otwarty.

- [ ] **T-8** — **Czujka ciszy w `lib/tts.ts`.** Po starcie wypowiedzi licznik czasu; brak `onstart`
  i `onend` w ~1,5 s → wywołanie zwrotne `onSilent`. To jest jedyne zabezpieczenie działające
  **niezależnie od przyczyny** milczenia.
  *Gotowe, gdy:* test jednostkowy — synteza, która nic nie robi, wyzwala `onSilent`; synteza, która
  gra, **nie** wyzwala.

- [ ] **T-9** — **Rozstrzygnięcie dostępności głosu przed pierwszym dotknięciem.** Gdy głos serwerowy
  jest ustawiony, lektor sprawdza jego gotowość przy montowaniu; odmowa zatrzaskuje ścieżkę
  serwerową, więc pierwsze zdanie idzie przeglądarką **synchronicznie w geście**.
  *Gotowe, gdy:* AC-1 — test jednostkowy: przy niedostępnym głosie serwerowym pierwsze `speak`
  nie wykonuje żądania sieciowego przed syntezą.

- [ ] **T-10** — **Komunikat zamiast udawania + ponowienie.** Po `onSilent` lektor przestaje pokazywać
  postęp, wyświetla **co** nie zadziałało i daje „Odtwórz ponownie" (kliknięcie jest gestem, więc
  ponowienie gra).
  *Gotowe, gdy:* AC-2 i AC-3 — klikacz z podstawioną, milczącą syntezą pokazuje komunikat, nie licznik.

- [ ] **T-11** — **Pasek lektora przyklejony do dołu, bez listy zdań.** `NewsReader` zostaje samym
  sterowaniem (`sticky bottom-0`, `env(safe-area-inset-bottom)`); pudełko z powtórzoną treścią
  **znika**. Przenieś świadomie mechanizmy z 080/Z12: prędkość, podążanie, jeden lektor naraz
  (`claimSpeech`).
  *Gotowe, gdy:* AC-4 i AC-5 — w drzewie nie ma listy zdań lektora, pasek ma `position: sticky`.

- [ ] **T-12** — **Podświetlenie czytanego zdania w karcie wiadomości.** `NewsItemCard` przyjmuje
  czytane zdanie i podświetla pasujący fragment (dopasowanie po treści, nie po indeksie; kolor
  zmienną CSS).
  *Gotowe, gdy:* AC-5 w pełni — czytany fragment widać przy wiadomości, nie w osobnym pudełku.

- [ ] **T-13** — **Przełącznik podążania przy wiadomościach + samoczynne wyłączenie.** Ikona
  w nagłówku sekcji tematu (jeden stan `readerFollow`, dwa wejścia); ręczne przewinięcie ramy gasi
  podążanie.
  *Gotowe, gdy:* AC-6 i AC-7 — po samodzielnym przewinięciu widok zostaje tam, gdzie go zostawiono.

- [ ] **T-14** `[P]` — **Przerwa między pozycjami i zapowiedź źródła bez powtórzeń.** ~400 ms ciszy
  na granicy bloków; `ReaderBlock.zrodlo` zapowiadane tylko przy zmianie portalu.
  *Gotowe, gdy:* AC-8 i AC-9 — test jednostkowy budowania zdań: dwie kolejne pozycje z tego samego
  źródła dają **jedną** zapowiedź.

- [ ] **T-15** `[P]` — **Rozróżnialne wejścia „słuchaj" i „oznacz wszystkie".** Odsłuch dostaje
  wariant `primary` z ikoną, oznaczanie zostaje przyciskiem tekstowym, między nimi separator.
  *Gotowe, gdy:* AC-10 — nie da się kliknąć jednego, mierząc w drugie.

- [ ] **T-16** — **Commit fazy 2** + bramki modułowe.

---

## Faza 3 — Dług z 083, część F: gorące tematy *(AC-24..AC-27)*

- [ ] **T-17** — **Odsiewanie propozycji już pokrytych.** W `getHotTopics` odfiltruj propozycje,
  których odcisk tytułu pokrywa się z tematem monitorowanym albo odrzuconym. Reużyj istniejącej
  funkcji odcisku (tej od `NewsHiddenTopic`), nie pisz drugiej reguły podobieństwa.
  *Gotowe, gdy:* AC-25 i AC-26 — dodana propozycja znika z listy sama, bez osobnego stanu.

- [ ] **T-18** — **Zarządzanie monitorowanymi i odrzuconymi w zakładce.** Dwie zwijane listy pod
  jednym panelem, każda z akcją odwrotną (przestań monitorować / przywróć). Usunięcie tematu za
  `confirmDialog` (C-34).
  *Gotowe, gdy:* AC-24 i AC-27 — obie listy dostępne z zakładki, układ ten sam co w pozostałych.

- [ ] **T-19** — **Commit fazy 3.**

---

## Faza 4 — Usterki z testów: rama widoku *(AC-14..AC-16, AC-19)*

> Ta faza dotyka **wszystkich 22 widoków** — stąd osobno i stąd pełny klikacz w domknięciu.

- [ ] **T-20** — **`ViewChromeMenu`.** Nowy komponent: przycisk `MoreHorizontal` + `AnchoredLayer`
  z gwiazdką, świeżością i skrótami. Elementy przychodzą jak dotąd z `ViewChromeProvider` — kontrakt
  bez zmian.
  *Gotowe, gdy:* AC-15 — wszystkie trzy rzeczy nadal dostępne jednym dotknięciem.

- [ ] **T-21** — **`ViewBar` rysuje menu zamiast rzędu.**
  *Gotowe, gdy:* AC-14 i AC-16 — pomiar: chrom to jeden element, filtry mają mierzalnie więcej
  miejsca niż w T-1.

- [ ] **T-22** — **Dwa wiersze na telefonie.** `ViewBar` w wariancie gęstym: `flex-col md:flex-row`;
  filtry w drugim wierszu z własnym `overflow-x`. Na komputerze bez zmian.
  *Gotowe, gdy:* AC-19 — nazwy wszystkich trzech zakładek widoczne przy 360 px.

- [ ] **T-23** — **Commit fazy 4** + `check:ui-contract`.

---

## Faza 5 — Usterki z testów: moduł Wiadomości *(AC-11..AC-13, AC-17, AC-18, AC-20)*

- [ ] **T-24** — **Drop-down przestaje być filtrem.** Klucz `temat` znika ze stanu widoku;
  `wybierzTemat` wyłącznie przewija; filtrowanie po temacie znika z `widoczneWiadomosci`
  i `widocznaOs`. Wyzwalacz pokazuje stałą etykietę „Tematy", nie nazwę.
  *Gotowe, gdy:* AC-11 i AC-13 — po wyborze tematu liczba sekcji na stronie **się nie zmienia**.

- [ ] **T-25** `[P]` — **Strzałki znikają.** `onSasiad` nie jest podawany przez Wiadomości; prop
  **zostaje** w `GroupNavigator` dla innych konsumentów (C-53).
  *Gotowe, gdy:* AC-12 — w pasku nie ma strzałek.

- [ ] **T-26** — **Pasek Wiadomości bez poziomego przewijania strony.** `min-w-0` na elastycznych
  przodkach, `overflow-x` wyłącznie na kontenerze filtrów, przełącznik treści zwijany do ikon
  z `aria-label` przy braku miejsca.
  *Gotowe, gdy:* AC-17, AC-18, AC-20 — pomiar: `scrollWidth <= clientWidth` przy 360 px, przed
  i po przewinięciu.

- [ ] **T-27** — **Testy klikacza.** `news-czytnik.spec.ts` (AC-2, AC-4, AC-5) i
  `pasek-widoku-mobile.spec.ts` (AC-17..AC-20). Oba **sprawdzone w obie strony** — zielone na
  poprawionym kodzie, czerwone po sztucznym cofnięciu poprawki.
  *Gotowe, gdy:* obie strony potwierdzone, tak jak w 082 i 083.

- [ ] **T-28** — **Commit fazy 5.**

---

## Faza 6 — Domknięcie

- [ ] **T-29** — **Pełny przebieg bramek** na lokalnym Postgresie (C-13, zatrzymanie przed
  `migrate.js` na prod): wszystkie `check:*`, `tsc` ×2, `next lint`, `next build`, budżet
  wydajnościowy, testy jednostkowe.

- [ ] **T-30** — **Weryfikacja w przeglądarce** (obowiązkowa, lekcja z 082/083): pełna suita
  klikacza + pomiary do AC-14..AC-20 porównane z punktem odniesienia z T-1.
  *Gotowe, gdy:* zero regresji, a liczby zapisane — nie „wygląda dobrze".

- [ ] **T-31** — **`CLAUDE.md`**: lektor (pasek dolny, podświetlenie w karcie), pasek widoku (menu
  chromu, dwa wiersze na telefonie), Wiadomości (drop-down jako skok, nie filtr), `summaryFailed`.

- [ ] **T-32** — **`doświadczenia.md`** (C-51): co najmniej trzy wpisy — milczenie lektora
  (dziedziczony stan globalny + brak zdarzenia przy odrzuceniu przez WebKit + zatrzask ratujący
  nieistniejące drugie zdanie), awaria partii ubijająca cały etap, oraz odwrócenie decyzji
  z 083 (filtr → skok) jako lekcja o tym, że „jedna kontrolka = jedno znaczenie" bywa rozstrzygane
  dopiero w rękach użytkownika.

---

## Mapowanie kryteriów akceptacji → zadania

| AC | Zadanie | AC | Zadanie |
|----|---------|----|---------|
| AC-1 dźwięk po jednym dotknięciu | T-9 | AC-15 chrom nadal dostępny | T-20 |
| AC-2 nigdy cisza bez komunikatu | T-8, T-10 | AC-16 filtry mają więcej miejsca | T-21 (dowód: T-1) |
| AC-3 zmiana głosu bez przerwania | T-8, T-10 | AC-17 zero poziomego scrolla | T-26 (dowód: T-30) |
| AC-4 pasek przyklejony do dołu | T-11 | AC-18 czytelne wejście do listy | T-24, T-26 |
| AC-5 brak osobnej sekcji z tekstem | T-11, T-12 | AC-19 widoczne nazwy zakładek | T-22 |
| AC-6 przełącznik przy wiadomościach | T-13 | AC-20 przełącznik treści mieści się | T-26 |
| AC-7 samoczynne wyłączenie podążania | T-13 | AC-21 awaria partii nie ubija etapu | T-3 |
| AC-8 przerwa między pozycjami | T-14 | AC-22 tytuły po polsku | T-4 |
| AC-9 zapowiedź źródła bez powtórzeń | T-14 | AC-23 widoczny brak streszczenia | T-2, T-5 |
| AC-10 rozróżnialne wejścia | T-15 | AC-24 układ zakładki | T-18 |
| AC-11 wybór tematu przewija | T-24 | AC-25 odsiewanie propozycji | T-17 |
| AC-12 brak strzałek | T-25 | AC-26 dodana propozycja znika | T-17 |
| AC-13 zawsze wszystkie tematy | T-24 | AC-27 zarządzanie listami | T-18 |
| AC-14 chrom zajmuje jedno miejsce | T-21 | | |

## Ścieżka krytyczna

- `T-2 → T-3 → T-5` (kolumna musi istnieć, zanim ją odczytamy).
- `T-7 → T-9` (konfiguracja głosu przed rozstrzyganiem jego dostępności),
  `T-8 → T-10` (czujka przed komunikatem, który z niej korzysta),
  `T-11 → T-12` (pasek przebudowany, zanim karta przejmie podświetlenie).
- `T-20 → T-21 → T-22` (komponent → wpięcie → układ).
- `T-24 → T-26` (najpierw znika filtr, potem układamy to, co zostało).
- Równolegle: `T-5 ∥ T-4`, `T-14 ∥ T-15`, `T-25 ∥ T-24`.
- Wszystko → `T-29` → `T-30` → `T-31`, `T-32`.

## Notatki / blokady

- **T-9 i T-10 to miejsce najwyższego ryzyka.** Nie mam WebKita ani iPhone'a, więc naprawę weryfikuję
  przez podstawioną, milczącą syntezę w Chromium. Czujka z T-8 jest zaprojektowana tak, żeby działała
  **niezależnie od przyczyny** — właśnie dlatego, że przyczyny na docelowym urządzeniu nie zobaczę.
- **T-30 może zawrócić pipeline.** Jeśli pomiar pokaże poziome przewijanie przy 360 px, to jest
  niespełnione AC-17 — wracamy do T-26, a nie „zapisujemy jako drobiazg".
