# Plan techniczny: Kontrola nad AI — kiedy generuje, ile kosztuje, co robi bez pytania

- **Spec:** ./spec.md (041-kontrola-nad-ai)
- **Status:** draft
- **Data:** 2026-08-01

> **Zasada planu:** to jest **JAK**. Trzy mechanizmy przekrojowe już istnieją i są tu fundamentem —
> **nie budujemy niczego, co mamy**: pamięć treści z 038 (`lib/ai/contentMemory.ts`), licznik kosztu
> z 037 (`lib/ai/usage.ts`, `AiCostBadge`), klasyfikacja akcji niszczących z `lib/ai/aiAction.ts`.

## 1. Podejście

Cztery zgłoszenia rozkładają się na **jedną przebudowę przekrojową** (sekcje AI) i **trzy zmiany
lokalne** (historia kosztów, auto-zatwierdzanie, nawigacja).

Rdzeniem jest obserwacja z lektury kodu: `rememberedContent` woła `generate()` **zawsze**, gdy nie ma
zapisu — czyli pierwsze wejście na stronę kosztuje. AC-1 tego zabrania. Zamiast dokładać warstwę
obok, **rozszerzamy istniejące wejście o tryb** i przepuszczamy przez nie wszystkie pięć sekcji.

Po stronie UI wzorcem jest `AiContentMeta` (038) — już dziś nosi „wygenerowano / nieaktualne /
odśwież". Dokładamy do niego koszt i wybór trybu, zamiast stawiać drugi pasek obok pierwszego —
właściciel prosił wprost o **połączenie** z komponentem kosztu.

## 2. Model danych (Prisma)

### 2.1 `AiSectionPref` — tryb odświeżania per użytkownik i sekcja (nowy)

```prisma
model AiSectionPref {
  id      String @id @default(cuid())
  ownerId String
  /** Rodzaj sekcji — te same wartości co `AiContentKind` (weather.ideas, news.hotTopics, …). */
  sectionKind String
  /** "onDemand" | "onChange" | "always" — String + union TS (C-12). */
  mode      String   @default("onDemand")
  updatedAt DateTime @default(now()) @updatedAt

  owner User @relation("OwnedAiSectionPrefs", fields: [ownerId], references: [id], onDelete: Cascade)

  @@unique([ownerId, sectionKind])
}
```

**Dlaczego osobna tabela, a nie kolumny w `AssistantPref`:** sekcji jest pięć i będzie ich przybywać
(każdy nowy moduł z AI to kolejna). Kolumna per sekcja oznaczałaby migrację przy każdym dołożeniu.

**Domyślne systemowe — bez nowej tabeli.** Wiersz z `ownerId = NULL` byłby zgodny z wzorcem
„Dictionary Ownership Levels", ale w PostgreSQL `NULL != NULL`, więc `@@unique([ownerId, sectionKind])`
**nie chroniłby** wierszy systemowych przed duplikatami. Zamiast kombinować z indeksem częściowym
używamy sprawdzonego wzorca z 037/039: **jeden klucz w `Config`** — `ai_section_default_modes`, JSON
`{ "weather.ideas": "onDemand", … }`, seedowany migracją. To ta sama droga, którą poszły
`ai_cost_badge_enabled` i `assistant_followups_enabled`.

**Rozstrzygnięcie kolejności (AC-10, AC-11):** tryb sekcji = `AiSectionPref` użytkownika → w razie
braku `Config` → w razie braku `"onDemand"`. Administrator ustawiając „swoje" pisze do
`AiSectionPref` (jak każdy), a ustawiając „domyślne systemowe" — do `Config`. Dwie osobne ścieżki,
więc AC-11 spełnia się z konstrukcji, a nie przez dodatkowy warunek.

### 2.2 `NewsRefreshRun` — trwała historia przebiegów odświeżania (nowy)

```prisma
model NewsRefreshRun {
  id      String @id @default(cuid())
  ownerId String
  startedAt  DateTime
  finishedAt DateTime @default(now())
  /** "done" | "failed" — String + union (C-12). */
  status String @default("done")
  /** Liczby z wyniku przebiegu — pozwalają odróżnić przebiegi od siebie (AC-17). */
  sources       Int @default(0)
  fetched       Int @default(0)
  assigned      Int @default(0)
  summarized    Int @default(0)
  timelineAdded Int @default(0)
  /** Zużycie modelu (JSON) — surowe; bramka widoczności działa przy ODCZYCIE. */
  usage String?
  error String?

  owner User @relation("OwnedNewsRefreshRuns", fields: [ownerId], references: [id], onDelete: Cascade)

  @@index([ownerId, finishedAt])
}
```

**Dlaczego nowa tabela, a nie odczyt z `Job`:** `cleanupOldJobs` kasuje zakończone zadania po 24 h, a
`Job.result` i tak trzyma tylko ostatni przebieg. Zgłoszenie mówi wprost o odczycie „po fakcie".

**Retencja:** przy zapisie kasujemy przebiegi starsze niż **30 ostatnich** dla danego właściciela.
Zgłoszenie prosi o możliwość odczytania kosztu, nie o wieczyste archiwum (założenie ze spec §8).

### 2.3 `AssistantPref.autoApprove` (zmiana istniejącego)

```prisma
  /** 041: auto-zatwierdzanie BEZPIECZNYCH akcji asystenta; niszczące zawsze pytają. */
  autoApprove Boolean @default(false)
```

### 2.4 Migracja (C-10, C-11)

- Numer: **0220** (`npm run next:migration`)
- Katalog: `prisma/migrations/0220_kontrola_nad_ai/migration.sql`
- DDL:
  - `CREATE TABLE "AiSectionPref"` + `UNIQUE ("ownerId","sectionKind")` + FK `ON DELETE CASCADE`;
  - `CREATE TABLE "NewsRefreshRun"` + `INDEX ("ownerId","finishedAt")` + FK `ON DELETE CASCADE`;
  - `ALTER TABLE "AssistantPref" ADD COLUMN "autoApprove" BOOLEAN NOT NULL DEFAULT false;`
  - seed `Config`: `ai_section_default_modes` — idempotentnie, `gen_random_uuid()::text` dla `id`
    (kolumna `Config.id` **nie ma domyślnej wartości** — lekcja z 037/039).
- **Migracja w całości addytywna** — brak `DROP`, więc poprzednia wersja kodu działa na nowym
  schemacie i rollback nie wymaga kroku wstecz na bazie.

## 3. Warstwa serwera (Server Actions — C-20)

### 3.1 Tryb sekcji — dwa pliki (podział wymuszony granicą klient/serwer)

> **Korekta z etapu `/implement` (C-54).** Plan zakładał jeden plik. Etykiety trybów są potrzebne w
> komponencie klienckim (`AiContentMeta`), a ten nie może zaciągnąć `@/lib/prisma` — Prisma nie
> działa w przeglądarce i wywaliłaby build. Stąd podział, analogiczny do `lib/llm/effort.ts`
> (czysty) kontra `lib/llm/resolver.ts` (baza).

- **`src/lib/ai/sectionMode.ts`** — słownik pojęć, **bez bazy**: `AiSectionMode`
  (`"onDemand" | "onChange" | "always"`), etykiety PL sekcji i trybów, `AI_SECTION_KINDS`,
  `isSectionMode`, `DEFAULT_SECTION_MODE`, klucz `Config`.
- **`src/lib/ai/sectionModeResolver.ts`** — część serwerowa:
  - `resolveSectionMode(ownerId, kind)` — preferencja użytkownika → `Config` → `"onDemand"`. Jedno
    miejsce, w którym mieszka ta kolejność.
  - `resolveSectionModes(ownerId)` — komplet sekcji jednym zapytaniem.
  - `readDefaultSectionModes()` — odczyt `Config` **bez sesji** (wzorzec `readCostBadgeEnabled`
    z 037), bo woła to także handler zadania.

### 3.2 `rememberedContent` — nowy tryb (`src/lib/ai/contentMemory.ts`)

Rozszerzamy **istniejące** wejście, nie dokładamy drugiego:

```ts
rememberedContent<T>({ …, mode?: AiSectionMode, force?: boolean })
  → RememberedContent<T> & { pending: boolean }
```

Reguła (jedna, czytelna):
| stan | `onDemand` | `onChange` | `always` |
|---|---|---|---|
| brak zapisu | `pending: true`, **bez** wywołania modelu | jw. | generuj |
| zapis, `inputHash` zgodny | zwróć z pamięci | zwróć z pamięci | generuj |
| zapis, `inputHash` inny | zwróć z pamięci + `stale` | generuj | generuj |
| `force` | generuj | generuj | generuj |

`pending: true` oznacza „sekcja czeka na kliknięcie" — **nie** błąd i **nie** pustą treść. To
rozróżnienie jest sednem ryzyka ze spec §9 (Pogoda 038).

### 3.3 Akcje — `src/actions/aiSections.ts` (nowy)

| Funkcja | Rola |
|---|---|
| `getSectionModes()` | tryby wszystkich sekcji dla zalogowanego (z rozwiązaną kolejnością) |
| `setSectionMode(kind, mode)` | zapis preferencji użytkownika; `revalidatePath` modułu |
| `getDefaultSectionModes()` / `setDefaultSectionModes(map)` | **administrator**: systemowe domyślne w `Config`; `logAudit(category: "config")` (C-25) |

Guard: `requireAuth()` + `ownerId` (C-21); akcje administratora przez
`hasPermission(session, PERMISSIONS.ADMIN)`.

### 3.4 Historia przebiegów — `src/actions/news.ts` (rozszerzenie)

- `getNewsRefreshHistory(limit = 10)` — lista przebiegów właściciela; `usage` przepuszczone przez
  `visibleUsage` (AC-16 — nie-administrator nie dostaje danych kosztowych **po stronie serwera**).
- Zapis: handler `news.refresh` na końcu tworzy wiersz `NewsRefreshRun` i przycina historię do 30.
  Handler nie ma sesji, więc zapisuje **surowe** zużycie — bramka widoczności działa przy odczycie
  (ten sam podział co w 039 dla `Job.result`).

### 3.5 Auto-zatwierdzanie — `src/actions/assistantPrefs.ts` (rozszerzenie)

- `updateAssistantPrefs({ autoApprove })` — istniejąca akcja, nowe pole.
- Decyzja „czy wolno auto-zatwierdzić" liczona **wyłącznie** z `DESTRUCTIVE_ACTION_TYPES`
  (`lib/ai/aiAction.ts`) — tego samego zbioru, którego używa `ActionDrawer`. Zero drugiej listy
  (ryzyko ze spec §9).

## 4. RBAC / rejestr modułu (C-22)

**Bez nowych slugów i tras.** Ustawienia systemowe wchodzą do istniejącego `/admin/llm` (tam już są
przełączniki `assistant_followups_enabled` i `ai_cost_badge_enabled` — naturalne sąsiedztwo).
Historia kosztów wchodzi w moduł Wiadomości. Bez zmian w `permissions.ts`/`modules.tsx`.

## 5. UI (C-30, C-31, C-32)

### 5.1 `AiContentMeta` → pasek sekcji AI (rozszerzenie istniejącego)

Jeden pasek pod treścią sekcji, **jedna linia** w spoczynku (AC-5, AC-13):

`wygenerowano 13:52 · [nieaktualne] · ~$0,03 (0,12 zł) · ⟳ Odśwież · ⚙`

- koszt: `AiCostBadge` **wewnątrz** paska (dziś stoi obok — stąd „połącz z komponentem kosztu");
- `⚙` rozwija wybór trybu (trzy pozycje, `py-3`); zwinięty domyślnie, żeby nie przytłaczać;
- stan `pending`: zamiast podpisu — jedno zdanie „Treść powstanie po kliknięciu" + przycisk
  generowania. **Nie** wygląda jak pusty stan po błędzie.

### 5.2 Wpięcie pięciu sekcji

`IdeasPanel` (Pogoda), `HotTopics` (Wiadomości), wnioski Magazynu, wnioski Petów, plan tygodnia
Kuchni — każda: `useEffect` przestaje wołać generowanie bezwarunkowo, a odczyt przechodzi przez tryb.

### 5.3 Historia kosztów Wiadomości

`RefreshStatus` w `NewsPage` zyskuje odnośnik „Historia odświeżeń" → rozwijana lista ostatnich
przebiegów (czas, liczby, koszt z `AiCostBadge`). Widoczna tylko wtedy, gdy `visibleUsage` coś
zwróciło — czyli dla administratora (AC-15, AC-16).

### 5.4 Auto-zatwierdzanie w czacie

- Przełącznik w **rozwijanej sekcji ustawień asystenta** (`headerPanel === "prefs"`), obok poziomu
  pracy — zgodnie z decyzją właściciela.
- Stan widoczny **stale**: gdy włączone, w nagłówku czatu mały znacznik (AC-22) — bo tryb nie może
  działać po cichu.
- Logika w `AICommandSheet`: gdy `autoApprove` i **żadna** akcja nie jest niszcząca → wykonaj od
  razu, pokazując wynik; w przeciwnym razie `ActionDrawer` jak dotąd.

### 5.5 Nawigacja po tematach — `TopicPicker` (nowy, zastępuje `TopicTabs`)

- Zwinięty: jeden przycisk na pełną szerokość — nazwa aktywnego tematu + licznik nowych + `⌄`.
- Rozwinięty: **pionowa** lista wszystkich tematów (pełne nazwy, bez `truncate`), pole wyszukiwania
  nad listą, liczniki przy pozycjach; `Esc` zamyka, `↑↓` nawigują.
- Ten sam komponent na obu szerokościach (AC-25) — na telefonie lista zajmuje pełną szerokość.
- Akcje tematu (dodaj/edytuj/usuń) zostają obok przycisku, jak w 040.

## 6. AI / integracje (C-23, C-40)

**Bez nowych `AIAction`.** Zmienia się sposób **zatwierdzania** istniejących, nie katalog. Bez zmian
w routingu modeli (C-40) — sterujemy momentem wywołania, nie jego treścią.

Manifesty: nowe akcje z `actions/aiSections.ts` i `getNewsRefreshHistory` wymagają wpisów w
`action-coverage.json` (klasyfikacja + `access`), inaczej `check:ai-coverage` zatrzyma build.
`contentMemory.ts` i pliki sekcji pozostają w `content-memory-coverage.json` jako `remembered`.

## 7. Pliki do utworzenia / zmiany

| Plik | Akcja | Po co |
|------|-------|-------|
| `prisma/migrations/0220_kontrola_nad_ai/migration.sql` | nowy | dwie tabele, kolumna, seed `Config` |
| `prisma/schema.prisma` | edycja | `AiSectionPref`, `NewsRefreshRun`, `AssistantPref.autoApprove` |
| `src/lib/ai/sectionMode.ts` | nowy | typ trybu + etykiety PL (czysty, używany też po stronie klienta) |
| `src/lib/ai/sectionModeResolver.ts` | nowy | `resolveSectionMode(s)`, odczyt domyślnych bez sesji |
| `src/lib/ai/contentMemory.ts` | edycja | tryb + `pending` |
| `src/actions/aiSections.ts` | nowy | tryby użytkownika i systemowe (admin) |
| `src/actions/news.ts` | edycja | `getNewsRefreshHistory` |
| `src/actions/assistantPrefs.ts` | edycja | `autoApprove` |
| `src/lib/jobs/handlers/newsRefresh.ts` | edycja | zapis `NewsRefreshRun` + przycięcie do 30 |
| `src/components/ui/AiContentMeta.tsx` | edycja | koszt + tryb + stan `pending` |
| `src/components/weather/IdeasPanel.tsx` | edycja | tryb zamiast bezwarunkowego generowania |
| `src/components/news/HotTopics.tsx` | edycja | jw. |
| `src/app/api/llm/magazynowanie/insights` · `pets` · `kitchen planWeek` (miejsca wywołań) | edycja | jw. |
| `src/components/news/NewsPage.tsx` | edycja | `TopicPicker` zamiast `TopicTabs`; historia odświeżeń |
| `src/components/news/TopicPicker.tsx` | nowy | selektor tematów z wyszukiwarką |
| `src/components/home/AICommandSheet.tsx` | edycja | przełącznik + znacznik + pominięcie szuflady |
| `src/components/admin/*` (`/admin/llm`) | edycja | systemowe domyślne trybów |
| `src/lib/ai/action-coverage.json` | edycja | klasyfikacja nowych akcji |
| `CLAUDE.md`, `doświadczenia.md` | edycja | dokumentacja + lekcje |

## 8. Bramki i weryfikacja (C-50)

Lokalnie, przeciw **lokalnemu** Postgresowi (C-13): `check:migrations` → `check:actions` →
`check:ai-coverage` → `check:cost-badge` → `check:content-memory` → `next lint --dir src` →
`prisma generate` → `next build` → `npm run test:unit`.

| AC | Sposób weryfikacji |
|---|---|
| AC-1, AC-2, AC-3, AC-4 | **Test jednostkowy** `rememberedContent` na żywej bazie: cztery kombinacje (brak/zapis × hash zgodny/inny) × trzy tryby; licznik wywołań `generate` musi się zgadzać |
| AC-5, AC-6, AC-13 | Lektura `AiContentMeta` — jedna linia, koszt wewnątrz, tryb zwinięty, `py-3` |
| AC-7..AC-9 | Test `resolveSectionMode` + tabela decyzyjna z §3.2 |
| AC-10, AC-11 | **Na żywej bazie**: brak preferencji → wartość z `Config`; zmiana `Config` nie rusza `AiSectionPref` i odwrotnie |
| AC-12 | Trwałość: odczyt po ponownym zapytaniu |
| AC-14, AC-17 | **Na żywej bazie**: dwa przebiegi → dwa wiersze `NewsRefreshRun`, oba czytelne; kasowanie `Job` nie usuwa historii |
| AC-15, AC-16 | `getNewsRefreshHistory` przepuszcza `usage` przez `visibleUsage` — test dla admina i nie-admina |
| AC-18, AC-19 | Test logiki decyzyjnej: zestaw akcji bezpiecznych → auto; zestaw z niszczącą → szuflada |
| AC-20 | Trwałość `AssistantPref.autoApprove` |
| AC-21, AC-22 | Lektura `AICommandSheet` — przełącznik w panelu `prefs`, znacznik w nagłówku |
| AC-23..AC-26 | Lektura `TopicPicker`: brak `truncate`, pole wyszukiwania, jeden komponent bez `hidden md:*`, licznik przy zwiniętym |

## 9. Ryzyka techniczne i plan wycofania

- **Zmiana sygnatury `rememberedContent` dotyka pięciu miejsc naraz.** → Nowy parametr jest
  **opcjonalny**, a brak trybu zachowuje dzisiejsze zachowanie; sekcje przełączamy pojedynczo, każda
  osobnym zadaniem.
- **`pending` pomylone z awarią** (ryzyko ze spec §9, dokładnie ta pułapka co w 038). → Osobny stan
  wizualny z jednoznacznym zdaniem po polsku; w kryteriach ma własne AC.
- **Auto-zatwierdzanie omijające szufladę może wykonać coś, czego użytkownik nie chciał.** →
  Wyłącznie akcje spoza `DESTRUCTIVE_ACTION_TYPES`, jedno źródło prawdy z `ActionDrawer`; wynik
  zawsze pokazany w rozmowie.
- **Historia przebiegów rośnie bez końca.** → Przycięcie do 30 przy każdym zapisie.
- **Rollback:** migracja jest addytywna, więc kod można wycofać bez ruszania bazy. Nadmiarowe tabele
  i kolumna zostaną nieużywane, co jest nieszkodliwe.

## 10. Zgodność z konstytucją — checklista

- [x] **C-10..C-14** — ręczna migracja 0220, numer z `next:migration`, tryby jako `String` + union,
      seed `Config` idempotentny z `gen_random_uuid()::text`
- [x] **C-20, C-21** — nowe akcje z `revalidatePath`, guard `requireAuth` + `ownerId`
- [x] **C-22** — bez nowych slugów; admin przez istniejące uprawnienie
- [x] **C-23** — bez nowych `AIAction`; manifesty uzupełnione
- [x] **C-25** — zmiana systemowych domyślnych trafia do `AuditLog` (kategoria `config`)
- [x] **C-30..C-32** — zmienne CSS, cele `py-3`, jeden mechanizm na obu szerokościach, teksty PL
- [x] **C-40** — routing modeli nietknięty
- [x] **C-53** — zero nowych zależności; rozszerzamy `rememberedContent` i `AiContentMeta` zamiast
      budować równoległe mechanizmy; `TopicPicker` zastępuje `TopicTabs`, nie stoi obok
