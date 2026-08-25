import fs from "node:fs";
import path from "node:path";

/**
 * Faza 0 / zadanie 1 — lista modułów WYWODZONA Z REJESTRU APLIKACJI.
 *
 * Ręcznie utrzymywana lista modułów w teście rozjeżdża się z aplikacją przy pierwszym nowym
 * module — i wtedy klikacz „21/21" po cichu przestaje znaczyć 21/21. Dlatego czytamy rejestr
 * w locie: listę przejściową w `src/lib/modules.tsx` **oraz** pliki `module.ts` w katalogach
 * `src/modules` (046 — moduł przeniesiony nosi swoją tożsamość u siebie).
 *
 * Dlaczego parsowanie tekstem, a nie import? `modules.tsx` importuje ikony `lucide-react`
 * i zawiera JSX — wciągnięcie go do procesu Playwrighta oznaczałoby ciągnięcie całego drzewa
 * Reacta do testu, który potrzebuje trzech pól. Wyrażenie regularne jest tu tańsze i wystarczająco
 * stabilne, bo wpisy rejestru są jednolinijkowe. Gdyby przestały być — test poniżej wywali się
 * na sprawdzeniu liczby, a nie po cichu pominie moduły.
 */

export interface E2EModule {
  id: string;
  label: string;
  href: string;
}

const REGISTRY = path.join(__dirname, "../../src/lib/modules.tsx");
const MODULES_DIR = path.join(__dirname, "../../src/modules");

/** Wpis listy przejściowej w rejestrze — jednolinijkowy. */
const ROW = /\{\s*id:\s*"(\w+)",\s*label:\s*"([^"]+)",\s*href:\s*"([^"]+)"/g;

/**
 * 046: moduł przeniesiony do `src/modules/` deklaruje się we własnym `module.ts`, w formacie
 * wielolinijkowym — jedno wyrażenie nie obsłuży obu kształtów, więc czytamy pola osobno.
 */
const FIELD = (name: string) => new RegExp(`\\b${name}:\\s*"([^"]+)"`);

function readDeclarations(): E2EModule[] {
  if (!fs.existsSync(MODULES_DIR)) return [];
  const out: E2EModule[] = [];
  for (const dir of fs.readdirSync(MODULES_DIR)) {
    const file = path.join(MODULES_DIR, dir, "module.ts");
    if (!fs.existsSync(file)) continue;
    const src = fs.readFileSync(file, "utf8");
    const id = src.match(FIELD("id"))?.[1];
    const label = src.match(FIELD("label"))?.[1];
    const href = src.match(FIELD("href"))?.[1];
    if (id && label && href) out.push({ id, label, href });
  }
  return out;
}

export function readModules(): E2EModule[] {
  const src = fs.readFileSync(REGISTRY, "utf8");
  const out: E2EModule[] = [];
  for (const m of src.matchAll(ROW)) {
    out.push({ id: m[1], label: m[2], href: m[3] });
  }
  return [...out, ...readDeclarations()];
}

/**
 * Ile modułów rejestr POWINIEN mieć. Liczba celowo zapisana wprost: jeśli parser przestanie
 * dopasowywać wpisy (bo ktoś rozbije je na kilka linii), test pokrycia zgłosi to jako błąd,
 * zamiast po cichu przetestować mniej modułów i dalej świecić na zielono.
 */
export const EXPECTED_MODULE_COUNT = 22; // 102: doszedł moduł YouTube
