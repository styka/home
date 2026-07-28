# Zadania: Asystent — dopracowanie UX na telefonie i komputerze + audyt zużycia tokenów

- **Plan:** ./plan.md (035-asystent-ux-mobile-i-audyt-tokenow)
- **Status:** todo
- **Data:** 2026-07-28

> **Zasada listy zadań:** od najłatwiejszego do najtrudniejszego, zgodnie z zależnościami. Fazy 0–2 to
> czyste UI (bez bazy), faza 3 to audyt i raport (jedyna migracja).

## Legenda
- `[ ]` do zrobienia · `[x]` zrobione · `[~]` w trakcie · `[!]` zablokowane
- `[P]` — niezależne od poprzedniego, można robić równolegle

---

## Faza 0 — Dotyk i układ kompozytora (Z3, Z4)

- [x] **T-1** — **Klawiatura ustępuje przy dotknięciu czegokolwiek innego** (Z3): usuń
  `keepKeyboardOpen` (`onPointerDown` + `preventDefault`) ze wszystkich przycisków kompozytora
  w `AICommandSheet.tsx`; tam, gdzie chodzi o otwarcie menu/panelu, akcja może zostać na
  `onPointerDown`, ale **bez** `preventDefault`.
  *Gotowe, gdy:* w pliku nie ma już `keepKeyboardOpen`, a każdy przycisk wykonuje swoją akcję za
  pierwszym dotknięciem. **(AC-9)**

- [x] **T-2** — **Karetka wraca do normy** (Z3): przywróć stałe `caretColor: var(--accent-blue)`
  w polu wiadomości — obejście z 034 (`showLevelMenu ? "transparent" : …`) jest zbędne, skoro pole
  traci fokus.
  *Gotowe, gdy:* w kodzie nie ma warunkowego `caretColor`. **(AC-10)**

- [x] **T-3** — **Stały odstęp od dołu zamiast skaczącego** (Z4): usuń stan `composerFocused` wraz
  z `onFocus`/`onBlur`, które go ustawiały; stopka kompozytora dostaje **stałe**
  `paddingBottom: max(0.75rem, env(safe-area-inset-bottom))`. W komentarzu zapisz przyczynę
  (zmiana wysokości w klatce, w której iOS animuje klawiaturę i liczy pozycję karetki).
  *Gotowe, gdy:* `composerFocused` zniknął z komponentu, a padding nie zależy od fokusu.
  **(AC-11, AC-12)**

---

## Faza 1 — Sekcje nagłówka jako pełne widoki (Z5, Z1d)

- [x] **T-4** — **Panele w miejscu wątku** (Z5): przenieś render sekcji `prefs` i `report` z pozycji
  „nad wątkiem" (`flex-shrink-0`) do obszaru treści wybieranego po `headerPanel`, każdy z
  `className="flex-1 overflow-y-auto"` — tak jak dziś działa historia. Kompozytor renderuj tylko przy
  `headerPanel === "none"`.
  *Gotowe, gdy:* otwarcie ustawień lub zgłoszenia problemu zasłania rozmowę, panel przewija się do
  końca, a zamknięcie przywraca wątek w tym samym stanie. **(AC-13, AC-14, AC-15)**

- [x] **T-5** — **Nowa sekcja `level`** (Z1b): dołóż `"level"` do `HeaderPanel` i wyrenderuj w niej
  `AssistantLevelSettings` (pełna wysokość, przewijanie, `padding-bottom` z bezpiecznym marginesem).
  *Gotowe, gdy:* sekcja da się otworzyć i zamknąć jak pozostałe, a jej treść przewija się do końca. **(AC-3)**

---

## Faza 2 — Konfiguracja własnego poziomu i panel kosztu (Z1, Z2, Z6)

- [x] **T-6** — **Wejście z menu poziomu** (Z1b, decyzja właściciela): w rozwijanym menu wyboru poziomu
  pozycja „Własny" dostaje **ikonę wyrównaną do prawej**; klik w ikonę (`stopPropagation`) ustawia
  poziom `custom` i otwiera sekcję `level`. Usuń z 034 automatyczne otwieranie ustawień przy samym
  wyborze poziomu `custom`.
  *Gotowe, gdy:* klik w wiersz wybiera poziom, klik w ikonę otwiera konfigurację. **(AC-2)**

- [x] **T-7** — **Uproszczenie konfiguracji** (Z1a, Z1c): usuń suwak jakość↔koszt
  (`setEffortForAll`, `EFFORT_INDEX`, `sharedEffort`) oraz rozwijane „Ustawienia zaawansowane";
  z listy modeli usuń opcję „Jak u administratora", a pola wypełniaj wstępnie wartością z poziomu
  standardowego (`op.key ?? op.defaultKey`). Gdy administrator nie przypisał modelu — czytelny
  komunikat zamiast pustego wyboru.
  *Gotowe, gdy:* w ustawieniach asystenta nie ma już suwaka ani ustawień per rodzaj działania, a w
  konfiguracji poziomu nie da się wybrać „jak u administratora". **(AC-1, AC-4)**

- [x] **T-8** — **Układ mobilny konfiguracji** (Z1d): siatka `grid-cols-1 md:grid-cols-3`, kontrolki
  `width: 100%` + `minWidth: 0`, cele dotyku `py-3`, bezpieczny margines dolny.
  *Gotowe, gdy:* przy 320 px wszystko mieści się w szerokości i nie ma przewijania w poziomie. **(AC-5)**

- [x] **T-9** — **Panel kosztu mieszczący się w oknie** (Z2): w `AiCostBadge.tsx` policz pozycję po
  otwarciu z `getBoundingClientRect()` przycisku i szerokości okna — wybierz stronę z większym zapasem
  i przytnij przesunięcie do marginesu 8 px z obu stron; przelicz na `resize`/`orientationchange`.
  *Gotowe, gdy:* panel nie wychodzi poza ekran ani przy kwocie przy lewej, ani przy prawej krawędzi.
  **(AC-6, AC-8)**

- [x] **T-10** — **Przewijanie poziome wewnątrz panelu** (Z2): `overflow-x: auto` na liście wywołań,
  wiersze `min-width: max-content`, twardy sufit `max-width: min(360px, calc(100vw - 16px))`.
  *Gotowe, gdy:* przy wąskim ekranie zawartość przewija się w panelu, a strona pod spodem stoi. **(AC-7)**

- [x] **T-11** `[P]` — **Odrzucenie skrótu powrotu** (Z6): przycisk „×" na pasku ustawiający stan
  odrzucenia (do końca sesji, bez zmian w bazie) + jawne wyzerowanie `lastConversationId` po wysłaniu
  pierwszej wiadomości.
  *Gotowe, gdy:* „×" chowa pasek, rozmowa zostaje w historii, a po wysłaniu wiadomości pasek nie wraca.
  **(AC-16, AC-17)**

---

## Faza 3 — Audyt tokenów i raport (Z7)

- [x] **T-12** — **Wyodrębnienie promptów** (plan §6.1): przenieś 1:1 `ACTION_CATALOG_HEADER/FOOTER`,
  `ACTION_CATALOG_BY_MODULE`, `buildActionCatalog`, `NAVIGATION_CATALOG`, `buildSystemPrompt` oraz
  treść promptu routera z `agent/route.ts` do nowego `src/lib/ai/agentPrompt.ts`; `fastPath.ts`
  eksportuje swój `SYSTEM_PROMPT`. **Zero zmian w treści promptów.**
  *Gotowe, gdy:* trasa importuje prompty z nowego modułu, a `tsc` przechodzi. **(warunek AC-19, AC-22)**

- [x] **T-13** — **Aktualizacja bramki** (plan §6.1): `scripts/check-action-coverage.js` czyta katalog
  akcji z `src/lib/ai/agentPrompt.ts` zamiast z pliku trasy.
  *Gotowe, gdy:* `npm run check:actions` przechodzi i nadal raportuje 160 akcji oraz komplet etykiet
  parametrów (czyli przenosiny są kompletne).

- [x] **T-14** — **Skrypt audytowy** (plan §6.2): tymczasowy `src/audyt-tokenow.ts` (`npx tsx`,
  kasowany po użyciu) odtwarza trzy prompty dla polecenia „hej", liczy tokeny istniejącym
  `estimateTokens`, zestawia je z rzeczywistymi liczbami z logu `AiCall` i generuje markdown raportu.
  *Gotowe, gdy:* skrypt wypisuje rozliczenie, którego suma odpowiada 7734 tokenom ze zgłoszenia
  (z jawnie opisaną różnicą szacunku i pomiaru). **(AC-20)**

- [x] **T-15** — **Weryfikacja neutralności przenosin** (AC-22): skrypt audytowy porównuje prompt
  wygenerowany po zmianie z treścią sprzed niej (odczyt z gita) — muszą być identyczne.
  *Gotowe, gdy:* porównanie zwraca „bez różnic". **(AC-22)**

- [x] **T-16** — **Migracja z raportem** (plan §2, §6.3): `prisma/migrations/0213_raport_audyt_tokenow/`
  — idempotentny seed `Report` (`ON CONFLICT ("slug") DO UPDATE`), slug
  `asystent-audyt-zuzycia-tokenow-2026-07-28`, treść z T-14 (analiza + załączniki A/B/C z pełnymi
  promptami i odpowiedziami). Skrypt sprawdza brak kolizji z tagiem `$report_md$`.
  *Gotowe, gdy:* `npm run check:migrations` przechodzi, migracja aplikuje się na lokalnej bazie i jest
  odporna na powtórne uruchomienie, a raport da się odczytać z bazy. **(AC-18, AC-19, AC-21)**

---

## Faza 4 — Bramki i domknięcie

- [ ] **T-17** — **Bramki**: `npm run check:migrations`, `npm run check:actions`,
  `npm run check:ai-coverage`, `npx next lint --dir src`, `npx next build` na **lokalnym** Postgresie
  (C-13, bez `scripts/migrate.js`).
  *Gotowe, gdy:* wszystkie zielone.

- [x] **T-18** — **Dokumentacja**: `CLAUDE.md` — odnotowanie `src/lib/ai/agentPrompt.ts` w opisie
  asystenta (gdzie mieszka prompt i że bramka czyta go stamtąd).
  *Gotowe, gdy:* opis odpowiada stanowi kodu.

- [x] **T-19** — **Lekcje** (C-51): wpis do `doświadczenia.md` — (a) karetka na iOS a układ zmieniający
  wysokość w momencie pojawienia się klawiatury, (b) pamięć podręczna promptu, która nigdy nie trafia,
  bo prefiks jest budowany dynamicznie.

---

## Mapowanie kryteriów akceptacji → zadania

| AC | Zadanie | AC | Zadanie |
|----|---------|----|---------|
| AC-1 | T-7 | AC-12 | T-3 |
| AC-2 | T-6 | AC-13 | T-4 |
| AC-3 | T-5 | AC-14 | T-4, T-5 |
| AC-4 | T-7 | AC-15 | T-4 |
| AC-5 | T-8 | AC-16 | T-11 |
| AC-6 | T-9 | AC-17 | T-11 |
| AC-7 | T-10 | AC-18 | T-16 |
| AC-8 | T-9 | AC-19 | T-12, T-16 |
| AC-9 | T-1 | AC-20 | T-14 |
| AC-10 | T-2 | AC-21 | T-16 |
| AC-11 | T-3 | AC-22 | T-12, T-15 |

## Notatki / blokady
- T-13 musi iść **razem** z T-12 — rozdzielenie ich zostawia build na czerwono (bramka nie znajdzie
  katalogu akcji). To zamierzone zabezpieczenie kompletności przenosin.
- T-16 zależy od T-14 (treść raportu) i pośrednio od T-12 (dostęp do promptów).
- Faza 0–2 nie dotyka bazy, więc może być weryfikowana bez migracji.
- **Uwaga na zakres:** żadne zadanie nie zmienia treści promptów ani logiki wywołań modelu —
  optymalizacje są świadomie poza zakresem (AC-22), decyzja właściciela po lekturze raportu.
