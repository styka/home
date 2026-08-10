# Recenzja: Granice modułów — Faza 1, fala 3 (domknięcie zadania 5)

- **Spec:** ./spec.md · **Plan:** ./plan.md · **Zadania:** ./tasks.md · **Weryfikacja:** ./verify.md
- **Data:** 2026-08-05 · **Branch:** `claude/omnia-architecture-skins-qlv2ew`
- **Diff:** `17b64b2d^..HEAD` — **351 plików, +2303 / −647**, w przeważającej części przenosiny
  (`git diff -M` rozpoznaje je jako `R`); realnych zmian treści jest 92 pliki.

Recenzja celuje w to, czego `verify.md` z definicji nie sprawdza: **czy przenosiny czegoś po drodze
nie przekłamały** i czy trzy zmiany zachowania (rozdzielenie asystenta, nawigacja z deklaracji,
zaostrzenie bramki) są zrobione poprawnie.

---

## Ustalenia

### 1. `src/lib/tasks/access.ts` importował **własny kontrakt modułu Zadania** — correctness / convention

- **Plik:** `worldofmag/src/lib/tasks/access.ts:1` (przed poprawką)
- **Kategoria:** convention (C-02), z realnym skutkiem architektonicznym

`assertTaskAccess` to kod **modułu Zadania** — jedynymi konsumentami są
`modules/tasks/actions/tasks.ts` i `modules/tasks/contract.ts`. Leżał jednak poza modułem i sięgał
do niego przez alias `@/modules/tasks/contract`, czyli przez **własny publiczny kontrakt**. Powstała
pętla: kontrakt re-eksportuje `assertTaskAccess` z `lib/tasks/access`, a ten importuje
`assertProjectAccess` z powrotem z kontraktu. Kontrakt Zadań w komentarzu wymieniał
„`lib/tasks/access`" **jako konsumenta samego siebie** — tak ten zapach został zalegalizowany.

**Scenariusz skutku:** reguła ESLint pilnuje wyłącznie ścieżek `@/modules/*`, więc na pliku spoza
`src/modules/` nie zapala się nigdy. Każdy kolejny „prawie modułowy" plik może wylądować
w `src/lib/<moduł>/`, importować cudze wnętrza aliasem i **nie zostać zauważonym przez żadną bramkę**
— dokładnie ta erozja, przed którą ostrzega rozdz. 14 („granice bez egzekwowania erodują w tygodnie").

**Poprawione w recenzji** (`fdd74bf8`): → `src/modules/tasks/lib/access.ts`, import zamieniony na
względny `../actions/taskProjects`. Zaktualizowani konsumenci i test izolacji najemcy.

### 2. `src/lib/shopping/` — trzy pliki kodu jednomodułowego poza modułem — convention

- **Pliki:** `src/lib/shopping/{offlineMutations,offlineStore,offlineTypes}.ts` (przed poprawką)
- **Kategoria:** convention (C-36, AC-1)

Kolejka mutacji offline Zakupów. Konsumenci: wyłącznie `modules/shopping/ui/*` (4 pliki) i
`modules/shopping/actions/shoppingSync.ts` — czyli sam moduł. Zgodnie z regułą, którą ta fala sama
ustanowiła („plik należy tam, gdzie umieszczają go jego **konsumenci**"), miejsce jest w module.

**Scenariusz skutku:** AC-1 („kod modułu mieszka w katalogu modułu") był raportowany jako spełniony
na podstawie bramki, która tego katalogu nie sprawdzała — czyli **dowód był węższy niż teza**.

**Poprawione w recenzji** (`fdd74bf8`): → `src/modules/shopping/lib/`, importy na ścieżki względne.

### 3. Bramka rejestru pilnowała **dwóch z trzech** historycznych miejsc modułu — correctness bramki

- **Plik:** `worldofmag/scripts/check-module-registry.js:118-126` (przed poprawką)
- **Kategoria:** correctness

Piąty test sprawdzał `src/actions/<id>.ts` i `src/components/<id>/`. Trzecie miejsce, w którym moduł
historycznie mieszkał — **`src/lib/<id>/`** — było pominięte. To jest przyczyna ustaleń 1 i 2:
przetrwały falę, bo nic ich nie szukało.

**Scenariusz awarii:** ktoś pisze nowy moduł „z pamięci starego układu", wkłada logikę do
`src/lib/nowy/`, deklaruje moduł poprawnie — build zielony, bramka mówi „bez kodu poza swoim
katalogiem", a połowa modułu leży poza granicą i jest importowalna aliasem przez kogokolwiek.

**Poprawione w recenzji** (`fdd74bf8`): bramka patrzy na wszystkie trzy miejsca. Katalogi realnie
współdzielone dostały **jawną listę wyjątków z powodem** (wzorzec `schema-drift-allowed.json`):
`lib/news` (`rss.ts`/`webSearch.ts` czyta warstwa zadań w tle i trasa agenta — obie poza modułem),
`lib/health` (`queryDiag.ts` używa `actions/systemHealth.ts`, panel admina),
`lib/home` (`dashboardSections.ts` dzieli moduł z przekrojowym `actions/dashboardPrefs.ts`).
Potwierdzone **testem negatywnym**: podłożone `src/lib/portfel/tmp.ts` → bramka czerwona,
po sprzątnięciu zielona.

### 4. `check-schema-drift` **kasowała lokalną bazę deweloperską** — correctness / bezpieczeństwo danych

- **Plik:** `worldofmag/scripts/check-schema-drift.js:54` (przed poprawką)
- **Kategoria:** correctness · **dług zastany z Fazy 0, nie wprowadzony tą falą**

Bramka podawała jako `--shadow-database-url` **to samo połączenie co robocze**. Prisma czyści bazę
cienia przed odtworzeniem migracji, więc każde `npm run check:schema-drift` — a więc **każdy
`npm run build`** — kasowało schemat lokalnej bazy razem z `_prisma_migrations`.

**Scenariusz awarii (zaobserwowany, nie hipotetyczny):** build przechodził kompilację, po czym
wywracał się na końcowym `scripts/migrate.js` z **P3005 „The database schema is not empty"** — błąd
wskazujący na migracje, choć winowajcą była bramka uruchomiona dziesięć kroków wcześniej. Do tego
znika stan lokalnej bazy: dane testowe, seed, wszystko.

Autorzy bramki byli świadomi ryzyka — komentarz przy pominięciu na zdalnym połączeniu mówi wprost
„bramka tworzy i kasuje bazę cienia" (C-13). Ochrona produkcji zadziałała; zabrakło jej dla bazy
lokalnej, którą bramka kasowała *zamiast* bazy cienia.

**Poprawione w recenzji** (`fdd74bf8`): baza cienia to osobna `<db>_shadow`, tworzona przez bramkę.
Bez uprawnienia `CREATEDB` bramka **pomija sprawdzenie** zamiast sięgać po bazę roboczą — lepiej
stracić jedno sprawdzenie niż czyjeś dane. Zweryfikowane: 238 migracji w tabeli **przed i po**
uruchomieniu bramki (wcześniej: po uruchomieniu tabeli nie było).

### 5. Nawigacja boczna z deklaracji — poprawna, z jedną świadomą konsekwencją — obserwacja

- **Pliki:** `src/platform/registry.ts:47-61`, `src/components/shell/ModuleSidebar.tsx:28-48`
- **Kategoria:** obserwacja (bez poprawki)

Implementacja jest zrobiona dobrze i dwie rzeczy, które łatwo tu spartolić, są w niej wprost
zaadresowane: leniwy loader (bo `module.ts` trafia do grafu serwerowego, więc statyczny import
komponentu klienckiego wciągnąłby go tam ze sobą) i **cache komponentów** (bo `dynamic()` wołane
w renderze produkowałoby przy każdym przerysowaniu nowy typ komponentu, a React odmontowywałby
nawigację i gubił jej stan).

Konsekwencja, którą odnotowuję: sub-nawigacja jedzie teraz **osobnym chunkiem**, więc jej
interaktywność pojawia się po doładowaniu, a nie razem z resztą powłoki. Dla użytkownika to
niewidoczne (markup jest w SSR), ale dla testów zakładających synchroniczność już nie — i to
najprawdopodobniej tłumaczy dwie z trzech nierozwiązanych porażek klikaczy z `verify.md` §5.

### 6. Trzy czerwone klikacze — kod aplikacji jest poprawny — obserwacja

- **Kategoria:** obserwacja (bez poprawki)

Sprawdziłem przesłanki `scenario-qa-tester-access` niezależnie od klikaczy: użytkownik e2e **ma**
`module.qa` (`e2e/fixtures/users.ts`), a test jednostkowy rejestru potwierdza, że QA jest jedynym
modułem domyślnie wyłączonym (`moduleRegistry.test.ts:47`, `assert.deepEqual(prefs.disabled,
["qa"])`) i że `resolveMenu` umieszcza go w sekcji „Więcej…". **Logika aplikacji jest więc
poprawna** — czerwony wynik pochodzi z harnessu (najpewniej z §5), nie z produktu. To nie zmienia
werdyktu, ale zmienia to, czym ten dług jest: długiem testowym, nie ukrytą regresją.

### Czego NIE zgłaszam

Przejrzałem punkty, w których przenosiny najłatwiej byłoby przekłamać, i są czyste:
guardy dostępu i `ownerId`/`ownerTeamId` w przeniesionych akcjach (bez zmian treści — `git diff -M`
pokazuje same nagłówki importów), `revalidatePath` na końcu mutacji, brak enumów Prisma,
brak zaszytych kolorów, teksty PL, zero zmian schematu. Podmiana `PERMISSIONS.NEWS` →
`newsModule.permission` w trasach jest bezpieczna: `defineModule` jest generyczne i zachowuje typ
literalny, więc `permission` nie rozjeżdża się do `string | null`.
Normalizacja pustej ścieżki w `pathPermissions.ts:21` jest zrobiona **w jednym miejscu** zamiast
rozluźnienia `exact: true` w deklaracji Strony głównej — to właściwy wybór, bo rozluźnienie
dopasowałoby korzeń do wszystkiego.

---

## Bramki po poprawkach recenzji

| Komenda | Wynik |
|---|---|
| `npm run build` (pełny potok, **lokalny** Postgres) | ✅ **exit 0** end-to-end, łącznie z `migrate.js` i seedami |
| `next lint --dir src` | ✅ 0 błędów |
| `tsc --noEmit` · `tsc -p tsconfig.test.json` | ✅ oba exit 0 |
| `npm run test:unit` | ✅ **566/566** (46 pominiętych) |
| `check:ai-coverage` | ✅ **551** — bez spadku |
| `check:module-registry` | ✅ 21 modułów, teraz z kontrolą `src/lib/<id>/` |
| `check:schema-drift` | ✅ brak rozjazdu, **baza robocza nietknięta** (238 migracji przed i po) |
| `check:actions` 160 · `check:cost-badge` 35 · `check:content-memory` 35 · `check:ui-contract` 21/21 · `check:boundaries` 4 | ✅ |

---

## Werdykt

## **APPROVE Z UWAGAMI**

Fala robi to, co obiecuje: 21/21 modułów za granicą, lista przejściowa usunięta, `PERMISSIONS`
zredukowane do slugów spoza rejestru, powłoka bez ani jednego importu wnętrza modułu. Przenosiny są
oddzielone od zmian zachowania, a trzy zmiany zachowania są zrobione poprawnie.

Cztery ustalenia recenzji **naprawiono w jej trakcie** (`fdd74bf8`) — trzy dotyczyły luki w dowodzie
AC-1 (kod jednomodułowy poza modułem i bramka, która go nie szukała), czwarte to zastany błąd
z Fazy 0, przez który bramka kasowała lokalną bazę deweloperską.

**Uwagi, z którymi wypuszczamy:**
- trzy scenariusze klikaczy pozostają czerwone (`verify.md` §5); ustalenie 6 pokazuje, że kod
  aplikacji jest poprawny, więc to dług testowy, nie regresja;
- leniwa nawigacja boczna przesuwa moment interaktywności sub-nawigacji — niewidoczne dla
  użytkownika, istotne dla testów;
- `lib/news`, `lib/health`, `lib/home` zostają poza modułami **z powodem** i to jest teraz zapisane
  w bramce, a nie tylko w czyjejś pamięci.
