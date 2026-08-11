/**
 * 049/T-1 — ZRZUT POWIERZCHNI, którą przebieg ma zachować bez zmian.
 *
 * Katalog asystenta, allowlista zadań w tle, agregat kalendarza i migawka pulpitu są po tym
 * przebiegu składane **z deklaracji modułów** zamiast z ręcznych list. To zmiana czysto
 * strukturalna, więc jedynym dowodem, że nic nie zginęło, jest porównanie „przed" z „po" —
 * a materiału „przed" po przenosinach już się nie odtworzy.
 *
 * Skrypt jest **narzędziem przebiegu**, nie częścią aplikacji: uruchamiany ręcznie
 * (`npx tsx scripts/snapshot-ai-surface.ts <plik.json>`), czyta wyłącznie, niczego nie zapisuje
 * do bazy. Część statyczna działa bez bazy; część runtime wymaga lokalnego Postgresa z seedem
 * (C-13 — nigdy produkcyjnego).
 */
import fs from "fs";
import path from "path";

const root = path.join(__dirname, "..");
const read = (p: string) => fs.readFileSync(path.join(root, p), "utf8");

type Snapshot = {
  akcjeAsystenta: Record<string, string[]>;
  readToole: string[];
  egzekutory: string[];
  zadaniaWTle: string[];
  kalendarz?: { userId: string; miesiac: string; zdarzenia: string[] };
  pulpit?: { zUprawnieniami: Record<string, unknown>; bezUprawnien: Record<string, unknown> };
};

/**
 * Typy akcji per moduł.
 *
 * Wyciąg celowo **powtarza logikę `check-action-coverage.js`** zamiast wymyślać własną: to bramka
 * decyduje, co jest akcją (dziś 160), więc zrzut liczony inaczej porównywałby co innego niż to,
 * czego pilnujemy. Różnica jest jedna — bramka zwraca płaski zbiór, a nam potrzebny jest podział
 * na moduły, żeby po przebudowie sprawdzić, że żaden moduł nie zgubił swojego wkładu.
 */
function akcjeZKatalogu(): Record<string, string[]> {
  // 049: katalog akcji nie jest już mapą w prompcie — każdy moduł wnosi swój blok.
  const out: Record<string, string[]> = {};

  const wyciagnij = (tresc: string) => {
    const stripped = tresc.replace(/\{[^{}]*\}/g, " ").replace(/\([^()]*\)/g, " ");
    const typy = new Set<string>();
    // Array.from zamiast spreadu iteratora — `tsconfig.json` nie ustawia `target`, więc obowiązuje
    // ES5 i `[...set]` się nie kompiluje. Skrypty repo trzymają się tego ograniczenia.
    Array.from(stripped.matchAll(/\b([a-z]+_[a-z_]+)\b/g)).forEach((m) => typy.add(m[1]));
    typy.delete("web_search");
    return Array.from(typy).sort();
  };

  const modulesDir = path.join(root, "src/modules");
  for (const mod of fs.readdirSync(modulesDir)) {
    const aiDir = path.join(modulesDir, mod, "ai");
    if (!fs.existsSync(aiDir)) continue;
    let tresc = "";
    for (const f of fs.readdirSync(aiDir)) {
      if (f.endsWith(".ts") && !["executor.ts", "readTools.ts", "index.ts"].includes(f)) {
        tresc += "\n" + fs.readFileSync(path.join(aiDir, f), "utf8");
      }
    }
    if (tresc) out[mod] = wyciagnij(tresc);
  }
  return out;
}

/** Nazwy narzędzi odczytu — z jawnej listy, którą przebieg ma wyprowadzić z deklaracji. */
function readToole(): string[] {
  // 049: nazwy narzędzi odczytu pochodzą z wkładów modułowych i przekrojowego.
  const nazwy: string[] = [];
  const zbierz = (tresc: string) => {
    const start = tresc.indexOf("export const readTools:");
    if (start < 0) return;
    Array.from(tresc.slice(start).matchAll(/^  ([a-z_0-9]+): async /gm)).forEach((m) => nazwy.push(m[1]));
  };
  const modulesDir = path.join(root, "src/modules");
  for (const mod of fs.readdirSync(modulesDir)) {
    const f = path.join(modulesDir, mod, "ai", "readTools.ts");
    if (fs.existsSync(f)) zbierz(fs.readFileSync(f, "utf8"));
  }
  zbierz(read("src/lib/ai/coreReadTools.ts"));
  return nazwy.sort();
}

/** Moduły, dla których trasa egzekucji ma gałąź. */
function egzekutory(): string[] {
  // 049: egzekutory mieszkają w modułach, a nie w łańcuchu `if` w trasie.
  const modulesDir = path.join(root, "src/modules");
  return fs.readdirSync(modulesDir)
    .filter((m) => fs.existsSync(path.join(modulesDir, m, "ai", "executor.ts")))
    .sort();
}

/** Typy zadań, które wolno zakolejkować z klienta. */
function zadaniaWTle(): string[] {
  // 049: allowlista składa się z deklaracji modułów + wkładu platformy.
  const typy: string[] = [];
  const zbierz = (f: string) => {
    if (!fs.existsSync(f)) return;
    Array.from(fs.readFileSync(f, "utf8").matchAll(/^\s*"([a-z]+\.[A-Za-z]+)":/gm)).forEach((m) => typy.push(m[1]));
  };
  const modulesDir = path.join(root, "src/modules");
  for (const mod of fs.readdirSync(modulesDir)) zbierz(path.join(modulesDir, mod, "jobs", "index.ts"));
  zbierz(path.join(root, "src/platform/jobs/handlers/index.ts"));
  return typy.sort();
}

async function main() {
  const out = process.argv[2];
  if (!out) throw new Error("Podaj ścieżkę pliku wyjściowego.");

  const snapshot: Snapshot = {
    akcjeAsystenta: akcjeZKatalogu(),
    readToole: readToole(),
    egzekutory: egzekutory(),
    zadaniaWTle: zadaniaWTle(),
  };

  // ── Część runtime: wymaga lokalnej bazy z seedem. Brak bazy nie jest błędem — część
  // statyczna i tak jest zapisywana, a runtime dociągniemy osobno.
  if (process.env.DATABASE_URL) {
    try {
      const { prisma } = await import("../src/platform/db/prisma");
      const user = await prisma.user.findFirst({ where: { email: { not: null } }, select: { id: true, email: true } });
      if (user) {
        const { collectCalendarEvents } = await import("../src/lib/calendarAgenda");
        const now = new Date();
        const zdarzenia = await collectCalendarEvents(user.id, now.getFullYear(), now.getMonth());
        // 050: migawka pulpitu — dwa zrzuty. Drugi (bez uprawnień) jest materiałem do AC-5:
        // wkład modułu, do którego użytkownik nie ma dostępu, nie może zostać zawołany.
        const { collectDashboardSnapshotLegacy } = await import("../src/lib/dashboardLegacy");
        const WSZYSTKIE = [
          "module.shopping", "module.tasks", "module.notes", "module.kitchen", "module.pets",
          "module.flota", "module.portfel", "module.languages", "module.health",
          "module.magazynowanie",
        ];
        const stabilnie = (v: unknown): unknown =>
          JSON.parse(JSON.stringify(v, (k, val) => (k === "id" ? "<id>" : val)));
        snapshot.pulpit = {
          zUprawnieniami: stabilnie(await collectDashboardSnapshotLegacy(user.id, WSZYSTKIE, false)) as Record<string, unknown>,
          bezUprawnien: stabilnie(await collectDashboardSnapshotLegacy(user.id, [], false)) as Record<string, unknown>,
        };

        snapshot.kalendarz = {
          userId: user.email ?? user.id,
          miesiac: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`,
          // Porównujemy TREŚĆ zdarzeń, nie identyfikatory obiektów — po przebudowie mają być te same.
          zdarzenia: zdarzenia
            .map((e) => `${e.date}|${e.module}|${e.title}`)
            .sort(),
        };
      }
      await prisma.$disconnect();
    } catch (e) {
      snapshot.kalendarz = { userId: "(niedostępne)", miesiac: String(e).slice(0, 200), zdarzenia: [] };
    }
  }

  fs.writeFileSync(out, JSON.stringify(snapshot, null, 2) + "\n");
  const liczbaAkcji = Object.values(snapshot.akcjeAsystenta).reduce((n, a) => n + a.length, 0);
  console.log(
    `✓ Zrzut: ${Object.keys(snapshot.akcjeAsystenta).length} modułów / ${liczbaAkcji} akcji · ` +
      `${snapshot.readToole.length} read-tooli · ${snapshot.egzekutory.length} egzekutorów · ` +
      `${snapshot.zadaniaWTle.length} typów zadań · ` +
      `${snapshot.kalendarz?.zdarzenia.length ?? 0} zdarzeń kalendarza · ` +
      `${Object.keys(snapshot.pulpit?.zUprawnieniami ?? {}).length} pól migawki pulpitu → ${out}`,
  );
}

main();
