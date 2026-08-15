#!/usr/bin/env node
/**
 * Bramka IDEMPOTENCJI SUBSKRYBENTÓW (071, zadanie 22; rozdz. 9.4.4).
 *
 * Rozdz. 9.4.4 stawia wymóg jednym zdaniem: *„każdy subskrybent musi wytrzymać dwukrotne wywołanie
 * tym samym zdarzeniem"*. Zdanie w dokumencie jest życzeniem — przebieg 070 pokazał to na własnym
 * przykładzie, gdy zakaz wyrażony komentarzem nie zabraniał niczego, dopóki nie wszedł w typ
 * i w bramkę.
 *
 * **Ponowienie nie jest sytuacją wyjątkową.** Następuje zawsze, gdy worker padnie po wykonaniu
 * subskrybenta, a przed oznaczeniem zdarzenia jako dostarczone. Tego okna nie da się zamknąć —
 * subskrybent pisze do bazy własną transakcją. Subskrybent bez idempotencji zaksięguje wydatek
 * drugi raz i **nikt tego nie zauważy**, bo obie operacje wyglądają na poprawne.
 *
 * Cztery kontrole:
 *   1. KAŻDY SUBSKRYBENT MA WPIS — dodanie reakcji wymaga podjęcia decyzji o idempotencji.
 *   2. WPIS BEZ SUBSKRYBENTA — manifest nie może opisywać czegoś, czego nie ma.
 *   3. ZNANA WARTOŚĆ `idempotencja` — `klucz-unikalny` albo `naturalna`, plus uzasadnienie.
 *   4. `klucz-unikalny` MA POKRYCIE W KODZIE — plik używa `upsert` (wprost albo przez helper)
 *      **i** `event.id`. Klucz nieoparty na id zdarzenia nie jest stabilny między ponowieniami.
 *
 * ZNANA GRANICA, nazwana zamiast przemilczana: bramka sprawdza **obecność wzorca**, nie dowodzi
 * idempotencji. Dowodem jest test podwójnego dostarczenia, który mierzy **skutek**. Ta bramka
 * pilnuje wyłącznie tego, żeby nikt nie dodał subskrybenta **bez podjęcia decyzji**.
 */
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const manifestPath = path.join(root, "src/lib/subscribers-coverage.json");
const korzenPath = path.join(root, "src/lib/eventSubscribers.ts");

const DOZWOLONE = ["klucz-unikalny", "naturalna"];
/** Helpery, które robią `upsert` w środku — wywołanie ich liczy się jak `upsert`. */
const HELPERY_UPSERT = ["notifyUser"];

const bledy = [];

if (!fs.existsSync(manifestPath)) {
  console.error(`✗ Brak manifestu ${path.relative(root, manifestPath)}`);
  process.exit(1);
}
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const wpisy = manifest.subskrybenci ?? {};

// ─── Znajdź subskrybentów w kodzie ──────────────────────────────────────────
// Źródłem prawdy jest korzeń kompozycji: moduł, którego tam nie ma, nie dostarcza reakcji.

const korzen = fs.existsSync(korzenPath) ? fs.readFileSync(korzenPath, "utf8") : "";
const moduly = [...korzen.matchAll(/import\("@\/modules\/([a-z]+)\/events"\)/g)].map((m) => m[1]);

/** id subskrybenta → ścieżka pliku, w którym jest zadeklarowany. */
const wKodzie = new Map();

for (const modul of moduly) {
  const plik = path.join(root, "src/modules", modul, "events.ts");
  const wzgl = `src/modules/${modul}/events.ts`;
  if (!fs.existsSync(plik)) {
    bledy.push(`korzeń kompozycji wskazuje ${wzgl}, którego nie ma`);
    continue;
  }
  const surowa = fs.readFileSync(plik, "utf8");
  // Wzorce sprawdzamy na treści BEZ KOMENTARZY. Pierwsza wersja tego nie robiła i sonda
  // „klucz nie z event.id" nie zaczerwieniła bramki — bo `event.id` występowało w komentarzu
  // opisującym, że tak właśnie ma być. Bramka potwierdzała wtedy DOKUMENTACJĘ, nie kod.
  const tresc = surowa.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  for (const m of tresc.matchAll(/\bid:\s*"([a-z0-9.-]+)"/g)) {
    wKodzie.set(m[1], { wzgl, tresc });
  }
}

if (wKodzie.size === 0) {
  bledy.push(
    "nie znaleziono ani jednego subskrybenta. Mechanizm bez konsumenta jest gorszy niż jego brak " +
      "(C-35): ogłasza rozwiązanie, którego nikt nie stosuje."
  );
}

// ─── Kontrole 1, 3 i 4 ──────────────────────────────────────────────────────

for (const [id, { wzgl, tresc }] of wKodzie) {
  const wpis = wpisy[id];
  if (!wpis) {
    bledy.push(
      `subskrybent "${id}" (${wzgl}) nie ma wpisu w subscribers-coverage.json. Zadeklaruj, JAK ` +
        `zapewnia idempotencję — dostarczenie jest „co najmniej raz" (rozdz. 9.4.4), więc drugie ` +
        `wywołanie tym samym zdarzeniem NASTĄPI.`
    );
    continue;
  }
  if (!DOZWOLONE.includes(wpis.idempotencja)) {
    bledy.push(
      `subskrybent "${id}": pole "idempotencja" musi być jedną z: ${DOZWOLONE.join(", ")} ` +
        `(było: ${JSON.stringify(wpis.idempotencja)})`
    );
    continue;
  }
  if (!wpis.powod || String(wpis.powod).trim().length < 40) {
    bledy.push(`subskrybent "${id}": brak sensownego uzasadnienia w polu "powod"`);
  }
  if (wpis.plik && wpis.plik !== wzgl) {
    bledy.push(`subskrybent "${id}": manifest wskazuje ${wpis.plik}, a kod jest w ${wzgl}`);
  }

  if (wpis.idempotencja === "klucz-unikalny") {
    const maUpsert = /\.upsert\(/.test(tresc) || HELPERY_UPSERT.some((h) => tresc.includes(`${h}(`));
    const maIdZdarzenia = /event\.id/.test(tresc);
    if (!maUpsert) {
      bledy.push(
        `subskrybent "${id}": zadeklarowano "klucz-unikalny", ale w ${wzgl} nie widać ani \`upsert\`, ` +
          `ani helpera, który go robi (${HELPERY_UPSERT.join(", ")}). Sam zapis \`create\` przy ` +
          `ponowieniu utworzy DRUGI wiersz.`
      );
    }
    if (!maIdZdarzenia) {
      bledy.push(
        `subskrybent "${id}": zadeklarowano "klucz-unikalny", ale klucz nie jest wyprowadzony ` +
          `z \`event.id\`. Tylko id zdarzenia jest STABILNE między ponowieniami — klucz liczony ` +
          `z czasu albo z treści rozjedzie się przy drugim dostarczeniu i idempotencja zniknie.`
      );
    }
  }
}

// ─── Kontrola 2: wpis bez subskrybenta ──────────────────────────────────────

for (const id of Object.keys(wpisy)) {
  if (!wKodzie.has(id)) {
    bledy.push(`manifest opisuje subskrybenta "${id}", którego nie ma w kodzie — usuń nieaktualny wpis`);
  }
}

// ─── Wynik ──────────────────────────────────────────────────────────────────

if (bledy.length > 0) {
  console.error("✗ Idempotencja subskrybentów (zadanie 22):\n");
  for (const b of bledy) console.error(`  • ${b}`);
  console.error("");
  process.exit(1);
}

console.log(
  `✓ Subskrybenci zdarzeń: ${wKodzie.size} z zadeklarowaną idempotencją ` +
    `(${moduly.length} modułów w korzeniu kompozycji).`
);
