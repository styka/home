import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { MODULE_META } from "../index";
import { assembleCalendar } from "../collect";

/**
 * Strażnik zgodności wkładów z metadanymi kalendarza.
 *
 * `CalendarContribEvent.module` jest w platformie zwykłym stringiem (platforma nie zna modułów),
 * a `assembleCalendar` do 113 rzutował go na `CalendarModule` w ciemno. Skutek: moduł Rośliny
 * emitował `module: "rosliny"` bez wpisu w `MODULE_META`, a `CalendarPage` czytała
 * `MODULE_META[ev.module].label` → TypeError wywalał CAŁĄ stronę kalendarza, gdy tylko w widocznym
 * zakresie pojawił się jeden zabieg roślinny. Kompilator milczał — dokładnie dlatego pilnuje tego
 * ten test: każdy literał `module: "<x>"` w `src/modules/<moduł>/calendar.ts` musi mieć wpis
 * w `MODULE_META`.
 */
test("każdy wkład kalendarzowy modułu ma wpis w MODULE_META", () => {
  const modulesDir = path.join(__dirname, "..", "..", "..");
  const contribFiles = fs
    .readdirSync(modulesDir)
    .map((dir) => path.join(modulesDir, dir, "calendar.ts"))
    .filter((p) => fs.existsSync(p));
  assert.ok(contribFiles.length >= 8, `spodziewane wkłady kalendarzowe, znaleziono ${contribFiles.length}`);

  for (const file of contribFiles) {
    const src = fs.readFileSync(file, "utf8");
    const emitted = [...src.matchAll(/module:\s*"([a-z-]+)"/g)].map((m) => m[1]);
    assert.ok(emitted.length > 0, `${file}: wkład nie emituje żadnego 'module: "…"' — test wymaga aktualizacji wzorca`);
    for (const id of emitted) {
      assert.ok(
        id in MODULE_META,
        `${file}: emituje module "${id}", którego nie ma w MODULE_META (src/modules/calendar/lib/index.ts) — dopisz etykietę i akcent, inaczej strona kalendarza się wywali`
      );
    }
  }
});

test("assembleCalendar odrzuca wkład z nieznanym modułem zamiast wywalać konsumentów", () => {
  const znany = { id: "a", module: "tasks", title: "T", date: "2026-01-01", at: null, href: "/tasks", accent: "x" };
  const nieznany = { id: "b", module: "nie-ma-takiego", title: "N", date: "2026-01-01", at: null, href: "/x", accent: "x" };
  const wynik = assembleCalendar([znany, nieznany]);
  assert.equal(wynik.length, 1);
  assert.equal(wynik[0].id, "a");
});
