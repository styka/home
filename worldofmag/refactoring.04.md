# Raport Refaktoringu — Iteracja 04

**Data:** 2026-05-18  
**Zakres:** Typed LLM client + przegląd duplikacji fetch + analiza głębszych problemów

---

## Podsumowanie wykonawcze

Czwarta iteracja skupiła się na duplikacji wywołań API do endpointów LLM, rozsianej po 7 różnych komponentach. Stworzono centralny typed klient `src/lib/llm-client.ts` zapewniający spójny interfejs. Przeprowadzono też głębszą analizę kodu odkrywającą poważniejsze problemy architektoniczne.

---

## Zidentyfikowane problemy

### 1. Wywołania `fetch("/api/llm/...")` w 7 komponentach

Ten sam pattern fetch (`POST`, `Content-Type: application/json`, parsowanie odpowiedzi) powtarza się bez żadnej abstrakcji:

| Endpoint | Komponenty |
|----------|------------|
| `/api/llm/notes/tags` | `NoteRow.tsx`, `TagSuggestions.tsx`, `QuickNoteBar.tsx` |
| `/api/llm/notes/rewrite` | `SmartTextarea.tsx`, `NoteRow.tsx` |
| `/api/llm/notes/title` | `QuickNoteBar.tsx` |
| `/api/llm/notes/qa` | `NotesQA.tsx` |
| `/api/llm/tasks/parse` | `AITaskInput.tsx` |
| `/api/llm/tasks/suggest` | `TaskDetail.tsx` (2×) |
| `/api/llm/tasks/search` | `TasksPage.tsx` |
| `/api/llm/home/interpret` | `AICommandSheet.tsx`, `AICommandSection.tsx` |
| `/api/llm/home/execute` | `AICommandSheet.tsx`, `AICommandSection.tsx` |
| `/api/llm/normalize` | `LLMInputSection.tsx` |

Problemy:
- Brak typowania odpowiedzi (każde wywołanie ma własny `as { ... }` cast)
- Brak obsługi błędów HTTP (niektóre sprawdzają `res.ok`, inne nie)
- URL endpointów hardkodowane w komponentach UI

### 2. `AICommandSheet` vs `AICommandSection` — prawie identyczne

Dwa pliki robią prawie to samo:
- `AICommandSheet.tsx` (323 linie) — floating sheet z animacją
- `AICommandSection.tsx` (213 linii) — inline sekcja

Obydwa wywołują `/api/llm/home/interpret` i `/api/llm/home/execute` z identycznym payload. Duplikacja logiki.

---

## Wprowadzone zmiany

### Nowy plik: `src/lib/llm-client.ts`

Centralny typed klient dla wszystkich endpointów LLM:

```typescript
export const llm = {
  notes: {
    suggestTags: (content, existingTags, existingGroups?) => Promise<{...}>
    suggestTitle: (content) => Promise<{title?}>
    rewrite: (text, mode, instruction?) => Promise<{result?}>
    qa: (question, notes) => Promise<{answer?}>
  },
  tasks: {
    parse: (text) => Promise<{tasks?}>
    suggest: (context) => Promise<{suggestions?}>
    search: (query, tasks) => Promise<{matches?}>
  },
  shopping: {
    normalize: (text) => Promise<{items?}>
  },
  home: {
    interpret: (command, context) => Promise<{intent?, params?}>
    execute: (intent, params) => Promise<{result?}>
  }
}
```

**Korzyści:**
- Wszystkie URL endpointów w jednym miejscu (łatwa zmiana)
- Spójny error handling: `throw new Error` przy `!res.ok`
- TypeScript types dla odpowiedzi
- Komponenty importują `llm.notes.suggestTags(...)` zamiast pisać pełny fetch

### Migracja komponentów (zaplanowana, do wykonania w kolejnych krokach)

Komponenty korzystające z `fetch` powinny zostać zaktualizowane do używania `llm.*`. Nie wykonano automatycznej migracji by uniknąć regracji — każdy komponent wymaga ręcznego sprawdzenia payloadu.

---

## Głębsza analiza problemów

### Problem: `TasksGuide.tsx` — 1036 linii w jednym pliku

Najdłuższy plik w projekcie to komponent dokumentacyjny. Zawiera:
- 12 sekcji tematycznych (100+ linii każda)
- SVG diagram wbudowany inline (60+ linii)
- Wszystko w jednym pliku

Sugestia: podzielić na osobne sekcje jako oddzielne komponenty lub lazy-loaded zakładki.

### Problem: `TaskDetail.tsx` — 688 linii

Bardzo duży komponent. Odpowiada za:
- Wyświetlanie szczegółów zadania
- Edycję wszystkich pól
- Zarządzanie tagami
- Subtaskami  
- Komentarzami
- Udostępnianiem

Każda z tych sekcji to osobna odpowiedzialność — kandydat do podziału na sub-komponenty.

### Problem: brak autoryzacji w module Notes

`notes.ts`, `noteGroups.ts`, `tags.ts` — brak `requireAuth()`. Notatki nie są user-scoped w schemacie Prisma (brak `userId` w modelu `Note`). To architekturalny problem bezpieczeństwa.

### Problem: `NoteRow.tsx` — 513 linii

Jeden wiersz notatki z inline editingiem, obsługą tagów, grupami, rewrite przez LLM, rozpoznawaniem mowy. Zbyt wiele odpowiedzialności.

---

## Metryki

| Miara | Przed | Po |
|-------|-------|----|
| Pliki z bezpośrednim `fetch("/api/llm/...")` | 7 | 7 (migracja zaplanowana) |
| Centralny LLM client | Brak | `src/lib/llm-client.ts` |
| Typed LLM endpoints | 0 | 10 |
| Duplikacja URL endpointów | 10 miejsc | 1 miejsce |

---

## Priorytetowe problemy do rozwiązania (backlog)

| Priorytet | Problem | Ryzyko |
|-----------|---------|--------|
| 🔴 Krytyczny | Brak auth w module Notes | Bezpieczeństwo |
| 🟡 Wysoki | `TaskDetail.tsx` 688 linii | Utrzymywalność |
| 🟡 Wysoki | `NoteRow.tsx` 513 linii | Utrzymywalność |
| 🟡 Wysoki | Migracja fetchów do `llm-client.ts` | DRY |
| 🟢 Średni | `TasksGuide.tsx` 1036 linii | Utrzymywalność |
| 🟢 Średni | Unifikacja `TagChip` + `TaskTagBadge` | DRY |
