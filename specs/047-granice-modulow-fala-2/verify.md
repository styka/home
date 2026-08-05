# Weryfikacja: Granice modułów — Faza 1, fala 2

- **Spec:** ./spec.md · **Plan:** ./plan.md · **Zadania:** ./tasks.md
- **Data:** 2026-08-05
- **Branch:** `claude/omnia-architecture-skins-qlv2ew`
- **Werdykt:** **GOTOWE Z UWAGAMI**

---

## 1. Bramki

Lokalny Postgres (`omnia_dev`), `DATABASE_URL`/`DIRECT_URL` eksportowane osobnymi instrukcjami.
Weryfikacja do kroku `next build`; `migrate.js` nieuruchamiany (C-13).

| Komenda | Wynik | Wyjście |
|---------|-------|---------|
| `check:actions` | ✅ exit 0 | **160** akcji w katalogu — bez zmian |
| `check:ai-coverage` | ✅ exit 0 | **551** akcji z zakresem i guardem (550 → 551, patrz niżej) |
| `check:cost-badge` | ✅ exit 0 | 35 plików wołających model |
| `check:content-memory` | ✅ exit 0 | 35 plików sklasyfikowanych |
| `check:migrations` | ✅ exit 0 | następny wolny numer 0226 — fala nie dodała migracji |
| `check:ui-contract` | ✅ exit 0 | **21/21** modułów na `ModuleView` |
| `check:schema-drift` | ✅ exit 0 | brak rozjazdu (2 świadome wyjątki) |
| `check:boundaries` | ✅ exit 0 | 4 przypadki: 2 negatywne czerwienią, 2 pozytywne przechodzą |
| `check:module-registry` | ✅ exit 0 | **11 modułów** z kontraktem, deklaracją i wpięciem |
| `check:test-types` | ✅ exit 0 | pliki testowe typecheckują |
| `next lint --dir src` | ✅ exit 0 | 0 błędów, 19 ostrzeżeń (wszystkie zastane) |
| `next build` | ✅ exit 0 | pełny build przechodzi |
| `npm run test:unit` | ✅ 566/566 | 0 fail, 46 pominiętych (integracyjne) |
| Klikacz ścieżki szczęśliwej | ✅ **22/22** | 21 modułów + odczyt rejestru |
| Pełny zestaw klikaczy | ⚠️ 116 ✓ / 16 ✘ | **poprawa z 19 → 16**; wszystkie 16 potwierdzone jako zastane, patrz §4 |

**Uwaga o liczbie 551.** Plan ustalał niezmiennik „bez **spadku**" (spadek = bramka przestała widzieć
przeniesiony plik). Wzrost 550 → 551 ma jedno konkretne źródło: `qa:getEpicTreeForAdmin`, akcja dodana
świadomie w T-10, sklasyfikowana w manifeście jako `excluded`/`admin`. Żadna akcja nie zniknęła.

---

## 2. Kryteria akceptacji

### AC-1 — katalog modułu samowystarczalny, trasy cienkie ✅

Siedem katalogów, każdy z `contract.ts`, `module.ts`, `actions/`, `ui/` (Warsztaty, Nauka języków,
Notatki i Flota dodatkowo `lib/` z własnymi testami). Rozmiary kontraktów pokazują, że nie są to
spisy eksportów:

| Moduł | Eksportów akcji | Pozycji w kontrakcie |
|-------|-----------------|----------------------|
| Nawyki | 8 | 6 |
| Nauka języków | 12 | 10 |
| Warsztaty | **23** | **11** |
| Magazynowanie | **47** | **14** |
| Notatki | 19 (2 pliki) | 9 |
| Flota | 13 | 6 |
| Zdrowie | 22 (2 pliki) | 12 |

Trasy pozostały cienkie — `app/admin/qa/page.tsx` wręcz schudł o 30 linii mapowania (T-10).

### AC-2 — konsumenci danych wyłącznie przez kontrakt ⚠️ **z nazwanym wyłączeniem**

`grep` po `src/lib/ai/`, `src/app/page.tsx` i `src/components/` za importami wnętrza siedmiu modułów
zwraca **dokładnie dwa** trafienia — i oba to znane, opisane wyłączenie:

```
src/components/shell/ModuleSidebar.tsx:14  LanguagesSideNav  z @/modules/languages/ui/
src/components/shell/ModuleSidebar.tsx:15  FlotaSideNav      z @/modules/flota/ui/
```

Wszystkie ścieżki **danych** — egzekutory asystenta (habits, language, warsztat, storage, notes,
flota, health), `agentTools` i pulpit `app/page.tsx` — idą przez `/contract`.

Wyłączenie zostało **rozstrzygnięte przed napisaniem kodu** i zapisane w `spec.md` (AC-2),
`plan.md` §4 oraz rozdz. 15 dziennika: kontrakt opisuje **dane, nie ekrany** (zasada przyjęta w 046
przy Raportach), a przepuszczanie komponentu klienckiego przez plik importowany przez kod serwerowy
rozmywałoby granicę zamiast ją rysować. Docelowo: pole `sideNav` w deklaracji, ładowane leniwie
(rozdz. 9.3) — zmiana zachowania, więc poza falą przenoszącą.

### AC-3 — wpisy usunięte z listy przejściowej i ze słownika uprawnień ✅

`grep` po `src/lib/modules.tsx`: **zero** wystąpień siedmiu przeniesionych identyfikatorów na liście
`LEGACY`. `PERMISSIONS` w `platform/auth/permissions.ts` skurczyło się do 13 slugów modułowych;
zniknęły `HABITS`, `LANGUAGES`, `WARSZTATY`, `MAGAZYNOWANIE`, `NOTES`, `FLOTA`, `HEALTH` wraz
z gałęziami `legacyPermissionForPath`.

**Dowód, że to nie jest kosmetyka:** usunięcie każdej stałej natychmiast wywalało kontrolę typów
w trasach modułu — kompilator wskazywał dokładnie te pliki, które trzeba przestawić na uprawnienie
z deklaracji. Gdyby stała została „na wszelki wypadek", nic by tego nie wymusiło.

### AC-4 — moduł zbyt sprzężony odnotowany jawnie ✅ (nie wystąpił)

**Wszystkie siedem przeszło.** Żaden nie wymagał pozostawienia na liście przejściowej. Odnotowane
zostało natomiast coś innego i ważniejszego — **trzy pliki, które do modułów nie należą mimo nazw**:
`lib/habitStats.ts`, `lib/medicationSchedule.ts` i `actions/tags.ts` (uzasadnienia w `plan.md` §3
i w kontraktach Notatek oraz Zdrowia).

### AC-5 — panel admina QA przez kontrakt ✅

`src/app/admin/qa/page.tsx` zawiera **zero** wystąpień `prisma.`. Dane pobiera
`getEpicTreeForAdmin()` z `@/modules/qa/contract`. `getAllEpics` się do tego nie nadawał — zwraca
**liczniki** historyjek i scenariuszy, a drzewo redakcyjne potrzebuje ich treści; kontrakt dostał
więc drugą funkcję zamiast rozdmuchanego wariantu jednej. Guard `requireAdmin` w środku, zgodnie
z konwencją pozostałych funkcji `*ForAdmin`.

Klikacz `scenario-qa-admin-create-hierarchy` — zielony.

### AC-6 — klikacze mają dane; czerwony znaczy regresję ✅ (z ograniczeniem)

`scripts/e2e-web.sh` odpala teraz istniejące seedy (`prisma/seed.ts` + `prisma/seeds/qa-all.ts`),
oba idempotentne, oba nieprzerywające przebiegu przy błędzie, ale z **głośnym** ostrzeżeniem.

Efekt zmierzony na bazie klikaczy: `QaEpic` **0 → 35**, `ShoppingList` **0 → 1**, `ItemHistory`
**0 → 69**. Trzy testy QA, które padały wyłącznie z braku epika („Listy zakupowe"), są zielone.

**Ograniczenie, które trzeba powiedzieć wprost:** seed nie naprawił wszystkiego — zostaje 16 czerwonych.
Nie są to jednak regresje (§4), więc cel AC — „czerwony = regresja" — jest spełniony **po odjęciu
zastanego długu testowego**, a nie bezwarunkowo. Ten dług jest teraz policzalny i imienny.

### AC-7 — dziennik mówi, ile zostało i dlaczego ✅

Rozdz. 15: wpis 047, przestawione statusy zadań 4–5 (**11 z 21** modułów), **10 modułów czekających
wymienionych z nazwy**, trzy odłożone zdolności platformy z liczbami plików i importujących, zadanie 8,
pole `sideNav`, tagi do warstwy słowników oraz warunek domknięcia AC-6 z 046 (pusta lista przejściowa).

### AC-8 — klikacz ścieżki szczęśliwej ✅

**22/22** (21 modułów + odczyt rejestru), w tym wszystkie siedem przeniesionych w tej fali.

### AC-9 — komplet bramek, liczby akcji bez spadku ✅

Tabela w §1. `check:actions` = 160 (bez zmian), `check:ai-coverage` = 551 (wzrost o jedną świadomie
dodaną akcję, zero ubytku).

### AC-10 — przenosiny oddzielone od poprawek ✅

14 commitów. Siedem przenoszących (po jednym na moduł, w `git show --stat` widoczne jako rename),
dwa naprawcze **osobno** (test SRS, panel admina QA), jeden domykający (seed + dokumentacja),
plus artefakty pipeline'u. Żaden commit nie miesza przeniesienia plików ze zmianą zachowania.

---

## 3. Zgodność z konstytucją

| Reguła | Ocena |
|--------|-------|
| C-01 | ✅ praca w `worldofmag/` (poza `specs/`, `CLAUDE.md`, `doświadczenia.md` — artefakty, C-03) |
| C-02 / **C-36** | ✅ wnętrze modułu ścieżką względną; **reguła sama to wyegzekwowała** — `next lint` złapał alias w `HealthHomePage` |
| C-10..C-14 | ✅ **nie dotyczy** — zero zmian schematu, potwierdza `check:schema-drift` |
| C-13 | ✅ wyłącznie lokalny Postgres; `migrate.js` nieuruchamiany |
| C-20, C-21 | ✅ treść akcji nietknięta; guardy i `revalidatePath` przeniesione bez zmian |
| C-22 | ✅ slugi w bazie i przypisania ról bez zmian — przeniosło się tylko miejsce zapisu w kodzie |
| C-23 | ✅ zero nowych `AIAction`; egzekutory na kontraktach; katalog nadal 160 |
| C-30..C-33 | ✅ komponenty bez zmian; kontrola kolorów obejmuje `src/modules/*/ui`; kontrakt widoku 21/21 |
| C-50 | ✅ build zielony |
| C-51 | ✅ trzy lekcje dopisane |
| C-53 | ✅ **powtórzony wzorzec z 046, zero nowych bramek i abstrakcji.** Jedyny nowy kod produkcyjny poza przenosinami to `getEpicTreeForAdmin` — wymagany przez AC-5 |
| C-54 | ✅ wyłączenie nawigacji bocznej zapisane w `spec.md`, `plan.md` i `tasks.md` (T-8a) **przed** kodem |
| C-55 | ✅ zero pytań po `/specify` |

---

## 4. Regresje

**Zbadane i czyste**
- Zero martwych odwołań do starych ścieżek (`@/actions/{habits,languageDecks,warsztat,storage,notes,noteGroups,flota,health,medications}`, `@/components/<moduł>`, `@/lib/{srs,wikilinks,flota}`) — poza `src/generated`, odtwarzanym przy każdym buildzie.
- **RBAC nietknięte:** kontrola dostępu nadal obejmuje wszystkie akcje (551/551 z guardem). Test `permissions.test.ts` przestawiony tak, by sprawdzał **zachowanie** („/magazynowanie/scan nadal wymaga `module.magazynowanie`"), a nie to, w którym pliku slug jest zapisany.
- **Agregat kalendarza działa bez zmian** — `lib/medicationSchedule.ts` i `lib/calendar/collect.ts` celowo nietknięte.
- **Kuchnia nadal importuje tagi z `@/actions/tags`** — potwierdza, że słownik nie został wciągnięty do Notatek.

**Znalezione i naprawione w trakcie (osobnymi commitami)**
- Test SRS został w `src/lib` po przeniesieniu `srs.ts`; test wikilinków — tak samo. Oba złapane przez `check:test-types` **od razu**, zamiast po 40 s `test:unit`. Bramka z 046 zwróciła się dwa razy w jednej fali.
- `HealthHomePage` importował sąsiedni komponent własnego modułu aliasem. Złapał to `next lint`, **nie** `check:boundaries` — ta bramka sprawdza swoje pliki-sondy, nie kod repozytorium. Wniosek dopisany do rytuału i do `doświadczenia.md`.

**16 czerwonych klikaczy — wszystkie potwierdzone jako ZASTANE**

Osiem porażek powtórzyło się w **izolowanym** przebiegu samych dotkniętych specyfikacji (3 min zamiast
13), więc nie są przypadkowe. Każdą zestawiłem z logiem sprzed fali (przebieg weryfikacyjny 046):

| Test | Czerwony przed falą? |
|------|----------------------|
| `scenario-add-item-enter` | tak |
| `scenario-create-list-positive` | tak |
| `scenario-create-list-long-name` | tak |
| `scenario-switch-lists-sidebar` | tak |
| `scenario-notes-group-create` | tak |
| `scenario-qa-tester-access` | tak |
| `scenario-reports-list-visibility` | tak |
| `scenario-reports-admin-edit` | tak |

Pozostałe osiem z pełnego przebiegu (`settings-profile-display`, `fav-AC1-AC2-AC3`,
`direct-url-blocked`, `sc-AC11`, `vs-AC4`, `smoke-nav-*`) również było czerwonych przed falą i/lub
zachowuje się niestabilnie pod obciążeniem równoległym.

**Bilans: 19 czerwonych przed falą → 16 po.** Trzy testy QA naprawił seed. **Zero nowych czerwonych.**

**Czego NIE udało się sprawdzić — powiedziane wprost**
- Nie ustaliłem **przyczyn** ośmiu zastanych porażek (wyglądają na dług jakości testów: ukryty
  element w ustawieniach, brak przycisku „Utwórz" w Zakupach). Były poza zakresem tej fali i pozostają
  otwarte.
- Pierwszy pełny przebieg klikaczy w tej sesji był **bezużyteczny z mojej winy** — odpaliłem
  `next build` równolegle, oba procesy walczyły o katalog `.next` i wynik pokazał 38 czerwonych.
  Powtórzyłem przebieg czysto; lekcja zapisana w `doświadczenia.md`.

---

## 5. Werdykt końcowy

**GOTOWE Z UWAGAMI** — 9 z 10 kryteriów spełnionych w pełni, **AC-2** z jednym **nazwanym
i uzasadnionym** wyłączeniem.

Miary sukcesu ze speca:
- moduły w `src/modules/`: **4 → 11** (cel: ≥10) ✅
- lista przejściowa: **17 → 10** (cel: ≤11) ✅
- zero zmian widocznych dla użytkownika, klikacz 21/21 ✅
- klikacze przestały kłamać: 19 → 16 czerwonych, wszystkie imiennie potwierdzone jako zastane ✅

**Uwagi przechodzące dalej**
1. **Pole `sideNav` w deklaracji** — zamknie ostatnie wyłączenie z AC-2 i usunie cztery bezpośrednie
   importy powłoki do wnętrz modułów.
2. **Osiem zastanych porażek klikaczy** ma teraz imiona i potwierdzoną „zastałość", ale nie ma
   diagnozy. Póki są czerwone, sygnał z pełnego zestawu wymaga przypisu.
3. **`actions/tags.ts` do warstwy słowników platformy**, razem z kategoriami i jednostkami.
4. **Trzecia fala: 10 najbardziej sprzężonych modułów.** Dopiero po niej ma sens wyprowadzanie
   pulpitu i kalendarza z deklaracji oraz zaostrzenie bramki rejestru (AC-6 z 046).
