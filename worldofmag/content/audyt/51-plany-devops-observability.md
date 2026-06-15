# Dodatek A.5 — Plany wdrożenia: DevOps i observability

Plany realizujące zalecenia z Rozdz. 10.

---

## Plan Z-090 (P0) — Error-tracking + uptime + alert 5xx

**Cel:** przestać być „ślepym” na produkcji.
**Kroki:**
1. Wpiąć Sentry (Next SDK) — `sentry.client/server.config.ts`, DSN w env (szyfrowane/secret hostingu);
   capture wyjątków + Server Actions.
2. Uptime-monitor (np. zewnętrzny ping na `/` i `/admin/health`) + alert (e-mail/webhook) na 5xx i down.
3. Zintegrować z `error.tsx` (plan Z-111) — błąd UI raportuje do Sentry.
**Pliki:** konfiguracja Sentry, env, ewentualnie `instrumentation.ts`.
**Kryteria:** wyjątek na produkcji pojawia się w Sentry; alert przy down/5xx.
**Uwaga:** DSN/konto = drobna decyzja właściciela (darmowy tier wystarcza na start).

---

## Plan Z-091 (P1) — CI na PR (GitHub Actions)

**Cel:** bramka jakości zanim kod trafi na `develop`.
**Kroki:** workflow `.github/workflows/ci.yml`: `npm ci` → `lint` → `typecheck` → `test:unit` →
`check:actions` → `check:migrations` → `next build` (bez `migrate.js`). Na PR i push do `develop`.
Postgres jako usługa, jeśli testy DB (plan Z-174).
**Kryteria:** PR z błędem lintu/typu/testu jest czerwony; zielony przepuszcza.

---

## Plan Z-092 (P1) — Rozdzielić build od migracji + rollback

**Cel:** odsprzęgnąć artefakt od `migrate deploy`; umożliwić rollback.
**Kroki:** wydzielić `migrate deploy` z `build` do osobnego kroku deployu (Render: release command);
udokumentować procedurę rollbacku (rewert migracji/PITR). Build (`next build`) bez DB.
**Kryteria:** build artefaktu nie wymaga DB; migracja to osobny, jawny krok.

---

## Pozostałe (skrót)

- **Z-093 (P1)** — backup/DR: włączyć/zweryfikować PITR Neona, **przetestować** odtworzenie, zapisać
  RPO/RTO w runbooku.
- **Z-095 (P2)** — smoke test po deployu (`/admin/health` + kluczowe trasy) z alertem.
- **Z-096 (P2)** — logi strukturalne + podstawowe metryki (czas akcji, błędy/moduł, koszt LLM).
- **Z-097 (P1)** — monitoring kosztów (infra + tokeny) z alertem progowym (spójne z A.7/A.10).

**Kolejność:** Z-090 → Z-091 → Z-097 → Z-092 → Z-093 → reszta.
