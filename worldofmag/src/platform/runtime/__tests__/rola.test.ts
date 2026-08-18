import { test } from "node:test";
import assert from "node:assert/strict";
import { rolaProcesu, rolaNierozpoznana, czyPrzetwarzaZadania, czyWykonujeOkresowe } from "../rola";

/**
 * 088 (zadanie 33) — ROLA PROCESU.
 *
 * Rola decyduje o tym, czy proces w ogóle COKOLWIEK robi w tle. Błąd tutaj nie daje wyjątku — daje
 * ciszę: kolejka stoi, retencja nie chodzi, nikt niczego nie zauważa aż do pierwszego pytania
 * „dlaczego zadanie wisi od wczoraj". Stąd przypadki dobrane pod każdy sposób, w jaki mogłoby
 * dojść do tej ciszy.
 */
function zRola<T>(wartosc: string | undefined, f: () => T): T {
  const poprzednia = process.env.OMNIA_ROLE;
  const poprzedniaFlaga = process.env.JOBS_WORKER_DISABLED;
  if (wartosc === undefined) delete process.env.OMNIA_ROLE;
  else process.env.OMNIA_ROLE = wartosc;
  try {
    return f();
  } finally {
    if (poprzednia === undefined) delete process.env.OMNIA_ROLE;
    else process.env.OMNIA_ROLE = poprzednia;
    if (poprzedniaFlaga === undefined) delete process.env.JOBS_WORKER_DISABLED;
    else process.env.JOBS_WORKER_DISABLED = poprzedniaFlaga;
  }
}

test("brak zmiennej = rola `all`, czyli dzisiejsze wdrożenie jednousługowe", () => {
  // Gdyby domyślną wartością było `web`, samo wdrożenie tej zmiany zatrzymałoby kolejkę i retencję.
  zRola(undefined, () => {
    assert.equal(rolaProcesu(), "all");
    assert.equal(czyPrzetwarzaZadania(), true);
    assert.equal(czyWykonujeOkresowe(), true);
  });
});

test("web nie przetwarza i nie sprząta, worker przetwarza, cron sprząta", () => {
  zRola("web", () => {
    assert.equal(czyPrzetwarzaZadania(), false);
    assert.equal(czyWykonujeOkresowe(), false);
  });
  zRola("worker", () => {
    assert.equal(czyPrzetwarzaZadania(), true);
    // Worker NIE wykonuje pracy okresowej: workerów mogą być dwa, procesów cron jeden.
    assert.equal(czyWykonujeOkresowe(), false);
  });
  zRola("cron", () => {
    assert.equal(czyPrzetwarzaZadania(), false);
    assert.equal(czyWykonujeOkresowe(), true);
  });
});

test("nierozpoznana wartość NIE wycisza procesu — wraca do `all` i jest zgłaszana", () => {
  // Literówka („workers", „Worker") w konfiguracji hostingu nie może objawić się stojącą kolejką.
  zRola("workers", () => {
    assert.equal(rolaProcesu(), "all");
    assert.equal(rolaNierozpoznana(), true);
    assert.equal(czyPrzetwarzaZadania(), true);
  });
  zRola("worker", () => assert.equal(rolaNierozpoznana(), false));
});

test("wielkość liter i spacje nie mają znaczenia", () => {
  zRola(" Worker ", () => {
    assert.equal(rolaProcesu(), "worker");
    assert.equal(rolaNierozpoznana(), false);
  });
});

test("stara flaga JOBS_WORKER_DISABLED dalej działa", () => {
  // Jest starsza od tej zmiany (Z-131) i mogła zostać ustawiona na produkcji. Znaczy dokładnie
  // to samo, co rola `web`: nie przetwarzaj zadań.
  zRola("all", () => {
    process.env.JOBS_WORKER_DISABLED = "1";
    assert.equal(czyPrzetwarzaZadania(), false);
    assert.equal(czyWykonujeOkresowe(), true, "flaga dotyczy zadań, nie pracy okresowej");
  });
});
