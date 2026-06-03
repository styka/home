-- Raport implementacji 2026-06-03 (Magazynowanie 2.0 — Dom + Profesjonalny).
-- → widoczny w /admin/reports oraz /reports. INSERT idempotentny: ON CONFLICT (slug) DO NOTHING.

INSERT INTO "Report" ("id", "title", "slug", "content", "category", "authorId", "createdAt", "updatedAt")
VALUES (
  gen_random_uuid()::text,
  'Omnia — Magazynowanie 2.0 (Dom + Pro) — 2026-06-03',
  'omnia-magazynowanie-2-0-2026-06-03',
  $omnia_mag2$# Omnia — Magazynowanie 2.0 (Dom + Profesjonalny)

Sesja rozbudowała moduł **Magazynowanie** z prostego CRUD-u w pełnoprawny system
magazynowy działający w **dwóch trybach** — prostym „domowym" i zaawansowanym
„profesjonalnym" — z mocnym wsparciem AI. Tryb jest preferencją użytkownika
(`StorageSettings.mode`), a pasek pod-zakładek progresywnie odsłania funkcje pro.

## Tryb Dom ↔ Profesjonalny
Przełącznik w nagłówku modułu i w `/magazynowanie/ustawienia` (+ wybór waluty).
W trybie Dom widoczne są tylko proste zakładki; tryb Pro dokłada przepływ we/wy,
analitykę, dostawców, zamówienia i dokumenty.

## Funkcje DOM
- **„Gdzie to jest?"** (`/szukaj`) — wyszukiwanie tekstowe + semantyczne AI
  (`/api/llm/magazynowanie/search`); wynik pokazuje magazyn i lokalizację.
- **Etykiety QR** (`/etykiety`) — generowanie kodów QR dla półek/pudeł (`qrcode`),
  arkusz do druku (print-CSS), skan telefonem → filtr listy do danej lokalizacji.
- **Gwarancje i terminy** — pola `expiresAt`/`warrantyUntil`, sekcja alertów na liście
  i kafel na stronie głównej (`getExpiringStorage`).
- **Wartość + zdjęcia** — `unitPrice` (w wybranej walucie) i zdjęcie pozycji
  (downscaled data-URL), eksport wyceny do CSV (np. do ubezpieczenia).

## Funkcje PRO
- **Skan kodów we/wy** (`/przeplyw`) — pełnoekranowy skaner `@zxing/browser`,
  tryb Przyjęcie/Wydanie, sygnał dźwiękowy + wibracja, sesja z cofaniem, a nieznany
  kod uruchamia szybkie dodanie pozycji (z podpowiedzią AI `enrich`).
- **Dostawcy** (`/dostawcy`) — CRUD kontrahentów.
- **Dokumenty** (`/dokumenty`) — PZ/WZ/faktura; **OCR ze zdjęcia faktury**
  (`/api/llm/magazynowanie/document`, vision→generation) → przegląd pozycji →
  jednym kliknięciem księgowanie na stan (ruchy z `documentId`).
- **Zamówienia** (`/zamowienia`) — zasiewane brakami magazynowymi; **LLM redaguje treść
  zamówienia** do dostawcy (`order-draft`); kopiuj / wyślij mailem; statusy.
- **Analityka** (`/analityka`) — KPI (wartość magazynu, pozycje, poniżej min, martwy
  zapas), ABC (Pareto), martwy zapas (brak ruchu), trend przyjęć/wydań (14 dni),
  wartość wg magazynu, **narracyjne wnioski AI** (`insights`), eksport CSV.
- **Partie / serie + FEFO** — `StorageBatch` w szczegółach pozycji; wydanie zdejmuje
  z partii o najwcześniejszej dacie ważności; alerty wygasania.

## AI w asystencie
Globalny asystent obsługuje magazyn w trybie interpret→execute: akcje
`add_storage_item` i `adjust_storage` (przyjęcie/wydanie po nazwie) oraz narzędzie
odczytu `list_storage_items` (z filtrem `lowStockOnly`).

## Model danych (migracja `0071_magazynowanie_pro`)
Rozszerzono `StorageItem` (barcode, unitPrice, photoUrl, expiresAt, warrantyUntil,
supplierId) i `StorageMovement` (batchId, documentId). Dodano: `StorageSettings`,
`StorageSupplier`, `StorageBatch`, `StorageDocument(+Line)`, `StoragePurchaseOrder(+Line)`.
Magazyn pozostaje stringiem na pozycji (bez encji Warehouse) — przesunięcia realizuje
akcja `transferStock`. Bez nowych uprawnień (tryb pro to preferencja, nie RBAC).

## Nowe trasy LLM (`/api/llm/magazynowanie/*`)
`document` (OCR faktur), `enrich` (kod/nazwa→nazwa/kategoria/jednostka),
`order-draft` (treść zamówienia), `insights` (analityka narracyjnie),
`search` (semantyczne „gdzie to jest?") — obok istniejącego `scan`.

## Weryfikacja
`npm run build` (next build) przechodzi; `tsc --noEmit` bez błędów. Wszystkie nowe trasy
(`/magazynowanie/{szukaj,etykiety,przeplyw,analityka,dostawcy,zamowienia,dokumenty,ustawienia}`)
oraz endpointy LLM kompilują się poprawnie. Wspólny `fileToDownscaledDataUrl` wyciągnięto
do `src/lib/image-utils.ts` (deduplikacja StorageScan + RecipeImagesEditor).
$omnia_mag2$,
  'general',
  NULL,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("slug") DO NOTHING;
