# Zadania: YouTube — moduł „co warto obejrzeć", transkrypcje i streszczenia

- **Plan:** ./plan.md (102-youtube-transkrypcje)
- **Status:** todo
- **Data:** 2026-08-25

> **Kolejność.** Nowy moduł ma jedną pułapkę, której nie widać w kodzie: bramka rejestru sprawdza
> wpięcie **w obie strony**, a moduł niewpięty **buduje się na zielono** i po prostu nie istnieje
> w aplikacji. Dlatego szkielet rejestracji idzie **na początku** (faza 2), zanim powstanie
> jakikolwiek widok — lepiej złapać brak wpięcia jednym poleceniem niż po napisaniu całego UI.

## Legenda
- `[ ]` do zrobienia · `[x]` zrobione · `[~]` w trakcie · `[!]` zablokowane
- `[P]` — niezależne od poprzedniego, można zrównoleglić

## Faza 0 — Fundament danych
- [ ] **T-1** — `prisma/schema.prisma`: cztery modele (`YoutubeChannel`, `YoutubeVideo`,
      `YoutubeConnection`, `YoutubePref`) wg planu §2. Statusy jako `String` + union TS,
      **zero enumów** (C-12). Własność przez `workspaceId` (**nigdy `ownerId`** — `check:owner-columns`);
      wyjątkiem jest `YoutubeConnection`, kluczowana `userId`, bo zgoda należy do konta.
      **Gotowe, gdy:** `prisma generate` przechodzi.
- [ ] **T-2** — `prisma/migrations/0262_modul_youtube/migration.sql`: `CREATE TABLE` ×4, indeksy,
      klucze obce (`onDelete: Cascade` z kanału na filmy i z użytkownika na zgodę), **seed uprawnienia**
      `module.youtube` + nadanie roli `ADMIN` (wzorzec `0026_pets_module`, `ON CONFLICT DO NOTHING`),
      oraz `CREATE EXTENSION IF NOT EXISTS pg_trgm` + indeks GIN na transkrypcji.
      **Gotowe, gdy:** `./node_modules/.bin/prisma migrate deploy` przechodzi na lokalnej bazie
      i `npm run check:migrations` jest zielone.
- [ ] **T-3** — `src/lib/db/schema-drift-allowed.json`: wyjątek dla indeksu trigramowego
      (`schema.prisma` nie umie wyrazić GIN z operatorem trigramowym, więc `migrate diff` **zawsze**
      zaproponuje jego usunięcie). **Gotowe, gdy:** `npm run check:schema-drift` zielone.

## Faza 1 — Biblioteki pomocnicze modułu (czyste, bez sieci w testach)
- [ ] **T-4** — `src/modules/youtube/lib/kanal.ts`: rozwiązanie adresu na identyfikator kanału
      (`/channel/UC…`, `/@uchwyt`, `/c/nazwa`, `/user/nazwa`, samo `UC…`, samo `@uchwyt`).
      Dla postaci innej niż `UC…` — pobranie strony kanału i ekstrakcja identyfikatora.
      **Gotowe, gdy:** funkcja czysta w części parsującej (pobranie wstrzykiwane), testowalna bez sieci.
- [ ] **T-5** `[P]` — `src/modules/youtube/lib/filmy.ts`: lista filmów kanału z gotowego kanału RSS
      YouTube. **Reużyć `parseRss` z `@/lib/news/rss`** (plik żyje w `src/lib/`, więc import nie łamie
      granicy modułów) — nie pisać drugiego parsera (C-53). Identyfikator filmu z odnośnika `watch?v=`.
- [ ] **T-6** — `src/modules/youtube/lib/transkrypcja.ts`: dociągnięcie napisów wzorcem
      `src/lib/news/article.ts` (`resilientFetch`, własny User-Agent, ekstrakcja wyrażeniami).
      Wybór języka: polski → angielski → pierwszy dostępny. **Każde niepowodzenie na dowolnym kroku
      zwraca „brak", NIGDY nie rzuca** — brak transkrypcji jest normalnym stanem modułu (AC-8).
- [ ] **T-7** — Testy jednostkowe `src/modules/youtube/lib/__tests__/`: ekstrakcja identyfikatora
      kanału, wybór ścieżki napisów, składanie tekstu — **na zapisanych próbkach, nie na żywym
      YouTubie**. Test zależny od sieci w piaskownicy nie przechodzi, a w CI byłby migotliwy.
      **Gotowe, gdy:** `node --import tsx --test` zielone.

## Faza 2 — Rejestracja modułu i trasy (WCZEŚNIE — patrz uwaga na górze)
- [ ] **T-8** — `src/modules/youtube/module.ts` (`defineModule`) + `module.server.ts`
      (leniwe `ai`/`jobs` — **osobny plik**, bo `module.ts` trafia do `MODULES`, a to importuje
      komponent kliencki) + `contract.ts` (**tylko** `getFilmy` i `odswiezYoutube`).
- [ ] **T-9** — Wpięcie w **oba** korzenie kompozycji: `src/lib/modules.tsx` (import + `DECLARED`
      + kolejność menu) i `src/lib/modules.server.ts` (`MODULE_SERVER`).
      **Gotowe, gdy:** `npm run check:module-registry` zielone (sprawdza wpięcie w obie strony).
- [ ] **T-10** — Trasy: `src/app/youtube/layout.tsx` z **bramką uprawnienia**
      (`wymagajDostepuDoModulu` z `@/lib/gatingTrasy`) — **w layoucie, nie w stronie**, bo layout
      obejmuje podtrasy — plus `page.tsx`, `[videoId]/page.tsx`, `kanaly/page.tsx` jako cienkie
      trasy serwerowe. Wpis `"youtube"` w `src/lib/ui/view-contract.json`.
      **Gotowe, gdy:** `npm run check:route-gating` i `npm run check:ui-contract` zielone.

## Faza 3 — Warstwa serwera
- [ ] **T-11** — `src/modules/youtube/actions/kanaly.ts`: `dodajKanal`, `usunKanal` (**przez kosz**,
      C-24), `getKanaly`. Zapis `wlasnoscOsobistaDoZapisu`, odczyt `filtrMoichRekordow` (wariant
      **wąski** — moduł jest osobisty; szerszy poszerzyłby dostęp). `revalidatePath` na końcu każdej
      mutacji. Każdy `findMany` z `take: SUFIT_LISTY` albo kursorem (`check:pagination`).
- [ ] **T-12** — `src/modules/youtube/actions/filmy.ts`: `getFilmy` (filtr stanu, sortowanie
      **po stronie bazy**, szukanie, kursor), `getFilm`, `ustawStan`, `odswiezYoutube`, `getYoutubeStan`.
- [ ] **T-13** — Zgoda Google: `src/lib/youtube/oauth.ts` + trasy `src/app/api/youtube/{connect,callback}`
      + akcje `polaczYoutube`/`rozlaczYoutube`/`importujSubskrypcje`. Wzorzec `src/lib/drive/oauth.ts`.
      **`rozlaczYoutube` kasuje wyłącznie zgodę — kanały zostają** (AC-4 wprost tego wymaga).
      Import idempotentny dzięki `@@unique([workspaceId, channelId])`.
- [ ] **T-14** — `npm run check:ai-coverage` / `check:access`: każda nowa akcja ma klasyfikację
      ekspozycji AI **oraz** deklarację `access` z **realnym wywołaniem guardu** (wszystkie `owner`).

## Faza 4 — Zadanie w tle
- [ ] **T-15** — `src/modules/youtube/jobs/youtubeRefresh.ts` + `index.ts`: trzy etapy z `ctx.progress`
      (kanały → transkrypcje z **limitem na przebieg** → ocena „czy warto" partiami z `buildUserContext`).
      Etapy 2 i 3 są **dodatkowe**: ich awaria nie może wywrócić przebiegu, w którym filmy są już
      zapisane (wzorzec `etapGoracychTematow`). Odsetek udanych pobrań transkrypcji przez `logEvent`
      (`check:logs` — nigdy `console.*`) — bez tej liczby decyzja o dołożeniu przeglądarki byłaby zgadywaniem.
- [ ] **T-16** — `src/modules/youtube/retention.ts` + wpięcie w `src/lib/retention/polityki.ts`:
      retencja transkrypcji i filmów odrzuconych.

## Faza 5 — AI
- [ ] **T-17** — `src/modules/youtube/actions/ai.ts`: `streszczenie` (przez `rememberedContent`,
      trzy długości, `inputHash` z transkrypcji + `userContextStamp`), `zapytajOFilm` (odpowiedź
      **wyłącznie z transkrypcji**, z wymogiem przyznania „nie ma tego w transkrypcji"),
      `szukajWTranskrypcjach`.
- [ ] **T-18** — `src/modules/youtube/ai/{index,catalog,executor,readTools}.ts`: trzy akcje
      (`add_youtube_channel`, `refresh_youtube`, `mark_youtube_watched`) + dwa narzędzia odczytu.
      Egzekutory w `/api/llm/home/execute` i wpisy w `src/lib/ai/actionContract.ts`.
      **Gotowe, gdy:** `npm run check:actions` zielone.
- [ ] **T-19** — Bramki pokrycia AI: wpisy w `content-memory-coverage.json`
      (`actions/ai.ts` → `remembered`, zadanie → `on-demand`) i `cost-badge-coverage.json`
      (albo przekazanie zużycia + `AiCostBadge` z **wymaganym** propem `akcja`).
      **Gotowe, gdy:** `check:content-memory` i `check:cost-badge` zielone.

## Faza 6 — UI
- [ ] **T-20** — Lista filmów (`ui/YoutubePage.tsx`): `ModuleView` **z propem `state`**, filtr stanu,
      sortowanie (data ⇄ czy warto), szukanie, akcja „Odśwież" z postępem, slot `settings`.
- [ ] **T-21** — Szczegół filmu (`ui/FilmSzczegol.tsx`): metadane + odnośnik do YouTube, transkrypcja
      albo **etykieta „brak transkrypcji"** (nie wygląda na błąd aplikacji), streszczenie w trzech
      długościach z `AiContentMeta`, pytania do filmu.
- [ ] **T-22** — Kanały (`ui/KanalyPage.tsx`): dodawanie ręczne, połączenie/rozłączenie konta, import
      subskrypcji. **Bez zgody moduł działa normalnie i nigdzie nie blokuje pracy pytaniem o nią** (AC-2).
      Usuwanie przez `confirmDialog({ destructive: true })` (C-34).
- [ ] **T-23** `[P]` — Wariant mobilny (C-31, AC-17): brak drugiego paska bocznego, cele dotyku `py-3`,
      transkrypcja we własnym kontenerze przewijania, stopki okien z `env(safe-area-inset-bottom)`.
      Kolory **wyłącznie** ze zmiennych CSS, na kolorowych przyciskach `var(--on-accent)` (C-30).

## Faza 7 — Teksty i bramki
- [ ] **T-24** — `messages/pl.json`: **wszystkie** teksty modułu pod `modules.youtube.*`, czytane
      przez `useTranslations`. **Zero literałów z polskimi znakami w komponentach** — od 097 to
      reguła bezwzględna, nie zapadka. **Gotowe, gdy:** `npm run check:i18n` zielone.
- [ ] **T-25** — **Pełny** `npm run build` na lokalnym Postgresie (C-13) — nie pojedyncze bramki
      (lekcja z `doświadczenia.md` 2026-08-25). **Gotowe, gdy:** cały łańcuch zielony.
- [ ] **T-26** — Klikacze: `nohup bash scripts/e2e-web.sh > /tmp/e2e102.log 2>&1 &`.
      **Gotowe, gdy:** wynik nie gorszy niż baseline sprzed zmiany (regresje przypisane tej zmianie = zero).
- [ ] **T-27** — Wpis do `doświadczenia.md` (C-51) + mapowanie AC → dowód (wsad do `/verify`).

## Mapowanie kryteriów akceptacji → zadania

| AC | Czego dotyczy | Zadania |
|----|---------------|---------|
| AC-1 | dodanie kanału po adresie | T-4, T-11, T-22 |
| AC-2 | moduł działa **bez** zgody Google | T-13, T-22 |
| AC-3 | import subskrypcji bez duplikatów | T-2 (`@@unique`), T-13 |
| AC-4 | rozłączenie zostawia kanały | T-13 |
| AC-5 | odświeżenie z postępem | T-12, T-15, T-20 |
| AC-6 | metadane + odnośnik | T-5, T-21 |
| AC-7 | oryginalna transkrypcja | T-6, T-21 |
| AC-8 | brak transkrypcji = etykieta, nie błąd | T-6, T-15, T-21 |
| AC-9 | trzy długości, bez ponownego generowania | T-17, T-21 |
| AC-10 | moment powstania + świadome przeliczenie | T-17, T-21 |
| AC-11 | ocena „czy warto" + sortowanie | T-1 (kolumna), T-12, T-15, T-20 |
| AC-12 | uzasadnienie z wiedzy o użytkowniku | T-15 |
| AC-13 | pytania do filmu bez zmyślania | T-17, T-21 |
| AC-14 | szukanie po transkrypcjach | T-2 (indeks), T-17, T-20 |
| AC-15 | rozdział danych między użytkownikami | T-11, T-12 |
| AC-16 | bramka trasy | T-10 |
| AC-17 | wariant mobilny | T-23, T-26 |
| AC-18 | usunięcie kanału przez kosz | T-11, T-22 |

## Ścieżka krytyczna

`T-1 → T-2 → T-3` (schemat przed wszystkim; bez tabel nie ma czego czytać).
`T-8 → T-9 → T-10` — **szkielet rejestracji wcześnie**; `T-9` blokuje sensowną weryfikację
czegokolwiek dalej, bo moduł niewpięty nie istnieje w aplikacji.
`T-4/T-5/T-6 → T-7` (funkcje przed testami), `T-6 → T-15` (transkrypcja przed zadaniem).
`T-11/T-12 → T-20/T-21/T-22` (akcje przed widokami).
`T-17 → T-21` (streszczenia przed ekranem, który je pokazuje).
`T-24` po całym UI (nie ma czego wyciągać wcześniej). `T-25` po wszystkim, `T-26` po `T-25`.

## Notatki / blokady
- Świadomie **bez** `dashboard.ts` — żadne AC nie wymaga wkładu na pulpit, a każdy wkład to kolejne
  wpięcie do utrzymania (C-53).
- Sieć w piaskownicy jest odcięta, więc **realne pobranie z YouTube nie zostanie sprawdzone w tym
  środowisku**. Testy idą na zapisanych próbkach; fakt ten musi trafić do `verify.md` jako
  ograniczenie, a nie zostać przemilczany.
