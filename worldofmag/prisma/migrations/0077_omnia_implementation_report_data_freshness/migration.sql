-- Raport implementacji: świeżość danych między urządzeniami (auto-refresh) — 2026-06-03.
-- → widoczny w /admin/reports oraz /reports. INSERT idempotentny: ON CONFLICT (slug) DO NOTHING.
-- Uwaga: slug 'omnia-implementacja-2026-06-03' jest już zajęty przez raport tabbar (migracja 0076),
-- więc używamy odrębnego, opisowego slug-a, by nie nadpisać tamtego wpisu.

INSERT INTO "Report" ("id", "title", "slug", "content", "category", "authorId", "createdAt", "updatedAt")
VALUES (
  gen_random_uuid()::text,
  'Omnia — Raport implementacji 2026-06-03 (świeżość danych między urządzeniami)',
  'omnia-implementacja-2026-06-03-data-freshness',
  $omnia_impl$# Omnia — Raport implementacji 2026-06-03

## Świeżość danych między urządzeniami — zmiany widoczne bez twardego refresh (w tym PWA na iPhone)

**Diagnoza:** Dane dodane/zmienione/usunięte na jednym urządzeniu nie pojawiały się na drugim
(ani w drugiej karcie) dopóki użytkownik nie zrobił **pełnego przeładowania strony**. Przełączenie
modułu z menu i powrót też nie odświeżało. Najdotkliwiej w PWA wyciągniętym na ekran główny iPhone'a
(Safari w trybie `standalone`): nie ma tam paska przeglądarki ani przycisku odświeżania, więc jedynym
wyjściem było ubicie całej aplikacji. Źródło problemu jest dwojakie:
1. Mutacje używają Server Actions + `revalidatePath()`, co odświeża dane **tylko dla sesji/klienta,
   który wykonał mutację**. Inne urządzenia nie są o niczym powiadamiane — ich komponenty serwerowe
   re-renderują się dopiero przy twardym odświeżeniu. `revalidatePath()` to **nie** jest synchronizacja
   między urządzeniami.
2. **Router Cache** Next.js (App Router) serwuje zcache'owany payload RSC przy nawigacji w obrębie
   aplikacji (zmień moduł → wróć), więc dane wyglądają na nieświeże nawet bez zmiany urządzenia.

**Rozwiązanie:** Wybrano podejście **focus + polling** (potwierdzone z właścicielem) — świadomie zamiast
realtime (SSE/WebSocket), które nie współgra z Render free tier (usypianie po 15 min, limity połączeń)
i wymagałoby dodatkowej infrastruktury. Dodano globalny komponent kliencki `DataFreshness`, montowany
jednorazowo w `AppShell` (powłoce opakowującej wszystkie moduły), który woła `router.refresh()` —
nieinwazyjny re-fetch komponentów serwerowych bez przeładowania strony i bez utraty stanu klienta /
focusu w polach edycji — w momentach **powrotu do aplikacji** oraz **cyklicznie gdy karta jest widoczna**:

- `visibilitychange` → gdy `visibilityState === "visible"` (powrót do PWA/karty — **kluczowy haczyk dla
  iOS standalone**, gdzie nie ma ręcznego odświeżania),
- `focus` okna (powrót focusu),
- `pageshow` (wznowienie z bfcache / restore w trybie standalone),
- `setInterval` co **45 s**, wołane **tylko gdy karta jest widoczna** (nie odpytuje w tle → nie marnuje
  zasobów i nie utrzymuje sztucznie instancji Render przy życiu).

Throttle (`lastRefresh` w `useRef` + `MIN_GAP_MS` = 3 s) eliminuje podwójne odświeżenie, gdy `focus`
i `visibilitychange` strzelają jednocześnie. Wszystkie listenery oraz `setInterval` są sprzątane w
cleanupie `useEffect` (zgodnie z wcześniejszą lekcją: zasób imperatywny trzeba jawnie zatrzymać na unmount).
Drugą przyczynę (staleness nawigacji w SPA) domyka `experimental.staleTimes: { dynamic: 0 }` w
`next.config.mjs` — wyłącza ponowne użycie Router Cache dla stron dynamicznych, więc nawigacja w obrębie
aplikacji zawsze pobiera świeże dane (samego `focus`-refresh tu nie wystarczy, bo nawigacja w obrębie
okna nie generuje zdarzenia `focus`).

**Zmienione pliki:**
- `src/components/shell/DataFreshness.tsx` — **nowy** komponent kliencki (`return null`): nasłuch
  `visibilitychange`/`focus`/`pageshow` + polling 45 s (tylko gdy widoczne), throttle 3 s, pełny cleanup.
- `src/components/shell/AppShell.tsx` — import i montaż `<DataFreshness />` w drzewie powłoki (raz, globalnie).
- `next.config.mjs` — `experimental.staleTimes: { dynamic: 0 }` (świeża nawigacja w obrębie aplikacji).
- `doświadczenia.md` — wpis lekcji o różnicy między `revalidatePath()` a synchronizacją cross-device.

## Podsumowanie

Sesja obejmowała **1 zadanie** (świeżość danych między urządzeniami). Główne obszary zmian: powłoka
aplikacji (`AppShell` + nowy `DataFreshness`) oraz konfiguracja cache nawigacji (`next.config.mjs`).
Kluczowa decyzja projektowa: rozwiązać problem **bez infrastruktury realtime** — pojedynczy globalny
nasłuchiwacz `router.refresh()` na zdarzeniach powrotu do aplikacji plus lekki polling, uzupełniony o
`staleTimes:{dynamic:0}` dla świeżej nawigacji w SPA. To pokrywa wszystkie trzy zgłoszone scenariusze
(inne urządzenie, druga karta, powrót do PWA na iPhonie bez przycisku odświeżania) przy minimalnym
koszcie i pełnej zgodności z Render free tier. `npm run build` (prisma generate + next build) przechodzi
bez błędów (TypeScript strict).
$omnia_impl$,
  'general',
  NULL,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("slug") DO NOTHING;
