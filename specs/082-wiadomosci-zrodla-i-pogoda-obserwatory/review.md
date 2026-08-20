# Recenzja: 082 — Wiadomości (odświeżanie, biblioteka źródeł, pasek tematów) + Pogoda (obserwatory wg stanu)

- **Spec:** ./spec.md · **Plan:** ./plan.md · **Weryfikacja:** ./verify.md
- **Data:** 2026-08-19
- **Zakres:** `git diff origin/develop..HEAD` — 31 plików, +4063 / −123 (z czego 471 linii to seed
  migracyjny, a 1092 to artefakty pipeline'u). Kod produkcyjny: ~1400 linii w 17 plikach.

## Ustalenia

Posortowane od najpoważniejszego. Trzy ustalenia, wszystkie **naniesione w trakcie recenzji** —
żadne nie wymagało zawracania do `/implement`.

### 1. `importCatalog` robił jedno zapytanie do bazy NA WPIS — `src/actions/adminNewsCatalog.ts:274` · correctness / efficiency · **NAPRAWIONE**

Pętla `for (const e of paczka.entries) { await prisma.newsSourceCatalog.createMany({ data: [e] }) }`
wykonywała po jednym `INSERT` na wpis.

**Scenariusz awarii:** administrator eksportuje katalog (419 wpisów — czynność, do której ten
przycisk stoi obok) i importuje go na innym środowisku. Na produkcji baza jest zdalna (Neon), więc
419 podróży po ~20–40 ms daje **8–17 sekund** w jednej akcji serwerowej. Akcja przekracza limit
czasu albo blokuje połączenie na kilkanaście sekund; użytkownik widzi błąd, mimo że część wpisów
już wjechała. To nie jest przypadek skrajny — **wejściem jest własny eksport tej samej funkcji**.

**Poprawka:** walidacja w pamięci → **jeden** `createMany` z `skipDuplicates`. Zmierzone na 419
wpisach: **50 ms** zamiast 419 podróży. Przy okazji doszło odsianie powtórzonego klucza w obrębie
pliku — `ON CONFLICT` co prawda je przełyka (sprawdzone: dwa wiersze o tym samym kluczu w jednej
partii → wstawiony 1), ale wtedy licznik „pominiętych" nie mówiłby, dlaczego. Dziennik audytu
rozróżnia teraz „już był" od „odrzucony przy walidacji" — to dwa różne komunikaty dla administratora.

### 2. Opis `fetchPool` przykleił się do nowej funkcji — `src/modules/news/jobs/newsRefresh.ts:103` · convention · **NAPRAWIONE**

`wierszePuli` została wstawiona **pomiędzy** blok JSDoc `fetchPool` a jej deklarację, więc opis
„Pobiera każde włączone źródło **dokładnie raz**…" dokumentował odtąd funkcję, która nic nie pobiera.

**Skutek:** podpowiedź edytora przy `wierszePuli` kłamie, a `fetchPool` — funkcja, wokół której
kręci się cały ten feature — zostaje bez opisu. Dokumentacja, która myli, jest gorsza niż jej brak;
to ta sama klasa błędu co komentarz o `[ownerId, sourceId, url]` naprawiony w T-1.

**Poprawka:** opis wrócił nad `fetchPool`. Poprawione też wskazanie pliku testu w komentarzu
(`newsRefresh.test.ts` → `wierszePuli.test.ts`).

### 3. Obserwacja, nie usterka tego feature'a: `ownership.test.ts` wymaga `DATABASE_URL`

Uruchomienie `npm run test:unit` **bez** zmiennych środowiskowych daje 1 fail
(`src/lib/__tests__/ownership.test.ts`, oczekiwane `Not found` vs
`PrismaClientInitializationError` z `platform/sharing/cache.ts:124`). Z lokalnym Postgresem —
**1142/1142 przechodzi**.

Stan **zastany, nie regresja**: mój diff nie dotyka ani tego testu, ani `platform/sharing/cache.ts`,
ani `workspaceMember` (`git diff --stat` na tych ścieżkach = 0 plików). Test pochodzi z 078.
Odnotowane, bo następna osoba trafi na to samo i powinna wiedzieć, że to konfiguracja środowiska,
a nie kod. Poprawka nie należy do zakresu 082 (C-53).

## Czego szukałem i nie znalazłem

| Obszar | Wynik |
|--------|-------|
| **Guardy dostępu (C-21)** | Każda z 12 nowych akcji ma guard **w ciele**, nie tylko w deklaracji — `requireAuth()` po stronie użytkownika, `requireAdmin()` we wszystkich ośmiu akcjach administratora. Potwierdza `check:ai-coverage` (kontrola dostępu sprawdza kod, nie manifest). Trasa `/admin/zrodla-rss` ma osobny `redirect("/")` — sam redirect chroniłby widok, nie dane, dlatego oba |
| **`revalidatePath` (C-20)** | Obecne w każdej mutacji; akcje administratora odświeżają **obie** trasy (`/admin/zrodla-rss` i `/wiadomosci`), bo zmiana w katalogu zmienia to, co widzi użytkownik |
| **Migracja ↔ `schema.prisma`** | `check:schema-drift` zielony; DDL wyłącznie dokładający, `grep -E '^(DROP\|ALTER TABLE .* DROP)'` = 0 |
| **Cudzysłowy w seedzie SQL** | Sprawdzone na realnych przypadkach: `Tom''s Hardware`, `L''Équipe`, `Spider''s Web` — wszystkie trzy wczytane do bazy poprawnie |
| **Enumy Prismy (C-12)** | Brak — `category`, `checkStatus`, `watchersLayout` to `String` + union TS |
| **Zaszyte kolory (C-30)** | Brak hexów w nowym UI; kolory stanu z `STATUS_STYLE` (zmienne CSS), na kolorowych tłach `--on-accent` |
| **Wariant mobilny (C-31)** | `TopicPicker` bez ani jednego `hidden md:*` — jeden mechanizm na obu ekranach; cele dotyku `py-3`; `overscroll-behavior-x: contain` blokuje gest „wstecz" na końcu paska |
| **Teksty (C-32)** | Wszystkie nowe przez `t()`; `check:i18n` zielony |
| **`window.confirm` (C-34)** | Brak — usunięcie wpisu przez `useConfirm()`, z komunikatem mówiącym wprost, czego usunięcie **nie** robi |
| **XSS** | Brak `dangerouslySetInnerHTML` w nowym kodzie; dane katalogu renderowane jako tekst |
| **Wyciek kluczy (C-41)** | Feature nie dotyka sekretów |
| **Pętla odświeżania w `useEffect`** | Sprawdzone: `showToast` jest `useCallback`, więc `load` w `NewsSourceCatalogManager` jest stabilne — efekt nie zapętla zapytań. `SourceCatalogPicker` ma `load` z pustą listą zależności |
| **`AIAction` bez egzekutora (C-23)** | Zero nowych akcji asystenta; `check:actions` zielony |
| **Martwy kod / duplikacja (C-53)** | Karta obserwatora **wydzielona**, nie skopiowana — dwie ścieżki renderowania (płaska i sekcje) mają jedno źródło. Zero nowych zależności |

## Bramki po poprawkach

`tsc --noEmit` ✅ · `check:owner-columns` ✅ (2345 wywołań + 5 prób mutacyjnych) ·
`check:ai-coverage` ✅ · `check:domain` ✅ (zapadka trzyma na 34) · `check:pagination` ✅ ·
`check:i18n` ✅ · `check:logs` ✅ · `npm run test:unit` ✅ **1142/1142** ·
`next build` ✅ „Compiled successfully" · `check:perf-budget` ✅ w paśmie ±5%.

## Werdykt

**APPROVE Z UWAGAMI.**

Trzy ustalenia, dwa naprawione w recenzji (jedno realne — import robiący 419 zapytań zamiast
jednego), trzecie to stan zastany spoza zakresu feature'a. Kod jest zgodny z konwencjami Omnii,
guardy są na miejscu, migracje wyłącznie dokładające, a decyzje odbiegające od otoczenia
(katalog bez przestrzeni, `workspaceId` bez `dbgenerated()`) mają uzasadnienie zapisane w kodzie,
a nie tylko w artefaktach.

Uwaga przeniesiona z weryfikacji, bo nie zmienia werdyktu, ale musi być widoczna po wdrożeniu:
**żywotność 419 adresów w katalogu jest niezweryfikowana** — piaskownica odbija ruch wychodzący
(403 na `CONNECT`), więc `fetchRss` zwracał zero dla każdego adresu, także dla BBC i Hacker News.
To było świadome ryzyko wyboru właściciela („400+, maksymalnie szeroko"), wypisane w specu §9.
Pierwszą czynnością po wdrożeniu warto zrobić przegląd katalogu przyciskiem „Sprawdź"
w `/admin/zrodla-rss`. Martwy wpis jest odwracalny jednym kliknięciem, a odświeżanie u użytkownika
liczy próg per źródło, więc pojedynczy niedziałający kanał nie psuje przebiegu pozostałym.

## Domknięcie — co poszło na środowiska

| Gałąź | Commit | Środowisko | Stan |
|-------|--------|-----------|------|
| `develop` | `0c39920` | `worldofmag.onrender.com` (test, free tier) | ✅ wypchnięte |
| `master` | `0c39920` | `omnia-prod.onrender.com` (produkcja, paid tier) | ✅ wypchnięte, **fast-forward** |

Kontrola integralności (C-52) przeszła w obie strony: przed promocją `origin/master` był przodkiem
`develop`, po promocji `origin/master` jest przodkiem `origin/develop`. Na produkcji stoi **dokładnie
ten commit**, który przeszedł testy na `develop` — bit w bit, bez commita scalającego, którego nikt
nie testował (C-52a).

**Znacznik wydania nie trafił na zdalne repozytorium.** Tag `prod-082-wiadomosci-zrodla-i-pogoda-obserwatory`
powstał lokalnie, ale `git push origin <tag>` odbija się trwałym `HTTP 403` (trzy próby z narastającą
zwłoką). Push **gałęzi** z tej samej sesji działa bez zarzutu, więc to nie jest kwestia dostępu do
repozytorium, tylko zakresu uprawnień nadanego tej sesji: wolno jej pisać po gałęziach, nie po tagach.
Potwierdza to `git ls-remote --tags origin` — zdalnie nie ma **ani jednego** tagu `prod-*`, także dla
wcześniejszych wydań, więc ograniczenie jest starsze niż ten przebieg.

To **nie jest** przypadek awaryjny z C-52: ten dotyczy nieudanej kontroli integralności albo odbitego
pushu do `master`, a oba przeszły i produkcja jest zaktualizowana. Tag jest znacznikiem wydania, nie
samym wydaniem. Do dołożenia jednym poleceniem z maszyny właściciela:

```bash
git fetch origin master
git tag -a prod-082-wiadomosci-zrodla-i-pogoda-obserwatory 0c39920 \
  -m "082: Wiadomości — naprawa odświeżania, biblioteka źródeł RSS (419 wpisów), pasek tematów; Pogoda — obserwatory wg stanu [produkcja]"
git push origin prod-082-wiadomosci-zrodla-i-pogoda-obserwatory
```

