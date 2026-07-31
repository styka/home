# Zadania: Wiadomości — przebudowa pobierania i UX + baza wiedzy o użytkowniku

- **Plan:** ./plan.md (039-wiadomosci-i-wiedza-o-userze)
- **Status:** todo
- **Data:** 2026-07-31

> **Zasada listy zadań:** kolejność od najłatwiejszego do najtrudniejszego i zgodna z zależnościami.
> Każde zadanie ≈ jeden commit, samodzielne i weryfikowalne.

## Legenda
- `[ ]` do zrobienia · `[x]` zrobione · `[~]` w trakcie · `[!]` zablokowane (patrz notatka)
- `[P]` — niezależne od poprzedniego, można robić równolegle

---

## Faza 0 — Rzeczy niezależne od przebudowy

- [x] **T-1** `[P]` — **Czytelny filtr źródeł.** „Wszystkie" dostaje licznik źródeł i podpis
      wyjaśniający, że pozostałe zakładki zawężają do jednego portalu.
      *Gotowe, gdy:* z samego ekranu widać, co robi ten przycisk. **(AC-20)**

- [x] **T-2** `[P]` — **`src/lib/textKey.ts` + test.** Przeniesienie `fingerprintOf` z
      `lib/weather/ideas.ts` (re-eksport, zero zmiany zachowania) — będzie używane w trzech miejscach.
      *Gotowe, gdy:* `npm run test:unit` przechodzi, a Pogoda działa bez zmian.

- [ ] **T-3** `[P]` — **`src/lib/speech/sentences.ts` + test.** `splitSentences(text)` dla polskiego:
      skróty („np.", „tzn.", „r.", „godz."), liczby z kropką i cudzysłowy nie kończą zdania.
      *Gotowe, gdy:* test pokrywa przypadki graniczne i przechodzi. **(podstawa AC-14..AC-16)**

## Faza 1 — Fundament danych

- [ ] **T-4** — **Migracja `0217_wiadomosci_pula_linia_czasu_wiedza_o_userze`.** DDL wg planu §2.6:
      `NewsArticle`, `NewsTimelineEntry`, `NewsHiddenTopic`, `UserFact`; `NewsItem.articleId`;
      `NewsPref.lastFetchedAt`; na końcu **`DROP TABLE "NewsKnowledge"`** z komentarzem o
      nieodwracalności i wskazaniem Neon PITR.
      *Gotowe, gdy:* `npm run check:migrations` przechodzi, `migrate deploy` na lokalnym Postgresie
      kończy się czysto. **(AC-11)**

- [ ] **T-5** — **`schema.prisma`** zgodnie z migracją: cztery nowe modele, dwie kolumny, relacje
      w `User` i `NewsSource`, **usunięcie `NewsKnowledge`**. Rodzaje jako `String` (C-12).
      *Gotowe, gdy:* `prisma generate` przechodzi, `migrate diff` bez rozjazdu dla nowych obiektów.

## Faza 2 — Warstwa serwera: pula i przebieg odświeżania

- [ ] **T-6** — **Handler `news.refresh` — etap pobrania puli.** Dla każdego włączonego źródła
      **jedno** `fetchRss`; zapis do `NewsArticle` z pominięciem duplikatów; próg czasu z
      `NewsPref.lastFetchedAt` (przy pierwszym uruchomieniu 24 h); ustawienie `lastFetchedAt` na końcu.
      *Gotowe, gdy:* liczba wywołań `fetchRss` = liczba źródeł, niezależnie od liczby tematów.
      **(AC-1, AC-4)**

- [ ] **T-7** — **Etap klasyfikacji.** Jedno wywołanie `op: "dispatch"` na porcję puli (~40 pozycji):
      tytuły + skróty × tematy z filtrami semantycznymi → mapa artykuł → tematy. Zapis jako `NewsItem`
      z `articleId`, bez streszczenia. **`truncated` i nieparsowalny JSON = błąd, nie pustka**
      (lekcja z 038).
      *Gotowe, gdy:* jedno wywołanie obsługuje wszystkie tematy naraz, a awaria jest jawna.
      **(AC-2, AC-12)**

- [ ] **T-8** — **Etap streszczeń i linii czasu.** Streszczenia w domyślnej długości (`generation`)
      dla nowych przypisań; linia czasu (`reasoning`) per temat — model dostaje nowe materiały i
      **istniejące pozycje z tego samego okresu**, zwraca wyłącznie brakujące fakty z datą zdarzenia
      i jej pewnością. Zapis z pominięciem duplikatów po `[topicId, fingerprint]`.
      *Gotowe, gdy:* daty pochodzą z treści, a powtórzona informacja nie tworzy drugiej pozycji.
      **(AC-8, AC-9, AC-10)**

- [ ] **T-9** — **Rejestracja zadania + raportowanie postępu.** `news.refresh` w `JOB_HANDLERS` i
      `ENQUEUABLE_TYPES`; każdy etap raportuje stan („Pobieram źródła (3/5)…").
      *Gotowe, gdy:* zadanie da się zakolejkować z klienta i widać jego etap. **(AC-5)**

- [ ] **T-10** — **Akcje modułu.** Usunięcie `refreshTopic`; `getHotTopics(force?)` z **puli** i przez
      pamięć treści (`news.hotTopics`); `hideHotTopic`/`unhideHotTopic`/`getHiddenTopics`;
      `getTopicTimeline`; `getTopicView` zwraca linię czasu.
      *Gotowe, gdy:* wejście na gorące tematy nie woła `fetchRss`. **(AC-3, AC-18, AC-19)**

## Faza 3 — UI Wiadomości

- [ ] **T-11** — **Przeniesiony „Odśwież" + pasek stanu przebiegu.** Przycisk w nagłówku modułu (bo
      odświeżenie dotyczy całego modułu, nie tematu); stan przebiegu odtwarzany **z kolejki** po
      powrocie na stronę; niepowodzenie pokazuje komunikat błędu, nie pustkę.
      *Gotowe, gdy:* zamknięcie i ponowne otwarcie strony pokazuje trwający przebieg albo jego wynik.
      **(AC-5, AC-6, AC-7)**

- [ ] **T-12** — **`NewsTimeline.tsx`** zastępuje `KnowledgePanel`: pozycje z datą, faktem i źródłem,
      od najnowszej; znacznik „data przybliżona" przy niepewnej dacie. Usunięcie `KnowledgePanel.tsx`.
      *Gotowe, gdy:* widok tematu pokazuje linię czasu, a stary panel nie istnieje. **(AC-8, AC-9)**

- [ ] **T-13** — **Gorące tematy: odrzucanie i przywracanie.** Przycisk „Nie proponuj" przy każdym
      temacie; `HiddenTopicsPanel.tsx` z przywracaniem do proponowanych **albo od razu do
      monitorowanych**.
      *Gotowe, gdy:* odrzucony temat nie wraca, a z listy odrzuconych da się go przywrócić na oba
      sposoby. **(AC-18, AC-19)**

## Faza 4 — Lektor

- [ ] **T-14** — **`NewsReader.tsx`.** Odtwarzanie zdanie po zdaniu przez istniejące
      `speak(text, "pl", { onEnd })`; podświetlenie bieżącego zdania + automatyczne przewinięcie do
      widoku; klik w zdanie = przeskok; sterowanie: wstecz/pauza-wznów/dalej/stop.
      *Gotowe, gdy:* odsłuch działa z głosem przeglądarki i serwerowym, a podświetlenie nadąża.
      **(AC-14, AC-15, AC-16)**

- [ ] **T-15** — **Lektor na telefonie.** Pasek sterowania przyklejony do dołu karty,
      `pb-[max(...,env(safe-area-inset-bottom))]`, cele `py-3`, nie zasłania czytanego tekstu.
      *Gotowe, gdy:* sterowanie jest osiągalne kciukiem i nie przykrywa treści. **(AC-17)**

## Faza 5 — Wiedza o użytkowniku

- [ ] **T-16** — **`src/actions/userFacts.ts`.** `getUserFacts`, `confirmUserFact`, `rejectUserFact`,
      `upsertUserFact`, `deleteUserFact`, `getPendingHypothesis`, akcje administratora
      (`module.admin`) oraz serwerowy helper **`buildUserContext(userId)`** (brak faktów → pusty
      string, nigdy błąd).
      *Gotowe, gdy:* odrzucony fakt nie wraca, a konto bez faktów działa bez zmian. **(AC-22..AC-25, AC-27)**

- [ ] **T-17** — **Handler `user.facts`.** Czyta zachowania (zapisane i zablokowane pomysły pogodowe,
      monitorowane tematy, odrzucone gorące tematy), jednym wywołaniem `reasoning` proponuje fakty z
      kategorią, pewnością i uzasadnieniem; odrzucone trafiają do promptu jako „nie proponuj ponownie".
      *Gotowe, gdy:* po użyciu aplikacji powstają fakty, których użytkownik nigdzie nie wpisywał.
      **(AC-21, AC-23)**

- [ ] **T-18** — **UI wiedzy o użytkowniku.** `UserFactsSection` w `/settings` (fakty w kategoriach,
      edycja, usuwanie), `UserFactHypothesisCard` (jedna karta, rzadko, przy okazji — nigdy jako
      przerywnik), `UserFactsPanel` dla administratora.
      *Gotowe, gdy:* użytkownik widzi, co aplikacja o nim wie, i poprawia to jednym dotknięciem.
      **(AC-22, AC-24, AC-25)**

- [ ] **T-19** — **Wpięcie w Pogodę.** Prompt propozycji korzysta z `buildUserContext` w miejsce
      dzisiejszej namiastki (`AssistantPref.instructions` + tytuły zapisanych pomysłów).
      *Gotowe, gdy:* propozycje uwzględniają fakty o użytkowniku, a brak faktów niczego nie psuje.
      **(AC-26, AC-27)**

## Faza 6 — Koszty, pamięć, manifesty

- [ ] **T-20** — **Licznik kosztu i pamięć treści.** Suma zużycia z etapów przebiegu pokazywana przy
      wyniku odświeżenia i przy gorących tematach; wpisy w `content-memory-coverage.json`,
      `cost-badge-coverage.json` i `action-coverage.json` dla wszystkich nowych plików i akcji.
      *Gotowe, gdy:* `check:cost-badge`, `check:content-memory` i `check:ai-coverage` przechodzą.
      **(AC-13)**

## Faza 7 — Domknięcie

- [ ] **T-21** — **Pełna sekwencja bramek na lokalnym Postgresie (C-13):** `copy-docs →
      check:actions → check:ai-coverage → check:cost-badge → check:content-memory →
      check:migrations → next lint → prisma generate → next build` + `npm run test:unit`.
      **Bez** `scripts/migrate.js`.
      *Gotowe, gdy:* wszystkie kroki zielone. **(C-50)**

- [ ] **T-22** — **Dokumentacja** — `CLAUDE.md`: moduł Wiadomości (nowy przebieg, linia czasu,
      lektor), schemat bazy (4 nowe modele, usunięty `NewsKnowledge`), lista Server Actions, nowy
      typ zadania w kolejce.
      *Gotowe, gdy:* dokumentacja opisuje stan po zmianie.

- [ ] **T-23** — **`doświadczenia.md` (C-51)** — wpisy o tym, co wyszło nieoczywistego (spodziewane:
      koszt pobierania per temat vs pula, podział zdań po polsku, odtwarzanie stanu zadania po
      przeładowaniu strony).

- [ ] **T-24** — **Mapowanie AC → wynik** jako wejście do `/verify`.

---

## Mapowanie kryteriów akceptacji na zadania

| AC | Zadanie(a) |
|---|---|
| AC-1 każde źródło pobierane raz | T-6 |
| AC-2 jeden przebieg klasyfikacji | T-7 |
| AC-3 gorące tematy z puli | T-10 |
| AC-4 pobieranie od poprzedniego razu | T-6 |
| AC-5 widoczny postęp | T-9, T-11 |
| AC-6 przebieg przeżywa zamknięcie strony | T-11 |
| AC-7 błąd zamiast pustki | T-7, T-11 |
| AC-8 linia czasu | T-8, T-12 |
| AC-9 data ze zdarzenia | T-8, T-12 |
| AC-10 brak dublowania | T-8 |
| AC-11 stara baza wiedzy usunięta | T-4, T-12 |
| AC-12 tania klasyfikacja, leniwe streszczenia | T-7 |
| AC-13 wskaźnik kosztu | T-20 |
| AC-14 sterowanie odsłuchem | T-3, T-14 |
| AC-15 podświetlenie zdania | T-14 |
| AC-16 klik w zdanie = przeskok | T-14 |
| AC-17 lektor na telefonie | T-15 |
| AC-18 odrzucanie gorących tematów | T-10, T-13 |
| AC-19 lista odrzuconych + przywracanie | T-10, T-13 |
| AC-20 czytelne „Wszystkie" | T-1 |
| AC-21 fakty z zachowań | T-17 |
| AC-22 potwierdzenie jednym dotknięciem | T-16, T-18 |
| AC-23 odrzucony nie wraca | T-16, T-17 |
| AC-24 przegląd i edycja w ustawieniach | T-16, T-18 |
| AC-25 wgląd administratora | T-16, T-18 |
| AC-26 Pogoda korzysta z faktów | T-19 |
| AC-27 brak faktów niczego nie blokuje | T-16, T-19 |

## Ścieżka krytyczna

`T-4/T-5` (dane) → `T-6` (pula) → `T-7` (klasyfikacja) → `T-8` (streszczenia i linia czasu) →
`T-9/T-10` (zadanie i akcje) → `T-11/T-12/T-13` (UI) → `T-21`.

Równolegle i bez zależności: `T-1`, `T-2`, `T-3` (idą pierwsze), `T-14`/`T-15` (lektor — potrzebuje
tylko `T-3`), `T-16`..`T-19` (wiedza o użytkowniku — potrzebuje tylko `T-4`/`T-5`).

`T-20` (manifesty) musi być **po** wszystkich nowych plikach wołających model, inaczej bramki od razu
świecą na czerwono.

## Notatki / blokady
- **T-4 zawiera jedyny nieodwracalny krok całej zmiany** (`DROP TABLE "NewsKnowledge"`). Wykonać
  świadomie, z komentarzem w migracji.
