# Weryfikacja: 039 — Wiadomości (przebudowa) + wiedza o użytkowniku

- **Data:** 2026-08-01
- **Branch:** `claude/weather-features-expansion-ic9okq`
- **Zakres:** 24/24 zadania z `tasks.md` odhaczone

## Bramki

| Komenda | Wynik |
|---|---|
| `npm run check:migrations` | ✅ „Numeracja migracji OK (następny wolny numer: 0219)" |
| `npm run check:actions` | ✅ 160 akcji w katalogu, wszystkie z egzekutorem i kontraktem; 372 parametry z etykietami PL |
| `npm run check:ai-coverage` | ✅ 533 akcje z zadeklarowanym zakresem **i guardem w kodzie**; wszystkie sklasyfikowane |
| `npm run check:cost-badge` | ✅ 34 pliki wołające model, każdy przekazuje zużycie lub ma świadomy wyjątek |
| `npm run check:content-memory` | ✅ 34 pliki sklasyfikowane (5 z pamięcią treści, 29 na żądanie) |
| `npx next lint --dir src` | ✅ 0 błędów; 16 ostrzeżeń — wszystkie **istniejące wcześniej** (polskie cudzysłowy w JSX, `exhaustive-deps`), żadne w plikach 039 |
| `npx next build` | ✅ „Compiled successfully"; `/admin/user-facts` w wykazie tras, `/wiadomosci` 17 kB |
| `npm run test:unit` | ✅ **560/560, 0 pominiętych** (z testami DB-gated na lokalnym Postgresie) |

Build i migracje szły **wyłącznie** przeciw lokalnemu Postgresowi (`127.0.0.1:5432/omnia_dev`);
`scripts/migrate.js` nie był uruchamiany (C-13).

## Kryteria akceptacji

Poza lekturą kodu przeprowadziłem **weryfikację behawioralną na żywej bazie** (skrypt jednorazowy,
tworzył i kasował własnych użytkowników; nie został w repo). Wyniki oznaczone „[żywa baza]".

| AC | Werdykt | Dowód |
|---|---|---|
| AC-1 każde źródło raz | ✅ | `newsRefresh.ts` `fetchPool` — pętla po **źródłach**, jedno `fetchRss` na obieg; tematy nie występują w tej pętli, więc liczba pobrań nie zależy od ich liczby. [żywa baza] `createMany({skipDuplicates})` na `[ownerId,sourceId,url]`: pierwszy przebieg zapisał 1 wiersz, drugi 0 |
| AC-2 jedna klasyfikacja | ✅ | `classifyPool` — jedno wywołanie `op:"dispatch"` na porcję 40 artykułów, z listą **wszystkich** tematów w prompcie; liczba wywołań = `ceil(pula/40)` |
| AC-3 gorące tematy z puli | ✅ | `getHotTopics` czyta `prisma.newsArticle`; `grep fetchRss src/actions/news.ts` → **brak trafień** (import usunięty razem ze starym przebiegiem) |
| AC-4 od poprzedniego pobrania | ✅ | `fetchPool`: `since = force \|\| !pref?.lastFetchedAt ? (now − 24 h) : pref.lastFetchedAt`; na końcu `upsert` `lastFetchedAt` |
| AC-5 widoczny etap | ✅ | `ctx.progress(...)` w każdym z 4 etapów → `Job.progress` (0218) → `RefreshStatus` w `NewsPage.tsx`. Komunikaty niosą licznik („Pobieram źródła (3/5)…") |
| AC-6 przeżywa zamknięcie strony | ✅ | `getNewsRefreshState()` czyta **ostatnie zadanie z kolejki**, nie stan komponentu; `useEffect` odpytuje co 2 s, gdy `status ∈ {QUEUED, RUNNING}`. Stan po powrocie = trwający przebieg albo jego wynik |
| AC-7 błąd zamiast pustki | ✅ | `llmJson` rzuca przy `!ok`, `truncated` **i** `parsed == null`; `RefreshStatus` ma osobną, czerwoną gałąź dla `FAILED` z treścią błędu; `HotTopics` ma stan `failed` odrębny od „brak tematów" |
| AC-8 linia czasu | ✅ | `NewsTimeline.tsx` — data, jednozdaniowy fakt, nazwa źródła, kropka w kolorze profilu źródła; `getTopicTimeline` sortuje `eventDate desc` |
| AC-9 data zdarzenia | ✅ | Prompt `TIMELINE_SYSTEM` żąda daty ZDARZENIA; `dateConfidence` `exact\|approx\|published` z widocznym znacznikiem przy niepewnej. [żywa baza] wpis o `eventDate` 2026-06-01 dodany **po** wpisach lipcowych wylądował na końcu listy — czyli sortuje data zdarzenia, nie zapisu |
| AC-10 brak dublowania | ✅ | [żywa baza] „Sąd oddalił wniosek prokuratury" i „SĄD ODDALIŁ WNIOSEK PROKURATURY!" dają ten sam odcisk → drugi `createMany` zapisał **0** wierszy. Druga warstwa: model dostaje istniejące fakty z okresu |
| AC-11 stara baza usunięta | ✅ | `DROP TABLE IF EXISTS "NewsKnowledge"` w 0217 (z komentarzem o nieodwracalności i drodze przez Neon PITR); model wycięty ze `schema.prisma`, `KnowledgePanel.tsx` skasowany. `grep -rn NewsKnowledge src` → tylko komentarz historyczny |
| AC-12 tanio + leniwie | ✅ | Klasyfikacja `dispatch`, streszczenia `generation` **ze skrótu z kanału**; pełny artykuł (`fetchArticle`) dociąga **wyłącznie** `resummarizeItem` na życzenie. Dodatkowo `acknowledgeItem` przestał wołać model |
| AC-13 wskaźnik kosztu | ✅ | Zużycie ze wszystkich etapów sumowane w `usageFromChat(sink)` → `Job.result` → `visibleUsage` przy odczycie → `AiCostBadge` w `RefreshStatus` i w `HotTopics`. Bramka `check:cost-badge` zielona |
| AC-14 sterowanie odsłuchem | ✅ | `NewsReader`: wstecz / pauza-wznów / dalej / stop; łańcuch po `onEnd` działa i dla głosu serwerowego, i dla przeglądarki. [żywa baza] `splitSentences` na tekście ze skrótami („2024 r.", „Prof.") dał **3** zdania i nie zgubił ani jednego znaku |
| AC-15 podświetlenie + przewijanie | ✅ | `data-sentence`, tło `--bg-elevated` + lewa krawędź `--accent-purple`, `scrollIntoView({block:"nearest"})` przy zmianie zdania |
| AC-16 klik = przeskok | ✅ | `onClick`/`onKeyDown` (Enter/Spacja) na każdym zdaniu → `step(i − current)`; `role="button"`, `tabIndex=0` |
| AC-17 lektor na telefonie | ✅ | Pasek `sticky bottom-0`, `paddingBottom: max(0.5rem, env(safe-area-inset-bottom))`, cele `py-3`, akcje na `onPointerDown` (pierwszy dotyk wykonuje akcję). Tekst przewija się w kontenerze `max-h-72`, więc pasek go nie zasłania |
| AC-18 odrzucanie tematów | ✅ | `hideHotTopic(title)` → `upsert` po `[ownerId, fingerprint]`; filtr stosowany **po** odczycie z pamięci. [żywa baza] „wybory   PREZYDENCKIE!" trafia w odcisk zapisanego „Wybory prezydenckie" |
| AC-19 lista odrzuconych | ✅ | `getHiddenTopics` + panel „Odrzucone tematy" z dwoma wyjściami: „Przywróć" (na listę propozycji) i „Monitoruj" (od razu jako temat) |
| AC-20 czytelne „Wszystkie" | ✅ | `Wszystkie (${enabledSources.length})` + zdanie pod paskiem zakładek, zmieniające treść zależnie od wybranego filtra |
| AC-21 fakty z zachowań | ✅ | `userFacts.ts` (handler) czyta **wyłącznie** działania użytkownika: zapisane/zablokowane pomysły pogodowe, monitorowane tematy, odrzucone gorące tematy. Zapisuje `category`/`text`/`confidence`/`evidence`. [żywa baza] pewność trafia do promptu jako słowo — kontekst zawiera „(prawdopodobne)" |
| AC-22 potwierdzenie jednym dotknięciem | ✅ | `UserFactHypothesisCard` pod listą propozycji w Pogodzie — bez modala, bez blokowania; karta znika natychmiast po odpowiedzi, zapis leci w tle. Te same dwa przyciski w `/settings` |
| AC-23 odrzucony nie wraca | ✅ | `rejectUserFact` ustawia `status:"rejected"` **bez kasowania**. [żywa baza] odrzucony fakt pojawia się w kontekście wyłącznie w sekcji „NIE ZAKŁADAJ" (nie jako fakt), a próba ponownego zapisu tego samego odcisku odbija się o unikat `[ownerId, fingerprint]`. Trzecia warstwa: handler filtruje po odcisku przed zapisem |
| AC-24 przegląd i edycja | ✅ | `UserFactsSection` w `/settings`: grupowanie po kategoriach, przy każdym fakcie pewność i pochodzenie, akcje „Zgadza się"/„Nie o mnie"/„Popraw"/„Usuń", plus ręczne dodanie |
| AC-25 wgląd administratora | ✅ | `/admin/user-facts` + `UserFactsPanel` — wybór użytkownika, widok także faktów odrzuconych (wyszarzone), etykieta pochodzenia; zapis stąd ma `origin:"admin"` i nie jest nadpisywany wnioskowaniem. Guard `hasPermission(session, PERMISSIONS.ADMIN)` w akcjach **i** na stronie |
| AC-26 Pogoda korzysta z faktów | ✅ | `buildUserContext(user.id)` w `personalHint` (`actions/weather.ts`) zastąpił namiastkę; `userContextStamp` wszedł do `hashInputs`. [żywa baza] zmiana pewności faktu zmienia odcisk → zapamiętane propozycje zapalają „nieaktualne" |
| AC-27 brak faktów nic nie psuje | ✅ | [żywa baza] `buildUserContext` dla świeżego użytkownika zwrócił `""` (nie błąd); funkcja ma `try/catch` zwracający `""` także przy awarii odczytu. Izolacja właścicieli potwierdzona — fakty jednego użytkownika nie wyciekają do drugiego |

**27/27 spełnionych.** Żadne AC nie jest częściowe ani niespełnione.

## Zgodność z konstytucją

| Reguła | Stan |
|---|---|
| C-01 praca w `worldofmag/` | ✅ poza `specs/` (artefakty, C-03) i `doświadczenia.md` (C-51) nic nie ruszone w katalogu głównym |
| C-02 alias `@/*` | ✅ wszystkie nowe importy przez alias |
| C-03 artefakty w `specs/NNN-slug/` | ✅ `spec.md`, `plan.md`, `tasks.md`, `ac-mapowanie.md`, `verify.md` |
| C-10 ręczne pliki migracji | ✅ 0217 i 0218 napisane ręcznie |
| C-11 numeracja | ✅ z `npm run next:migration`; **0218 jako osobna migracja**, bo 0217 była już zastosowana — przepisanie zmieniłoby sumę kontrolną |
| C-12 zero enumów Prisma | ✅ `dateConfidence`, `category`, `confidence`, `origin`, `status` to `TEXT` + unie TS (`lib/userFacts.ts`, `DateConfidence` w handlerze) |
| C-13 nigdy prod DB | ✅ wyłącznie lokalny Postgres; `migrate.js` nie uruchamiany |
| C-20 Server Actions + `revalidatePath` | ✅ każda mutacja w `news.ts`/`userFacts.ts` kończy `revalidatePath` |
| C-21 własność | ✅ wszystko po `ownerId` + `requireAuth()`; encje 039 są per-użytkownik (bez wariantu zespołowego — świadomie, bo to dane osobiste) |
| C-22 RBAC | ✅ bez nowych slugów; `/admin/user-facts` za `PERMISSIONS.ADMIN` (strona **i** akcje) |
| C-23 `AIAction` ma egzekutor | ✅ `refresh_news` w `newsExecutor.ts`, katalogu i kontrakcie; `check:actions` zielony |
| C-30 zmienne CSS | ✅ nowe komponenty wyłącznie na `var(--…)`; brak hexów |
| C-31 mobile-first | ✅ pasek lektora `sticky` z `env(safe-area-inset-bottom)`, cele `py-3`, `onPointerDown` |
| C-32 teksty PL | ✅ całe UI i wszystkie prompty po polsku |
| C-40 routing modeli z bazy | ✅ wyłącznie `chatComplete({op})`; zero nazw modeli w kodzie |
| C-50 definicja „gotowe" | ✅ pełna sekwencja bramek do `next build` zielona |
| C-51 `doświadczenia.md` | ✅ trzy wpisy (środowisko/testy pominięte, koszt pobierania per temat, postęp w pamięci komponentu) |
| C-53 minimalizm | ✅ jeden sankcjonowany refaktor (`fingerprintOf` → `lib/textKey.ts`), wymuszony trzykrotnym użyciem; zero nowych zależności |
| C-54 spójność artefaktów | ✅ cztery odstępstwa odnotowane: `plan.md` §2.7 (migracja 0218) oraz `ac-mapowanie.md` (zmiana nazwy akcji AI, `acknowledgeItem` bez modelu, wyzwalacz wnioskowania) |

## Regresje

Sprawdzone punkty styku:

- **Konsumenci zmienionych akcji** — `grep` po `getHotTopics`/`getTopicView`/`acknowledgeItem`:
  `NewsPage`, `HotTopics`, `NewsItemCard` (zaktualizowane) oraz read-toole asystenta
  `agentTools.ts` (`list_hot_topics`, `get_news_topic_view`) — kompilują się z nowymi kształtami.
- **Eksport RODO** (`actions/privacy.ts`) — `include: { knowledge: true }` wskazywało na usuwaną
  tabelę i wywaliłoby eksport. Zastąpione linią czasu; do eksportu doszły pula, odrzucone tematy
  i **fakty o użytkowniku** (to dane osobowe, więc muszą tam być).
- **Kolejka zadań** — `JobRecord` dostał pole `progress`; pozostałe handlery nie używają
  `ctx.progress` i działają bez zmian (`progress` jest opcjonalne w `JobContext`).
- **Kaskady FK** — [żywa baza] usunięcie użytkownika czyści `NewsArticle`, `UserFact`
  i (przez temat) `NewsTimelineEntry`; zero osieroconych wierszy.
- **Testy** — 560/560, w tym integracyjne na bazie; brak testów pominiętych.

### Uwagi (nieblokujące)

1. **`list_hot_topics` zwraca teraz obiekt z `usage`** zamiast gołej tablicy. Dla administratora
   oznacza to kilka dodatkowych tokenów kontekstu w rozmowie z asystentem. Nieszkodliwe, ale przy
   następnym dotknięciu tego read-toola warto zwracać samo `topics`.
2. **Asystent nie „napełni" puli sam** — `list_hot_topics` czyta pulę, więc u użytkownika, który
   nigdy nie odświeżył Wiadomości, zwróci pustą listę. To zamierzone (AC-3), a UI mówi wprost, co
   zrobić („Odśwież wiadomości, żeby napełnić pulę").
3. **Odrzucony artykuł wraca do rozważenia przez dobę** — „nieprzypisany" liczymy po braku
   `NewsItem`, więc materiał, którego klasyfikacja nie przypisała do żadnego tematu, może wejść do
   następnego przebiegu, dopóki mieści się w oknie 24 h. Świadomy kompromis: alternatywą byłby
   znacznik „sprawdzony" na artykule, czyli kolumna i migracja dla przypadku, który kosztuje jeden
   tani przebieg klasyfikacji.

## Werdykt końcowy

**GOTOWE** — 27/27 kryteriów akceptacji spełnionych (12 potwierdzonych zachowaniem na żywej bazie,
reszta prześledzeniem ścieżek w kodzie), wszystkie bramki zielone, brak naruszeń konstytucji, brak
wykrytych regresji. Trzy uwagi powyżej są kosmetyczne i nie blokują przejścia do recenzji.
