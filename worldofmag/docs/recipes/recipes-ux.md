# Kuchnia — Dokument UX

**Wersja:** 1.0
**Data:** 2026-05-20
**Status:** Do zatwierdzenia przed implementacją
**Filozofia:** Mobile-first, keyboard-friendly desktop, „no waste" (zero zbędnych kliknięć)

---

## 1. Persona i konteksty użycia

### Persona główna: Szymon (developer power user)

- Wiek 35+, ma rodzinę, gotuje 3-4× w tygodniu.
- Lubi gotować, ale nie chce „walczyć" z appem.
- Używa iPhone'a w kuchni (zalany blat, mokre ręce) — wymaga **dużych touch targetów** i **trybu „nie wyłączaj ekranu"**.
- W tygodniu planuje posiłki — zazwyczaj wieczorem na laptopie (desktop).
- Wynagrodzenie: shortcut typu `Ctrl+K` → wpisz „spaghetti carbonara" → enter → przepis.
- Ma alergię/nielubi czegoś — chce w 1 sekundę odfiltrować.

### Konteksty użycia

| Kontekst | Urządzenie | Cel | Główny KPI |
|----------|-----------|-----|------------|
| Planowanie tygodnia (sobota wieczór) | Desktop / iPad | Stworzyć plan 7 dni, wygenerować listę zakupów | „Czas od decyzji do listy zakupów" — target < 5 min |
| Zakupy (niedziela rano) | iPhone | Przejść z gotowej listy | Już istniejące Shopping |
| Gotowanie (codziennie) | iPhone na statywie / iPad | Krok po kroku, timery, ręce zajęte | „Kroków bez konieczności dotknięcia ekranu" |
| Spontaniczny posiłek (wieczór, „co zrobić z kurczaka + brokuł") | iPhone | Szybko znaleźć przepis | Time-to-recipe < 30 sek |
| Tworzenie własnego przepisu (po fakcie, ad-hoc) | iPhone (zdjęcie efektu) / Desktop (porządne wpisanie) | Zapisać przepis na zawsze | Niska bariera dodania |
| Importowanie przepisu (z internetu) | Desktop | Wkleić URL → mam | Czas < 10 sek |

---

## 2. Filozofia projektowa

### 2.1 Zasady ogólne (rozszerzenie CLAUDE.md)

1. **Keyboard-first na desktopie, gesture-first na mobile.**
2. **Cookies < 5 kliknięć** — od listy do listy zakupów dla przepisu max 4 kliknięcia.
3. **Brak animacji ozdobnych.** Tylko micro-feedback (200ms fade na toastach, instant hover).
4. **Zero-state inteligentny** — pusty stan zawsze pokazuje *jak zacząć* + przykład.
5. **Edycja in-place** wszędzie gdzie ma to sens (tytuł przepisu, składnik, krok).
6. **Optimistic UI** — zmiany są widoczne natychmiast, server sync w tle, rollback przy błędzie.
7. **Cook Mode = święte miejsce** — żadnych powiadomień, żadnych pop-up, żadnych analytics, żadnych modali. Tylko gotowanie.

### 2.2 Mobile-first ≠ tylko-mobile

- Cały moduł projektujemy najpierw na 375px (iPhone SE width).
- Następnie skalujemy do 768px (iPad), 1024px+ (desktop).
- Desktop dostaje: side panele, multi-column layouty, większe gridy.
- **Nie chowamy funkcji na desktopie** — zachowujemy parity.

### 2.3 Mobile-specific zasady

- Touch targets ≥ 44×44px (Apple HIG).
- Bottom sheet zamiast modali (Radix Dialog z `position: bottom`).
- Brak hoverów — wszystko działa po tap.
- W Cook Mode: tap w lewą połowę = poprzedni krok, w prawą = następny.
- Long-press na karcie przepisu = quick menu (edycja, duplikuj, usuń).

---

## 3. Mapa ekranów

### 3.1 Hierarchia

```
/kitchen
├── /recipes                    [GŁÓWNY EKRAN]
│   ├── /recipes/new            [Tworzenie]
│   ├── /recipes/import         [Wybór metody importu]
│   └── /recipes/[id]           [Widok przepisu]
│       ├── /recipes/[id]/edit  [Edycja]
│       └── /recipes/[id]/cook  [Tryb gotowania — fullscreen]
├── /plan                       [Plan tygodnia]
│   └── /plan/month             [Widok miesiąca]
├── /pantry                     [Spiżarnia]
│   └── /pantry/stocktake       [Inwentaryzacja]
└── /cookbooks                  [Książki kucharskie]
    └── /cookbooks/[id]         [Pojedyncza książka]
```

### 3.2 Nawigacja wewnątrz modułu

**Desktop:** górny tabbar pod nagłówkiem strony.

```
┌─────────────────────────────────────────────────────┐
│  Kuchnia                              [+ Nowy ▾]    │
├─────────────────────────────────────────────────────┤
│  [📖 Przepisy] [📅 Plan] [🥫 Spiżarnia] [📚 Książki]│
└─────────────────────────────────────────────────────┘
```

**Mobile:** dolny tabbar (4 ikony) — analogicznie do tab-baru iOS.

```
                  CONTENT
┌─────────────────────────────────────────────────────┐
│  📖       📅       🥫       📚                       │
│ Przepisy Plan  Spiżarnia Książki                    │
└─────────────────────────────────────────────────────┘
```

(Na mobile dolny tabbar pojawia się tylko w `/kitchen/*` — nie zastępuje globalnego selectora nawigacji modułów.)

---

## 4. Ekran: Lista przepisów (`/kitchen/recipes`)

### 4.1 Desktop (≥1024px)

```
┌───────────────────────────────────────────────────────────────────────┐
│  Kuchnia                                          [+ Nowy przepis ▾]  │
│  ──────────────────────────────────────────────────────────────────   │
│  [📖 Przepisy] [📅 Plan] [🥫 Spiżarnia] [📚 Książki]                  │
│  ──────────────────────────────────────────────────────────────────   │
│                                                                       │
│  🔍 Szukaj przepisów...                          ⌘K                   │
│                                                                       │
│  Filtry:                                                              │
│  [Kuchnia ▾] [Posiłek ▾] [Tagi ▾] [Czas ≤ ?] [📚 Książka ▾]          │
│  Aktywne: ╳ włoska   ╳ obiad   ╳ ≤30min                              │
│                                                                       │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  │
│  │  [zdjęcie]  │  │  [zdjęcie]  │  │  [zdjęcie]  │  │  [zdjęcie]  │  │
│  │             │  │             │  │             │  │             │  │
│  │ Carbonara   │  │ Pesto       │  │ Risotto     │  │ Ravioli     │  │
│  │ 25 min · 4p │  │ 15 min · 4p │  │ 45 min · 2p │  │ 60 min · 4p │  │
│  │ włoska      │  │ włoska·wege │  │ włoska      │  │ włoska      │  │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘  │
│                                                                       │
│  (load more on scroll)                                                │
└───────────────────────────────────────────────────────────────────────┘
```

### 4.2 Mobile (375px)

```
┌──────────────────────────────┐
│  Kuchnia            [+ ▾]    │
├──────────────────────────────┤
│  🔍 Szukaj...                │
├──────────────────────────────┤
│  [Wszystkie] [Ulubione] [⏲]   │  ← chipy filtrów (scroll-x)
├──────────────────────────────┤
│  ┌────────────────────────┐  │
│  │ [zdjęcie 16:9]         │  │
│  │                        │  │
│  │ Spaghetti Carbonara    │  │
│  │ 25 min · 4 porcje      │  │
│  │ ★ 4.5 · ostatnio: 3d   │  │
│  │ włoska · obiad         │  │
│  └────────────────────────┘  │
│                              │
│  ┌────────────────────────┐  │
│  │ [zdjęcie 16:9]         │  │
│  ...                          │
├──────────────────────────────┤
│  📖   📅   🥫   📚            │  ← bottom tabbar
└──────────────────────────────┘
```

### 4.3 Komponenty

| Komponent | Opis |
|-----------|------|
| `RecipeFilters` | Dropdown menu z multi-select dla kuchni / posiłku / tagów / czasu / książki. Wybrane wartości jako chipy poniżej. |
| `RecipeCard` | Karta z cover image (16:9, lazy), tytuł, czas, porcje, rating, tagi (max 3, reszta jako „+2"). |
| `SearchBar` | Live search z debounce 300ms. Skrót `/` lub `Ctrl+K`. |
| `NewRecipeMenu` | Dropdown z opcjami: „Pusty", „Z URL", „Ze zdjęcia", „Z AI" |

### 4.4 Klawiatura (desktop)

- `/` — focus search
- `j`/`k` — nawigacja po kartach
- `Enter` — otwórz przepis
- `n` — nowy przepis (puste menu)
- `Ctrl+K` — command palette (globalny — rozszerzony o „Kuchnia: nowy przepis")
- `f` — toggle filtry

### 4.5 Empty state

```
┌─────────────────────────────────────┐
│         🍳                          │
│   Brak przepisów                    │
│                                     │
│   Zacznij od:                       │
│   [+ Pusty przepis]                 │
│   [📥 Importuj z URL]               │
│   [📸 Ze zdjęcia]                   │
│   [✨ Wygeneruj z AI]               │
│                                     │
│   …albo skopiuj jeden z bazy:       │
│   ┌─────────────┐ ┌─────────────┐   │
│   │ Carbonara   │ │ Naleśniki   │   │
│   └─────────────┘ └─────────────┘   │
└─────────────────────────────────────┘
```

---

## 5. Ekran: Widok przepisu (`/kitchen/recipes/[id]`)

### 5.1 Desktop (≥1024px)

Dwukolumnowy layout: lewa kolumna składniki, prawa kroki.

```
┌───────────────────────────────────────────────────────────────────────┐
│  ← Przepisy                                                           │
│                                                                       │
│  Spaghetti Carbonara                          [✏️ Edytuj] [⋯]         │
│  ★★★★☆  ·  Włoska · Obiad · 25 min  ·  4 porcje                       │
│  Ostatnio: 3 dni temu (5×)                                            │
│  Tagi: szybkie, makaron, klasyk                                       │
│                                                                       │
│  ┌─────────────────────────────────────┐                              │
│  │ [Cover image 16:9, full width]      │                              │
│  └─────────────────────────────────────┘                              │
│                                                                       │
│  Porcje: [- 4 +]  [👨‍🍳 Cook Mode]  [🛒 Do listy]  [📅 Do planu]      │
│                                                                       │
│  ┌─────────────────────┐  ┌─────────────────────────────────────────┐ │
│  │ Składniki            │  │ Przygotowanie                          │ │
│  │ ───────────────────  │  │ ─────────────────────────────────────   │ │
│  │ Główne               │  │ 1. Ugotuj makaron al dente w osolonej  │ │
│  │ ☐ 400g spaghetti    │  │    wodzie (8-10 min)                    │ │
│  │   ⓘ masz: 250g      │  │    [📷] [⏲ 10:00]                       │ │
│  │ ☐ 200g boczku       │  │                                          │ │
│  │ ☐ 4 żółtka          │  │ 2. Pokrój boczek w drobną kostkę.        │ │
│  │ ☐ 100g parmezanu    │  │    Podsmaż na suchej patelni do złotego  │ │
│  │ ☐ czarny pieprz     │  │    koloru.                               │ │
│  │                      │  │                                          │ │
│  │ Opcjonalne           │  │ 3. ...                                   │ │
│  │ ☐ pietruszka         │  │                                          │ │
│  └─────────────────────┘  └─────────────────────────────────────────┘ │
│                                                                       │
│  Notatki kucharza                                                     │
│  Najlepiej z guanciale zamiast boczku. Pieprz świeżo mielony.         │
│                                                                       │
│  Komentarze (3)  ★★★★☆ (12 ocen)                                      │
└───────────────────────────────────────────────────────────────────────┘
```

### 5.2 Mobile

```
┌──────────────────────────────┐
│  ← Przepisy            [⋯]   │
├──────────────────────────────┤
│  [Cover 16:9]                │
├──────────────────────────────┤
│  Spaghetti Carbonara         │
│  ★★★★☆ · 25 min · 4 porcje   │
│  Włoska · Obiad              │
├──────────────────────────────┤
│  Porcje: [- 4 +]             │
│                              │
│  [👨‍🍳 Cook Mode]              │
│  [🛒 Dodaj do listy zakupów] │
│  [📅 Wstaw do planu]         │
├──────────────────────────────┤
│  SKŁADNIKI                   │
│  ─────────                   │
│  Główne                      │
│  ☐ 400g spaghetti           │
│    ⓘ masz: 250g             │
│  ☐ 200g boczku              │
│  ...                         │
│                              │
│  PRZYGOTOWANIE               │
│  ─────────────               │
│  1. Ugotuj makaron al dente  │
│     w osolonej wodzie...     │
│     [⏲ 10:00]                │
│                              │
│  2. ...                      │
└──────────────────────────────┘
```

### 5.3 Funkcje na ekranie widoku

- **Skala porcji** (`-` / `+`) — natychmiast przelicza ilości składników (z odpowiednim zaokrąglaniem: „1 jajko" → „1.5 jajka" → komunikat „użyj 2 jajek" + opcjonalnie AI fallback dla nieoczywistych).
- **Checkboxy przy składnikach** — to LOKALNY state (zaznaczasz „mam to, idę dalej"), nie zmienia DB. Reset przy reload.
- **Tooltip „masz: X"** — pokazuje stan ze spiżarni przy każdym składniku (gdy `productId` matcha).
- **Cook Mode** — duży CTA, pełnoekranowy widok krok po kroku.
- **Do listy zakupów** — otwiera `ShopForRecipeDialog`.
- **Do planu** — otwiera kalendarz, klikasz datę+slot, dodaje wpis.

### 5.4 Klawiatura

- `e` — edycja
- `c` — cook mode
- `s` — do listy zakupów (shop)
- `p` — do planu
- `+` / `-` — skala porcji
- `Esc` — powrót do listy

---

## 6. Ekran: Edycja przepisu (`/kitchen/recipes/[id]/edit`)

### 6.1 Layout (desktop)

```
┌───────────────────────────────────────────────────────────────────────┐
│  ← Anuluj                                            [Zapisz Ctrl+S]  │
├───────────────────────────────────────────────────────────────────────┤
│  Tytuł:                                                               │
│  [Spaghetti Carbonara                                              ]  │
│                                                                       │
│  Krótki opis (1-2 zdania):                                            │
│  [Klasyczny włoski makaron z boczkiem i sosem jajecznym.           ]  │
│                                                                       │
│  Cover image:                                                         │
│  [📷 Wgraj] lub URL: [____________]                                   │
│                                                                       │
│  Czas: [Prep 5  ] min  [Cook 20  ] min   Porcje: [4  ]                │
│  Trudność: ( ) Łatwe  (•) Średnie  ( ) Trudne                         │
│  Kuchnia: [Włoska ▾]   Posiłek: [Obiad ▾]                             │
│  Książka: [Brak ▾]                                                    │
│  Tagi: [+ szybkie] [+ makaron] [+ klasyk] [+]                         │
│                                                                       │
│  ─── Składniki ──────────────────────────────────────────────────     │
│  Grupa: [Główne]                                                      │
│  ⠿ [ilość] [jedn] [nazwa składnika                  ] [notatka] [✕]   │
│  ⠿ 400      g      spaghetti                          al dente   ✕   │
│  ⠿ 200      g      boczek                                        ✕   │
│  ⠿ 4        szt    żółtka                                        ✕   │
│  [+ Dodaj składnik]   [+ Nowa grupa]                                  │
│                                                                       │
│  ✨ [Wklej tekst → parsuj składniki AI]                                │
│  ┌────────────────────────────────────────────────────────┐           │
│  │ 400g spaghetti                                          │           │
│  │ 200g boczku                                              │           │
│  │ 4 żółtka                                                 │           │
│  │ 100g parmezanu                                           │           │
│  └────────────────────────────────────────────────────────┘           │
│  [Parsuj]                                                              │
│                                                                       │
│  ─── Przygotowanie ──────────────────────────────────────────────     │
│  Krok 1:                                                              │
│  ⠿ [Ugotuj makaron al dente w osolonej wodzie (8-10 min).        ✕]  │
│    Timer: [10] min   Temperatura: [____]   [📷 Zdjęcie]               │
│                                                                       │
│  Krok 2: ...                                                          │
│  [+ Dodaj krok]                                                        │
│                                                                       │
│  ─── Notatki kucharza (markdown) ─────────────────────────────────    │
│  [Tekstarea wielowierszowa...                                      ]  │
│                                                                       │
│  ─── Widoczność ───────────────────────────────────────────────       │
│  ( ) Tylko ja  (•) Mój team: [Rodzina ▾]  ( ) Publiczny               │
│                                                                       │
│  [Anuluj]                          [Usuń przepis]  [Zapisz Ctrl+S]    │
└───────────────────────────────────────────────────────────────────────┘
```

### 6.2 Krytyczne mechaniki edytora

#### 6.2.1 Inteligentny input składnika

Pole „nazwa składnika" działa jak `<input>` z autocomplete:
- Po wpisaniu 2+ znaków → fetch sugestii z `Product[]` (top 10 by `useCount`).
- Wybór sugestii → ustawia `productId`, podpowiada `defaultUnit`.
- Brak dopasowania → input swobodny, `productId` = null, tworzymy Product przy zapisie (opt-in).

#### 6.2.2 Smart parsing pojedynczego inputu

Skopiowane z istniejącego `parseQuantity.ts`:
- Wpisanie „400g spaghetti" w pole tekstowe → automatycznie wypełnia `qty=400`, `unit=g`, `name=spaghetti`.
- Ten sam parser co Shopping.

#### 6.2.3 Parser AI (wklej cały blok)

Textarea „Wklej tekst → parsuj składniki AI":
- Wpisujesz kilka linii surowego tekstu (np. z przepisu skopiowanego z neta).
- Klik „Parsuj" → call Server Action `suggestIngredientsFromText()` → zwraca strukturę.
- UI pokazuje propozycje obok obecnych składników z checkboxami „dodaj".
- Każdy z możliwością ręcznej edycji przed wpisem do listy składników.

#### 6.2.4 Drag-and-drop

`@dnd-kit/sortable` na:
- Reordering składników w grupie (i między grupami).
- Reordering kroków.

Vertical handle z lewej strony (`⠿`), zarówno desktop jak mobile (long-press → drag na mobile).

#### 6.2.5 Auto-save

- Po 3 sekundach bezczynności → save draft (Server Action `updateRecipe` z `isDraft=true`).
- Toast „Zapisano draft" subtelny w prawym dolnym rogu (3s timeout).
- Pełen zapis przy kliknięciu „Zapisz" lub `Ctrl+S`.
- Confirm dialog przy próbie wyjścia z niezapisanymi zmianami.

### 6.3 Klawiatura

- `Ctrl+S` — zapisz
- `Tab` — między polami
- W liście składników: `Enter` w polu „nazwa" → dodaj kolejny składnik (focus na nowym)
- W liście kroków: `Ctrl+Enter` → dodaj kolejny krok
- `Esc` — anuluj (z confirm jeśli niezapisane)

---

## 7. Ekran: Cook Mode (`/kitchen/recipes/[id]/cook`)

### 7.1 Filozofia

> „Stałem nad gazem z brudnymi rękami. Aplikacja MUSI działać tak, żebym przeszedł cały przepis, dotykając ekranu może 5 razy."

### 7.2 Layout

**Fullscreen.** Bez sidebara, bez nagłówka, bez nawigacji.

```
┌───────────────────────────────────────────────────────────────────────┐
│  ← Wyjdź                       Spaghetti Carbonara          Krok 2/8  │
├───────────────────────────────────────────────────────────────────────┤
│                                                                       │
│                                                                       │
│              Pokrój boczek w drobną kostkę.                           │
│              Podsmaż na suchej patelni                                │
│              do złotego koloru.                                       │
│                                                                       │
│                                                                       │
│                                                                       │
│              [📷 zdjęcie kroku, jeśli jest]                           │
│                                                                       │
│                                                                       │
│              ⏲  05:00                                                 │
│              [▶ Start timer]                                          │
│                                                                       │
│                                                                       │
├───────────────────────────────────────────────────────────────────────┤
│  ← Poprzedni              ●●○○○○○○                Następny →          │
└───────────────────────────────────────────────────────────────────────┘
```

### 7.3 Funkcje Cook Mode

- **Brak wygaszania ekranu** — wakelock API (`navigator.wakeLock.request('screen')`).
- **Wielki tekst** — `font-size: 28px` na mobile, 32px desktop.
- **Tap-zones:** lewa połowa = poprzedni krok, prawa = następny. (Wyłącznik w settings.)
- **Wbudowany timer per krok** — przycisk startuje, sygnał dźwiękowy + wibracja po końcu.
- **Wiele timerów równolegle** — pływające „pills" na dole z odliczaniem (np. „makaron 04:23" + „sos 02:11").
- **Składniki przypomniane** — przycisk „pokaż składniki" otwiera bottom sheet (mobile) / sidebar (desktop) z listą.
- **Voice control (v1.1)** — komendy: „dalej", „wstecz", „start timer 5 minut", „pokaż składniki".
- **Wyjście** — przycisk „Wyjdź" + dialog „Ugotowałem!" (mark cooked → `cookCount++`, `lastCookedAt`, sugestia do spiżarni i planu).

### 7.4 Mark cooked dialog

```
┌─────────────────────────────────┐
│  Ugotowałeś Spaghetti Carbonara │
│                                 │
│  Ile porcji wyszło?             │
│  [- 4 +]                        │
│                                 │
│  ☑ Zaktualizuj spiżarnię        │
│     (odjmij zużyte składniki)   │
│                                 │
│  ☐ Daj ocenę                   │
│     ☆☆☆☆☆                       │
│                                 │
│  [Anuluj]    [Zapisz]           │
└─────────────────────────────────┘
```

---

## 8. Ekran: Plan posiłków (`/kitchen/plan`)

### 8.1 Desktop — widok tygodnia

```
┌────────────────────────────────────────────────────────────────────────────────────┐
│  Plan posiłków                              < 18-24 maja 2026 >    [📅 Miesiąc]    │
│  ──────────────────────────────────────────────────────────────────────────────    │
│                                                          [📥 Wygeneruj listę]      │
│                                                          [✨ AI: zaproponuj plan]  │
│  ──────────────────────────────────────────────────────────────────────────────    │
│              Pon 18      Wt 19      Śr 20      Czw 21    Pt 22     Sob 23   Nd 24  │
│  Śniadanie  Owsianka    Owsianka   Jajecznica  Owsianka  Naleśn.   —        —      │
│             [2p]        [2p]       [4p]        [2p]      [4p]                       │
│                                                                                     │
│  Obiad      Carbonara   Risotto    + Dodaj    Curry      —        Zupa pomid. Pizza│
│             [4p]        [2p]                  [4p]                [4p]       [4p]   │
│                                                                                     │
│  Kolacja    Kanapki     Sałatka    Kanapki    Soup       Tortilla  —        —      │
│             [2p]        [2p]       [2p]       [2p]       [2p]                       │
│                                                                                     │
│  Przekąska  —           —          —          —          Babka     —        —      │
│  ──────────────────────────────────────────────────────────────────────────────    │
│  → Drag&drop z bocznego panelu (toggle z prawej)                                    │
└────────────────────────────────────────────────────────────────────────────────────┘
```

#### Boczny drawer (toggleable z prawej)

```
┌───────────────────────┐
│  📖 Twoje przepisy    │
│  🔍 Szukaj            │
│  ───────────────────  │
│  [Carbonara]   drag   │
│  [Risotto]     drag   │
│  [Curry]       drag   │
│  [Pesto]       drag   │
│  ...                  │
│  ───────────────────  │
│  ✨ AI sugestie       │
│  „Na podstawie spiżarni:│
│   - Sałatka grecka     │
│   - Pomidorowa zupa    │
│   - Curry z kurczaka"   │
└───────────────────────┘
```

### 8.2 Mobile — dzień jako karta (scroll)

Tygodniowy grid jest nieczytelny na małym ekranie. Mobile pokazuje **listę dni**, każdy dzień jako karta ze slotami.

```
┌──────────────────────────────┐
│  Plan posiłków               │
│  < 18-24 maja 2026 >         │
├──────────────────────────────┤
│  Pon 18 maja                 │
│  ┌────────────────────────┐  │
│  │ ☕ Śniadanie · 2p     │  │
│  │ Owsianka z owocami    │  │
│  └────────────────────────┘  │
│  ┌────────────────────────┐  │
│  │ 🍽 Obiad · 4p          │  │
│  │ Spaghetti Carbonara   │  │
│  └────────────────────────┘  │
│  ┌────────────────────────┐  │
│  │ 🌙 Kolacja · 2p        │  │
│  │ Kanapki                │  │
│  └────────────────────────┘  │
│  ┌────────────────────────┐  │
│  │ + Dodaj posiłek        │  │
│  └────────────────────────┘  │
│                              │
│  Wt 19 maja                  │
│  ...                          │
└──────────────────────────────┘
```

Tap na slot → bottom sheet z wyborem przepisu lub wpisaniem własnego tytułu.

### 8.3 Generowanie listy zakupów z planu

Klik „📥 Wygeneruj listę" → dialog:

```
┌──────────────────────────────────┐
│  Wygeneruj listę zakupów         │
│                                  │
│  Zakres:                         │
│  ( ) Tylko ten tydzień           │
│  (•) Najbliższe 3 dni            │
│  ( ) Wybierz daty: [____] - [__] │
│                                  │
│  Lista docelowa:                 │
│  [Tygodniowe zakupy ▾]           │
│                                  │
│  ☑ Pomiń to co jest w spiżarni  │
│  ☑ Konsoliduj duplikaty          │
│  ☐ Pomiń składniki opcjonalne   │
│                                  │
│  Podgląd:                        │
│  • cebula 3 szt (3 przepisy)     │
│  • mleko 1l                      │
│  • masło 200g                    │
│  • ... (37 pozycji)              │
│                                  │
│  Pominięte ze spiżarni: 8 poz.   │
│                                  │
│  [Anuluj]      [Dodaj do listy]  │
└──────────────────────────────────┘
```

### 8.4 AI: zaproponuj plan tygodnia

Klik „✨ AI: zaproponuj plan" → wizard:

```
Krok 1: Preferencje (memorized z poprzednich)
- Liczba osób: [2  ]
- Posiłki dziennie: ☑ Śniadanie ☑ Obiad ☑ Kolacja ☐ Przekąska
- Unikaj: [boczek] [ryba]
- Kuchnia preferowana: [polska] [włoska] [azjatycka]
- Max czas/posiłek: [45 min ▾]
- ☑ Priorytet: użyj produktów ze spiżarni
- ☑ Nie powtarzaj przepisów w tygodniu
- ☐ Trzymaj się ulubionych książek: [□ Mama] [□ Włoska]

Krok 2: Generacja (loader)
„AI tworzy plan na podstawie Twoich przepisów..."

Krok 3: Podgląd planu (jak w 8.1, ale z markerami „AI")
- Każdy slot z subtelnym ✨ ikoną
- Klik na slot → swap (3 alternatywy AI)
- „Zaakceptuj wszystko" / „Edytuj ręcznie" / „Wygeneruj ponownie"
```

---

## 9. Ekran: Spiżarnia (`/kitchen/pantry`)

### 9.1 Desktop

```
┌───────────────────────────────────────────────────────────────────────┐
│  Spiżarnia                                  [📋 Inwentaryzacja] [+]   │
│  ──────────────────────────────────────────────────────────────────   │
│  Lokalizacja: [Wszystkie ▾]   Status: [Wszystko ▾]                    │
│  🔍 Szukaj produktu...                                                │
│                                                                       │
│  ⚠️ Kończy się termin (3)                                              │
│  ┌─────────────────────────────────────────────────────────────┐     │
│  │ Mleko 1l  ·  Lodówka   ·  za 2 dni  ·  🛒 [Dokup]          │     │
│  │ Jogurt    ·  Lodówka   ·  jutro     ·  🛒 [Dokup]  ⚙ [-1]  │     │
│  │ Boczek    ·  Lodówka   ·  za 3 dni  ·  🛒 [Dokup]          │     │
│  └─────────────────────────────────────────────────────────────┘     │
│                                                                       │
│  🥫 Spiżarnia                                                          │
│  ─────────────────                                                    │
│  Mąka pszenna       2 kg     spiżarnia   ⚙ [-]   🛒[Auto-replenish]   │
│  Cukier             1.5 kg   spiżarnia   ⚙ [-]                        │
│  Ryż basmati        500 g    spiżarnia   ⚙ [-]   ⚠ poniżej minimum    │
│  ...                                                                  │
│                                                                       │
│  ❄️ Lodówka                                                            │
│  ─────────────────                                                    │
│  Masło              200 g    lodówka     ⚙ [-]                        │
│  Mleko              1 l      lodówka     ⚙ [-]   ⚠ termin 2d          │
│  ...                                                                  │
│                                                                       │
│  🧊 Zamrażarka                                                         │
│  ─────────────────                                                    │
│  Kurczak filet      500 g    zamrażarka  ⚙ [-]                        │
└───────────────────────────────────────────────────────────────────────┘
```

### 9.2 Mobile

Pełna lista jest długa — wyświetlamy grupowaną po lokalizacji, każdy element jako wiersz.

```
┌──────────────────────────────┐
│  Spiżarnia          [+] [📋] │
├──────────────────────────────┤
│  🔍 Szukaj...                │
├──────────────────────────────┤
│  ⚠️ Termin (3)                │
│  • Mleko 1l (jutro)          │
│  • Jogurt (jutro)            │
│  • Boczek (za 3 dni)         │
├──────────────────────────────┤
│  Filtry: [Wszystko] [Lodów.] │
├──────────────────────────────┤
│  🥫 Spiżarnia                 │
│  Mąka pszenna        2 kg ⋮  │
│  Cukier              1.5kg ⋮ │
│  Ryż basmati         500g ⋮  │
│                              │
│  ❄️ Lodówka                   │
│  Masło               200g ⋮  │
│  Mleko        1l  ⚠2d   ⋮    │
└──────────────────────────────┘
```

Tap na produkt → bottom sheet z opcjami: edytuj ilość, zmień lokalizację, ustaw termin, włącz auto-replenish, „Zużyj X" (slider).

### 9.3 Tryb inwentaryzacji (Stocktake)

Pełen ekran z listą wszystkich produktów, każdy ma input liczbowy. Cel: szybki update wszystkiego po fizycznej inspekcji.

```
┌──────────────────────────────┐
│  ← Anuluj    [Zapisz]        │
├──────────────────────────────┤
│  Inwentaryzacja              │
│  Wpisz aktualną ilość        │
├──────────────────────────────┤
│  🥫 Spiżarnia                 │
│  Mąka pszenna  [2.0  ] kg    │
│  Cukier        [1.5  ] kg    │
│  Ryż basmati   [0.3  ] kg    │
│                              │
│  ❄️ Lodówka                   │
│  Masło         [0.15 ] kg    │
│  Mleko         [1    ] l     │
│  ...                          │
│                              │
│  [+ Dodaj produkt]           │
└──────────────────────────────┘
```

Zapis → batchowy update wszystkich `PantryItem.quantity`.

### 9.4 Auto-replenish

- Per produkt: edit dialog ma checkbox „Auto-uzupełnij" + pole „Minimum: [X]".
- Gdy `quantity < minQuantity` → produkt pojawia się w widget'cie „🛒 Do zakupu" na górze spiżarni.
- Globalna akcja „🛒 Dodaj wszystkie do listy" → dodaje wszystkie poniżej minimum do wybranej listy.
- W settings: per użytkownik „domyślna lista do auto-replenish".

---

## 10. Ekran: Książki kucharskie (`/kitchen/cookbooks`)

Prosty grid kart z okładkami (emoji + kolor). Klik → strona książki = filtrowana lista przepisów `cookbookId=X`.

```
┌───────────────────────────────────────────────────┐
│  Książki kucharskie                          [+]  │
├───────────────────────────────────────────────────┤
│  ┌──────────┐  ┌──────────┐  ┌──────────┐         │
│  │   📚     │  │   🍝     │  │   🥗     │         │
│  │          │  │          │  │          │         │
│  │ Mama     │  │ Włoska   │  │ Wege     │         │
│  │ 24 przep.│  │ 18 przep.│  │ 12 przep.│         │
│  └──────────┘  └──────────┘  └──────────┘         │
│                                                   │
│  ┌──────────┐  ┌──────────┐                       │
│  │   🧁     │  │   ➕     │                       │
│  │ Desery   │  │ Nowa     │                       │
│  └──────────┘  └──────────┘                       │
└───────────────────────────────────────────────────┘
```

---

## 11. Komponenty dzielone

### 11.1 `IngredientRow` (read-only)

```
┌──────────────────────────────────────────────┐
│ ☐  400 g  spaghetti          ⓘ masz: 250g   │
│                                              │
│   ↑ kategoria z ikoną z bazy Shopping        │
└──────────────────────────────────────────────┘
```

### 11.2 `IngredientRow` (edit)

```
┌─────────────────────────────────────────────────────────────┐
│ ⠿  [400 ]  [g  ▾]  [spaghetti              ]  [al dente]  ✕ │
│              ↑ autocomplete (Product)                        │
└─────────────────────────────────────────────────────────────┘
```

### 11.3 `StepRow` (edit)

```
┌─────────────────────────────────────────────────────────────┐
│ ⠿ Krok 1                                                ✕   │
│   [Tekst markdown wielowierszowy                       ]    │
│   ⏲ [10 ] min   🌡 [____]   [📷 dodaj zdjęcie]             │
└─────────────────────────────────────────────────────────────┘
```

### 11.4 `TagPicker`

Identyczny jak istniejący w Notes — reuse. Multi-select z możliwością tworzenia nowych tagów.

### 11.5 `DurationInput`

Specjalny input do czasów: liczbowy + dropdown („min" / „godz"). Konwersja do minut przy zapisie.

### 11.6 `ServingSelector`

```
[-]  4 porcje  [+]
```

Lub bottom sheet/dropdown z preset'ami: 1, 2, 4, 6, 8, custom.

### 11.7 `ShopForRecipeDialog`

```
┌──────────────────────────────────────┐
│  Dodaj do listy zakupów              │
│                                      │
│  Lista: [Tygodniowe zakupy ▾]        │
│  Porcje: [- 4 +]                     │
│                                      │
│  ☑ Pomiń spiżarnię                  │
│  ☐ Pomiń opcjonalne                 │
│                                      │
│  Składniki:                          │
│  ☑ 400g spaghetti                   │
│  ☑ 200g boczek                      │
│  ☐ 4 żółtka (masz: 6 szt)           │
│  ☑ 100g parmezan                    │
│  ☐ pietruszka (opcjonalne)          │
│                                      │
│  Dodam: 3 pozycje                    │
│  Pominę: 2 (1 w spiżarni, 1 opcj.)   │
│                                      │
│  [Anuluj]            [Dodaj 3 poz.]  │
└──────────────────────────────────────┘
```

---

## 12. Klawiatura — globalne skróty modułu Kuchnia

| Skrót | Akcja | Kontekst |
|-------|-------|----------|
| `Ctrl+K` | Command palette (z prefixami: „Kuchnia: ...") | Globalny |
| `g` `r` | Goto Recipes | Globalny |
| `g` `p` | Goto Plan | Globalny |
| `g` `s` | Goto Spiżarnia (pantry) | Globalny |
| `g` `b` | Goto Cookbooks | Globalny |
| `n` | Nowy (kontekstowo: przepis / wpis planu / produkt spiżarni) | W module |
| `/` | Focus search | W liście |
| `j` `k` | Nawigacja | W liście |
| `e` | Edytuj | Na elemencie |
| `d` | Usuń (z confirm) | Na elemencie |
| `c` | Cook mode | Na widoku przepisu |
| `s` | Do listy zakupów | Na widoku przepisu |
| `p` | Do planu | Na widoku przepisu |
| `+` / `-` | Skala porcji | Na widoku przepisu |
| `Ctrl+S` | Zapisz | W edytorze |
| `Esc` | Wyjdź / anuluj | Wszędzie |
| `Space` | Toggle składnik (checkbox) | W widoku przepisu |

### Command palette extensions

```
Kuchnia: Nowy przepis
Kuchnia: Importuj z URL
Kuchnia: Importuj ze zdjęcia
Kuchnia: Generuj przepis (AI)
Kuchnia: Pokaż plan tygodnia
Kuchnia: Wygeneruj listę zakupów z planu
Kuchnia: Inwentaryzacja spiżarni
Kuchnia: Co dziś gotuję? (AI sugestia)
Kuchnia: Co kończy się w lodówce?
```

---

## 13. Stany pośrednie

### 13.1 Loading

- Skeleton dla każdej karty (RecipeCard skeleton, PantryRow skeleton).
- Spinner tylko w przyciskach akcji (Server Action in-flight).
- Nigdy fullscreen spinner.

### 13.2 Errors

- Toast (4s) dla błędów akcji.
- Inline error pod inputem dla walidacji.
- Error boundary dla awarii komponentu — pokazuje „Coś poszło nie tak" + przycisk „Spróbuj ponownie".

### 13.3 Offline

- W MVP: pokaż banner „Brak połączenia, niektóre akcje mogą nie działać".
- W v1.1: Service Worker cache dla widoku przepisu (Cook Mode powinien działać offline).

### 13.4 Optimistic UI policies

| Akcja | Optimistic? |
|-------|-------------|
| Dodanie składnika/kroku | TAK |
| Reorder | TAK |
| Zmiana porcji (skala) | TAK (lokalnie, bez DB) |
| Usuń przepis | NIE (confirm dialog) |
| Mark cooked | TAK |
| Add to shopping list | NIE (czekaj na ack, pokaż toast) |
| Update pantry quantity | TAK |

---

## 14. Dostępność (a11y)

- Wszystkie inputy mają `<label>` z `htmlFor`.
- Drag handles mają `aria-label="Przenieś"`.
- Cook Mode: `aria-live="polite"` dla bieżącego kroku — czytnik ekranu odczyta po zmianie.
- Wszystkie buttony bez tekstu mają `aria-label`.
- Kontrast min 4.5:1 dla tekstu (sprawdzić tokeny `--text-muted` na `--bg-elevated`).
- Focus visible — `:focus-visible` outline.
- Klawiatura — wszystkie akcje dostępne bez myszy.

---

## 15. Wizualne tokens — extensions

Dodajemy do `globals.css`:

```css
:root {
  --accent-orange: #ff8a3d;        /* Kuchnia primary accent */
  --kitchen-pantry: #4caf50;       /* zielony dla pantry items */
  --kitchen-expiring: #ff9800;     /* pomarańczowy dla expiring */
  --kitchen-expired: #f44336;      /* czerwony dla expired */
  --kitchen-cook-bg: #050505;      /* czarne tło Cook Mode (kontrast) */
  --kitchen-cook-text: #ffffff;
}
```

---

## 16. Animacje (minimalistyczne)

| Co | Animacja | Czas |
|----|----------|------|
| Drag preview | fade-in | 100ms |
| Drop accept | scale 1.0 → 1.03 → 1.0 | 200ms |
| Toast pop | slide-up + fade | 200ms |
| Bottom sheet | slide-up from bottom | 300ms cubic-bezier |
| Cook Mode next/prev step | crossfade text 150ms | — |
| Skala porcji (zmiana ilości) | brak — instant | — |
| Hover na karcie | brak (mobile) / lift 1px (desktop) | 100ms |
| Wszystko inne | brak | — |

---

## 17. Mobile-specific UX

### 17.1 Gesty

- **Long-press na karcie przepisu** → quick menu (Edytuj, Duplikuj, Dodaj do planu, Usuń).
- **Swipe right** na karcie przepisu w liście → szybkie „Dodaj do listy zakupów".
- **Swipe left** na karcie przepisu w liście → archiwizuj.
- **Pull-to-refresh** → re-fetch listy.
- **Swipe down** na bottom sheet → zamknij.
- **Tap zone Cook Mode** lewa/prawa = poprzedni/następny.

### 17.2 Klawisze sprzętowe iPhone

- Brak (mobile Safari nie obsługuje keyboard shortcuts globalnych).
- Wewnątrz Cook Mode: jeśli podłączona klawiatura BT → strzałki ← → przełączają kroki.

### 17.3 Web App / PWA

Moduł powinien działać dobrze jako PWA:
- Manifest.json zawiera shortcuts:
  - „Co dziś gotuję" → otwiera `/kitchen/plan` na dzisiaj
  - „Spiżarnia" → otwiera `/kitchen/pantry`
- Icon dla Kuchnia.
- Offline (Service Worker) dla Cook Mode (cache krok-po-kroku po wejściu).

---

## 18. Cross-module UX

### 18.1 Z modułu Shopping

- Przycisk na liście zakupów: „Co mogę z tego ugotować?" → modal z propozycjami przepisów używających items z listy (AI).
- Przy pozycji z `recipeOrigin` — badge „🍽 z przepisu Carbonara" + klik → wraca do przepisu.
- W settings listy zakupów: „Auto-przenieś do spiżarni po DONE" (toggle).

### 18.2 Z Home (AI dashboard)

- Widget „Dziś gotuję": pokazuje dziś planowany posiłek + przycisk „Cook Mode".
- Widget „Kończy się w lodówce": top 3 PantryItem `< 3 dni`.
- Widget „Sugestia AI": klik generuje 1 przepis z spiżarni → szczegóły lub „Dodaj do planu".

### 18.3 Z Tasks

- W MVP: brak integracji.
- W v2.0: gotowanie planowanego posiłku może być zadaniem na konkretną godzinę (np. „Marynować mięso o 18:00 dzień przed").

---

## 19. Onboarding

Pierwsze wejście do `/kitchen`:

```
┌───────────────────────────────────────────────┐
│            👨‍🍳                                 │
│   Witaj w Kuchni                              │
│                                               │
│   Co chcesz zrobić jako pierwsze?             │
│                                               │
│   [📥 Zaimportować ulubiony przepis z neta]   │
│   [✏️  Wpisać przepis ręcznie]                │
│   [📚 Wybrać z gotowej bazy startowej]        │
│   [⏭  Pomiń, eksploruję sam]                  │
└───────────────────────────────────────────────┘
```

Po pierwszym przepisie → tooltip pokazujący „Spróbuj: kliknij 🛒 aby dodać składniki do listy zakupów".

---

## 20. Specyfikacja techniczna komponentów (skrócona)

### 20.1 `RecipeCard` props

```typescript
interface RecipeCardProps {
  recipe: RecipeListItem;
  variant?: "grid" | "list" | "compact";
  onClick?: (id: string) => void;
  onAddToPlan?: (id: string) => void;
  onAddToShopping?: (id: string) => void;
  showOrigin?: boolean;   // czy pokazać "własny / team / publiczny"
  highlightQuery?: string; // do podświetlania w search
}
```

### 20.2 `MealPlanWeek` props

```typescript
interface MealPlanWeekProps {
  weekStart: Date;
  teamId?: string;
  onSlotClick?: (date: Date, slot: MealSlot) => void;
  onSlotDrop?: (date: Date, slot: MealSlot, recipeId: string) => void;
  onMealCooked?: (entryId: string) => void;
}
```

### 20.3 `PantryRow` props

```typescript
interface PantryRowProps {
  item: PantryItem;
  expiringWarn?: number;   // dni do alertu (default 3)
  onQuantityChange?: (id: string, q: number) => void;
  onRemove?: (id: string) => void;
  onToggleAutoReplenish?: (id: string) => void;
}
```

---

## 21. Testy UX (manualne checklisty przed release'em)

### 21.1 Mobile (iPhone Safari)

- [ ] Cała lista przepisów scrolluje płynnie (60fps) przy 100+ przepisach
- [ ] Cover image lazy-loadowane (nie pobiera 100 zdjęć na start)
- [ ] Bottom sheet dla `ShopForRecipeDialog` otwiera się płynnie i nie zasłania zbyt wiele
- [ ] Cook Mode wakelock działa (ekran nie gaśnie przez 5 min)
- [ ] Long-press na karcie pokazuje quick menu bez konfliktu z scrollem
- [ ] DnD w edytorze działa po long-press
- [ ] Timery w Cook Mode wibrują przy końcu (`navigator.vibrate`)
- [ ] PWA install action działa
- [ ] Tryb landscape (na iPadzie) skaluje się rozsądnie

### 21.2 Desktop

- [ ] Wszystkie skróty klawiszowe działają i nie konfliktują z innymi modułami
- [ ] DnD w `MealPlanWeek` działa płynnie (drag z drawera → drop na slot)
- [ ] Auto-save w edytorze działa, ale nie spamuje serwera (debounce)
- [ ] Multi-window (otwarcie dwóch okien tej samej strony) nie powoduje desyncu
- [ ] Drukowanie przepisu (`Ctrl+P`) wygląda przyzwoicie (CSS print styles)

### 21.3 A11y

- [ ] Tab przez wszystkie pola edytora w sensownej kolejności
- [ ] Czytnik ekranu (VoiceOver) odczytuje kroki Cook Mode po zmianie
- [ ] Wszystkie kolory mają ≥ 4.5:1 kontrast
- [ ] Focus visible wszędzie

---

## 22. Najczęstsze błędy UX do uniknięcia

1. **Nie wymuszać Product na każdy składnik.** Człowiek wpisuje „szczyptę soli" — i tyle.
2. **Nie domyślnie wszystko jako team.** Jeśli user nie ma teamu, ukrywaj selektor.
3. **Nie mieszać porcji w edycji.** Edycja przepisu zawsze pokazuje ilości dla `recipe.servings` (zachowane). Skala porcji to tylko view.
4. **Cook Mode bez „Zamknij" w widocznym miejscu** = pułapka.
5. **Spiżarnia bez „grupowanie po lokalizacji"** = chaos przy 50+ produktach.
6. **Sugestie AI bez „regeneruj"** = irytujące jeśli pierwsza propozycja nie pasuje.
7. **Lista zakupów z planu bez podglądu** = czarna skrzynka, user nie wie co dostanie.

---

## 23. Załączniki

- `recipes-architecture.md` — pełna architektura (DB, actions, integracje)
- `recipes-analysis.md` — analiza funkcji, AI, roadmapy
- `recipes-summary.md` — wstęp dla nowej sesji Claude Code

---

**Koniec dokumentu UX v1.0.**
