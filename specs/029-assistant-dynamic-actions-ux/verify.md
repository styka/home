# Weryfikacja: Ujednolicenie UX dynamicznych sekcji akcji asystenta AI + zgłaszanie problemów z asystentem

- **Spec:** ./spec.md · **Plan:** ./plan.md · **Tasks:** ./tasks.md
- **Data:** 2026-07-25
- **Weryfikujący:** Claude Code (spec-driven pipeline, etap /verify)

## Bramki

| Komenda | Wynik |
|---------|-------|
| `npm run check:migrations` | ✅ „Numeracja migracji OK (następny wolny numer: 0209)" — brak nowych migracji (feature bez zmian schematu) |
| `npm run check:actions` | ✅ „159 akcji w katalogu, wszystkie obsługiwane przez executor" — brak nowej `AIAction`, kontrakt nienaruszony |
| `node scripts/check-ai-coverage.js` | ✅ „493 akcji sklasyfikowanych" — brak nowych Server Actions → manifest bez zmian |
| `next lint --dir src` | ✅ exit 0 — tylko istniejące ostrzeżenia (żadne w `AICommandSheet.tsx`/`usage.ts`/`fastPath.ts`/`agent/route.ts`) |
| `next build` (lokalny Postgres, C-13) | ✅ exit 0 — pełna kompilacja + typecheck; `migrate.js` świadomie pominięty |

## Kryteria akceptacji

| AC | Werdykt | Dowód |
|----|---------|-------|
| **AC-1** jedna sekcja wykonania | ✅ | `handleExecute` aktualizuje tę samą turę planu (`{...x, done:true, results}`) — brak pushowania tury `kind:"results"` (grep „Wykonano akcje" → none, `AICommandSheet.tsx`). |
| **AC-2** dynamiczny stan sekcji | ✅ | Render tury `plan` przechodzi stany proponowane→wykonano/cofnięto w jednym bąbelku (`turn.done ? results-inline : dismissed : buttons`, ~l.1790). |
| **AC-3** ikona Odczytaj bez labelki, w linii ze stopką | ✅ | `SpeakButton` icon-only (usunięty tekst „Odczytaj/Zatrzymaj"; grep → „label removed"); wiersz stopki zawiera SpeakButton + `CostChip` obok siebie (5× `<CostChip`). |
| **AC-4** w stopce tylko suma kwoty | ✅ | `CostChip` renderuje wyłącznie kwotę (lub „szczegóły modelu") jako przycisk; model/tokeny zeszły do panelu (l.228+). |
| **AC-5** rozwijane rozbicie kosztu | ✅ | Klik w kwotę otwiera panel z listą `meta.calls` (model·label·prompt+completion=total·koszt) + „Suma". |
| **AC-6** suma = wszystkie wywołania | ✅ | `UsageMeter.calls` zbiera KAŻDE wywołanie (`accrueUsage` push), a `costUsd` akumuluje ten sam `estimateCostUsd`; trasa wysyła `calls: meta.calls` w 3 miejscach (fast_path/SSE/non-SSE). Suma pozycji == `meta.costUsd`. |
| **AC-7** logi rozumowania nie dla usera | ✅ | `{isAdmin && <ReasoningLog …/>}` we wszystkich 4 gałęziach (l.1762/1821/1837/1903). |
| **AC-8** admin ma logi bez regresji | ✅ | Ten sam gate przepuszcza `ReasoningLog` dla `isAdmin` (prop przekazany z `AICommandSheet` do `TurnView`). |
| **AC-9** brak duplikatu „ładny opis + logi" | ✅ | Dla usera zostaje jedna sekcja (treść tury planu) — logi ukryte (AC-7); brak osobnej tury results (AC-1). |
| **AC-10** robaczek asystenta dla wszystkich | ✅ | Zdjęty `isAdmin &&` z ikony (l.1326) i panelu (`{showReport && (` l.1333). |
| **AC-11** teksty panelu zgłoszenia | ✅ | Nagłówek „Zgłoś problem z Asystentem AI (opis opcjonalny)" (l.1348); akapit „Do zadania dołączymy…" usunięty (grep → brak). |
| **AC-12** prefiks 🐛 (główny robaczek) | ✅ | Prompt wymusza title od „🐛 " (l.1055) + deterministyczne domknięcie: `feedbackPrefixRef="🐛 "` (l.1042) i normalizacja `create_task` w `handleExecute`. |
| **AC-13** prefiks 🐛✨ (robaczek asystenta) | ✅ | `submitProblemReport`: `title = \`🐛✨ ${firstLine || "Problem z Asystentem AI"}\`` bez `stamp` (l.771). |
| **AC-14** globalne ujednolicenie sekcji | ✅ | Scalenie działa dla każdej tury `plan` (tekst i obraz — `sendImage` też pushuje `plan`); jeden renderer `TurnView`. |

## Zgodność z konstytucją

- **C-10..C-14** ✅ — brak zmian schematu/migracji, zero enumów (nowy `UsageCall` to `type` z polami prostymi).
- **C-20..C-25** ✅ — brak nowych mutacji/Server Actions; RBAC przez istniejący `isAdmin`/`module.admin`
  (logi/diagnostyka admin-only), robaczek za auth; brak nowej `AIAction` (C-23 — `check:actions` zielone);
  routing modeli nietknięty (C-40).
- **C-30..C-32** ✅ — nowe elementy używają wyłącznie `var(--*)`; `CostChip` panel `overflow-x:auto`,
  SpeakButton zachowuje cel dotyku (26×26); teksty PL.
- **C-53** ✅ — brak nowych zależności/abstrakcji; scalono istniejące tury, rozszerzono akumulator; zmiany
  skupione w 4 plikach.
- **C-50/C-51** ✅ — build zielony; lekcja dopisana do `doświadczenia.md`.

## Regresje

- **Hydratacja starych rozmów** ✅ — pętla w `loadConversation` scala wiadomość `results` w poprzedzającą
  turę `plan`; bardzo stare rozmowy bez planu renderują `results` jako samodzielną turę (gałąź renderu
  `kind:"results"` zachowana, read-only).
- **Tryb głosowy** ✅ — po wykonaniu `last` = tura planu (id już „wypowiedziane"), efekt głosowy nie
  re-anonsuje; powrót do nasłuchu dalej w `handleExecute`.
- **Diagnostyka w raporcie dla nie-admina** ✅ — `getRecentAiCalls` best-effort w `try/catch`
  (`aiCallsError`); brak bloku diagnostyki nie wywraca zgłoszenia.
- **`meta` w kontrakcie odpowiedzi** ✅ — dodano tylko pole `calls` (addytywne), `body: Record<string,
  unknown>` przyjmuje bez zmian typów; brak wpływu na inne konsumenty.
- **Sąsiednie moduły** ✅ — zmiany wyłącznie w warstwie asystenta AI + telemetrii; brak `revalidatePath`
  do dodania (brak nowych mutacji).

## Werdykt końcowy

**GOTOWE** — wszystkie 14 kryteriów akceptacji spełnione (✅), wszystkie bramki zielone, brak naruszeń
konstytucji, brak wykrytych regresji. Przejście do `/review`.
