# Spójność pionowa — backend → frontend → UI/UX

> Przebudowa jest **pionowa**, nie tylko serwerowa. Trzy zgłoszenia z wersji 043 („gwiazdki nie
> widać", „dziwny układ komponentów", „widget niewidoczny na telefonie") były **objawami braku
> warstwy UI**, a nie błędami w kodzie.

## 1. Warstwy i odpowiedzialności

| Warstwa | Odpowiada za | Czego NIE robi | Jak testowana |
|---------|--------------|----------------|---------------|
| `domain/` | reguły biznesowe | nie zna Prismy, Reacta, sesji | jednostkowo, bez bazy, w milisekundach |
| `actions/` | dostęp, transakcja, zdarzenie, `revalidate` | nie zawiera reguł biznesowych | integracyjnie |
| `contract.ts` | granica modułu + egzekwowanie dostępu | nie zawiera logiki | typami + testem kontraktowym |
| `app/` | sesja, pobranie danych, render | nie zawiera logiki | E2E |
| `ui/` | prezentacja i interakcja | nie woła bazy | E2E |
| `platform/` | wspólne zdolności | nie zna modułów | jednostkowo |

## 2. Wzorzec akcji

```ts
"use server";

export async function completeShoppingList(listId: string, expectedVersion: number) {
  // 1. Dostęp — platforma, jedno wywołanie, działa też dla zasobu współdzielonego
  const ctx = await requireAccess({ type: "shopping.list", id: listId }, "list.complete");

  // 2. Pobranie
  const list = await prisma.shoppingList.findUniqueOrThrow({
    where: { id: listId }, include: { items: true },
  });

  // 3. Reguła biznesowa — domena, bez bazy, testowalna osobno
  const summary = summariseCompletion(list);           // domain/completion.ts

  // 4. Zapis z kontrolą współbieżności + zdarzenie W JEDNEJ TRANSAKCJI
  await prisma.$transaction(async (tx) => {
    const updated = await tx.shoppingList.updateMany({
      where: { id: listId, version: expectedVersion },
      data:  { archived: true, version: { increment: 1 } },
    });
    if (updated.count === 0) throw new ConflictError("shopping.list", listId);

    await tx.domainEvent.create({ data: {
      workspaceId: ctx.workspaceId, module: "shopping",
      type: "shopping.list.completed", actorId: ctx.user.id, payload: summary,
    }});
  });

  // 5. Unieważnienie
  revalidatePath("/shopping");
}
```

**Pięć kroków, zawsze w tej kolejności.** Każde odstępstwo to sygnał na przeglądzie kodu.

## 3. Granica serwer ↔ klient

| Zasada | Powód |
|--------|-------|
| Komponenty serwerowe domyślne; `"use client"` tylko przy realnej interaktywności | rozmiar paczki JS na telefonie |
| Do klienta trafiają **wąskie DTO**, nie modele Prismy | model niesie kolumny, których UI nie potrzebuje, a które wyciekają do przeglądarki |
| **Nigdy `useSearchParams` w powłoce** | wymusza granicę `Suspense` i degraduje renderowanie serwerowe (lekcja z 042) |
| **Nigdy CSS jako tekstowe dziecko `<style>`** | React escapuje cudzysłowy tylko na serwerze → rozjazd hydratacji kładzie **całą** aplikację (lekcja z 2026-08-02) |
| Stan widoku w adresie, nie w `useState` | udostępnianie linków, ulubione, „wstecz" (043) |
| Wersja rekordu jedzie do klienta i wraca przy zapisie | bez tego nie ma kontroli współbieżności (rozdz. 8.5) |

Dwie środkowe zasady wyglądają na drobiazgi, a obie **realnie wywróciły aplikację** — obie są
zapisane w `doświadczenia.md`. Przy przenoszeniu plików łatwo je przypadkiem złamać.

## 4. System komponentów

Aplikacja ma **dobry motyw** (zmienne CSS, skórki, `--on-accent`), ale **nie ma systemu
komponentów**. Nagłówek, stan pusty, potwierdzenie, formularz — pisane od nowa w każdym module.

To nie jest kwestia estetyki, tylko **kosztu**: każdy nowy moduł odtwarza te same rozwiązania, każdy
trochę inaczej, a poprawka UX wymaga obejścia 21 modułów.

### 4.1. `platform/ui/` — komplet

| Komponent | Zastępuje | Priorytet |
|-----------|-----------|-----------|
| `ModuleView` | ręczne nagłówki w 21 modułach | 🔴 |
| `ViewBar` | **nie istnieje** — patrz 10.5 | 🔴 |
| `EmptyState` / `LoadingState` / `ErrorState` | nierówne, często brak | 🔴 |
| `ConflictDialog` | **nie istnieje** — wymóg z rozdz. 8.5 | 🔴 |
| `ShareDialog` / `ShareBadge` | **nie istnieje** — wymóg z rozdz. 8 | 🔴 |
| `ConfirmDialog` | modale ad-hoc | 🟠 |
| `DataList` | listy z paginacją, zaznaczaniem, skrótami | 🟠 |
| `Field` / `Form` | formularze pisane od zera | 🟡 |
| `PresenceAvatars` | **nie istnieje** — rozdz. 8.8 | 🟡 |

### 4.2. Jak wymusić użycie

Samo istnienie komponentu nie wystarcza — dziś też istnieje `components/ui/home` i nie wszędzie jest
używany. Trzy mechanizmy:

1. **Kontrakt widoku** (10.5) — moduł deklaruje, zamiast rysować.
2. **Reguła lintu** przeciw surowym `<h1>`/`<button>` w `modules/*/ui/` poza listą wyjątków.
3. **Bramka `check:ui-contract`** — analogicznie do istniejących: każdy moduł ma zadeklarowane stany
   brzegowe (pusty, ładowanie, błąd, brak dostępu). Wzorzec bramek jest sprawdzony i to jego
   naturalne rozszerzenie.

## 5. Kontrakt widoku — spłata długu z wersji 043

**Konkretny, udokumentowany dług.** W 043 właściciel poprosił, żeby przycisk zapisu widoku był
„wyraźnie widoczny w pasku bieżącego widoku". Nie dało się — **nie ma wspólnego paska widoku**.
Alternatywą było przebudowanie nagłówków w ~20 modułach, więc przycisk trafił na górę nawigacji,
a odstępstwo odnotowano w recenzji.

```tsx
// Moduł deklaruje widok; powłoka rysuje ramę.
<ModuleView
  titleKey="modules.tasks.title"
  filters={<TaskFilters … />}       // pasek widoku: filtry
  actions={<TaskActions … />}       // akcje modułu
  resource={{ type: "tasks.project", id: projectId }}   // ⭐ powłoka wie, CZEGO dotyczy widok
>
  {children}
</ModuleView>
```

Dzięki `resource` **powłoka sama** dokłada do paska widoku:
- gwiazdkę „zapisz widok" (ulubione),
- **wskaźnik udostępnienia i przycisk „Udostępnij"** — w każdym module, bez 20 osobnych zmian,
- **awatary obecności** (kto jeszcze ogląda),
- wskaźnik świeżości danych,
- wejście do ściągawki skrótów.

**Moduł o tych elementach nie wie** — to jest cała istota kontraktu widoku.

## 6. Spójność UX — jedno zachowanie, jeden wzorzec

| Zachowanie | Dziś | Docelowo |
|------------|------|----------|
| Filtry i zakładki w adresie | ✅ 17 widoków (043) | obowiązkowe przez `defineModule` |
| Skróty klawiszowe | ✅ rejestr z pierwszeństwem strony (043) | + skróty deklarowane przez moduł |
| Ulubione widoki | ✅ działa | w pasku widoku, nie w nawigacji |
| **Udostępnianie** | ❌ 3 z 21 modułów, każdy inaczej | **jeden `ShareDialog` wszędzie** |
| **Konflikt edycji** | ❌ ciche nadpisanie | **`ConflictDialog` z wyborem** |
| Potwierdzenia usunięcia | 🟡 różnie | `ConfirmDialog` z platformy |
| Akcje zbiorcze | 🟡 tylko Zadania | wspólny `BulkActionBar` |
| Stany puste / ładowanie / błąd | 🟡 nierówno | obowiązkowe w kontrakcie widoku |
| Paginacja | ❌ brak | `DataList` |

**Zasada nadrzędna:** jedno zachowanie = jeden wzorzec = jeden komponent. Dwa moduły rozwiązujące to
samo inaczej to **dług do spłaty**, nie kwestia gustu autora.

## 7. Dostępność i urządzenia

Filozofia bez zmian (mobile-first, keyboard-first — `C-31`), ale przy 100 tys. użytkowników kilka
rzeczy przestaje być opcjonalnych:

- **cele dotyku ≥ 44 px** w nowych komponentach (dziś konwencja mówi 32 px — na granicy);
- **kontrast sprawdzany dla każdej skórki**, nie tylko domyślnej ciemnej — `color-mix` na tokenie
  akcentu (wzorzec z 043) jest właściwą drogą;
- **pełna nawigacja klawiaturą** — rejestr skrótów to porządkuje, ściągawka `?` czyni odkrywalnym;
- **`prefers-reduced-motion`** — jeden warunek CSS.

## 8. Kryterium sukcesu

> **Nowy moduł, napisany przez kogoś, kto nie zna reszty aplikacji, wygląda i zachowuje się jak
> pozostałe — bez czytania innych modułów. Udostępnianie, konflikty, stany brzegowe i skróty dostaje
> za darmo.**

Jeśli po Fazach 1–3 tak nie jest, kontrakt widoku jest za słaby i trzeba go domknąć przed Fazą 4.
