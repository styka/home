import { test } from "node:test";
import assert from "node:assert/strict";

/**
 * 112 (AC-9) — ZAKŁADANIE ZWIERZĘCIA Z PEŁNYM PROFILEM.
 *
 * Zgłoszenie „pies Raj": użytkownik prosił, żeby ustawić „wszystko, co można ustawić". Akcja
 * `add_pet` zapisywała wtedy wyłącznie imię, gatunek, rasę i płeć — mimo że model danych ma pola na
 * datę urodzenia, pochodzenie, mikroczip, umaszczenie i notatki od dawna. Wąskim gardłem był
 * KONTRAKT AKCJI, nie baza, więc naprawa nie wymagała migracji.
 *
 * Dwa niezmienniki, które łatwo złamać:
 *  1. niepoprawna data jest POMIJANA, nigdy zapisywana jako `Invalid Date` (Prisma by ją przyjęła,
 *     a uszkodzenie wyszłoby dopiero przy odczycie),
 *  2. `update_pet` uzupełnia profil, nie kasuje pól, których nie podano.
 */

const HAS_DB = !!process.env.DATABASE_URL;
const rnd = () => Math.random().toString(36).slice(2, 10);

test(
  "add_pet zapisuje pełny profil, update_pet go uzupełnia",
  { skip: !HAS_DB && "brak DATABASE_URL", concurrency: false },
  async (t) => {
    const { prisma } = await import("@/platform/db/prisma");
    const { executePetAction } = await import("@/modules/pets/ai/executor");

    const uzytkownik = await prisma.user.create({ data: { email: `pet-${rnd()}@test.local` } });
    const imie = `Raj-${rnd()}`;

    try {
      await t.test("add_pet: pola profilu trafiają do rekordu (AC-9)", async () => {
        await executePetAction(
          {
            id: "a1",
            module: "pets",
            type: "add_pet",
            description: "Dodaj psa",
            params: {
              name: imie,
              species: "pies",
              breed: "golden retriever",
              sex: "male",
              birthDate: "2021-03-14",
              birthApprox: true,
              acquiredFrom: "hodowla Pod Dębem",
              microchipId: "616093900123456",
              color: "złoty",
              notes: "Niedoczynność tarczycy, Forthyron 400 rano.",
            },
          },
          uzytkownik.id
        );

        const pet = await prisma.pet.findFirstOrThrow({ where: { name: imie } });
        assert.equal(pet.species, "dog", "polska nazwa gatunku zmapowana na klucz");
        assert.equal(pet.breed, "golden retriever");
        assert.equal(pet.birthDate?.toISOString().slice(0, 10), "2021-03-14");
        assert.equal(pet.birthApprox, true);
        assert.equal(pet.acquiredFrom, "hodowla Pod Dębem");
        assert.equal(pet.microchipId, "616093900123456");
        assert.equal(pet.color, "złoty");
        assert.match(pet.notes ?? "", /Forthyron/);
      });

      await t.test("niepoprawna data jest POMIJANA, nie zapisywana jako Invalid Date", async () => {
        const imie2 = `Bezdaty-${rnd()}`;
        await executePetAction(
          {
            id: "a1",
            module: "pets",
            type: "add_pet",
            description: "Dodaj psa bez daty",
            params: { name: imie2, species: "pies", birthDate: "ok. 2021", acquiredAt: "" },
          },
          uzytkownik.id
        );
        const pet = await prisma.pet.findFirstOrThrow({ where: { name: imie2 } });
        assert.equal(pet.birthDate, null, "nieparsowalna data → pole puste, NIGDY Invalid Date");
        assert.equal(pet.acquiredAt, null);
        await prisma.pet.delete({ where: { id: pet.id } });
      });

      // `update_pet` idzie przez Server Action (`updatePet` → `requireAuth`), której nie da się
      // wywołać poza zakresem żądania — dlatego sprawdzamy tu SAM kształt danych, wspólny dla obu
      // wejść. To on decyduje o niezmienniku „uzupełniamy, nie kasujemy": pola niepodane muszą być
      // w ogóle nieobecne w łatce, a nie ustawione na `undefined`.
      await t.test("łatka profilu zawiera WYŁĄCZNIE pola podane (update nie kasuje reszty)", async () => {
        const { poleProfilu } = await import("@/modules/pets/ai/executor");
        const latka = poleProfilu({ identifier: "obroża niebieska" });
        assert.deepEqual(Object.keys(latka), ["identifier"], "żadnych dodatkowych kluczy");
        assert.equal("breed" in latka, false, "pole niepodane nie trafia do łatki nawet jako undefined");
      });

      await t.test("data szacunkowa nie zamienia się w konkretny dzień", async () => {
        const { poleProfilu } = await import("@/modules/pets/ai/executor");
        // `new Date("ok. 2021")` zwraca 1 stycznia 2021 — gdyby przeszło, użytkownik zobaczyłby
        // precyzyjną datę urodzenia, której nigdy nie podał.
        assert.equal("birthDate" in poleProfilu({ birthDate: "ok. 2021" }), false);
        assert.equal("birthDate" in poleProfilu({ birthDate: "2021-03-14" }), true);
      });
    } finally {
      await prisma.pet.deleteMany({ where: { name: { startsWith: "Raj-" } } });
      await prisma.user.delete({ where: { id: uzytkownik.id } });
    }
  }
);
