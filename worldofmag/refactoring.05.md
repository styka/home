# Raport Refaktoringu — Iteracja 05

**Data:** 2026-05-18  
**Zakres:** Widok architektury aplikacji dla admina + podsumowanie 5 iteracji

---

## Podsumowanie wykonawcze

Piąta iteracja realizuje ostatni element zadania: stworzenie widoku `/admin/architecture` dostępnego dla administratora, opisującego architekturę aplikacji wraz z grafem zależności komponentów, informacjami o bibliotekach i przewodnikiem dla developerów.

---

## Wprowadzone zmiany

### Nowy plik: `src/app/admin/architecture/page.tsx`

Server Component (chroniony przez sprawdzenie roli ADMIN, redirect jeśli brak uprawnień).

Widok zawiera 8 sekcji:

| # | Sekcja | Zawartość |
|---|--------|-----------|
| 1 | **Stack technologiczny** | Tabela 12 technologii z kategoriami (core/ui/db/auth/ai) i opisami ról |
| 2 | **Struktura katalogów** | ASCII tree pełnej struktury `src/` |
| 3 | **Autentykacja i autoryzacja** | NextAuth, JWT, role, middleware, `requireAuth()` pattern |
| 4 | **Przepływ danych** | 4-krokowy diagram: Server Component → Client → Server Action → Cache |
| 5 | **Schemat bazy danych** | 6 kart domenowych z modelami Prisma + warning o SQLite/enums |
| 6 | **Graf zależności komponentów** | ASCII tree hierarchii renderowania dla Shopping/Tasks/Notes |
| 7 | **Warstwa AI / LLM** | 10 endpointów z opisami, klient `llm-client.ts` |
| 8 | **Skróty klawiaturowe** | Pełna tabela skrótów vim-style |
| 9 | **Infrastruktura produkcyjna** | Render, Neon, PWA, deploy pipeline, zakazy (Vercel/Fly.io) |

### Linki do widoku architektury

Dodano link `Architektura` w obu miejscach nawigacji (wcześniej w Iteracji 3):
- `ModuleSidebar.tsx` — desktop sidebar, sekcja admin
- `AppShell.tsx` — mobile menu drawer, sekcja admin

### Komponenty pomocnicze w widoku

Zdefiniowane jako lokalne Server Components w pliku page.tsx:

- **`Section`** — sekcja z nagłówkiem, ikoną i separator line
- **`InfoGrid`** — tabela klucz/wartość
- **`TechGrid`** — tabela stack technologicznego z kolorowymi kategoriami
- **`DomainCard`** — karta domenowa dla schematu DB
- **`FlowStep`** — krok w numbered diagram przepływu
- **`CodeSnippet`** — blok kodu

---

## Graf zależności komponentów (skrót)

```
AppShell
├── ModuleSidebar → TasksSideNav
├── AICommandSheet (globalny FAB)
└── {page children}
    ├── ShoppingPage → FilterTabs, QuickAddBar, ItemList → CategoryGroup → ItemRow → StatusBadge
    ├── TasksPage → TaskFilters, TaskList → TaskRow → TaskTagBadge, RecurringBadge
    │             └── TaskDetail → TaskTagsManager
    └── NotesPage → QuickNoteBar, NoteList → NoteRow → TagChip, SmartTextarea
```

---

## Podsumowanie 5 iteracji refaktoringu

### Co zostało zrobione

| Iteracja | Zmiana | Efekt |
|----------|--------|-------|
| 01 | `requireAuth` + `getUserTeamIds` → `src/lib/server-utils.ts` | 10 duplikatów → 0 |
| 02 | ComponentPlayground 1→6 komponentów + helper sub-components | Dokumentacja UI |
| 03 | `ModuleSidebar` bottom links → używają `NavItem` | 115 → 22 linie |
| 04 | `src/lib/llm-client.ts` typed LLM API wrapper | 10 endpointów centralizowane |
| 05 | `/admin/architecture` — developer guide z grafem | Onboarding dla devów |

### Nowe pliki

| Plik | Cel |
|------|-----|
| `src/lib/server-utils.ts` | Shared auth helpers dla Server Actions |
| `src/lib/llm-client.ts` | Typed klient dla LLM API |
| `src/app/admin/architecture/page.tsx` | Developer guide widok |

### Metryki sumaryczne

| Miara | Przed | Po |
|-------|-------|----|
| Duplikaty `requireAuth` | 10 | 0 |
| Duplikaty `getUserTeamIds` | 4 | 0 |
| Komponenty w Playground | 1 | 6 |
| Zduplikowane hover handlers | 4 | 0 |
| Centralny LLM client | Brak | Jest |
| Developer guide widok | Brak | `/admin/architecture` |
| Nowe narzędzia w `src/lib/` | 0 | 2 |

---

## Problemy wymagające dalszej pracy

### 🔴 Krytyczne (bezpieczeństwo)
- **Notes bez auth**: `notes.ts`, `noteGroups.ts`, `tags.ts` — brak `requireAuth()`. Model `Note` w Prisma nie ma `userId`. Notatki są globalnie widoczne. Wymaga migracji schematu + dodania auth.

### 🟡 Wysoki priorytet (utrzymywalność)
- **`TaskDetail.tsx` (688 linii)** — 6 odpowiedzialności w jednym pliku. Podział na: `TaskDetailHeader`, `TaskDetailTags`, `TaskDetailSubtasks`, `TaskDetailComments`, `TaskDetailShare`.
- **`NoteRow.tsx` (513 linii)** — inline editing + AI + voice recording w jednym komponencie.
- **Migracja fetchów do `llm-client.ts`** — 7 komponentów nadal używa bezpośrednich `fetch()`.

### 🟢 Średni priorytet (DRY)
- **`TasksGuide.tsx` (1036 linii)** — podzielić na sekcje.
- **Unifikacja `TagChip` + `TaskTagBadge`** — ten sam wzorzec badge z kolorem.
- **`AICommandSheet` vs `AICommandSection`** — duplikacja logiki interpret/execute.
- **Pełna ekstrakcja nav config** do `src/lib/nav.ts` (unifikacja mobile/desktop).
- **Typy `toTask()`, `toItem()`** — `as unknown as Task` to niebezpieczne casty; lepiej użyć Prisma `$validator`.
