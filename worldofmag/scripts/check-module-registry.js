#!/usr/bin/env node
/**
 * Bramka REJESTRU MODUŁÓW (046, zadanie 7 z rozdz. 14).
 *
 * Cel przebudowy z rozdz. 9.3 brzmi „8 → 1": dodanie modułu ma wymagać **jednego katalogu
 * i jednej deklaracji**, a nie wpisu w ośmiu równoległych listach. Deklaracja spełnia to jednak
 * tylko wtedy, gdy naprawdę istnieje i naprawdę jest wpięta. Katalog w `src/modules/` bez
 * `module.ts` to moduł, którego nie ma w menu; bez `contract.ts` to moduł bez granicy, do którego
 * wnętrza wolno sięgnąć, bo reguła lintu nie ma czego chronić.
 *
 * Bramka jest **statyczna** (czyta pliki, nie uruchamia aplikacji) — tak samo jak `check:actions`
 * czy `check:ui-contract`. Sprawdza cztery rzeczy:
 *   1. każdy katalog modułu ma `module.ts` i `contract.ts`,
 *   2. deklaracja ma komplet wymaganych pól,
 *   3. identyfikatory modułów są unikalne,
 *   4. każda deklaracja jest **wpięta w korzeń kompozycji** (`src/lib/modules.tsx`) — bez tego
 *      moduł istnieje na dysku i nie istnieje w aplikacji, a build jest zielony.
 */
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const modulesDir = path.join(root, "src/modules");
const compositionRoot = path.join(root, "src/lib/modules.tsx");

/** Pola, bez których deklaracja nie opisuje modułu. `permission` może być `null`, ale musi wystąpić. */
const REQUIRED = ["id", "label", "href", "permission", "color", "Icon", "defaultEnabled"];

if (!fs.existsSync(modulesDir)) {
  console.log("✓ Rejestr modułów: brak katalogu src/modules — nic do sprawdzenia.");
  process.exit(0);
}

const errors = [];
const ids = new Map();

const dirs = fs
  .readdirSync(modulesDir, { withFileTypes: true })
  .filter((e) => e.isDirectory())
  .map((e) => e.name)
  .sort();

const composition = fs.existsSync(compositionRoot) ? fs.readFileSync(compositionRoot, "utf8") : "";

for (const name of dirs) {
  const dir = path.join(modulesDir, name);
  const modulePath = path.join(dir, "module.ts");
  const contractPath = path.join(dir, "contract.ts");

  if (!fs.existsSync(contractPath)) {
    errors.push(
      `src/modules/${name}: brak contract.ts.\n` +
        "    Moduł bez kontraktu nie ma granicy — reguła lintu nie ma czego chronić, a inne moduły\n" +
        "    nie mają czego importować. Kontrakt może eksportować same typy; nie może nie istnieć.",
    );
  }

  if (!fs.existsSync(modulePath)) {
    errors.push(
      `src/modules/${name}: brak module.ts.\n` +
        "    Bez deklaracji moduł nie trafia do rejestru — nie ma go w menu, w uprawnieniach\n" +
        "    ani w mapowaniu ścieżek, mimo że jego kod istnieje.",
    );
    continue;
  }

  const src = fs.readFileSync(modulePath, "utf8");

  if (!/defineModule\s*\(/.test(src)) {
    errors.push(
      `src/modules/${name}/module.ts: nie wywołuje defineModule().\n` +
        "    Deklaracja pisana ręcznie omija kontrolę typów, która jest tu jedynym zabezpieczeniem.",
    );
    continue;
  }

  for (const field of REQUIRED) {
    if (!new RegExp(`(^|[\\s{,])${field}\\s*:`, "m").test(src)) {
      errors.push(`src/modules/${name}/module.ts: deklaracja nie ma pola „${field}".`);
    }
  }

  const idMatch = src.match(/\bid\s*:\s*["'`]([^"'`]+)["'`]/);
  if (!idMatch) {
    errors.push(`src/modules/${name}/module.ts: pole „id" musi być literałem tekstowym.`);
  } else {
    const id = idMatch[1];
    if (ids.has(id)) {
      errors.push(
        `Zduplikowany identyfikator modułu „${id}" (src/modules/${ids.get(id)} i src/modules/${name}).\n` +
          "    Dwa moduły o tym samym id nadpisałyby sobie preferencje menu użytkownika.",
      );
    }
    ids.set(id, name);
  }

  // 4. Wpięcie w korzeń kompozycji. Szukamy importu deklaracji — to jedyne miejsce, w którym
  //    moduł faktycznie wchodzi do aplikacji.
  if (!composition.includes(`@/modules/${name}/module`)) {
    errors.push(
      `src/modules/${name}/module.ts nie jest zaimportowany w src/lib/modules.tsx.\n` +
        "    Moduł istnieje na dysku i NIE istnieje w aplikacji — build przy tym pozostaje zielony,\n" +
        "    więc bez tej kontroli objawiłoby się to dopiero brakiem pozycji w menu.",
    );
  }
}

// ─── 5. Moduł pisany „po staremu" (048, AC-11 / domknięcie AC-6 z 046) ──────────────────
//
// Do tej pory bramka pilnowała tylko katalogów, które JUŻ są w `src/modules/`. Nie mogła
// pilnować czegoś odwrotnego — modułu rozsypanego po `src/actions/` i `src/components/` — bo
// dokładnie tak wyglądała większość aplikacji i reguła zapaliłaby się na całym istniejącym
// kodzie. Po fali 3 lista przejściowa jest pusta, więc kontrola staje się wykonalna.
//
// Zasada: identyfikator obecny w rejestrze nie może mieć kodu poza swoim katalogiem.
// `src/actions/<id>.ts` i `src/components/<id>/` to najczęstsze miejsca, w które trafiłby nowy
// moduł pisany z pamięci starego układu.
const actionsDir = path.join(root, "src/actions");
const componentsDir = path.join(root, "src/components");

for (const [id, dir] of ids) {
  const strays = [];
  const legacyAction = path.join(actionsDir, `${id}.ts`);
  const legacyComponents = path.join(componentsDir, id);
  if (fs.existsSync(legacyAction)) strays.push(`src/actions/${id}.ts`);
  if (fs.existsSync(legacyComponents)) strays.push(`src/components/${id}/`);

  if (strays.length) {
    errors.push(
      `Moduł „${id}" ma kod POZA swoim katalogiem: ${strays.join(", ")}.\n` +
        `    Moduł mieszka w src/modules/${dir}/ — akcje w actions/, widoki w ui/, logika w lib/.\n` +
        "    Kod w starych miejscach omija granicę: reguła ESLint go nie pilnuje, więc każdy może\n" +
        "    go zaimportować bezpośrednio i sprzężenie znów stanie się niewidoczne.",
    );
  }
}

if (errors.length) {
  console.error("\n✖ Rejestr modułów — niekompletne moduły w src/modules/:\n");
  console.error(errors.map((e) => `  ✖ ${e}`).join("\n\n"));
  console.error("");
  process.exit(1);
}

console.log(
  `✓ Rejestr modułów: ${dirs.length} modułów w src/modules — każdy z contract.ts, kompletną deklaracją, wpięciem w rejestr i bez kodu poza swoim katalogiem.`,
);
