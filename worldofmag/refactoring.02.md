# Raport Refaktoringu — Iteracja 02

**Data:** 2026-05-18  
**Zakres:** Rozszerzenie Component Playground — dokumentacja wszystkich komponentów UI

---

## Podsumowanie wykonawcze

Druga iteracja skupiła się na `ComponentPlayground.tsx` — adminskim przeglądzie komponentów UI. Przed zmianami playground zawierał tylko jeden komponent (`SmartTextarea`), mimo że projekt posiada 6+ dedykowanych komponentów wielokrotnego użytku. Cały playground przepisano od nowa z wyraźną architekturą.

---

## Stan przed zmianami

**`src/components/admin/ComponentPlayground.tsx` (235 linii):**
- Tylko 1 komponent: `SmartTextarea`
- Brak struktury grupowania modułów
- Cały JSX dla jednego komponentu w jednej gigantycznej funkcji
- Powtarzające się inline style bez ekstrakcji wspólnych elementów

---

## Wprowadzone zmiany

### Nowe komponenty w Playground (dodano 5):

| Komponent | Moduł | Opis |
|-----------|-------|------|
| `SmartTextarea` | ui | Bez zmian (przeniesiony) |
| `StatusBadge` | shopping | Badge statusu pozycji zakupowej |
| `TagChip` | notes | Chip tagu notatki z kolorami |
| `TaskTagBadge` | tasks | Badge tagu zadania z dynamicznym kolorem hex |
| `RecurringBadge` | tasks | Badge cykliczności z formatowaniem reguły |
| `FilterTabs` | shopping | Zakładki filtrowania z licznikami |

### Architektura playgroundu po zmianach

```
ComponentPlayground
├── Sidebar (grouped by module: ui, shopping, notes, tasks)
├── Mobile select (responsive fallback)
└── Content area
    ├── Component header (name + module badge)
    └── Per-component Doc components:
        ├── SmartTextareaDoc
        ├── StatusBadgeDoc
        ├── TagChipDoc
        ├── TaskTagBadgeDoc
        ├── RecurringBadgeDoc
        └── FilterTabsDoc
```

### Wyekstrahowane wspólne komponenty playgroundu:

**`PropsTable`** — tabela props z kolumnami: nazwa, typ, opis  
**`CodeBlock`** — blok kodu z preformatowanym tekstem  
**`SectionLabel`** — nagłówek sekcji (uppercase, muted)  
**`DemoBox`** — kontener interaktywnego demo z border

### Grupowanie w sidebarze

Komponenty są grupowane według modułu aplikacji:
- **Ogólne UI** — `SmartTextarea`
- **Zakupy** — `StatusBadge`, `FilterTabs`
- **Notatki** — `TagChip`
- **Zadania** — `TaskTagBadge`, `RecurringBadge`

---

## Metryki

| Miara | Przed | Po |
|-------|-------|----|
| Komponenty w playground | 1 | 6 |
| Linie kodu | 235 | ~370 |
| Wyekstrahowane helper komponenty | 0 | 4 |
| Grupy modułów w sidebarze | 0 | 4 |
| Mobile support (select fallback) | Brak | Jest |

---

## Treść każdego wpisu w playground

Każdy dokument komponentu zawiera:
1. **Opis** — co robi, skąd pochodzi
2. **Demo interaktywne** — żywe przykłady z wszystkimi wariantami
3. **Props table** — nazwa, typ, wymagalność, opis
4. **Kod przykładowy** — gotowy do skopiowania snippet

---

## Problemy znalezione przy okazji

1. **`TagChip` eksportuje `getTagStyle` i `TAG_COLOR_OPTIONS`** — przydatne helpers są publiczne. Dobrze.

2. **`RecurringBadge` przyjmuje `string` nie `RecurringRule`** — bo baza danych przechowuje JSON jako string. Dokumentacja to jasno wyjaśnia.

3. **`TaskTagBadge` i `TagChip` to de facto ten sam wzorzec** — obydwa to kolorowe tagi. Różnica: `TagChip` używa predefiniowanych kolorów (paletka 8 kolorów), `TaskTagBadge` przyjmuje dowolny HEX. Można by je zunifikować w przyszłości jako jeden parametryczny komponent `<Badge color={...}>`.

4. **`FilterTabs` istnieje tylko dla shopping** — Tasks mają osobny `TaskFilters.tsx` który jest dużo bardziej rozbudowany (tagi, widoki). Brak ujednolicenia wzorca tab-filtrowania między modułami.

---

## Co pozostało do zrobienia

- Dodać `TaskFilters` do playground (bardziej złożony)
- Dodać `QuickAddBar` do playground  
- Rozważyć zunifikowanie `TagChip` + `TaskTagBadge` w jednym komponencie
- Dodać `SearchBar` do playground
