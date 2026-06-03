-- Raport: pełna dokumentacja modułu Magazynowanie + roadmapa AI (2026-06-03).
-- → widoczny w /admin/reports oraz /reports. INSERT idempotentny: ON CONFLICT (slug) DO NOTHING.

INSERT INTO "Report" ("id", "title", "slug", "content", "category", "authorId", "createdAt", "updatedAt")
VALUES (
  gen_random_uuid()::text,
  'Magazyn — pełna dokumentacja funkcji + roadmapa AI',
  'magazyn-dokumentacja-i-roadmapa-ai',
  $mag_doc$# Magazyn (Magazynowanie) — pełna dokumentacja i roadmapa AI

> Dokument referencyjny modułu **Magazynowanie** systemu Omnia (WorldOfMag).
> Pisany tak, by zarówno człowiek, jak i model językowy (asystent AI) mógł w pełni
> zrozumieć zakres, model danych, przepływy i punkty integracji. Stan na 2026-06-03
> (Magazynowanie 2.0 — tryby Dom/Pro).

---

# Rozdział 1. Co potrafi moduł Magazyn — pełny opis funkcji

## 1.1. Cel i pozycjonowanie

Magazyn to **uniwersalny system ewidencji rzeczy** — od domowego (garaż, strych, piwnica,
szafy) po profesjonalny (firma, sklep, hurtownia, obieg kurierski). W odróżnieniu od kuchennej
**Spiżarni** (food-centric: produkty, daty ważności, przepisy) Magazyn jest ogólny: operuje
pozycjami z magazynem nadrzędnym, lokalizacją, kodami (SKU/EAN), wartością, dziennikiem ruchów
oraz — w trybie pro — dostawcami, dokumentami, zamówieniami, analityką i partiami.

Dostęp: uprawnienie `module.magazynowanie` (lub `ADMIN`). Sprawdzane w `layout.tsx` modułu.
Współdzielenie zasobów: wzorzec `ownerId` (użytkownik) / `ownerTeamId` (team), rozłączny —
każda pozycja, dostawca, dokument i zamówienie należy do użytkownika albo do teamu.

## 1.2. Tryby Dom ↔ Profesjonalny

Tryb jest **preferencją użytkownika** (model `StorageSettings`, pole `mode` = `home`|`pro`,
plus `currency`), a NIE uprawnieniem RBAC. Domyślnie `home`. Przełącznik w nagłówku modułu
oraz w `Ustawieniach`. Tryb steruje **progresywnym odsłanianiem** pod-zakładek:

- **Dom**: Rzeczy, Szukaj, Skan zdjęcia, Spis, Etykiety QR, Ustawienia.
- **Pro** (dokłada): Przyjmij/Wydaj, Analityka, Dostawcy, Zamówienia, Dokumenty.

Trasy pro pozostają osiągalne po URL, ale w trybie Dom są ukryte w nawigacji.
Akcje serwerowe: `getStorageSettings`, `setStorageMode(mode)`, `setStorageCurrency(code)`.

## 1.3. Model danych (Prisma / PostgreSQL)

- **StorageItem** — pozycja magazynowa. Pola: `name`, `sku` (kod wewnętrzny), `barcode`
  (EAN/UPC do skanu), `category`, `warehouse` (magazyn nadrzędny, string), `location`
  (dokładne miejsce, string), `quantity`, `unit`, `minQuantity` (próg uzupełniania),
  `unitPrice` (wartość/szt. w walucie ustawień), `photoUrl` (data-URL, downscaled),
  `expiresAt` (termin ważności), `warrantyUntil` (gwarancja), `supplierId`,
  `notes`, `ownerId`/`ownerTeamId`. Indeksy m.in. na `barcode`, `sku`, `warehouse`.
- **StorageMovement** — dziennik ruchów. `itemId`, `delta` (ze znakiem: + przyjęcie, − wydanie),
  `reason` (np. „przyjęcie", „wydanie", „spis", „korekta", „przesunięcie"), `note`,
  `batchId?`, `documentId?`, `createdAt`. Jedyne źródło historii i podstawa analityki ruchu.
- **StorageSettings** — `userId` (PK), `mode`, `currency`.
- **StorageSupplier** — dostawca/kontrahent: `name`, `contact`, `email`, `phone`, `notes`,
  owner. Powiązany z pozycjami (preferowane źródło), dokumentami i zamówieniami.
- **StorageBatch** — partia/seria (FEFO): `itemId`, `lotNo`, `serialNo`, `quantity`,
  `expiresAt`, `receivedAt`, `note`. Gdy pozycja ma partie, `quantity` pozycji jest
  utrzymywane jako suma partii.
- **StorageDocument** + **StorageDocumentLine** — dokumenty PZ/WZ/faktura. Dokument:
  `type` (`PZ`|`WZ`|`faktura`), `number`, `supplierId`, `date`, `totalCost`, `imageUrl`,
  `notes`, owner. Pozycja dokumentu: `itemId?`, `name`, `quantity`, `unit`, `unitPrice`,
  `lineTotal`.
- **StoragePurchaseOrder** + **StoragePurchaseOrderLine** — zamówienie do dostawcy:
  `supplierId`, `status` (`draft`|`sent`|`received`), `date`, `draftText` (treść zredagowana
  przez LLM), `notes`, owner; pozycje: `itemId?`, `name`, `quantity`, `unit`.

Uwaga projektowa: **magazyn jest stringiem** na pozycji (brak osobnej encji Warehouse).
Przesunięcia międzymagazynowe realizuje akcja `transferStock`, która zdejmuje ilość z pozycji
źródłowej i albo scala z istniejącą pozycją w miejscu docelowym (ta sama nazwa + magazyn +
lokalizacja), albo tworzy nową — logując ruchy „przesunięcie" po obu stronach.

## 1.4. Funkcje wspólne (Dom + Pro)

- **Lista „Rzeczy"** (`/magazynowanie`) — pozycje pogrupowane po magazynie, filtr po magazynie,
  szukajka tekstowa (nazwa/SKU/EAN/kategoria), znacznik „poniżej min", sekcja „Do uzupełnienia"
  z przyciskiem **wyślij braki na listę zakupów** (`addLowStockToShoppingList`) oraz sekcja
  „Terminy i gwarancje". Klik pozycji → arkusz edycji.
- **Arkusz edycji** (`StorageEditSheet`) — pełna edycja pól; szybkie +/−1 (przyjęcie/wydanie);
  zdjęcie (upload→downscale); w trybie pro: wybór dostawcy oraz manager partii (FEFO);
  **przeniesienie do innego magazynu**; historia ruchów.
- **Spis / inwentaryzacja** (`/magazynowanie/stocktake`) — tryb masowego ustawiania ilości,
  loguje korekty z `reason="spis"` (`bulkSetStorageQuantities`).
- **Inwentaryzacja ze zdjęcia** (`/magazynowanie/scan`) — AI rozpoznaje przedmioty na zdjęciu
  półki/regału (dwuetapowo: vision → strukturyzacja JSON) i tworzy pozycje masowo
  (`bulkAddStorageItems`). Endpoint: `POST /api/llm/magazynowanie/scan`.
- **Stan minimalny → uzupełnianie** — pozycje poniżej `minQuantity` (`getLowStock`) trafiają
  na wskazaną listę zakupów lub zasiewają zamówienie do dostawcy.

## 1.5. Funkcje trybu Dom

- **„Gdzie to jest?"** (`/magazynowanie/szukaj`) — natychmiastowe dopasowanie tekstowe + tryb
  **semantyczny AI** (`POST /api/llm/magazynowanie/search`): zapytanie naturalne („gdzie mam
  ładowarkę do wiertarki") → ranking pasujących pozycji; wynik pokazuje magazyn + lokalizację.
- **Etykiety QR** (`/magazynowanie/etykiety`) — generowanie kodów QR (`qrcode`) dla
  lokalizacji/pudeł (QR koduje URL `…/szukaj?loc=…`), arkusz do druku (print-CSS), możliwość
  dodania własnych etykiet. Skan QR telefonem → lista przefiltrowana do danej lokalizacji.
- **Gwarancje i terminy ważności** — pola `expiresAt`/`warrantyUntil`; `getExpiringStorage(dni)`
  zwraca wpisy z liczbą dni do końca; widoczne na liście oraz jako kafel na stronie głównej.
- **Wartość + zdjęcia** — `unitPrice` w walucie ustawień + zdjęcie pozycji; suma wartości i
  **eksport CSV** (np. do celów ubezpieczeniowych) z poziomu Analityki (działa też w trybie Dom).

## 1.6. Funkcje trybu Pro

- **Skan kodów wejście/wyjście** (`/magazynowanie/przeplyw`) — pełnoekranowy skaner kamerą
  (`@zxing/browser`), przełącznik **Przyjęcie/Wydanie**, sygnał dźwiękowy (WebAudio) + wibracja,
  sesja skanów z możliwością cofnięcia. Dopasowanie po `barcode` → `sku` → dokładnej nazwie
  (`findStorageItemByCode`). **Nieznany kod** → szybkie dodanie pozycji z podpowiedzią AI
  (`POST /api/llm/magazynowanie/enrich`: kod/nazwa → nazwa/kategoria/jednostka). Każdy skan to
  ruch ±1 (`adjustStorageQuantity`). Wymaga HTTPS + zgody na kamerę.
- **Dostawcy** (`/magazynowanie/dostawcy`) — CRUD kontrahentów (`addSupplier`, `updateSupplier`,
  `deleteSupplier`).
- **Dokumenty PZ/WZ/faktura** (`/magazynowanie/dokumenty`) — tworzenie ręczne lub **OCR ze
  zdjęcia faktury/WZ** (`POST /api/llm/magazynowanie/document`, vision→generation: odczyt pozycji
  `{name, qty, unit, unitPrice}` + numer + dostawca). Po przeglądzie pozycji jednym kliknięciem
  **księgowanie na stan** (`createDocument` z `applyToStock`): PZ/faktura dodają, WZ zdejmuje;
  ruchy zapisywane z `documentId`, brakujące pozycje są zakładane.
- **Zamówienia do dostawców** (`/magazynowanie/zamowienia`) — tworzenie zamówień; opcja
  **„zasiej brakami"** (z `getLowStock`); **LLM redaguje treść** zamówienia do dostawcy
  (`POST /api/llm/magazynowanie/order-draft`) → kopiuj / wyślij mailem (mailto na e-mail
  dostawcy); statusy `draft`/`sent`/`received`.
- **Analityka** (`/magazynowanie/analityka`) — `getStorageAnalytics`: KPI (wartość magazynu,
  liczba pozycji, poniżej minimum, martwy zapas), **ABC** (Pareto wg wartości, klasy A/B/C),
  **martwy zapas** (pozycje bez ruchu > N dni), **trend ruchów** (przyjęcia vs wydania, 14 dni),
  **wartość wg magazynu**, **eksport CSV** wyceny oraz **narracyjne wnioski AI**
  (`POST /api/llm/magazynowanie/insights` — liczby liczy aplikacja, LLM je interpretuje).
- **Partie / serie + FEFO** — `StorageBatch` w arkuszu pozycji: dodawanie partii (nr partii/serii,
  ilość, ważność), automatyczna synchronizacja ilości pozycji z sumą partii, **wydanie wg FEFO**
  (`issueByFEFO` — zdejmuje z partii o najwcześniejszej dacie ważności), alerty wygasania.

## 1.7. Integracja z asystentem AI (globalny „magic icon")

W module Magazyn globalny asystent działa w trybie *interpret → execute*:

- Akcje zapisu (po zatwierdzeniu w `ActionDrawer`):
  - `add_storage_item` — params `{ name, quantity?, unit?, warehouse?, location?, category? }`.
  - `adjust_storage` — params `{ delta }`, `searchQuery` = nazwa pozycji (przyjęcie/wydanie po nazwie).
- Narzędzie odczytu (agent, faza „query"): `list_storage_items` — args `{ search?, warehouse?,
  lowStockOnly?, limit? }` → pozycje z ilością, magazynem, lokalizacją i progiem minimum.
- Kontekst trasowy: na ścieżce `/magazynowanie` asystent dostaje `context: ["magazynowanie"]`,
  więc bez wskazania innego modułu polecenia trafiają do magazynu.

## 1.8. Endpointy LLM modułu (`/api/llm/magazynowanie/*`)

| Endpoint | Operacja | Wejście → Wyjście |
|---|---|---|
| `scan` | vision→generation | zdjęcie → lista pozycji `{name, quantity, unit, category, notes}` |
| `document` | vision→generation | zdjęcie faktury/WZ → `{number, supplier, lines[]}` |
| `enrich` | dispatch | `{barcode?, name?}` → `{name, category, unit}` |
| `order-draft` | generation | `{supplier?, lines[]}` → `text` (treść zamówienia) |
| `insights` | reasoning | statystyki magazynu → `{tips[]}` (wnioski) |
| `search` | dispatch | `{query, items[]}` → `{ids[]}` (ranking semantyczny) |

Model per operacja jest rozwiązywany dynamicznie (Admin → LLM, `LlmAssignment`). Wszystkie trasy
degradują się łagodnie (`unavailable`/błąd) — brak skonfigurowanego LLM nie wywraca UI.

---

# Rozdział 2. Pomysły na udoskonalenia, specjalizację i integrację z AI

> Lista uporządkowana wg obszarów. Każdy pomysł zawiera krótkie uzasadnienie i — gdzie to
> istotne — sugerowany punkt zaczepienia w istniejącym kodzie/modelu.

## 2.1. Udoskonalenia rdzenia (niskie ryzyko, szybka wartość)

1. **Encja Warehouse** zamiast stringów — realne magazyny z adresem, typem (dom/sklep/auto
   kuriera), domyślną walutą i właścicielem. Umożliwia raporty „per magazyn", transfery z
   pełną historią i mapę lokalizacji. Migracja: dodać `Warehouse`, zmigrować `StorageItem.warehouse`.
2. **Pełne widoki szczegółowe** dokumentu i zamówienia (trasy `[id]`) z osią czasu i wydrukiem
   (PZ/WZ/faktura do PDF/print-CSS — wzór z etykiet QR).
3. **Cofanie księgowania dokumentu** — usunięcie/odwrócenie ruchów powiązanych przez `documentId`
   (dziś usunięcie dokumentu nie cofa stanu — świadoma decyzja, ale warto dać opcję storna).
4. **Rezerwacje stanu** — pole „zarezerwowane" (np. pod zamówienie klienta/wydanie), tak by
   „dostępne = stan − rezerwacje". Kluczowe dla sklepu i kuriera.
5. **Jednostki przeliczalne** — opakowanie zbiorcze ↔ sztuka (np. karton = 24 szt.), z auto-
   przeliczaniem przy przyjęciu/wydaniu i skanie.
6. **Wiele kodów na pozycję** — lista EAN (warianty opakowań/producentów) zamiast jednego `barcode`.
7. **Audyt i podpis** — kto i kiedy wykonał ruch (powiązanie `StorageMovement` z użytkownikiem),
   pełny ślad rewizyjny dla firm.

## 2.2. Specjalizacje branżowe (profile magazynu)

1. **Profil „Dom/Kolekcjoner"** — wartość odtworzeniowa, ubezpieczenie, gwarancje, instrukcje i
   paragony jako załączniki; eksport „spisu majątku" do PDF dla ubezpieczyciela.
2. **Profil „Sklep/Handel"** — ceny zakupu i sprzedaży, marża, stany kasowe, kody PLU, integracja
   z listą zakupów jako „zamówienie do dostawcy", prosty POS (wydanie = sprzedaż).
3. **Profil „Kurier/Logistyka"** — paczki zamiast pozycji: statusy (przyjęta/w drodze/dostarczona),
   skan przy odbiorze i doręczeniu, przypisanie do trasy (integracja z modułem Truck/ORS).
4. **Profil „Warsztat/Produkcja"** — BOM (lista materiałowa), zużycie materiałów przy zleceniu,
   stan narzędzi (wypożyczenia), powiązanie z modułem Flota (części do pojazdów).
5. **Profil „Gastronomia/Bar"** — pomost do Spiżarni: receptury → automatyczne zdejmowanie
   składników, kontrola FEFO i strat.
6. **Profil „Apteczka/Chemia"** — twarda kontrola dat ważności, ostrzeżenia o przeterminowaniu,
   karty charakterystyki, limity przechowywania.

## 2.3. Integracja z AI — kolejny poziom

1. **Konwersacyjny agent magazynowy** — rozszerzyć agenta o akcje zapisu pro: `receive_document`,
   `create_order`, `transfer_stock`, `set_min_stock`, tak by „przyjmij dostawę z tego zdjęcia i
   utwórz zamówienie na to, co spadło poniżej minimum" wykonało się jednym poleceniem.
2. **Auto-uzupełnianie zaopatrzenia** — model prognozuje zużycie z historii ruchów
   (`StorageMovement`) i proponuje ilości zamówień (z uwzgl. lead-time dostawcy i sezonowości),
   nie tylko „poniżej minimum".
3. **Wzbogacanie pozycji z kodu EAN** — połączyć `enrich` z bazą GTIN/obrazem produktu: kod →
   pełna nazwa, marka, zdjęcie, kategoria, typowa cena. Cache wyników w słowniku produktów.
4. **Wizyjna kontrola stanu** — zdjęcie regału → AI porównuje z ewidencją i wskazuje rozbieżności
   („brakuje 2 wiertarek względem stanu") jako wsparcie spisu.
5. **Wykrywanie anomalii i strat** — model oznacza nietypowe wydania, ubytki, „znikający" towar,
   pozycje bez rotacji i sugeruje działania (przecena, zwrot, likwidacja).
6. **Analityka narracyjna w czasie** — rozszerzyć `insights` o trendy miesiąc/rok, sezonowość,
   rotację zapasów (wskaźnik), zamrożony kapitał i rekomendacje cenowe.
7. **Asystent dokumentów** — OCR nie tylko pozycji, ale i warunków (termin płatności, rabaty,
   numer zamówienia) z auto-dopasowaniem do istniejącego PO i alertem o rozbieżności cen.
8. **Głosowe przyjęcia/wydania** — dyktowanie „przyjmij 10 kartonów śrub M8 do regału A3"
   (Web Speech API → `interpret`), przydatne przy rękach zajętych skanerem.
9. **Semantyczne etykietowanie lokalizacji** — AI sugeruje optymalne rozmieszczenie (często
   wydawane bliżej, FEFO na froncie) i generuje plan rozłożenia.
10. **Embeddingowe „gdzie to jest?"** — zastąpić jednorazowy ranking promptowy wektorowym indeksem
    pozycji (trwałe embeddingi), co przyspieszy i ustabilizuje wyszukiwanie przy dużych magazynach.

## 2.4. Integracje międzymodułowe (Omnia)

- **Zakupy** — dwukierunkowo: braki → lista zakupów (jest) oraz „kupione" → przyjęcie na magazyn.
- **Spiżarnia/Kuchnia** — wspólny słownik produktów i mostek receptura→zużycie.
- **Flota/Truck** — części i materiały eksploatacyjne powiązane z pojazdami; trasy dla kuriera.
- **Portfel** — wartość magazynu i koszty zakupów jako pozycje majątku/wydatków.
- **Raporty/Home** — kokpit z KPI magazynu (jest częściowo: kafle braków i terminów).

## 2.5. Higiena techniczna

- Testy e2e dla ścieżek pro (skan we/wy, OCR dokumentu, FEFO).
- Limity i walidacja rozmiaru zdjęć/data-URL (zdjęcia pozycji rosną w bazie — rozważyć zewnętrzny
  storage przy skali).
- Indeksy pod analitykę (np. `StorageMovement(createdAt)`), paginacja list przy dużych zbiorach.
- Backfill i migracja przy wprowadzeniu encji Warehouse.

$mag_doc$,
  'general',
  NULL,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("slug") DO NOTHING;
