# Zadania: System komponentów, kontrakt widoku i profesjonalny silnik skórek

- **Plan:** ./plan.md (045-system-komponentow-i-skorki)
- **Status:** todo
- **Data:** 2026-08-04

> **Zasada listy zadań:** kolejność **od najłatwiejszego do najtrudniejszego** i **zgodna z
> zależnościami**. Każde zadanie jest małe, samodzielne i **weryfikowalne**. Odhaczamy `[ ]` → `[x]`
> w trakcie `/implement`. `[P]` = można zrównoleglić.

## Legenda
- `[ ]` do zrobienia · `[x]` zrobione · `[~]` w trakcie · `[!]` zablokowane (patrz notatka)
- `[P]` — niezależne od poprzedniego, można robić równolegle

---

## Faza 0 — Fundament silnika skórek (bez UI, bez zależności)

- [x] **T-1** — Rozszerz `src/lib/skins.ts` o nowe rodziny tokenów wg planu §5.5: `SkinControlKind`
      rośnie o `length|number|font|weight|tracking|shadow|background|duration|easing|keyword`
      (`String` + unia TS, C-12), nowe kontrolki w `CURATED_CONTROLS`/`ADVANCED_CONTROLS`, komplet
      domyślnych w `DEFAULT_DARK_TOKENS`, mapa stosów czcionek dla `--font-family-*`.
      **Gotowe, gdy:** `ALLOWED_TOKEN_KEYS` zawiera wszystkie tokeny z tabeli w planie §5.5, a
      `tsc` przechodzi.
- [x] **T-2** — Przepisz `sanitizeTokenValue` na **whitelisty per rodzaj** (plan §5.5): globalna
      lista znaków zawsze zabronionych (`;{}<>"'\`, `/*`, `url(`, `image(`, `expression`, `@`,
      `javascript:`), a dopiero potem reguła rodzaju; limit długości podnoszony **tylko** dla
      `background` (240) i `shadow` (160).
      **Gotowe, gdy:** żadna wartość spoza whitelisty nie przechodzi, a stare skórki (same kolory)
      walidują się bez zmian.
- [x] **T-3** — Testy jednostkowe `src/lib/__tests__/skins.test.ts`: `url(…)`, `;`, `<script`,
      `expression(`, `@import`, przekroczone limity, klucz spoza whitelisty, poprawne wartości każdego
      nowego rodzaju, skórka częściowa → `resolveTokens` uzupełnia domyślne.
      **Gotowe, gdy:** testy zielone i pokrywają **każdy** nowy rodzaj. **(AC-12, AC-13)**
- [x] **T-4** `[P]` — `src/app/globals.css`: wartości domyślne wszystkich nowych zmiennych + blok
      `@media (prefers-reduced-motion: reduce)`.
      **Gotowe, gdy:** aplikacja bez skórki wygląda identycznie jak przed zmianą, a symulacja
      ograniczonego ruchu zatrzymuje animacje. **(AC-10, AC-13)**

## Faza 1 — Warstwa serwera (skórki)

- [x] **T-5** — `exportSkin(id)` i `importSkin(json, name?)` w `src/actions/skins.ts`;
      `importSkin` **zawsze** tworzy skórkę użytkownika (`ownerId = session.user.id`,
      `isSystem = false`) i przepuszcza wejście przez `validateTokens()`; obie kończą
      `revalidatePath("/settings")` + `revalidatePath("/admin/skins")`.
      **Gotowe, gdy:** eksport→import odtwarza tokeny 1:1, a złośliwy JSON traci wyłącznie złe
      wartości. **(AC-11, AC-12)**
- [x] **T-6** — Wpisy dla obu akcji w `src/lib/ai/action-coverage.json` (ekspozycja `excluded`
      + powód, `access: "owner"`).
      **Gotowe, gdy:** `npm run check:actions` i `npm run check:ai-coverage` przechodzą.

## Faza 2 — Kontrakt widoku (fundament UI)

- [ ] **T-7** — `src/components/ui/view/ViewState.tsx` — jeden zestaw stanów brzegowych
      (`EmptyState`/`LoadingState`/`ErrorState`/`NoAccessState`) zbudowany na istniejącym
      `ui/home/EmptyState`, tokeny zamiast liczb (`var(--radius-lg)`, `var(--border-width)`).
      **Gotowe, gdy:** cztery stany renderują się spójnie i reagują na zmianę skórki. **(AC-4)**
- [ ] **T-8** — `src/components/ui/view/ViewChrome.tsx` — kontekst `ViewChromeProvider` /
      `useViewChrome()`; brak providera zwraca pusty chrom **bez błędu**.
      **Gotowe, gdy:** `ViewBar` poza `AppShell` (np. w playgroundzie) renderuje się poprawnie.
- [ ] **T-9** — `src/components/ui/view/ViewBar.tsx` — pasek: filtry modułu | akcje modułu | chrom
      z kontekstu. Na telefonie filtry przewijają się poziomo **we własnym kontenerze**
      (`overflow-x: auto`); strona nigdy nie przewija się w poziomie. Adresu **nie** czytamy przez
      `useSearchParams` (plan §5.3).
      **Gotowe, gdy:** przy 375 px brak poziomego przewijania strony. **(AC-19)**
- [ ] **T-10** — `src/components/ui/view/ModuleView.tsx` — rama widoku wg API z planu §5.1;
      wewnętrznie renderuje istniejący `PageHeader` (wygląd nagłówka **bez zmian**); prop `resource`
      przyjmowany i przekazywany do kontekstu, **nieaktywny** (plan §5.2). Plus
      `ChromeFrame.tsx` (inline SVG sterowany `--chrome-frame`) i `index.ts`.
      **Gotowe, gdy:** podmiana `PageHeader` → `ModuleView` w jednym module nie zmienia wyglądu.
      **(AC-1)**
- [ ] **T-11** — `src/components/shell/FreshnessIndicator.tsx` + publikacja czasu ostatniego
      odświeżenia z `DataFreshness.tsx` przez lekki kontekst. **Mechanika i interwał odpytywania bez
      zmian** — to Faza 4 przebudowy, nie ten przebieg.
      **Gotowe, gdy:** wskaźnik pokazuje „teraz"/„N min temu" i nie dokłada żadnego zapytania.
- [ ] **T-12** — Wpięcie `ViewChromeProvider` w `src/components/shell/AppShell.tsx` (wokół `<main>`):
      gwiazdka ulubionych (nowy wariant `placement="viewbar-inline"` w `FavoriteStarButton.tsx`),
      `FreshnessIndicator`, przycisk ściągawki skrótów. Przy okazji usuń dwa zaszyte `#ef4444`.
      **Gotowe, gdy:** moduł nie przekazuje chromu propsami, a mimo to widzi go w pasku. **(AC-2)**

## Faza 3 — Komponenty wspólne

- [x] **T-13** `[P]` — `src/components/ui/ConfirmDialog.tsx` — wspólne potwierdzenie na bazie
      istniejącego `Modal`; obsługa klawiatury (Esc / Enter), wariant destrukcyjny.
      **Gotowe, gdy:** zastępuje modal usuwania w co najmniej jednym module bez zmiany zachowania.
      **(AC-5)**
- [x] **T-14** `[P]` — `src/components/ui/Field.tsx` — pole formularza: etykieta, podpowiedź, błąd,
      wymagalność; cel dotyku ≥ 44 px.
- [x] **T-15** `[P]` — `src/components/ui/DataList.tsx` — lista z zaznaczaniem i skrótami `j/k`,
      **bez paginacji** (Faza 3 przebudowy); API projektowane tak, by paginację dało się dołożyć.
- [x] **T-16** `[P]` — `src/components/ui/BulkActionBar.tsx` — pasek akcji zbiorczych wyprowadzony ze
      wzorca z Zadań.
- [x] **T-17** — Eksporty w `src/components/ui/index.ts` + re-eksport zgodnościowy w
      `src/components/ui/home/index.ts`, żeby stare importy działały w trakcie migracji.
      **Gotowe, gdy:** `next lint` czysty, żaden istniejący import nie pęka. **(AC-6)**

## Faza 4 — Skórki flagowe

- [ ] **T-18** — `src/lib/skins/flagship.ts` — tokeny skórek **Mostek** (ciemna konsola sci-fi) i
      **Papier** (jasna, typograficzna) wg planu §5.6. Zero odwołań do cudzych znaków towarowych.
      **Gotowe, gdy:** obie skórki używają wyłącznie tokenów z whitelisty.
- [ ] **T-19** — Migracja `prisma/migrations/0224_skorki_flagowe/migration.sql` — dwa idempotentne
      `INSERT … ON CONFLICT ("id") DO NOTHING`, stałe id `skin-system-mostek` / `skin-system-papier`,
      `isSystem = true`, tokeny dollar-quoted (`$tokens$…$tokens$`).
      **Gotowe, gdy:** `npm run check:migrations` przechodzi, a `migrate deploy` na **lokalnym**
      Postgresie (C-13) dodaje obie skórki i jest bezpieczny przy powtórzeniu.
- [ ] **T-20** — Kontrola kontrastu **AA** obu skórek: pary tekst/tło, tekst-drugorzędny/tło,
      tekst-na-akcencie dla każdego akcentu. Wyniki (wyliczone współczynniki) zapisz — będą wejściem
      do `/verify`. Skórka stylizowana **nigdy** nie jest domyślna.
      **Gotowe, gdy:** każda para ≥ 4.5:1 (tekst zwykły) / ≥ 3:1 (duży tekst i elementy UI).
      **(AC-9)**

## Faza 5 — Edytor skórki

- [ ] **T-21** — `src/components/skins/SkinEditor.tsx` — sekcje rodzin tokenów (kolory, typografia,
      gęstość, zaokrąglenia, obramowania, cienie, tło, ruch, chrom), kontrolki dla nowych rodzajów,
      podgląd na żywo.
      **Gotowe, gdy:** zmiana tokenu z **każdej** rodziny jest natychmiast widoczna w podglądzie.
      **(AC-7)**
- [ ] **T-22** — `src/components/skins/SkinPreview.tsx` — podgląd pokazujący typografię, cienie,
      obramowania i ruch, nie tylko próbki kolorów.
- [ ] **T-23** — Import/eksport w UI edytora (pobranie pliku JSON + wczytanie), oparte na `exportSkin`
      /`importSkin` z T-5; komunikat, gdy część tokenów odrzucono przy imporcie.
      **Gotowe, gdy:** eksport→import na **drugim koncie** odtwarza skórkę identycznie. **(AC-11)**

## Faza 5b — Generowanie skórki przez AI (zakres dodany 2026-08-04, C-54)

- [ ] **T-21a** — `src/lib/jobs/handlers/skinGenerate.ts` — handler wzorowany na
      `kitchenGenerateRecipe`: `op: "generation"`, `json: true`, katalog tokenów w promptcie
      **generowany z `ALL_CONTROLS`** (nie przepisany ręcznie), twarde wymagania kontrastu i umiaru.
      Wynik przez `validateTokens()` — model jest źródłem równie obcym jak cudzy plik.
      Zużycie przepuszczone przez `usageFromChat`.
      **Gotowe, gdy:** `npm run check:cost-badge` przechodzi. **(AC-14, AC-15, AC-16)**
- [ ] **T-21b** — `src/app/api/llm/skins/generate/route.ts` — cienka trasa (sesja, `JobError` → status)
      + wpis `on-demand` w `src/lib/ai/content-memory-coverage.json` z powodem.
      **Gotowe, gdy:** `npm run check:content-memory` przechodzi.
- [ ] **T-21c** — UI w edytorze skórki: pole opisu, przycisk generowania, podgląd propozycji
      **przed** zapisem, wskaźnik kosztu, informacja o odrzuconych tokenach, możliwość poprawienia
      opisu i ponowienia oraz ręcznego dostrojenia wyniku.
      **Gotowe, gdy:** model niczego nie zapisuje ani nie włącza sam. **(AC-14, AC-17)**

## Faza 6 — Playground od zera

- [ ] **T-24** — `src/lib/ui/playground/registry.tsx` — rejestr wpisów
      (`id, name, category, summary, render, controls?, variants?`); kategorie jako `String` + unia:
      `prymitywy|formularze|dane-i-listy|powloka-i-nawigacja|stany-brzegowe|wzorce-widoku`.
      **Gotowe, gdy:** rejestr obejmuje **wszystkie** komponenty z `src/components/ui/` i
      `src/components/ui/view/`. **(AC-22)**
- [ ] **T-25** — `src/components/admin/playground/` — `PlaygroundPage`, `PlaygroundNav`,
      `PlaygroundEntry`, `PropControls`, `CodeBlock`. Nawigacja boczna `hidden md:flex`, na telefonie
      **szuflada** (nigdy dwa panele boczne, C-31), wyszukiwarka, wybór w adresie (`?c=<id>`).
      **Gotowe, gdy:** przy 375 px i 1440 px dowolny komponent osiągalny w ≤ 2 interakcjach.
      **(AC-18, AC-19)**
- [ ] **T-26** — Sterowanie właściwościami na żywo + warianty brzegowe (pusty, długi tekst, błąd) dla
      komponentów, które je mają.
      **Gotowe, gdy:** zmiana kontrolki natychmiast przerysowuje demonstrację. **(AC-20)**
- [ ] **T-27** — Lokalny przełącznik skórki w playgroundzie: kontener demonstracji z
      `style={tokensToStyle(resolveTokens(tokeny))}`; **nie zmienia** skórki konta.
      **Gotowe, gdy:** przełączenie na „Mostek" zmienia tylko obszar demonstracji. **(AC-21)**
- [ ] **T-28** — Montaż w `src/app/admin/playground/page.tsx` + **usunięcie**
      `src/components/admin/ComponentPlayground.tsx`.
      **Gotowe, gdy:** stary plik nie istnieje, a `next lint` nie zgłasza martwych importów.

## Faza 7 — Migracja modułów na kontrakt widoku (osobny commit na moduł)

> Kolejność: od najprostszych do najbardziej rozbudowanych. **Żaden commit nie zmienia zachowania.**
> Po każdym module: ręczne przejście widoku (wejście, dodanie, edycja, usunięcie).

- [ ] **T-29** — Kontakty · Kosz · Truck (3 moduły, 3 commity).
- [ ] **T-30** — Raporty · QA · Kalendarz (3 commity).
- [ ] **T-31** — Nawyki · Zdrowie (+ Leki) · Flota (3 commity).
- [ ] **T-32** — Notatki · Języki · Pogoda (3 commity).
- [ ] **T-33** — Kuchnia · Zwierzęta · Warsztaty (3 commity; Warsztaty **nie mają** `*Page.tsx` —
      wejściami są `WorkshopsList.tsx`/`WorkshopDetail.tsx`).
- [ ] **T-34** — Portfel (5 widoków) · Usługi (6 widoków) — 2 commity.
- [ ] **T-35** — Home (pulpit) · Zakupy · Zadania (3 commity).
- [ ] **T-36** — **Wiadomości i Magazynowanie — sprawdzian kontraktu.** To najbardziej nietypowe
      widoki w aplikacji. Jeśli `ModuleView` ich nie unosi — **wróć do `plan.md` i `spec.md`**
      (C-54), popraw kontrakt i przelicz zadania w dół; **nie** obchodź problemu w kodzie modułu.
      **Gotowe, gdy:** oba moduły korzystają z kontraktu bez wyjątków w manifeście.

## Faza 8 — Bramka i domknięcie

- [ ] **T-37** — `scripts/check-ui-contract.js` + manifest `src/lib/ui/view-contract.json` wg planu
      §7: (1) manifest kluczowany **modułem**, katalog trasy w `src/app/` bez klucza = błąd;
      (2) plik wejściowy widoku renderuje `ModuleView` z `state`; (3) skan literałów `#rrggbb`
      z kategoriami `paleta-danych|ilustracja|do-poprawy` + powód.
      **Gotowe, gdy:** bramka jest **czerwona** po tymczasowym usunięciu `state` z jednego pliku
      (test negatywny) i **zielona** na czystym drzewie. **(AC-3, AC-8)**
- [ ] **T-38** — Wpięcie w `package.json`: skrót `check:ui-contract` + krok w `build` (przed
      `next lint`). **Dopiero teraz** — po zakończonej migracji z Fazy 7.
      **Gotowe, gdy:** `npm run check:ui-contract` przechodzi na czystym drzewie.
- [ ] **T-39** — Sweep zaszytych kolorów motywu w modułach migrowanych w Fazie 7; to, co zostaje,
      dostaje jawną kategorię w manifeście (kolory-dane vs `do-poprawy`).
      **Gotowe, gdy:** żaden kolor **motywu** nie jest literałem; reszta jest oznaczona, nie
      przemilczana. **(AC-8)**
- [ ] **T-40** — Rozdział-dziennik: `worldofmag/content/architektura/15-dziennik.md` + wpis w
      `manifest.json` (rozdz. 15, część „Wykonanie"). Tabela statusów **wszystkich 46 zadań**, wpis
      przebiegu 045, jednoznaczne wskazanie następnego kroku (**Faza 0 — siatka bezpieczeństwa**) oraz
      odnotowanie luki w dokumencie źródłowym: rozdz. 10.4–10.5 (system komponentów, kontrakt widoku)
      **nie mają numeru w checkliście**, choć są opisanym długiem.
      **Gotowe, gdy:** `/admin/architektura-docelowa` pokazuje rozdział 15. **(AC-23, AC-24)**
- [ ] **T-41** — Pełny zestaw bramek na **lokalnym** Postgresie (C-13): `check:migrations`,
      `check:actions`, `check:ai-coverage`, `check:cost-badge`, `check:content-memory`,
      `check:ui-contract`, `next lint --dir src`, `prisma generate`, `next build`.
      **Gotowe, gdy:** wszystko zielone **do kroku `next build`** włącznie (ostatni krok `build`
      rusza prod DB — nie uruchamiamy go). **(C-50)**
- [ ] **T-42** — Wpisy do `doświadczenia.md` (po polsku, format `## YYYY-MM-DD — tytuł` /
      `**Problem:**` / `**Rozwiązanie:**` / `**Lekcja:**`) dla każdej nieoczywistej pułapki
      napotkanej po drodze. **(C-51)**

---

## Mapowanie kryteriów akceptacji → zadania

| AC | Zadania | AC | Zadania |
|----|---------|----|---------|
| AC-1 | T-10, T-29…T-36 | AC-11 | T-5, T-23 |
| AC-2 | T-11, T-12 | AC-12 | T-2, T-3, T-5 |
| AC-3 | T-10, T-37 | AC-13 | T-3, T-4 |
| AC-4 | T-7 | AC-14 | T-25 |
| AC-5 | T-13 | AC-15 | T-9, T-25 |
| AC-6 | T-17 | AC-16 | T-26 |
| AC-7 | T-1, T-21 | AC-17 | T-27 |
| AC-8 | T-12, T-37, T-39 | AC-18 | T-24 |
| AC-9 | T-20 | AC-19 | T-40 |
| AC-10 | T-4 | AC-20 | T-40 |

**Żaden AC nie został bez pokrycia.**

---

## Ścieżka krytyczna

```
T-1 → T-2 → T-3            (tokeny + sanityzacja; blokują cały silnik skórek)
        ↓
T-18 → T-19 → T-20         (skórki flagowe; T-20 blokuje werdykt o UX)
        ↓
T-21 → T-22 → T-23         (edytor)

T-7 → T-8 → T-9 → T-10 → T-12    (kontrakt widoku; T-10 blokuje CAŁĄ Fazę 7)
                    ↓
             T-29 … T-36   (migracja 21 modułów)
                    ↓
             T-37 → T-38 → T-39  (bramka — dopiero PO migracji)
                    ↓
                  T-41     (pełne bramki)
```

- **T-10 jest najważniejszym zadaniem listy** — bez `ModuleView` nie ruszy Faza 7 ani bramka.
- **T-38 nie wolno wykonać przed T-36** — bramka włączona w trakcie migracji byłaby czerwona przez
  cały czas i przestałaby cokolwiek znaczyć.
- **T-36 to punkt kontrolny C-54** — jeśli kontrakt nie unosi Wiadomości/Magazynowania, wracamy do
  `plan.md`/`spec.md`, zamiast obchodzić problem.
- T-4, T-13…T-16 są niezależne (`[P]`) i mogą iść równolegle do ścieżki głównej.

## Notatki / blokady
- Faza 0 przebudowy (siatka bezpieczeństwa: klikacze 21/21, test izolacji najemcy, bramka rozjazdu
  schematu) **nie jest** częścią tego przebiegu — jej brak podnosi ryzyko Fazy 7, dlatego każdy
  migrowany moduł przechodzi **ręczną** weryfikację po commicie.
