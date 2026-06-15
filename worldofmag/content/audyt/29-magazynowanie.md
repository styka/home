# Rozdział 29 — Magazynowanie (Storage)

## Kontekst / stan z kodu

- **Rdzeń:** `src/actions/storage.ts` (1011 linii); modele `StorageItem`, `StorageMovement`,
  `StorageSettings`, `StorageSupplier`, `StorageBatch`, `StorageDocument(+Line)`, `StoragePurchaseOrder(+Line)`.
- **Dwa tryby (per-user `StorageSettings`):**
  - **Dom:** „gdzie to jest?” (AI-search), etykiety QR (druk+skan), gwarancje/ważność, wartość+zdjęcia.
  - **Pro:** skan kodów in/out (`@zxing`), dostawcy, dokumenty PZ/WZ/faktury (OCR), zamówienia (LLM
    draft), analityka (ABC/dead-stock/trend + AI), partie/loty **FEFO**.

## Mocne strony

- **Dwa tryby (Dom/Pro)** — gotowy wzorzec „darmowe podstawy → płatna głębia B2B” (Rozdz. 42/43).
- **OCR dokumentów, FEFO, analityka ABC** — funkcje klasy WMS, rzadkie poza drogim oprogramowaniem.

## Głos Zespołu A — Strażnicy

**dr Natalia (AI/ML):** „Pro to **ciężkie AI** (OCR dokumentów, draft zamówień, analityka) — kolejka
(Z-074) i limity obowiązkowe. To też **najlepszy kandydat na płatny moduł** (wartość B2B uzasadnia cenę).”

**Marek (DBA):** „Skala: ruch magazynowy (`StorageMovement`) rośnie szybko — indeksy i paginacja (Z-030/
Z-070) tu krytyczne; analityka nie może skanować całości.”

## Głos Zespołu B — Pionierzy

**Tadeusz (użytkownik, 60):** „To realne narzędzie dla małej firmy. Dokumenty PZ/WZ, dostawcy, FEFO —
za to bym zapłacił. **Skomercjalizujcie tryb Pro** (Z-492).”

**Wojtek (PO):** „Magazyn Pro + Warsztat Pro to **najszybsza droga do pierwszych płacących** — funkcje
już są, brakuje bramki planu i pakietu.”

## Punkty sporne

- **Pro jako paywall.** Dziś „Pro” to tryb techniczny. **Konsensus:** zachować darmowe podstawy (Dom),
  bramkować planem funkcje Pro (dokumenty/analityka/zamówienia) — Z-471.

## Głos użytkowników

**Tadeusz (60):** „Dokumenty i FEFO taniej niż dedykowany WMS — biorę.”

## Konsensus i zalecenia

- **Z-340** *(P1 · S)* — **Ciężkie AI Pro (OCR/zamówienia/analityka) do kolejki + limity per plan** (Z-074/Z-130).
- **Z-341** *(P0 · S)* — **Indeksy + paginacja ruchu/pozycji** (Z-030/Z-070) — analityka i listy przy skali.
- **Z-342** *(P1 · M)* — **Skomercjalizować tryb Pro** (Z-492): bramka planu (Z-471) + pakiet B2B.
- **Z-343** *(P2 · M)* — **Magazyn Pro jako baza branż** (handel/produkcja) — kolejne nakładki.

## Dobre vs złe praktyki

**Dobre:** dwa tryby (gotowy model free/B2B), OCR/FEFO/analityka, skan kodów.
**Złe / do poprawy:** ciężkie AI bez kolejki/limitów; ryzyko skali w analityce/ruchu; Pro niezmonetyzowane.
