# Rozdział 31 — Usługi (Marketplace)

> **Największy i najbardziej złożony moduł** (`src/actions/services.ts` — 1409 linii). Realnie osobny
> produkt w produkcie (model Fixly + Booksy).

## Kontekst / stan z kodu

- **Modele:** `ServiceProvider` (badge `verified`, slug/tagline), `ServiceListing`, `ServiceRequest`
  (workflow statusów), `ServiceMessage` (czat), `ServiceQuote` (wyceny), `ServiceImage` (portfolio),
  `ServiceAvailability` (sloty), `ServiceReview`, **`ServicePayment`** (faktury → Portfel),
  `ServiceFavorite`, `ServicePromoCode`, `ServiceStaff` (firmy wieloosobowe), **`ServiceDispute`**
  (spory + moderacja `/services/moderation`).
- **Helpery:** `src/lib/serviceSlots.ts`, `serviceGeo.ts` (haversine, filtr w promieniu).

## Mocne strony

- **Kompletny marketplace** (zlecenia, czat, wyceny, rezerwacje, płatności, oceny, spory, moderacja,
  firmy wieloosobowe) — ogromna powierzchnia funkcji.
- **Płatności spięte z Portfelem**, kody rabatowe, weryfikacja wykonawcy.

## Głos Zespołu A — Strażnicy

**Anna (security):** „Marketplace = **najwyższe ryzyko**: płatności, spory, dane obu stron, oszustwa.
**Testy ścieżki płatności i sporów to P0** (Z-173). Brak podwójnego księgowania, poprawne statusy,
ochrona przed manipulacją wyceną/oceną.”

**Grzegorz (delivery):** „`services.ts` (1409 linii) to **drugi największy plik** w repo — kruchy.
Rozbić wg domen (zlecenia/płatności/czat/spory). I marketplace to **własna gra skali** (dwustronny rynek,
płynność podaży/popytu) — to nie »jeszcze jeden moduł«.”

**Katarzyna (analityk):** „Marketplace ma **własny model przychodu** (prowizja/abonament wykonawcy,
Z-476) niezależny od planów osobistych — to potencjalnie najszybszy realny przychód.”

## Głos Zespołu B — Pionierzy

**Wojtek (PO):** „To **gotowy strumień pieniędzy**: prowizja od transakcji. Konkurujemy z Fixly/Booksy
przewagą »część większego ekosystemu + tani AI« (AI pisze opis usługi, dobiera termin, odpowiada
klientom). Dołóżmy **mapę-kafelki** i tryb »dowolny pracownik«.”

## Punkty sporne

- **Marketplace jako rdzeń vs dodatek.** Strażnicy: to osobny produkt, wymaga własnej strategii płynności
  i moderacji. Pionierzy: ale gotowy do zarobku. **Konsensus:** traktować jako **osobną linię** z własnym
  modelem (prowizja) i własnym priorytetem testów/bezpieczeństwa.

## Głos użytkowników

**Tadeusz (60):** „Jak wykonawca — chcę kalendarz, płatności i oceny w jednym, tanio.”
**Marek (29):** „Jako klient — czat, wycena, rezerwacja online. To działa.”

## Konsensus i zalecenia

- **Z-360** *(P0 · M)* — **Testy ścieżki płatności, wycen i sporów** (Z-173) — najwyższy priorytet
  bezpieczeństwa modułu.
- **Z-361** *(P1 · M)* — **Rozbić `services.ts`** (1409 linii) wg domen (zlecenia/płatności/czat/spory).
- **Z-362** *(P1 · M)* — **Model przychodu marketplace** (prowizja/abonament wykonawcy, Z-476) — osobny
  od planów osobistych; potencjalnie najszybszy przychód.
- **Z-363** *(P1 · M)* — **AI dla wykonawcy** (opis usługi, dobór terminu, odpowiedzi klientom) — przewaga
  „tanio dzięki AI”.
- **Z-364** *(P2 · L)* — **Mapa-kafelki + tryb „dowolny pracownik”** (zaległości z backlogu marketplace).
- **Z-365** *(P1 · S)* — **Strategia płynności i moderacji** (dwustronny rynek) — plan pozyskania podaży/popytu.

## Dobre vs złe praktyki

**Dobre:** kompletny marketplace (płatności/czat/rezerwacje/spory/moderacja), spięcie z Portfelem.
**Złe / do poprawy:** plik-gigant `services.ts`; testy płatności/sporów (P0) niezrobione; brak własnego
modelu przychodu i strategii płynności.
