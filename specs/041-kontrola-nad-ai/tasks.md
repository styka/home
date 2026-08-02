# Zadania: Kontrola nad AI — kiedy generuje, ile kosztuje, co robi bez pytania

- **Plan:** ./plan.md (041-kontrola-nad-ai)
- **Status:** zaimplementowane (wejście do `/verify`)
- **Data:** 2026-08-01

> **Zasada listy:** od najłatwiejszego do najtrudniejszego, zgodnie z zależnościami. Trzy zgłoszenia
> (nawigacja, auto-zatwierdzanie, historia kosztów) są **niezależne** od przebudowy sekcji AI — idą
> osobnymi ścieżkami, więc da się je wdrożyć nawet gdyby rdzeń się przeciągnął.

## Legenda
- `[ ]` do zrobienia · `[x]` zrobione · `[~]` w trakcie · `[!]` zablokowane
- `[P]` — niezależne od poprzedniego, można robić równolegle

---

## Faza 0 — Nawigacja po tematach (zgłoszenie 1, bez zależności)

- [x] **T-1** `[P]` — **`TopicPicker` zamiast `TopicTabs`.** Zwinięty: jeden przycisk na pełną
      szerokość (nazwa aktywnego tematu + licznik nowych + `⌄`). Rozwinięty: pionowa lista wszystkich
      tematów z **pełnymi nazwami** (bez `truncate`), pole wyszukiwania nad listą, liczniki przy
      pozycjach, `Esc` zamyka. Jeden komponent na obu szerokościach — **bez** wariantów `hidden md:*`.
      Akcje tematu (dodaj/edytuj/usuń) zostają obok przycisku jak w 040.
      *Gotowe, gdy:* wybór tematu to dwa kroki, pełne nazwy widoczne, wyszukiwanie zawęża listę, a
      `grep` nie pokazuje `truncate` ani `hidden md:` w komponencie. **(AC-23..AC-26)**

## Faza 1 — Fundament danych

- [x] **T-2** — **Migracja `0220_kontrola_nad_ai`.** DDL wg planu §2.4: `CREATE TABLE
      "AiSectionPref"` (+ unique `[ownerId, sectionKind]`, FK cascade), `CREATE TABLE
      "NewsRefreshRun"` (+ index `[ownerId, finishedAt]`, FK cascade), `ALTER TABLE "AssistantPref"
      ADD COLUMN "autoApprove"`, idempotentny seed `Config.ai_section_default_modes`
      (**`gen_random_uuid()::text` dla `id`** — `Config.id` nie ma domyślnej wartości).
      *Gotowe, gdy:* `npm run check:migrations` przechodzi, `migrate deploy` na lokalnym Postgresie
      kończy się czysto, a wiersz `Config` istnieje z poprawnym JSON-em.

- [x] **T-3** — **`schema.prisma`** zgodnie z migracją: dwa nowe modele, kolumna `autoApprove`,
      relacje w `User`. Tryby jako `String` (C-12).
      *Gotowe, gdy:* `prisma generate` przechodzi, `migrate diff` nie pokazuje rozjazdu.

## Faza 2 — Tryb sekcji AI (rdzeń)

- [x] **T-4** — **`src/lib/ai/sectionMode.ts` + test.** `AiSectionMode` (`onDemand|onChange|always`)
      z etykietami PL, `resolveSectionMode(ownerId, kind)` (preferencja → `Config` → `onDemand`),
      `readDefaultSectionModes()` bez sesji (wzorzec `readCostBadgeEnabled`).
      *Gotowe, gdy:* test pokrywa **całą kolejność rozstrzygania**, w tym brak obu źródeł i
      uszkodzony JSON w `Config` (ma degradować do `onDemand`, nie wysypywać strony). **(AC-10)**

- [x] **T-5** — **`rememberedContent` z trybem i stanem `pending`.** Nowy, **opcjonalny** parametr
      `mode`; brak trybu = dzisiejsze zachowanie. Tabela decyzyjna wg planu §3.2; wynik zyskuje
      `pending: boolean`.
      *Gotowe, gdy:* test na żywej bazie sprawdza **wszystkie** kombinacje (brak zapisu / zapis+hash
      zgodny / zapis+hash inny) × trzy tryby × `force`, licząc **wywołania `generate`** — bo to one,
      a nie wynik, decydują o koszcie. **(AC-1..AC-4, AC-8, AC-9)**

- [x] **T-6** — **`src/actions/aiSections.ts`.** `getSectionModes`, `setSectionMode(kind, mode)`
      (użytkownik), `getDefaultSectionModes`/`setDefaultSectionModes` (**administrator**, z
      `logAudit` kategorii `config` — C-25). Guardy: `requireAuth` + `ownerId`; admin przez
      `hasPermission(...ADMIN)`. `revalidatePath` na końcu każdej mutacji.
      *Gotowe, gdy:* zapis preferencji użytkownika **nie rusza** `Config` i odwrotnie (to jest AC-11),
      a `check:ai-coverage` przechodzi z nowymi wpisami. **(AC-7, AC-11, AC-12)**

## Faza 3 — Wspólny pasek sekcji AI

- [x] **T-7** — **`AiContentMeta` wchłania koszt i tryb.** Jedna linia w spoczynku: „wygenerowano …
      · [nieaktualne] · koszt · ⟳ Odśwież · ⚙"; `⚙` rozwija wybór trybu (`py-3`, zwinięty domyślnie).
      Osobny stan `pending`: zdanie „Treść powstanie po kliknięciu" + przycisk — **wyraźnie inny** od
      pustego stanu po błędzie.
      *Gotowe, gdy:* `AiCostBadge` stoi **wewnątrz** paska (nie obok), a stan oczekiwania nie da się
      pomylić z awarią. **(AC-5, AC-6, AC-13)**

- [x] **T-8** — **Pogoda: `IdeasPanel` na tryb.** `useEffect` przestaje wołać generowanie
      bezwarunkowo; odczyt przez `rememberedContent` z rozwiązanym trybem; obsługa `pending`.
      *Gotowe, gdy:* wejście na `/pogoda` przy trybie „na żądanie" **nie woła modelu ani razu**.
      **(AC-1, AC-2, AC-8)**

- [x] **T-9** `[P]` — **Wiadomości: `HotTopics` na tryb.** Jak wyżej, dla gorących tematów.
      *Gotowe, gdy:* wejście na zakładkę nie generuje bez kliknięcia.

- [x] **T-10** `[P]` — **Pozostałe trzy sekcje na tryb:** wnioski Magazynu, wnioski Petów, plan
      tygodnia Kuchni.
      *Gotowe, gdy:* wszystkie pięć sekcji przechodzi przez ten sam mechanizm, a `check:content-memory`
      jest zielony.

## Faza 4 — Historia kosztów Wiadomości (zgłoszenie 4)

- [x] **T-11** — **Zapis przebiegu.** Handler `news.refresh` na końcu tworzy `NewsRefreshRun`
      (liczby + **surowe** zużycie, bo handler nie ma sesji) i przycina historię do 30 ostatnich.
      *Gotowe, gdy:* dwa przebiegi = dwa wiersze, a skasowanie zadania z kolejki **nie usuwa**
      historii. **(AC-14, AC-17)**

- [x] **T-12** — **Odczyt i widok.** `getNewsRefreshHistory(limit)` z `visibleUsage` przy odczycie;
      w `NewsPage` odnośnik „Historia odświeżeń" → rozwijana lista (czas, liczby, koszt).
      *Gotowe, gdy:* administrator widzi szczegóły kosztu, a nie-administrator **nie dostaje danych
      kosztowych po stronie serwera**. **(AC-15, AC-16)**

## Faza 5 — Auto-zatwierdzanie akcji asystenta (zgłoszenie 3)

- [x] **T-13** — **`AssistantPref.autoApprove` + akcja.** Rozszerzenie istniejącego
      `updateAssistantPrefs`.
      *Gotowe, gdy:* ustawienie przeżywa ponowne wejście. **(AC-20)**

- [x] **T-14** — **Logika pomijania szuflady.** Gdy `autoApprove` **i żadna** akcja nie należy do
      `DESTRUCTIVE_ACTION_TYPES` → wykonaj od razu i pokaż wynik; w przeciwnym razie `ActionDrawer`
      jak dotąd. Klasyfikacja **wyłącznie** z `lib/ai/aiAction.ts` — zero drugiej listy.
      *Gotowe, gdy:* zestaw akcji bezpiecznych idzie bez kliknięcia, a zestaw z jedną niszczącą
      **nadal otwiera szufladę**. **(AC-18, AC-19)**

- [x] **T-15** — **UI przełącznika.** Przełącznik **na dole menu poziomu pracy asystenta** (nad
      kompozytorem) — zgodnie z decyzją właściciela „przy akcjach ustawiania jakości asystenta na
      dole". *(Korekta z `/implement`: poziom pracy nie mieszka w panelu `prefs`, tylko we własnym
      menu — patrz plan §5.4.)* Stan widoczny **stale** w nagłówku czatu, gdy włączony.
      *Gotowe, gdy:* da się przełączyć bez opuszczania czatu, a z ekranu widać, że tryb działa.
      **(AC-21, AC-22)**

## Faza 6 — Ustawienia administratora

- [x] **T-16** — **Systemowe domyślne w `/admin/llm`.** Sekcja z listą sekcji AI i wyborem trybu
      domyślnego; sąsiedztwo istniejących przełączników (`assistant_followups_enabled`,
      `ai_cost_badge_enabled`).
      *Gotowe, gdy:* zmiana domyślnych wpływa na użytkowników **bez** własnej preferencji i trafia do
      dziennika zmian. **(AC-10, AC-11)**

## Faza 8 — Nawrót z `/verify` (2026-08-02)

- [x] **T-21** — **Cele dotyku w pasku sekcji AI (C-31, AC-13).** W stanie spoczynku przycisk
      odświeżania i przycisk trybu mają `px-1.5 py-1` przy tekście 11 px (≈23 px), a wyzwalacz kosztu
      `padding: 0` przy 10,5 px (≈14 px) — poniżej minimum `py-3`. Powiększyć **obszar dotyku**, nie
      wagę wizualną: pasek ma zostać jedną linią i pozostać subtelny (prośba właściciela, spec §9).
      *Gotowe, gdy:* wszystkie trzy kontrolki mają cel dotyku ≥ `py-3`, a pasek nadal mieści się w
      jednej linii na telefonie i nie przytłacza treści. **(AC-13)**

## Faza 7 — Bramki i domknięcie

- [x] **T-17** — **Pełna sekwencja bramek na lokalnym Postgresie (C-13):** `copy-docs →
      check:actions → check:ai-coverage → check:cost-badge → check:content-memory →
      check:migrations → next lint → prisma generate → next build` + `npm run test:unit`.
      **Bez** `scripts/migrate.js`.
      *Gotowe, gdy:* wszystkie kroki zielone. **(C-50)**

- [x] **T-18** — **Dokumentacja** — `CLAUDE.md`: tryby sekcji AI (nowy mechanizm przekrojowy),
      historia przebiegów Wiadomości, auto-zatwierdzanie, selektor tematów; nowe modele w schemacie.

- [x] **T-19** — **`doświadczenia.md` (C-51)** — wpisy o tym, co wyszło nieoczywistego (spodziewane:
      `NULL != NULL` w unique PostgreSQL jako powód wyboru `Config` zamiast wiersza systemowego).

- [x] **T-20** — **Mapowanie AC → wynik** jako wejście do `/verify`.

---

## Mapowanie kryteriów akceptacji na zadania

| AC | Zadanie(a) |
|---|---|
| AC-1 brak generowania bez kliknięcia | T-5, T-8 |
| AC-2 zapamiętana treść widoczna od razu | T-5, T-8 |
| AC-3 znacznik „aktualne" | T-5, T-7 |
| AC-4 znacznik „nieaktualne", treść nie znika | T-5, T-7 |
| AC-5 komplet w jednym miejscu | T-7 |
| AC-6 rozbicie kosztu per sekcja | T-7 |
| AC-7 wybór jednego z trzech trybów | T-6, T-7 |
| AC-8 „na żądanie" nie woła modelu | T-5, T-8 |
| AC-9 „przy zmianie danych" reaguje na hash | T-5 |
| AC-10 dziedziczenie po administratorze | T-4, T-16 |
| AC-11 własne ≠ systemowe | T-6, T-16 |
| AC-12 trwałość ustawienia | T-6 |
| AC-13 subtelność i dostępność kciukiem | T-7, **T-21** |
| AC-14 koszt czytelny po fakcie | T-11 |
| AC-15 szczegóły dla administratora | T-12 |
| AC-16 nie-administrator bez danych kosztowych | T-12 |
| AC-17 rozróżnialne przebiegi | T-11 |
| AC-18 bezpieczne bez klikania | T-14 |
| AC-19 niszczące nadal pytają | T-14 |
| AC-20 trwałość między sesjami | T-13 |
| AC-21 przełączanie bez opuszczania czatu | T-15 |
| AC-22 widoczny stan trybu | T-15 |
| AC-23 pełne nazwy, dwa kroki | T-1 |
| AC-24 wyszukiwanie tematów | T-1 |
| AC-25 jeden mechanizm na obu szerokościach | T-1 |
| AC-26 widoczny temat aktywny + licznik | T-1 |

## Ścieżka krytyczna

```
T-2 (migracja) → T-3 (schemat) → T-4 (tryb) → T-5 (pamięć) → T-7 (pasek) → T-8/T-9/T-10 (sekcje)
                              ↘ T-6 (akcje) → T-16 (admin)
                              ↘ T-11 → T-12 (historia kosztów)
                              ↘ T-13 → T-14 → T-15 (auto-zatwierdzanie)

T-1 (nawigacja)  — bez żadnych zależności, może iść pierwsza
```

- **Blokuje najwięcej:** `T-2`/`T-3` — bez nich nie istnieją typy dla trybu, historii i `autoApprove`.
- **Sedno:** `T-5` — dopóki `rememberedContent` nie zna trybu, żadna sekcja nie spełni AC-1.
- **Można zrównoleglić:** `T-1` (osobny komponent), `T-9`/`T-10` po `T-8` (ten sam wzorzec, różne
  pliki), oraz całe gałęzie `T-11..T-12` i `T-13..T-15` — dotykają rozłącznych obszarów.
- **`T-17` na końcu**: wcześniej `check:ai-coverage` świeciłby na czerwono przez nowe akcje bez wpisu
  w manifeście.

## Notatki / blokady

- **Migracja jest w całości addytywna** — brak `DROP`, więc rollback kodu nie wymaga kroku wstecz na
  bazie. To odróżnia 041 od 039 (`DROP TABLE NewsKnowledge`) i 040 (`DROP COLUMN leaning`).
- **T-5 zmienia sygnaturę używaną w pięciu miejscach.** Parametr jest opcjonalny właśnie po to, żeby
  `T-8`, `T-9` i `T-10` dało się robić pojedynczo, bez jednego wielkiego commita.
- **T-14 dotyka ścieżki wykonywania akcji asystenta** — najbardziej wrażliwego miejsca w tym wydaniu.
  Klasyfikacja niszczących musi pochodzić z `DESTRUCTIVE_ACTION_TYPES`; druga lista byłaby cichą
  luką przy dodaniu kolejnej akcji usuwającej.

---

## Wynik implementacji — mapowanie AC na dowód (wejście do `/verify`)

| AC | Zadanie(a) | Dowód |
|---|---|---|
| AC-1 brak generowania bez kliknięcia | T-5, T-8 | test `contentMemoryMode` liczy wywołania `generate` = 0 przy „na żądanie" bez zapisu |
| AC-2 zapamiętana treść widoczna od razu | T-5, T-8 | test „powrót na stronę NIC nie kosztuje" |
| AC-3 znacznik „aktualne" | T-5, T-7 | `stale: false` przy zgodnym odcisku; pasek bez znacznika |
| AC-4 znacznik „nieaktualne", treść nie znika | T-5, T-7 | test „na żądanie: brak wywołania mimo zmiany warunków" + `pending: false` |
| AC-5 komplet w jednym miejscu | T-7..T-10 | `AiCostBadge` renderowany **wewnątrz** `AiContentMeta`; osobne badge'e usunięte z pięciu miejsc |
| AC-6 rozbicie kosztu per sekcja | T-7 | `usage` przekazywane per sekcja do paska |
| AC-7 wybór jednego z trzech trybów | T-6, T-7 | `setSectionMode` + rozwijany wybór pod „⚙" |
| AC-8 „na żądanie" nie woła modelu | T-5, T-8 | jw. AC-1 |
| AC-9 „przy zmianie danych" reaguje na hash | T-5 | test „przy zmianie: dokładnie jedno wywołanie" |
| AC-10 dziedziczenie po administratorze | T-4, T-16 | test „brak preferencji → dziedziczenie po administratorze (Config)" |
| AC-11 własne ≠ systemowe | T-6, T-16 | test „własne i systemowe to dwa rozłączne zapisy" |
| AC-12 trwałość ustawienia | T-6 | `AiSectionPref` (upsert po `[ownerId, sectionKind]`) |
| AC-13 subtelność i dostępność kciukiem | T-7, **T-21** | jedna linia w spoczynku, wybór zwinięty, pozycje `py-3` |
| AC-14 koszt czytelny po fakcie | T-11, T-12 | `NewsRefreshRun` + „Historia odświeżeń" w `NewsPage` |
| AC-15 szczegóły dla administratora | T-12 | `visibleUsage` przy odczycie → `AiCostBadge` w wierszu historii |
| AC-16 nie-administrator bez danych kosztowych | T-12 | `getNewsRefreshHistory` przepuszcza `usage` przez `visibleUsage` **po stronie serwera** |
| AC-17 rozróżnialne przebiegi | T-11 | test „dwa przebiegi = dwa wiersze" + „skasowanie zadania NIE usuwa historii" |
| AC-18 bezpieczne bez klikania | T-14 | `autoApproveRef` + `!actions.some(isDestructiveAction)` → `handleExecute` |
| AC-19 niszczące nadal pytają | T-14 | jedna akcja niszcząca kieruje **cały** plan do szuflady |
| AC-20 trwałość między sesjami | T-13 | `AssistantPref.autoApprove` (migracja 0220) |
| AC-21 przełączanie bez opuszczania czatu | T-15 | przełącznik na dole menu poziomu pracy (nad kompozytorem) |
| AC-22 widoczny stan trybu | T-15 | znacznik „auto" w nagłówku czatu, dopóki tryb jest włączony |
| AC-23 pełne nazwy, dwa kroki | T-1 | `TopicPicker` — lista bez `truncate`, `break-words` |
| AC-24 wyszukiwanie tematów | T-1 | pole wyszukiwania nad listą (tytuł + filtr semantyczny) |
| AC-25 jeden mechanizm na obu szerokościach | T-1 | brak wariantów `hidden md:*` w komponencie |
| AC-26 widoczny temat aktywny + licznik | T-1 | zwinięty przycisk: nazwa aktywnego tematu + licznik nowych |

### Stan bramek (lokalny Postgres, C-13 — bez `scripts/migrate.js`)

| Bramka | Wynik |
|---|---|
| `check:actions` | ✓ 160 akcji, komplet egzekutorów i kontraktów |
| `check:ai-coverage` | ✓ 539 akcji sklasyfikowanych, komplet guardów |
| `check:cost-badge` | ✓ 34 pliki wołające model |
| `check:content-memory` | ✓ 34 pliki (5 z pamięcią treści) |
| `check:migrations` | ✓ następny wolny numer 0221 |
| `next lint --dir src` | ✓ bez błędów (zostają znane ostrzeżenia kosmetyczne) |
| `next build` | ✓ przechodzi |
| `npm run test:unit` | ✓ **585/585** (przed 041: 567) |

### Odstępstwa od planu (C-54, oba udokumentowane w `plan.md`)

1. **`sectionMode.ts` rozbity na dwa pliki** — komponent kliencki nie może zaciągnąć Prismy (§3.1).
2. **Przełącznik auto-zatwierdzania trafił do menu poziomu pracy**, a nie do panelu `prefs` — poziom
   pracy nigdy nie mieszkał w `prefs`, a właściciel prosił o sąsiedztwo „jakości asystenta" (§5.4).
