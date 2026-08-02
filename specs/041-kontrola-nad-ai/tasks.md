# Zadania: Kontrola nad AI — kiedy generuje, ile kosztuje, co robi bez pytania

- **Plan:** ./plan.md (041-kontrola-nad-ai)
- **Status:** todo
- **Data:** 2026-08-01

> **Zasada listy:** od najłatwiejszego do najtrudniejszego, zgodnie z zależnościami. Trzy zgłoszenia
> (nawigacja, auto-zatwierdzanie, historia kosztów) są **niezależne** od przebudowy sekcji AI — idą
> osobnymi ścieżkami, więc da się je wdrożyć nawet gdyby rdzeń się przeciągnął.

## Legenda
- `[ ]` do zrobienia · `[x]` zrobione · `[~]` w trakcie · `[!]` zablokowane
- `[P]` — niezależne od poprzedniego, można robić równolegle

---

## Faza 0 — Nawigacja po tematach (zgłoszenie 1, bez zależności)

- [ ] **T-1** `[P]` — **`TopicPicker` zamiast `TopicTabs`.** Zwinięty: jeden przycisk na pełną
      szerokość (nazwa aktywnego tematu + licznik nowych + `⌄`). Rozwinięty: pionowa lista wszystkich
      tematów z **pełnymi nazwami** (bez `truncate`), pole wyszukiwania nad listą, liczniki przy
      pozycjach, `Esc` zamyka. Jeden komponent na obu szerokościach — **bez** wariantów `hidden md:*`.
      Akcje tematu (dodaj/edytuj/usuń) zostają obok przycisku jak w 040.
      *Gotowe, gdy:* wybór tematu to dwa kroki, pełne nazwy widoczne, wyszukiwanie zawęża listę, a
      `grep` nie pokazuje `truncate` ani `hidden md:` w komponencie. **(AC-23..AC-26)**

## Faza 1 — Fundament danych

- [ ] **T-2** — **Migracja `0220_kontrola_nad_ai`.** DDL wg planu §2.4: `CREATE TABLE
      "AiSectionPref"` (+ unique `[ownerId, sectionKind]`, FK cascade), `CREATE TABLE
      "NewsRefreshRun"` (+ index `[ownerId, finishedAt]`, FK cascade), `ALTER TABLE "AssistantPref"
      ADD COLUMN "autoApprove"`, idempotentny seed `Config.ai_section_default_modes`
      (**`gen_random_uuid()::text` dla `id`** — `Config.id` nie ma domyślnej wartości).
      *Gotowe, gdy:* `npm run check:migrations` przechodzi, `migrate deploy` na lokalnym Postgresie
      kończy się czysto, a wiersz `Config` istnieje z poprawnym JSON-em.

- [ ] **T-3** — **`schema.prisma`** zgodnie z migracją: dwa nowe modele, kolumna `autoApprove`,
      relacje w `User`. Tryby jako `String` (C-12).
      *Gotowe, gdy:* `prisma generate` przechodzi, `migrate diff` nie pokazuje rozjazdu.

## Faza 2 — Tryb sekcji AI (rdzeń)

- [ ] **T-4** — **`src/lib/ai/sectionMode.ts` + test.** `AiSectionMode` (`onDemand|onChange|always`)
      z etykietami PL, `resolveSectionMode(ownerId, kind)` (preferencja → `Config` → `onDemand`),
      `readDefaultSectionModes()` bez sesji (wzorzec `readCostBadgeEnabled`).
      *Gotowe, gdy:* test pokrywa **całą kolejność rozstrzygania**, w tym brak obu źródeł i
      uszkodzony JSON w `Config` (ma degradować do `onDemand`, nie wysypywać strony). **(AC-10)**

- [ ] **T-5** — **`rememberedContent` z trybem i stanem `pending`.** Nowy, **opcjonalny** parametr
      `mode`; brak trybu = dzisiejsze zachowanie. Tabela decyzyjna wg planu §3.2; wynik zyskuje
      `pending: boolean`.
      *Gotowe, gdy:* test na żywej bazie sprawdza **wszystkie** kombinacje (brak zapisu / zapis+hash
      zgodny / zapis+hash inny) × trzy tryby × `force`, licząc **wywołania `generate`** — bo to one,
      a nie wynik, decydują o koszcie. **(AC-1..AC-4, AC-8, AC-9)**

- [ ] **T-6** — **`src/actions/aiSections.ts`.** `getSectionModes`, `setSectionMode(kind, mode)`
      (użytkownik), `getDefaultSectionModes`/`setDefaultSectionModes` (**administrator**, z
      `logAudit` kategorii `config` — C-25). Guardy: `requireAuth` + `ownerId`; admin przez
      `hasPermission(...ADMIN)`. `revalidatePath` na końcu każdej mutacji.
      *Gotowe, gdy:* zapis preferencji użytkownika **nie rusza** `Config` i odwrotnie (to jest AC-11),
      a `check:ai-coverage` przechodzi z nowymi wpisami. **(AC-7, AC-11, AC-12)**

## Faza 3 — Wspólny pasek sekcji AI

- [ ] **T-7** — **`AiContentMeta` wchłania koszt i tryb.** Jedna linia w spoczynku: „wygenerowano …
      · [nieaktualne] · koszt · ⟳ Odśwież · ⚙"; `⚙` rozwija wybór trybu (`py-3`, zwinięty domyślnie).
      Osobny stan `pending`: zdanie „Treść powstanie po kliknięciu" + przycisk — **wyraźnie inny** od
      pustego stanu po błędzie.
      *Gotowe, gdy:* `AiCostBadge` stoi **wewnątrz** paska (nie obok), a stan oczekiwania nie da się
      pomylić z awarią. **(AC-5, AC-6, AC-13)**

- [ ] **T-8** — **Pogoda: `IdeasPanel` na tryb.** `useEffect` przestaje wołać generowanie
      bezwarunkowo; odczyt przez `rememberedContent` z rozwiązanym trybem; obsługa `pending`.
      *Gotowe, gdy:* wejście na `/pogoda` przy trybie „na żądanie" **nie woła modelu ani razu**.
      **(AC-1, AC-2, AC-8)**

- [ ] **T-9** `[P]` — **Wiadomości: `HotTopics` na tryb.** Jak wyżej, dla gorących tematów.
      *Gotowe, gdy:* wejście na zakładkę nie generuje bez kliknięcia.

- [ ] **T-10** `[P]` — **Pozostałe trzy sekcje na tryb:** wnioski Magazynu, wnioski Petów, plan
      tygodnia Kuchni.
      *Gotowe, gdy:* wszystkie pięć sekcji przechodzi przez ten sam mechanizm, a `check:content-memory`
      jest zielony.

## Faza 4 — Historia kosztów Wiadomości (zgłoszenie 4)

- [ ] **T-11** — **Zapis przebiegu.** Handler `news.refresh` na końcu tworzy `NewsRefreshRun`
      (liczby + **surowe** zużycie, bo handler nie ma sesji) i przycina historię do 30 ostatnich.
      *Gotowe, gdy:* dwa przebiegi = dwa wiersze, a skasowanie zadania z kolejki **nie usuwa**
      historii. **(AC-14, AC-17)**

- [ ] **T-12** — **Odczyt i widok.** `getNewsRefreshHistory(limit)` z `visibleUsage` przy odczycie;
      w `NewsPage` odnośnik „Historia odświeżeń" → rozwijana lista (czas, liczby, koszt).
      *Gotowe, gdy:* administrator widzi szczegóły kosztu, a nie-administrator **nie dostaje danych
      kosztowych po stronie serwera**. **(AC-15, AC-16)**

## Faza 5 — Auto-zatwierdzanie akcji asystenta (zgłoszenie 3)

- [ ] **T-13** — **`AssistantPref.autoApprove` + akcja.** Rozszerzenie istniejącego
      `updateAssistantPrefs`.
      *Gotowe, gdy:* ustawienie przeżywa ponowne wejście. **(AC-20)**

- [ ] **T-14** — **Logika pomijania szuflady.** Gdy `autoApprove` **i żadna** akcja nie należy do
      `DESTRUCTIVE_ACTION_TYPES` → wykonaj od razu i pokaż wynik; w przeciwnym razie `ActionDrawer`
      jak dotąd. Klasyfikacja **wyłącznie** z `lib/ai/aiAction.ts` — zero drugiej listy.
      *Gotowe, gdy:* zestaw akcji bezpiecznych idzie bez kliknięcia, a zestaw z jedną niszczącą
      **nadal otwiera szufladę**. **(AC-18, AC-19)**

- [ ] **T-15** — **UI przełącznika.** Przełącznik w rozwijanej sekcji ustawień asystenta (panel
      `prefs`), obok poziomu pracy — zgodnie z decyzją właściciela. Stan widoczny **stale** w
      nagłówku czatu, gdy włączony.
      *Gotowe, gdy:* da się przełączyć bez opuszczania czatu, a z ekranu widać, że tryb działa.
      **(AC-21, AC-22)**

## Faza 6 — Ustawienia administratora

- [ ] **T-16** — **Systemowe domyślne w `/admin/llm`.** Sekcja z listą sekcji AI i wyborem trybu
      domyślnego; sąsiedztwo istniejących przełączników (`assistant_followups_enabled`,
      `ai_cost_badge_enabled`).
      *Gotowe, gdy:* zmiana domyślnych wpływa na użytkowników **bez** własnej preferencji i trafia do
      dziennika zmian. **(AC-10, AC-11)**

## Faza 7 — Bramki i domknięcie

- [ ] **T-17** — **Pełna sekwencja bramek na lokalnym Postgresie (C-13):** `copy-docs →
      check:actions → check:ai-coverage → check:cost-badge → check:content-memory →
      check:migrations → next lint → prisma generate → next build` + `npm run test:unit`.
      **Bez** `scripts/migrate.js`.
      *Gotowe, gdy:* wszystkie kroki zielone. **(C-50)**

- [ ] **T-18** — **Dokumentacja** — `CLAUDE.md`: tryby sekcji AI (nowy mechanizm przekrojowy),
      historia przebiegów Wiadomości, auto-zatwierdzanie, selektor tematów; nowe modele w schemacie.

- [ ] **T-19** — **`doświadczenia.md` (C-51)** — wpisy o tym, co wyszło nieoczywistego (spodziewane:
      `NULL != NULL` w unique PostgreSQL jako powód wyboru `Config` zamiast wiersza systemowego).

- [ ] **T-20** — **Mapowanie AC → wynik** jako wejście do `/verify`.

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
| AC-13 subtelność i dostępność kciukiem | T-7 |
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
