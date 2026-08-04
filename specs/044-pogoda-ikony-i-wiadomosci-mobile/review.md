# Recenzja: Wierne ikony pogody „teraz" + strumień nowych wiadomości na telefonie

- **Spec:** ./spec.md · **Plan:** ./plan.md · **Weryfikacja:** ./verify.md
- **Data:** 2026-08-04
- **Diff:** `origin/develop...HEAD` — 16 plików, +2071 / −60 (z czego ~1000 to artefakty pipeline'u)

## Zakres recenzji

Recenzja świeżym okiem skupiona na kodzie produkcyjnym (11 plików w `worldofmag/src/`); artefakty
`specs/` i `doświadczenia.md` przejrzane pod kątem zgodności z tym, co realnie robi kod. Celowo **nie**
dublowałem tego, co pokrywa `verify.md` (mapowanie AC, wyniki bramek) — szukałem defektów, których
weryfikacja kryteriów akceptacji z definicji nie złapie, bo żadne AC ich nie opisuje.

---

## Ustalenia

### 1. `NewsReader.tsx` — dwa równocześnie grające lektory ucinały się nawzajem · **correctness** · ✅ NAPRAWIONE W RECENZJI

**Opis.** Nic nie gwarantowało, że w aplikacji gra najwyżej jeden lektor. Instancje `NewsReader`
siedzą w rozłącznych poddrzewach (karta wiadomości vs pasek strumienia), więc nie miały jak się
o sobie dowiedzieć.

**Scenariusz awarii.** Użytkownik włącza „Słuchaj wszystkiego" (lektor strumienia zaczyna czytać),
po czym dotyka „Słuchaj" na konkretnej karcie. Obie instancje mają `activeRef.current === true`.
`speak()` z `lib/tts` **przerywa poprzednią wypowiedź** (obie ścieżki wołają `cancel()`), więc nie
powstają dwa głosy naraz — powstaje **ping-pong**: przerwana wypowiedź odpala `onend`, łańcuch
drugiego lektora przechodzi do następnego zdania i przerywa pierwszy, ten odpala swój `onend`
i tak w kółko. Słychać kilkanaście urwanych sylab na przemian, aż użytkownik ręcznie zatrzyma jeden
z lektorów. Stan na ekranie (podświetlone zdanie) skacze jednocześnie w dwóch miejscach.

**Czy to regresja 044?** Defekt był **możliwy już wcześniej** (odsłuch otwarty na dwóch kartach
naraz), ale 044 stawia obok siebie trzy przyciski odsłuchu — strumienia, tematu i karty — więc
trafienie w niego przestaje być przypadkiem i staje się naturalną ścieżką użycia. `NewsStream`
pilnuje tylko, żeby nie grały równocześnie lektor **tematu** i **strumienia** (wspólny `ReaderScope`);
karta jest poza tym zasięgiem.

**Poprawka (naniesiona).** Modułowy rejestr jednego aktywnego lektora w `NewsReader.tsx`:
`claimSpeech(stop)` ucisza poprzedniego posiadacza przy starcie odtwarzania, `releaseSpeech(stop)`
zwalnia miejsce przy zatrzymaniu i odmontowaniu. Funkcja `silence()` (stabilna tożsamość przez
`useCallback`) jest zarazem kluczem w rejestrze i jedynym miejscem, które zeruje stan lektora —
przy okazji usunęła trzy kopie tej samej sekwencji „zatrzymaj i wyzeruj". Rejestr jest modułowy,
bo problem jest globalny; podnoszenie stanu do wspólnego rodzica wymagałoby kontekstu przez pół
drzewa komponentów (naruszenie C-53). Pauza świadomie **nie** zwalnia rejestru — wstrzymany lektor
nadal jest „tym jednym", dopóki ktoś inny go nie przejmie.

**Efekt uboczny poprawki (pozytywny).** Zamontowanie lektora karty nie ucisza już grającego lektora
strumienia „przy okazji" — `releaseSpeech` zwalnia wyłącznie własny wpis, więc efekt na `blocksKey`
nie kradnie miejsca cudzemu lektorowi przy pierwszym renderze.

---

### 2. `NewsPage.tsx` — wyścig przy szybkich, następujących po sobie odczytach strumienia · **correctness (drobne)** · ⚠️ ODNOTOWANE, ŚWIADOMIE NIEZMIENIONE

**Opis.** `loadStream()` nie unieważnia odpowiedzi w locie. Dwa szybkie wywołania (np. dwa
oznaczenia „Przeczytane" pod rząd) mogą wrócić w odwrotnej kolejności i starsza odpowiedź nadpisze
nowszą.

**Scenariusz.** Użytkownik oznacza dwie pozycje w odstępie ułamka sekundy przy wolnym łączu; przez
moment lista pokazuje stan sprzed drugiego oznaczenia. Samoczynnie naprawia się przy następnym
odczycie (kolejna akcja, odświeżenie, powrót na stronę), a dane w bazie są poprawne — to defekt
wyłącznie prezentacyjny i przejściowy.

**Dlaczego nie zmieniam.** Dokładnie ten sam wzorzec ma istniejący `loadView` (od 040) i wszystkie
pozostałe odczyty w tym module. Naprawianie go **tylko** dla strumienia dołożyłoby drugi wzorzec
obok utartego, co łamie C-53 („zgodność ze stylem otoczenia > osobiste preferencje") i zostawiłoby
niespójność gorszą niż sam defekt. To kandydat na osobną, jednolitą zmianę w całym module —
odnotowany tutaj, żeby nie zginął.

---

### 3. `NewsStream.tsx:116` — wyłączona reguła `exhaustive-deps` · **convention** · ✅ UZASADNIONE

**Opis.** Efekt tworzący `IntersectionObserver` ma `// eslint-disable-line react-hooks/exhaustive-deps`
i zależność `topicOrder.join(",")` zamiast `topicOrder`.

**Ocena — nie jest to defekt.** `topicOrder` to tablica przeliczana przy każdym renderze, więc jako
zależność powodowałaby odtwarzanie obserwatora w kółko. Sprowadzenie jej do **wartości** (string)
jest tu poprawnym rozwiązaniem, a nie obejściem: efekt ma się przeliczyć dokładnie wtedy, gdy zmieni
się zestaw sekcji. Repozytorium stosuje ten sam zabieg w kilku miejscach (`WeatherPage.tsx:74`,
`NewsPage`), więc jest to konwencja panująca, nie wyjątek. Komentarz nad linią wyjaśnia powód.

---

### 4. Kontrola dostępu przy akcjach zbiorczych · **security** · ✅ POPRAWNE

Sprawdzone celowo, bo to najbardziej ryzykowna część diffu — akcja masowa, która przy błędzie
guardu dotknęłaby cudzych danych.

- `acknowledgeTopicItems` — `assertTopic(topicId, user.id)` **przed** zapisem; rzuca, zanim
  `updateMany` w ogóle wystartuje.
- `acknowledgeAllItems` — filtr `topic: { ownerId: user.id }` jest **częścią zapytania**, nie
  sprawdzeniem po odczycie. To jedyne poprawne podejście przy `updateMany`, bo nie ma tam etapu,
  na którym dałoby się odsiać cudze wiersze — i tak to zostało zrobione.
- `getStreamView` — `where: { ownerId: user.id }` na tematach, pozycje wyłącznie przez relację.

Żadna akcja zbiorcza nie jest szerszym wektorem niż istniejąca akcja pojedyncza (C-21). Obie mutacje
kończą się `revalidatePath("/wiadomosci")` (C-20). Bramka `check:ai-coverage` potwierdza guard
w ciele każdej z nich.

---

### 5. Korekta ikony pogody — kierunek błędu · **correctness** · ✅ POPRAWNE

Reguła w `observedWmo` jest **wąska w bezpieczną stronę**, co przy zmianie dotykającej pierwszego
kafelka modułu jest właściwym wyborem:
- kody `>= 51` nietykane — burza nie zostanie spłaszczona do „deszczu" (nie gubimy ostrzeżenia);
- próg `0.1 mm` odcina ślad opadu — brak fałszywego deszczu przy suchym chodniku;
- brak danych (`null`) degraduje do zachowania sprzed zmiany.

Najgorszy możliwy skutek błędu w tej funkcji to **brak korekty** (czyli stan sprzed 044), nigdy
fałszywy opad. Osobno warte odnotowania: pola opadu są `number | null`, a nie `number` z `?? 0` —
to nie kosmetyka, `?? 0` wyłączałoby korektę tak samo jak zmierzona susza i cicho przywracało
pierwotny błąd.

---

### 6. Duplikacja usunięta, nie dołożona · **simplification** · ✅ POPRAWNE

Diff **zmniejsza** duplikację mimo dodania funkcji:
- mapowanie pozycji na DTO wyjęte do `toItemDTO` (dwóch konsumentów zamiast dwóch kopii);
- filtr źródeł miał zostać zduplikowany w obu trybach — zamiast tego przeniesiony **nad**
  przełącznik jako jedna kopia wspólna;
- lektor **uogólniony** na listę bloków zamiast napisania drugiego komponentu; przy jednym bloku
  UI jest identyczne jak przed zmianą, więc trzy poziomy odsłuchu kosztowały jeden komponent, nie cztery;
- poprawka z pkt. 1 skasowała trzy kopie sekwencji „zatrzymaj i wyzeruj stan".

Zero nowych zależności — gest w bok na `onTouchStart/End` wzorem `TaskRow`, przyklejony nagłówek
natywnym `sticky`, obserwacja przewijania przez `IntersectionObserver`.

---

## Sprawdzone i czyste (bez ustaleń)

| Obszar | Wynik |
|---|---|
| **C-12** — brak enumów Prisma | ✅ `PrecipKind`, `BrowseMode`, `ReaderScope` jako union TS |
| **C-30** — kolory z zmiennych CSS | ✅ zero literałów `#rrggbb` w nowych plikach |
| **C-31** — mobile | ✅ brak `hidden md:*` w `NewsStream`; `env(safe-area-inset-bottom)` zachowane; gest bez `preventDefault` |
| **C-32** — teksty PL | ✅ łącznie z zapowiedzią lektora „Temat: …" |
| **C-10/C-11** — migracje | ✅ brak zmian schematu; `check:migrations` zielone |
| **C-23** — `AIAction` | ✅ brak nowych; trzy akcje zadeklarowane w manifeście |
| **XSS** | ✅ brak nowego renderowania HTML; tytuły tematów i wiadomości jako tekst |
| **C-41** — klucze API | ✅ nie dotyczy, diff ich nie tyka |
| **Regresje w module Pogoda** | ✅ `ForecastDays` celowo na `wmo(d.code)`; digesty czujek i asystenta na wspólnej funkcji |

## Bramki po poprawce recenzenckiej

| Bramka | Wynik |
|---|---|
| `npx tsc --noEmit` | ✅ czysto |
| `npx next lint --dir src` | ✅ zero zastrzeżeń w plikach 044 |
| `npm run test:unit` | ✅ 599 / 599, 0 fail |
| `npx next build` | ✅ `Compiled successfully`, 134/134 stron |

---

## Werdykt: **APPROVE Z UWAGAMI**

Zmiana jest poprawna, minimalna i zgodna z konwencjami repozytorium. Oba zgłoszenia właściciela są
zrealizowane u źródła, a nie objawowo: ikona pogody dostała **brakujące dane wejściowe** (a nie
łatkę na mapowaniu), a wiadomości dostały **jeden strumień z dwukierunkową nawigacją** (a nie
kolejny przełącznik). Diff zmniejsza duplikację mimo rozrostu funkcjonalności.

**Jedno ustalenie naprawione w trakcie recenzji** (pkt 1 — wzajemnie ucinające się lektory);
poprawka jest niewielka, samodzielna i przeszła pełen zestaw bramek.

**Uwaga przeniesiona dalej** (pkt 2): brak unieważniania odpowiedzi w locie przy odczytach w module
Wiadomości. Defekt przejściowy i wyłącznie prezentacyjny, obecny w tym module od 040 — świadomie
**nie** naprawiany punktowo, bo dołożyłby drugi wzorzec obok utartego. Nadaje się na osobną,
jednolitą zmianę w całym module.

**Do obejrzenia na środowisku testowym** (zgodnie z ograniczeniami z `verify.md`): płynność gestu
w bok na fizycznym telefonie oraz zachowanie przyklejonego nagłówka przy szybkim przewijaniu — to
zachowania, których nie da się zmierzyć analizą statyczną.
