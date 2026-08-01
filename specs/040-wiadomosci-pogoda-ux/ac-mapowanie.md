# Mapowanie kryteriów akceptacji na wynik (wejście do `/verify`)

- **Feature:** 040-wiadomosci-pogoda-ux
- **Stan:** 17/17 zadań zamkniętych; bramki zielone

| AC | Gdzie zrealizowane | Jak sprawdzić |
|---|---|---|
| AC-1 pole tekstowe zamiast listy | `NewsSettings.tsx` — `SourceDescriptorInput` (wiersz źródła) + `<input>` w formularzu dodawania | `grep "<select"` w module → brak |
| AC-2 opis w prezentacji | `NewsItemCard` (obok nazwy + `title` badge'a), `actions/news.ts` (`descriptor`, `sourceDescriptor`) | Lektura kart i DTO |
| AC-3 kolor stabilny | `lib/news/sourceColor.ts` + test (7 przypadków) | `npx tsx --test src/lib/news/sourceColor.test.ts` |
| AC-4 migracja bez pustych opisów | `0219_opis_zrodla_wiadomosci` — `ADD` → `UPDATE` → `DROP` | **Sprawdzone na danych**: kopia tabeli z `left/center/right` + wartość spoza zbioru → „Lewica/Centrum/Prawica/Centrum", 0 pustych |
| AC-5 pusty opis nie psuje widoku | `sourceColor("")` → `--text-muted`; `title={… \|\| undefined}`; warunkowy `{descriptor && …}` | Test „brak opisu daje kolor neutralny" |
| AC-6 „Monitoruj" nie wyrzuca | `HotTopics.add()` — brak `onAdded()`, prop zmieniony na `onTopicsChanged` | Lektura `HotTopics.tsx` |
| AC-7 potwierdzenie + oznaczenie | `showToast("Dodano … do monitorowanych")` + stan `monitored` → przycisk „Monitorowany" | j.w. |
| AC-8 brak kolumny na desktopie | `NewsPage` — `md:grid-cols-[240px_1fr]` usunięte | `grep "md:grid-cols-\[240px"` → brak |
| AC-9 pełne nazwy tematów | `TopicTabs` — `whitespace-nowrap`, **bez** `truncate` | `grep truncate` w `TopicTabs` → brak |
| AC-10 najpierw wiadomości | `contentTab` domyślnie `"items"` | Lektura `NewsPage` |
| AC-11 wybór przeżywa zmianę tematu | `contentTab` w stanie strony, niezależny od `selectedId` | j.w. |
| AC-12 jeden mechanizm nawigacji | `ViewTabs` + `TopicTabs` bez wariantów `hidden md:*` | `grep "hidden md:"` w `NewsPage` → brak |
| AC-13 powrót jednym dotknięciem | `ViewTabs` renderowany **przed** blokami widoków, więc obecny w każdym | Lektura `NewsPage` |
| AC-14 widać, gdzie jestem | Aktywna zakładka: obramowanie `--accent-blue` + `aria-selected` | j.w. |
| AC-15 brak poziomego scrolla | `min-w-0` w `NewsSettings`; `overflow-x-auto` **na pasku zakładek**, nie na stronie | `grep "flex-1 truncate"` bez `min-w-0` → brak; `grep overflow-x` → tylko pasek zakładek |
| AC-16 przyczyna, nie objaw | Naprawa `min-w-0`; **żadnego** nowego `overflow-x-hidden` | `git diff \| grep "^+.*overflow-x-hidden"` → brak |
| AC-17 szczegóły w polu widzenia | `IdeasPanel` — `IdeaDetailSheet` w mapowaniu listy, pod kliknięta kartą | Lektura `IdeasPanel.tsx` |
| AC-18 brak dublującego przycisku | `ChevronRight` usunięty z `IdeaCard` i z importów | `grep ChevronRight` → brak |
| AC-19 jedna rozwinięta | Stan `open` trzyma jedną propozycję; `isOpen` per karta | Lektura `IdeasPanel.tsx` |
| AC-20 jawne zamknięcie | Przycisk zamykania w sheecie + ponowne kliknięcie w tę samą kartę (`isOpen ? setOpen(null) : openIdea`) | j.w. |

## Odstępstwa od planu

Brak. Plan przewidział wszystkie kroki, łącznie z przyczyną poziomego scrolla (znalezioną już na
etapie planowania) i pułapką „nowa nawigacja może sama rozepchnąć stronę" (`overflow-x-auto` na
kontenerze zakładek).

## Bramki (lokalny Postgres, C-13 — bez `scripts/migrate.js`)

| Krok | Wynik |
|---|---|
| `copy-docs` | ✅ |
| `check:actions` | ✅ 160 akcji |
| `check:ai-coverage` | ✅ 533 akcje, każda z guardem |
| `check:cost-badge` | ✅ |
| `check:content-memory` | ✅ |
| `check:migrations` | ✅ następny wolny numer 0220 |
| `next lint --dir src` | ✅ 0 błędów |
| `prisma generate` | ✅ |
| `next build` | ✅ „Compiled successfully"; `/wiadomosci` 17,4 kB |
| `npm run test:unit` | ✅ **567/567**, 0 pominiętych |
