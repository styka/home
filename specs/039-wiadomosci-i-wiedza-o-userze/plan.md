# Plan techniczny: Wiadomości — przebudowa pobierania i UX + baza wiedzy o użytkowniku

- **Spec:** ./spec.md (039-wiadomosci-i-wiedza-o-userze)
- **Status:** draft
- **Data:** 2026-07-31

> **Zasada planu:** to jest **JAK**. Trzy istniejące mechanizmy przekrojowe są tu fundamentem i
> **nie budujemy niczego, co już mamy**: kolejka zadań w tle (`lib/jobs/*`, wzorzec `magazyn.insights`),
> pamięć treści z 038 (`lib/ai/contentMemory.ts`), licznik kosztu z 037 (`lib/ai/usage.ts`).

## 1. Podejście

**(A) Rozdzielenie „pobrania" od „analizy".** Dzisiejszy `refreshTopic(topicId)` robi obie rzeczy
naraz i **per temat**, więc RSS leci raz na temat i raz na źródło, a `getHotTopics` pobiera wszystko
jeszcze raz. Po zmianie: jeden przebieg **pobiera każde źródło raz do wspólnej puli**, potem jednym
tanim wywołaniem przypisuje pulę do tematów, i dopiero na końcu streszcza.

**(B) Przebieg idzie przez kolejkę zadań** — to rozwiązuje zgłoszenie 3 (znikający wskaźnik) bez
pisania czegokolwiek nowego: kolejka ma już trwały stan, odpytywanie i obsługę błędu.

**(C) Linia czasu zastępuje wersjonowaną wiedzę**, a stara tabela **znika** (decyzja właściciela).

**(D) Wiedza o użytkowniku** to nowy, mały mechanizm przekrojowy w schemacie sprawdzonym dwa razy
(037, 038): jeden model + jeden helper + jedno realne wpięcie.

## 2. Model danych (Prisma)

### 2.1 `NewsArticle` — wspólna pula materiału (nowy)

```prisma
model NewsArticle {
  id       String @id @default(cuid())
  ownerId  String
  sourceId String
  url      String
  title    String
  // Skrót z kanału RSS — materiał wejściowy do klasyfikacji i streszczeń.
  description String @default("")
  imageUrl    String?
  // Data publikacji wg kanału.
  publishedAt DateTime
  fetchedAt   DateTime @default(now())

  owner  User       @relation("OwnedNewsArticles", fields: [ownerId], references: [id], onDelete: Cascade)
  source NewsSource @relation(fields: [sourceId], references: [id], onDelete: Cascade)
  items  NewsItem[]

  @@unique([ownerId, sourceId, url])
  @@index([ownerId, publishedAt])
}
```

**Dlaczego pula, a nie dotychczasowe dublowanie:** dziś ten sam artykuł jest zapisywany osobno dla
każdego tematu (`NewsItem` z kluczem `[topicId, sourceId, url]`), a kanał pobierany raz na temat.
Pula rozcina to na dwa etapy i jest **warunkiem koniecznym** dla AC-1, AC-2 i AC-3 — bez niej gorące
tematy nie mają z czego korzystać po zakończeniu odświeżania.

### 2.2 `NewsTimelineEntry` — linia czasu tematu (nowy)

```prisma
model NewsTimelineEntry {
  id      String @id @default(cuid())
  topicId String
  // Data ZDARZENIA z treści materiału, nie data pobrania (AC-9).
  eventDate DateTime
  // "exact" | "approx" | "published" — skąd wzięliśmy datę (String + union, C-12).
  dateConfidence String @default("published")
  // Jedno zdanie suchego faktu.
  fact String
  // Odcisk faktu — zapora przed dublowaniem tej samej informacji (AC-10).
  fingerprint String
  sourceId  String?
  articleId String?
  createdAt DateTime @default(now())

  topic  NewsTopic    @relation(fields: [topicId], references: [id], onDelete: Cascade)
  source NewsSource?  @relation(fields: [sourceId], references: [id], onDelete: SetNull)

  @@unique([topicId, fingerprint])
  @@index([topicId, eventDate])
}
```

### 2.3 `NewsHiddenTopic` — odrzucone gorące tematy (nowy)

```prisma
model NewsHiddenTopic {
  id          String   @id @default(cuid())
  ownerId     String
  fingerprint String
  title       String
  createdAt   DateTime @default(now())

  owner User @relation("OwnedNewsHiddenTopics", fields: [ownerId], references: [id], onDelete: Cascade)

  @@unique([ownerId, fingerprint])
}
```

Odcisk liczymy tą samą funkcją co w Pogodzie (`fingerprintOf` z `lib/weather/ideas.ts`) — przenosimy
ją do **`lib/textKey.ts`**, bo przestała być sprawą pogody. To jedyny „refaktor przy okazji" w tym
planie i jest wymuszony ponownym użyciem, nie estetyką (C-53).

### 2.4 `UserFact` — wiedza o użytkowniku (nowy, przekrojowy)

```prisma
model UserFact {
  id      String @id @default(cuid())
  ownerId String
  // "interests" | "activity" | "lifestyle" | "constraints" | "content" (String + union, C-12).
  category String
  // Treść faktu jednym zdaniem, po polsku.
  text String
  // "guess" | "likely" | "confirmed" — trzystopniowa skala; trafia do promptu jako słowo.
  confidence String @default("guess")
  // "inferred" | "confirmed" | "admin" — skąd fakt pochodzi (AC-21, AC-25).
  origin String @default("inferred")
  // "active" | "rejected" — odrzucony nie wraca (AC-23).
  status String @default("active")
  // Skąd konkretnie wyciągnięty (np. „zapisane pomysły pogodowe") — dla wglądu, nie dla logiki.
  evidence    String?
  fingerprint String
  createdAt   DateTime @default(now())
  updatedAt   DateTime @default(now()) @updatedAt

  owner User @relation("OwnedUserFacts", fields: [ownerId], references: [id], onDelete: Cascade)

  @@unique([ownerId, fingerprint])
  @@index([ownerId, status])
}
```

### 2.5 Zmiany w istniejących modelach

- `NewsItem` — dochodzi `articleId String?` + relacja do `NewsArticle` (opcjonalna, żeby migracja była
  bezpieczna dla istniejących wierszy).
- `NewsPref` — dochodzi `lastFetchedAt DateTime?` (moment ostatniego **pobrania puli**, wspólny dla
  wszystkich tematów — AC-4).
- **`NewsKnowledge` — USUWANY** (decyzja właściciela, spec §8/AC-11).

### 2.6 Migracja (C-10, C-11)

- Numer z `npm run next:migration`: **0217**
- Katalog: `prisma/migrations/0217_wiadomosci_pula_linia_czasu_wiedza_o_userze/migration.sql`
- DDL: `CREATE TABLE` × 4 (`NewsArticle`, `NewsTimelineEntry`, `NewsHiddenTopic`, `UserFact`) z FK i
  indeksami; `ALTER TABLE "NewsItem" ADD COLUMN "articleId" TEXT` + FK `ON DELETE SET NULL`;
  `ALTER TABLE "NewsPref" ADD COLUMN "lastFetchedAt" TIMESTAMP(3)`; na końcu
  **`DROP TABLE "NewsKnowledge";`**
- **To jedyny krok nieodwracalny w całej zmianie.** Reszta migracji jest addytywna. Plik migracji musi
  nieść to w komentarzu wprost, razem ze wskazaniem drogi odzyskania (Neon PITR wg runbooka DevOps) —
  żeby ktoś czytający historię migracji nie odkrył tego przypadkiem.
- Zero enumów Prisma (C-12): `dateConfidence`, `category`, `confidence`, `origin`, `status` to `TEXT`
  + union w TypeScript.

## 3. Warstwa serwera (Server Actions — C-20)

### 3.1 Nowy handler zadania `news.refresh` (`src/lib/jobs/handlers/newsRefresh.ts`)

Cztery etapy w jednym przebiegu, raportujące postęp przez `ctx` (AC-5):

1. **Pobranie puli** — dla każdego włączonego źródła **jedno** `fetchRss`; zapis nowych pozycji do
   `NewsArticle` (`skipDuplicates` po `[ownerId, sourceId, url]`); próg czasu = `NewsPref.lastFetchedAt`
   albo 24 h przy pierwszym uruchomieniu (AC-4). Na końcu ustawiamy `lastFetchedAt`.
2. **Klasyfikacja** — **jedno** wywołanie `op: "dispatch"` (tanie) na całą pulę: lista tytułów ze
   skrótami + lista tematów z filtrami semantycznymi → mapa `artykuł → tematy[]` (AC-2, AC-12).
   Wynik zapisujemy jako `NewsItem` (bez streszczenia; `summary` = skrót z kanału).
3. **Streszczenia w domyślnej długości** — `op: "generation"`, wsadowo dla nowych przypisań.
4. **Linia czasu** — `op: "reasoning"` per temat: model dostaje **nowe** materiały + istniejące
   pozycje z tego samego okresu (nie całą historię — AC-10) i zwraca wyłącznie **brakujące** fakty z
   datą zdarzenia i jej pewnością (AC-9). Zapis przez `createMany` z `skipDuplicates` po
   `[topicId, fingerprint]`.

Handler rejestrowany w `JOB_HANDLERS` i `ENQUEUABLE_TYPES` jako `news.refresh`.

### 3.2 `src/actions/news.ts` (zmiany)

| Funkcja | Zmiana |
|---|---|
| `refreshTopic(topicId)` | **Usunięta.** Zastąpiona przebiegiem `news.refresh` obejmującym wszystkie tematy naraz — utrzymywanie obu byłoby dwiema ścieżkami do tego samego celu. |
| `getHotTopics(force?)` | Czyta **pulę** `NewsArticle` (zero `fetchRss` — AC-3), odfiltrowuje `NewsHiddenTopic`, przechodzi przez `rememberedContent` (`kind: "news.hotTopics"`), więc wejście na widok nie kosztuje przy każdym renderze. |
| `hideHotTopic(title)` / `unhideHotTopic(id)` | **Nowe** — `upsert`/`delete` w `NewsHiddenTopic` (AC-18, AC-19). |
| `getHiddenTopics()` | **Nowa** — lista odrzuconych do przywrócenia. |
| `getTopicTimeline(topicId)` | **Nowa** — linia czasu tematu, od najnowszej. |
| `resummarizeItem(itemId, length)` | Bez zmian w istocie (leniwe dłuższe streszczenie, AC-12); zostaje `on-demand` w manifeście pamięci treści. |
| `getTopicView(topicId)` | Zwraca linię czasu zamiast wersjonowanej wiedzy. |

### 3.3 `src/actions/userFacts.ts` (nowy)

| Funkcja | Rola |
|---|---|
| `getUserFacts()` | Fakty zalogowanego użytkownika, pogrupowane w kategorie (AC-24). |
| `confirmUserFact(id)` / `rejectUserFact(id)` | Potwierdzenie (`origin: "confirmed"`, `confidence: "confirmed"`) albo odrzucenie (`status: "rejected"` — nie wraca, AC-22, AC-23). |
| `upsertUserFact(data)` / `deleteUserFact(id)` | Ręczna edycja przez użytkownika (AC-24). |
| `getPendingHypothesis()` | **Jedna** hipoteza do pokazania na karcie — rzadko, pojedynczo (ryzyko ze spec §9). |
| `getUserFactsForAdmin(userId)` / `setUserFactByAdmin(...)` | Wgląd i edycja administratora (`origin: "admin"`, nie nadpisywany automatycznie) — guard `module.admin` (AC-25). |
| `buildUserContext(userId)` | **Serwerowy helper** (nie akcja) — składa aktywne fakty w blok tekstu do promptu; zastępuje dzisiejszą namiastkę w Pogodzie (AC-26). Brak faktów → pusty string, nigdy błąd (AC-27). |

Wnioskowanie faktów: handler zadania `user.facts` (`src/lib/jobs/handlers/userFacts.ts`) — czyta
zachowania (zapisane i zablokowane pomysły pogodowe, monitorowane tematy, odrzucone gorące tematy),
jednym wywołaniem `op: "reasoning"` proponuje fakty, zapisuje jako `status:"active", origin:"inferred"`
z `skipDuplicates` po odcisku. Odrzucone (`status:"rejected"`) trafiają do promptu jako „nie proponuj
ponownie".

Guardy: wszystkie akcje przez `requireAuth()` + `ownerId` (C-21); akcje administratora przez
`hasPermission(session, PERMISSIONS.ADMIN)`. Każda mutacja kończy `revalidatePath`.

## 4. RBAC / rejestr modułu (C-22)

- **Bez nowych slugów.** Wiadomości zostają pod `module.news`; wiedza o użytkowniku żyje w
  `/settings` (uprawnienie `module.settings`) i w panelu administratora (`module.admin`).
- `modules.tsx` / `ModuleSidebar` — bez zmian.
- Nowe akcje wymagają wpisów w `src/lib/ai/action-coverage.json` (`access` + guard), inaczej
  `check:ai-coverage` wywala build.

## 5. UI (C-30, C-31, C-32)

### 5.1 Wiadomości — nowy układ

- **Przycisk „Odśwież" przenosimy** z listy tematów do **nagłówka modułu** — bo odświeżenie dotyczy
  teraz całego modułu, nie pojedynczego tematu. Obok niego pasek stanu przebiegu: „Pobieram źródła
  (3/5)… / Przypisuję do tematów… / Streszczam…", zasilany odpytywaniem zadania (AC-5).
- Po powrocie na stronę stan przebiegu jest **odtwarzany z kolejki**, nie z pamięci komponentu (AC-6);
  zakończenie niepowodzeniem pokazuje komunikat błędu, nie pustkę (AC-7).
- **Linia czasu** (`NewsTimeline.tsx`) zastępuje `KnowledgePanel`: pozycje z datą, faktem i znacznikiem
  źródła; przy dacie niepewnej — znacznik „data przybliżona".
- **Filtr źródeł**: „Wszystkie" dostaje licznik (`Wszystkie (5)`) i podpis wyjaśniający, że pozostałe
  zakładki zawężają do jednego portalu (AC-20).
- **Gorące tematy**: przy każdym przycisk „Nie proponuj"; odnośnik „Odrzucone tematy" otwiera listę z
  przywracaniem — do proponowanych albo od razu do monitorowanych (AC-19).

### 5.2 Lektor (`src/components/news/NewsReader.tsx` + `src/lib/speech/sentences.ts`)

- `splitSentences(text)` — czysta funkcja dzieląca polski tekst na zdania (skróty typu „np.", „tzn.",
  „r." nie kończą zdania). **Z testem jednostkowym**, bo błąd tutaj rozjeżdża cały odsłuch.
- Odtwarzanie: zdanie po zdaniu przez istniejące `speak(text, "pl", { onEnd })` — łańcuch po `onEnd`
  działa **zarówno** dla głosu serwerowego, jak i przeglądarki, więc nie potrzebujemy znaczników
  czasu od dostawcy (decyzja właściciela).
- Podświetlenie bieżącego zdania (`var(--bg-elevated)` + lewa krawędź `var(--accent-purple)`),
  automatyczne przewinięcie do widoku, klik w zdanie = przeskok (AC-15, AC-16).
- Sterowanie: pasek przyklejony do dołu karty, `pb-[max(...,env(safe-area-inset-bottom))]`, cele
  `py-3`, przyciski: wstecz o zdanie / pauza-wznów / dalej o zdanie / stop (AC-14, AC-17).

### 5.3 Wiedza o użytkowniku

- `src/components/settings/UserFactsSection.tsx` — sekcja w `/settings`: fakty pogrupowane w
  kategorie, każdy z pewnością i pochodzeniem, edycja i usuwanie (AC-24).
- `src/components/ui/UserFactHypothesisCard.tsx` — **jedna** karta hipotezy pokazywana rzadko i przy
  okazji (na Home i w Pogodzie pod listą propozycji), z dwoma przyciskami: „Zgadza się" / „Nie o mnie".
  Nigdy jako przerywnik ani osobny ekran (ryzyko ze spec §9).
- `src/components/admin/UserFactsPanel.tsx` — wgląd i edycja administratora (AC-25).

## 6. AI / integracje (C-23, C-40)

- **Bez nowych `AIAction`** — nic z tego nie jest akcją asystenta.
- Wszystkie wywołania przez `chatComplete({ op })`: `dispatch` (klasyfikacja), `generation`
  (streszczenia), `reasoning` (linia czasu, gorące tematy, wnioskowanie faktów). Zero nazw modeli (C-40).
- **Licznik kosztu (037)**: każdy etap przebiegu zwraca zużycie; suma pokazywana przy wyniku
  odświeżenia i przy gorących tematach (AC-13).
- **Pamięć treści (038)**: `news.hotTopics` jako `remembered`; klasyfikacja i streszczenia jako
  `on-demand` (zależą od świeżo pobranej puli). Nowe pliki wołające model wymagają wpisów w
  `content-memory-coverage.json` i `cost-badge-coverage.json`.
- **`buildUserContext`** wpięty w prompt propozycji Pogody w miejsce dzisiejszego
  `AssistantPref.instructions` + tytuły zapisanych pomysłów (AC-26).

## 7. Pliki do utworzenia / zmiany

| Plik | Akcja | Po co |
|------|-------|-------|
| `prisma/schema.prisma` | edycja | 4 nowe modele, 2 kolumny, **usunięcie `NewsKnowledge`** |
| `prisma/migrations/0217_.../migration.sql` | nowy | DDL wg §2.6 |
| `src/lib/textKey.ts` | nowy | `fingerprintOf` przeniesione z `lib/weather/ideas.ts` (ponowne użycie) |
| `src/lib/weather/ideas.ts` | edycja | re-eksport z `textKey` (bez zmiany zachowania) |
| `src/lib/jobs/handlers/newsRefresh.ts` | nowy | czteroetapowy przebieg odświeżania |
| `src/lib/jobs/handlers/userFacts.ts` | nowy | wnioskowanie faktów o użytkowniku |
| `src/lib/jobs/handlers.ts` | edycja | rejestracja `news.refresh`, `user.facts` |
| `src/actions/news.ts` | edycja | pula, linia czasu, gorące tematy z puli, ukrywanie tematów |
| `src/actions/userFacts.ts` | nowy | odczyt/edycja faktów + `buildUserContext` |
| `src/actions/weather.ts` | edycja | prompt propozycji korzysta z `buildUserContext` |
| `src/lib/speech/sentences.ts` + `.test.ts` | nowy | podział na zdania + test |
| `src/components/news/NewsPage.tsx` | edycja | przeniesiony „Odśwież", pasek stanu, filtr źródeł |
| `src/components/news/NewsTimeline.tsx` | nowy | linia czasu tematu |
| `src/components/news/KnowledgePanel.tsx` | usunięcie | zastąpiony linią czasu |
| `src/components/news/HotTopics.tsx` | edycja | „Nie proponuj" + odnośnik do odrzuconych |
| `src/components/news/HiddenTopicsPanel.tsx` | nowy | lista odrzuconych z przywracaniem |
| `src/components/news/NewsReader.tsx` | nowy | lektor z podświetlaniem zdań |
| `src/components/settings/UserFactsSection.tsx` | nowy | profil użytkownika w ustawieniach |
| `src/components/ui/UserFactHypothesisCard.tsx` | nowy | karta hipotezy |
| `src/components/admin/UserFactsPanel.tsx` | nowy | wgląd administratora |
| manifesty (`action-coverage`, `content-memory-coverage`, `cost-badge-coverage`) | edycja | klasyfikacja nowych wywołań i akcji |
| `CLAUDE.md`, `doświadczenia.md` | edycja | dokumentacja + lekcje (C-51) |

## 8. Bramki i weryfikacja (C-50)

**Lokalnie (C-13):** lokalny Postgres `omnia_dev`, `npx prisma migrate deploy`, weryfikacja **do kroku
`next build`** — `scripts/migrate.js` pomijamy.

Sekwencja: `copy-docs → check:actions → check:ai-coverage → check:cost-badge → check:content-memory →
check:migrations → next lint → prisma generate → next build` + `npm run test:unit`.

| AC | Jak sprawdzamy |
|---|---|
| AC-1, AC-2 | licznik wywołań `fetchRss` w przebiegu = liczba źródeł, niezależnie od liczby tematów |
| AC-3 | wejście na gorące tematy po odświeżeniu → zero `fetchRss` |
| AC-4 | `lastFetchedAt` w bazie; drugie odświeżenie pobiera tylko nowsze pozycje |
| AC-5, AC-6, AC-7 | stan zadania odpytywany po przeładowaniu strony; wymuszony błąd → komunikat |
| AC-8, AC-9, AC-10 | linia czasu w bazie: daty zdarzeń, brak duplikatów po odcisku |
| AC-11 | `NewsKnowledge` nie istnieje po migracji |
| AC-12, AC-13 | jedno wywołanie `dispatch` na klasyfikację; wskaźnik kosztu przy wyniku |
| AC-14..AC-17 | odsłuch: pauza, skok, podświetlenie, klik w zdanie; `npm run test:unit` dla podziału zdań |
| AC-18, AC-19, AC-20 | odrzucenie tematu, lista odrzuconych, licznik przy „Wszystkie" |
| AC-21..AC-25 | fakty w bazie z pochodzeniem; potwierdzenie/odrzucenie; widok w ustawieniach i u administratora |
| AC-26 | prompt propozycji Pogody zawiera blok z faktami |
| AC-27 | konto bez faktów → wszystko działa, `buildUserContext` zwraca pusty string |

## 9. Ryzyka techniczne i plan wycofania

- **`DROP TABLE "NewsKnowledge"` jest nieodwracalny.** Rollback kodu **nie przywraca danych** —
  jedyną drogą jest przywrócenie bazy do punktu w czasie (Neon PITR, runbook DevOps). To musi być
  napisane w komentarzu migracji i w opisie merge'a.
- **Przebudowa dotyka serca modułu** — mitygacja: warstwy wdrażane osobno (pula → klasyfikacja →
  linia czasu → UX), każda weryfikowalna niezależnie.
- **Jedno wywołanie klasyfikacji na całą pulę może przekroczyć budżet tokenów** — mitygacja: pula
  dzielona na porcje po ~40 pozycji, a wynik ucięty (`truncated`) jest **błędem**, nie pustką
  (lekcja z 038).
- **Podział na zdania po polsku bywa zawodny** (skróty, liczby, cudzysłowy) — mitygacja: test
  jednostkowy z przypadkami granicznymi.
- **Karta hipotezy może irytować** — mitygacja: pokazujemy najwyżej jedną naraz, tylko gdy istnieje
  niepotwierdzona hipoteza, i nigdy jako przerywnik.
- **Rollback:** kod — cofnięcie merge'a. Migracja: część addytywna nie wymaga kroku wstecz; usunięcie
  `NewsKnowledge` — patrz wyżej.

## 10. Zgodność z konstytucją — checklista

- [x] **C-10..C-14** — ręczna migracja `0217`, numer z `next:migration`, `String`+union bez enumów,
      weryfikacja na lokalnym Postgresie, komentarz o nieodwracalności.
- [x] **C-20..C-25** — Server Actions z `revalidatePath`; guard `requireAuth` + `ownerId`; akcje
      administratora za `module.admin`; bez nowych slugów; bez nowych `AIAction`; kosz nie dotyczy
      (odrzucone tematy i fakty mają własne listy przywracania — spec §6).
- [x] **C-30..C-32** — linia czasu, sterowanie lektorem i karty faktów na zmiennych CSS; mobile-first
      (`safe-area`, cele `py-3`); całe UI po polsku.
- [x] **C-40..C-41** — `chatComplete({op})` bez nazw modeli; brak styku z kluczami.
- [x] **C-50/C-51** — komplet bramek + testy jednostkowe; lekcje do `doświadczenia.md`.
- [x] **C-53 (minimalizm)** — używamy **istniejących** mechanizmów: kolejka zadań (odświeżanie w tle),
      pamięć treści z 038 (gorące tematy), licznik kosztu z 037, warstwa mowy z 032 (`speak` z
      `onEnd`). Jedyny refaktor — przeniesienie `fingerprintOf` do `lib/textKey.ts` — jest wymuszony
      ponownym użyciem w trzech miejscach. `refreshTopic` **usuwamy**, zamiast zostawiać drugą ścieżkę
      do tego samego celu. Zero nowych zależności.
- [x] **C-54** — plan nie zmienia zakresu speca; wszystkie 27 kryteriów ma pokrycie w §8.
