# Doświadczenia — Lessons Learned

Plik prowadzony automatycznie przez Claude Code. Każdy wpis to rzeczywisty problem napotkany podczas pracy nad projektem i wyciągnięta z niego lekcja.

---

## 2026-05-21 — `trackActivity` z literal union modułów — przy nowym module trzeba rozszerzyć typ

**Problem:** Stworzyłem `src/actions/recipes.ts` i `cookbooks.ts` z `trackActivity("kitchen", …)`. TypeScript rzucił `TS2345: Argument of type '"kitchen"' is not assignable to parameter of type '"shopping" | "tasks" | "notes"'` — funkcja `trackActivity` w `src/actions/activity.ts` ma sztywno wpisany literal union dla modułów.

**Rozwiązanie:** Dodanie `"kitchen"` do literal union w sygnaturze `trackActivity(module: "shopping" | "tasks" | "notes" | "kitchen", …)`. Sama tabela `UserActivity.module` to `String` — DB nie wymaga zmian.

**Lekcja:** Po dodaniu nowego modułu — sprawdzić wszystkie literal union typy w `src/actions/activity.ts`, `src/lib/permissions.ts`, `permissionForPath()`, `MODULES` w `AppShell.tsx`. TypeScript wyłapie większość, ale warto przejrzeć ręcznie żeby nie zaskoczyło to dopiero podczas buildu.

---

## 2026-05-20 — Brakujące `teamId` w `select` po rozszerzeniu schematu

**Problem:** Dodaliśmy pole `teamId` do modelu `Report` w `schema.prisma`. Typ `ReportMeta = Omit<Report, "content">` automatycznie zaczął wymagać `teamId`. Oba zapytania Prisma używały `select` bez `teamId`, więc TypeScript rzucił błąd dopiero na produkcyjnym buildzie Render — lokalnie nie było `prisma generate`.

**Rozwiązanie:** Dodanie `teamId: true` do obu `select` w `getReportsMeta()` i `getUserReportsMeta()`. Zmiana rzutowania z `as ReportMeta[]` na `as unknown as ReportMeta[]` tam gdzie mapowanie usuwa pole `author`.

**Lekcja:** Po każdym dodaniu pola do modelu Prisma — przejrzeć wszystkie miejsca które używają `Omit<Model, ...>` jako typ zwracany. Jeśli zapytanie używa `select` (nie `include`), musi jawnie wymieniać każde pole. Typy Prisma są ścisłe — `select` bez nowego pola ≠ pełny model.

---

## 2026-05-20 — Server Actions bez `requireAuth()` na mutacjach

**Problem:** Nowe pliki akcji (`tags.ts`, `noteGroups.ts`) zostały stworzone bez dodania `requireAuth()` do funkcji mutujących (create/update/delete). `getConfigValue()` odczytywał klucz API (`groq_api_key`) bez żadnej ochrony.

**Rozwiązanie:** Dodanie `requireAuth()` do każdej funkcji mutującej w `tags.ts` i `noteGroups.ts`. `getConfigValue()` dostało `requireAdmin()`.

**Lekcja:** Tworząc nowy plik `actions/*.ts` — jako pierwszy krok dodaj `requireAuth()` lub `requireAdmin()` do każdej funkcji która modyfikuje dane. Funkcje tylko-do-odczytu (`getTags`, `getNoteGroups`) mogą być publiczne jeśli dane nie są wrażliwe, ale mutacje zawsze wymagają auth. Funkcje odczytujące wrażliwe dane (klucze API, konfiguracja) — `requireAdmin()`.

---

## 2026-05-20 — Łańcuch przekazywania propsów zerwany (searchQuery)

**Problem:** `NoteRow` implementował podświetlanie wyników wyszukiwania (`highlightMatch`), ale `searchQuery` był urywany na poziomie `NoteList` — nie był destrukturyzowany i nie trafiał do `sharedProps`, przez co `NoteGroupSection` i `NoteRow` nigdy go nie otrzymywały.

**Rozwiązanie:** Dodanie `searchQuery` do destrukturyzacji w `NoteList`, do `sharedProps`, do interfejsu `NoteGroupSectionProps` i do wywołania `NoteRow`.

**Lekcja:** Przy dodawaniu nowego propu do komponentu głęboko w drzewie — zawsze przejść cały łańcuch od góry do dołu i upewnić się że prop jest: (1) w interfejsie każdego komponentu pośredniego, (2) destrukturyzowany, (3) przekazywany dalej. Samo dodanie do interfejsu TypeScript bez destrukturyzacji nie generuje błędu kompilacji — prop po cichu ginie.

---

## 2026-05-20 — Konflikty merge: feature branch vs. bardziej zaawansowany master

**Problem:** Feature branch `claude/update-claude-config-FPi9s` modyfikował te same pliki co master, ale master był bardziej zaawansowany (miał grid view, `assertNoteAccess`, itd.). Merge `--no-ff` do mastera wygenerował konflikty w 8 plikach jednocześnie.

**Rozwiązanie:** `git checkout --ours` dla plików gdzie master był zdecydowanie bardziej kompletny (NoteRow, ShoppingPage, NoteList, NoteGroupSection, CommandPalette, notes.ts). Ręczne scalenie dla `schema.prisma` i `reports.ts` gdzie obie strony wnosiły coś unikalnego.

**Lekcja:** Przed mergem feature brancha — sprawdzić `git diff master...feature-branch` żeby zobaczyć co się rozjechało. Jeśli master poszedł dalej w tych samych plikach, lepiej zrobić `git rebase master` na feature branchu przed mergem — unika konfliktów lub ogranicza je do minimalnego diff. `--no-ff` merge jest dobry dla historii, ale rebase najpierw czyni go czystym.

---

## 2026-05-20 — `prompt()` zablokowany w niektórych kontekstach przeglądarki

**Problem:** `window.prompt()` użyte do tworzenia nowej listy zakupów w CommandPalette jest zablokowane w Safari na iOS w trybie PWA, w niektórych iframe'ach i ogólnie nie pasuje do stylu aplikacji.

**Rozwiązanie:** Inline input wbudowany bezpośrednio w CommandPalette — `useState(creatingList)` + `useState(newListName)` + ref do focusu + obsługa `Enter`/`Escape`.

**Lekcja:** Nigdy nie używać `window.prompt()`, `window.alert()`, `window.confirm()` w aplikacji Next.js. Zawsze zastępować własnym UI — inline inputem, modalem lub toast z akcją. Natywne dialogi są blokowane w PWA, iframe i na iOS Safari.
