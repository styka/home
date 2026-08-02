# Weryfikacja: Kontrola nad AI — kiedy generuje, ile kosztuje, co robi bez pytania

- **Spec:** ./spec.md · **Plan:** ./plan.md · **Zadania:** ./tasks.md
- **Data:** 2026-08-02
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
| `prisma migrate diff` | ✅ brak rozjazdu dla `AiSectionPref`/`NewsRefreshRun`/`autoApprove` (widoczne wyłącznie znane, zastane różnice: domyślne `updatedAt` i indeksy `pg_trgm`) |

## 2. Kryteria akceptacji

### Sekcje AI: kiedy generują

| AC | Werdykt | Dowód |
|---|---|---|
| **AC-1** brak generowania bez kliknięcia | ✅ | `contentMemory.ts:150` zwraca `{pending:true}` bez dotknięcia `generate`. Test „brak zapisu: „na żądanie" i „przy zmianie" CZEKAJĄ" **liczy wywołania `generate` i wymaga 0**. UI: `IdeasPanel` → `AiContentPending`, `HotTopics` → jw. |
| **AC-2** zapamiętana treść od razu | ✅ | Test „powrót na stronę NIC nie kosztuje": po `force` drugi odczyt daje `fromMemory:true` i licznik `generate` zostaje na 1 |
| **AC-3** znacznik „aktualne" | ✅ | `stale:false` przy zgodnym `inputHash` (test „zapis + odcisk zgodny"); pasek nie renderuje wtedy znacznika (`AiContentMeta.tsx:82`), a „⟳ Odśwież" jest zwykłym przyciskiem, bez oznaczeń ostrzegawczych |
| **AC-4** „nieaktualne" + treść nie znika | ✅ | Test „na żądanie: brak wywołania mimo zmiany warunków" → `pending:false`, `stale:true`, `generate` wołane **0 razy**; znacznik bursztynowy `AiContentMeta.tsx:83-91` |
| **AC-5** komplet w jednym miejscu | ✅ | `AiCostBadge` renderowany **wewnątrz** `AiContentMeta` (`AiContentMeta.tsx:92`); osobne badge'e usunięte z `IdeasPanel`, `HotTopics`, `StorageAnalytics`, `WelfareSuggestions`, `PlanWeekDialog` (`grep AiCostBadge` w tych plikach: brak) |
| **AC-6** rozbicie per sekcja | ✅ | do paska trafia `usage` **tej** treści (z `AiContent.usage` albo świeżej generacji), nie suma modułu; rozwinięcie `AiCostBadge` pokazuje `calls[]` |

### Sekcje AI: ustawienia trybu

| AC | Werdykt | Dowód |
|---|---|---|
| **AC-7** trzy tryby | ✅ | `AI_SECTION_MODE_LABELS` (`sectionMode.ts`) = `onDemand`/`onChange`/`always`; wybór pod „⚙" (`AiContentMeta.tsx:116-138`) → `setSectionMode` |
| **AC-8** „na żądanie" nie woła modelu | ✅ | jw. AC-1; test wielokrotnego wejścia („powrót na stronę") potwierdza brak wywołań przy kolejnych odczytach |
| **AC-9** „przy zmianie danych" | ✅ | Test „przy zmianie: dokładnie jedno wywołanie" (hash inny) **oraz** „zapis + odcisk zgodny → ZERO wywołań" (hash ten sam) |
| **AC-10** dziedziczenie po administratorze | ✅ | Test „brak preferencji → dziedziczenie po administratorze (Config)"; sekcja nieopisana w `Config` spada do `onDemand`, a nie do sąsiedniej |
| **AC-11** własne ≠ systemowe | ✅ | Test „własne i systemowe to dwa rozłączne zapisy": po zapisie preferencji `Config` jest bit w bit ten sam, a po zmianie `Config` preferencja zostaje `always` |
| **AC-12** trwałość | ✅ | `AiSectionPref` (upsert po `[ownerId, sectionKind]`, migracja 0220); odczyt bezstanowy przez `resolveSectionMode` |
| **AC-13** dostępne kciukiem, subtelne | ⚠️ **częściowo** | **Subtelność ✅** (jedna linia w spoczynku, wybór trybu zwinięty). **Kciuk ❌** dla paska w spoczynku: „⟳ Odśwież" i „⚙" mają `px-1.5 py-1` przy tekście 11 px (`AiContentMeta.tsx:94,105`) ≈ 23 px wysokości, a wyzwalacz kosztu ma `padding: 0` przy 10,5 px (`AiCostBadge.tsx:159-163`) ≈ 14 px — poniżej minimum `py-3` z C-31. Rozwinięta lista trybów i przycisk generowania **spełniają** `py-3` (`AiContentMeta.tsx:125,183`) |

### Koszt przebiegu wiadomości

| AC | Werdykt | Dowód |
|---|---|---|
| **AC-14** koszt czytelny po fakcie | ✅ | `NewsRefreshRun` (migracja 0220) + `recordRun` na obu ścieżkach handlera; test „skasowanie zadania z kolejki NIE usuwa historii" odtwarza dokładnie to, co robi `cleanupOldJobs` po 24 h |
| **AC-15** szczegóły dla administratora | ✅ | `usage` zapisywane jako pełny `AiUsageInfo` z tablicą `calls` (etykiety etapów z `sink`), `parseStoredUsage` odrzuca wpis bez `calls`; `AiCostBadge` rozwija rozbicie per wywołanie |
| **AC-16** nie-administrator bez danych kosztowych | ✅ | `getNewsRefreshHistory` przepuszcza każdy wiersz przez `visibleUsage` (`news.ts`) — kontrola jest **serwerowa**, dane nie idą na drut |
| **AC-17** rozróżnialne przebiegi | ✅ | Test „dwa przebiegi = dwa wiersze, każdy z własnymi liczbami"; widok listuje czas + liczby + koszt per wiersz, nieudane mają czerwony komunikat |

### Auto-zatwierdzanie akcji asystenta

| AC | Werdykt | Dowód |
|---|---|---|
| **AC-18** bezpieczne bez klikania | ✅ | `AICommandSheet.tsx` (gałąź `data.step === "plan"`): `autoApproveRef.current && actions.length > 0 && !actions.some(isDestructiveAction)` → `handleExecute(planTurn, actions)`; wynik ląduje w **tej samej** turze planu (`done:true, results`), więc widać, co zostało zrobione |
| **AC-19** niszczące nadal pytają | ✅ | Warunek `!actions.some(...)` — **jedna** akcja niszcząca kieruje cały plan do szuflady. Klasyfikacja wyłącznie przez `isDestructiveAction` → `DESTRUCTIVE_ACTION_TYPES` (`lib/ai/aiAction.ts:36,74`), tego samego zbioru używa `ActionDrawer.tsx:25`. `grep` nie pokazuje drugiej listy |
| **AC-20** trwałość między sesjami | ✅ | Kolumna `AssistantPref.autoApprove` (migracja 0220, `DEFAULT false`); odczyt w `getAssistantPrefs`, zapis w `updateAssistantPrefs` |
| **AC-21** przełączanie bez opuszczania czatu | ✅ | Przełącznik na dole menu poziomu pracy, nad kompozytorem, `role="menuitemcheckbox"`; menu zostaje otwarte po kliknięciu (potwierdzenie zmiany stanu) |
| **AC-22** widoczny stan trybu | ✅ | Znacznik „auto" w nagłówku czatu renderowany dopóki `autoApprove` (`AICommandSheet.tsx`, sekcja Header) — widoczny przez całą rozmowę, nie tylko przy przełączaniu |

### Nawigacja po tematach

| AC | Werdykt | Dowód |
|---|---|---|
| **AC-23** pełne nazwy, dwa kroki | ✅ | `TopicPicker.tsx`: pozycja listy ma `break-words`, **bez** `truncate`; wybór = rozwiń + kliknij. Lista przewija się pionowo (`max-h-[60vh] overflow-y-auto`), poziomo nie ma czego przewijać |
| **AC-24** wyszukiwanie | ✅ | Pole nad listą, filtr po tytule **i** filtrze semantycznym; autofokus po rozwinięciu |
| **AC-25** jeden mechanizm | ✅ | `grep "hidden md:"` w `TopicPicker.tsx` → brak dopasowań; jeden komponent na obu szerokościach |
| **AC-26** aktywny temat + licznik | ✅ | Zwinięty przycisk: nazwa aktywnego tematu + `pendingCount` + `⌄`. *(Nazwa aktywnego ma tu `truncate` — świadomie: AC-23 wymaga pełnych nazw przy WYBORZE, a zwinięty stan ma zostać jedną linią; `min-w-0` chroni przed poziomym rozpychaniem strony.)* |

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
| **C-30** | ✅ wyłącznie zmienne CSS (`var(--accent-*)`, `var(--on-accent)` na przycisku generowania); brak hexów w nowym kodzie |
| **C-31** | ⚠️ patrz AC-13 — rozwinięte kontrolki mają `py-3`, pasek w spoczynku nie |
| **C-32** | ✅ wszystkie nowe teksty po polsku |
| **C-40** | ✅ routing modeli nietknięty — sterujemy momentem wywołania |
| **C-53** | ✅ zero nowych zależności; `rememberedContent` i `AiContentMeta` rozszerzone zamiast dublowane; `TopicPicker` **zastępuje** `TopicTabs`, nie stoi obok |
| **C-54** | ✅ dwa odstępstwa od planu naniesione w `plan.md` (§3.1 podział `sectionMode`, §5.4 miejsce przełącznika) i w `tasks.md` (T-15) |

## 4. Regresje

- **Migracja** — w całości addytywna (brak `DROP`), więc poprzednia wersja kodu działa na nowym
  schemacie; `migrate deploy` na czystej bazie przeszedł, `migrate diff` nie pokazuje rozjazdu.
- **Wspólny komponent `AiContentMeta`** — używany w 5 miejscach; wszystkie przebudowane i objęte
  `next build`. Nowe pola (`usage`, `sectionKind`, `mode`) są **opcjonalne**, więc brak któregoś nie
  wyłącza paska.
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

**DO POPRAWY** — jeden brak, wąski i konkretny.

Dwadzieścia pięć z dwudziestu sześciu kryteriów jest spełnionych z dowodem, wszystkie bramki są
zielone, a testy przeszły w komplecie. Nie schodzi **AC-13** w części „dostępne kciukiem": trzy
kontrolki paska sekcji AI w stanie spoczynku (odśwież / tryb / koszt) mają cele dotyku rzędu 14–23 px,
przy minimum `py-3` z C-31. To nie jest kwestia gustu — AC wymienia dokładnie te trzy kontrolki, a
C-31 podaje twardą wartość.

Brak **nie** wynika z błędnego speca ani planu (plan §5.1 przewidywał `py-3`), więc poprawka dotyczy
wyłącznie kodu — bez zawracania do `spec.md`/`plan.md`.

### Braki dopisane do `tasks.md`

- **T-21** — powiększyć cele dotyku w pasku sekcji AI w stanie spoczynku (przycisk odświeżania,
  przycisk trybu, wyzwalacz kosztu) do minimum z C-31, **nie rozbijając** paska na dwie linie i nie
  tracąc subtelności, o którą właściciel prosił wprost (spec §9).
