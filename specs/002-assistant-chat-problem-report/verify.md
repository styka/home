# Weryfikacja: Zgłaszanie problemu z czatem asystenta AI (admin) → zadanie w Omnia

- **Spec/Plan:** ./spec.md, ./plan.md (002-assistant-chat-problem-report)
- **Data:** 2026-07-19
- **Weryfikował:** Claude Code (etap /verify)

## Bramki techniczne
| Komenda | Wynik |
|---------|-------|
| `npm run check:migrations` | ✅ OK (brak nowych migracji — feature bez schematu) |
| `npm run check:actions` | ✅ OK (95 akcji, wszystkie z egzekutorem; brak nowej `AIAction`) |
| `npx tsc --noEmit` | ✅ exit 0 (pełny type-check projektu, zero błędów) |
| `npx next lint --dir src` | ✅ exit 0, brak linii `Error:` (tylko znane kosmetyczne warningi) |
| `npx next build` | ✅ exit 0 — „✓ Compiled successfully" (wszystkie trasy) |

> Build z **dummy** `DATABASE_URL` (nie prod, C-13); strony dynamiczne (auth/cookies) → bez połączenia z DB.

## Kryteria akceptacji
| AC | Werdykt | Dowód |
|----|---------|-------|
| **AC-1** — ikona zgłaszania w rzędzie akcji nagłówka (admin) | ✅ | `AICommandSheet.tsx` header: `{isAdmin && (<button … title="Zgłoś problem z czatem"><Bug/></button>)}` między „Nowa rozmowa" a „Historia rozmów". |
| **AC-2** — nie-admin nie widzi ikony | ✅ | Renderowana za `{isAdmin && …}`; `isAdmin` przychodzi z `AppShell` (`<AICommandSheet isAdmin={isAdmin} />`), domyślnie `false`. Panel też za `{isAdmin && showReport && …}`. |
| **AC-3** — pole opcjonalnego opisu + akcje | ✅ | Panel: `label` „Zgłoś problem z czatem (opis opcjonalny)", `textarea` (bez `required`, placeholder „spodziewałem się odpowiedzi: …"), przyciski „Zgłoś problem" + „Anuluj". |
| **AC-4** — powstaje zadanie w „Omnia" + potwierdzenie | ✅ | `submitProblemReport()`: `ensureOmniaProject()` → `createTask({title, projectId, description})`; po sukcesie `setReportDone` → komunikat „Utworzono zadanie w projekcie „Omnia"" + przycisk „Otwórz listę zadań" (`goTo("/tasks")`). |
| **AC-5** — treść: opis + zrzut całej rozmowy + logi + błąd | ✅ | `buildChatProblemReport()`: sekcje „## Opis problemu", „## Ostatni błąd (backend)" (gdy `error`), „## Zrzut rozmowy" (wszystkie `turns` numerowane: rola/kind/treść), „## Logi połączeń z backendem" (per-tura asystenta: `meta` model/tokeny + `log` iter/step/thought + `tools`/`results` w blokach json, trunc ~4000 zn.) + stopka route/conversationId/ISO. |
| **AC-6** — blokada bez kontekstu | ✅ | `canReport = turns.length>0 || !!error || reportDesc.trim().length>0`; przycisk „Zgłoś" `disabled={!canReport || reportBusy}` + komunikat „Brak treści do zgłoszenia." gdy `!canReport`. |
| **AC-7** — brak zębatki z 001 | ✅ | Przycisk `Settings` (zębatka) **usunięty** z rzędu akcji nagłówka; `Settings` pozostaje tylko w menu „+" (Ustawienia asystenta). |

## Zgodność z konstytucją
- **C-01/C-02** ✅ — zmiana w `worldofmag/`, importy przez alias `@/*` (`@/actions/taskProjects`, `@/actions/tasks`).
- **C-10..C-14** ✅ — nie dotyczy (brak schematu/migracji), świadomie.
- **C-20/C-21** ✅ — tworzenie zadania przez istniejące Server Actions z `revalidatePath`; własność
  `ownerId` przez `ensureOmniaProject`/`createTask` (`requireAuth` + `assertProjectAccess`). Brak nowej encji.
- **C-22** ✅ — admin-only widoczność przez `isAdmin` (bez nowego slug'a), spójnie z `FeedbackInspector`.
- **C-23** ✅ — nie dotyczy (brak nowej `AIAction`; zgłoszenie tworzy zadanie bezpośrednio).
- **C-30** ✅ — kolory ze zmiennych CSS (`var(--accent-purple)`, `var(--text-muted)`, `var(--on-accent)` na przycisku); brak hexów.
- **C-31** ✅ — rząd akcji bez rozjazdu (wymiana 1 ikony na 1); panel pełnej szerokości jak `showPrefs`, działa na mobile.
- **C-32** ✅ — wszystkie teksty po polsku.
- **C-53** ✅ — minimalizm: 2 pliki, reuse „Omnia"+`createTask`, zero nowych modeli/akcji/zależności.

## Regresje
- **Brak.** Zmiana addytywna; usunięto tylko zębatkę z 001 (ustawienia dalej dostępne z menu „+" —
  `Settings` wciąż importowany i używany tam). `setShowPrefs`/`showPrefs`/`prefs` nadal używane.
- `check:actions` (95) i `check:migrations` bez zmian → brak wpływu na AI/migracje.
- `AppShell` przekazuje istniejący `isAdmin` (już liczony dla `FeedbackInspector`) → brak nowego zapytania.
- Pełny `next build` wszystkich modułów zielony → brak regresji kompilacji.

## Werdykt końcowy
**GOTOWE** — 7/7 kryteriów akceptacji spełnione, wszystkie bramki zielone, zero naruszeń konstytucji,
brak regresji.
