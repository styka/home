-- Raport implementacji 2026-06-02 (moduł Magazynowanie).
-- → widoczny w /admin/reports oraz /reports. INSERT idempotentny: ON CONFLICT (slug) DO NOTHING.

INSERT INTO "Report" ("id", "title", "slug", "content", "category", "authorId", "createdAt", "updatedAt")
VALUES (
  gen_random_uuid()::text,
  'Omnia — Raport implementacji 2026-06-02',
  'omnia-implementacja-2026-06-02',
  $omnia_magazynowanie$# Omnia — Raport implementacji 2026-06-02

Sesja zrealizowała jedno zgłoszenie: **nowy moduł „Magazynowanie"** — ogólny magazyn dla
domu, firmy i gospodarstwa (rzeczy po garażach, strychu, szafach), będący odpowiednikiem
kuchennej spiżarni, ale **nie food-centric** i skalujący się od użytku osobistego po
zaawansowaną obsługę magazynów firmowych, sklepowych, hurtowni i obiegu kurierskiego.

Przed implementacją doprecyzowano z administratorem: ma to być **osobny moduł** (kuchenna
Spiżarnia bez zmian), z czterema funkcjami v1 — inwentaryzacja ze zdjęć (AI), stan minimalny /
uzupełnianie, tryb spisu (stocktake), CRUD + lokalizacje — oraz modelem danych unoszącym
**wiele magazynów, SKU i dziennik ruchów**.

## Magazynowanie (nowy moduł)
**Diagnoza:** brakowało ogólnego magazynu na rzeczy domowe/firmowe. Kuchenna spiżarnia
(`PantryItem`) jest food-centric (daty ważności, produkty), więc nie nadawała się do
przedmiotów po garażach/strychu/szafach ani do magazynów firmowych.

**Rozwiązanie:** dodano osobny moduł `/magazynowanie` (uprawnienie `module.magazynowanie`)
zbudowany na sprawdzonych wzorcach istniejących modułów:
- **Model danych** dwupoziomowy: `StorageItem` (nazwa, SKU/kod, kategoria, **magazyn
  nadrzędny** `warehouse` + **lokalizacja** `location`, ilość/jednostka, **stan minimalny**,
  notatki, własność `ownerId`/`ownerTeamId`) oraz `StorageMovement` — **dziennik ruchów**
  (delta ze znakiem + powód: przyjęcie/wydanie/korekta/spis). Dwupoziomowość
  (magazyn → lokalizacja) i ruchy to celowe ukłony w stronę obsługi firmowej / obiegu
  kurierskiego, przy zachowaniu prostoty dla zwykłego użytkownika.
- **Inwentaryzacja ze zdjęć (AI):** świadomie powtórzono **dwuetapowy** schemat z importu
  przepisu (`kitchen/ocr-image`): krok 1 model wizyjny (`op: "vision"`) wylicza widoczne
  przedmioty, krok 2 model tekstowy (`op: "generation"`, tryb JSON) strukturyzuje listę.
  Pojedynczy strzał „zdjęcie → sztywny JSON" bywa zawodny — rozdzielenie „patrzenia" od
  „układania" jest pewniejsze. Zdjęcie jest **przejściowe** (nie zapisujemy base64 w bazie),
  downscaling po stronie klienta (~1400 px, JPEG 0.82).
- **Uzupełnianie:** sekcja „Do uzupełnienia" (pozycje poniżej stanu minimalnego) z akcją
  dodania braków do wybranej listy zakupów — analogicznie do `autoReplenishToList` ze spiżarni,
  z reużyciem `assertListAccess` i reguł kategoryzacji (`categorize`).
- **Tryb spisu:** masowe wpisanie ilości naraz; różnice trafiają do dziennika jako korekta
  „spis", więc historia stanu pozostaje spójna.

Dlaczego tak: maksymalne reużycie wzorców (`pantry`, OCR przepisu, integracja z zakupami,
schemat ownership + `getUserTeamIds`) skraca powierzchnię błędu i utrzymuje spójność UX
(ciemny motyw, te same komponenty, klawiszowy minimalizm). Wybór dziennika ruchów zamiast
samego pola ilości daje audyt przyjęć/wydań wymagany w kontekście firmowym, bez komplikowania
ścieżki osoby prywatnej (zwykłe +/− albo spis).

**Zmienione pliki:**
- `prisma/schema.prisma` — modele `StorageItem`, `StorageMovement` + relacje w `User`/`Team`.
- `prisma/migrations/0069_magazynowanie_module/migration.sql` — tabele, indeksy, FK oraz seed
  uprawnienia `module.magazynowanie` (grant ADMIN), idempotentnie.
- `src/actions/storage.ts` — server actions: `getStorageItems`, `getLowStock`, CRUD,
  `adjustStorageQuantity` (ruch + log), `bulkSetStorageQuantities` (spis),
  `bulkAddStorageItems` (po skanie), `addLowStockToShoppingList` (uzupełnianie).
- `src/app/api/llm/magazynowanie/scan/route.ts` — endpoint AI (dwuetapowy vision→generation).
- `src/lib/llm-client.ts` — namespace `llm.magazynowanie.scan`.
- `src/components/magazynowanie/` — `StorageList`, `StorageEditSheet`, `StockTakeMode`,
  `StorageScan` (ciemny motyw, zmienne CSS).
- `src/app/magazynowanie/{page,stocktake/page,scan/page}.tsx` — trasy z guardem uprawnień.
- `src/lib/modules.tsx`, `src/lib/permissions.ts`, `scripts/migrate.js` — rejestracja modułu
  i uprawnienia (`module.magazynowanie`, ikona `Warehouse`).
- `src/actions/activity.ts` — rozszerzenie unii modułów o `magazynowanie`.
- `CLAUDE.md` — tabela modułów, Route Structure, lista uprawnień, schemat DB, namespace LLM.

## Podsumowanie
Jedno zgłoszenie, jeden duży nowy moduł. Główne obszary zmian: schemat DB + migracja,
warstwa server actions, endpoint LLM (wizja) i komplet UI z trzema trasami. Implementacja
maksymalnie korzysta z istniejących wzorców (spiżarnia, OCR przepisu, integracja z zakupami,
model ownership/zespołów), więc moduł od startu obsługuje współdzielenie z zespołem oraz
skaluje się od użytku domowego po magazyny firmowe (SKU, wiele magazynów, dziennik
przyjęć/wydań). Build produkcyjny (`next build`) przechodzi; trasy `/magazynowanie`,
`/magazynowanie/stocktake`, `/magazynowanie/scan` i endpoint skanu kompilują się poprawnie.
$omnia_magazynowanie$,
  'general',
  NULL,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("slug") DO NOTHING;
