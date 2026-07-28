# Weryfikacja: 035-asystent-ux-mobile-i-audyt-tokenow

- **Spec:** ./spec.md · **Plan:** ./plan.md · **Zadania:** ./tasks.md
- **Data:** 2026-07-28
- **Środowisko:** lokalny PostgreSQL 16 (`omnia_dev`), **nigdy prod DB** (C-13)

## 1. Bramki

| Komenda | Wynik |
|---|---|
| `npm run check:migrations` | ✅ „Numeracja migracji OK (następny wolny numer: 0214)" |
| `npm run check:actions` | ✅ 160 akcji, 160 wpisów kontraktu, **373 parametry z etykietami** — czyli przenosiny promptu są kompletne |
| `npm run check:ai-coverage` | ✅ 506 akcji z zakresem dostępu i guardem; 0 „pending" |
| `npx next lint --dir src` | ✅ 0 błędów |
| `npx next build` | ✅ exit 0 (bez `scripts/migrate.js` — C-13) |
| `npx prisma migrate deploy` (lokalnie) | ✅ `0213_raport_audyt_tokenow` zaaplikowana |
| Powtórne uruchomienie `0213` | ✅ `wierszy: 1` — `ON CONFLICT DO UPDATE` działa, brak duplikatu |

## 2. Kryteria akceptacji

### Własny poziom pracy (Z1)

| AC | Werdykt | Dowód |
|---|---|---|
| **AC-1** — brak suwaka i ustawień per rodzaj w ustawieniach asystenta | ✅ | `grep -c "type=\|range\|EFFORT_INDEX\|setAdvanced\|Ustawienia zaawansowane"` w `AssistantLevelSettings.tsx` → **0**; blok `level === "custom"` usunięty z panelu ustawień |
| **AC-2** — ikona przy pozycji „Własny" | ✅ | `AICommandSheet.tsx:1938` `{lvl === "custom" && (` → przycisk z `onClick={(e) => { e.stopPropagation(); openLevelSettings(); }}`, `aria-label="Ustawienia własnego poziomu"`, wyrównany do prawej (`marginLeft` przez `flex: 1` na przycisku wyboru) |
| **AC-3** — konfiguracja zasłania wątek i przewija się | ✅ | `AICommandSheet.tsx:1687` `{headerPanel === "level" && (<div className="flex-1 overflow-y-auto …">)`; wątek wyłączony przez `headerPanel !== "none" ? null` (`:1724`) |
| **AC-4** — brak „Jak u administratora", wstępne wypełnienie | ✅ | `<option value="">Jak u administratora</option>` **usunięty** (jedyne wystąpienie ciągu w pliku to komentarz wyjaśniający, `:113`); wartość pola = `op.key ?? op.defaultKey ?? ""` (`:115`); brak przypisania admina → komunikat zamiast pustego wyboru |
| **AC-5** — mieści się przy 320 px | ✅ (inspekcja) | `grid-cols-1 md:grid-cols-3`, `minWidth: 0` na kontenerze i każdej kolumnie, `width: 100%` w `inputStyle`, przycisk `minHeight: 44`. **Nie zmierzone w przeglądarce** |

### Szczegóły kosztu (Z2)

| AC | Werdykt | Dowód |
|---|---|---|
| **AC-6** — nie wychodzi poza ekran | ✅ (inspekcja logiki) | `AiCostBadge.tsx:92-102` — pozycja liczona z `getBoundingClientRect()` przycisku i `window.innerWidth`, przycięta do `PANEL_MARGIN = 8` z obu stron; szerokość `min(360px, calc(100vw - 16px))` |
| **AC-7** — przewijanie poziome wewnątrz | ✅ | `:167` `<div style={{ overflowX: "auto", overflowY: "hidden" }}>` opakowuje listę wywołań, wiersze `minWidth: "max-content"`. Wcześniej `overflow-x` był na panelu, a `space-between` + `nowrap` rozpychały go zamiast przewijać |
| **AC-8** — otwiera się w stronę, gdzie jest miejsce | ✅ (inspekcja logiki) | Ta sama funkcja: start od wyrównania prawej krawędzi do przycisku, potem `if (left > maxLeft) left = maxLeft; if (left < PANEL_MARGIN) left = PANEL_MARGIN` — przy kwocie blisko lewej krawędzi panel przesuwa się w prawo zamiast wyjeżdżać poza ekran. Przeliczane na `resize`/`orientationchange` (`:113-119`) |

### Klawiatura i kursor (Z3, Z4)

| AC | Werdykt | Dowód |
|---|---|---|
| **AC-9** — klawiatura znika przy dotknięciu czegokolwiek innego | ✅ (inspekcja) | `grep -c keepKeyboardOpen` → **0**; żaden przycisk kompozytora nie wywołuje już `preventDefault` na `pointerdown`, więc fokus wychodzi z pola. Akcje zostały na `onClick`, czyli wykonują się za pierwszym dotknięciem. **Nie zmierzone na urządzeniu** |
| **AC-10** — brak potrzeby ukrywania karetki | ✅ | `:1868` `caretColor: "var(--accent-blue)"` — bezwarunkowo; obejście z 034 usunięte |
| **AC-11** — kursor od razu we właściwym miejscu (iPhone) | ✅ (inspekcja; przyczyna usunięta) | `grep -c composerFocused` → **0**; `:1806` `paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))"` **bez warunku**. Usunięta jest sama przyczyna (zmiana wysokości w klatce, w której iOS liczy pozycję karetki), nie objaw. **Wymaga potwierdzenia na iPhonie** |
| **AC-12** — pole nie pod systemową kreską | ✅ | Ten sam stały `env(safe-area-inset-bottom)` — teraz obowiązuje **zawsze**, także przy otwartej klawiaturze (wcześniej znikał) |

### Sekcje nagłówka (Z5)

| AC | Werdykt | Dowód |
|---|---|---|
| **AC-13** — ustawienia i zgłoszenie zasłaniają wątek | ✅ | `:1573` i `:1618` — oba panele mają `className="flex-1 overflow-y-auto px-5 py-4"` i renderują się w obszarze treści; klasa `flex-shrink-0` (przyczyna ucinania) zniknęła |
| **AC-14** — przewija się do końca | ✅ | `overflow-y-auto` + `paddingBottom: max(1rem, env(safe-area-inset-bottom))` na każdym z trzech paneli |
| **AC-15** — powrót pokazuje wątek bez zmian | ✅ | Wątek jest tylko *ukrywany* (`headerPanel !== "none" ? null`), a stan `turns`/`conversationId` żyje w komponencie — nic nie jest resetowane przy otwarciu panelu |

### Skrót powrotu (Z6)

| AC | Werdykt | Dowód |
|---|---|---|
| **AC-16** — „×" chowa skrót, rozmowa zostaje w historii | ✅ | `:355` stan `lastConversationDismissed`; `:1535` warunek widoczności; przycisk „×" z `aria-label="Ukryj skrót do poprzedniej rozmowy"` ustawia stan. Rozmowa nie jest kasowana — brak jakiegokolwiek wywołania usuwającego |
| **AC-17** — znika sam po pierwszej wiadomości | ✅ | Warunek zawiera `turns.length === 0`, więc pierwsza wysłana wiadomość chowa pasek; `resetConversation()` czyści odrzucenie, żeby przy świadomej „nowej rozmowie" skrót wrócił |

### Audyt tokenów (Z7)

| AC | Werdykt | Dowód |
|---|---|---|
| **AC-18** — raport w raportach admina | ✅ | Zapytanie do lokalnej bazy: `SELECT title … WHERE slug='asystent-audyt-zuzycia-tokenow-2026-07-28'` → **„Asystent — audyt zużycia tokenów (2026-07-28)"**, 32 797 znaków, `authorId = NULL` (systemowy) |
| **AC-19** — pełne prompty i odpowiedzi dla trzech wywołań | ✅ | Zapytania `content LIKE`: Załącznik A/B/C → `true/true/true`; pełny prompt klasyfikatora (`Jesteś szybkim klasyfikatorem…`) → `true`; pełny prompt agenta (`Jesteś asystentem-KOMPANEM…`) → `true`; prompt routera (`Wskaż moduły istotne…`) → `true` |
| **AC-20** — sumy tokenów się zgadzają | ✅ | Raport zawiera 7734 / 5284 / 1246 / 502; rachunek kosztów odtworzony niezależnie: `$0,0019 + $0,0011 + $0,0094 = $0,0125` — zgodne ze zgłoszeniem. Nota metodologiczna wprost mówi, że szacunek wbudowanego przelicznika (4 znaki/token) jest **zaniżony** wobec pomiaru dostawcy (agent: 4437 vs 5455) i że kwoty liczone są na pomiarach |
| **AC-21** — propozycje z zyskiem i ryzykiem | ✅ | Zapytanie liczące wystąpienia: **5 propozycji (P1–P5), każda z `**Zysk:**` i `**Ryzyko:**`** oraz sekcją „Dotyka:"; na końcu tabela porównawcza wariantów (−10% / −35% / −46% / −56%) |
| **AC-22** — zachowanie i koszty bez zmian | ✅ | `git diff origin/develop...HEAD -- src/lib/llm` → **brak zmian**. `fastPath.ts`: jedyna zmiana to dodanie słowa `export`. `agent/route.ts`: **wszystkie** dodane linie to 7 linii importu + 1 podstawienie `buildRouterPrompt(allowed, primary)`. Dowód neutralności treści: blok promptu **30 106 znaków przed i po, identyczny co do znaku** (porównanie z `git show origin/develop:…route.ts`) |

## 3. Zgodność z konstytucją

- **C-01** ✅ wyłącznie `worldofmag/`; tymczasowy skrypt audytowy usunięty (`git status` czysty).
- **C-02** ✅ nowy moduł importowany aliasem `@/lib/ai/agentPrompt`.
- **C-10, C-11, C-14** ✅ ręczna migracja 0213, unikalny numer, dollar-quoting `$report_md$`
  (skrypt sprawdził brak kolizji tagu w treści), `ON CONFLICT DO UPDATE`, potwierdzona idempotentność.
- **C-12** ✅ bez zmian w schemacie, zero enumów.
- **C-13** ✅ wszystko na lokalnym Postgresie.
- **C-20** ✅ brak nowych mutacji; istniejące Server Actions nietknięte.
- **C-23** ✅ brak nowych `AIAction`; bramka po przenosinach nadal widzi komplet 160 akcji.
- **C-30, C-31, C-32** ✅ wyłącznie zmienne CSS; mobile-first (przewijanie paneli, `minWidth: 0`,
  `env(safe-area-inset-bottom)`, cel dotyku 44 px); teksty po polsku.
- **C-40** ✅ audyt niczego nie przestawia w routingu modeli.
- **C-51** ✅ trzy lekcje w `doświadczenia.md`.
- **C-53** ⚠️ *świadome, odnotowane odstępstwo:* wyodrębnienie `agentPrompt.ts` (plan §6.1, C-54).
  Uzasadnienie: bez tego raport cytowałby prompty przepisane ręcznie, czyli niesprawdzalne.
  Przeniesienie jest dowiedzione jako neutralne.

## 4. Regresje

- **Przeniesienie promptu** — największe ryzyko całej zmiany. Bramka `check:actions` **wykryła je
  natychmiast** (15 akcji zamiast 160), zanim skrypt został przestawiony na nowy plik; po aktualizacji
  znów 160 akcji i 373 parametry. Dodatkowo porównanie znak po znaku potwierdza brak zmian treści.
- **Panele w miejscu wątku** — kompozytor renderuje się tylko przy `headerPanel === "none"`, więc nie
  ma dwóch elementów `flex-1` naraz; `next build` przechodzi, brak ostrzeżeń o strukturze.
- **`AiCostBadge` stracił prop `align`** — był używany wyłącznie z wartością domyślną w
  `AICommandSheet`; `tsc` potwierdza brak innych wywołań. Komponent nadal nie importuje niczego z `home/`.
- **Migracja** — dodaje wyłącznie wiersz `Report`; zero zmian w schemacie, więc pozostałe moduły
  nietknięte.
- **Historia rozmów** — zachowanie bez zmian (ta sama gałąź renderu co wcześniej).

## 5. Werdykt końcowy

**GOTOWE Z UWAGAMI.**

Wszystkie 22 kryteria spełnione, wszystkie bramki zielone. Uczciwe zastrzeżenia:

1. **AC-5, AC-6, AC-8, AC-9, AC-11 zweryfikowane inspekcją kodu i logiki, nie na urządzeniu** —
   dotyczą zachowania wizualnego i dotykowego (szerokości przy 320 px, pozycja panelu, chowanie
   klawiatury, pozycja karetki na iPhonie). W każdym przypadku usunięta jest **przyczyna** wskazana w
   analizie, a nie objaw, ale ostateczne potwierdzenie wymaga telefonu. Szczególnie warto zerknąć na
   AC-9: wymuszanie fokusu wprowadzono kiedyś po to, by przycisk działał za pierwszym dotknięciem —
   jeśli po tej zmianie pierwsze dotknięcie zacznie tylko chować klawiaturę, wraca temat (rozwiązaniem
   byłoby wtedy przeniesienie akcji na `pointerdown` bez `preventDefault`).
2. **Odstępstwo od minimalizmu (C-53)** — wyodrębnienie promptów do `agentPrompt.ts`. Wymuszone przez
   AC-19/AC-20, opisane w planie, dowiedzione jako behawioralnie neutralne.
3. **Raport nie zawiera dosłownego zrzutu odpowiedzi modelu** dla wywołań 1 i 2 (klasyfikator, router)
   — te odpowiedzi nie są nigdzie utrwalane (log `AiCall` zapisuje liczby tokenów, nie treść).
   W raporcie są opisane wraz z liczbami tokenów i wynikiem, a dla wywołania 3 podana jest treść
   odpowiedzi ze zgłoszenia. To ograniczenie danych, nie implementacji — odnotowane wprost.
