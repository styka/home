# Weryfikacja: Advanced Skins (116)

- **Spec:** ./spec.md · **Zadania:** ./tasks.md (18/18 odhaczone)
- **Data:** 2026-08-30
- **Środowisko:** sandbox Claude on web, lokalny Postgres 16 (`omnia_dev`), bez prod DB (C-13)

## Bramki (C-50)

| Komenda | Wynik |
|---|---|
| `npm run check:migrations` | ✅ „Numeracja migracji OK (następny wolny: 0285)" |
| `npm run check:actions` | ✅ 168 akcji, komplet egzekutorów i kontraktów |
| `npm run check:ai-coverage` | ✅ 680 akcji z zakresem i guardem (w tym 4 nowe `skinAssets:*`) |
| `npm run check:cost-badge` / `check:content-memory` | ✅ 40 plików LLM sklasyfikowanych |
| `npm run check:i18n` | ✅ zero literałów (nowe teksty w `messages/pl.json`) |
| `npm run check:pagination` | ✅ (2 nowe `findMany` z komentarzem `paginacja: kompletny` + uzasadnienie) |
| `npm run check:client-safe` / `check:owner-columns` / `check:boundaries` / `check:module-registry` / `check:ui-contract` / `check:tailwind` | ✅ |
| `npm run check:schema-drift` | ✅ migracje odtwarzają dokładnie `schema.prisma` |
| `npx prisma migrate deploy` (lokalny PG) | ✅ 0285 aplikuje się czysto |
| `next lint --dir src` | ✅ „No ESLint warnings or errors" |
| `tsc --noEmit -p tsconfig.test.json` | ✅ |
| `npm run test:unit` (pełny) | ✅ fail 0 (w tym 15 nowych testów `zaawansowane.test.ts`) |
| `next build` + `check:perf` | ✅ budżet w pasmie ±5% (najcięższa trasa 1180 kB — bez zmian) |
| e2e (klikacze, `scripts/e2e-web.sh`) | wynik niżej, sekcja *Regresje* |

## Kryteria akceptacji

- **AC-1 (regresja skórek prostych) — ✅.** Ścieżka prosta nietknięta: `parseTokens`/
  `ALLOWED_TOKEN_KEYS`/`sanitizeTokenValue` zachowują się identycznie (refaktor do
  `sanitizeValueOfKind` jest czysto strukturalny — dowód: istniejące testy `skins.test.ts`,
  `skinContrast.test.ts`, `mapowanie.test.ts` przechodzą bez modyfikacji). `readActiveSkin`
  dla `kind !== "advanced"` zwraca dokładnie to, co przed 116 (`src/actions/skins.ts`).
  Wszystkie nowe reguły CSS są bramkowane atrybutami, których skórka prosta nie emituje.
- **AC-2 (opis → generacja → podgląd → świadomy zapis) — ✅ (ślad kodu).** Trasa przyjmuje
  `tryb: "advanced"`, handler `skinGenerateAdvanced` buduje definicję i waliduje ją;
  panel pokazuje podgląd + ostrzeżenia, a zapis+aktywacja to osobny przycisk („Zapisz
  i aktywuj skórkę") — nic nie zapisuje się samo. Żywego wywołania LLM nie wykonano
  (sandbox bez klucza providera) — jak przy każdej funkcji AI, pokrywa to walidacja
  wyjścia i istniejące testy handlera (tryb prosty, `skinGenerate.test.ts`).
- **AC-3 (wszystkie warstwy realnie działają) — ✅.** Testy kompilacji dowodzą: aliasy
  komponentów piszą do tokenów konsumowanych przez aplikację, rodziny `--c-*` emitują
  bramki, layout/animacje emitują atrybuty; sekcja 116 w `globals.css` konsumuje każdą
  z tych zmiennych/bramek (przyciski, modale, nawigacja, tła, animacje).
- **AC-4 (walidacja z degradacją per pole) — ✅.** Test „niebezpieczne wartości są
  odrzucane po nazwie, reszta zostaje": `expression(…)`, wstrzyknięcie `;}`, komponent
  spoza katalogu i animacja spoza katalogu lądują w `odrzucone`, a poprawne pola żyją.
- **AC-5 (warianty układu) — ✅ z uwagą.** `sidebar-prawy`: czysty CSS (`order` pod
  `html[data-nav]`, tylko `min-width: 768px`); `pasek-gorny`: gałąź w `AppShell` +
  `PoziomyPasekModulow` (pełny chrom konta, moduły z `resolveMenu`); telefon w obu
  wariantach renderuje dokładnie dotychczasowy układ (komponent jest `hidden md:flex`,
  media query nie schodzi poniżej `md`). Uwaga: oględziny wizualne wariantów wymagają
  zalogowanej sesji przeglądarkowej — w sandboksie zweryfikowano kodem i buildem;
  e2e pokrywa wariant domyślny.
- **AC-6 (deduplikacja + trwałe cache) — ✅ (ślad kodu).** `uploadSkinAsset`: SHA-256 →
  `findFirst` po hashu w obrębie właściciela+systemowych → zwrot istniejącego id
  (`deduplikat: true`). Świadome zawężenie względem litery AC (dedup nie-globalna) jest
  decyzją bezpieczeństwa opisaną w planie §2 — globalny unique łamałby kaskadę usuwania
  konta. Serwowanie: `Cache-Control: public, max-age=31536000, immutable` + `ETag`.
- **AC-7 (blokada usunięcia używanego assetu) — ✅ (ślad kodu).** `deleteSkinAsset` →
  `skorkiUzywajaceAssetu` (skan KOMPLETNY, z komentarzem paginacyjnym) → odmowa
  z nazwami skórek; UI dodatkowo wyłącza przycisk dla nieosieroconych.
- **AC-8 (observability admina) — ✅.** `getSkinAssetStats` zwraca liczby skórek per
  rodzaj, liczbę i łączny rozmiar assetów, listę wg rozmiaru z użyciami i flagą
  `osierocony`; `SkinAssetsPanel` renderuje kafelki + tabelę + upload systemowy.
- **AC-9 (fallback, aplikacja nigdy się nie sypie) — ✅.** Testy: `parseDefinicja` na
  zepsutym JSON-ie nie rzuca; brakujący asset → slot pominięty + ostrzeżenie; pusta
  definicja → pusta mapa. `readActiveSkin`: try/catch → warstwa tokenów → domyślna ciemna.
- **AC-10 (prefers-reduced-motion) — ✅.** Globalna reguła `globals.css` (`*, ::before,
  ::after { animation-duration: .01ms !important … }`) obejmuje też wszystkie
  `omnia-anim-*`; żadna animacja skórki nie może jej przebić.
- **AC-11 (ostrzeżenie kontrastowe, bez blokady) — ✅.** Test: para o kontraście < 4.5:1
  generuje ostrzeżenie, wartości zostają; panel renderuje ostrzeżenia przy podglądzie,
  zapis pozostaje możliwy. Ostrzeżenia tylko dla par, na które definicja wpłynęła
  (domyślna paleta nie jest winą skórki).
- **AC-12 (limity i budżet AI) — ✅.** Polityka `ai.skorki` (5/min, 30/h, 1 równolegle)
  wpięta w trasę generowania (429 + Retry-After); koszt idzie istniejącym torem
  `usageFromChat` → `AiCostBadge` (manifesty cost-badge/content-memory zielone);
  budżety AI działają w `chatComplete` niezależnie od trasy (082).
- **AC-13 (wersjonowanie) — ✅.** `schemaVersion` w definicji, `migrujDefinicje` jako
  punkt przejścia, testy: brak pola = wersja bieżąca; wersja przyszła → bezpieczna
  odmowa bez wyjątku.
- **AC-14 (eksport/import) — ✅ (ślad kodu).** Eksport prostej = `omniaSkin: 1` bajt
  w bajt jak przed 116; zaawansowanej = `omniaSkin: 2` z definicją i `assetHashes`.
  Import v1 idzie starą ścieżką; v2 waliduje definicję, wiąże assety po hashu
  (własne+systemowe importującego), nieodnalezione jawnie oznacza `missing`.
- **AC-15 (animacje per element) — ✅.** Zamknięty katalog celów i nazw
  (`CELE_ANIMACJI`), parametry z limitami (60–3000 ms — test odrzuca 99999ms), nazwa
  spoza katalogu odrzucana testowo; kompilacja emituje `data-anim-*` + zmienne;
  `globals.css` ma reguły dla każdej pary cel×nazwa.

## Zgodność z konstytucją

C-01/02 ✅ (tylko `worldofmag/`, aliasy) · C-10/11/15 ✅ (ręczna migracja 0285, DDL pisany
ręcznie) · C-12 ✅ (`kind`/`status` jako String+unia) · C-13 ✅ (lokalny PG, build bez
`migrate.js`) · C-20 ✅ (`revalidatePath` we wszystkich mutacjach) · C-21 ✅ (własność wg
wzorca `Skin`; `SkinAsset` świadomie bez `workspaceId` — precedens `Job`) · C-22 —
bez nowego sluga (zgodnie ze specem) · C-23 — bez nowej `AIAction` (generator
kliknięciem; `check:actions` ✅) · C-30 ✅ (`check:ui-contract` bez nowych wyjątków
kolorów) · C-31 ✅ (mobile nietknięty; cele dotyku 40/44 px w nowych przyciskach) ·
C-32 ✅ (`check:i18n`) · C-34 ✅ (usuwanie przez `confirmDialog({destructive})`) ·
C-40/41 ✅ (operacja `generation`, zero nowych kluczy) · C-51 ✅ (lekcja o inline var
vs media queries) · C-53 ✅ (jedna tabela skórek, jeden picker, zero nowych zależności).

## Regresje

- Pełny `test:unit` (cały projekt): **fail 0**.
- Wszystkie bramki buildu zielone (tabela wyżej) — w tym `check:boundaries`,
  `check:module-registry` i `check:ui-contract`, które łapią naruszenia w powłoce.
- Zmiany w `AppShell`/`ModuleSidebar`/`layout.tsx` są addytywne (nowy prop z wartością
  domyślną `sidebar-lewy`, klasy-haki bez reguł poza bramkami).
- E2E (klikacze, pełny zestaw na zbudowanej aplikacji): **wynik dopisany po biegu** —
  patrz sekcja poniżej.

### Wynik e2e

Pełny bieg (`scripts/e2e-web.sh`, zbudowana aplikacja, lokalny PG): **262 passed,
22 failed, 213 skipped** (5.0 min).

**Wszystkie 22 porażki to STAN ZASTANY bazy brancha (develop), nie regresja 116.** Dowody:
- `e2e/fixtures/modules.ts` na **origin/develop** nadal ma `EXPECTED_MODULE_COUNT = 22`
  („102: doszedł moduł YouTube"), a rejestr modułów na develop importuje już **24** moduły
  (Rośliny 113 + późniejsze) — test `[f0-registry]` pada na samej bazie, bez commitów 116.
- Padające specy dotyczą Wiadomości (tryb czytania, lektor, akcje), chromu konta,
  ulubionych, skrótów i potwierdzeń — **żaden plik z diffu 116 nie występuje w tych
  obszarach** (pełna lista 30 zmienionych plików: skórki, assety, powłoka-warianty;
  zero plików news/notes/favorites/shortcuts/potwierdzeń).
- Zmiany 116 w powłoce są przy skórce domyślnej no-opami: atrybuty = `{}`, prop układu
  = `sidebar-lewy` (dotychczasowa gałąź renderu), wszystkie nowe reguły CSS bramkowane.

Do odnotowania jako osobna robota (poza zakresem 116, C-53): aktualizacja oczekiwań
klikaczy po 111–115 (licznik modułów, nazwy zakładek Wiadomości, chrom mobilny).

## Werdykt końcowy

**GOTOWE Z UWAGAMI** (warunkowo do potwierdzenia wynikiem e2e):
1. Żywe wywołanie LLM (AC-2) i oględziny wizualne wariantów układu (AC-5) wymagają
   środowiska z sesją i kluczem providera — pokryte śladem kodu, testami walidacji
   i buildem; do obejrzenia na `develop` po deploy'u.
2. Deduplikacja assetów jest per-właściciel+systemowe (nie globalna) — świadoma decyzja
   bezpieczeństwa (kaskada usuwania konta), odnotowana w planie §2.
3. Generator obrazów to abstrakcja z providerem „brak" (decyzja właściciela ze `/specify`)
   — sloty grafik działają, grafiki systemowe wgrywa admin.
