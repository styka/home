# Plan techniczny: Granice modułów — Faza 1 (pionowy wycinek)

- **Spec:** ./spec.md (046-granice-modulow-faza-1)
- **Status:** draft
- **Data:** 2026-08-04

> **Zasada planu:** to jest **JAK**. Plan pisze się pod istniejący kod — najpierw czytamy sąsiedni
> moduł i naśladujemy jego wzorzec (C-53), potem projektujemy.

---

## 1. Podejście

Rekonesans dał liczby, które przesądzają kolejność:

| Zdolność | Plików | Importujących |
|----------|--------|---------------|
| `lib/prisma` | 1 | **155** |
| `lib/auth` | 1 | **155** |
| `lib/permissions` | 1 | 91 |
| `lib/server-utils` | 1 | 85 |
| `lib/ai/` | 25 | 97 |
| `lib/llm/` | 8 | 55 |
| `lib/jobs/` | 5 | 45 |
| `lib/viewState/`, `favorites/`, `shortcuts/`, `crypto/`, `trash`, `audit`, `ownership`, `activity` | 9 | 4–18 każda |

**Wniosek:** cztery najczęściej importowane zdolności to jednocześnie te, które **na pewno** należą do
platformy (sesja, baza, uprawnienia, narzędzia serwerowe). Ich przeniesienie to 486 podmian importu —
mechanicznych, w pełni weryfikowalnych kontrolą typów. Reszta platformy (`ai`, `llm`, `jobs`) jest
większa i **nie jest potrzebna modułom pilotażowym**, więc trafia do kolejnego przebiegu.

**Strategia w trzech ruchach:**

1. **Platforma** — fizyczne przeniesienie ośmiu zdolności, przy których nie ma wątpliwości, że nie
   znają modułów. Import przepisywany skryptem, poprawność potwierdzana `tsc`.
2. **Moduły pilotażowe** — Truck (najczystszy: nikt go nie importuje, a `lib/ors`, `lib/overpass`,
   `lib/googleMaps` są używane **wyłącznie** przez niego), potem Kontakty, Raporty, QA. Każdy osobnym
   commitem.
3. **Egzekwowanie i deklaracja** — reguła lintu blokująca import wnętrza obcego modułu oraz
   `defineModule`, z którego wynikają rejestr, uprawnienia i nawigacja.

**Wzorcem do naśladowania** jest to, co zadziałało w 045: bramka + manifest ze **statusami**, gdzie
`pending` jest legalnym, ale **jawnym** stanem. Dzięki temu regułę granic można włączyć na twardo od
razu, mimo że 17 modułów jeszcze nie jest przeniesionych.

---

## 2. Model danych (Prisma)

**Bez zmian w schemacie. Bez migracji.** Faza 1 przenosi pliki i wprowadza granice importu — nie
dotyka bazy. `ownerId`/`ownerTeamId` zostają nietknięte; ich migracja to Faza 2 (zadanie 11).

Bramka `check:schema-drift` (dodana w Fazie 0) potwierdzi to automatycznie: jakakolwiek zmiana
schematu bez migracji wywali build.

---

## 3. Warstwa platformy — co i skąd

`src/platform/` z podziałem wg rozdz. 7.1. W tym przebiegu przenosimy **fizycznie**:

| Nowa ścieżka | Z | Importujących |
|--------------|---|---------------|
| `platform/auth/session.ts` | `lib/auth.ts` | 155 |
| `platform/db/prisma.ts` | `lib/prisma.ts` | 155 |
| `platform/auth/permissions.ts` | `lib/permissions.ts` | 91 |
| `platform/auth/serverUtils.ts` | `lib/server-utils.ts` | 85 |
| `platform/auth/ownership.ts` | `lib/ownership.ts` | 5 |
| `platform/viewState/` | `lib/viewState/` | 18 |
| `platform/favorites/` | `lib/favorites/` | 11 |
| `platform/shortcuts/` | `lib/shortcuts/` | 4 |
| `platform/trash/` | `lib/trash.ts` | 6 |
| `platform/audit/` | `lib/audit.ts` | 4 |
| `platform/notifications/` | `lib/notifications.ts` | 1 |
| `platform/activity/` | `lib/activity.ts` | 0 |
| `platform/ui/` | **re-eksport** `components/ui/*` | — |

**`platform/ui` jest re-eksportem, nie przenosinami.** Komponenty zostają w `components/ui/`, bo
045 właśnie je tam poukładał, a przenoszenie ich teraz dorzuciłoby ~300 podmian importu do refaktoru,
który i tak jest największy w historii repo. `platform/ui/index.ts` re-eksportuje je pod docelową
nazwą — moduły przeniesione używają **wyłącznie** tej ścieżki, więc gdy komponenty fizycznie się
przeniosą, zmieni się jeden plik zamiast dwudziestu. To ten sam wzorzec „cienkiej nakładki", którym
045 scalił `EmptyState` (C-35).

**Poza zakresem tego przebiegu:** `lib/ai/` (25 plików, 97 importujących), `lib/llm/` (8/55),
`lib/jobs/` (5/45). Nie są potrzebne modułom pilotażowym, a ich przeniesienie podwoiłoby diff.
Odnotowane w dzienniku jako czekające.

### Sposób przenoszenia

`git mv` + skrypt przepisujący importy (`@/lib/prisma` → `@/platform/db/prisma` itd.), a potem
`tsc --noEmit`. Kontrola typów jest tu **wystarczającym** dowodem poprawności: zerwany import to błąd
kompilacji, nie cicha awaria. Żadnych re-eksportów zgodnościowych dla przeniesionych zdolności — dwie
działające ścieżki do tego samego pliku to dokładnie ten dług, którego Faza 1 ma się pozbyć.

### Reguła jednokierunkowości (AC-2)

`platform/` nie może importować z `modules/`. Egzekwowane **regułą ESLint**, nie tylko dobrą wolą —
i sprawdzane testem negatywnym.

---

## 4. Moduły pilotażowe — struktura

```
src/modules/truck/
├─ contract.ts          ← JEDYNE, co widzą inne moduły i platforma
├─ module.ts            ← deklaracja rejestrująca (defineModule)
├─ actions/truck.ts     ← z src/actions/truck.ts
├─ ui/TruckPlannerPage.tsx  ← z src/components/truck/
└─ lib/{ors,overpass,googleMaps}.ts  ← z src/lib/, używane WYŁĄCZNIE przez Truck
```

Trasa `src/app/truck/page.tsx` zostaje i staje się cienka: sesja → dane → render.

**Kolejność i uzasadnienie:**

| # | Moduł | Dlaczego w tej kolejności |
|---|-------|---------------------------|
| 1 | **Truck** | Nikt go nie importuje, a trzy biblioteki integracji (`ors`, `overpass`, `googleMaps`) są używane **wyłącznie** przez niego. Idealny pierwszy — dowodzi wzorca bez negocjowania granicy. |
| 2 | **Kontakty** | Jeden konsument z zewnątrz: `lib/ai/executors/contactsExecutor.ts`. Pierwszy prawdziwy test `contract.ts`. |
| 3 | **Raporty** | Kilku konsumentów (panel admina, asystent, `agentTools`). Sprawdza, czy kontrakt unosi realne współdzielenie. |
| 4 | **QA** | Konsumenci w `app/admin/qa/*` i `components/admin/qa/*`. Sprawdza granicę moduł ↔ powierzchnia administracyjna. |

**`contract.ts` zawiera dokładnie to, czego potrzebują konsumenci z zewnątrz** — nie „wszystko na
wszelki wypadek". Dziś to garść funkcji odczytu i typów DTO; rozszerza się go, gdy ktoś realnie
potrzebuje więcej (komunikat reguły lintu wprost o tym mówi).

---

## 5. Reguła lintu (AC-4, AC-5, AC-6) — zadanie 6, **nieopcjonalne**

`.eslintrc.json`, `no-restricted-imports` z `patterns`:

```js
{
  "group": ["@/modules/*/!(contract)", "@/modules/*/!(contract)/**"],
  "message": "Moduł widzi inny moduł WYŁĄCZNIE przez contract.ts. Potrzebujesz więcej? Rozszerz kontrakt tamtego modułu."
}
```

Plus druga reguła dla `src/platform/**`: zakaz importu z `@/modules/*` w ogóle (AC-2) —
**asymetria z rozdz. 7.1**: platforma nie zna modułów, moduł zna platformę.

**Zakres reguły:** przez `overrides` na `src/modules/**` i `src/platform/**`. Moduł jeszcze
nieprzeniesiony żyje w `src/components|actions|lib` i reguła go nie dotyczy — dzięki temu można ją
włączyć **na twardo już teraz**, nie czekając na 17 pozostałych modułów.

Import **własnego** wnętrza (`@/modules/truck/ui/...` z wewnątrz Truck) musi przechodzić — inaczej
moduł nie mógłby się złożyć. Realizowane przez `allow`/ścieżki względne wewnątrz modułu.

**Test negatywny jest obowiązkowy:** tymczasowy import wnętrza obcego modułu ma czerwienić lint.
Bez tego reguła może być składniowo poprawna i nic nie łapać.

---

## 6. `defineModule` — jedna deklaracja zamiast ośmiu list (AC-7, AC-8, AC-9)

**Problem do rozwiązania precyzyjnie:** deklaracja ma **zastąpić** wpisy w listach globalnych,
a nie dołożyć dziewiąte miejsce. Spec wymaga tego wprost (AC-7: usuwam wpisy z list → moduł nadal
działa).

**Kształt:**

```ts
// src/modules/truck/module.ts
export default defineModule({
  id: "truck",
  label: "Trasy TIR",
  href: "/truck",
  permission: "module.truck",
  color: "var(--accent-orange)",
  icon: Truck,
  defaultEnabled: false,
  viewEntries: ["src/modules/truck/ui/TruckPlannerPage.tsx"],
});
```

**Skąd co wynika:**

| Konsument | Dziś | Po zmianie |
|-----------|------|-----------|
| `lib/modules.tsx` `MODULES` | ręczny wpis | scalone: wpisy modułów **przeniesionych** pochodzą z ich deklaracji, reszta zostaje w tablicy |
| `lib/permissions.ts` `PERMISSIONS` | ręczny wpis | slug z deklaracji; `permissionForPath` wywodzi się z `href` |
| `ModuleSidebar` / tab bar | czyta `MODULES` | bez zmian — czyta ten sam, złożony rejestr |
| `lib/ui/view-contract.json` | ręczny wpis | `viewEntries` z deklaracji; bramka czyta jedno i drugie |

**Rejestr składany:** `src/platform/registry.ts` importuje deklaracje modułów przeniesionych
i **scala** je z dotychczasową tablicą. To jest świadomy kompromis okresu przejściowego: dopóki
17 modułów nie ma deklaracji, tablica musi zostać. Scalanie jest jawne i ma test sprawdzający, że
żaden moduł nie wypadł ani się nie zdublował.

**Bramka `check:module-registry`** (nowa, wzorem `check:ui-contract`): każdy katalog w
`src/modules/` musi mieć `module.ts` i `contract.ts`; deklaracja musi mieć komplet pól; id modułu
musi być unikalne w scalonym rejestrze. Wpięta w `build`.

---

## 7. Pliki do utworzenia / zmiany

### Nowe

| Plik | Po co |
|------|-------|
| `src/platform/{auth,db,viewState,favorites,shortcuts,trash,audit,notifications,activity}/…` | przeniesione zdolności |
| `src/platform/ui/index.ts` | re-eksport `components/ui` pod docelową ścieżką |
| `src/platform/registry.ts` | składanie rejestru z deklaracji + tablicy przejściowej |
| `src/platform/defineModule.ts` | typ deklaracji + funkcja pomocnicza |
| `src/modules/{truck,contacts,reports,qa}/{contract,module}.ts` | granica i deklaracja |
| `src/modules/{truck,contacts,reports,qa}/{actions,ui,lib}/…` | przeniesiona zawartość |
| `scripts/check-module-registry.js` | bramka deklaracji |
| `src/lib/__tests__/moduleRegistry.test.ts` | test scalania rejestru (żaden moduł nie ginie, brak duplikatów) |

### Zmieniane

| Plik | Zmiana |
|------|--------|
| ~486 plików | przepisane importy przeniesionych zdolności platformy |
| `.eslintrc.json` | reguły granic (moduły + platforma) |
| `src/lib/modules.tsx` | tablica przejściowa; wpisy modułów przeniesionych usunięte |
| `src/lib/permissions.ts` | slugi modułów przeniesionych wywodzone z deklaracji |
| `src/lib/ui/view-contract.json` | ścieżki po przeniesieniu |
| `src/lib/ai/executors/{contactsExecutor,reportExecutor}.ts`, `agentTools.ts` | import przez `contract.ts` zamiast wnętrza modułu |
| `src/app/{truck,contacts,reports,qa}/**` | import z `@/modules/...` |
| `package.json` | `check:module-registry` + wpięcie w `build` |
| `content/architektura/15-dziennik.md` | wpis 046 + statusy zadań 4–7 |
| `CLAUDE.md`, `.claude/spec-pipeline/constitution.md` | opis nowej struktury i reguła granic |
| `doświadczenia.md` | lekcje |

---

## 8. Bramki i weryfikacja (C-50)

**Lokalnie (C-13):** lokalny Postgres 16 (`omnia_dev`), `DATABASE_URL`/`DIRECT_URL` **eksportowane
osobno** (`export A=…; export B=$A` — jedna instrukcja nie widzi jeszcze `$A`; ta pułapka kosztowała
czas w 045). Weryfikacja do kroku `next build`; `migrate.js` nieuruchamiany.

**Uzupełnienie z `/implement` (C-54).** Istniejące bramki mają **zaszyte korzenie skanowania**:
`check-ai-coverage.js` czyta wyłącznie `src/actions/`, a kontrola kolorów w `check-ui-contract.js`
wyłącznie `src/components/`. Przeniesienie modułu do `src/modules/<x>/` wypisywało więc jego akcje
z pokrycia AI **i z kontroli dostępu**, a widok z zakazu zaszytych kolorów — bez jednego czerwonego
komunikatu. Obie bramki dostają dodatkowy korzeń (`src/modules/*/actions`, `src/modules/*/ui`),
a bramka pokrycia dodatkowo wykrywa kolizję nazw plików akcji, bo klucz manifestu to sama nazwa
pliku. Zadanie **T-10a**.

| AC | Jak sprawdzamy |
|----|----------------|
| AC-1 | Przegląd zawartości `platform/` — wyłącznie zdolności bez wiedzy o modułach |
| AC-2 | Reguła ESLint + test negatywny (import `@/modules/*` z `platform/` → czerwony lint) |
| AC-3 | Struktura katalogu modułu; trasa zawiera wyłącznie sesję, pobranie danych i render |
| AC-4 | **Test negatywny:** import wnętrza obcego modułu → lint czerwony |
| AC-5 | Import `contract.ts` obcego modułu → lint zielony |
| AC-6 | `check:module-registry` — katalog w `modules/` bez `module.ts`/`contract.ts` wywala build |
| AC-7 | Usunięcie wpisów modułów pilotażowych z `modules.tsx`/`permissions.ts` → build i klikacz zielone |
| AC-8 | Zmiana etykiety w deklaracji → widoczna w nawigacji bez edycji drugiego pliku |
| AC-9 | `check:module-registry` z niekompletną deklaracją → czerwony |
| AC-10 | `e2e/specs/modules-happy-path.spec.ts` — **25/25** |
| AC-11 | Komplet bramek: `check:actions`, `check:ai-coverage`, `check:cost-badge`, `check:content-memory`, `check:migrations`, `check:ui-contract`, `check:schema-drift`, `check:module-registry` + `next lint` + `next build` + `test:unit` |
| AC-12 | Diff każdego commita przenoszącego zawiera **wyłącznie** przenosiny i przepisane importy |
| AC-13 | Rozdz. 15 dokumentu architektury po przebiegu |

---

## 9. Ryzyka techniczne i plan wycofania

| Ryzyko | Mitygacja | Wycofanie |
|--------|-----------|-----------|
| **486 podmian importu psuje coś cicho** | `tsc --noEmit` po każdej zdolności; zerwany import to błąd kompilacji, nie cicha awaria | rewert commita jednej zdolności |
| **Reguła lintu blokuje import własnego wnętrza modułu** i moduł się nie składa | Sprawdzone pozytywnym testem: import wewnątrz modułu ma przechodzić | poprawka wzorca w `.eslintrc.json` |
| **Scalony rejestr gubi albo dubluje moduł** | Test jednostkowy: liczba modułów i unikalność id po scaleniu | — |
| **Deklaracja dokłada dziewiąte miejsce zamiast zastąpić osiem** | AC-7 wymaga **usunięcia** wpisów z list globalnych, nie samego dodania deklaracji | — |
| **`git mv` gubi historię pliku** | `git mv` zachowuje historię; commit zawiera wyłącznie przenosiny, więc `--follow` działa | — |
| **Refaktor miesza się ze zmianą funkcji** | Zasada „nigdy w jednym commicie"; napotkany błąd = osobny commit | rewert jednego commita |
| **Manifest kontraktu widoku wskazuje nieistniejące pliki po przeniesieniu** | `check:ui-contract` wywala się na nieistniejącym pliku — złapie to od razu | aktualizacja ścieżek w tym samym commicie co przenosiny |

---

## 10. Decyzje techniczne przyjęte samodzielnie (C-55)

1. **`platform/ui` jako re-eksport, nie przenosiny** — 045 dopiero co poukładał `components/ui`;
   przenoszenie go teraz dorzuciłoby ~300 podmian do i tak największego refaktoru w repo.
2. **`lib/ai`, `lib/llm`, `lib/jobs` poza zakresem** — nie są potrzebne modułom pilotażowym,
   a podwoiłyby diff. Odnotowane w dzienniku.
3. **Zero re-eksportów zgodnościowych dla przeniesionych zdolności** — dwie działające ścieżki do
   tego samego pliku to dług, którego ta faza ma się pozbyć. (Inaczej niż przy `ui`, gdzie nakładka
   jest **celowym** krokiem przejściowym z jasnym terminem.)
4. **Rejestr scalany, nie przepisany** — dopóki 17 modułów nie ma deklaracji, tablica musi zostać.
   Scalanie jest jawne i otestowane.
5. **Reguła lintu włączana zakresowo od razu** — `overrides` na `src/modules/**` i `src/platform/**`.
6. **Truck jako pierwszy** — jedyny moduł, którego nikt nie importuje i którego biblioteki integracji
   należą wyłącznie do niego.

---

## 11. Zgodność z konstytucją — checklista

- [x] **C-01** — praca wyłącznie w `worldofmag/`; legacy nietknięte.
- [x] **C-02** — alias `@/*` wszędzie; przenosiny nie wprowadzają ścieżek względnych między warstwami.
- [x] **C-10..C-14** — **bez migracji**; `check:schema-drift` potwierdzi, że schemat nietknięty.
- [x] **C-20, C-21** — akcje zmieniają położenie, nie treść; guardy i model współwłasności nietknięte.
- [x] **C-22** — bez nowych slugów; zmienia się źródło przypisania, nie jego wartość.
- [x] **C-23** — katalog `AIAction` nietknięty; executory dostają import przez kontrakt.
- [x] **C-32** — komunikat reguły lintu po polsku (to on uczy właściwej drogi).
- [x] **C-33** — manifest kontraktu widoku aktualizowany razem z przenosinami.
- [x] **C-50** — komplet bramek + `next build` przed uznaniem za gotowe.
- [x] **C-51** — lekcje do `doświadczenia.md`.
- [x] **C-53** — **największe ryzyko**: refaktor kusi „przy okazji". Przenosimy, nie ulepszamy.
- [x] **C-54** — jeśli przenoszenie pokaże, że podział platforma/moduł jest błędny, poprawiamy spec
      i plan, nie obchodzimy problemu wyjątkiem.
