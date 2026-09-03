# Recenzja: Wiadomości — tytuły/streszczenia po polsku + „do doczytania"

- **Spec:** ./spec.md (124-wiadomosci-polski-i-doczytania)
- **Data:** 2026-09-03
- **Zakres:** `git diff origin/develop..HEAD` (bez `specs/**` i przepieczonych `src/generated/**`)
- **Recenzenci:** przegląd własny + świeże oko subagenta `omnia-reviewer`

## Ustalenia (od najpoważniejszego) — wszystkie NAPRAWIONE w tym przebiegu

1. **`src/modules/news/ui/NewsStream.tsx` — correctness (uczciwość potwierdzenia)** — okno
   „Oznaczyć wszystkie?" podawało liczbę z `totalItems`, która po 124 liczy także pozycje odłożone
   „do doczytania" — a tych akcja celowo nie rusza. *Scenariusz:* 5 nowych, w tym 2 odłożone →
   dialog obiecuje „zniknie 5", znikają 3. **Naprawione:** nowy `doOznaczenia` (bez odłożonych)
   zasila opis dialogu i `disabled` przycisku; przy samych odłożonych przycisk jest wyłączony,
   bo akcja nie miałaby czego oznaczyć. Scenariusz e2e AC-7 przepisany na realistyczny przebieg
   (masowa akcja na pełnej liście, nie w zawężeniu).
2. **`src/modules/news/lib/jezykTytulu.ts` — correctness (heurystyka sprzeczna z własną regułą)** —
   lista „obcych słów funkcyjnych" zawierała polskie homografy: `to`, `by`, `los`, `las`, `para`
   (przegląd własny) oraz `mit`, `por` (recenzent). *Scenariusz:* polski tytuł bez diakrytyków
   („Los lasu to temat na lata…") oznaczany jako obcy → płatne `dispatch` w każdym przebiegu, model
   przepisuje bez zmian → brak zapisu → pętla kosztowa aż do odhaczenia (dokładnie ryzyko ze
   spec §9). **Naprawione:** homografy usunięte z zestawu, testy rozszerzone (9/9 zielone).
3. **`src/modules/news/ui/NewsPage.tsx` — correctness (fałszywe zero)** — licznik odłożonych liczony
   ze `stream`, który przy bezpośrednim wejściu na oś czasu (`?widok=timeline`) nie jest ładowany:
   przycisk pokazywał „0" i był wyłączony mimo istniejących odłożonych (recenzent). **Naprawione:**
   przy `stream === null` licznik nie jest rysowany (nieznany ≠ zero), a przycisk nie jest
   wyłączany.

## Sprawdzone i czyste (bez ustaleń)

- **C-21/C-20:** guard `czyMojRekord(item.topic)` wg wzorca `acknowledgeItem`; każdy mutator kończy
  `revalidatePath("/wiadomosci")`; akcje zbiorcze nie są szerszym wektorem niż pojedyncza
  (zawęziły się o `readLater: false`), licznik z `updateMany` mówi prawdę.
- **C-10/C-11/C-12:** migracja 0290 zgodna ze schematem (`BOOLEAN NOT NULL DEFAULT false` ↔
  `Boolean @default(false)`), numer wolny, Boolean zamiast enuma/statusu.
- **Etapy 3b/3c:** reuse `summarizeItems` (zero drugiej ścieżki zapisu), kolejność 3 → 3b → 3c bez
  podwójnego tłumaczenia w jednym przebiegu, pusty/identyczny wynik nie nadpisuje tytułu, awaria
  partii tytułów nie wywraca przebiegu, `summarized` liczy tylko realne streszczenia, `dispatch`
  przez routing DB-driven (C-40), nowe `findMany` z `take` i limitem `NAPRAWA_LIMIT`.
- **UI/UX:** filtr „doczytania" na tym samym zbiorze co filtr źródeł (nawigator/lektor/pusty stan
  spójne — lekcja 085), stan w URL przez istniejący `viewState` (ulubialny, AC-10), kolory ze
  zmiennych CSS (C-30), teksty przez `t()` (C-32), przycisk stałej wysokości, przy zerze widoczny
  a wyłączony (wzorzec 100), e2e bez `networkidle`.
- **Bezpieczeństwo:** brak nowych powierzchni (żadnych kluczy, renderów HTML, akcji bez guardów);
  `news:setItemReadLater` w manifeście pokrycia z `access: owner`.

## Weryfikacja po poprawkach recenzji

- `tsc --noEmit` (app + e2e) — czysto; testy heurystyki 9/9; `check:i18n` zielone.
- Klikacz `124-wiadomosci-doczytania.spec.ts` — 6/6 po przepisaniu AC-7 (i ponowiony po ostatnich
  poprawkach — wynik w podsumowaniu przebiegu).
- Pełny `npm run build` ponowiony po poprawkach przed merge (warunek C-50/C-52).

## Werdykt

**APPROVE Z UWAGAMI** — trzy drobne ustalenia, wszystkie naprawione w tym samym przebiegu i objęte
testami; jedyna uwaga otwarta pozostaje środowiskowa (językowy efekt modelu do potwierdzenia logiem
`news.repair.titles` po deployu na `develop` — patrz verify.md). Zgodnie ze standing authorization:
merge do `develop`, push, automatyczna promocja `develop → master` po kontroli integralności.
