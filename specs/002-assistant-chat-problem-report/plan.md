# Plan techniczny: Zgłaszanie problemu z czatem asystenta AI (admin) → zadanie w Omnia

- **Spec:** ./spec.md (002-assistant-chat-problem-report)
- **Status:** draft
- **Data:** 2026-07-19

> **Zasada planu:** to jest **JAK**. Zmiana głównie po stronie klienta (`AICommandSheet`), bez schematu.

## 1. Podejście (2–4 zdania)
Rozszerzamy komponent okna asystenta AI `src/components/home/AICommandSheet.tsx`: w rzędzie akcji
nagłówka **usuwamy zębatkę ustawień** (dodaną w 001) i wstawiamy **admin-only** przycisk „Zgłoś problem
z czatem" (ikona `Bug`, mrugająca do „robaczka" z `FeedbackInspector`). Klik otwiera mały panel
(wzorzec istniejącego panelu `showPrefs`) z **opcjonalnym** polem opisu + „Zgłoś"/„Anuluj". Po
potwierdzeniu klient **składa markdown** (zrzut `turns` + logi `log`/`meta` + `error`) i tworzy zadanie
w projekcie „Omnia" przez **istniejące** Server Actions `ensureOmniaProject()` + `createTask()` —
dokładnie ten sam cel, którego używa główne zgłaszanie błędów (C-53, reuse). Admin-only realizujemy
przez przekazanie `isAdmin` z `AppShell` do `AICommandSheet` (tak jak `AppShell` gatuje
`FeedbackInspector`).

## 2. Model danych (Prisma)
**Bez zmian w schemacie.** Brak nowych modeli/kolumn, brak migracji (C-10..C-12 nie dotyczą).
Zgłoszenie to zwykłe `Task` w istniejącym projekcie „Omnia".

## 3. Warstwa serwera (Server Actions — C-20)
**Bez nowych akcji.** Reuse istniejących:
- `ensureOmniaProject()` (`src/actions/taskProjects.ts`) — zwraca/tworzy per-user projekt „Omnia"
  (`ownerId`, C-21); ma `revalidatePath("/tasks")`.
- `createTask({ title, projectId, description })` (`src/actions/tasks.ts`) — `requireAuth`,
  `assertProjectAccess` (projekt należy do tego samego użytkownika → przejdzie), `revalidatePath`.
- Kolejność w kliencie: `const p = await ensureOmniaProject(); await createTask({ title, projectId: p.id, description })`.
- **Uwaga bezpieczeństwa:** brak eskalacji — nie-admin (obejście UI) utworzyłby zadanie tylko we
  własnym projekcie „Omnia". Widoczność i tak gated `isAdmin` w UI (spójnie z `FeedbackInspector`).

## 4. RBAC / rejestr modułu (C-22)
**Bez nowego slug'a.** Widoczność ikony = `isAdmin` (prop). `AppShell` już wie `isAdmin` (montuje nim
`FeedbackInspector`, linia 260) i przekaże go do `AICommandSheet` (linia 258). Brak wpięć w
`permissions.ts` / `modules.tsx` / `ModuleSidebar`.

## 5. UI (C-30, C-31, C-32)
- Plik: `src/components/home/AICommandSheet.tsx`.
  - Sygnatura: `export function AICommandSheet({ isAdmin = false }: { isAdmin?: boolean })`.
  - Nagłówek `{/* Header */}` (rząd akcji ~linia 1120): **usunąć** przycisk zębatki `Settings`
    (z 001); w to miejsce, **tylko gdy `isAdmin`**, wstawić przycisk `Bug`:
    ```tsx
    {isAdmin && (
      <button onClick={() => setShowReport(v => !v)} title="Zgłoś problem z czatem"
              aria-label="Zgłoś problem z czatem" aria-expanded={showReport}
              style={{ ...iconBtn, color: showReport ? "var(--accent-purple)" : "var(--text-muted)" }}>
        <Bug size={16} />
      </button>
    )}
    ```
    (kolor `var(--accent-purple)` = konwencja „robaczka"/zgłoszeń; C-30, brak hexów).
  - Nowy stan: `const [showReport, setShowReport] = useState(false)`, `const [reportDesc, setReportDesc] = useState("")`,
    `const [reportBusy, setReportBusy] = useState(false)`, `const [reportDone, setReportDone] = useState<null | { projectId: string }>(null)`.
  - **Panel zgłoszenia** (analogiczny do istniejącego `{showPrefs && (…)}` pod nagłówkiem): tytuł
    „Zgłoś problem z czatem", `SmartTextarea`/`textarea` na **opcjonalny** opis z placeholderem
    „np. spodziewałem się odpowiedzi: …", przyciski „Zgłoś problem" (primary) + „Anuluj". Po sukcesie
    pokazać komunikat „Utworzono zadanie w projekcie Omnia" z linkiem do `/tasks` (nawigacja SPA
    `router.push` lub `<a>`), i wyczyścić `reportDesc`.
  - **Blokada (AC-6):** przycisk „Zgłoś" nieaktywny, gdy `turns.length === 0 && !error && !reportDesc.trim()`.
- ** Import:** `Bug` z `lucide-react` (dodać do istniejącej listy importów; usunąć `Settings`, jeśli
  nieużywany gdzie indziej — **uwaga:** `Settings` jest też użyty w menu „+" na :1344, więc **zostaje**).
- **Motyw (C-30):** kolory ikony/panelu wyłącznie ze zmiennych CSS.
- **Mobile (C-31):** rząd akcji już `flex gap:4`; wymiana 1 ikony na 1 ikonę nie zmienia układu. Panel
  zgłoszenia jak `showPrefs` — pełna szerokość pod nagłówkiem, działa na `md:hidden`.
- **Teksty (C-32):** wszystkie po polsku.
- **Składanie treści zgłoszenia** — lokalna funkcja modułowa `buildChatProblemReport(turns, error, desc)`
  (obok `deriveContextFromPath`), zwraca markdown:
  - Nagłówek „## Opis problemu" (opis albo „_(brak opisu)_").
  - „## Ostatni błąd (backend)" — tylko jeśli `error`.
  - „## Zrzut rozmowy" — numerowane tury: `### N. <Użytkownik|Asystent> (<kind>)` + treść.
  - „## Logi połączeń z backendem" — dla tur asystenta: model/tokeny z `meta` + wpisy `log`
    (iter/step/thought, `tools` i `results` w blokach kodu ```json```; pojedynczy ogromny wynik
    przyciąć do ~4000 znaków z adnotacją „…(ucięto)").
  - Stopka: `route` (`usePathname`), `conversationId`, znacznik czasu (ISO).
  - Tytuł zadania: `🐛 Problem w czacie asystenta AI — <YYYY-MM-DD HH:mm>` (+ ewentualnie 1. linia opisu, przycięta).

## 6. AI / integracje (jeśli dotyczy — C-23, C-40)
**Nie dotyczy.** Brak nowej `AIAction` (zgłoszenie tworzy zadanie bezpośrednio, nie przez pętlę agenta),
więc `check:actions` bez zmian. Brak read-toola/kalendarza/powiadomień.

## 7. Pliki do utworzenia / zmiany
| Plik | Akcja | Po co |
|------|-------|-------|
| `worldofmag/src/components/home/AICommandSheet.tsx` | edycja | Prop `isAdmin`; usunięcie zębatki (001) i dodanie admin-only ikony `Bug` + panel zgłoszenia; funkcja `buildChatProblemReport`; wywołanie `ensureOmniaProject`+`createTask`. |
| `worldofmag/src/components/shell/AppShell.tsx` | edycja | Przekazać `isAdmin` do `<AICommandSheet isAdmin={isAdmin} />` (:258). |
| `specs/002-.../verify.md`, `review.md` | nowe (etapy dalej) | Raport weryfikacji / recenzji. |

## 8. Bramki i weryfikacja (C-50)
- Brak migracji/AIAction → `check:migrations` i `check:actions` przechodzą trywialnie.
- Weryfikacja: `npx tsc --noEmit` + `npx next lint --dir src` + `npx next build` z **dummy/lokalnym**
  `DATABASE_URL` (nie `npm run build` przeciw prod — C-13). Strony są dynamiczne → build bez DB.
- Mapowanie AC → weryfikacja:
  - **AC-1/AC-7** → inspekcja nagłówka: ikona `Bug` obecna (dla admina), zębatki brak.
  - **AC-2** → ikona renderowana za `isAdmin`; `AppShell` przekazuje `isAdmin`.
  - **AC-3** → panel z opcjonalnym `textarea` + „Zgłoś"/„Anuluj".
  - **AC-4** → `onClick` → `ensureOmniaProject` + `createTask`; stan `reportDone` + link do `/tasks`.
  - **AC-5** → `buildChatProblemReport` składa opis+zrzut+logi+błąd (prześledzenie funkcji/outputu).
  - **AC-6** → warunek `disabled` przycisku „Zgłoś".

## 9. Ryzyka techniczne i plan wycofania
- Duża treść zadania (długa rozmowa/logi) → przycięcie pojedynczych ogromnych wyników logu (~4000 zn.).
- Markdown/HTML w treści rozmowy → renderer zadań escapuje `&`/`<` globalnie (CLAUDE.md), logi w blokach
  kodu; brak wektora XSS.
- `createTask` wymaga niepustego `title` → tytuł generujemy zawsze (znacznik czasu), więc nie pusty.
- Rollback: zmiana kodu w 2 plikach (brak migracji/stanu DB) → rewert commita.

## 10. Zgodność z konstytucją — checklista
- [x] C-10..C-14 (migracje) — **nie dotyczy** (brak schematu), świadomie.
- [x] C-20..C-25 — reuse Server Actions z `revalidatePath` (C-20), własność `ownerId` (C-21), admin-only
  bez nowego slug'a (C-22); brak nowej `AIAction` (C-23 n/d); trash/audit n/d.
- [x] C-30..C-32 — kolory ze zmiennych CSS, mobile bez rozjazdu, teksty PL.
- [x] C-53 — minimalizm: 2 pliki, zero nowych modeli/akcji/zależności; reuse „Omnia"+createTask.
