# Dodatek A.9 — Plany wdrożenia: testy i jakość

Plany realizujące zalecenia z Rozdz. 14.

---

## Plan Z-170 (P0) — Testy w bramce CI

**Cel:** testy faktycznie chronią `develop`/`master`.
**Kroki:** workflow GitHub Actions (spójny z planem Z-091): `test:unit` + strażniki + (docelowo) E2E
smoke na każdym PR/merge do `develop`. Czerwony = blokada.
**Kryteria:** PR łamiący testy nie przechodzi.

---

## Plan Z-171 (P0) — Alias `@/` w runnerze testów

**Cel:** odblokować testy modułów importujących przez `@/` (dziś problem w `currency.ts`/tsx).
**Kroki:** dodać do runnera (`node --import tsx`) obsługę ścieżek (`tsconfig-paths`/loader) lub wydzielić
czyste funkcje bez importu prisma; ujednolicić.
**Kryteria:** test importujący `@/lib/...` działa; `npm run test:unit` zielony.

---

## Plan Z-172 (P0) — Testy izolacji danych (BOLA/IDOR)

**Cel:** udowodnić, że user A nie sięgnie danych usera/zespołu B.
**Kroki:** dla reprezentatywnych akcji (tasks, notes, portfel, pets, services) test: user A próbuje
odczytać/zmienić zasób B po ID → odmowa. Wymaga efemerycznego Postgresa (plan Z-174). Spójne z audytem
Z-052/Z-190.
**Kryteria:** próby cross-tenant kończą się odmową; testy w CI.

---

## Plan Z-173 (P0) — Testy ścieżki płatności i sporów (Usługi)

**Cel:** brak podwójnego księgowania, poprawne statusy, spójność z Portfelem.
**Kroki:** testy `services` (płatność, prowizja, kod rabatowy, spór/moderacja) + księgowanie w Portfelu;
przypadki brzegowe (zwrot, anulowanie).
**Kryteria:** scenariusze płatności/sporów pokryte; brak podwójnych wpisów.

---

## Plan Z-174 (P1) — Efemeryczny Postgres dla testów akcji

**Cel:** testować Server Actions na realnej bazie.
**Kroki:** `test:unit:db` uruchamiający Postgres (usługa CI/lokalny kontener), `migrate deploy`, seed
minimalny, izolacja per test (transakcja/rollback lub czyszczenie).
**Kryteria:** testy akcji działają na świeżej bazie w CI.

---

## Pozostałe (skrót — z Rozdz. 14)

- **Z-175 (P1)** — smoke E2E w CI (10 ścieżek krytycznych: logowanie, CRUD per kluczowy moduł, płatność).
- **Z-176 (P1)** — testy guardów RBAC + samo-wykluczenia admina.
- **Z-177 (P1)** — pomiar coverage (informacyjnie, nie próg).
- **Z-178 (P1)** — rozszerzyć testy czystych helperów (stats wykonawcy, `medicationSchedule`, sloty).
- **Z-179 (P1)** — testy regresji bezpieczeństwa renderera markdown (XSS) — chroni m.in. ten audyt.
- **Z-181 (P2)** — testy kontraktowe read-toolów agenta (spójne z Z-136).
- **Z-185 (P2)** — testy migracji „w obie strony” dla nowych zmian schematu.

**Kolejność:** Z-171 → Z-170 → Z-174 → Z-172 → Z-173 → Z-176 → Z-179 → reszta.
