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
  pulpit?: Record<string, unknown>;
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
  const src = read("src/lib/ai/agentPrompt.ts");
  const petSrc = read("src/lib/ai/petActions.ts");
  const start = src.indexOf("ACTION_CATALOG_BY_MODULE");
  const end = src.indexOf("const NAVIGATION_CATALOG");
  const body = src.slice(start, end);
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

  Array.from(body.matchAll(/^ {2}(\w+):\s*`([\s\S]*?)`,$/gm)).forEach((b) => {
    out[b[1]] = wyciagnij(b[2]);
  });
  // Katalog akcji Zwierząt mieszka w osobnym pliku — bramka dokleja go tak samo.
  out.pets = Array.from(new Set((out.pets ?? []).concat(wyciagnij(petSrc)))).sort();
  return out;
}

/** Nazwy narzędzi odczytu — z jawnej listy, którą przebieg ma wyprowadzić z deklaracji. */
function readToole(): string[] {
  const src = read("src/lib/ai/agentTools.ts");
  const start = src.indexOf("export const READ_TOOL_NAMES");
  const body = src.slice(start, src.indexOf("]", start));
  return Array.from(body.matchAll(/"([a-z_0-9]+)"/g)).map((m) => m[1]).sort();
}

/** Moduły, dla których trasa egzekucji ma gałąź. */
function egzekutory(): string[] {
  const src = read("src/app/api/llm/home/execute/route.ts");
  const mods = Array.from(src.matchAll(/module === "([a-z]+)"/g)).map((m) => m[1]);
  return Array.from(new Set(mods)).sort();
}

/** Typy zadań, które wolno zakolejkować z klienta. */
function zadaniaWTle(): string[] {
  const src = read("src/lib/jobs/handlers.ts");
  return Array.from(src.matchAll(/^\s*"([a-z]+\.[A-Za-z]+)":/gm)).map((m) => m[1]).sort();
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
        const { collectCalendarEvents } = await import("../src/modules/calendar/lib/collect");
        const now = new Date();
        const zdarzenia = await collectCalendarEvents(user.id, now.getFullYear(), now.getMonth());
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
      `${snapshot.kalendarz?.zdarzenia.length ?? 0} zdarzeń kalendarza → ${out}`,
  );
}

main();
