# WorldOfMag — Raport sesji i dokumentacja kontekstu

> **Przeznaczenie tego pliku:** Przy każdym nowym czacie wczytaj ten plik jako kontekst zanim zaczniesz pracę. Zawiera historię decyzji, aktualny stan projektu, dane dostępowe i kierunek dalszego rozwoju.

---

## 1. Wizja projektu

**WorldOfMag** (`worldofmag/` w repo `styka/home`) to modułowy system zarządzania życiem i pracą dorosłego programisty — właściciela: **Szymon Tyka** (tyka.szymon@gmail.com).

Nazwa pochodzi od "Świat Maga" — osobisty cyfrowy "świat" Szymona. Angielska wersja: **WorldOfMag**.

### Filozofia UX
Aplikacja jest tworzona z myślą o programiście, który:
- Preferuje klawiaturę nad myszą
- Oczekuje ciemnego motywu
- Nie toleruje zbędnych kliknięć i animacji
- Ceni minimalizm w stylu Linear/GitHub/VS Code
- Rozumie i docenia keyboard shortcuts (vim-style: j/k, x, d, e)

### Moduły (roadmapa)
| Moduł | Status |
|-------|--------|
| 🛒 Shopping List | ✅ Gotowy i wdrożony |
| 📅 Calendar | 🔲 Stub (ikona w sidebarze) |
| 📝 Notes | 🔲 Stub |
| 💼 Work Tracker | 🔲 Stub |

---

## 2. Chronologia sesji — co zrobiliśmy i dlaczego

### Faza 1 — Analiza istniejącego kodu
Repozytorium `styka/home` zawierało stary projekt Spring Boot 1.5.4 + AngularJS 1.5.5 z 2017 roku (oryginalnie na OpenShift). Zdecydowaliśmy **nie dotykać starego kodu** — nowa aplikacja powstała jako osobny katalog `worldofmag/` w tym samym repo.

### Faza 2 — Planowanie architektury
Wybrany stack:
- **Next.js 14** (App Router) — standard dla full-stack React w 2025/2026
- **TypeScript** — obowiązkowo dla utrzymywalności
- **Tailwind CSS** + CSS variables (dark theme)
- **Prisma** — ORM z typami generowanymi automatycznie
- **SQLite** (lokalnie) → **PostgreSQL/Neon** (produkcja)
- **Server Actions** — zamiast osobnych API routes
- **cmdk** — command palette (Ctrl+K)
- Brak state managera (Zustand/Redux) — stan shallow enough dla useState + useOptimistic

### Faza 3 — Implementacja aplikacji
Stworzono kompletną aplikację od zera:

**Funkcje Shopping:**
- Wiele list zakupów (CRUD)
- Pozycje z: nazwa, ilość, jednostka, kategoria, status, notatki, priorytet
- Smart quick-add: `2 butelki mleka` → auto-parsuje ilość, jednostkę, kategoryzuje
- Auto-kategoryzacja (12 kategorii, słownik PL+EN)
- Statusy: `NEEDED` → `IN_CART` → `DONE` / `MISSING`
- Filtry z licznikami: All / Needed / In Cart / Done / Missing
- Real-time search overlay
- Inline editing (podwójny klik lub `e`)
- Grupowanie wg kategorii z collapsible headers
- Autocomplete z historii użycia (`ItemHistory`)

**Keyboard shortcuts:**
| Klawisz | Akcja |
|---------|-------|
| `a` / `n` | Fokus na QuickAddBar |
| `j` / `k` | Nawigacja góra/dół |
| `Space` / `x` | Cykl statusu |
| `e` | Edycja inline |
| `d` | Usuń pozycję |
| `/` / `f` | Wyszukiwarka |
| `1`–`5` | Przełącz filtry |
| `Ctrl+K` | Command palette |
| `Esc` | Zamknij/anuluj |

### Faza 4 — Problemy z deploymentem (decyzje i cofnięcia)

#### Próba 1: Vercel + Neon ❌
**Problem:** Vercel zwracał błąd "Kod 705 — Nie udało się zweryfikować przeglądarki" (Cloudflare bot-check) w sieci Szymona. Niemożliwe do obejścia bez zmiany sieci.  
**Decyzja:** Porzucono Vercel, szukamy alternatywy.

#### Próba 2: Fly.io ❌
**Problem:** Fly.io wymaga karty kredytowej nawet dla darmowego planu (weryfikacja tożsamości). Szymon nie chciał podawać danych karty.  
**Decyzja:** Porzucono Fly.io, szukamy opcji bez karty.

#### Próba 3: Render ✅
**Wynik:** Działa. Darmowy tier bez karty kredytowej. Aplikacja online i działająca.  
**Wada:** Na free tier aplikacja "zasypia" po 15 min bezczynności i potrzebuje ~10-15 sek na pierwsze uruchomienie. Dla aplikacji zakupowej akceptowalne.

**Baza danych:** Neon (PostgreSQL) — konto tyka.szymon@gmail.com, projekt `worldofmag`.

### Faza 5 — Problem z responsywnością na iPhone
**Problem:** Na iPhonie aplikacja była nieużywalna — dwa sidebary (ModuleSidebar 220px + ListPicker 200px = 420px) zajmowały więcej miejsca niż szerokość ekranu iPhone'a (~390px). Lista zakupów była całkowicie niewidoczna.  
**Rozwiązanie:**
- `ModuleSidebar` ukryty na mobile (`hidden md:flex`)
- `ListPicker` ukryty na mobile (`hidden md:flex`)  
- Dodano mobile top bar z logo "WorldOfMag"
- Dodano dropdown `<select>` w headerze do przełączania list na mobile
- FilterTabs z `overflow-x-auto` na mobile
- Ukryto keyboard hints na mobile
- Większe touch targety w `ItemRow` (`py-3` zamiast `py-2.5`, checkbox 20×20px)

**Finał:** Aplikacja działa responsywnie — Mac (desktop layout) i iPhone (mobile layout).

---

## 3. Architektura techniczna

### Stack
```
Frontend:  Next.js 14 (App Router) + React 18 + TypeScript
Styling:   Tailwind CSS + CSS variables (dark theme #0d0d0d)
Database:  Prisma 5 + PostgreSQL (Neon) | SQLite (lokalnie)
Deploy:    Render (free tier, Frankfurt)
DB Host:   Neon (free tier, eu-central-1)
PWA:       manifest.json + service worker + apple-touch-icon
```

### Struktura plików
```
worldofmag/
├── Dockerfile                          # Multi-stage build (node:22-alpine)
├── fly.toml                            # Fly.io config (nieużywany — backup)
├── render.yaml                         # Render deployment config
├── deploy.sh                           # Fly.io deploy script (nieużywany)
├── next.config.mjs
├── tailwind.config.ts
├── prisma/
│   ├── schema.prisma                   # ShoppingList, Item, ItemHistory
│   ├── seed.ts                         # 69 polskich produktów w ItemHistory
│   └── migrations/0001_init/           # SQL dla PostgreSQL
├── public/
│   ├── manifest.json                   # PWA manifest
│   ├── sw.js                           # Service worker (network-first)
│   └── icons/                          # 192px, 512px, 180px apple-touch-icon
└── src/
    ├── app/
    │   ├── layout.tsx                  # Root layout + PWA meta tagi
    │   ├── page.tsx                    # Redirect → /shopping
    │   └── shopping/
    │       ├── layout.tsx              # CommandPaletteProvider
    │       ├── page.tsx                # Auto-create "Zakupy" jeśli brak list
    │       └── [listId]/page.tsx       # Server component, fetchuje dane
    ├── components/
    │   ├── shell/
    │   │   ├── AppShell.tsx            # flex-col mobile / flex-row desktop
    │   │   └── ModuleSidebar.tsx       # hidden md:flex
    │   ├── shopping/
    │   │   ├── ShoppingPage.tsx        # Główny client component
    │   │   ├── QuickAddBar.tsx         # Smart add z autocompletem
    │   │   ├── FilterTabs.tsx          # overflow-x-auto, hints desktop-only
    │   │   ├── ItemList.tsx            # Grouped by category
    │   │   ├── ItemRow.tsx             # Inline edit, status toggle
    │   │   ├── CategoryGroup.tsx       # Collapsible z ikonami emoji
    │   │   ├── StatusBadge.tsx         # needed/in cart/done/missing
    │   │   ├── ListPicker.tsx          # hidden md:flex (desktop sidebar)
    │   │   └── SearchBar.tsx           # Real-time search
    │   └── command-palette/
    │       ├── CommandPalette.tsx      # cmdk + Radix Dialog
    │       └── CommandPaletteProvider.tsx
    ├── hooks/
    │   ├── useKeyboardShortcuts.ts     # Centralny dispatcher
    │   └── useItemNavigation.ts        # j/k + scrollIntoView
    ├── actions/
    │   ├── items.ts                    # addItem, updateStatus, delete...
    │   └── lists.ts                    # createList, rename, delete
    └── lib/
        ├── categorize.ts               # 12 kategorii, PL+EN keywords
        ├── parseQuantity.ts            # "2 butelki mleka" → {qty, unit, name}
        └── prisma.ts                   # Singleton Prisma client
```

### Schema bazy danych
```prisma
model ShoppingList {
  id, name, createdAt, updatedAt
  items     Item[]
}

model Item {
  id, name, quantity, unit, category
  status    String  // "NEEDED" | "IN_CART" | "DONE" | "MISSING"
  notes, priority, createdAt, updatedAt
  listId    String (FK → ShoppingList, cascade delete)
}

model ItemHistory {
  id, name (unique, lowercase), category, unit
  useCount  Int  // rośnie przy każdym użyciu → autocomplete ranking
  updatedAt
}
```

> **Uwaga:** SQLite nie obsługuje enumów w Prisma — status jest typem `String`. TypeScript type `ItemStatus = "NEEDED" | "IN_CART" | "DONE" | "MISSING"` jest zdefiniowany ręcznie w `src/types/index.ts`.

---

## 4. Dane dostępowe i infrastruktura

### Git
- **Repo:** `github.com/styka/home`
- **Branch roboczy:** `claude/shopping-list-app-rJieP`
- **Main/master:** nienaruszony (stary Spring Boot)

### Neon (PostgreSQL)
- **Konto:** tyka.szymon@gmail.com
- **Projekt:** worldofmag
- **Region:** eu-central-1 (Frankfurt)
- **Connection string:**
  ```
  postgresql://neondb_owner:npg_CIVYo0Lv7mpy@ep-crimson-scene-al05719e.c-3.eu-central-1.aws.neon.tech/neondb?sslmode=require
  ```
- **Env vars w Render:**
  - `DATABASE_URL` = powyższy string
  - `DIRECT_URL` = powyższy string (bez pgbouncer dla migracji)

### Render
- **Konto:** tyka.szymon@gmail.com (przez GitHub)
- **Serwis:** worldofmag
- **URL:** `https://worldofmag.onrender.com` *(lub podobny — sprawdź w dashboardzie Render)*
- **Plan:** Free
- **Region:** Frankfurt
- **Auto-deploy:** TAK — każdy push do brancha `claude/shopping-list-app-rJieP` triggeruje redeploy
- **Build command:** `npm ci && npx prisma generate && npm run build`
- **Start command:** `npx prisma migrate deploy && node_modules/.bin/next start`

### iPhone — PWA
- Aplikacja zainstalowana jako PWA przez Safari → Share → Add to Home Screen
- Ikona "WorldOfMag" na home screenie
- Działa w trybie fullscreen (bez paska przeglądarki)
- Service worker cache'uje shell aplikacji

---

## 5. Jak uruchomić lokalnie

```bash
# Klonowanie
git clone https://github.com/styka/home.git
cd home
git checkout claude/shopping-list-app-rJieP
cd worldofmag

# Instalacja
npm install

# Baza lokalna (SQLite)
echo 'DATABASE_URL="file:./dev.db"' > .env.local
echo 'DIRECT_URL="file:./dev.db"' >> .env.local
npm run db:push
npm run db:seed

# Uruchomienie
npm run dev
# → http://localhost:3000
```

Lub z Neon (produkcyjna baza):
```bash
echo 'DATABASE_URL="postgresql://neondb_owner:npg_CIVYo0Lv7mpy@ep-crimson-scene-al05719e.c-3.eu-central-1.aws.neon.tech/neondb?sslmode=require"' > .env.local
echo 'DIRECT_URL="postgresql://neondb_owner:npg_CIVYo0Lv7mpy@ep-crimson-scene-al05719e.c-3.eu-central-1.aws.neon.tech/neondb?sslmode=require"' >> .env.local
npm run dev
```

---

## 6. Znane ograniczenia i dług techniczny

| Problem | Priorytet | Opis |
|---------|-----------|------|
| Render cold start | Niski | ~10-15 sek przy pierwszym wejściu po bezczynności. Można przenieść na płatny tier ($7/mies) jeśli będzie przeszkadzać. |
| SQLite vs enum | Niski | Status jest `String` zamiast enum. Nie jest problemem funkcjonalnym. |
| Brak optimistic updates | Średni | `useOptimistic` zaimplementowane częściowo — można rozbudować |
| Brak offline trybu | Niski | Service worker cache'uje shell, ale dane wymagają sieci |
| `prompt()` w CommandPalette | Średni | Tworzenie listy przez `prompt()` — brzydkie, ale działa. Zastąpić modalem. |
| Seed po deploy na Render | Niski | Seed nie uruchamia się automatycznie po deploy. Można dodać do start command lub uruchomić raz przez Render shell. |

---

## 7. Następne kroki — co robić w kolejnych sesjach

### Krótkoterminowe (Shopping module)
- [ ] Zastąpić `prompt()` w tworzeniu listy eleganckim modalem
- [ ] Dodać drag-and-drop reordering pozycji
- [ ] Dodać możliwość "ukończenia zakupów" — archiwizacja listy
- [ ] Własne kategorie (user-defined)
- [ ] Współdzielenie listy (share link)

### Długoterminowe (WorldOfMag)
- [ ] **Moduł 2: Notes** — notatki z tagami, Markdown support
- [ ] **Moduł 3: Work Tracker** — śledzenie zadań, time tracking
- [ ] **Moduł 4: Calendar** — widok kalendarza z integrację z modułami
- [ ] Wspólne auth (jeśli app będzie multi-user)
- [ ] Migracja na płatny hosting gdy free tier będzie niewystarczający

---

## 8. Lekcje z tej sesji (dla przyszłego Claude'a)

1. **Vercel jest zablokowany** w sieci Szymona (Cloudflare bot-check, kod 705). Nie próbuj go używać.
2. **Fly.io wymaga karty kredytowej** — Szymon nie chce jej podawać. Używaj Render.
3. **Render free tier** działa i jest akceptowalny dla tego projektu.
4. **SQLite enum problem** — Prisma z SQLite nie obsługuje enumów. Używaj `String` z manualnym TypeScript type.
5. **Sandbox sieciowy** — środowisko Claude'a (ten serwer) ma zablokowany dostęp do internetu. Nie można deployować bezpośrednio — tylko przygotowywać kod i dawać instrukcje użytkownikowi.
6. **macOS 12** — Szymon ma stary Mac z macOS 12. `brew install flyctl` nie działa przez stary Homebrew. Używaj oficjalnych skryptów instalacyjnych.
7. **iPhone responsywność** — dwa sidebary (220px + 200px = 420px) > szerokość iPhone. Zawsze używaj `hidden md:flex` dla paneli bocznych.

---

*Raport wygenerowany: Kwiecień 2026 | Sesja: WorldOfMag v0.1 — Shopping List Module*
