# Rozdział 10 — DevOps, CI/CD, hosting, observability, koszty

## Kontekst / stan z kodu

- **Pipeline buildu** (`package.json`): `copy-docs → copy-audyt → check-action-coverage →
  check-migrations → prisma generate → next build → migrate.js`. Strażniki przed buildem to mocna
  strona; **`migrate.js` na końcu uruchamia `prisma migrate deploy` + seedy na bazie ze zmiennych
  środowiskowych** — czyli realnie dotyka DB środowiska, na którym build leci.
- **Środowiska:** `feature (claude/*) → develop → master`. `develop` = środowisko testowe (auto-deploy
  Render), `master` = produkcja (auto-deploy na push). Brak osobnego staging poza `develop`.
- **Hosting:** Render free tier (Frankfurt), usypianie po 15 min. **Neon** (Postgres, Frankfurt).
- **Observability:** `actions/systemHealth.ts` + `/admin/health` liczone na żywo (DB latencja,
  migracje, LLM, build, liczby). **Brak**: Sentry/error-trackingu, logów strukturalnych, metryk,
  tracingu, alertów, uptime-monitoringu.
- **CI:** brak pliku CI bramkującego (testy/lint/typecheck nie blokują merge’a); strażniki działają
  tylko w ramach `build`.
- **Backup/DR:** brak udokumentowanej strategii (poza tym, co daje Neon domyślnie).

## Głos Zespołu A — Strażnicy

**Piotr (SRE):** „»Nie wiemy, że coś padło, dopóki użytkownik nie napisze« — to dziś nasz stan.
**Observability to P0 operacyjne przed marketingiem**: error-tracking (Sentry), uptime-monitor i
alert na 5xx. Bez tego pierwsza fala ruchu = lecimy ślepi.”

**Grzegorz (delivery):** „`migrate.js` w buildzie produkcyjnym to ryzyko: build i migracja DB są
**sprzężone**. Nieudana migracja może wywrócić deploy, a brak osobnego kroku migracji utrudnia rollback.
Chcę **rozdzielić** build artefaktu od migracji i mieć jawny rollback.”

**Marek (DBA):** „Backup/DR: na czym stoimy, jeśli Neon padnie albo ktoś skasuje dane? Potrzebny
**plan: PITR/eksport, test odtworzenia, RPO/RTO**. »Kosz« aplikacyjny to nie backup bazy.”

**Ewa (QA):** „Brak CI bramkującego znaczy, że testy i typy nie chronią `develop`/`master`. Strażniki
w `build` to dobry początek, ale powinny być w **CI na każdym PR**, nie tylko w deployu.”

## Głos Zespołu B — Pionierzy

**Kamil (DevOps):** „Zgoda na Sentry i uptime — to **darmowe/tanie i wpina się w godzinę**. Reszta
etapami. Ale nie przeinżynierujmy: dla jednej instancji nie potrzebujemy Kubernetesa ani service mesh.
**GitHub Actions** z lintem+typecheck+testami jednostkowymi na PR załatwia 80% wartości CI za zero
złotych.”

**Magda (delivery):** „`develop → master` jako test→prod jest **wystarczające** na ten etap. Dodajmy
tylko »smoke test« po deployu (czy strona wstaje, czy `/admin/health` zielone) i alert, jeśli nie.”

**Nina (growth):** „Pamiętajmy, że **zimny start free tier** to też problem marketingowy: klikam reklamę,
czekam 15 s, wychodzę. Hosting bez usypiania to nie luksus, to lejek konwersji.”

## Punkty sporne

- **Rozdzielić migracje od buildu: tak/teraz?** Strażnicy: tak, P1. Pionierzy: tak, ale lekko (osobny
  krok deploy, nie cała platforma migracyjna). **Konsensus:** rozdzielić build i `migrate deploy`, dodać
  jawny rollback/PITR — etapowo.
- **Ile observability na start.** **Konsensus:** Sentry + uptime + alert 5xx = teraz (P0/P1); metryki/
  tracing = przy skali.

## Głos użytkowników

**Tadeusz (60, gastronomia):** „Jak korzystam do biznesu, nie może paść bez ostrzeżenia w środku dnia.”
→ przy płatnych funkcjach B2B brak SLA/monitoringu to realny biznesowy deal-breaker.

## Konsensus i zalecenia

- **Z-090** *(P0 · S)* — **Wdrożyć error-tracking (Sentry) + uptime-monitor + alert na 5xx.** Najtańszy
  możliwy wzrost widoczności; warunek startu marketingu.
- **Z-091** *(P1 · S)* — **CI na PR (GitHub Actions): lint, typecheck, testy jednostkowe, strażniki**
  (`check:actions`, `check:migrations`). Bramka jakości zanim kod trafi na `develop`.
- **Z-092** *(P1 · M)* — **Rozdzielić build artefaktu od `migrate deploy`** (osobny krok deployu) +
  procedura rollbacku migracji.
- **Z-093** *(P1 · M)* — **Strategia backup/DR:** PITR/eksporty Neon, **przetestowane** odtworzenie,
  zdefiniowane RPO/RTO; udokumentować.
- **Z-094** *(P1 · S)* — **Wyjść z usypiającego free tier** (Render bez sleep) przed marketingiem
  (spójne z Z-075).
- **Z-095** *(P2 · S)* — **Smoke test po deployu** (health-check `/admin/health` + kluczowe trasy) z
  alertem przy niepowodzeniu.
- **Z-096** *(P2 · M)* — **Logi strukturalne + podstawowe metryki** (czas akcji, błędy per moduł, koszt
  LLM) — fundament pod świadome skalowanie i kontrolę kosztów.
- **Z-097** *(P1 · S)* — **Monitoring kosztów** (infra + tokeny LLM) z alertem progowym — kluczowe dla
  modelu „darmowe, ale tanie” (patrz Rozdz. 12 i 44).

## Dobre vs złe praktyki

**Dobre:**
- Strażniki w buildzie (pokrycie akcji AI, numeracja migracji) — realna automatyczna ochrona.
- Jasny model środowisk `develop → master` z auto-deployem.
- `/admin/health` jako początek widoczności (DB/migracje/LLM/build na żywo).

**Złe / do poprawy:**
- Brak error-trackingu/alertów — „ślepota produkcyjna”.
- Brak CI bramkującego na PR (strażniki tylko w deployu).
- Sprzężenie buildu z migracją produkcyjnej DB; brak jawnego rollbacku i planu DR.
- Usypiający free tier jako stan wyjściowy pod ruch marketingowy.
