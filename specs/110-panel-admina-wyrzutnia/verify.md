# Weryfikacja: Panel administratora jako pogrupowana wyrzutnia

- **Spec:** ./spec.md · **Plan:** ./plan.md · **Zadania:** ./tasks.md
- **Data:** 2026-08-27
- **Środowisko:** lokalny Postgres 16 w sandboxie (`omnia/omnia_dev` dla builda,
  `e2e/worldofmag_e2e` dla klikacza). **Nigdy** prod `DATABASE_URL` (C-13) — `scripts/migrate.js`
  świadomie pominięty.

## 1. Bramki

| Komenda | Wynik |
|---|---|
| `check:migrations` | ✅ — feature **nie dodaje migracji**, bramka bez nowego materiału |
| `check:actions`, `check:ai-coverage`, `check:cost-badge`, `check:content-memory` | ✅ — zero nowych akcji i wywołań LLM |
| **`check:admin-links`** (nowa) | ✅ `24 trasy /admin/* — każda ma wejście z panelu (26 pozycji w rejestrze, w tym 2 spoza /admin)` |
| `check:ui-contract` | ✅ |
| `check:i18n` | ✅ `zero tekstów zaszytych w komponentach (13 w plikach ze świadomym wyjątkiem)` |
| `check:route-gating`, `check:boundaries`, `check:module-registry` | ✅ |
| `check:schema-drift`, `check:owner-columns`, `check:pagination`, `check:logs`, `check:client-safe`, `check:e2e-waits` | ✅ |
| `next lint --dir src` | ✅ (tylko istniejące ostrzeżenia `exhaustive-deps`, żadne w nowych plikach) |
| `next build` | ✅ — `/admin` 6,01 kB (118 kB), `/admin/przeglad` zbudowany |
| `check:perf` | ✅ `najcięższa trasa 1174 kB, suma 69825 kB — w pasmie ±5%` — próg **nie wymagał zmiany** |
| `npm run test:unit` | ✅ **1290 pass / 0 fail** (7 nowych dla rejestru panelu) |
| Klikacz — spec 110 | ✅ **14/14** |
| Klikacz — 7 specek dotykających `/admin` | ✅ `54 passed / 2 failed` — obie awarie wcześniejsze, patrz §4 |

Pełny łańcuch buildu zakończył się `EXIT=0`.

### Próby mutacyjne (bramka, która przechodzi, musi umieć odmówić)

| Próba | Wynik |
|---|---|
| Usunięcie wpisu `llm` z rejestru | ✅ odmowa: `/admin/llm — strona panelu BEZ ODNOŚNIKA` |
| Wpis na nieistniejącą trasę | ✅ odmowa: `/admin/nieistniejaca — rejestr prowadzi do trasy, której nie ma na dysku` |
| Pusty rejestr | ✅ odmowa: `nic do porównania (tras na dysku: 24, wpisów w rejestrze: 0)` |
| Usunięcie klucza tekstu z `messages/pl.json` | ✅ test czerwienieje z nazwą brakującego klucza |

## 2. Kryteria akceptacji

### Wyrzutnia

| AC | Werdykt | Dowód |
|---|---|---|
| **AC-1** grupy z nazwą i opisem | ✅ | e2e `[110-AC1]`: `{"grup":7,"nazwyGrup":["Przegląd","Dostęp i bezpieczeństwo","Diagnostyka","AI i konfiguracja","Treść i wygląd","Dokumentacja projektu","Narzędzia dewelopera"],"pozycjiZOpisem":26}` — siedem grup, wszystkie nazwane, 26 pozycji z opisem |
| **AC-2** nagłówek widoczny z zawartością | ✅ | e2e `[110-AC2]`: odstęp nagłówek→pierwsza pozycja wynosi **10 px w każdej z siedmiu grup** (próg 80). Grupa nie jest „jedną listą pod jednym nagłówkiem" |
| **AC-3** każda trasa ma odnośnik | ✅ | **bramka** `check:admin-links` (24/24, sprawdzana w obie strony, trzy próby mutacyjne) + e2e `[110-AC3]`: 25 wejść, w tym `/admin/llm`, `/admin/qa`, `/admin/przeglad` i `/services/moderation` |
| **AC-4** jedno kliknięcie | ✅ | e2e: klik pozycji „Skórki systemowe" → `pathname === "/admin/skins"` |
| **AC-5** brak uprawnienia → odesłanie | ✅ | e2e `gating.spec.ts [scenario-admin-non-admin-blocked]` zielony; obie trasy wołają `hasPermission(session, PERMISSIONS.ADMIN)` → `redirect("/")` **jawnie**, nie przez sąsiedztwo ścieżki; test jednostkowy potwierdza `legacyPermissionForPath` dla `/admin`, `/admin/przeglad` i wszystkich 24 tras |

### Wyszukiwarka

| AC | Werdykt | Dowód |
|---|---|---|
| **AC-6** prowadzi do narzędzia | ✅ | e2e: „skorka" → `["/admin/skins"]` (1 z 26), klik → `/admin/skins` |
| **AC-7** bez diakrytyków | ✅ | e2e: „skorka"→`/admin/skins`, „zrodla"→`/admin/zrodla-rss`, „dostep"→`/admin/access`. Plus 8 testów jednostkowych `bezOgonkow`/`pasujeDoFrazy` (wspólne z Ustawieniami i nawigacją) |
| **AC-8** brak trafień → stan pusty | ✅ | e2e `[110-AC8]`: widoczne „Nic nie pasuje do tej frazy", a liczba grup spada do **0** — pusta grupa nie zostaje z samym nagłówkiem |

### Przegląd systemu

| AC | Werdykt | Dowód |
|---|---|---|
| **AC-9** panel bez buildu, liczników i sesji | ✅ | e2e `[110-AC9]`: po warunku pozytywnym (widoczna pozycja „Skórki") treść `main` **nie zawiera** „Data buildu", „Aktywność (7 dni)" ani „User ID" |
| **AC-10** przegląd niesie wszystko | ✅ | e2e `[110-AC10]`: pętla po **19 etykietach** (5 pól buildu + 11 liczników + 3 pola sesji) — każda obecna. Nie „na oko", tylko lista z nazwy |
| **AC-11** panel bez zapytań zliczających | ✅ | `grep -c 'count(' src/app/admin/page.tsx` → **0**. Jedenaście `count()` żyje wyłącznie w `src/app/admin/przeglad/page.tsx` |

### Powrót, rama, telefon

| AC | Werdykt | Dowód |
|---|---|---|
| **AC-12** powrót z każdej strony | ✅ | e2e `[110-AC12]`: pętla po **24 trasach**, każda ma widoczny `main a[href="/admin"]`. Przed zmianą brakowało go na `access`, `llm`, `user-facts` |
| **AC-13** rama widoku | ✅ | e2e `[110-AC13]`: `/admin` i `/admin/przeglad` mają **dokładnie jeden** `<h1>` w `main`; przegląd ma okruszek do panelu. Ręcznie rysowany `<h1>` z dawnego `/admin` zniknął |
| **AC-14** kolory ze zmiennych | ✅ | `grep` po hexach w ośmiu nowych/przepisanych plikach → **zero trafień** |
| **AC-15** telefon | ✅ | e2e `[110-AC15]`: `{"nadmiarPoziomy":0,"kolumn":1,"zaMale":0}` — brak przewijania w poziomie, jedna kolumna, każdy cel dotyku ≥ 44 px |
| **AC-16** teksty przez słownik | ✅ | `check:i18n` zielony; test jednostkowy sprawdza **78 kluczy** narzędzi (26 × 3) + 7 nazw grup — potwierdzony próbą mutacyjną |

## 3. Zgodność z konstytucją

| Reguła | Ocena |
|---|---|
| C-01 (praca w `worldofmag/`) | ✅ |
| C-10..C-14 (migracje) | ✅ nie dotyczy — brak zmian schematu, zapisane wprost w planie i zadaniach |
| C-20..C-25 | ✅ zero nowych akcji i mutacji; brak `AIAction`; RBAC bez poszerzenia; kosz i audyt nie dotyczą |
| C-30 (motyw) | ✅ zero hexów w nowym kodzie |
| C-31 (mobile-first) | ✅ jedna kolumna na telefonie, cele dotyku ≥ 44 px, brak przewijania w poziomie |
| C-32 (teksty) | ✅ `check:i18n` + test kluczy dynamicznych |
| C-33 (kontrakt widoku) | ✅ `ModuleView` ze `state` na obu nowych widokach; **rama nie została poszerzona** |
| C-35 (komponent z konsumentem) | ✅ `szukanie.ts` — trzech konsumentów od pierwszego commita; `PowrotDoPanelu` — cztery. **W drugą stronę też:** `FeedbackTriggerButton` skasowany, bo po przepisaniu listy został bez konsumenta |
| C-36 (granice) | ✅ rejestr trzyma **adresy**, nie importuje wnętrza modułów — `/services/moderation` wchodzi jako napis |
| C-51 (lekcje) | ✅ dwa wpisy w `doświadczenia.md` |
| C-53 (minimalizm) | ✅ zero nowych zależności; treść przeglądu przeniesiona 1:1; **T-11 świadomie odpadła** zamiast przepisywać 20 działających plików |
| C-54 (spójność artefaktów) | ✅ dwie korekty ze śladem: kryterium T-1 (grep NFD) i liczba stron bez powrotu (11 → 3) |

**Naruszeń nie stwierdzono.**

## 4. Regresje

**Klikacz na siedmiu speckach dotykających `/admin`:** `54 passed / 2 failed`.

| Test | Ocena |
|---|---|
| `chrom-konta [085-AC1]` („dzwonek zostaje w górnym pasku") | **wcześniejszy** — identyczny komunikat jak w biegu odniesienia z przebiegu 109 (na kodzie sprzed 109). Przyczyna znana i zapisana: wzorzec `/Powiadomienia/i` unieważniony przez 107, które zamieniło dzwonek w „Skrzynkę" |
| `chrom-konta [085-AC4]` („widok musi mieć co przewijać") | **wcześniejszy** — jw. |
| `admin-settings`, `gating`, `qa`, `reports`, `smoke` | ✅ zielone — w tym `[scenario-admin-non-admin-blocked]` |

110 nie dotykało chromu konta ani paska widoku, a komunikaty awarii są **co do znaku** takie same
jak w udokumentowanym biegu odniesienia. Liczba czerwonych testów nie wzrosła.

**Sprawdzone poza klikaczem:**
- **Migracje/schemat:** brak zmian, `check:schema-drift` zielony.
- **RBAC:** obie trasy panelu sprawdzają uprawnienie jawnie; test jednostkowy pokrywa 26 ścieżek.
- **Wspólne komponenty:** `bezOgonkow`/`pasujeDoFrazy` mają teraz jedną definicję i trzech
  konsumentów (Ustawienia, nawigacja, panel) — testy wszystkich trzech przechodzą bez zmian
  w asercjach (7 + 8 + 7).
- **`revalidatePath`:** nie dotyczy — zero nowych mutacji.
- **Usunięty komponent:** `FeedbackTriggerButton` nie ma już żadnego importu w `src/`; tryb
  wskazywania elementu startuje z panelu, skrótem `Ctrl+Shift+B` i przyciskiem w górnym pasku —
  bez zmian w tych dwóch ostatnich drogach.

## 5. Uwagi (nie blokują, świadomie poza zakresem)

1. **Trzy różne etykiety powrotu do panelu.** Pomiar z AC-12 pokazał: „Admin" (13 stron),
   „Panel admina" (5), „Panel administratora" (2 — nowe). Wszystkie prowadzą do `/admin` i wszystkie
   działają, więc kryterium jest spełnione, ale nazwa tej samej rzeczy jest trojaka. Ujednolicenie
   dotyka osiemnastu plików w różnych miejscach układu — osobna, świadoma zmiana (C-53), zgłoszona
   tutaj, nie zrobiona „przy okazji".
2. **Dwadzieścia stron panelu nadal rysuje własny nagłówek**, poza kontraktem widoku. Panel jest
   wyłączony z `check:ui-contract` (`NOT_MODULES`), więc to nie jest dług wobec bramki. `/admin`
   i przegląd weszły do ramy, bo i tak były pisane od nowa; pozostałe to praca na osobny przebieg.
3. **`/admin/llm` stracił powrót do `/admin/config`** na rzecz powrotu do panelu. Świadome: po 110
   panel wymienia konfigurację i modele obok siebie w tej samej grupie, więc `config` jest stąd dalej
   o jedno kliknięcie, a reguła powrotu jest jednakowa na wszystkich 24 stronach. Ścieżka
   `config → llm` działa bez zmian.

## 6. Werdykt końcowy

**GOTOWE Z UWAGAMI.**

Wszystkie **16 kryteriów akceptacji spełnione i zmierzone**, bramki zielone (`build EXIT=0`,
1290 testów jednostkowych, klikacz 14/14 dla nowego speca, brak regresji). Trzy uwagi wyżej są
świadomie poza zakresem i żadna nie dotyczy kryterium ze speca.

Rzecz, którą warto zapamiętać z tego przebiegu: zgłoszenie mówiło o *długości* widoku, a pomiar
wyciągnął z niego coś ostrzejszego — **trasa `/admin/llm` nie miała odnośnika z żadnego miejsca
w aplikacji**. Dlatego kompletności pilnuje teraz bramka licząca fakty z dysku, a nie lista
prowadzona ręcznie: objaw takiej usterki jest żaden, więc następna osierocona strona zostanie
wykryta przy pierwszym buildzie, a nie odkryta po miesiącach.
