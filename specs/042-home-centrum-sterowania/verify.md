# Weryfikacja: 042 — Strona główna jako centrum sterowania

- **Spec:** ./spec.md · **Plan:** ./plan.md · **Zadania:** ./tasks.md
- **Data:** 2026-08-02
- **Środowisko:** lokalny Postgres 16 (`omnia_dev`), Chromium headless (Playwright, projekt `desktop`),
  serwer `next dev` uruchamiany przez `scripts/e2e-web.sh`. **Nigdy prod DB** (C-13).

---

## 1. Bramki techniczne

| Komenda | Wynik |
|---|---|
| `npm run check:migrations` | ✅ OK — następny wolny numer `0222` |
| `npm run check:actions` | ✅ OK — 160 akcji, wszystkie z egzekutorem i kontraktem |
| `npm run check:ai-coverage` | ✅ OK — 545 akcji: kontrola dostępu i klasyfikacja kompletne |
| `npm run check:cost-badge` | ✅ OK — 34 pliki wołające model |
| `npm run check:content-memory` | ✅ OK — 34 pliki sklasyfikowane |
| `npx next lint --dir src` | ✅ OK — **0 błędów**; ostrzeżenia wyłącznie preegzystujące (żadne z nowych plików) |
| `npx tsc --noEmit` | ✅ OK |
| `npx next build` | ✅ **EXIT=0**, „✓ Compiled successfully" |
| `npx prisma migrate deploy` (lokalnie) | ✅ tabela `FavoriteView`, 2 indeksy, FK `ON DELETE CASCADE` |
| E2E `smoke.spec.ts` (regresja) | ✅ **12/12 passed** |

---

## 2. Kryteria akceptacji

Legenda dowodu: **E2E** = wykonany test przeglądarkowy · **DB** = test na prawdziwej bazie ·
**JEDN** = test funkcji na prawdziwym module · **KOD** = prześledzenie logiki (bez wykonania).

| AC | Werdykt | Dowód |
|---|---|---|
| **AC-1** zapis z filtrami | ✅ | **E2E** `[fav-AC1-AC2-AC3]` — zapis z `/tasks?status=DONE&x=1`, gwiazdka przechodzi w stan „w ulubionych" |
| **AC-2** powrót pod ten sam adres | ✅ | **E2E** — kliknięcie zakładki daje URL `/tasks?status=DONE&x=1` (z parametrami) |
| **AC-3** gwiazdka jako przełącznik | ✅ | **E2E** — ponowny klik wraca do stanu „zapisz" |
| **AC-4** dostęp z każdej strony + filtrowanie | ✅ | **E2E** `[fav-AC4]` — przełącznik otwarty z `/portfel`, filtr „Kuchnia", skok do `/kitchen` |
| **AC-5** skrót klawiszowy | ❌ | **E2E** `[fav-AC5]` — `Alt+1` **nie nawigował** (URL został `/kitchen`). Szczegóły w §5, defekt **D-2** |
| **AC-6** pusty stan | ⚠️ | **KOD** — `FavoriteCards` zwraca jedną linijkę zachęty, `FavoritesSidebarSection` zwraca `null` przy zerze wpisów. Testu E2E **nie udało się doprowadzić do zielonego** z powodu D-1 (patrz §5) |
| **AC-7** zarządzanie | ⚠️ | **KOD** — `FavoriteViewsEditor` (zmiana nazwy/ikony/koloru, kolejność, usunięcie). E2E zablokowany przez D-1 |
| **AC-8** RBAC | ✅ | **JEDN** — `filterAccessibleFavorites([{/portfel},{/tasks…},{/notes}], ["module.tasks","module.notes"])` → odfiltrowuje `/portfel`. Filtr wpięty we wszystkich 4 miejscach renderowania |
| **AC-9** brak duplikatów | ✅ | **DB** — `@@unique([ownerId, path])` odrzuca drugi zapis tej samej ścieżki; ten sam adres u innego konta przechodzi |
| **AC-10** synchronizacja między urządzeniami | ✅ | **E2E** `[fav-AC10]` — po `localStorage.clear()` + `sessionStorage.clear()` zakładka nadal widoczna (dane przy koncie, nie w przeglądarce) |
| **AC-11** asystent widoczny, nie znika | ⚠️ | **KOD** — kolumna `position: sticky; top: 0`, pole tekstowe gotowe do pisania. **Nie zweryfikowano wizualnie** przy ≥1280 px |
| **AC-12** mobile, jeden sidebar | ⚠️ | **KOD** — kolumna asystenta `hidden xl:block`; mobilny pasek bez zmian strukturalnych. Projekt `mobile` w E2E **niedostępny** (WebKit nie istnieje w sandboxie) |
| **AC-13/14** briefing + pusty stan | ✅ | **KOD** — `DailyBriefingCard` nietknięty, zachowanie bez zmian (kryterium „nie zepsuj") |
| **AC-15** skróty modułów wg uprawnień | ✅ | **KOD** — `ModuleSnapshotGrid` nietknięty, nadal filtruje po `permissions` |
| **AC-16** 3/2/1 kolumny, brak przewijania poziomego | ⚠️ | **KOD** — `grid-cols-1 md:grid-cols-2` + flex z kolumną 340 px od `xl`, `minWidth: 0` na elementach. **Nie zmierzono** `scrollWidth === clientWidth` na 3 szerokościach |
| **AC-17** skórki, tylko tokeny | ✅ | **GREP** — w nowych plikach zero hexów i zero `rgba()` z liczbami poza `rgba(0,0,0,…)` przyciemniającym tło nakładki (wzorzec repo, `Modal.tsx`). Kolory z `var(--*)` i `color-mix` |
| **AC-18** zachowana personalizacja pulpitu | ✅ | **KOD** — `order`/`hidden`/`effectiveOrder` nietknięte; `favorites` dopisany do `DASHBOARD_SECTIONS`, więc `sanitizeSectionKeys` go przepuszcza, a `effectiveOrder` dokleja na końcu |
| **AC-19** sekcje AI nie generują się same | ✅ | **KOD** — `DailyBriefingCard`: efekt czyta wyłącznie `localStorage`, `generate()` nie jest w nim wołane (0 trafień); `AISuggestions` nie wywołuje modelu |
| **AC-20** dotyk nie zapala checkboxa | ⚠️ | **KOD** — `[@media(hover:hover)]:group-hover:opacity-100` + `pointer-events-none`. **Nie zweryfikowano** w emulacji dotyku |
| **AC-21** mysz nadal pokazuje checkbox | ⚠️ | **KOD** — gałąź `[@media(hover:hover)]` zachowuje dotychczasowe zachowanie |
| **AC-22** tryb zaznaczania na obu | ✅ | **KOD** — gałąź `selectionMode ? "opacity-100"` nietknięta |
| **AC-23** rozciągane pole opisu | ⚠️ | **KOD** — pomiar `scrollHeight` z resetem do `"auto"`, sufit 60vh. **Nie zweryfikowano** wizualnie |
| **AC-24** potwierdzenie czyszczenia | ⚠️ | **KOD** — `Modal` z liczbą pozycji i informacją o nieodwracalności. E2E **pominięty** (test przygotowuje własne dane, ale nie doszedł do wykonania po D-1/D-2) |
| **AC-25** Notatki mówią „Foldery" | ✅ | **E2E** `[ux-AC25-AC26]` + **GREP** — 0 trafień „grup" w tekstach UI Notatek |
| **AC-26** Zadania zostają przy „Grupach" | ✅ | **E2E** + **GREP** — `TasksSideNav` nadal 19 wystąpień |
| **AC-27** dane i adresy nienaruszone | ✅ | **E2E** — `/notes/groups` odpowiada, nagłówek „Foldery notatek"; model i kolumny nietknięte |

**Podsumowanie:** ✅ 16 · ⚠️ 10 · ❌ 1.

---

## 3. Zgodność z konstytucją

| Reguła | Stan |
|---|---|
| C-01 (praca w `worldofmag/`) | ✅ — jeden błąd (katalog migracji utworzony w katalogu głównym) **wykryty i cofnięty** przed commitem |
| C-02 (alias `@/*`) | ✅ |
| C-10/C-11 (ręczna migracja, unikalny numer) | ✅ `0221_ulubione_widoki` |
| C-12 (zero enumów Prisma) | ✅ `icon`/`color` jako `String` + unia TS |
| C-13 (nigdy prod DB) | ✅ wszystko na lokalnym Postgresie |
| C-20 (`revalidatePath`) | ✅ każda mutacja kończy `revalidatePath("/", "layout")` |
| C-21 (własność) | ✅ świadome user-only z uzasadnieniem w planie §2.3; `where: {id, ownerId}` **zweryfikowane na bazie** |
| C-22 (RBAC) | ✅ brak nowego sluga; filtr po `isPathLocked` |
| C-23 (`AIAction`) | ✅ brak nowych akcji AI; manifest pokrycia uzupełniony |
| C-30 (tylko zmienne CSS) | ✅ |
| C-31 (mobile/keyboard) | ⚠️ mobile niezweryfikowany (brak WebKita); skrót klawiszowy **nie działa** (D-2) |
| C-32 (teksty PL) | ✅ |
| C-50 (build zielony) | ✅ |
| C-51 (`doświadczenia.md`) | ✅ 7 wpisów |
| C-53 (minimalizm) | ✅ asystent nietknięty poza ~10 liniami w istniejącym handlerze |

---

## 4. Regresje

- **`smoke.spec.ts`: 12/12 ✅** — nawigacja po wszystkich modułach i konsola admina działają.
  (Pierwszy przebieg pokazał 9 błędów — przyczyną były **dwa równoległe uruchomienia E2E**
  konkurujące o ten sam port i bazę, nie zmiana w kodzie. Powtórka na czysto: komplet zielony.)
- **Migracja** nie zmienia żadnej istniejącej tabeli — wyłącznie `CREATE TABLE`, więc sąsiednie
  moduły są nietknięte.
- **Zmiana nazewnictwa** dotyczy wyłącznie łańcuchów tekstowych; `/notes/groups` odpowiada, model bez zmian.

---

## 5. Defekty do naprawy

### D-1 — Gwiazdka bywa nieklikalna (`disabled` zależny od efektu) — **blokujący**
`FavoriteStarButton` ma `disabled={!fullPath || isPending}`, a `fullPath` jest ustawiane dopiero
w `useEffect`. W praktyce oznacza to, że przycisk jest wyłączony przy pierwszym renderze **i przy
każdym ponownym zamontowaniu drzewa**.

**Dowód (Playwright, wielokrotnie powtarzalny):**
```
locator resolved to <button disabled aria-pressed="false" title="Zapisz to miejsce w ulubionych" …>
attempting click action — waiting for element to be visible, enabled and stable
element was detached from the DOM, retrying
```
Ponowne montowanie realnie zachodzi, bo aplikacja ma **preegzystujący błąd hydratacji** (D-3), po
którym React przełącza cały korzeń na renderowanie po stronie klienta.

**Kierunek naprawy:** nie uzależniać `disabled` od `fullPath` — ścieżkę wyliczać **synchronicznie
w momencie kliknięcia** (`window.location`), a stan z efektu wykorzystywać wyłącznie do wyglądu
(gwiazdka pełna/pusta). To usuwa całą klasę problemów z czasem wykonania efektu.

### D-2 — `Alt+1` nie nawiguje — **blokujący (AC-5)**
`Alt+0` (otwarcie przełącznika) **działa**, więc listener żyje i warunki modyfikatorów są poprawne
(zdarzenie dociera z `code:"Digit1"`, `alt:true`, `ctrl:false`). Mimo to `router.push(target.path)`
nie zmienia adresu — sprawdzone również w wariantach `setTimeout(…,0)` i `startTransition`.
Ta sama metoda `router.push` **działa** wywołana z reactowego handlera w przełączniku (AC-4 zielony).

**Stan diagnozy:** niedomknięta. Kolejne przebiegi psuły sobie dane (patrz D-1), więc nie udało się
odizolować, czy przyczyną jest degradacja routera po błędzie hydratacji (D-3), czy sam kontekst
natywnego listenera. **Do rozstrzygnięcia po naprawie D-1**, na czystych danych.

### D-3 — Preegzystujący błąd hydratacji psuje renderowanie serwerowe całej aplikacji — **poza zakresem 042**
```
Warning: Text content did not match. Server … Client …   at style  at AICommandSheet
pageerror: Text content does not match server-rendered HTML.
pageerror: There was an error while hydrating. … the entire root will switch to client rendering.
```
Źródło: `<style>{MARKDOWN_STYLES}</style>` w `AICommandSheet` — deklaracja `content: "•"` jest
serializowana inaczej na serwerze (`&quot;`) niż na kliencie (`"`).

**To NIE jest regresja tej zmiany:** `MARKDOWN_STYLES` w `AICommandSheet` pochodzi z commita
`76451ea`, a `lib/markdown.ts` był ostatnio ruszany 2026-07-20 na `master`. Skutek jest jednak
poważny (cała aplikacja traci renderowanie serwerowe i router bywa niestabilny), więc **zasługuje
na własny spec**. Naprawa w ramach 042 byłaby refaktorem „przy okazji" (C-53).

---

## 6. Ograniczenia weryfikacji (uczciwie)

- **Projekt `mobile` niedostępny** — wymaga WebKita, którego w sandboxie nie ma i nie da się pobrać.
  AC-12, AC-20, AC-21 nie zostały sprawdzone na prawdziwym urządzeniu dotykowym.
- **AC-16/AC-17 nie zmierzone na trzech szerokościach** — brak pomiaru `scrollWidth` i przełączenia
  skórki w przeglądarce.
- **AC-23/AC-24 nie wykonane w przeglądarce** — testy istnieją w `e2e/specs/favorites.spec.ts`,
  ale nie doszły do wykonania (tryb `serial` przerywa po pierwszym błędzie).
- E2E działa na `next dev`, nie na buildzie produkcyjnym — część zachowań (hydratacja) może się
  różnić na produkcji.

---

## 7. Werdykt końcowy

## ❌ DO POPRAWY

Trzy kryteria wymagają domknięcia, a jedno (AC-5) jest **niespełnione**:

1. **D-1** — usunąć zależność `disabled` od efektu w `FavoriteStarButton` (blokuje też weryfikację
   AC-6, AC-7, AC-24).
2. **D-2** — doprowadzić `Alt+1..9` do faktycznej nawigacji i potwierdzić testem (AC-5).
3. Po naprawie — **dokończyć przebieg** `e2e/specs/favorites.spec.ts` (AC-6, AC-7, AC-24) i dopisać
   pomiary AC-16/AC-17.

**D-3 zostaje odnotowany, ale nie blokuje 042** — to defekt preegzystujący, do osobnego specu.

Powrót do `/implement` z zadaniami **T-22 … T-25** dopisanymi do `tasks.md`.
