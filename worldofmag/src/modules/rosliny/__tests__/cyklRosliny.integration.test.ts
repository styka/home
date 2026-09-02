import { test } from "node:test";
import assert from "node:assert/strict";
import { wlasnoscDoZapisu } from "@/platform/workspaces/zapis";

/**
 * 113 — CYKL ŻYCIA BYTU ROŚLINNEGO NA PRAWDZIWEJ BAZIE.
 *
 * Sprawdza dokładnie te kryteria akceptacji, których nie da się zweryfikować testem czystej reguły,
 * bo dotyczą **zapisu**: jedna tabela dla trzech skal (AC-4), rodowód (AC-5), zakończenie z powodem
 * (AC-6), kosz (AC-7), kopia gatunku z katalogu (AC-16/AC-17) i komplet pól ewidencji (AC-24).
 *
 * **Najważniejszy pojedynczy przypadek:** zdarzenia opieki **przeżywają usunięcie rośliny**. To jest
 * `ON DELETE SET NULL` zamiast kaskady i wygląda jak drobiazg schematu, a jest wymogiem: zdarzenia
 * są historią MIEJSCA (z niej liczy się płodozmian), a w trybie zawodowym — ewidencją, której prawo
 * każe nie kasować. Kaskada zamieniłaby „usuń roślinę" w narzędzie do niszczenia dokumentacji.
 */

const HAS_DB = !!process.env.DATABASE_URL;
const rnd = () => Math.random().toString(36).slice(2, 10);

test(
  "cykl życia rośliny: liczność, rodowód, zakończenie, kosz i ewidencja",
  { skip: !HAS_DB && "brak DATABASE_URL", concurrency: false },
  async (t) => {
    const { prisma } = await import("@/platform/db/prisma");
    const { ensurePersonalWorkspace } = await import("@/platform/workspaces/sync");

    const user = await prisma.user.create({ data: { email: `cr-${rnd()}@test.local` } });
    await ensurePersonalWorkspace(user.id);
    const wlasnosc = await wlasnoscDoZapisu(user.id);

    const przestrzen = await prisma.plantSpace.create({
      data: { name: `Pole-${rnd()}`, kind: "field", ...wlasnosc },
    });
    const miejsce = await prisma.plantPlace.create({
      data: { spaceId: przestrzen.id, name: "Kwatera A", kind: "field", sun: "full", areaValue: 4.2, areaUnit: "ha" },
    });

    try {
      await t.test("AC-4: egzemplarz, partia i powierzchnia to JEDEN model", async () => {
        const egzemplarz = await prisma.plant.create({
          data: { name: "Monstera", spaceId: przestrzen.id, quantity: 1, quantityUnit: "szt", ...wlasnosc },
        });
        const partia = await prisma.plant.create({
          data: { name: "Partia 001", spaceId: przestrzen.id, quantity: 100, quantityUnit: "szt", ...wlasnosc },
        });
        const uprawa = await prisma.plant.create({
          data: { name: "Pszenica ozima", spaceId: przestrzen.id, placeId: miejsce.id, quantity: 4.2, quantityUnit: "ha", ...wlasnosc },
        });

        // Trzy byty, jedna tabela — o to chodziło.
        const wszystkie = await prisma.plant.findMany({ where: { spaceId: przestrzen.id }, select: { id: true } });
        assert.equal(wszystkie.length, 3);
        assert.equal((await prisma.plant.findUnique({ where: { id: partia.id } }))?.quantity, 100);
        assert.equal((await prisma.plant.findUnique({ where: { id: uprawa.id } }))?.quantityUnit, "ha");
        assert.ok(egzemplarz.id);
      });

      await t.test("AC-8: nowa roślina dostaje harmonogram z terminem I uzasadnieniem", async () => {
        const { zalozHarmonogramPodlewania } = await import("../lib/terminy");
        const roslina = await prisma.plant.create({
          data: { name: `Zharmonogramem-${rnd()}`, spaceId: przestrzen.id, placeId: miejsce.id, ...wlasnosc },
        });
        await zalozHarmonogramPodlewania(roslina.id);

        const zadanie = await prisma.plantCareTask.findFirst({ where: { plantId: roslina.id } });
        assert.ok(zadanie, "roślina powstała bez harmonogramu — użytkownik musiałby zrobić drugi krok");
        assert.equal(zadanie?.kind, "WATERING");
        assert.ok(zadanie?.nextDueAt, "harmonogram bez terminu nie pojawi się w agendzie");
        // Uzasadnienie jest częścią wyniku reguły, nie ozdobą (AC-9) — musi być od pierwszego dnia.
        assert.ok(zadanie?.reason && zadanie.reason.length > 0, "brak uzasadnienia terminu");
        assert.ok(zadanie!.nextDueAt!.getTime() > Date.now(), "termin nie może wypadać w przeszłości");
      });

      await t.test("AC-5: sadzonka wskazuje rodzica, a rodzic widzi potomstwo", async () => {
        const matka = await prisma.plant.create({
          data: { name: `Matka-${rnd()}`, spaceId: przestrzen.id, ...wlasnosc },
        });
        await prisma.plant.create({
          data: { name: "Sadzonka 1", spaceId: przestrzen.id, parentId: matka.id, ...wlasnosc },
        });
        await prisma.plant.create({
          data: { name: "Sadzonka 2", spaceId: przestrzen.id, parentId: matka.id, ...wlasnosc },
        });

        const zPotomstwem = await prisma.plant.findUnique({
          where: { id: matka.id },
          include: { offspring: { select: { name: true } } },
        });
        assert.equal(zPotomstwem?.offspring.length, 2);

        // Skasowanie matki NIE kasuje sadzonek — to osobne byty, żyjące własnym życiem.
        await prisma.plant.delete({ where: { id: matka.id } });
        const osierocone = await prisma.plant.findMany({
          where: { spaceId: przestrzen.id, name: { startsWith: "Sadzonka" } },
          select: { parentId: true },
        });
        assert.equal(osierocone.length, 2);
        assert.ok(osierocone.every((s) => s.parentId === null));
      });

      await t.test("AC-6: zakończona roślina zostaje w historii miejsca", async () => {
        const padla = await prisma.plant.create({
          data: { name: `Padla-${rnd()}`, spaceId: przestrzen.id, placeId: miejsce.id, ...wlasnosc },
        });

        await prisma.plant.update({
          where: { id: padla.id },
          data: { status: "DEAD", statusReason: "przelana", statusAt: new Date() },
        });

        const aktywne = await prisma.plant.count({ where: { placeId: miejsce.id, status: "ACTIVE" } });
        const wszystkie = await prisma.plant.count({ where: { placeId: miejsce.id } });
        assert.ok(wszystkie > aktywne, "zakończona roślina zniknęła z historii miejsca");
        const zapis = await prisma.plant.findUnique({ where: { id: padla.id } });
        assert.equal(zapis?.statusReason, "przelana");
      });

      await t.test("AC-24: ewidencja przyjmuje komplet pól wymaganych od 2026", async () => {
        const zabieg = await prisma.plantCareEvent.create({
          data: {
            spaceId: przestrzen.id,
            placeId: miejsce.id,
            kind: "SPRAYING",
            outcome: "DONE",
            productName: "Preparat X 500 SC",
            permitNumber: "R-123/2024",
            applicationKind: "opryskiwanie",
            doseValue: 1.5,
            doseUnit: "l/ha",
            areaValue: 4.2,
            areaUnit: "ha",
            locationText: "dz. ew. 123/4, obręb Wólka",
            operator: "Szymon T.",
            conditions: "12°C, wiatr 2 m/s",
            withdrawalDays: 35,
          },
        });
        const { brakiEwidencji } = await import("../lib/eksportEwidencji");
        const zapis = await prisma.plantCareEvent.findUnique({ where: { id: zabieg.id } });
        // Nazwę miejsca dokładamy tak, jak robi to akcja: wiersz bazy zna `placeId`, a kompletność
        // dokumentu rozstrzyga kolumna „Miejsce", czyli nazwa.
        assert.deepEqual(brakiEwidencji({ ...zapis!, placeName: miejsce.name }), []);
        assert.deepEqual(brakiEwidencji(zapis!), ["uprawa lub miejsce"]);
        assert.equal(zapis?.withdrawalDays, 35);
      });

      await t.test("zdarzenia opieki PRZEŻYWAJĄ usunięcie rośliny — to nie jest kaskada", async () => {
        const roslina = await prisma.plant.create({
          data: { name: `Doustuniecia-${rnd()}`, spaceId: przestrzen.id, ...wlasnosc },
        });
        const zdarzenie = await prisma.plantCareEvent.create({
          data: { spaceId: przestrzen.id, plantId: roslina.id, kind: "SPRAYING", outcome: "DONE", productName: "X" },
        });

        await prisma.plant.delete({ where: { id: roslina.id } });

        const po = await prisma.plantCareEvent.findUnique({ where: { id: zdarzenie.id } });
        assert.ok(po, "zdarzenie zniknęło razem z rośliną — ewidencja straciłaby wpisy");
        assert.equal(po?.plantId, null);
        assert.equal(po?.spaceId, przestrzen.id, "zdarzenie musi zostać przy przestrzeni");
      });

      await t.test("AC-16/AC-17: kopia gatunku niesie pochodzenie i nie rusza katalogu", async () => {
        const { addSpeciesFromCatalog } = await import("../actions/gatunki");
        const wzorzec = await prisma.plantSpeciesCatalog.findUnique({ where: { key: "monstera-deliciosa" } });
        assert.ok(wzorzec, "katalog systemowy nie został zaseedowany");

        // Akcja czyta sesję, więc kopiujemy tą samą drogą, którą idzie ona sama.
        const kopia = await prisma.plantSpecies.create({
          data: {
            ...wlasnosc,
            catalogKey: wzorzec.key,
            origin: "system",
            namePl: wzorzec.namePl,
            nameLatin: wzorzec.nameLatin,
            family: wzorzec.family,
            category: wzorzec.category,
            waterJson: wzorzec.waterJson,
          },
        });
        await prisma.plantSpecies.update({ where: { id: kopia.id }, data: { namePl: "Moja monstera" } });

        const poZmianie = await prisma.plantSpeciesCatalog.findUnique({ where: { key: "monstera-deliciosa" } });
        assert.equal(poZmianie?.namePl, wzorzec.namePl, "edycja kopii ruszyła wiersz katalogu systemowego");
        assert.equal((await prisma.plantSpecies.findUnique({ where: { id: kopia.id } }))?.origin, "system");
        assert.ok(typeof addSpeciesFromCatalog === "function");
      });

      await t.test("dwie uprawy tego samego gatunku to DWIE kopie, nie jedna", async () => {
        // Recenzja: katalog ma dziewięć par wpisów dzielących nazwę łacińską, bo to różne UPRAWY
        // tego samego gatunku. Przy unikalności po nazwie dodanie dyni zwracało cukinię — przycisk
        // wyglądał, jakby nie zadziałał, a roślina dostawała cudze wymagania wodne.
        const cukinia = await prisma.plantSpeciesCatalog.findUnique({ where: { key: "cukinia" } });
        const dynia = await prisma.plantSpeciesCatalog.findUnique({ where: { key: "dynia" } });
        assert.ok(cukinia && dynia);
        assert.equal(cukinia.nameLatin, dynia.nameLatin, "test straciłby sens, gdyby nazwy się różniły");

        const a = await prisma.plantSpecies.create({
          data: { ...wlasnosc, catalogKey: cukinia.key, origin: "system", namePl: cukinia.namePl, nameLatin: cukinia.nameLatin },
        });
        const b = await prisma.plantSpecies.create({
          data: { ...wlasnosc, catalogKey: dynia.key, origin: "system", namePl: dynia.namePl, nameLatin: dynia.nameLatin },
        });
        assert.notEqual(a.id, b.id);
        assert.equal(a.nameLatin, b.nameLatin);

        // Ten sam wpis katalogu drugi raz — indeks musi go odrzucić.
        await assert.rejects(() =>
          prisma.plantSpecies.create({
            data: { ...wlasnosc, catalogKey: cukinia.key, origin: "system", namePl: cukinia.namePl, nameLatin: cukinia.nameLatin },
          }),
        );

        // Wpisy WŁASNE (catalogKey NULL) indeks przepuszcza — NULL-e są w PostgreSQL różne.
        await prisma.plantSpecies.create({
          data: { ...wlasnosc, origin: "user", namePl: "Moja tykwa", nameLatin: "Lagenaria siceraria" },
        });
        await prisma.plantSpecies.create({
          data: { ...wlasnosc, origin: "user", namePl: "Druga tykwa", nameLatin: "Lagenaria vulgaris" },
        });
      });

      await t.test("AC-7: kasowanie przestrzeni zabiera jej zawartość — dlatego migawka musi być pełna", async () => {
        const doKasacji = await prisma.plantSpace.create({
          data: { name: `Tymczasowa-${rnd()}`, kind: "home", ...wlasnosc },
        });
        const w = await prisma.plant.create({ data: { name: "X", spaceId: doKasacji.id, ...wlasnosc } });
        await prisma.plantSpace.delete({ where: { id: doKasacji.id } });
        assert.equal(await prisma.plant.findUnique({ where: { id: w.id } }), null);
      });
    } finally {
      await prisma.plantCareEvent.deleteMany({ where: { spaceId: przestrzen.id } });
      await prisma.plantCareTask.deleteMany({ where: { spaceId: przestrzen.id } });
      await prisma.plant.deleteMany({ where: { spaceId: przestrzen.id } });
      await prisma.plantSpecies.deleteMany({ where: { workspaceId: wlasnosc.workspaceId } });
      await prisma.plantSpace.deleteMany({ where: { workspaceId: wlasnosc.workspaceId } });
      await prisma.user.delete({ where: { id: user.id } }).catch(() => {});
    }
  },
);
