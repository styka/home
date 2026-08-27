# Plan techniczny: Nawigacja Strony głównej i podział widoku Ustawień

- **Spec:** ./spec.md (109-nawigacja-strony-glownej-i-ustawienia)
- **Status:** draft
- **Data:** 2026-08-27

## 1. Podejście

Dwie niezależne zmiany w warstwie widoku, **zero zmian w schemacie bazy i zero nowych akcji
serwera**. (1) W panelu bocznym „Strona główna" wraca jako **osobny, nazwany wiersz bezpośrednio
pod nazwą aplikacji**, a dwa dotychczasowe wejścia na `/` (odnośnik z nazwy aplikacji, ikona domu
w rzędzie ikon konta) znikają. (2) `/settings` rozpada się na **spis sekcji** (trasa `/settings`)
i **jedną trasę parametryczną** `/settings/[sekcja]`, gdzie każda sekcja jest osobnym serwerowym
komponentem pobierającym **wyłącznie swoje** dane.

Wzorcem do naśladowania jest moduł **Usługi** (`src/modules/services/ui/`): ma dokładnie ten sam
kształt — lista + trasy szczegółowe, `ModuleView` z `breadcrumb` prowadzącym do widoku nadrzędnego,
`layout="fill"` tam, gdzie panel i treść przewijają się osobno. Kopiujemy ten wzorzec zamiast
wymyślać nowy (C-53).

## 2. Model danych (Prisma)

**Bez zmian w schemacie.** Feature nie dodaje ani nie zmienia żadnego modelu, kolumny czy indeksu,
więc **nie powstaje żadna migracja** (C-10 nie ma czego dotyczyć, `npm run next:migration` nie jest
wołane). Wszystkie ustawienia zapisują się dziś istniejącymi akcjami i tak zostaje.

Konsekwencja dla wycofania: rollback tej zmiany to wyłącznie rollback kodu — nie ma stanu bazy,
który trzeba by cofać.

## 3. Warstwa serwera (Server Actions — C-20)

**Bez nowych Server Actions.** Sekcje wołają dokładnie te akcje, które woła dziś jedna długa strona:
`getMyTeams`, `getRecentActivity`, `getMenuPrefs`, `getFavoriteViews`, `listAvailableSkins`,
`getActiveSkinId`, `getDriveStatus`, `getWorkspaceLocaleSettings`, `getActivePlan`, `getMyAiUsage`.
Zmienia się **miejsce** wywołania, nie wywołanie.

Jedyna istniejąca mutacja na tej stronie — `signOut` w formularzu `"use server"` — wędruje razem
z blokiem profilu do sekcji `konto`. `revalidatePath` nie dochodzi nigdzie nowe, bo nie dokładamy
mutacji (C-20 spełnione przez brak zmian).

**Rozdział zapytań (AC-12).** Dziś `src/app/settings/page.tsx` awaituje **dziesięć** wywołań, zanim
wyrenderuje cokolwiek. Po zmianie każda sekcja jest **własnym asynchronicznym komponentem
serwerowym** i awaituje tylko swoje: wejście w „Wygląd" nie czeka na `getRecentActivity(30)`.

**Kontrola dostępu (C-21/C-22).** Ani jedno zapytanie nie zmienia zakresu: te same akcje, te same
guardy własności co dziś. Rozbicie widoku **nie jest** okazją do poszerzenia czyjegokolwiek
dostępu.

## 4. RBAC / rejestr modułu (C-22)

- **Bez nowego sluga.** Ustawienia trzymają dotychczasowe `module.settings`
  (`legacyPermissionForPath` w `platform/auth/permissions.ts` mapuje `/settings`), a nowe adresy
  są jego **podścieżkami**, więc `permissionForPath("/settings/wyglad")` musi zwrócić to samo co
  `permissionForPath("/settings")` — **to jest do sprawdzenia w implementacji**, bo od tego zależy
  wygaszanie pozycji w menu i blokada trasy.
- **Sesja.** `src/middleware.ts` bramkuje wszystko poza wyliczoną listą publicznych ścieżek, więc
  nowe trasy są chronione sesją z automatu. Dodatkowo obie trasy (`/settings`, `/settings/[sekcja]`)
  wołają `auth()` i przy braku sesji przekierowują — tak jak robi to dziś strona. **Nie polegamy
  wyłącznie na middleware**: to jedna warstwa, a rozbicie jednej strony na dwie trasy mnoży miejsca
  do obronienia (ryzyko wypisane w specu).
- **Bramka `check:route-gating`** chodzi wyłącznie po `src/modules/*`, więc Ustawień nie dotyczy —
  co jest kolejnym powodem, żeby kontrolę postawić jawnie w kodzie trasy.
- **Rejestr modułów bez zmian.** „Strona główna" **jest już** w rejestrze (`src/modules/home/module.ts`)
  i pozostaje odfiltrowana z listy menu przez `resolveMenu` — czyli **nie wraca** ani do kolejności
  menu, ani do „Więcej…", ani do ekranu zarządzania menu, ani do dolnego paska. Panel boczny
  rysuje ją jako **osobny, stały wiersz** czytany z rejestru przez nową funkcję
  `modulStronyGlownej()` w `src/lib/modules.tsx`. **Żadnej nowej równoległej listy modułów** (C-36).

## 5. UI (C-30, C-31, C-32, C-33)

### 5.1 Panel boczny — jedno nazwane wejście na Stronę główną

Docelowa kolejność w `ModuleSidebar` (komputer, `hidden md:flex`):

```
[ logo + nazwa aplikacji ]            ← NIE jest już odnośnikiem (AC-2)
[ 🏠 Strona główna            ]       ← nowy, pełny wiersz nawigacji (AC-1)
[ ★  ⌨  ]                             ← rząd ikon konta: gwiazdka + skróty (bez ikony domu)
[ moduły… ]
[ Zaproszenia / Ustawienia / Admin ]
```

Trzy zmiany w `src/components/shell/ModuleSidebar.tsx`:

1. **Nazwa aplikacji przestaje być `<Link>`** — zostaje `<div>` z `BrandLogo` + `AppName`. Ikony po
   prawej (tryb admina, dzwonek, czat) bez zmian.
2. **Nowy wiersz „Strona główna"** renderowany istniejącym `NavItem` (ikona + etykieta + stan
   aktywny + wariant `locked`), z `exact`, `href`, `label`, `color` **czytanymi z deklaracji
   modułu**, oraz `locked={isPathLocked(userPermissions, "/")}` → AC-6.
3. **Ikona domu znika z rzędu ikon konta** — w rzędzie zostają gwiazdka i ściągawka skrótów.

**Dlaczego wiersz stoi NAD rzędem ikon, a nie jako pierwsza pozycja `<nav>`.** Zgłoszenie właściciela
jest dosłownie o kolejności: „dziwnie wygląda, że mamy ulubione, a dopiero niżej strona główna".
Gdyby „Strona główna" weszła do `<nav>`, wylądowałaby **pod** rzędem z gwiazdką — czyli dokładnie
w układzie, na który właściciel narzeka. Renderujemy ją więc jako **osobny blok między nazwą
aplikacji a rzędem ikon**. Efekt uboczny, który jest zamierzony: niezmieniony zostaje niezmiennik
z 086 („rząd ikon stoi nad nawigacją modułów"), bo `<nav>` dalej zaczyna się od pierwszego modułu.

**Dostępność (AC-3):** `NavItem` dostaje `aria-current={isActive ? "page" : undefined}`. To zmiana
w jednym miejscu, z której korzystają wszystkie pozycje menu — dziś stan aktywny jest wyłącznie
kolorem, więc czytnik ekranu go nie widzi.

**Telefon (AC-5):** **żadnych zmian**. Kotwica Strony głównej w dolnym pasku (103), wachlarz
nawigacji i mobilne menu w `AppShell` zostają nietknięte — `resolveMenu` dalej odfiltrowuje `home`,
więc w menu telefonu nic się nie dubluje.

### 5.2 Ustawienia — spis sekcji i trasa parametryczna

**Rejestr sekcji** — `src/lib/ustawienia/sekcje.tsx`, jedno źródło prawdy dla spisu, wyszukiwarki,
listy bocznej i walidacji parametru trasy (ryzyko „druga, rozjeżdżająca się lista" ze speca):

```ts
export type SekcjaUstawien = {
  id: string;              // segment adresu, ASCII bez diakrytyków
  Ikona: LucideIcon;
  kluczNazwy: string;      // klucz w messages/pl.json (nie literał — C-32)
  kluczOpisu: string;
  kluczHasel: string;      // dodatkowe słowa do wyszukiwarki, np. „skorka motyw kolory"
};
export const SEKCJE_USTAWIEN: SekcjaUstawien[] = [ … ];
export function znajdzSekcje(id: string): SekcjaUstawien | undefined
```

Dziesięć sekcji, w kolejności od najczęściej używanych (założenie ze speca):

| `id` | Nazwa | Co obejmuje (dzisiejsze sekcje) |
|------|-------|----------------------------------|
| `konto` | Konto | Profil + Wyloguj |
| `wyglad` | Wygląd | Skórka (`SkinPicker`) |
| `nawigacja` | Menu i nawigacja | Menu (`MenuPrefsEditor`) + Ulubione widoki (`FavoriteViewsEditor`) |
| `jezyk` | Język i strefa czasowa | `WorkspaceLocaleSection` (sekcja warunkowa) |
| `polaczenia` | Połączenia | Dysk Google (`DriveSettings`) + Kalendarz — subskrypcja (`IcalFeedCard`) |
| `asystent` | Asystent i AI | Twój plan + `AiUsageMeters` (warunkowo) + Wiedza o Tobie (`UserFactsSection`) |
| `zespoly` | Zespoły | Teamy + „Nowy zespół" |
| `pomoc` | Pomoc i przewodniki | Opis + odnośnik do `/guide` |
| `prywatnosc` | Prywatność i dane | `PrivacySettings` + odnośnik do `/legal` |
| `aktywnosc` | Aktywność | `ActivityFeed` |

Trzynaście dzisiejszych nagłówków → dziesięć sekcji; **nic nie ginie** (AC-10), scalone są tylko te,
które opisują to samo (menu + ulubione, Dysk + kalendarz, plan + wiedza o użytkowniku).

**Trasy:**

- `src/app/settings/page.tsx` (server) — **spis**: `ModuleView` (tytuł „Ustawienia", `state="ready"`)
  z komponentem `SpisUstawien` w wariancie kafelków. Na telefonie to cały ekran, na komputerze
  siatka kafelków. Nad spisem **pole szukania**.
- `src/app/settings/[sekcja]/page.tsx` (server) — waliduje segment przez `znajdzSekcje`, przy
  nieznanym woła `notFound()`; renderuje ramę sekcji z **listą boczną** (`hidden md:flex`, ten sam
  `SpisUstawien` w wariancie listy, z własnym polem szukania) i treścią sekcji. `breadcrumb` =
  odnośnik „Ustawienia" → `/settings` (AC-8: widoczny powrót; na komputerze daje okruszek
  „Ustawienia › Wygląd" razem z tytułem).
- `src/app/settings/team/*` — **bez zmian**; z nowego spisu prowadzi do nich sekcja `zespoly`.
  Ponieważ `team` jest segmentem statycznym, ma pierwszeństwo przed `[sekcja]`.

**Dlaczego jedna trasa parametryczna, a nie dziesięć katalogów** (C-53): dziesięć katalogów to
dziesięć plików `page.tsx` powtarzających tę samą ramę; parametr daje jedno miejsce na ramę,
jedno na walidację i jedno na `notFound`. Rozdział danych — który jest właściwym celem — daje
i tak nie trasa, lecz osobny komponent serwerowy per sekcja.

**Dlaczego nie `settings/layout.tsx`:** layout objąłby także `/settings/team/*`, które mają własny
nagłówek i okruszki — dostałyby podwójną ramę.

**Komponenty (nowe):**

- `src/components/settings/SpisUstawien.tsx` (klient) — jedno pole szukania + lista; prop
  `wariant: "kafelki" | "lista"`, prop `aktywna?: string`. Filtrowanie po nazwie, opisie i haśle
  dodatkowym, **po normalizacji diakrytyków** (`String.normalize("NFD").replace(/\p{Diacritic}/gu,"")`,
  bez nowej zależności) → AC-15. Brak trafień → stan pusty z wyjaśnieniem (AC-14).
- `src/components/settings/RamaSekcji.tsx` (klient) — `ModuleView` z `layout="fill"`, `breadcrumb`,
  tytułem i ikoną sekcji; w środku dwie kolumny (lista boczna + treść), każda z własnym
  przewijaniem. Na telefonie lista boczna jest ukryta (`hidden md:flex`) — **nigdy dwa panele
  naraz** (C-31).
- `src/components/settings/sekcje/*.tsx` — dziesięć **serwerowych** komponentów sekcji; treść
  przeniesiona 1:1 z dzisiejszej strony, bez zmian zachowania.

**Motyw i teksty:** cała nowa warstwa korzysta ze zmiennych CSS (`--bg-surface`, `--border`,
`--text-*`, `--accent-*`) — żadnych hexów (C-30, AC-17). Nowe teksty (nazwy i opisy sekcji, hasła
wyszukiwarki, etykieta pola, stan pusty, okruszek) idą do `messages/pl.json` pod
`components.settings.*` i `app.settings.*` (C-32, AC-19).

**Klucze dynamiczne a bramka i18n.** Nazwy sekcji czytamy przez `t(sekcja.kluczNazwy)` — bramka
`check:i18n` sprawdza wyłącznie wywołania z literałem, więc te jej umkną. Dlatego dokładamy **test
jednostkowy**, który dla każdej pozycji `SEKCJE_USTAWIEN` sprawdza obecność wszystkich trzech
kluczy w `messages/pl.json` (wzorzec istniejącego `platform/i18n/__tests__/komunikaty.test.ts`).
Bez tego martwy klucz wyszedłby dopiero na ekranie użytkownika.

**Obszar gestów (AC-18):** treść sekcji na telefonie kończy się wypełnieniem
`calc(16px + env(safe-area-inset-bottom))` — ramę widoku zamyka dolny pasek kciuka (C-31).

### 5.3 Kontrakt widoku (C-33, AC-16)

Wpis `settings` w `src/lib/ui/view-contract.json` zmienia się z `exempt` na `done` z wpisami
wskazującymi `SpisUstawien`/`RamaSekcji` — po tej zmianie Ustawienia **naprawdę** renderują
`ModuleView` ze `state`, więc dotychczasowy powód wyjątku („element powłoki") przestaje być
prawdziwy. Ręcznie rysowany `<h1>` z `src/app/settings/page.tsx` znika.

Rama ma już wszystko, czego ten widok potrzebuje (`layout="fill"`, `breadcrumb`, `width`, `state`),
więc **nie poszerzamy kontraktu** — i tym bardziej nie robimy wyjątku w widoku.

### 5.4 Odnośniki w głąb ustawień (AC-11)

Do przeniesienia razem z sekcją — wypisane z kodu, nie z pamięci:

| Miejsce | Dziś | Po zmianie |
|---|---|---|
| `src/app/api/drive/callback/route.ts` | `new URL("/settings", …)` + `?drive=` | `/settings/polaczenia` |
| `src/components/ui/ImageUrlInput.tsx` | `/settings` („podłącz Dysk") | `/settings/polaczenia` |
| `src/app/admin/reports/new/page.tsx` | `/settings` („Ustawienia → Dysk Google") | `/settings/polaczenia` |
| `src/app/legal/page.tsx` | `/settings` („Prywatność i dane") | `/settings/prywatnosc` |
| `src/components/shell/PasekKciukaPolaczony.tsx` | `/settings#menu` | `/settings/nawigacja` |
| `src/components/favorites/FavoritesSwitcher.tsx` | `go("/settings")` (zarządzaj ulubionymi) | `/settings/nawigacja` |
| `src/modules/home/ui/HomePage.tsx`, `AppShell`, `ModuleSidebar` | `/settings` (wejście ogólne) | **bez zmian** — spis jest właściwym celem |

Kotwica `id="ulubione"` zostaje na bloku ulubionych w sekcji `nawigacja`, więc
`/settings/nawigacja#ulubione` działa dalej.

**`searchParams.drive`** (komunikat po powrocie z OAuth Dysku) obsługuje teraz trasa `[sekcja]`
i przekazuje go do `DriveSettings` w sekcji `polaczenia`.

## 6. AI / integracje (C-23, C-40)

**Nie dotyczy.** Zero nowych `AIAction`, zero read-toolów, zero wpięć w kalendarz, powiadomienia
i kosz. `check:actions`, `check:ai-coverage` i `check:cost-badge` nie mają nowego materiału —
ale przechodzą w buildzie tak czy tak.

## 7. Pliki do utworzenia / zmiany

| Plik | Akcja | Po co |
|------|-------|-------|
| `src/components/shell/ModuleSidebar.tsx` | edycja | nazwa aplikacji bez odnośnika; nowy wiersz „Strona główna"; ikona domu z rzędu ikon usunięta; `aria-current` w `NavItem` |
| `src/lib/modules.tsx` | edycja | `modulStronyGlownej()` — czytanie deklaracji Strony głównej bez tworzenia równoległej listy |
| `src/lib/ustawienia/sekcje.tsx` | nowy | rejestr sekcji ustawień (id, ikona, klucze tekstów) — jedno źródło dla spisu, listy i walidacji trasy |
| `src/components/settings/SpisUstawien.tsx` | nowy | spis + wyszukiwarka (warianty: kafelki / lista boczna) |
| `src/components/settings/RamaSekcji.tsx` | nowy | `ModuleView` sekcji: okruszek, tytuł, lista boczna + treść |
| `src/components/settings/sekcje/Konto.tsx` | nowy | profil + wyloguj |
| `src/components/settings/sekcje/Wyglad.tsx` | nowy | skórka |
| `src/components/settings/sekcje/Nawigacja.tsx` | nowy | menu + ulubione widoki (`id="ulubione"`) |
| `src/components/settings/sekcje/Jezyk.tsx` | nowy | język i strefa czasowa |
| `src/components/settings/sekcje/Polaczenia.tsx` | nowy | Dysk Google + subskrypcja kalendarza |
| `src/components/settings/sekcje/Asystent.tsx` | nowy | plan, zużycie AI, wiedza o użytkowniku |
| `src/components/settings/sekcje/Zespoly.tsx` | nowy | lista zespołów + nowy zespół |
| `src/components/settings/sekcje/Pomoc.tsx` | nowy | pomoc i przewodniki |
| `src/components/settings/sekcje/Prywatnosc.tsx` | nowy | prywatność i dane |
| `src/components/settings/sekcje/Aktywnosc.tsx` | nowy | ostatnia aktywność |
| `src/app/settings/page.tsx` | przepisanie | spis sekcji w ramie widoku (zamiast 308 linii jednej kolumny) |
| `src/app/settings/[sekcja]/page.tsx` | nowy | trasa sekcji: walidacja segmentu, `notFound`, dobór komponentu sekcji |
| `src/lib/ui/view-contract.json` | edycja | `settings`: `exempt` → `done` + wpisy |
| `messages/pl.json` | edycja | nazwy/opisy/hasła sekcji, teksty wyszukiwarki i stanu pustego |
| `src/app/api/drive/callback/route.ts` | edycja | powrót z OAuth → `/settings/polaczenia` |
| `src/components/ui/ImageUrlInput.tsx` | edycja | odnośnik → `/settings/polaczenia` |
| `src/app/admin/reports/new/page.tsx` | edycja | odnośnik → `/settings/polaczenia` |
| `src/app/legal/page.tsx` | edycja | odnośnik → `/settings/prywatnosc` |
| `src/components/shell/PasekKciukaPolaczony.tsx` | edycja | `/settings#menu` → `/settings/nawigacja` |
| `src/components/favorites/FavoritesSwitcher.tsx` | edycja | „zarządzaj" → `/settings/nawigacja` |
| `src/lib/ustawienia/__tests__/sekcje.test.ts` | nowy | każdy klucz tekstu sekcji istnieje w `messages/pl.json` |
| `e2e/specs/rama-i-chrom.spec.ts` | edycja | odwrócenie asercji 087-AC17 dla Strony głównej; przeniesienie `dom` z rzędu ikon do własnego wiersza w 087-AC19+20 |
| `e2e/specs/favorites.spec.ts` | edycja | ulubione są teraz pod `/settings/nawigacja` |
| `e2e/specs/teams.spec.ts` | edycja | zespoły są teraz pod `/settings/zespoly` |
| `e2e/specs/109-*.spec.ts` | nowy | kryteria akceptacji tego przebiegu |

`src/lib/ui/perf-baseline.json` — **być może** edycja: dołożenie trasy parametrycznej zmienia sumę
bajtów JS. Próg ruszamy dopiero, gdy `check:perf` faktycznie zaprotestuje, i z podaniem powodu.

## 8. Bramki i weryfikacja (C-50)

**Lokalnie** (C-13 — nigdy prod `DATABASE_URL`): lokalny Postgres z sandboxa
(`pg_ctlcluster 16 main start`, `omnia/omnia_dev`), `.env.local` + eksport do powłoki,
`npx prisma migrate deploy`. Weryfikujemy **do kroku `next build`** włącznie; `scripts/migrate.js`
nie odpalamy.

Kolejność: `npm run check:i18n` → `npm run check:ui-contract` → `npm run check:test-types`
→ `npm run test:unit` → `next lint --dir src` → `npm run build` (do `next build`) → klikacz
(`nohup bash scripts/e2e-web.sh`).

Mapowanie kryteriów akceptacji na sposób sprawdzenia:

| AC | Jak sprawdzamy |
|----|----------------|
| AC-1 | e2e 1280 px: pierwszy widoczny wiersz nawigacyjny pod nazwą aplikacji ma tekst „Strona główna"; jego `y` < `y` gwiazdki ulubionych i < `y` pierwszej pozycji `<nav>` |
| AC-2 | e2e: `aside a[href="/"]` widocznych = **1**; nazwa aplikacji nie jest `<a>` |
| AC-3 | e2e na `/`: wiersz „Strona główna" ma `aria-current="page"` |
| AC-4 | e2e: z `/tasks` kliknięcie „Strona główna" → `page.url()` kończy się na `/` |
| AC-5 | e2e 390 px: dolny pasek ma dokładnie jedną kotwicę Strony głównej; brak pozycji „Strona główna" w menu telefonu |
| AC-6 | test jednostkowy `isPathLocked([], "/")` + e2e: wariant zablokowany renderuje `div`, nie `a` |
| AC-7 | e2e 1280 px na `/settings/wyglad`: lista sekcji widoczna obok treści; e2e na `/settings`: kafelki mieszczą się bez przewijania (`scrollHeight <= clientHeight`) |
| AC-8 | e2e 390 px: `/settings` pokazuje wyłącznie spis (brak listy bocznej); wejście w pozycję → widoczny okruszek „Ustawienia" wracający na `/settings` |
| AC-9 | e2e: dla każdej z 10 sekcji bezpośrednie wejście pod `/settings/<id>` renderuje jej nagłówek (bez przekierowania na spis) |
| AC-10 | e2e: pętla po 10 sekcjach — każda ma niepustą treść; plus ręczna lista kontrolna 13 → 10 w `verify.md` |
| AC-11 | e2e: `/settings/nawigacja#ulubione` pokazuje `#ulubione`; grep w repo, że nie został ani jeden odnośnik do nieistniejącej kotwicy |
| AC-12 | inspekcja kodu: żaden komponent sekcji nie woła akcji spoza swojej sekcji; `grep` na `getRecentActivity` → tylko `Aktywnosc.tsx` |
| AC-13 | e2e: wpisanie „skorka" zawęża spis do sekcji Wygląd i wejście w wynik otwiera `/settings/wyglad` |
| AC-14 | e2e: fraza „qqq" → widoczny komunikat stanu pustego |
| AC-15 | test jednostkowy funkcji filtrującej: „jezyk"→„Język…", „prywatnosc"→„Prywatność…" |
| AC-16 | `npm run check:ui-contract` (wpis `done` wymusza `ModuleView` + `state`) |
| AC-17 | `npm run check:ui-contract` (kontrola hexów w `src/components`) |
| AC-18 | e2e 390 px: dolna krawędź ostatniego elementu treści < górna krawędź dolnego paska |
| AC-19 | `npm run check:i18n` + nowy test jednostkowy kluczy sekcji |

## 9. Ryzyka techniczne i plan wycofania

- **`[sekcja]` a `team`.** Segment statyczny `team` ma pierwszeństwo, więc `/settings/team/new`
  działa jak dziś. Ale `/settings/team` (bez dalszego segmentu) trafi w `[sekcja]` z wartością
  `"team"` → `notFound()`. Dziś ta ścieżka też jest 404, więc **zachowanie się nie zmienia** —
  odnotowane, żeby nie zostało odkryte jako „regres".
- **Cicha utrata sekcji warunkowej.** `jezyk` i część `asystent` renderują się dziś tylko, gdy dane
  się wczytały. Po podziale sekcja bez danych dałaby pustą stronę. → każda sekcja warunkowa ma
  własny stan pusty z wyjaśnieniem; e2e przechodzi po **wszystkich dziesięciu**.
- **Bramka `check:i18n` nie widzi kluczy dynamicznych.** → test jednostkowy rejestru (pkt 5.2).
- **Budżet wydajnościowy.** Dołożenie trasy podnosi sumę bajtów JS; pasmo to ±5 %. → jeśli
  `check:perf` zaprotestuje, podnosimy próg w `perf-baseline.json` **z powodem**, nie po cichu.
- **Klikacz opiera się na starym układzie panelu.** Dwa testy (`rama-i-chrom.spec.ts`) kodują
  decyzję z 087, którą ten przebieg świadomie odwraca. → aktualizujemy je razem ze zmianą i
  dopisujemy w komentarzu, że 109 zmienia 087, żeby następna osoba nie „naprawiła" tego z powrotem.
- **Rollback:** wyłącznie kod (`git revert` zakresu), bez migracji i bez stanu bazy do cofnięcia.
  Adresy `/settings/<sekcja>` przestałyby istnieć — dlatego zmienione odnośniki wracają tym samym
  revertem.

## 10. Zgodność z konstytucją — checklista

- [x] **C-10..C-14 (migracje)** — bez zmian w schemacie, żadnej migracji; napisane wprost w pkt. 2.
- [x] **C-20..C-25** — brak nowych Server Actions i mutacji; brak nowych `AIAction` (C-23), kosz
      i audyt nie dotyczą; zakres danych i guardy bez zmian (C-21).
- [x] **C-22 (RBAC)** — istniejący `module.settings`; nowe trasy sprawdzają sesję jawnie, nie tylko
      przez middleware; `permissionForPath` musi obejmować podścieżki.
- [x] **C-30 (motyw)** — wyłącznie zmienne CSS; sprawdza `check:ui-contract`.
- [x] **C-31 (mobile/keyboard-first)** — lista boczna `hidden md:flex`, nigdy dwa panele naraz,
      cele dotyku ≥ 44 px, `env(safe-area-inset-bottom)` w treści sekcji.
- [x] **C-32 (teksty przez `t()`)** — nowe teksty w `messages/pl.json`; klucze dynamiczne pokryte
      testem jednostkowym.
- [x] **C-33 (kontrakt widoku)** — `ModuleView` ze `state`, `layout="fill"`, `breadcrumb`; wpis
      w manifeście przechodzi z `exempt` na `done`; **rama nie jest poszerzana** i nie ma wyjątku.
- [x] **C-36 (granice)** — brak nowych równoległych list modułów; „Strona główna" czytana
      z deklaracji modułu; platforma nie importuje modułów.
- [x] **C-53 (minimalizm)** — jedna trasa parametryczna zamiast dziesięciu katalogów; zero nowych
      zależności (normalizacja diakrytyków standardowym `String.normalize`); treść sekcji
      przenoszona 1:1, bez „przy okazji" przeprojektowywania ustawień.
- [x] **C-51 (lekcje)** — wpis do `doświadczenia.md` o odwróceniu decyzji z 087 i o tym, jak czytać
      zgłoszenie opisujące stan sprzed kilku przebiegów.
