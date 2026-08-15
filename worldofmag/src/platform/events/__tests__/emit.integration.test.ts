import { test } from "node:test";
import assert from "node:assert/strict";

/**
 * 070 (zadanie 21) — ZDARZENIE JEST NIEROZŁĄCZNE Z MUTACJĄ. Test na realnym Postgresie.
 *
 * **Najważniejszy jest tu test WYCOFANIA, nie test powodzenia.** Obecność wiersza po udanym
 * zapisie niczego nie dowodzi — dowodzi go dopiero jego BRAK po zapisie nieudanym. Rozdz. 9.4.2
 * ostrzega, że rozjazd stanu i zdarzeń jest **niewidoczny**: nie ma błędu, nie ma logu, jest tylko
 * reakcja, która nigdy nie nastąpiła. Jedyne miejsce, gdzie da się to złapać, to właśnie ten test.
 *
 * ZNANA GRANICA TYCH TESTÓW, nazwana wprost: nie wołają prawdziwych akcji (`completeShopping`,
 * `bulkSetPantryQuantities`), bo te wymagają sesji, a repo nie ma wzorca jej podstawiania
 * i wprowadzanie go byłoby zakresem spoza tego przebiegu (C-53). Sprawdzają więc MECHANIZM.
 * Własności zależnych od kształtu kodu producenta — przede wszystkim „jedno zdarzenie na spis,
 * nie N" — pilnuje bramka `check:events`, która patrzy na PRAWDZIWY plik producenta.
 */
const HAS_DB = !!process.env.DATABASE_URL;
const rnd = () => Math.random().toString(36).slice(2, 10);

async function zUzytkownikiem(fn: (userId: string, workspaceId: string) => Promise<void>) {
  const { prisma } = await import("@/platform/db/prisma");
  const { ensurePersonalWorkspace } = await import("@/platform/workspaces/sync");
  const user = await prisma.user.create({
    data: { email: `events-${rnd()}@test.local`, name: "Test zdarzeń" },
  });
  // Przestrzeń zakładamy PRAWDZIWĄ ścieżką, nie `workspace.create` wprost. Sam wiersz `Workspace`
  // nie wystarcza: kontekst dostępu liczy przestrzenie z CZŁONKOSTWA (`WorkspaceMember`), więc
  // fixture tworzący samą przestrzeń dawał `personalWorkspaceId === null` i test przechodził
  // z niewłaściwego powodu. Dokładnie ten błąd wywrócił tabelę prawdy w 056.
  await ensurePersonalWorkspace(user.id);
  const ws = await prisma.workspace.findUniqueOrThrow({ where: { personalUserId: user.id } });
  try {
    await fn(user.id, ws.id);
  } finally {
    await prisma.domainEvent.deleteMany({ where: { workspaceId: ws.id } });
    await prisma.workspace.delete({ where: { id: ws.id } }).catch(() => {});
    await prisma.user.delete({ where: { id: user.id } }).catch(() => {});
  }
}

test(
  "WYCOFANIE: nieudana transakcja nie zostawia ANI zmiany stanu, ANI zdarzenia",
  { skip: !HAS_DB && "brak DATABASE_URL" },
  async () => {
    const { prisma } = await import("@/platform/db/prisma");
    const { emitDomainEvent } = await import("../emit");

    await zUzytkownikiem(async (userId, workspaceId) => {
      const lista = await prisma.shoppingList.create({
        data: { name: `Lista ${rnd()}`, ownerId: userId, workspaceId },
      });

      await assert.rejects(
        prisma.$transaction(async (tx) => {
          await tx.shoppingList.update({ where: { id: lista.id }, data: { archived: true } });
          await emitDomainEvent(tx, {
            workspaceId,
            module: "shopping",
            type: "shopping.list.completed",
            actorId: userId,
            payload: { listId: lista.id },
          });
          // Awaria PO emisji — dokładnie ten moment, w którym outbox bez transakcji się rozjeżdża.
          throw new Error("awaria po emisji");
        }),
        /awaria po emisji/
      );

      const po = await prisma.shoppingList.findUnique({ where: { id: lista.id } });
      assert.equal(po?.archived, false, "stan wrócił do sprzed transakcji");

      const zdarzenia = await prisma.domainEvent.findMany({ where: { workspaceId } });
      assert.equal(zdarzenia.length, 0, "zdarzenie NIE zostało — inaczej mechanizm jest atrapą");

      await prisma.shoppingList.delete({ where: { id: lista.id } });
    });
  }
);

test(
  "POWODZENIE: zdarzenie niesie sprawcę, przestrzeń, moduł, rodzaj i ładunek, i jest niedostarczone",
  { skip: !HAS_DB && "brak DATABASE_URL" },
  async () => {
    const { prisma } = await import("@/platform/db/prisma");
    const { emitDomainEvent } = await import("../emit");

    await zUzytkownikiem(async (userId, workspaceId) => {
      await prisma.$transaction(async (tx) => {
        await emitDomainEvent(tx, {
          workspaceId,
          module: "magazynowanie",
          type: "magazynowanie.stan.zmieniony",
          actorId: userId,
          payload: { itemId: "abc", delta: -2, stanPo: 5 },
        });
      });

      const [z] = await prisma.domainEvent.findMany({ where: { workspaceId } });
      assert.ok(z, "zdarzenie istnieje");
      assert.equal(z.workspaceId, workspaceId);
      assert.equal(z.module, "magazynowanie");
      assert.equal(z.type, "magazynowanie.stan.zmieniony");
      assert.equal(z.actorId, userId, "sprawca zapisany — przy zasobie współdzielonym to pytanie padnie");
      assert.deepEqual(z.payload, { itemId: "abc", delta: -2, stanPo: 5 });
      assert.equal(z.deliveredAt, null, "niedostarczone — worker z zadania 22 ma je zobaczyć");
      assert.ok(z.id.length > 0, "identyfikator jest kluczem idempotencji dla zadania 22");
    });
  }
);

test(
  "PRZESTRZEŃ BIERZE SIĘ Z ZASOBU, NIE Z AUTORA — inaczej zdarzenie zespołowe trafia w prywatny strumień",
  { skip: !HAS_DB && "brak DATABASE_URL" },
  async () => {
    const { workspaceIdDlaZdarzenia } = await import("../emit");

    // To jest właściwość, którą łatwo zepsuć i której nie widać: strumień zdarzeń jest strumieniem
    // PRZESTRZENI (rozdz. 11.1), więc zdarzenie o zasobie zespołowym musi trafić do przestrzeni
    // zespołu. Gdyby brało przestrzeń osobistą klikającego, współpracownicy nigdy by go nie
    // zobaczyli — a nic by o tym nie powiedziało.
    await zUzytkownikiem(async (userId, wsOsobista) => {
      const wsZespolu = "przestrzen-zespolu-testowa";
      assert.equal(
        await workspaceIdDlaZdarzenia(wsZespolu, userId),
        wsZespolu,
        "przestrzeń zasobu wygrywa z przestrzenią autora"
      );
      assert.equal(
        await workspaceIdDlaZdarzenia(null, userId),
        wsOsobista,
        "brak przestrzeni zasobu (sierota po 0227) spada na przestrzeń osobistą autora"
      );
    });
  }
);

test(
  "BRAK PRZESTRZENI: mutacja przechodzi, zdarzenia nie ma, nic nie rzuca",
  { skip: !HAS_DB && "brak DATABASE_URL" },
  async () => {
    const { prisma } = await import("@/platform/db/prisma");
    const { workspaceIdDlaZdarzenia } = await import("../emit");

    // Użytkownik BEZ przestrzeni osobistej — sytuacja realna (konto sprzed backfillu 0227),
    // ta sama, która wywróciła tabelę prawdy w 056.
    const user = await prisma.user.create({
      data: { email: `events-bezws-${rnd()}@test.local`, name: "Bez przestrzeni" },
    });
    try {
      const przestrzen = await workspaceIdDlaZdarzenia(null, user.id);
      assert.equal(przestrzen, null, "brak przestrzeni rozpoznany");

      const lista = await prisma.shoppingList.create({
        data: { name: `Lista ${rnd()}`, ownerId: user.id },
      });
      // Producent pomija emisję — mutacja ma się udać mimo braku przestrzeni.
      await prisma.$transaction(async (tx) => {
        await tx.shoppingList.update({ where: { id: lista.id }, data: { archived: true } });
      });
      const po = await prisma.shoppingList.findUnique({ where: { id: lista.id } });
      assert.equal(po?.archived, true, "mutacja się udała — zdarzenie jest dodatkiem, nie warunkiem");

      await prisma.shoppingList.delete({ where: { id: lista.id } });
    } finally {
      await prisma.user.delete({ where: { id: user.id } }).catch(() => {});
    }
  }
);

test(
  "ładunek zbiorczy: MECHANIZM znosi jedno zdarzenie na wiele zmienionych wierszy",
  { skip: !HAS_DB && "brak DATABASE_URL" },
  async () => {
    const { prisma } = await import("@/platform/db/prisma");
    const { emitDomainEvent } = await import("../emit");

    await zUzytkownikiem(async (userId, workspaceId) => {
      // Ten test sprawdza MECHANIZM (jedno wywołanie → jeden wiersz, niezależnie od liczby
      // zmienionych rekordów), a NIE kształt pętli w prawdziwym producencie — patrz nagłówek pliku.
      // Tego drugiego pilnuje kontrola 5 bramki `check:events`.
      const listy = await Promise.all(
        [1, 2, 3, 4, 5].map((i) =>
          prisma.shoppingList.create({ data: { name: `L${i}-${rnd()}`, ownerId: userId, workspaceId } })
        )
      );

      await prisma.$transaction(async (tx) => {
        let zmienione = 0;
        for (const l of listy) {
          await tx.shoppingList.update({ where: { id: l.id }, data: { archived: true } });
          zmienione += 1;
        }
        await emitDomainEvent(tx, {
          workspaceId,
          module: "kitchen",
          type: "kuchnia.spizarnia.spisana",
          actorId: userId,
          payload: { pozycji: zmienione },
        });
      });

      const zdarzenia = await prisma.domainEvent.findMany({ where: { workspaceId } });
      assert.equal(zdarzenia.length, 1, "jedno zdarzenie na całą operację, nie jedno na wiersz");
      assert.deepEqual(zdarzenia[0].payload, { pozycji: 5 });

      await prisma.shoppingList.deleteMany({ where: { id: { in: listy.map((l) => l.id) } } });
    });
  }
);
