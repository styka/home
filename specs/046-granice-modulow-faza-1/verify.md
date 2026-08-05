# Weryfikacja: Granice modułów — Faza 1 (pionowy wycinek)

- **Spec:** ./spec.md · **Plan:** ./plan.md · **Zadania:** ./tasks.md
- **Data:** 2026-08-04
- **Branch:** `claude/omnia-architecture-skins-qlv2ew`
- **Werdykt:** **GOTOWE Z UWAGAMI**

---

## 1. Bramki

Wszystko uruchamiane lokalnie, przeciw **lokalnemu** Postgresowi (`omnia_dev`), zgodnie z C-13.
`scripts/migrate.js` nieuruchamiany.

| Komenda | Wynik | Wyjście |
|---------|-------|---------|
| `check:actions` | ✅ exit 0 | 160 akcji w katalogu, wszystkie z egzekutorem i wpisem w kontrakcie |
| `check:ai-coverage` (+ kontrola dostępu) | ✅ exit 0 | **550** akcji sklasyfikowanych, 550 z zadeklarowanym zakresem i guardem |
| `check:cost-badge` | ✅ exit 0 | 35 plików wołających model |
| `check:content-memory` | ✅ exit 0 | 35 plików sklasyfikowanych |
| `check:migrations` | ✅ exit 0 | następny wolny numer 0226 (faza nie dodaje migracji) |
| `check:ui-contract` | ✅ exit 0 | **21/21** modułów na `ModuleView` |
| `check:schema-drift` | ✅ exit 0 | brak rozjazdu (2 świadome wyjątki) |
| `check:boundaries` | ✅ exit 0 | 4 przypadki: 2 negatywne czerwienią, 2 pozytywne przechodzą |
| `check:module-registry` | ✅ exit 0 | 4 moduły z kontraktem, deklaracją i wpięciem w rejestr |
| `check:test-types` | ✅ exit 0 | pliki testowe przechodzą kontrolę typów |
| `next lint --dir src` | ✅ exit 0 | 0 błędów, 19 ostrzeżeń (wszystkie zastane: `exhaustive-deps`, `no-img-element`, polskie apostrofy) |
| `next build` | ✅ exit 0 | pełny build przechodzi |
| `npm run test:unit` | ✅ 566/566 | 0 fail, 46 pominiętych (integracyjne — wymagają zaseedowanej bazy) |
| Klikacz ścieżki szczęśliwej | ✅ 22/22 | 21 modułów + odczyt rejestru |
| Pełny zestaw klikaczy | ⚠️ 113 ✓ / 19 ✘ | przyczyny **niezwiązane z przebudową** — patrz §4 |

---

## 2. Kryteria akceptacji

### Warstwa platformy

**AC-1 — w platformie tylko rzeczy nieznające modułów.** ✅
Zawartość `src/platform/`: `auth/{session,permissions,serverUtils,ownership}`, `db/prisma`,
`trash`, `audit`, `notifications`, `viewState`, `shortcuts/{registry,shortcutsBus}`,
`favorites/{favoriteViews,favoritesBus}`, `registry.ts`, `ui/index.ts`. Przegląd pliku po pliku:
żaden nie zawiera wiedzy o konkretnym module. Jedyne miejsce, w którym taka wiedza była —
`filterAccessibleFavorites` importujące `isPathLocked` — zostało **odwrócone**: predykat przychodzi
parametrem wymaganym (`src/platform/favorites/favoriteViews.ts:104`).
*Uwaga zakresowa (świadoma, w specu):* `lib/ai`, `lib/llm`, `lib/jobs` **nie** zostały przeniesione —
odłożone i odnotowane w dzienniku.

**AC-2 — platforma nie importuje modułów.** ✅
`grep -rn "@/modules/" src/platform/` → jedyne trafienie to **komentarz** w `registry.ts:13`
tłumaczący tę właśnie regułę; zero instrukcji `import`. Dodatkowo egzekwowane maszynowo: reguła
ESLint `no-restricted-imports` dla `src/platform/**` + przypadek negatywny w `check:boundaries`
(plik w platformie importujący **kontrakt** modułu → ESLint zgłasza błąd; sprawdzone).

### Granice modułów

**AC-3 — katalog modułu samowystarczalny, trasa cienka.** ✅
`src/modules/{truck,contacts,reports,qa}/` zawierają `contract.ts`, `module.ts`, `actions/`, `ui/`
(Truck dodatkowo `lib/{ors,overpass,googleMaps}`). Trasy: `app/truck/page.tsx` 29 linii,
`app/contacts/page.tsx` 18, `app/qa/page.tsx` 33, `app/reports/page.tsx` 39 — każda to wyłącznie
sesja → uprawnienie → pobranie danych → render, bez logiki domenowej.

**AC-4 — import wnętrza obcego modułu czerwieni lint.** ✅
Sprawdzone dwiema drogami. (1) Ręcznie: plik w `modules/truck` importujący
`@/modules/contacts/actions/contacts` → `error … no-restricted-imports` z komunikatem po polsku
wskazującym kontrakt. (2) Trwale: `check:boundaries` odtwarza ten przypadek przy każdym buildzie
i **wymaga** błędu — sprawdzone testem negatywnym samej bramki (wyłączenie reguły → bramka czerwona).

**AC-5 — import kontraktu przechodzi.** ✅
`import "@/modules/contacts/contract"` z `modules/truck` → lint czysty. Zweryfikowane też realnie,
nie tylko na sondzie: `lib/ai/executors/contactsExecutor.ts:3` i `lib/ai/agentTools.ts:25` importują
kontrakty i build przechodzi. Bramka trzyma również ten przypadek — reguła zbyt **szeroka** jest tak
samo szkodliwa jak nieaktywna, tylko objawia się obchodzeniem.

**AC-6 — nowy moduł poza katalogiem modułów jest wykrywalny.** ⚠️ **częściowo — z ograniczeniem
wprost przyznanym**
Co działa: katalog **w** `src/modules/` bez `contract.ts`/`module.ts`, z niekompletną deklaracją,
duplikatem `id` albo bez wpięcia w korzeń kompozycji → `check:module-registry` czerwieni build
(sprawdzone trzema testami negatywnymi).
Czego **nie** ma: bramka nie wykrywa modułu napisanego po staremu, czyli rozsypanego po
`src/actions` + `src/components`. Nie da się jej dziś włączyć, bo dokładnie tak wygląda **17 z 21**
modułów — reguła zapaliłaby się natychmiast na całym istniejącym kodzie. Ten AC domknie się sam
w chwili, gdy lista przejściowa w `src/lib/modules.tsx` dojdzie do zera; do tego czasu obowiązuje
ograniczenie w postaci **jawnej, kurczącej się listy** (wzorzec statusu `pending` z 045), a nie ciszy.

### Jedna deklaracja zamiast ośmiu list

**AC-7 — wpisy usunięte z globalnych list, moduł działa.** ✅
`grep` po `src/lib/modules.tsx` i `src/platform/auth/permissions.ts`: **zero** wystąpień
`truck`/`contacts`/`qa`/`reports` — usunięte są zarówno wpisy rejestru, jak i stałe
`PERMISSIONS.{TRUCK,QA,CONTACTS}` oraz gałęzie `permissionForPath`. Mimo to: rejestr ma 21 modułów
(test jednostkowy), klikacz otwiera wszystkie cztery, a strażniki tras czytają uprawnienie
z deklaracji (`app/truck/page.tsx:13` itd.).

**AC-8 — zmiana pola deklaracji widoczna bez edycji drugiego pliku.** ✅
Dowód wykonany, nie zadeklarowany: podmiana `label` w `src/modules/truck/module.ts` na „Trasy
ciezarowe" i odczyt `MODULES` → zwraca nową etykietę; po cofnięciu → „Trasy TIR". Żaden inny plik
nie był dotykany.

**AC-9 — moduł bez deklaracji zgłaszany przez bramkę.** ✅
Testy negatywne: usunięty `module.ts` → `✖ src/modules/qa: brak module.ts`, exit 1. Usunięte pole
`defaultEnabled` → `✖ deklaracja nie ma pola „defaultEnabled"`, exit 1. Bramka wpięta w `build`.

### Brak regresji

**AC-10 — klikacz 21/21.** ✅
`e2e/specs/modules-happy-path.spec.ts`: **22/22** zielone (21 modułów + odczyt rejestru), w tym
wszystkie cztery przeniesione. *Sprostowanie wobec `tasks.md`:* liczba „25/25" pochodziła z
oszacowania w Fazie 0; spec ma realnie 22 przypadki. Istotne jest pokrycie 21/21 modułów — i ono się
zgadza. Fixture `e2e/fixtures/modules.ts` czyta teraz również deklaracje `module.ts`; bez tej zmiany
liczyłby 17 i **po cichu testował mniej** (test liczby wpisów by to złapał).

**AC-11 — komplet bramek i build.** ✅ Tabela w §1, wszystko exit 0.

**AC-12 — brak zmian widocznych dla użytkownika; refaktor bez zmian funkcji w jednym commicie.** ✅
Historia: 8 commitów, każdy o jednej roli — 1 warstwa platformy, 4 moduły (po jednym), 1 reguły
granic, 1 rejestr, 1 domknięcie dokumentacyjne; dwie naprawy (bramki, test RBAC) **osobno**, zgodnie
z zasadą fazy. Commity przenoszące zawierają wyłącznie `git mv` + przepisane importy (widoczne jako
rename w `git show --stat`).
**Jedna zmiana zachowania warta odnotowania — nie widoczna dla użytkownika:** dopasowanie ścieżki dla
modułów zadeklarowanych jest **ściślejsze** niż stare `path.startsWith("/qa")` — teraz wymaga
zgodności dokładnej albo prefiksu zakończonego `/`. Stara wersja zapaliłaby się także na
`/qaCokolwiek`; takich tras w aplikacji nie ma, więc realnie nic się nie zmienia, a przypadek jest
pokryty testem („dopasowanie ścieżki nie łapie sąsiada o wspólnym prefiksie").

### Dziennik

**AC-13 — dziennik mówi, co przeniesione, co czeka i dlaczego.** ✅
`content/architektura/15-dziennik.md`: wpis 046, przestawione statusy zadań 4–8 (6 → ✅; 4, 5, 7 → 🟡
z wyliczeniem, co dokładnie zrobione), sekcja „Poza zakresem" wymieniająca **17 modułów po nazwie**,
trzy odłożone zdolności platformy z liczbami plików i importujących, zadanie 8 oraz powód, dla
którego pulpit i kalendarz jeszcze nie wynikają z deklaracji. Książka przebudowana
(`scripts/copy-architektura.js`).

---

## 3. Zgodność z konstytucją

| Reguła | Ocena |
|--------|-------|
| C-01 — praca tylko w `worldofmag/` | ✅ poza `specs/`, `CLAUDE.md`, `doświadczenia.md` i `.claude/` (artefakty pipeline'u, C-03) |
| C-02 — alias `@/*` | ✅ z nowym, udokumentowanym wyjątkiem wewnątrz modułu (C-36) |
| C-10..C-14 — migracje | ✅ **nie dotyczy** — faza nie zmienia schematu; potwierdza to `check:schema-drift` |
| C-13 — nigdy prod DB lokalnie | ✅ wyłącznie lokalny `omnia_dev`; `migrate.js` nieuruchamiany |
| C-20 — Server Actions + `revalidatePath` | ✅ akcje przeniesione bez zmian treści |
| C-21/C-22 — własność i RBAC | ✅ guardy nietknięte; kontrola dostępu nadal 550/550. Sluggi w bazie bez zmian |
| C-23 — egzekutor dla `AIAction` | ✅ `check:actions` zielony; egzekutor kontaktów przeszedł na kontrakt |
| C-30 — kolory przez zmienne CSS | ✅ kolory modułów w deklaracjach to `var(--accent-*)`; sprawdzane testem i bramką |
| C-32 — teksty po polsku | ✅ etykiety modułów, komunikaty reguł lintu i obu nowych bramek po polsku |
| C-33 — `ModuleView` | ✅ 21/21; manifest zaktualizowany o nowe ścieżki |
| C-50 — „gotowe" = build przechodzi | ✅ |
| C-51 — wpisy do `doświadczenia.md` | ✅ pięć wpisów |
| C-53 — minimalizm | ⚠️ trzy elementy **poza** pierwotnym planem: `check:boundaries`, kontrola wpięcia w `check:module-registry`, `tsconfig.test.json`. Każdy powstał w reakcji na **realnie napotkaną** dziurę (lint z kodem 0; moduł niewpięty przy zielonym buildzie; `tsc` nieczytający testów), a nie „przy okazji". Uzasadnienia zapisane w planie (C-54) |
| C-54 — spójność artefaktów | ✅ pięć odstępstw od planu opisanych **w planie i w liście zadań** przed napisaniem kodu; dopisane zadania T-10a, T-16a, T-21a |
| C-55 — jeden moment pytań | ✅ zero pytań po `/specify` |

---

## 4. Regresje

**Zbadane i czyste**
- Brak martwych odwołań do starych ścieżek: `grep` po `src/`, `e2e/`, `scripts/` za
  `components/{truck,contacts,reports,qa}`, `actions/{…}`, `lib/{ors,overpass,googleMaps}` → 0 trafień
  poza `src/generated` (artefakt budowany z treści docs, odtwarzany przy każdym buildzie).
- Manifest kontraktu widoku wskazuje istniejące pliki (bramka wywala się na nieistniejącym).
- RBAC: ścieżki `/truck`, `/qa`, `/contacts` nadal zablokowane bez uprawnienia — pokryte testem
  `moduleRegistry.test.ts` („isPathLocked chroni ścieżki modułów zadeklarowanych").
- Ulubione widoki: filtr dostępu działa dla wszystkich trzech miejsc renderowania (pasek boczny,
  karty pulpitu, nakładka) — predykat przekazywany jawnie, brak przekazania byłby błędem kompilacji.

**Znalezione i naprawione w trakcie (osobnymi commitami)**
- `permissions.test.ts` importował przeniesiony plik ścieżką **względną**, której skrypt
  przepisujący aliasy nie ruszył. Nie wykrył tego `tsc` (tsconfig wyklucza testy) — stąd
  `check:test-types`.
- `check-ai-coverage` i `check-ui-contract` miały zaszyte korzenie skanowania; przeniesienie modułu
  wypisywało jego akcje z pokrycia AI **i z kontroli dostępu** bez żadnego komunikatu.

**19 czerwonych klikaczy w pełnym zestawie — przyczyny ustalone, niezwiązane z przebudową**
- **16 z braku danych z seeda w tym środowisku.** `scripts/e2e-web.sh` odpala tylko `migrate deploy`
  i seed użytkowników E2E, a nie `npm run db:seed`. Potwierdzone zapytaniem do bazy: `QaEpic` = 0,
  `ShoppingList` = 0, `Note` = 0 wierszy. Testy szukają epika „Listy zakupowe" i list zakupowych,
  których po prostu nie ma.
- **3 niestabilne pod obciążeniem równoległym** (`smoke-nav-notes`, `-kitchen`, `-settings`) —
  `smoke.spec.ts` uruchomiony osobno daje **12/12**, w tym te trzy. Charakterystyczne, że wśród
  przechodzących w pełnym biegu były `smoke-nav-qa` i `smoke-nav-reports`, czyli **moduły
  przeniesione** — gdyby przyczyną był refaktor, padłyby one, a nie Notatki i Kuchnia.
- To jest **ograniczenie środowiska weryfikacji**, nie zielona flaga awansem: pełny zestaw klikaczy
  na zaseedowanej bazie pozostaje niesprawdzony i tak jest tu zaraportowany.

---

## 5. Werdykt końcowy

**GOTOWE Z UWAGAMI** — 12 z 13 kryteriów spełnionych w pełni, jedno (**AC-6**) częściowo,
z ograniczeniem wynikającym z natury fazy, a nie z niedoróbki.

**Uwagi przechodzące dalej**
1. **AC-6 domyka się dopiero przy pustej liście przejściowej.** Bramka nie wykryje modułu napisanego
   po staremu, bo tak wygląda 17 z 21 modułów. Do rozstrzygnięcia w ostatniej fali Fazy 1.
2. **Pełny zestaw klikaczy nie został potwierdzony na zaseedowanej bazie.** Warto rozważyć dołożenie
   `npm run db:seed` do `scripts/e2e-web.sh` — dziś 16 testów jest czerwonych z powodu środowiska,
   co psuje wartość sygnału „czerwony = regresja".
3. **Dług nazwany, nie ukryty:** 17 modułów, `lib/{ai,llm,jobs}`, zadanie 8, pulpit i kalendarz
   niewynikające jeszcze z deklaracji. Wszystko w rozdz. 15 dokumentu architektury.
4. **`app/admin/qa/page.tsx` czyta `prisma` bezpośrednio**, zamiast przez kontrakt QA (`getAllEpics`).
   To dług **zastany**, nie wprowadzony w tym przebiegu, i celowo nietknięty — poprawka byłaby zmianą
   zachowania w commicie przenoszącym. Do sprzątnięcia przy okazji kolejnej fali.
