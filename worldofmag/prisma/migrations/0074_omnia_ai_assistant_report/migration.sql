-- Raport implementacji: asystent AI (magiczna ikona) — pełny zasięg modułów + korekta planu (2026-06-03).
-- → widoczny w /admin/reports oraz /reports. INSERT idempotentny: ON CONFLICT (slug) DO NOTHING.

INSERT INTO "Report" ("id", "title", "slug", "content", "category", "authorId", "createdAt", "updatedAt")
VALUES (
  gen_random_uuid()::text,
  'Omnia — Raport implementacji 2026-06-03',
  'omnia-implementacja-2026-06-03',
  $omnia_ai$# Omnia — Raport implementacji 2026-06-03

> Sesja skupiona na sercu produktu: **asystencie AI („magicznej ikonie")**.
> Celem było upewnienie się, że dla **każdego modułu** asystent potrafi zrozumieć
> intencję użytkownika i przełożyć ją na poprawną ścieżkę akcji z parametrami,
> a gdy nie ma pewności — dopytać i pozwolić użytkownikowi skorygować plan.

---

## Architektura i oczekiwania od Asystenta AI (Magiczna Ikona)

### Diagnoza

Magiczna ikona to globalny FAB (`AppShell` → `home/AICommandSheet.tsx`). Jej główny
przepływ to **agent** (`/api/llm/home/agent`): pętla rozumowania z krokami
`query` (odczyt danych) → `clarify` (dopytanie) → `answer` / `plan` / `navigate`.
Plan akcji trafia do `ActionDrawer` (przegląd, edycja parametrów, opt-in akcji
destrukcyjnych), a zatwierdzone akcje wykonuje `/api/llm/home/execute`.

Przegląd modułu po module ujawnił trzy realne luki, przez które „przełomowa"
funkcja nie działała jednolicie:

1. **Niespójny zasięg modułów planisty vs. wykonawcy.** Agent miał na sztywno
   `MODULES = ["shopping","tasks","notes","pets"]` i katalog akcji tylko dla nich.
   Tymczasem `execute` od dawna potrafi wykonać również **habits, portfel, kitchen,
   flota, magazynowanie** (taki sam komplet dokumentuje starsza trasa `interpret`).
   Skutek: stojąc w `/portfel` i mówiąc *„dodaj wydatek 50 zł"*, agent w ogóle nie
   znał modułu portfel, a `normalizeActions` po cichu rzutowało nieznany moduł na
   `shopping`. Pięć modułów akcji było faktycznie „martwych" w głównym przepływie.

2. **Brak świadomości kontekstu poza pięcioma ścieżkami.** `deriveContextFromPath`
   rozpoznawało tylko `/shopping`, `/tasks`, `/notes`, `/pets`, `/magazynowanie`.
   Na `/portfel`, `/flota`, `/kitchen`, `/habits` asystent „nie wiedział, gdzie
   jest" — wpadał w domyślny zestaw 4 modułów, więc komendy specyficzne dla
   bieżącego ekranu nie miały priorytetu.

3. **Brak pętli korekty planu.** Użytkownik mógł ręcznie edytować parametry i
   odznaczać akcje, ale nie mógł **opisać słowami, co poprawić** i dostać
   przeplanowanej całości — a to było jednym z kluczowych wymagań („mówiąc co się
   nie podoba … powinna nastąpić korekta całego planu akcji").

### Rozwiązanie (i dlaczego tak)

**1. Zrównanie zasięgu agenta z możliwościami wykonawcy.** Zamiast budować nową
warstwę, doprowadzono planistę do parytetu z `execute` (jedno źródło realnych
możliwości). W `agent/route.ts` rozszerzono `MODULES` o `habits, portfel, kitchen,
flota, magazynowanie`, dopisano sekcje katalogu akcji dla tych modułów (z dokładnymi
parametrami, zgodnymi z `execute`) oraz dodano **regułę wyboru modułu podstawowego**
(pierwszy na liście „Aktywne moduły"; słowo-klucz innego aktywnego modułu — np.
„wydatek/przychód", „zatankowałem", „odhacz", „wydaj ze stanu", „zaplanuj posiłek" —
przełącza na właściwy moduł). Reguła ta istniała w `interpret`, ale nie w agencie —
dlatego po rozszerzeniu kontekstu trzeba ją było dodać, by polecenia niejednoznaczne
trafiały do modułu, na którym użytkownik akurat pracuje.

**2. Jednolita świadomość kontekstu w całej aplikacji.** `deriveContextFromPath`
rozszerzono o wszystkie moduły akcji. Wprowadzono helper `ctx(primary)`: bieżący
moduł zostaje **podstawowy**, a pozostałe dokładane są jako **dodatkowe**. Dzięki
temu asystent domyślnie działa „tu, gdzie jesteś", ale polecenia międzymodułowe
(np. *„znajdź notatkę o prezentach dla Asi i dopisz, że lubi lody"* albo
*„z notatki z zadaniami utwórz projekt import-x i pododawaj taski"*) nadal działają
z każdego ekranu — bo wszystkie moduły pozostają aktywne, tylko z innym priorytetem.

**3. Pętla korekty planu („Popraw przez AI").** To domknięcie pętli zaufania:
- Agent zwraca teraz transkrypt dialogu również przy `step:"plan"` (wcześniej tylko
  przy `clarify`), więc klient ma kontekst potrzebny do kontynuacji rozmowy.
- Dodano w body agenta pole `refine`: po jego otrzymaniu serwer dokłada do dialogu
  instrukcję „skoryguj CAŁY plan wg uwag, a jeśli coś niejasne — użyj `clarify`".
- `ActionDrawer` dostał pole tekstowe **„Popraw"** (akcent fioletowy, `Wand2`):
  użytkownik opisuje, co nie pasuje, a agent układa plan na nowo **bez zamykania
  przeglądu**. Świeży plan wymusza remount drawera (klucz `planVersion`), więc stan
  zaznaczeń/parametrów startuje czysto. Jeśli uwagi są niejasne, agent przechodzi w
  `clarify` zamiast zgadywać. Przycisk „Wykonaj" jest blokowany w trakcie korekty,
  by nie odpalić nieaktualnego planu.

Zachowano dotychczasowe gwarancje UX: ręczna edycja parametrów, akcje destrukcyjne
domyślnie odznaczone (świadomy opt-in), pełny log rozumowania, potwierdzenie przed
wykonaniem oraz potwierdzenie przed nawigacją.

### Zmienione pliki

| Plik | Zmiana |
|---|---|
| `src/app/api/llm/home/agent/route.ts` | Rozszerzono `MODULES` o 5 modułów; dopisano katalog akcji (habits/portfel/kitchen/flota/magazyn); reguła wyboru modułu podstawowego; obsługa pola `refine` (przeplanowanie); zwrot transkryptu także przy `step:"plan"`. |
| `src/components/home/AICommandSheet.tsx` | `deriveContextFromPath` pokrywa wszystkie moduły akcji (helper `ctx`); zapis transkryptu i `planVersion` przy planie; funkcja `handleRefine`; przekazanie `onRefine`/`isRefining` i klucza remountu do `ActionDrawer`. |
| `src/components/home/ActionDrawer.tsx` | Pole „Popraw przez AI" (przeplanowanie bez zamykania); blokada „Wykonaj" w trakcie korekty; ikony/kolory/etykiety dla portfel, flota, kuchnia, nawyki. |
| `doświadczenia.md` | Lekcja: utrzymywać parytet zasięgu planisty (agent/interpret) i wykonawcy (execute). |

### Stan pokrycia modułów przez asystenta (po zmianach)

| Moduł | Akcje zapisu w agencie | Świadomość kontekstu |
|---|---|---|
| Zakupy | add/update/delete item, listy | ✅ |
| Zadania | create/update/status/shift/delete, projekt | ✅ |
| Notatki | create/append/update/delete | ✅ |
| Zwierzęta | komplet akcji opieki/hodowli (PET_ACTIONS) | ✅ |
| Nawyki | toggle_habit | ✅ (było: martwe) |
| Portfel | add_expense / add_income | ✅ (było: martwe) |
| Kuchnia | plan_meal | ✅ (było: martwe) |
| Flota | add_fuel_log | ✅ (było: martwe) |
| Magazynowanie | add_storage_item / adjust_storage | ✅ (kontekst był, akcje martwe) |

> Moduły bez akcji zapisu w asystencie (health, languages, news, weather, truck,
> reports) pozostają poza planistą świadomie — nie mają jeszcze gałęzi w `execute`.
> To naturalny następny krok roadmapy: dołożyć je najpierw do `execute`, a potem do
> katalogu agenta i mapy kontekstu (kolejność wynika z lekcji tej sesji).

---

## Podsumowanie

Sesja objęła **1 zadanie** o charakterze architektonicznym, dotyczące głównej
funkcji produktu. Główne obszary zmian: trasa agenta LLM (`/api/llm/home/agent`)
oraz dwa komponenty UI asystenta (`AICommandSheet`, `ActionDrawer`).

Najważniejszy efekt: **zlikwidowano cichą lukę**, przez którą pięć modułów (nawyki,
portfel, kuchnia, flota, magazyn) miało działający wykonawca, ale planista nigdy nie
produkował dla nich akcji. Asystent zyskał też **jednolitą świadomość kontekstu**
na wszystkich ekranach modułów akcji oraz **pętlę korekty planu w języku naturalnym**
— użytkownik może teraz iteracyjnie poprawiać plan słowami, aż uzna go za gotowy,
zanim cokolwiek się wykona.

Weryfikacja: `npx tsc --noEmit` — 0 błędów; `next build` — kompilacja przeszła
(pełna lista tras wygenerowana). Zmiany są addytywne i wstecznie zgodne z
dotychczasowym UX (ręczna edycja, opt-in akcji destrukcyjnych, log rozumowania).
$omnia_ai$,
  'general',
  NULL,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("slug") DO NOTHING;
