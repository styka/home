# Plan techniczny: Lektor, pasek widoku i domknięcie listy z przebiegu 083

- **Spec:** ./spec.md (084-lektor-pasek-i-domkniecie-083)
- **Status:** draft
- **Data:** 2026-08-23

## 1. Podejście

Siedem obszarów, ale trzy rozłączne warstwy — i tak je realizujemy: **mowa** (`lib/tts` + lektor),
**rama widoku** (`ViewBar`, dotyczy wszystkich modułów) i **moduł Wiadomości** (nawigacja, gorące
tematy, zadanie odświeżania). Kolejność jak w specu: najpierw dług z 083, potem usterki z testów.

Wzorcem jest sam moduł Wiadomości po przebiegu 083 — `sekcjeTematow.tsx` (wspólny nagłówek
i obserwator sekcji), `SourceFilter` (kontrolka o stałej wysokości + `AnchoredLayer`) oraz
`GroupNavigator`. Nie wprowadzamy nowych wzorców: menu chromu to ten sam układ „jeden przycisk +
warstwa nad treścią", co filtr portali.

**Diagnoza usterki lektora jest zrobiona i jest sednem planu** — patrz §3.

## 2. Model danych (Prisma)

Jedna kolumna, wyłącznie pod AC-23.

- **`NewsItem.summaryFailed Boolean @default(false)`** — znacznik „mimo ponowień nie udało się
  streścić". Dziś taka pozycja zostaje z surowym opisem z kanału i **wygląda na kompletną**;
  użytkownik nie ma jak odróżnić streszczenia od zaciągniętego skrótu RSS.
  - Dlaczego kolumna, a nie wyliczenie: „czy to streszczenie" nie da się orzec z treści (opis
    z kanału bywa zdaniem, streszczenie też). Porównywanie z oryginałem wymagałoby trzymania
    oryginału — czyli i tak kolumny, tylko większej.
  - `Boolean`, nie status tekstowy — to jest fakt dwustanowy, a nie rodzaj (C-12 dotyczy statusów
    i rodzajów; tu union nie miałby czego wyrażać).

- **Migracja (C-10, C-11):** numer z `npm run next:migration` = **0256**,
  katalog `prisma/migrations/0256_news_item_summary_failed/migration.sql`:
  ```sql
  ALTER TABLE "NewsItem" ADD COLUMN IF NOT EXISTS "summaryFailed" BOOLEAN NOT NULL DEFAULT false;
  ```
  Idempotentnie (`IF NOT EXISTS`). Zsynchronizować `schema.prisma`, potem `npm run check:migrations`
  i `npm run check:schema-drift` na **lokalnym** Postgresie (C-13).

Poza tym **bez zmian w schemacie**. Ustawienia lektora (`readerRate`, `readerFollow`) i odrzucone
tematy (`NewsHiddenTopic`) już istnieją.

## 3. Mowa — diagnoza i naprawa (AC-1..AC-3)

Rekonesans dał **trzy współdziałające przyczyny**, nie jedną. To wyjaśnia, dlaczego objaw jest
niestabilny („czasem działa") i dlaczego zatrzask z 080 go nie złapał.

**Przyczyna 1 — lektor Wiadomości nigdy nie konfiguruje własnego głosu.** `setServerVoiceId()` woła
**wyłącznie** `AICommandSheet` (asystent). `serverVoiceId` to zmienna modułowa w `lib/tts.ts`, więc
lektor Wiadomości dziedziczy ją przypadkiem: jeśli użytkownik otworzył wcześniej asystenta, lektor
idzie głosem serwerowym; jeśli nie — przeglądarką. Nikt tego nie zaprojektował, tak wyszło.

**Przyczyna 2 — łańcuch zamiera przy cichym odrzuceniu przez WebKit.** `speakViaBrowser` ustawia
`u.onend`/`u.onerror`, ale iOS wywołane **poza gestem** `speechSynthesis.speak()` odrzuca **bez
żadnego zdarzenia**. Wtedy `onEnd` nie przychodzi nigdy → `playFrom` nie idzie dalej → interfejs
pokazuje „wiadomość 1/10 · zdanie 2/4", a jest cisza. Dokładnie to zgłosił właściciel.

**Przyczyna 3 — zatrzask z 080 ratuje dopiero DRUGIE zdanie, którego nie będzie.** Pierwsze zdanie
idzie przez `speakViaServer` (asynchronicznie, bo zatrzask jeszcze nie zapadł). Gdy serwer odmówi,
`speakViaBrowser` startuje już po `await fetch` — poza gestem, czyli w warunkach przyczyny 2.
Zatrzask zapada, ale kolejne zdanie nigdy nie nadchodzi, bo łańcuch stoi na pierwszym.

**Naprawa — dwie warstwy, obie w `lib/tts.ts` plus konfiguracja w lektorze:**

1. **Lektor konfiguruje głos sam** (`NewsReader`): przy montowaniu czyta `getSpeechOptions()`
   z `actions/assistantPrefs` i woła `setServerVoiceId(...)` — tak samo jak asystent. Koniec
   dziedziczenia stanu po cudzym komponencie.
2. **Wstępne rozstrzygnięcie dostępności, PRZED pierwszym dotknięciem.** Gdy głos serwerowy jest
   ustawiony, lektor przy montowaniu pyta `/api/tts` o gotowość (lekkie zapytanie, bez syntezy).
   Odmowa → `zatrzasnijGlosSerwerowy()` zapada **zanim** użytkownik dotknie „słuchaj", więc pierwsze
   zdanie idzie przeglądarką **synchronicznie w geście** i gra. To realizuje AC-1 dla najczęstszego
   przypadku: TTS nieskonfigurowany albo trwale niedostępny.
3. **Czujka ciszy** (`speak` w `lib/tts.ts`): po starcie wypowiedzi ustawiamy licznik czasu. Jeśli
   w ~1,5 s nie przyjdzie ani `onstart`, ani `onend`, uznajemy, że **nie gra**, i wołamy nowe
   wywołanie zwrotne `onSilent`. To zamyka przyczynę 2 niezależnie od jej źródła — także takiego,
   którego nie przewidzieliśmy. AC-2 stoi na tej czujce.
4. **Komunikat zamiast udawania.** Gdy czujka zadziała, lektor przestaje pokazywać „leci", wyświetla,
   **co** nie zadziałało, i daje przycisk „Odtwórz ponownie". Kliknięcie **jest gestem**, a zatrzask
   już zapadł, więc ponowienie idzie przeglądarką synchronicznie — i gra. To jest realne wyjście
   z sytuacji na iOS, nie komunikat pocieszający.

**Czego ta naprawa nie obiecuje:** nie mam prawdziwego iPhone'a ani WebKita w środowisku pracy
(polityka sieci blokuje pobranie). Mechanizm sprawdzę w Chromium symulując odrzucenie syntezy;
**ostateczne potwierdzenie należy do właściciela na jego telefonie** i tak to zaraportuję.

## 4. Lektor — UX odsłuchu (AC-4..AC-10)

- **Przyklejenie do dołu (AC-4):** `NewsReader` dzieli się na dwa kawałki — **pasek sterowania**
  (`position: sticky; bottom: 0`, w ramie widoku, z `env(safe-area-inset-bottom)`) i **nic więcej**.
  Lista zdań w pudełku **znika** (AC-5).
- **Podświetlenie w karcie (AC-5):** `NewsItemCard` dostaje opcjonalne `czytaneZdanie?: string`
  i podświetla pasujący fragment streszczenia. Dopasowanie po **treści zdania**, nie po indeksie:
  lektor i karta dzielą ten sam podział na zdania (`lib/speech/sentences`), więc porównanie tekstu
  jest jednoznaczne, a indeks wymagałby przekazywania obu list i utrzymywania ich zgodności.
  Kolor podświetlenia wyłącznie zmienną CSS (C-30).
- **Przełącznik podążania przy wiadomościach (AC-6):** ikona celownika (`Crosshair`, już używana
  w lektorze) w pasku sterowania **oraz** w nagłówku sekcji tematu — bo tam użytkownik patrzy,
  gdy czyta. Jeden stan (`readerFollow` w `AssistantPref`), dwa wejścia — nie dwa stany.
- **Automatyczne wyłączenie podążania (AC-7):** nasłuch `scroll` na ramie widoku; przewinięcie
  **niepochodzące** od lektora (rozróżniamy strażnikiem czasu, tym samym co w `sekcjeTematow`)
  gasi `follow`. Zapis do preferencji w tle.
- **Przerwa między pozycjami (AC-8):** w `playFrom`, gdy następne zdanie należy do innego bloku,
  odczekujemy stałe ~400 ms przed `speak`. Bez ustawienia dla użytkownika (C-53).
- **Zapowiedź źródła bez powtórzeń (AC-9):** `ReaderBlock` dostaje `zrodlo?: string`; budowanie
  zdań w `NewsStream` wstawia zapowiedź tylko wtedy, gdy źródło **różni się** od źródła poprzedniego
  bloku. Mechanizm jest bliźniaczy do istniejącego `lead` („Temat: …") — reużywamy go, nie
  dokładamy drugiego.
- **Rozróżnialne wejścia (AC-10):** „Słuchaj wszystkiego" i „Oznacz wszystkie" przestają być dwoma
  sąsiadującymi przyciskami tekstowymi tej samej wagi: odsłuch dostaje wariant `primary`
  z ikoną, oznaczanie zostaje przyciskiem tekstowym, a między nimi stoi separator.

## 5. Nawigacja po tematach (AC-11..AC-13)

- `NewsPage`: klucz `temat` **znika** z `useViewState`. Zostają `widok`, `tresc`, `zrodla`.
- `wybierzTemat(id)` → wyłącznie `przewinDo(id)`. Znika filtrowanie `pasujeTemat`,
  `widoczneWiadomosci`/`widocznaOs` przestają zależeć od tematu.
- `GroupNavigator` w Wiadomościach dostaje `onSasiad={undefined}` → strzałki nie renderują się
  (AC-12). **Prop zostaje w komponencie** — jest wspólny i inny konsument może chcieć strzałek;
  usuwanie go byłoby zawężeniem wspólnego komponentu pod jednego użytkownika.
- Wyzwalacz listy pokazuje **stałą etykietę „Tematy"** + ikonę, nie nazwę (patrz korekta AC-18
  w specu). Nazwa tematu, przy którym jesteś, zostaje w przyklejonym nagłówku sekcji.
- `pozycjaWszystkie`/`WSZYSTKIE` w tym module przestaje mieć sens (nie ma filtru) — nie podajemy
  `etykietaWszystkich`. Sama stała i obsługa w `GroupNavigator` zostają dla innych konsumentów.

## 6. Rama widoku — menu chromu (AC-14..AC-16) i telefon (AC-17..AC-20)

**To jest zmiana w `ViewBar`, czyli w RAMIE — obejmuje wszystkie 22 widoki naraz (C-33).**

- Nowy `src/components/ui/view/ViewChromeMenu.tsx`: przycisk `MoreHorizontal` + `AnchoredLayer`
  z trzema pozycjami (gwiazdka, świeżość, skróty). `ViewBar` renderuje **menu** zamiast rzędu
  trzech elementów. Elementy chromu przychodzą jak dotąd z `ViewChromeProvider` — kontrakt się nie
  zmienia, zmienia się tylko miejsce, w którym je rysujemy.
- **Telefon — dwa wiersze (decyzja właściciela):** `ViewBar` w wariancie `compact` układa się
  `flex-col md:flex-row`: na wąskim ekranie wiersz pierwszy to tytuł + akcje + menu chromu, wiersz
  drugi to `filters` z własnym `overflow-x: auto`. Na komputerze bez zmian — jeden wiersz.
- **Zero poziomego przewijania strony (AC-17):** warunkiem jest `min-w-0` na każdym elastycznym
  przodku i `overflow-x` **wyłącznie** na kontenerze filtrów. To już jest w `ViewBar`; usterka
  bierze się z modułu — pasek Wiadomości ma `flex` bez `min-w-0` i `flex-wrap`. Poprawiamy tam.
- Pasek Wiadomości: nawigator + filtr portali + przełącznik treści w jednym wierszu z `min-w-0`,
  a przy braku miejsca przełącznik treści zwija się do **ikon** (`Newspaper` / `CalendarClock`)
  z `aria-label` — to daje AC-20 bez chowania funkcji.

## 7. Gorące tematy (AC-24..AC-27)

- `HotTopics` dostaje układ z `NaglowekSekcji` (już wpięty w 083) i **dwie listy pod jednym
  panelem**: „Monitorowane" i „Odrzucone", obie zwijane, obie z akcją odwrotną (przestań
  monitorować / przywróć).
- **Odsiewanie propozycji (AC-25):** w `getHotTopics` — po zbudowaniu listy przez model odfiltrowujemy
  te, których **odcisk tytułu** pokrywa się z odciskiem tematu monitorowanego albo odrzuconego.
  Odcisk liczy istniejąca funkcja używana dziś dla `NewsHiddenTopic` — reużywamy ją, nie piszemy
  drugiej reguły podobieństwa.
- **Dodanie propozycji przenosi ją (AC-26):** po `createTopic` z propozycji odświeżamy listę; skoro
  odsiewanie działa na monitorowanych, propozycja znika sama. Nie dokładamy osobnego stanu
  „przeniesione" — to byłby drugi nośnik tej samej informacji.

## 8. Zadanie odświeżania (AC-21..AC-23)

- **Awaria partii nie ubija etapu (AC-21):** w `summarizeItems` pętla po partiach dostaje `try/catch`
  wokół `llmJson`. Wyjątek → partia trafia do następnego podejścia (mechanizm z 080 już to obsługuje
  dla pominiętych pozycji), a nie przerywa całego etapu. Po wyczerpaniu podejść pozycje bez
  streszczenia dostają `summaryFailed = true`.
- **Tłumaczenie tytułów (AC-22):** rozszerzamy istniejący prompt streszczeń o pole `title` w JSON —
  „przetłumacz tytuł na polski; jeśli już jest po polsku, przepisz bez zmian". **W tym samym
  wywołaniu**, bo osobne podwoiłoby liczbę zapytań przy zerowym zysku (założenie ze specu).
- **Widoczny brak streszczenia (AC-23):** `NewsItemCard` przy `summaryFailed` pokazuje dyskretny
  znacznik „bez streszczenia — pokazujemy skrót ze źródła" (tekst przez `t()`).

## 9. Server Actions (C-20) i RBAC (C-22)

- **Bez nowych akcji mutujących.** Zmiany dotykają: `getHotTopics` (odsiewanie — odczyt),
  `hideHotTopic`/`unhideHotTopic` (istnieją), `createTopic`/`deleteTopic` (istnieją),
  `getSpeechOptions` (istnieje, odczyt), `updateAssistantPrefs` (istnieje).
- `revalidatePath("/wiadomosci")` już jest w mutacjach tematów — nic nie dokładamy.
- **RBAC bez zmian:** `module.news`. Zmiana `ViewBar` nie dotyka uprawnień.
- **Własność:** bez zmian. `summaryFailed` należy do `NewsItem`, który już żyje w przestrzeni.

## 10. AI / integracje

- **Bez nowych `AIAction`** — `check:actions` nie ma czego sprawdzać.
- Prompt streszczeń rośnie o tytuł, więc `check:cost-badge` i `check:content-memory` pozostają
  spełnione bez zmian (to samo wywołanie, ten sam sink zużycia).

## 11. Pliki do utworzenia / zmiany

| Plik | Akcja | Po co |
|------|-------|-------|
| `prisma/schema.prisma` + `prisma/migrations/0256_news_item_summary_failed/migration.sql` | nowy | AC-23 |
| `src/lib/tts.ts` | edycja | czujka ciszy, `onSilent`, gotowość głosu serwerowego (AC-1..AC-3) |
| `src/modules/news/ui/NewsReader.tsx` | przepisanie | pasek przyklejony do dołu, bez listy zdań, komunikat + ponowienie, własna konfiguracja głosu (AC-1..AC-10) |
| `src/modules/news/ui/NewsItemCard.tsx` | edycja | podświetlenie czytanego zdania, znacznik braku streszczenia (AC-5, AC-23) |
| `src/modules/news/ui/NewsStream.tsx` | edycja | zapowiedź źródła bez powtórzeń, przekazanie czytanego zdania do kart, rozróżnienie wejść (AC-9, AC-10, AC-5) |
| `src/modules/news/ui/sekcjeTematow.tsx` | edycja | przełącznik podążania w nagłówku sekcji, wykrycie ręcznego przewinięcia (AC-6, AC-7) |
| `src/modules/news/ui/NewsPage.tsx` | edycja | usunięcie filtru tematu, strzałek, układ paska na telefonie (AC-11..AC-13, AC-17..AC-20) |
| `src/modules/news/ui/HotTopics.tsx` | edycja | zarządzanie monitorowanymi i odrzuconymi (AC-24, AC-27) |
| `src/modules/news/actions/news.ts` | edycja | odsiewanie propozycji (AC-25, AC-26) |
| `src/modules/news/jobs/newsRefresh.ts` | edycja | odporność partii, tłumaczenie tytułów, `summaryFailed` (AC-21..AC-23) |
| `src/components/ui/view/ViewChromeMenu.tsx` | nowy | menu chromu (AC-14, AC-15) |
| `src/components/ui/view/ViewBar.tsx` | edycja | menu zamiast rzędu, dwa wiersze na telefonie (AC-14..AC-16, AC-19) |
| `messages/pl.json` | edycja | teksty (C-32) |
| `e2e/specs/news-czytnik.spec.ts` | nowy | AC-2, AC-4, AC-5 |
| `e2e/specs/pasek-widoku-mobile.spec.ts` | nowy | AC-17..AC-20 (pomiar szerokości dokumentu) |

## 12. Bramki i weryfikacja (C-50)

Lokalny Postgres (`omnia_dev`), **nigdy prod** (C-13). `npm run check:migrations`,
`check:schema-drift`, `check:i18n`, `check:ui-contract`, `check:pagination`, `check:boundaries`,
komplet pozostałych, `tsc` ×2, `next lint`, `next build`, testy jednostkowe, klikacz.

| AC | Jak sprawdzimy |
|----|----------------|
| AC-1, AC-3 | test jednostkowy `lib/tts`: przy niedostępnym głosie serwerowym pierwsze `speak` idzie ścieżką przeglądarki **synchronicznie** |
| AC-2 | klikacz: podstawiamy syntezę, która nic nie robi → interfejs pokazuje komunikat, nie „leci" |
| AC-4, AC-5 | klikacz: pasek lektora ma `position: sticky`; w drzewie **nie ma** listy zdań lektora |
| AC-6..AC-10 | test jednostkowy budowania zdań (zapowiedź źródła, przerwa) + oględziny w przeglądarce |
| AC-11..AC-13 | klikacz: po wyborze tematu liczba sekcji na stronie **się nie zmienia**, a `scrollTop` rośnie |
| AC-14..AC-16 | pomiar w przeglądarce: liczba elementów chromu w pasku = 1; szerokość kontenera filtrów przed/po |
| AC-17 | pomiar: `document.documentElement.scrollWidth <= clientWidth` przy 360 px, przed i po przewinięciu |
| AC-18..AC-20 | pomiar szerokości wyzwalacza i widoczności zakładek przy 360 px |
| AC-21 | test jednostkowy: `llmJson` rzuca na jednej partii → pozostałe partie i tak zostają streszczone |
| AC-22 | test jednostkowy kształtu odpowiedzi (tytuł w JSON) + oględziny |
| AC-23 | klikacz: pozycja z `summaryFailed` ma widoczny znacznik |
| AC-24..AC-27 | klikacz + oględziny: propozycja pokryta monitorowanym tematem nie pojawia się na liście |

## 13. Ryzyka techniczne i wycofanie

- **Brak WebKita/iPhone'a.** Nie potwierdzę naprawy na docelowym urządzeniu. *Mitygacja:* czujka
  ciszy (AC-2) czyni ciszę bez komunikatu niemożliwą **niezależnie od przyczyny**; raportuję wprost,
  czego nie zmierzyłem.
- **Zmiana `ViewBar` dotyka 22 widoków.** *Mitygacja:* jedno miejsce, pełny klikacz jako warunek
  domknięcia, `check:ui-contract` w bramkach.
- **Przepisanie `NewsReader` może zgubić zachowanie z 080/Z12** (prędkość, podążanie, jeden lektor
  naraz). *Mitygacja:* to są cztery konkretne mechanizmy — wypisane w §4 i przenoszone świadomie,
  a nie „przy okazji". Rejestr `claimSpeech` zostaje nietknięty.
- **Rollback:** migracja 0256 jest addytywna (`ADD COLUMN … DEFAULT false`) — kod da się cofnąć bez
  ruszania bazy; kolumna nieużywana nikomu nie przeszkadza.

## 14. Zgodność z konstytucją — checklista

- [x] **C-10..C-13** — jedna migracja addytywna, numer 0256 z narzędzia, weryfikacja na lokalnym Postgresie.
- [x] **C-12** — `summaryFailed` to `Boolean` (fakt dwustanowy), nie enum i nie status.
- [x] **C-20/C-21** — bez nowych mutacji; istniejące zachowują `revalidatePath` i guardy.
- [x] **C-22** — RBAC bez zmian.
- [x] **C-23** — bez nowych `AIAction`.
- [x] **C-30** — podświetlenie czytanego zdania i znacznik braku streszczenia wyłącznie zmiennymi CSS.
- [x] **C-31** — brak poziomego przewijania strony to twarde kryterium (AC-17); pasek lektora
      respektuje `env(safe-area-inset-bottom)`; cele dotyku `py-3`.
- [x] **C-32** — wszystkie nowe teksty przez `t()`.
- [x] **C-33** — menu chromu i dwa wiersze na telefonie **poszerzają ramę**, nie robią wyjątku w module.
- [x] **C-35** — `ViewChromeMenu` powstaje razem ze swoim jedynym konsumentem (`ViewBar`).
- [x] **C-53** — nie usuwamy `onSasiad`/`WSZYSTKIE` z komponentu wspólnego (inny konsument może ich
      chcieć), nie dokładamy stanu „przeniesione" w gorących tematach, nie dajemy ustawienia dla
      długości przerwy między pozycjami.
- [x] **C-54** — dwie korekty speca zapisane w nim na miejscu (AC-18, AC-21).
