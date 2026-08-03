# Zadania: Nawigacja po widokach, widget asystenta i układ strony głównej

- **Plan:** ./plan.md (043-nawigacja-widoki-asystent)
- **Status:** todo
- **Data:** 2026-08-03

> **Zasada listy zadań:** kolejność od najłatwiejszego do najtrudniejszego i zgodna z zależnościami.
> Każde zadanie małe, samodzielne, weryfikowalne. `[ ]` → `[x]` w trakcie `/implement`.

## Legenda
- `[ ]` do zrobienia · `[x]` zrobione · `[~]` w trakcie · `[!]` zablokowane (patrz notatki)
- `[P]` — niezależne od poprzedniego, można robić równolegle

---

## Faza 0 — Fundament danych (tor F)

- [ ] **T-1** — **Migracja `0222_raport_architektura_zdarzeniowa`** (plan §2, §5.6). Jeden
  `INSERT INTO "Report"` z dollar-quotingiem, `gen_random_uuid()::text`, kategoria `'general'`,
  `ON CONFLICT ("slug") DO UPDATE`. Slug: `omnia-architektura-zdarzeniowa-cofanie-live-2026-08-03`.
  Treść po polsku wg szkieletu z planu §5.6 — z **weryfikowalnymi odwołaniami do kodu**
  (`src/actions/*` + `revalidatePath`, `Job`/`JOB_HANDLERS`, SSE agenta, `TrashItem`,
  `NoteRevision`, `AuditLog`), wariantami (a)–(e) z kosztem i ryzykiem oraz osobną sekcją
  „czego nie da się osiągnąć tanio".
  **Gotowe, gdy:** `npm run check:migrations` zielone, migracja aplikuje się na lokalnym Postgresie,
  raport otwiera się pod `/reports/<slug>` i pokrywa AC-21, AC-22, AC-23.
  **Bez zmian w `schema.prisma`** — migracja nie rusza DDL.

---

## Faza 1 — Ulubione: odkrywalność i zarządzanie (tor A)

- [ ] **T-2** `[P]` — **Wariant `placement="viewbar"` w `FavoriteStarButton`** (plan §5.1 pkt 2):
  pełna szerokość, ikona + etykieta tekstowa („Zapisz ten widok" / „Zapisano — kliknij, by edytować").
  Istniejące warianty `"sidebar" | "topbar"` bez zmian zachowania.
  **Gotowe, gdy:** nowy wariant renderuje się poprawnie, a logika zapisu/edycji (w tym synchroniczne
  wyliczenie adresu w handlerze kliknięcia) jest ta sama co dotąd.

- [ ] **T-3** — **Sekcja ulubionych zawsze widoczna + punkt zapisu i zarządzania na górze**
  (plan §5.1 pkt 1, 3, 4). W `FavoritesSidebarSection.tsx`: usunięcie
  `if (accessible.length === 0) return null;`, zachęta przy zerze wpisów, wiersz `FavoriteStarButton
  placement="viewbar"` jako pierwszy element sekcji, ikona koła zębatego → `/settings#ulubione`.
  W `ModuleSidebar.tsx`: usunięcie gwiazdki z dołu paska (linia ~295). W `src/app/settings/page.tsx`:
  kotwica `id="ulubione"` na sekcji z `FavoriteViewsEditor`.
  **Gotowe, gdy:** na koncie bez ulubionych sekcja i punkt zarządzania są widoczne (AC-1), punkt
  zapisu jest pierwszym elementem sekcji i ma etykietę (AC-2), a link prowadzi do działającego
  edytora (AC-3). Zależy od: **T-2**.

---

## Faza 2 — Widget asystenta i układ pulpitu (tory D, E)

- [ ] **T-4** `[P]` — **Jedno źródło akcji asystenta** (plan §5.4 pkt 1). Nowy
  `src/lib/ai/assistantStarters.ts`: przeniesione `STARTER_CHIPS` z `AICommandSheet.tsx:232`
  + `buildAssistantStarters(ctx)` z logiką kontekstową dziś liczoną w `HomePage.tsx:238`.
  `AICommandSheet` importuje stąd, przestaje mieć własną listę.
  **Gotowe, gdy:** w kodzie istnieje dokładnie **jedna** lista akcji startowych, asystent działa jak
  dotąd (AC-17).

- [ ] **T-5** — **Widget `HomeAssistantCard` zamiast kolumny z polem tekstowym** (plan §5.4 pkt 2, 3).
  Nowy `src/components/home/HomeAssistantCard.tsx` (nagłówek + zawijany wiersz przycisków-akcji
  z T-4 + wejście „Otwórz asystenta", **bez `textarea`/`input`**), akcje przez
  `openAssistant({ prompt })`. Usunięcie `HomeAssistantColumn.tsx`. W `HomePage.tsx`: karta
  renderowana **przed** siatką sekcji, na pełną szerokość, **bez** `hidden xl:block`; usunięcie
  bocznej kolumny asystenta i lokalnego budowania `assistantStarters`.
  **Gotowe, gdy:** widget jest pierwszym elementem pulpitu na telefonie i na desktopie (AC-13, AC-14),
  nie zawiera pola tekstowego (AC-15), a klik akcji otwiera asystenta z **od razu wysłaną**
  wiadomością (AC-16). Zależy od: **T-4**.

- [ ] **T-6** — **Układ pulpitu bez dziur** (plan §5.5). W `HomePage.tsx` zamiana
  `grid grid-cols-1 md:grid-cols-2` na układ wielokolumnowy CSS (`columns-1 md:columns-2`,
  `column-gap: 16px`); kafelki dostają `break-inside: avoid`, `width: 100%`, `margin-bottom: 16px`,
  `min-width: 0`. Tryb personalizacji zostaje jednokolumnowy.
  **Gotowe, gdy:** kafelki o różnej wysokości pakują się ciasno (AC-18), układ poza trybem edycji jest
  co najmniej równie uporządkowany (AC-19), a przy 360/768/1440 px nie ma poziomego przewijania
  (AC-20). Zależy od: **T-5** (ten sam plik, unikamy konfliktu).

---

## Faza 3 — Rejestr skrótów (tor C)

- [ ] **T-7** `[P]` — **Czysty moduł `src/lib/shortcuts/registry.ts`** (plan §5.3 pkt 1):
  typ `ShortcutDef { id, keys, label, group, scope }`, `matchShortcut(e, keys)`, `formatKeys(keys)`.
  Reguły: goły klawisz pasuje **tylko** przy `!altKey && !ctrlKey && !metaKey`; `Shift` **nie**
  blokuje; skrót `Alt+…` wymaga `altKey && !ctrlKey` (AltGr = Ctrl+Alt na polskiej klawiaturze).
  **Gotowe, gdy:** moduł nie importuje Reacta ani Prismy, a reguły modyfikatorów są w **jednym**
  miejscu.

- [ ] **T-8** — **`ShortcutsProvider` + refaktor `useKeyboardShortcuts`** (plan §5.3 pkt 2, 3).
  Nowy `src/components/shell/ShortcutsProvider.tsx`: kontekst + **jeden** listener `keydown`,
  dyspozytor sortuje `scope: "page"` przed `"global"`, pierwszy pasujący wygrywa i robi
  `preventDefault`. Montaż w `AppShell`. `useKeyboardShortcuts` **zachowuje sygnaturę**
  `ShortcutHandlers` i tylko rejestruje się w prowiderze; przy braku prowidera degraduje się do
  własnego listenera. Znika `switch (e.key)` bez sprawdzania modyfikatorów (linie 77–81).
  **Gotowe, gdy:** żaden moduł używający hooka nie wymagał zmian, gołe `1`–`5` nadal przełączają
  zakładki (AC-10), a pisanie w polach nie wyzwala skrótów (AC-12). Zależy od: **T-7**.

- [ ] **T-9** — **Skróty ulubionych przez rejestr** (plan §5.3 pkt 4). `FavoritesShortcuts.tsx`
  przestaje mieć własny listener; rejestruje `Alt+1..9` i `Alt+0` jako `scope: "global"`.
  **Gotowe, gdy:** `Alt+1` na stronie z zakładkami wykonuje **wyłącznie** skok do ulubionego, a
  zakładka filtra się nie zmienia (AC-9). Zależy od: **T-8**.

- [ ] **T-10** — **Ściągawka skrótów** (plan §5.3 pkt 5). Nowy
  `src/components/shortcuts/ShortcutsCheatSheet.tsx` — nakładka pod klawiszem `?` i pozycją w palecie
  poleceń, listująca **zarejestrowane** skróty: sekcja „Ta strona", potem „Globalne". Oprawa na
  zmiennych motywu, `Esc` zamyka, teksty PL.
  **Gotowe, gdy:** lista pochodzi z rejestru (nie z osobnej stałej) i pokazuje skróty bieżącej strony
  oraz globalne (AC-11). Zależy od: **T-8**, **T-9**.

---

## Faza 4 — Stan widoku w adresie: faza A (tor B)

- [ ] **T-11** — **Czysty moduł `src/lib/viewState/viewState.ts`** (plan §5.2). Kodeki `oneOf`,
  `text`, `idList`, `flag`; `parseViewParams`, `buildViewQuery`. Reguły: do adresu trafiają **tylko**
  wartości różne od domyślnych, kolejność parametrów stabilna (kolejność kluczy w `spec`),
  niepoprawna wartość → wartość domyślna (nigdy wyjątek).
  **Gotowe, gdy:** moduł nie importuje Reacta ani Prismy; ten sam stan widoku daje zawsze ten sam
  adres (warunek konieczny dla `@@unique([ownerId, path])` w ulubionych).

- [ ] **T-12** — **Hook `src/hooks/useViewState.ts`** (plan §5.2). Wartość startowa **z propsa
  serwerowego** (zero odczytu `window` w pierwszym renderze — lekcja o rozjeździe hydratacji),
  zapis przez `window.history.pushState` (domyślnie) / `replaceState` (opcja dla pól tekstowych),
  odczyt cofnięcia przez listener `popstate`. **Nie używamy `useSearchParams`.**
  **Gotowe, gdy:** hook nie powoduje rozjazdu hydratacji ani pobrania RSC przy zmianie filtra.
  Zależy od: **T-11**.

- [ ] **T-13** — **Zadania: stan widoku w adresie** (plan §5.2, tabela fazy A). Klucze `filter`,
  `tags`, `group`, `layout`. `page.tsx` czyta `searchParams` i przekazuje je propsem; `TasksPage`
  zamienia cztery `useState` na `useViewState`; `initialFilter` staje się wartością domyślną w `spec`.
  **Gotowe, gdy:** ustawienia trafiają do adresu, wejście bez parametrów daje dotychczasowy widok
  (AC-8), a przycisk „wstecz" przywraca poprzedni stan (AC-6). Zależy od: **T-12**.

- [ ] **T-14** `[P]` — **Zakupy: stan widoku w adresie**. Klucz `filter` (`ShoppingPage`).
  **Gotowe, gdy:** j.w. dla Zakupów (AC-7, AC-8). Zależy od: **T-12**.

- [ ] **T-15** `[P]` — **Notatki: stan widoku w adresie**. Klucze `filter`, `view`; `initialPinnedOnly`
  staje się wartością domyślną. Uwaga: `NotesPage` używa dziś `useSearchParams` — zastępujemy je
  propsem z serwera, zgodnie z planem.
  **Gotowe, gdy:** j.w. dla Notatek (AC-7, AC-8). Zależy od: **T-12**.

- [ ] **T-16** — **Klikacze fazy A** — nowy `e2e/specs/view-state.spec.ts`: adres odzwierciedla filtry
  (AC-5), „wstecz" wraca do poprzedniego stanu (AC-6), Zakupy i Notatki odtwarzają stan (AC-7),
  wejście bez parametrów = widok domyślny (AC-8), zapis widoku z filtrami przez ulubione i powrót
  (AC-4).
  **Gotowe, gdy:** komplet zielony. **To jest bramka fazy B** — bez niej nie ruszamy T-17.
  Zależy od: **T-13**, **T-14**, **T-15** (oraz **T-3** dla AC-4).

---

## Faza 5 — Stan widoku w adresie: faza B (tor B, ciąg dalszy)

- [ ] **T-17** — **Artefakt pokrycia `specs/043-nawigacja-widoki-asystent/pokrycie-widokow.md`**
  (plan §5.2, faza B). Zweryfikowany **w kodzie** przegląd wszystkich modułów: kolumny
  *moduł · plik · stan widoku · decyzja (pokryty / pominięty) · uzasadnienie*. Pominięcia dopuszczalne
  dla paneli administracyjnych i dla stanu formularzy/okien dialogowych — każde z powodem.
  **Gotowe, gdy:** żaden moduł z listy `src/lib/modules.tsx` nie zostaje bez wiersza (AC-8b).
  Zależy od: **T-16**.

- [ ] **T-18** — **Faza B, grupa 1: Zdrowie, Kalendarz, Wiadomości.** Wpięcie `useViewState` wg
  artefaktu z T-17 (`tab`, filtr modułu, `view`).
  **Gotowe, gdy:** dla każdego z trzech: zapis widoku odtwarza ustawienia, wejście bez parametrów
  bez regresji (AC-8a). Zależy od: **T-17**.

- [ ] **T-19** `[P]` — **Faza B, grupa 2: Usługi (katalog, moje zlecenia, moderacja) + Pogoda →
  Pomysły.** Szukajka/sortowanie/filtry katalogu przez `replace: true` (żeby nie zaśmiecać historii),
  zakładki przez `push`.
  **Gotowe, gdy:** j.w. (AC-8a). Zależy od: **T-17**.

- [ ] **T-20** `[P]` — **Faza B, grupa 3: Warsztaty, Zwierzęta** (zakładki widoku szczegółów).
  **Gotowe, gdy:** j.w. (AC-8a). Zależy od: **T-17**.

- [ ] **T-21** `[P]` — **Faza B, grupa 4: Magazynowanie, Kontakty, Raporty, Kuchnia** (szukajki list —
  `replace: true`).
  **Gotowe, gdy:** j.w. (AC-8a). Zależy od: **T-17**.

---

## Faza 6 — Bramki i domknięcie

- [ ] **T-22** — **Klikacze torów A, C, D, E** — nowe `e2e/specs/shortcuts.spec.ts`,
  `e2e/specs/home-assistant.spec.ts` + rozszerzenie `e2e/specs/favorites.spec.ts`:
  pusty stan ulubionych i nowe położenie gwiazdki (AC-1, AC-2, AC-3), `Alt+1` bez zmiany zakładki
  (AC-9), goła cyfra przełącza zakładkę (AC-10), ściągawka `?` (AC-11), pisanie nie wyzwala skrótów
  (AC-12), widget na `devices["Pixel 5"]` bez przewijania i jako pierwszy (AC-13, AC-14), brak pola
  tekstowego (AC-15), akcja uruchamiana od razu (AC-16), pomiar dziur i braku poziomego przewijania
  (AC-18, AC-19, AC-20).
  **Gotowe, gdy:** komplet zielony. Zależy od: **T-3**, **T-6**, **T-10**.

- [ ] **T-23** — **Klikacze fazy B** — po jednym przejściu „zapisz widok → wyjdź → wróć" na moduł
  objęty T-18..T-21 (AC-8a) oraz „wejście bez parametrów" (AC-8).
  **Gotowe, gdy:** komplet zielony. Zależy od: **T-18**..**T-21**.

- [ ] **T-24** — **Bramki repo (C-50)**: `npm run check:migrations`, `check:actions`,
  `check:ai-coverage`, `check:cost-badge`, `check:content-memory`, `next lint --dir src`,
  `next build` na **lokalnym Postgresie** (C-13 — nigdy prod DB).
  **Gotowe, gdy:** wszystko zielone **bez modyfikacji manifestów pokrycia** — plan §3 zakłada, że
  feature nie dodaje ani akcji, ani wywołań LLM; żądanie wpisu = rozjazd z planem i sygnał do
  zawrócenia wg C-54. Zależy od: **T-1**..**T-23**.

- [ ] **T-25** — **Mapowanie AC → wynik** (wejście do `/verify`): tabela AC-1..AC-23 (+AC-8a, AC-8b)
  z dowodem weryfikacji. Osobno **odnotowanie interpretacji AC-2** z planu §5.1 (brak wspólnego
  górnego paska na desktopie → punkt zapisu na górze nawigacji) do oceny na etapie `/verify`.
  Zależy od: **T-24**.

- [ ] **T-26** — **Wpisy do `doświadczenia.md`** (C-51), po polsku, w formacie repo:
  (1) kolizja `Alt+cyfra` — `switch (e.key)` bez sprawdzania modyfikatorów i dlaczego pierwszeństwa
  strony nie da się uzyskać dwoma listenerami na `window`;
  (2) puste dziury na pulpicie — CSS Grid wyrównuje wiersze do najwyższego elementu, układ
  wielokolumnowy pakuje ciasno;
  (3) jeśli wypłynie — pułapki `window.history.pushState` w App Routerze.
  Zależy od: **T-24**.

---

## Mapowanie kryteriów akceptacji → zadania

| AC | Zadania |
|----|---------|
| AC-1, AC-2, AC-3 | T-2, T-3 · weryfikacja T-22 |
| AC-4 | T-3, T-13 · weryfikacja T-16 |
| AC-5, AC-6 | T-11, T-12, T-13 · weryfikacja T-16 |
| AC-7 | T-14, T-15 · weryfikacja T-16 |
| AC-8 | T-11, T-13, T-14, T-15, T-18..T-21 · weryfikacja T-16, T-23 |
| AC-8a | T-18, T-19, T-20, T-21 · weryfikacja T-23 |
| AC-8b | T-17 |
| AC-9 | T-7, T-8, T-9 · weryfikacja T-22 |
| AC-10, AC-12 | T-7, T-8 · weryfikacja T-22 |
| AC-11 | T-10 · weryfikacja T-22 |
| AC-13, AC-14, AC-15, AC-16 | T-5 · weryfikacja T-22 |
| AC-17 | T-4 · weryfikacja statyczna w T-25 |
| AC-18, AC-19, AC-20 | T-6 · weryfikacja T-22 |
| AC-21, AC-22, AC-23 | T-1 · weryfikacja T-25 |

**Żadne AC nie zostaje bez zadania i bez sposobu weryfikacji.**

---

## Ścieżka krytyczna

```
T-11 → T-12 → T-13/T-14/T-15 → T-16 (bramka) → T-17 → T-18..T-21 → T-23 → T-24 → T-25/T-26
T-7  → T-8  → T-9 → T-10 ─────────────────────────────────┐
T-2  → T-3 ───────────────────────────────────────────────┼→ T-22 → T-24
T-4  → T-5 → T-6 ─────────────────────────────────────────┘
T-1 (niezależne od wszystkiego) ──────────────────────────→ T-24
```

Trzy tory (skróty, ulubione, asystent+pulpit) są wzajemnie niezależne i mogą iść równolegle.
**T-16 jest twardą bramką:** faza B nie startuje, dopóki mechanizm nie sprawdzi się na trzech
pierwszych modułach — to główna mitygacja ryzyka „faza B dotyka kilkunastu modułów" (plan §9).

## Notatki / blokady
- Brak na start.
