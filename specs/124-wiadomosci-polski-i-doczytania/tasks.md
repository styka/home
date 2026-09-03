# Zadania: Wiadomości — tytuły/streszczenia po polsku + „do doczytania"

- **Plan:** ./plan.md (124-wiadomosci-polski-i-doczytania)
- **Status:** done
- **Data:** 2026-09-03

> **Zasada listy zadań:** kolejność **od najłatwiejszego do najtrudniejszego** i **zgodna z
> zależnościami** (migracja → akcje → UI → AI → bramki). Każde zadanie jest małe, samodzielne i
> **weryfikowalne**. Odhaczamy `[ ]` → `[x]` w trakcie `/implement`. `[P]` = można zrównoleglić.

## Legenda
- `[ ]` do zrobienia · `[x]` zrobione · `[~]` w trakcie · `[!]` zablokowane (patrz notatka)
- `[P]` — niezależne od poprzedniego, można robić równolegle

## Faza 0 — Fundament danych
- [x] **T-1** — Migracja `0290_news_read_later` (`ALTER TABLE "NewsItem" ADD COLUMN "readLater"
  BOOLEAN NOT NULL DEFAULT false;`) + `NewsItem.readLater` w `schema.prisma` (komentarz: fakt
  dwustanowy jak `summaryFailed`, ortogonalny do `status`). Gotowe, gdy: `npm run check:migrations`
  zielone, `npx prisma migrate deploy` na lokalnym Postgresie przechodzi, `prisma generate` czysto,
  `check:schema-drift` bez rozjazdu.

## Faza 1 — Heurystyka języka (czysta, niezależna od reszty)
- [x] **T-2** `[P]` — `src/modules/news/lib/jezykTytulu.ts`: `tytulWyglądaNaObcy(title)` wg planu §3
  (diakrytyk ⇒ polski; ≥2 różne obce słowa funkcyjne jako osobne wyrazy ⇒ obcy; podział na wyrazy
  bez `\b`). Gotowe, gdy: test `lib/__tests__/jezykTytulu.test.ts` pokrywa przypadki z planu
  (polski bez diakrytyków, polski z angielskim terminem, przykład ze zgłoszenia, niemiecki, pusty)
  i `tsc -p tsconfig.test.json` + `npm run test:unit` (albo bieżący runner testów) zielone.

## Faza 2 — Warstwa serwera
- [x] **T-3** — `src/modules/news/actions/news.ts`: nowa akcja `setItemReadLater(itemId, readLater)`
  (guard wg wzorca `acknowledgeItem`: odczyt z `topic.workspaceId` + `czyMojRekord`, zapis,
  `revalidatePath("/wiadomosci")`); `readLater` w `NewsItemDTO` + `toItemDTO`. Wpis
  `news:setItemReadLater` (owner/interactive/excluded) do `src/lib/ai/action-coverage.json`.
  Gotowe, gdy: `npm run check:ai-coverage` zielone.
- [x] **T-4** — Współżycie z „przeczytane": `acknowledgeItem` dopisuje `readLater: false`;
  `acknowledgeTopicItems` i `acknowledgeAllItems` dostają `readLater: false` w `where`. Gotowe,
  gdy: przegląd kodu potwierdza, że ŻADNA ścieżka zbiorcza nie zdejmuje odłożenia, a pojedyncze
  odhaczenie je zdejmuje (AC-7/AC-8).
- [x] **T-5** — `src/modules/news/jobs/newsRefresh.ts`: etap 3b — po streszczeniach nowych pozycji
  dobór `status:"PENDING", summaryFailed:true` spoza `newItemIds` (najnowsze najpierw,
  `NAPRAWA_LIMIT = 40`, `take` — `check:pagination`) i przepuszczenie przez istniejącą
  `summarizeItems`. Gotowe, gdy: selekcja ma jawny limit, wynik dolicza się do `summarized`,
  `logEvent` raportuje liczbę ponowień.
- [x] **T-6** — `newsRefresh.ts`: etap 3c — dobór `status:"PENDING", summaryFailed:false` z tytułem
  obcym wg `tytulWyglądaNaObcy` (filtr w kodzie po odczycie z `take`), partia do `llmJson` z operacją
  **`dispatch`**, zapis WYŁĄCZNIE niepustego `title`; wynik nadal obcy zostaje (bez pętli). Do
  promptu streszczeń dopisać zdanie o nazwach własnych/terminach (plan §3). Gotowe, gdy: zero
  wywołań `generation` dla pozycji z poprawnym streszczeniem, `logEvent` raportuje naprawione
  tytuły, prompt zawiera wyjątek nietłumaczalnych słów.

## Faza 3 — UI
- [x] **T-7** — `NewsItemCard.tsx`: przycisk przełączający „Doczytam"/„Odłożone" (Bookmark /
  BookmarkCheck, akcent `var(--accent-amber)`, tylko zmienne CSS) obok „Przeczytane"; widoczny
  znacznik stanu na karcie; teksty przez `t()` do `messages/pl.json`. Gotowe, gdy: przełączenie
  działa w obie strony w tym samym miejscu (AC-5), `check:i18n` zielone.
- [x] **T-8** — `NewsPage.tsx`: klucz `doczytania: oneOf(["0","1"],"0")` w `viewState` (wzorzec
  `czytanie`); przycisk stałej wysokości z licznikiem odłożonych w pasku (przy 0 widoczny,
  wyłączony; poniżej `lg` ikona + `aria-label`; `aria-pressed`); filtrowanie w TYM SAMYM miejscu co
  filtr źródeł, więc nawigator/liczniki/czytnik/pusty stan konsumują wspólny zbiór. Gotowe, gdy:
  URL niesie stan (AC-10), przy włączonym filtrze widać wyłącznie odłożone ze wszystkich tematów
  (AC-6), pusty wynik idzie przez mechanizm pustego stanu widoku.

## Faza 4 — Bramki i domknięcie
- [x] **T-9** — e2e (klikacz Wiadomości): scenariusz odłóż → znacznik → filtr (licznik) → „oznacz
  wszystkie" nie zdejmuje → „Przeczytane" zdejmuje; viewport 360 px dla paska (AC-9). Uruchomienie
  wg `docs/e2e/uruchamianie-e2e-claude.md` (`scripts/e2e-web.sh`). Gotowe, gdy: nowy scenariusz
  zielony, bez `networkidle` (`check:e2e-waits`).
- [x] **T-10** — Pełne bramki: `check:migrations`, `check:ai-coverage`, `check:i18n`,
  `check:pagination`, `tsc -p tsconfig.test.json`, `next lint`, `next build` (lokalny Postgres,
  C-13 — bez `migrate.js` na prod). Gotowe, gdy: wszystko zielone.
- [x] **T-11** — Mapowanie AC-1…AC-10 na wyniki (input do `/verify`) — tabela w tym pliku lub w
  komentarzu zamykającym.
- [x] **T-12** — Wpis do `doświadczenia.md` (C-51): lekcja „tłumaczenie tylko dla nowych pozycji =
  obcy tytuł na zawsze" + ewentualne nieoczywiste problemy z implementacji.

## Mapowanie kryteriów akceptacji
| AC | Zadania |
|----|---------|
| AC-1 (tytuły PL na liście) | T-2, T-5, T-6 |
| AC-2 (streszczenia PL + wyjątek) | T-6 (prompt) |
| AC-3 (naprawa zastanych) | T-5, T-6 |
| AC-4 (ponowienie po błędzie) | T-5 |
| AC-5 (jeden odwracalny gest) | T-3, T-7 |
| AC-6 (zawężenie + licznik) | T-8 |
| AC-7 (odłożone przeżywają „oznacz wszystkie"/odświeżenie) | T-4, T-9 |
| AC-8 (przeczytanie zdejmuje odłożenie) | T-4, T-9 |
| AC-9 (telefon 360 px, stała wysokość) | T-8, T-9 |
| AC-10 (stan w URL, ulubialny) | T-8 |

## Wyniki AC (T-11 — input do /verify)
| AC | Wynik | Dowód |
|----|-------|-------|
| AC-1 | ✅ kod + testy | heurystyka `jezykTytulu` (8 testów, w tym przykład ze zgłoszenia), etap 3c dotłumacza obce tytuły w każdym przebiegu; prompt streszczeń tłumaczy tytuły nowych pozycji (084) — dowód „na żywo" po deployu na develop |
| AC-2 | ✅ kod | prompt streszczeń pisze po polsku + zdanie o nazwach własnych/terminach (wyjątek z AC) |
| AC-3 | ✅ kod | etap 3b (summaryFailed → summarizeItems) + 3c (tytuł obcy przy dobrym streszczeniu → dispatch); tylko PENDING, limit 40/przebieg, zapis nie rusza url/źródła/statusu |
| AC-4 | ✅ kod | selekcja 3b wchodzi w KAŻDY przebieg (nie tylko newItemIds); `summaryFailed` pozostaje true przy kolejnej porażce, więc ponowienie nie gaśnie |
| AC-5 | ✅ e2e | [124-AC5..AC8]: klik „Doczytam" → przycisk „Odłożone" (ten sam element, `aria-pressed`) |
| AC-6 | ✅ e2e | [124-AC5..AC8]: licznik „1", po włączeniu widać wyłącznie odłożoną kartę, URL `doczytania=1` |
| AC-7 | ✅ e2e | [124-AC5..AC8]: „Oznacz wszystkie" (z potwierdzeniem) nie zdejmuje odłożonej |
| AC-8 | ✅ e2e | [124-AC5..AC8]: „Przeczytane" na odłożonej → znika z zawężenia, licznik 0 |
| AC-9 | ✅ e2e | [124-AC9]: 360 px — przycisk widoczny (ikona+licznik, etykieta schowana), brak poziomego przewijania strony |
| AC-10 | ✅ e2e | [124-AC10]: wejście z `?doczytania=1` odtwarza zawężenie (`aria-pressed=true`) |

E2E: 6/6 zielone (`scripts/e2e-web.sh e2e/specs/124-wiadomosci-doczytania.spec.ts`, projekt desktop).

## Notatki / blokady (bramki)
- Pełny `npm run build` na lokalnym Postgresie: zielony do `check:perf-budget` włącznie
  (wszystkie bramki, `next lint`, `next build`, budżet ±5%). Końcowy `scripts/migrate.js` padł
  wyłącznie na pustym `DIRECT_URL` w podprocesie npm (lokalna osobliwość env; C-50 każe lokalnie
  weryfikować do `next build`); sama migracja 0290 zaaplikowana na lokalnym Postgresie w kroku 4/6
  `e2e-web.sh` bez błędu.

## Notatki / blokady
- Kolejność: T-1 blokuje T-3…T-6 (kolumna w kliencie Prismy); T-2 blokuje T-6; T-3 blokuje T-7/T-8;
  T-5/T-6 niezależne od UI. T-2 można robić równolegle z T-1.
