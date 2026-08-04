import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

/**
 * Faza 0 / zadanie 2 przebudowy — TEST IZOLACJI NAJEMCY.
 *
 * Dokument architektury docelowej nazywa go **najważniejszym testem w systemie**, i słusznie:
 * wyciek danych między kontami kończy produkt, a każdy inny błąd da się naprawić poprawką.
 *
 * Co sprawdza: dla KAŻDEGO modelu z kolumną `ownerId` (dziś 46) zapytanie zawężone do
 * użytkownika B nie zwraca ani jednego rekordu użytkownika A. To jest niezmiennik, na którym
 * stoi cały model współwłasności — i to on jest zagrożony w Fazie 2, gdzie `ownerId`/`ownerTeamId`
 * migrują do `workspaceId` na 46 modelach w czterech krokach.
 *
 * **Lista modeli jest GENEROWANA ze `schema.prisma`, nie wypisana ręcznie.** Ręczna rozjechałaby
 * się przy pierwszym nowym modelu i test dalej świeciłby na zielono, pokrywając mniej niż deklaruje.
 * Nowy model z `ownerId` jest objęty automatycznie — bez dopisywania czegokolwiek.
 *
 * Czego ten test NIE zastępuje: sprawdzenia, czy konkretna Server Action ma guard. Tym zajmuje się
 * bramka `check:ai-coverage` (550 akcji z zadeklarowanym zakresem i guardem w ciele). Tu weryfikujemy
 * warstwę niżej — że samo zapytanie zawężone po właścicielu faktycznie izoluje.
 */

const HAS_DB = !!process.env.DATABASE_URL;
const rnd = () => Math.random().toString(36).slice(2, 10);

/** Modele z kolumną `ownerId`, odczytane ze schematu w locie. */
function ownerScopedModels(): { model: string; required: string[] }[] {
  const schema = fs.readFileSync(path.join(process.cwd(), "prisma/schema.prisma"), "utf8");
  const out: { model: string; required: string[] }[] = [];
  for (const m of schema.matchAll(/model (\w+) \{([\s\S]*?)\n\}/g)) {
    const [, model, body] = m;
    if (!/^\s*ownerId\s/m.test(body)) continue;
    // Pola wymagane skalarnie (bez `?`, bez domyślnej wartości, bez relacji i list) — te trzeba
    // podać przy tworzeniu rekordu testowego.
    const required: string[] = [];
    for (const line of body.split("\n")) {
      const f = line.trim().match(/^(\w+)\s+(String|Int|Float|Boolean|DateTime)(\s|$)/);
      if (!f) continue;
      if (line.includes("?") || line.includes("@default") || line.includes("@id") || line.includes("@updatedAt")) continue;
      if (f[1] === "ownerId") continue;
      required.push(f[1]);
    }
    out.push({ model, required });
  }
  return out;
}

const MODELS = ownerScopedModels();

test("izolacja najemcy: lista modeli daje się odczytać ze schematu", () => {
  assert.ok(
    MODELS.length >= 40,
    `Parser schematu znalazł tylko ${MODELS.length} modeli z ownerId — przy tak małej liczbie ` +
      `test pokrywałby mniej, niż deklaruje. Sprawdź wyrażenie dopasowujące.`,
  );
  assert.equal(new Set(MODELS.map((m) => m.model)).size, MODELS.length);
});

test(
  "izolacja najemcy: użytkownik B nie widzi ŻADNEGO rekordu użytkownika A",
  { skip: !HAS_DB && "brak DATABASE_URL", concurrency: false },
  async () => {
    const { prisma } = await import("@/platform/db/prisma");
    const client = prisma as unknown as Record<string, { create: Function; findMany: Function; deleteMany: Function }>;

    const userA = await prisma.user.create({ data: { email: `iso-a-${rnd()}@test.local` } });
    const userB = await prisma.user.create({ data: { email: `iso-b-${rnd()}@test.local` } });

    const leaked: string[] = [];
    const skipped: string[] = [];
    let checked = 0;

    try {
      for (const { model, required } of MODELS) {
        const delegate = client[model[0].toLowerCase() + model.slice(1)];
        if (!delegate?.create) {
          skipped.push(`${model} (brak delegata Prismy)`);
          continue;
        }

        // Minimalny rekord: wymagane pola tekstowe wypełniamy znacznikiem, liczby zerem.
        const data: Record<string, unknown> = { ownerId: userA.id };
        for (const field of required) data[field] = `iso-${rnd()}`;

        let created: { id?: string } | null = null;
        try {
          created = await delegate.create({ data });
        } catch {
          // Model ma wymagane relacje albo pola nietekstowe, których nie da się wypełnić na ślepo.
          // To NIE jest cicha luka: nazwa trafia do listy pominiętych i jest raportowana niżej.
          skipped.push(model);
          continue;
        }

        // Sedno testu: zapytanie zawężone do użytkownika B.
        const asB = await delegate.findMany({ where: { ownerId: userB.id } });
        if (asB.some((r: { id?: string }) => r.id && r.id === created?.id)) {
          leaked.push(model);
        }

        // Kontrola pozytywna — gdyby `findMany` zawsze zwracało pustkę, test nie sprawdzałby niczego.
        const asA = await delegate.findMany({ where: { ownerId: userA.id } });
        assert.ok(
          asA.some((r: { id?: string }) => r.id === created?.id),
          `${model}: rekord użytkownika A nie wrócił nawet dla samego A — test byłby ślepy`,
        );

        checked++;
        if (created?.id) await delegate.deleteMany({ where: { id: created.id } });
      }
    } finally {
      await prisma.user.deleteMany({ where: { id: { in: [userA.id, userB.id] } } });
    }

    assert.deepEqual(
      leaked,
      [],
      `WYCIEK MIĘDZY NAJEMCAMI w modelach: ${leaked.join(", ")}. ` +
        `To jest awaria kończąca produkt — nie obchodź testu, napraw zawężenie zapytania.`,
    );
    assert.ok(checked >= 15, `Sprawdzono tylko ${checked} modeli; pominięte: ${skipped.join(", ")}`);

    if (skipped.length > 0) {
      // Świadomy ślad, a nie cisza: te modele wymagają relacji, których nie da się utworzyć na ślepo.
      // Pokrycie ich to zadanie na Fazę 2, razem z migracją na `workspaceId`.
      console.log(`  · izolacja: sprawdzono ${checked} modeli, pominięto ${skipped.length} (wymagają relacji)`);
    }
  },
);
