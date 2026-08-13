# Weryfikacja: zakresy list idą po przestrzeniach — etap 3B krok 2

Spec: `spec.md` · Data: 2026-08-13

## 1. Bramki

| Komenda | Wynik |
|---------|-------|
| komplet bramek statycznych | ✅ **160 / 551 / 35 / 35** bez spadku |
| `check:schema-drift` | ✅ brak rozjazdu (realnie uruchomiony) |
| `check:workspace-mirror` · `check:workspace-fill` · `check:ownership-scope` | ✅ · ✅ 45/45 · ✅ 3 wyjątki |
| `check:test-types` · `tsc --noEmit` | ✅ · ✅ |
| `test:unit` | ✅ **701/701** (było 696) |
| `next lint` · `npm run build` | ✅ · ✅ **exit 0**, 22 bramki |

## 2. Kryteria akceptacji

**AC-1/AC-2 — te same rekordy (osobiste i zespołowe).** ✅
`ownershipScopeSwitch.integration.test.ts`: zbiory identyfikatorów policzone **starym** warunkiem
(para kolumn) i **nowym** (przestrzenie) na tym samym fixture są `deepEqual`. Fixture zawiera mój
zasób, zasób zespołu z moim członkostwem i zasób obcy.

**AC-3 — sierota widoczna dla właściciela.** ✅ Osobna asercja: rekord z `workspaceId = null`
i moim `ownerId` jest w zbiorze.

**AC-4 — dowód porównuje zbiory.** ✅ I ma **kontrolę własnej mocy**: czwarta asercja sprawdza, że
**bez** gałęzi po przestrzeniach zasób z wypełnioną przestrzenią **wypada** ze zbioru. Bez tego
test przechodziłby także wtedy, gdyby nowa gałąź nie działała — pułapka z 056, tym razem zamknięta
z wyprzedzeniem.

**AC-5 — liczba zapytań nie rośnie.** ✅ Zakres czyta `getAccessContext`, memoizowany **na czas
żądania** (052). `queryCount.integration.test.ts` zielony bez korekty oczekiwań.

**AC-6 — bramki i build, zero zmian dla użytkownika.** ✅ Tabela wyżej. 75 miejsc wywołań, wszystkie
mechaniczne; zero zmian w UI.

**AC-7 — dziennik.** ✅ Wpis „058" z tabelą trzech gałęzi i zakresem etapu 4.

## 3. Regresje

- **Trzy funkcje synchroniczne** (`ownershipOr` w Magazynie i Warsztatach, `ownedByWhere`
  w platformie) musiały stać się asynchroniczne — zakres wymaga odczytu. Kompilator wskazał
  wszystkie trzy; żadna nie miała innego konsumenta niż zapytania.
- **Dwa testy** asertowały **stary kształt** reguły. `isolation.test.ts` — poprawiony mechanicznie;
  `ownership.test.ts` — asercja o kształcie zastąpiona, bo pilnowała stanu, który zmieniamy
  świadomie. Równość zbiorów pilnuje odtąd dowód integracyjny.

## 4. Werdykt

**GOTOWE.** Siedem z siedmiu kryteriów, build exit 0.

**Etap 3 zadania 11 domknięty w całości**: 056 przełączyło rozstrzyganie, 058 — zakresy list.
Zostaje etap 4, ostatni.
