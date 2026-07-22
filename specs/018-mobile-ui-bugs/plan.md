# Plan techniczny: Poprawki UI na mobile — zadania + asystent AI

- **Spec:** ./spec.md (018-mobile-ui-bugs)
- **Status:** draft
- **Data:** 2026-07-22

> **Zasada planu:** to jest **JAK**. Cztery niezależne, drobne naprawy prezentacyjne (klient/CSS).
> Zero zmian schematu, Server Actions, RBAC, AI. Wzorce bierzemy z sąsiedniego kodu (C-53).

## 1. Podejście
Cztery punktowe naprawy w istniejących komponentach modułu Tasks i asystenta AI oraz jedna globalna
reguła CSS. Każda naprawa celuje w konkretną, zidentyfikowaną przyczynę (poniżej), bez refaktorów.
Wzorce: pasek narzędzi zadań (`TasksPage.tsx` — przewijalny rząd `overflow-x-auto [&>*]:flex-shrink-0`)
oraz istniejąca reguła anty-zoom w `globals.css`.

**Zidentyfikowane przyczyny (rekonesans kodu):**
1. **Pasek akcji masowych** (`BulkActionBar.tsx:186`): główny rząd `flex items-center gap-1 p-2` nie ma
   ani zawijania, ani przewijania; na mobile pill jest `w-full`, a 7 przycisków akcji (`min-w-[52px]`) +
   licznik + separatory + „X" przekraczają szerokość telefonu → prawa część jest ucięta poza ekran.
2. **Auto-zoom iOS w asystencie** (`AICommandSheet.tsx:1502`): pole kompozytora ma **inline**
   `fontSize: 15`. Style inline mają wyższą specyficzność niż reguła z arkusza
   `@media (pointer: coarse){ textarea{ font-size:16px } }` (`globals.css:129`), więc na iOS efektywny
   rozmiar to 15px < 16px → Safari przybliża. Ten sam problem dotyczy `SmartTextarea.tsx:195`
   (`fontSize:14`) i potencjalnie innych pól z inline `fontSize < 16`.
3. **Sortowanie „zrobionych"** (`CompletedSection.tsx:16,30`): sekcja „✓ Zrobione / Anulowane" jest
   **domyślnie zwinięta** (`defaultOpen={false}`). Sam sort działa poprawnie (sortuje po `completedAt`
   malejąco), ale efekt jest schowany w zwiniętej grupie → użytkownik nie widzi żadnej różnicy po
   kliknięciu ikony. Stan aktywny przycisku istnieje (kolor `accent-blue`, `TasksPage.tsx:580`).
4. **Kreska iOS zasłania kompozytor** (`AICommandSheet.tsx:1423`): stopka kompozytora ma tylko
   `px-4 py-3`, bez `env(safe-area-inset-bottom)`. Sheet jest dolny (`items-end`, `height:85vh`,
   `inset-0`), więc jego dolna krawędź = dół ekranu → home indicator nachodzi na kompozytor.

## 2. Model danych (Prisma)
**Bez zmian w schemacie.** Brak nowych modeli/kolumn, brak migracji. `completedAt` już istnieje na
`Task` i jest ustawiane w `actions/tasks.ts` (przy statusie `DONE`).

## 3. Warstwa serwera (Server Actions — C-20)
**Bez zmian.** Żadna naprawa nie dotyka danych ani `revalidatePath`. Wszystkie cztery to warstwa
prezentacji po stronie klienta (React/CSS).

## 4. RBAC / rejestr modułu (C-22)
**Bez zmian.** Korzystamy z istniejącego `module.tasks` i asystenta na Home. Brak nowych slugów,
wpięć `permissions.ts`/`modules.tsx`/`ModuleSidebar`.

## 5. UI (C-30, C-31, C-32)

### 5.1 Pasek akcji masowych — AC-1
- Plik: `src/components/tasks/BulkActionBar.tsx`, główny rząd (obecnie `className="flex items-center
  gap-1 p-2"`, ~linia 186).
- Zmiana: dodać `overflow-x-auto` i zabezpieczyć dzieci przed kurczeniem —
  `className="flex items-center gap-1 p-2 overflow-x-auto [&>*]:flex-shrink-0"` (wzorzec 1:1 z
  `TasksPage.tsx:494`). Na mobile pill `w-full` → wszystkie akcje osiągalne przez przewinięcie poziome;
  na desktopie `md:w-auto` mieści się bez zmian. Bez zmian kolorów (C-30), teksty PL (C-32).
- Uwaga: popovery paneli (`absolute bottom-full`) pozostają bez zmian — kotwiczą się do przycisków.

### 5.2 Globalny anty-zoom pól — AC-2 (najważniejsza, globalna)
- Plik: `src/app/globals.css`, reguła `@media (pointer: coarse)` (~linie 129–135).
- Zmiana: dodać `!important` do `font-size: 16px` w tej regule, aby wygrywała z inline `fontSize < 16`
  na urządzeniach dotykowych. Efekt: kompozytor asystenta (15px), `SmartTextarea` (14px) i wszelkie
  inne pola input/textarea/select z inline sub-16 przestają wywoływać zoom na iOS — **globalnie i na
  przyszłość**, bez tropienia każdego pola z osobna (C-53). Desktop (`pointer: fine`) bez zmian —
  reguła go nie dotyczy, więc gęstość tekstu zachowana (AC-5).
- Komentarz w CSS aktualizujemy: wyjaśnić, że `!important` jest potrzebny, bo pola bywają stylowane
  inline (np. kompozytor asystenta), a inline bije arkusz bez `!important`.
- **Nie** blokujemy pinch-zoomu (żadnego `maximum-scale`/`user-scalable`) — dostępność zachowana.
- Ryzyko klamrowania pól z inline `fontSize > 16` na mobile do 16px: przegląd pól aplikacji nie
  wskazuje pól wprowadzania danych celowo większych niż 16px na mobile; ewentualne zejście do 16px
  jest nieszkodliwe (czytelne, brak zoomu).

### 5.3 Widoczne sortowanie „zrobionych" — AC-3
- Plik: `src/components/tasks/CompletedSection.tsx`.
- Zmiana: gdy `sortBy === "completedAt"`, sekcja ma się **rozwinąć**, żeby przesortowana lista była
  widoczna. Realizacja minimalna, zgodna z `TaskGroup` (który czyta `defaultOpen` w `useState`):
  przekazać `defaultOpen={sortBy === "completedAt"}` **oraz** `key={sortBy}` na `<TaskGroup>` — zmiana
  `sortBy` remountuje grupę i ponownie stosuje `defaultOpen` (włączenie sortu → grupa otwarta z
  posortowaną listą; wyłączenie → wraca do zwiniętej domyślnej). To daje natychmiastową, widoczną
  różnicę po kliknięciu ikony. Stan aktywny przycisku (`accent-blue`) już istnieje — bez zmian.
- Zakres sortu bez zmian: dotyczy sekcji „Zrobione" w widoku listy (renderowanej przy filtrze
  „Wszystkie", `TaskList.tsx:205,227`) — zgodnie ze spec (poza zakresem: inne sekcje/opcje sortu).
- Uwaga (poza zakresem, tylko odnotowanie): dla projektów z własnym statusem terminalnym innym niż
  `DONE`, `actions/tasks.ts:359` czyści `completedAt` — takie zadania trafią na koniec sortu. To nie
  blokuje AC-3 (dla `DONE` `completedAt` jest ustawiane); nie zmieniamy tego zachowania.

### 5.4 Kompozytor asystenta nad kreską iOS — AC-4
- Plik: `src/components/home/AICommandSheet.tsx`, stopka kompozytora (`<div className="px-4 py-3
  flex-shrink-0" …>`, ~linia 1423).
- Zmiana: dodać inline `paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))"` (nadpisuje dolny
  `py-3`), tak by kompozytor był nad home indicatorem. Na desktopie `safe-area-inset-bottom` = 0 →
  zachowanie bez zmian. Wzorzec spójny z FAB (`AICommandSheet.tsx:1180`) i regułą C-31.

## 6. AI / integracje (C-23, C-40)
**Nie dotyczy.** Brak nowej `AIAction`/egzekutora, brak read-toola, brak kalendarza/powiadomień/
auto-expense. `check:actions` pozostaje zielony (nic nie dokładamy do `aiAction.ts`).

## 7. Pliki do utworzenia / zmiany
| Plik | Akcja | Po co |
|------|-------|-------|
| `worldofmag/src/components/tasks/BulkActionBar.tsx` | edycja | AC-1: przewijalny rząd akcji na mobile |
| `worldofmag/src/app/globals.css` | edycja | AC-2: `!important` w regule anty-zoom (coarse) |
| `worldofmag/src/components/tasks/CompletedSection.tsx` | edycja | AC-3: auto-rozwinięcie sekcji przy aktywnym sortowaniu |
| `worldofmag/src/components/home/AICommandSheet.tsx` | edycja | AC-4: `safe-area-inset-bottom` w stopce kompozytora |
| `doświadczenia.md` (root) | edycja | C-51: lekcja (inline font-size bije regułę anty-zoom; zwinięta grupa maskuje sort) |

## 8. Bramki i weryfikacja (C-50)
- Lokalna weryfikacja do kroku `next build` (bez `migrate.js` na prod DB — C-13). Zmiany są
  czysto klienckie/CSS, więc nie wymagają bazy do kompilacji; `next build` + `next lint` wystarczą.
- `npm run check:migrations` (brak nowych migracji → zielone), `npm run check:actions` (brak nowych
  `AIAction` → zielone).
- Mapowanie AC → weryfikacja:
  - **AC-1** — inspekcja `BulkActionBar` w wąskim viewport (DevTools mobile): wszystkie akcje osiągalne
    (rząd przewijalny), żaden przycisk trwale ucięty.
  - **AC-2** — inspekcja: na `pointer: coarse` efektywny `font-size` pól input/textarea/select = 16px
    (w tym kompozytor asystenta i `SmartTextarea`); brak zoomu przy focusie na iOS.
  - **AC-3** — filtr „Wszystkie" z ukończonymi zadaniami: klik ikony sortowania → sekcja „Zrobione"
    rozwija się i pokazuje zmienioną kolejność (po `completedAt`); ponowny klik wraca do stanu
    domyślnego; przycisk sygnalizuje aktywność (accent-blue).
  - **AC-4** — asystent na viewport z `safe-area-inset-bottom` > 0: całe pole kompozytora nad dolną
    krawędzią/kreską.
  - **AC-5** — desktop (`pointer: fine`): gęstość tekstu pól i układ paska bez regresji.

## 9. Ryzyka techniczne i plan wycofania
- **`!important` klamruje pola z inline `fontSize > 16` na mobile → 16px.** Mitygacja: przegląd nie
  wykazał takich pól wprowadzania danych; skutek nieszkodliwy. Rollback: usunięcie `!important`.
- **`key={sortBy}` remountuje sekcję „Zrobione" → utrata ręcznego zwinięcia/rozwinięcia przy
  przełączeniu sortu.** Akceptowalne (przełączenie sortu to świadoma akcja, a celem jest właśnie
  pokazać efekt). Rollback: cofnięcie propów.
- **Zmiana `overflow-x-auto` na pasku akcji wpływa na popovery.** Popovery są `absolute` względem
  przycisków wewnątrz rzędu — przewijanie rzędu przesuwa i kotwicę, więc pozostają spójne.
- Rollback całości: zmiany są w 4 plikach klienckich + CSS, brak migracji → zwykły revert kodu
  (kod vs migracja: tu wyłącznie kod).

## 10. Zgodność z konstytucją — checklista
- [x] C-10..C-14 (migracje) — **nie dotyczy** (brak zmian schematu; jawnie zapisane).
- [x] C-20..C-25 (server/RBAC/AI/trash/audit) — **nie dotyczy** (brak mutacji/akcji/AI).
- [x] C-30 (kolory przez zmienne CSS) — bez hardcodu kolorów; zmiany to layout/font-size/padding.
- [x] C-31 (mobile-first, `safe-area-inset-bottom`, brak dwóch sidebarów) — AC-1/AC-2/AC-4 wprost.
- [x] C-32 (teksty PL) — bez zmian tekstów; ewentualne komentarze/aria po polsku.
- [x] C-50 (build zielony) — weryfikacja do `next build`.
- [x] C-51 (wpis do `doświadczenia.md`) — ujęty w plikach do zmiany.
- [x] C-53 (minimalizm) — najmniejszy zestaw zmian, zero nowych zależności, wzorce z sąsiedniego kodu.
