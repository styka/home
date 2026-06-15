# Dodatek A.10 — Plany wdrożenia: monetyzacja i billing

Plany realizujące zalecenia z Rozdz. 42 i 44.

---

## Plan Z-471 (P1) — Warstwa `Plan`/`Subscription` + bramkowanie funkcji

**Cel:** zamienić „Pro” techniczne w plan handlowy, na bazie istniejącego RBAC.
**Kroki:**
1. Modele: `Plan { key, name, limits(JSON) }`, `Subscription { ownerId|ownerTeamId, planKey, status,
   currentPeriodEnd }` (+ migracja). Domyślnie plan `free`.
2. Helper `hasFeature(session, feature)` / `withinLimit(...)` (rozszerzenie `permissions.ts`/ownership) —
   bramkuje funkcje premium/B2B i limity (AI: plan Z-130).
3. UI „Twój plan” w `/settings`; oznaczenia funkcji premium.
**Pliki:** `prisma/schema.prisma` + migracja, `src/lib/permissions.ts`/nowy `src/lib/plans.ts`, akcje,
UI ustawień.
**Kryteria:** funkcje premium/limity respektują plan; darmowy ma egzekwowane limity.
**Zależność:** linia free/premium (Z-470 — decyzja właściciela).

---

## Plan Z-473 (P1·L) — Bramka płatności + faktury/VAT

**Cel:** pobierać opłaty zgodnie z prawem.
**Kroki:** integracja bramki (Stripe/Przelewy24 — **decyzja właściciela**); webhooki statusów →
`Subscription`; faktury/VAT (lub przez dostawcę); spięcie z Portfelem (przychody); obsługa zwrotów/anulacji.
Reżim PCI po stronie bramki (nie przechowujemy kart).
**Kryteria:** opłacenie planu aktywuje go; faktura wystawiana; webhooki spójne ze stanem.
**Uwaga:** wybór bramki + dane firmy = **decyzja właściciela**; oznaczyć zależność.

---

## Plan Z-472 / Z-511 (P0/P1) — Budżet AI per plan

Patrz **plan Z-130 (A.7)**: limity tokenów zależne od `Plan` — to jednocześnie oś monetyzacji i warunek
rentowności (darmowy = dzienny budżet + tańszy model).

---

## Plan Z-510 (P0) — Pomiar jednostkowej ekonomiki

**Cel:** nie skalować w ciemno.
**Kroki:** zbierać metryki: koszt AI/infra per MAU, ARPU, konwersja free→premium/B2B, churn, CAC, LTV;
panel (admin) + eksport do arkusza (model Z-514). Część danych z monitoringu kosztów (Z-135).
**Kryteria:** widać unit economics i trend; decyzje marketingowe oparte na CAC<LTV (Z-512).

---

## Pozostałe (skrót)

- **Z-474 (P2)** — reklamy kontekstowe (opcja „wyłącz”), tylko lifestyle, nigdy zdrowie/finanse; po
  freemium/B2B.
- **Z-476 (P1)** — model marketplace (prowizja/abonament wykonawcy) — osobny od planów osobistych.
- **Z-512/Z-513/Z-515 (P1)** — reguła CAC<LTV, priorytet B2B nad reklamami, etapowanie budżetu 10 tys. zł.

**Kolejność:** Z-510 → Z-471 → Z-472 → Z-473 → Z-476 → reszta.
**Twarda zależność:** RODO/płatności (A.3) przed jakąkolwiek opłatą.
