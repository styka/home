# Zadania: Audyt bezpieczeństwa infrastruktury + raport w aplikacji

- **Plan:** ./plan.md (101-audyt-bezpieczenstwa)
- **Status:** todo
- **Data:** 2026-08-25

> Kolejność **od najmniej do najbardziej ryzykownej**. Tu nie ma migracji schematu ani Server Actions,
> więc klasyczna kolejność „migracja → akcje → UI" nie obowiązuje — porządkuje nas **promień rażenia**:
> najpierw czysta funkcja bez konsumentów, na końcu nagłówki dotykające **każdej** strony aplikacji.

## Legenda
- `[ ]` do zrobienia · `[x]` zrobione · `[~]` w trakcie · `[!]` zablokowane
- `[P]` — niezależne od poprzedniego, można zrównoleglić

## Faza 0 — Przygotowanie środowiska
- [ ] **T-1** — Postawić **lokalny** Postgres i zaaplikować migracje (`pg_ctlcluster 16 main start`,
      rola+baza `omnia/omnia_dev`, `.env.local` + **eksport zmiennych do powłoki** — `scripts/migrate.js`
      nie czyta `.env.local`). **Gotowe, gdy:** `npx prisma migrate deploy` przechodzi, a `DATABASE_URL`
      wskazuje `127.0.0.1` (C-13 — nigdy produkcja).

## Faza 1 — Odkażanie treści ikon (AC-9)
- [ ] **T-2** — `src/modules/shopping/lib/odkazSvg.ts`: czysta funkcja `odkazSvg(tresc): string` na
      **białej liście** elementów (`path`, `circle`, `rect`, `line`, `polyline`, `polygon`, `ellipse`,
      `g`, `defs`, `title`) i atrybutów geometryczno-prezentacyjnych. Odrzuca każdy atrybut `on*`,
      elementy `script`/`animate`/`set`/`foreignObject`/`image`/`use` oraz każdy `href`/`xlink:href`.
      Zero zależności, **klientowo-bezpieczna** (żadnego `node:` — wymóg `check:client-safe`).
      **Gotowe, gdy:** funkcja istnieje i jest czysta (bez wejścia/wyjścia poza argumentem).
- [ ] **T-3** — `src/modules/shopping/lib/__tests__/odkazSvg.test.ts`: ładunki odrzucone
      (`<image href=x onerror=…>`, `<script>`, `onload=` na `<circle>`, `<animate onbegin=…>`,
      `<use href="#x">`), zwykła ikona konturowa przechodzi **bez zmian**.
      **Gotowe, gdy:** `npx tsx --test` na tym pliku zielony.
- [ ] **T-4** — Wpiąć odkażanie **przy wyświetleniu**: `src/modules/shopping/ui/IconDisplay.tsx`.
      Dodatkowo zawęzić gałąź `data:image/` do rastrów (`png|jpeg|jpg|gif|webp`) — dziś przechodzi
      także `data:image/svg+xml`, czyli ta sama treść inną drogą.
      **Gotowe, gdy:** komponent renderuje wyłącznie odkażoną treść. *To jest krok, który zabezpiecza
      wiersze **już zapisane** w bazie — dlatego idzie przed zapisem, nie po nim.*
- [ ] **T-5** `[P]` — Wpiąć odkażanie **przy zapisie**: `src/modules/shopping/actions/categoryIcons.ts`
      (wszystkie ścieżki przyjmujące treść: `saveAndActivateCategoryIcon`, `saveToLibrary`,
      `assignIconToCategory`). **Gotowe, gdy:** do bazy nie da się zapisać nieodkażonej treści.

## Faza 2 — Strażnik sekretu sesji (AC-10)
- [ ] **T-6** — `src/platform/auth/session.ts`: wynieść zastępczą wartość do **nazwanej, eksportowanej
      stałej** (żeby strażnik nie porównywał literału w dwóch miejscach).
      **Gotowe, gdy:** stała jest jedynym miejscem, gdzie ta wartość występuje.
- [ ] **T-7** — `src/instrumentation.ts`: w `register()` (gałąź `NEXT_RUNTIME === "nodejs"`) rzucić
      czytelny **polski** błąd, gdy sekret podpisujący sesje jest pusty albo równy stałej z T-6.
      Osobno **ostrzeżenie w logu** (nie błąd), gdy brak klucza szyfrowania sekretów — konfiguracja
      bez kluczy API jest poprawnym stanem, brak sekretu sesji nie jest.
      **Gotowe, gdy:** `next build` **bez** sekretu nadal przechodzi, a `next start` bez sekretu pada.

## Faza 3 — Nagłówki bezpieczeństwa (AC-6, AC-7) — **najwyższy promień rażenia**
- [ ] **T-8** — `next.config.mjs`: `async headers()` dla `source: "/:path*"` wg tabeli z planu §6.1.
      **Dwa warunki, których nie wolno pomylić:**
      (a) `Permissions-Policy` musi mieć **`camera=(self), microphone=(self), geolocation=(self)`** —
      aplikacja realnie używa wszystkich trzech (skanowanie kodów `@zxing`, dyktowanie Web Speech,
      Pogoda); wartość `()` wyłączyłaby je po cichu, a błąd zobaczyłby dopiero użytkownik;
      (b) `Strict-Transport-Security` **tylko** gdy `NODE_ENV === "production"`, **bez** zgłaszania do
      listy `preload` (to byłby krok faktycznie nieodwracalny).
      **Gotowe, gdy:** `curl -sI` na `next start` pokazuje komplet nagłówków.

## Faza 4 — Raport (AC-1..AC-5, AC-8)
- [ ] **T-9** — `prisma/migrations/0261_raport_audyt_bezpieczenstwa/migration.sql`: **przepisać**
      ustalenia z `plan.md` §11 (U-01..U-26, odpowiedź o SSH, droga danych) na raport po polsku.
      Wymogi: `slug` = `audyt-bezpieczenstwa-2026-08` (sprawdzić globalną unikalność),
      `category` = `system`, `authorId`/`teamId` = `NULL`, dollar-quoting tagiem **nieobecnym w treści**,
      `ON CONFLICT ("slug") DO NOTHING`. **Zero `CREATE`/`ALTER`/`DROP`** — zweryfikować
      `grep -E "^(DROP|ALTER|CREATE)"` (C-15). **Żadnej wartości sekretu, adresu bazy ani fragmentu
      klucza** (C-41). Rzeczy niepotwierdzalne z repozytorium oznaczyć **[do potwierdzenia]**.
      **Gotowe, gdy:** `npm run check:migrations` przechodzi, a raport otwiera się lokalnie w `/reports`.

## Faza 5 — Bramki i domknięcie
- [ ] **T-10** — **Pełny** `npm run build` na lokalnym Postgresie — nie pojedyncze bramki
      (lekcja z `doświadczenia.md` 2026-08-25: wybiórcze odpalanie bramek to zgadywanie, która z nich
      reaguje na zmianę). **Gotowe, gdy:** cały łańcuch zielony aż do `next build`.
- [ ] **T-11** — Klikacze (AC-7 — nic nie przestało działać):
      `nohup bash scripts/e2e-web.sh > /tmp/e2e.log 2>&1 &`, potem `tail -40 /tmp/e2e.log`.
      **Gotowe, gdy:** wynik nie gorszy niż przed zmianą (regresje przypisane tej zmianie = zero).
- [ ] **T-12** — Wpis do `doświadczenia.md` (C-51): `Permissions-Policy` jako nagłówek, który
      **odbiera uprawnienia po cichu**, oraz zasada „odkażaj przy odczycie, nie tylko przy zapisie,
      bo w bazie leżą już wiersze sprzed poprawki".
- [ ] **T-13** — Mapowanie AC → dowód (wsad do `/verify`).

## Mapowanie kryteriów akceptacji → zadania

| AC | Czego dotyczy | Zadania |
|----|---------------|---------|
| AC-1 | raport widoczny w `/reports` | T-9 |
| AC-2 | dostarczony wdrożeniem, idempotentnie | T-9, T-10 |
| AC-3 | opis drogi danych + szyfrowanie odcinków | T-9 (plan §11 „Architektura") |
| AC-4 | ponumerowane ustalenia ze stanem i wagą + lista napraw | T-9 (plan §11) |
| AC-5 | odpowiedź na pytanie o SSH / dostęp do powłoki | T-9 (plan §11 „Odpowiedź…") |
| AC-6 | komplet nagłówków w odpowiedzi | T-8 |
| AC-7 | nic nie przestało działać | T-8 (`(self)`), T-11 |
| AC-8 | rozdział o sekretach | T-9 |
| AC-9 | ikona jednego użytkownika nie wykonuje się u drugiego | T-2, T-3, T-4, T-5 |
| AC-10 | brak sekretu zatrzymuje start, build przechodzi | T-6, T-7 |

## Ścieżka krytyczna
`T-1` (baza) blokuje `T-9`, `T-10`, `T-11`.
`T-2` → `T-3`, `T-4`, `T-5` (funkcja przed konsumentami; `T-4` i `T-5` niezależne od siebie).
`T-6` → `T-7`. `T-8` niezależne od wszystkiego — ale **świadomie ostatnie z napraw**, bo dotyka
każdej strony, więc gdy klikacze (`T-11`) coś zgłoszą, winowajca jest oczywisty.
`T-9` niezależne od napraw, ale **po nich**, żeby lista „naprawione w tej zmianie" opisywała stan faktyczny.

## Notatki / blokady
- Aktualizacja podatnych zależności (3 krytyczne, w tym biblioteka logowania) **nie jest zadaniem tej
  listy** — świadomie osobny commit, patrz `spec.md` §5 „Poza zakresem" i `plan.md` §11 U-04.
