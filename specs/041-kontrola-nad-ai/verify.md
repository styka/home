# Weryfikacja: Kontrola nad AI — kiedy generuje, ile kosztuje, co robi bez pytania

- **Spec:** ./spec.md · **Plan:** ./plan.md · **Zadania:** ./tasks.md
- **Data:** 2026-08-02 (przebieg drugi, po nawrocie do `/implement` z zadaniem T-21)
- **Środowisko:** lokalny PostgreSQL 16 (`127.0.0.1:5432/omnia_dev`) — **nigdy prod DB** (C-13);
  sekwencja zatrzymana przed `scripts/migrate.js`.

## 1. Bramki

| Komenda | Wynik |
|---|---|
| `npm run check:migrations` | ✅ „Numeracja migracji OK (następny wolny numer: 0221)" |
| `npm run check:actions` | ✅ 160 akcji, komplet egzekutorów + kontrakt (372 parametry z etykietami PL) |
| `npm run check:ai-coverage` | ✅ 539 akcji: komplet klasyfikacji **i** guardów w kodzie |
| `npm run check:cost-badge` | ✅ 34 pliki wołające model, każdy przekazuje zużycie |
| `npm run check:content-memory` | ✅ 34 pliki (5 z pamięcią treści, 29 narzędzi na żądanie) |
| `npx next lint --dir src` | ✅ **0 błędów**, 16 ostrzeżeń (wszystkie zastane: `exhaustive-deps`, `<img>`) |
| `npx next build` | ✅ „Compiled successfully" |
| `npm run test:unit` | ✅ **585/585** (przed 041: 567 — +18 nowych) |
| `prisma migrate deploy` | ✅ `0220_kontrola_nad_ai` zaaplikowana czysto |
| `prisma migrate diff` | ✅ brak rozjazdu dla `AiSectionPref`/`NewsRefreshRun`/`autoApprove` |

> **Uwaga metodyczna.** Jeden przebieg `test:unit` pokazał 48 czerwonych. To **nie była regresja**:
> lokalny Postgres padł między uruchomieniami, a testy DB-gated przy ustawionym `DATABASE_URL` i
> martwym serwerze **wywalają się**, zamiast się pominąć. Po `pg_ctlcluster 16 main start` wynik
> wrócił do 585/585. Dokładnie ta pułapka jest już opisana w `doświadczenia.md` (2026-08-01).

## 2. Kryteria akceptacji

### Sekcje AI: kiedy generują

| AC | Werdykt | Dowód |
|---|---|---|
| **AC-1** brak generowania bez kliknięcia | ✅ | `contentMemory.ts` zwraca `{pending:true}` bez dotknięcia `generate`. Test „brak zapisu: „na żądanie" i „przy zmianie" CZEKAJĄ" **liczy wywołania `generate` i wymaga 0**. UI: `IdeasPanel`/`HotTopics`/`WelfareSuggestions` → `AiContentPending` |
| **AC-2** zapamiętana treść od razu | ✅ | Test „powrót na stronę NIC nie kosztuje": po `force` drugi odczyt daje `fromMemory:true`, licznik `generate` zostaje na 1 |
| **AC-3** znacznik „aktualne" | ✅ | `stale:false` przy zgodnym `inputHash` (test „zapis + odcisk zgodny"); pasek nie renderuje wtedy znacznika, a „⟳ Odśwież" jest zwykłym przyciskiem bez oznaczeń ostrzegawczych |
| **AC-4** „nieaktualne" + treść nie znika | ✅ | Test „na żądanie: brak wywołania mimo zmiany warunków" → `pending:false`, `stale:true`, `generate` wołane **0 razy**; znacznik bursztynowy w `AiContentMeta` |
| **AC-5** komplet w jednym miejscu | ✅ | `AiCostBadge` renderowany **wewnątrz** `AiContentMeta:94`; osobne badge'e usunięte z `IdeasPanel`, `HotTopics`, `StorageAnalytics`, `WelfareSuggestions`, `PlanWeekDialog` |
| **AC-6** rozbicie per sekcja | ✅ | do paska trafia `usage` **tej** treści (z `AiContent.usage` albo świeżej generacji), nie suma modułu; rozwinięcie pokazuje `calls[]` |

### Sekcje AI: ustawienia trybu

| AC | Werdykt | Dowód |
|---|---|---|
| **AC-7** trzy tryby | ✅ | `AI_SECTION_MODE_LABELS` = `onDemand`/`onChange`/`always`; wybór pod „⚙" (`AiContentMeta:119-143`) → `setSectionMode` |
| **AC-8** „na żądanie" nie woła modelu | ✅ | jw. AC-1; test wielokrotnego wejścia potwierdza brak wywołań przy kolejnych odczytach |
| **AC-9** „przy zmianie danych" | ✅ | Test „przy zmianie: dokładnie jedno wywołanie" (hash inny) **oraz** „zapis + odcisk zgodny → ZERO wywołań" (hash ten sam) |
| **AC-10** dziedziczenie po administratorze | ✅ | Test „brak preferencji → dziedziczenie po administratorze (Config)"; sekcja nieopisana w `Config` spada do `onDemand` |
| **AC-11** własne ≠ systemowe | ✅ | Test „własne i systemowe to dwa rozłączne zapisy": po zapisie preferencji `Config` jest bit w bit ten sam, a po zmianie `Config` preferencja zostaje `always` |
| **AC-12** trwałość | ✅ | `AiSectionPref` (upsert po `[ownerId, sectionKind]`, migracja 0220) |
| **AC-13** dostępne kciukiem, subtelne | ✅ **(naprawione w T-21)** | **Kciuk:** „⟳ Odśwież" i „⚙" mają `px-2 py-3` (`AiContentMeta:99,110`) → ≈40 px; wyzwalacz kosztu `padding: "12px 6px"` (`AiCostBadge:159-168`) → ≈37 px; lista trybów i przycisk generowania `py-3` (`:130`, `:190`). **Subtelność:** pasek nadal **jedna linia**, tekst 11 px w `--text-muted`, wybór trybu i rozbicie kosztu zwinięte |

### Koszt przebiegu wiadomości

| AC | Werdykt | Dowód |
|---|---|---|
| **AC-14** koszt czytelny po fakcie | ✅ | `NewsRefreshRun` + `recordRun` na obu ścieżkach handlera; test „skasowanie zadania z kolejki NIE usuwa historii" odtwarza dokładnie to, co robi `cleanupOldJobs` po 24 h |
| **AC-15** szczegóły dla administratora | ✅ | `usage` zapisywane jako pełny `AiUsageInfo` z tablicą `calls` (etykiety etapów z `sink`), `parseStoredUsage` odrzuca wpis bez `calls`; `AiCostBadge` rozwija rozbicie per wywołanie |
| **AC-16** nie-administrator bez danych kosztowych | ✅ | `getNewsRefreshHistory` przepuszcza każdy wiersz przez `visibleUsage` — kontrola **serwerowa**, dane nie idą na drut |
| **AC-17** rozróżnialne przebiegi | ✅ | Test „dwa przebiegi = dwa wiersze, każdy z własnymi liczbami"; widok listuje czas + liczby + koszt per wiersz, nieudane mają czerwony komunikat |

### Auto-zatwierdzanie akcji asystenta

| AC | Werdykt | Dowód |
|---|---|---|
| **AC-18** bezpieczne bez klikania | ✅ | `AICommandSheet` (gałąź `data.step === "plan"`): `autoApproveRef.current && actions.length > 0 && !actions.some(isDestructiveAction)` → `handleExecute(planTurn, actions)`; wynik ląduje w **tej samej** turze planu (`done:true, results`) |
| **AC-19** niszczące nadal pytają | ✅ | Warunek `!actions.some(...)` — **jedna** akcja niszcząca kieruje cały plan do szuflady. Klasyfikacja przez `isDestructiveAction` → `DESTRUCTIVE_ACTION_TYPES` (`aiAction.ts:36,74`), tego samego zbioru używa `ActionDrawer.tsx:25`. `grep` nie pokazuje drugiej listy |
| **AC-20** trwałość między sesjami | ✅ | Kolumna `AssistantPref.autoApprove` (migracja 0220, `DEFAULT false`); odczyt w `getAssistantPrefs`, zapis w `updateAssistantPrefs` |
| **AC-21** przełączanie bez opuszczania czatu | ✅ | Przełącznik na dole menu poziomu pracy, nad kompozytorem, `role="menuitemcheckbox"`; menu zostaje otwarte po kliknięciu — zgodnie z odpowiedzią właściciela „przy akcjach ustawiania jakości asystenta na dole" |
| **AC-22** widoczny stan trybu | ✅ | Znacznik „auto" w nagłówku czatu renderowany dopóki `autoApprove` — widoczny przez całą rozmowę, nie tylko przy przełączaniu |

### Nawigacja po tematach

| AC | Werdykt | Dowód |
|---|---|---|
| **AC-23** pełne nazwy, dwa kroki | ✅ | `TopicPicker.tsx`: pozycja listy ma `break-words`, **bez** `truncate`; wybór = rozwiń + kliknij. Lista przewija się pionowo (`max-h-[60vh]`), poziomo nie ma czego przewijać |
| **AC-24** wyszukiwanie | ✅ | Pole nad listą, filtr po tytule **i** filtrze semantycznym; autofokus po rozwinięciu |
| **AC-25** jeden mechanizm | ✅ | `grep "hidden md:"` w `TopicPicker.tsx` → brak dopasowań |
| **AC-26** aktywny temat + licznik | ✅ | Zwinięty przycisk: nazwa aktywnego tematu + `pendingCount` + `⌄`. *(Nazwa aktywnego ma `truncate` — świadomie: AC-23 wymaga pełnych nazw przy WYBORZE, a zwinięty stan ma zostać jedną linią; `min-w-0` chroni przed poziomym rozpychaniem strony.)* |

**Wynik: 26/26 spełnionych.**

## 3. Zgodność z konstytucją

| Reguła | Wynik |
|---|---|
| **C-10, C-11** | ✅ ręczna migracja `0220_kontrola_nad_ai`, numer z `next:migration`, `check:migrations` zielony |
| **C-12** | ✅ `mode` i `status` to `String` + union TS; zero enumów Prisma |
| **C-13** | ✅ cała weryfikacja na lokalnym Postgresie; `scripts/migrate.js` **nie** uruchamiany |
| **C-14** | ✅ seed `Config.ai_section_default_modes` idempotentny (`gen_random_uuid()::text`, `ON CONFLICT DO NOTHING`) |
| **C-20** | ✅ `setSectionMode`/`clearSectionMode`/`setDefaultSectionModes` kończą `revalidatePath` |
| **C-21** | ✅ `requireAuth()` + zapis/odczyt wyłącznie po `ownerId` z sesji |
| **C-22** | ✅ bez nowych slugów; administrator przez `hasPermission(..., PERMISSIONS.ADMIN)` |
| **C-23** | ✅ zero nowych `AIAction`; zmienia się sposób ZATWIERDZANIA, nie katalog |
| **C-25** | ✅ `setDefaultSectionModes` → `logAudit("config", "ai_section_modes.set", …)` |
| **C-30** | ✅ wyłącznie zmienne CSS; `var(--on-accent)` na przycisku generowania |
| **C-31** | ✅ **po T-21** — wszystkie kontrolki sekcji AI mają cel dotyku ≥ `py-3` |
| **C-32** | ✅ wszystkie nowe teksty po polsku |
| **C-40** | ✅ routing modeli nietknięty — sterujemy momentem wywołania |
| **C-53** | ✅ zero nowych zależności; `rememberedContent` i `AiContentMeta` rozszerzone zamiast dublowane; `TopicPicker` **zastępuje** `TopicTabs` |
| **C-54** | ✅ trzy ślady: `plan.md` §3.1 (podział `sectionMode`), `plan.md` §5.4 (miejsce przełącznika), `tasks.md` Faza 8 (T-21 z nawrotu) |

## 4. Regresje

- **Migracja** — w całości addytywna (brak `DROP`), więc poprzednia wersja kodu działa na nowym
  schemacie; `migrate deploy` przeszedł, `migrate diff` nie pokazuje rozjazdu.
- **`AiCostBadge` — zmiana o zasięgu całej aplikacji.** T-21 dołożył wskaźnikowi realny padding, więc
  urósł jego obszar klikalny w **~20 miejscach** (asystent, Kuchnia, Magazyn, Zakupy, Języki, Pogoda,
  Wiadomości, Zadania). To **zamierzone**: `padding: 0` łamało C-31 wszędzie, nie tylko w pasku sekcji.
  Rozmiar i kolor tekstu bez zmian, więc waga wizualna została; rośnie wyłącznie wysokość wiersza,
  w którym wskaźnik stoi. Świadomie **bez** ujemnego marginesu kompensującego — wyciągnięty obszar
  dotyku zachodziłby wtedy na sąsiedni wiersz przy zawinięciu paska, a nakładające się cele dotyku są
  gorsze od paska wyższego o kilkanaście pikseli. Pozycjonowanie rozwijanego panelu kosztu jest liczone
  z **opakowania** (`wrapRef`), nie z przycisku, więc padding go nie rusza.
- **Wspólny komponent `AiContentMeta`** — używany w 5 miejscach; wszystkie przebudowane i objęte
  `next build`. Nowe pola (`usage`, `sectionKind`, `mode`) są **opcjonalne**.
- **`rememberedContent`** — sygnatura rozszerzona przez **przeciążenia**: wywołanie bez `mode`
  zachowuje zachowanie sprzed 041 (test „brak trybu = zachowanie sprzed 041"). Żaden dotychczasowy
  wołający nie musiał obsłużyć nowego stanu.
- **Kolejka zadań** — `newsRefreshHandler` opakowany; ścieżka błędu nadal **rzuca** dalej (zadanie
  kończy się `FAILED`), a zapis kroniki jest w `try/catch`, więc awaria historii nie zabiera
  użytkownikowi wyniku odświeżania.
- **RBAC** — brak nowych slugów i tras; `/admin/llm` nadal za `PERMISSIONS.ADMIN` (guard w `page.tsx`
  **i** w akcjach).
- **Testy** — 585/585, żaden zastany test nie zmienił wyniku.

## 5. Werdykt końcowy

**GOTOWE.**

Wszystkie **26 kryteriów akceptacji** spełnione z dowodem, wszystkie bramki zielone, testy w
komplecie (585/585). Jedyny brak z pierwszego przebiegu (AC-13 — cele dotyku poniżej `py-3`) został
domknięty zadaniem T-21 i zweryfikowany ponownie.

Czego **nie** dało się sprawdzić automatycznie i co zostaje do oceny wzrokowej na środowisku
testowym: rzeczywisty odbiór proporcji paska sekcji AI po powiększeniu przycisków (jedna linia
zgodnie z prośbą o subtelność — sprawdzone w kodzie, nie na ekranie) oraz wygląd wskaźnika kosztu w
~20 miejscach, gdzie wiersz urósł o kilkanaście pikseli.
