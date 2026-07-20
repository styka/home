# Weryfikacja: Asystent AI nie redaguje treści opisu zadania

- **Spec:** ./spec.md (012-task-description-verbatim)
- **Data:** 2026-07-20
- **Weryfikujący:** Claude Code (spec-driven pipeline, etap /verify)

## Bramki techniczne
| Komenda | Wynik |
|---------|-------|
| `npm run check:migrations` | ✅ „Numeracja migracji OK (następny wolny numer: 0206)" — brak nowej migracji (zgodnie z planem: bez zmian schematu). |
| `npm run check:actions` | ✅ „159 akcji w katalogu, wszystkie obsługiwane przez executor" — brak nowej `AIAction` (C-23 ok). |
| `npx tsc --noEmit` | ✅ 0 błędów (po `npm install` + `prisma generate`). |
| `next lint --dir src` | ✅ tylko wcześniejsze kosmetyczne ostrzeżenia (exhaustive-deps / no-img-element) w niepowiązanych plikach; **żadne** w edytowanych plikach, brak errorów. |
| `next build` (pełny) | ⚠️ **świadomie pominięty** — ostatni krok `build` to `migrate.js`, który rusza **prod DB** (C-13). Zmiana to wyłącznie literały stringów w istniejących plikach `.ts(x)`, więc `tsc --noEmit` + `next lint` w pełni pokrywają weryfikację kompilacji. |

## Kryteria akceptacji
Feature jest zmianą **instrukcji promptu LLM** — właściwym i jedynym punktem kontroli jest treść
finalnego promptu (kod akcji `createTask` już zapisuje `description` wiernie, bez transformacji:
`src/lib/ai/executors/tasksExecutor.ts:42`). AC weryfikowane przez inspekcję finalnego promptu.

- **AC-1** (opis verbatim, bez formy bezosobowej / poprawek gramatycznych) — ✅ **spełnione**.
  Dowód: `agent/route.ts:84` — „wstaw DOKŁADNIE oryginalny tekst użytkownika — słowo w słowo, VERBATIM,
  bez żadnych zmian. NIE przeredagowuj: NIE zamieniaj na formę bezosobową/rzeczową, NIE poprawiaj
  gramatyki ani interpunkcji…". Usunięto dawną zgodę na „lekką redakcję".
- **AC-2** (literówki / styl potoczny nienaruszone) — ✅ **spełnione**. Dowód: `route.ts:84` —
  „Zachowaj oryginalne słowa, ton, styl i ewentualne literówki użytkownika".
- **AC-3** (tytuł nadal generowany z treści) — ✅ **spełnione**. Dowód: `route.ts:83` (reguła „TYTUŁ vs
  TREŚĆ" nienaruszona) + `:84` końcówka „title = krótka etykieta (kilka słów) wygenerowana z treści".
  Wyjątek krótkiego tytułu „kup mleko" → title zachowany.
- **AC-4** (zgłoszenie admina: opis verbatim + doklejony kontekst) — ✅ **spełnione**. Dowód:
  `AICommandSheet.tsx:979` — „params.description: NAJPIERW oryginalny opis admina wstawiony DOKŁADNIE,
  słowo w słowo (VERBATIM) … NASTĘPNIE dołącz poniższy kontekst wskazanego miejsca (UI)". Kontekst
  wskazanego miejsca nadal budowany i przekazywany (`FeedbackInspector.describeElement` → `feedbackContext`
  → prompt, `:981`). Obie części obecne.
- **AC-5** (zgłoszenie admina: tytuł nadal generowany) — ✅ **spełnione**. Dowód: `AICommandSheet.tsx:978`
  — „params.title: wygeneruj zwięzły, konkretny tytuł…" pozostał bez zmian.
- **AC-6** (bulk add: verbatim treści pozycji, mapowanie zachowane) — ✅ **spełnione**. Dowód:
  `route.ts:309` — mapowanie „pozycja → osobne zadanie" nienaruszone + dopisane „Treść pojedynczej pozycji
  przepisujesz do opisu VERBATIM (jak w regule OPIS wyżej) — bez przeredagowywania".

**Dodatkowo (C-54, poza literą AC, dla spójności):** skrócona ścieżka `create_task` w `fastPath.ts:42`
też dostała klauzulę verbatim — dzięki temu opis nie jest redagowany niezależnie od tego, czy polecenie
poszło pełnym agentem czy fast-pathem.

## Zgodność z konstytucją
- **C-01/C-02** ✅ — zmiany tylko w `worldofmag/src/**`; brak nowych importów (edycja stringów).
- **C-10..C-14** ✅ — brak zmian schematu/migracji (`check:migrations` zielone).
- **C-20/C-21** ✅ — warstwa akcji nietknięta; `createTask` zapisuje `description` wiernie; własność bez zmian.
- **C-23** ✅ — brak nowej `AIAction`; `check:actions` zielone.
- **C-32** ✅ — instrukcje promptów po polsku.
- **C-50** ✅ (z uwagą o `next build` jak wyżej — C-13). **C-51** ✅ — wpis w `doświadczenia.md` (2026-07-20).
- **C-53** ✅ — minimalizm: trzy stringi promptów, zero nowych abstrakcji/zależności/migracji.
- **C-54** ✅ — odkryte 4. źródło (fast-path) odzwierciedlone w `plan.md` §7 i `tasks.md` (T-4b), nie „obejściem".

## Regresje
- **Tytuł zadań** — reguła generowania tytułu świadomie zachowana (AC-3/AC-5), brak regresji „cały tekst w tytule".
- **Kontekst zgłoszeń admina** — nadal doklejany (AC-4); brak ryzyka, że verbatim wyparł kontekst.
- **Inne moduły** — nie ruszono; edytowane pliki dotyczą wyłącznie tworzenia zadań / zgłoszeń. `tsc`
  czysty, `check:actions` bez zmian (159 akcji) → brak wpływu na egzekutory innych modułów.
- **Warstwa danych / `revalidatePath` / RBAC** — bez zmian.

## Werdykt końcowy
**GOTOWE Z UWAGAMI** — wszystkie 6 kryteriów akceptacji ✅ spełnione; bramki spójności + typecheck + lint
zielone. Jedyna uwaga: pełny `next build` świadomie pominięty (ostatni krok rusza prod DB — C-13), co dla
zmiany na literałach stringów jest w pełni pokryte przez `tsc --noEmit` + `next lint`. Przejście do `/review`.
