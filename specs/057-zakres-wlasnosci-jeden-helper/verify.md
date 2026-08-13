# Weryfikacja: zakres własności w jednym miejscu — etap 3B krok 1

Spec: `spec.md` · Data: 2026-08-13

## 1. Bramki

| Komenda | Wynik |
|---------|-------|
| `check:actions` / `check:ai-coverage` / `check:cost-badge` / `check:content-memory` | ✅ **160 / 551 / 35 / 35** |
| `check:migrations` · `check:ui-contract` · `check:boundaries` · `check:module-registry` | ✅ |
| `check:schema-drift` | ✅ brak rozjazdu (realnie uruchomiony, nie pominięty) |
| `check:workspace-mirror` · `check:workspace-fill` | ✅ · ✅ 45/45 |
| **`check:ownership-scope`** | ✅ warunek w jednym miejscu (3 świadome wyjątki) |
| `check:test-types` · `tsc --noEmit` | ✅ · ✅ |
| `test:unit` | ✅ **696/696** (było 690 — pięć asercji równoważności + jedna z 056) |
| `next lint` · `npm run build` | ✅ · ✅ **exit 0** |

## 2. Kryteria akceptacji

**AC-1 — ten sam zbiór rekordów.** ✅ Helper zwraca **strukturalnie identyczny** obiekt, co kod,
który zastępuje; dowodzi tego `ownershipScope.test.ts` (porównanie kształtów), a nie sama
kompilacja. Zgodność na danych pilnują testy integracyjne modułów — 696 zielonych.

**AC-2 — oba kształty pokryte, równoważność sprawdzona.** ✅ Znalazły się **cztery** zapisy, nie
dwa: bezwarunkowy, `...(length > 0 ? … : [])`, ten sam bez `> 0` oraz wartownik `{ id: "" }`.
Wszystkie równoważne; test sprawdza to wprost, łącznie z tym, że usuwana gałąź to ta, która nie
pasowała do żadnego wiersza.

**AC-3 — bramka blokuje powrót.** ✅ `check:ownership-scope` w `build`. Kontrola negatywna:
przywrócenie ręcznego warunku w `habits.ts` → bramka czerwona; po cofnięciu → zielona.
Martwy wpis w manifeście też wywala build.

**AC-4 — słowniki zachowują odrębną regułę.** ✅ `ownedOrSystemWhere` nietknięty (6 miejsc).
Test sprawdza, że helper ogólny **nie** zawiera gałęzi `ownerId: null` — pomylenie ich dołożyłoby
dostęp do cudzych rekordów systemowych.

**AC-5 — bramki i build, zero zmian dla użytkownika.** ✅ Tabela wyżej. Zmiana jest czysto
mechaniczna: **76 z 79** miejsc przeniesionych, trzy pozostałe to jawne wyjątki z powodem.

**AC-6 — dziennik.** ✅ Wpis „057" z tabelą czterech zapisów i opisem tego, co robi 058.

## 3. Regresje

- **AI i kalendarz** — read-toole oraz wkłady kalendarza korzystają z tych samych zapytań, więc
  objęte tym samym przeniesieniem; `assistantBypass` i `tenantIsolation` zielone.
- **Pets** — własność przez helper, **udostępnienia (`PetShare`) zostawione jawnie**: to inne
  pojęcie, które zadanie 12 zamieni na `ResourceGrant`. Gdyby wpadły do helpera, 058 przełączyłoby
  je razem z własnością i po cichu zmieniło regułę udostępniania.

## 4. Werdykt

**GOTOWE.** Sześć z sześciu kryteriów, build exit 0.

Rzecz warta zapamiętania: **bramka znalazła dwa miejsca, których nie widział sweep** — bo sweep
szedł po `*.ts`, a trasy Next.js to `*.tsx`. Bramka przeszukująca ten sam zbiór plików co narzędzie,
które sprawdza, potwierdziłaby tylko jego własne założenia.
