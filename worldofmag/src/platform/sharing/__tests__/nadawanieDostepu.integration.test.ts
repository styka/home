import { test } from "node:test";
import assert from "node:assert/strict";

/**
 * 090 (zadanie 14, strona zapisu) — NADAWANIE I ODBIERANIE DOSTĘPU.
 *
 * To jest kod, który **daje obcym ludziom dostęp do cudzych danych**, więc przypadki dobrane są pod
 * to, co przy takiej operacji wolno zepsuć najmniej: kto może nadawać, czy nadanie faktycznie działa,
 * czy odebranie faktycznie odbiera, i czy nie da się odebrać czegoś, co wróci samo.
 */
const HAS_DB = !!process.env.DATABASE_URL;
const rnd = () => Math.random().toString(36).slice(2, 10);

test(
  "nadawanie dostępu: uprawnienie, skutek, odebranie i ślad",
  { skip: !HAS_DB && "brak DATABASE_URL", concurrency: false },
  async (t) => {
    const { prisma } = await import("@/platform/db/prisma");
    const { ensurePersonalWorkspace } = await import("@/platform/workspaces/sync");
    const { nadajDostep, odbierzDostep, nadaniaZasobu, odbierzZaproszeniaZasobow } = await import("@/lib/sharingGrants");
    const { canAccess } = await import("../access");
    const { getAccessContext } = await import("../cache");
    const { loadResourceCatalog } = await import("@/lib/sharingResources");

    const wlasciciel = await prisma.user.create({ data: { email: `share-w-${rnd()}@test.local` } });
    const obcy = await prisma.user.create({ data: { email: `share-o-${rnd()}@test.local` } });
    await ensurePersonalWorkspace(wlasciciel.id);
    await ensurePersonalWorkspace(obcy.id);
    const przestrzen = await prisma.workspace.findUniqueOrThrow({ where: { personalUserId: wlasciciel.id } });
    const projekt = await prisma.taskProject.create({
      data: { name: `udost-${rnd()}`, workspaceId: przestrzen.id },
    });
    const ref = { type: "tasks.project", id: projekt.id };
    const katalog = await loadResourceCatalog();

    try {
      await t.test("OBCY nie może udostępniać cudzego zasobu", async () => {
        // Najważniejszy przypadek w całym pliku: gdyby ta ścieżka przechodziła, każdy zalogowany
        // rozdawałby dostęp do wszystkiego.
        await assert.rejects(
          () => nadajDostep(obcy.id, ref.type, ref.id, { rodzaj: "user", email: wlasciciel.email! }, "viewer"),
          /Access denied/i,
        );
      });

      await t.test("nadanie osobowe FAKTYCZNIE daje dostęp", async () => {
        assert.equal(
          await canAccess(obcy.id, ref, "project.read", katalog, await getAccessContext(obcy.id)),
          false,
          "przed nadaniem obcy nie ma czego czytać",
        );
        const wynik = await nadajDostep(wlasciciel.id, ref.type, ref.id, { rodzaj: "user", email: obcy.email! }, "viewer");
        assert.equal(wynik.rodzaj, "nadano");
        assert.equal(
          await canAccess(obcy.id, ref, "project.read", katalog, await getAccessContext(obcy.id)),
          true,
          "nadanie, które nie zmienia rozstrzygnięcia dostępu, jest tylko wierszem w tabeli",
        );
        // Rola `viewer` czyta, ale nie zmienia — inaczej „podgląd" byłby nazwą bez treści.
        assert.equal(
          await canAccess(obcy.id, ref, "task.edit", katalog, await getAccessContext(obcy.id)),
          false,
        );
      });

      await t.test("kto ma PODGLĄD, nie może udostępniać dalej", async () => {
        // To jest właściwa granica, a nie „obcy bez żadnej relacji": ten drugi przypadek odrzuca
        // już samo `resolveRole === null`, więc nie dowodzi, że wymagamy roli `manager`.
        // Bez tego sprawdzenia każdy z podglądem rozdawałby dostęp dalej — eskalacja uprawnień
        // przez udostępnianie, najcichszy z możliwych wariantów.
        await assert.rejects(
          () => nadajDostep(obcy.id, ref.type, ref.id, { rodzaj: "link" }, "viewer"),
          /Access denied/i,
        );
      });

      await t.test("powtórne nadanie ZMIENIA rolę, a nie pada", async () => {
        await nadajDostep(wlasciciel.id, ref.type, ref.id, { rodzaj: "user", email: obcy.email! }, "editor");
        assert.equal(
          await canAccess(obcy.id, ref, "task.edit", katalog, await getAccessContext(obcy.id)),
          true,
        );
        const { nadania } = await nadaniaZasobu(wlasciciel.id, ref.type, ref.id);
        const osobowe = nadania.filter((n) => n.subjectType === "user");
        assert.equal(osobowe.length, 1, "podniesienie roli nie może tworzyć drugiego nadania");
      });

      await t.test("zdarzenie o nadaniu jest ogłoszone — to brakujący producent z 085", async () => {
        const zdarzenia = await prisma.domainEvent.findMany({
          where: { workspaceId: przestrzen.id, type: "sharing.grant.granted" },
        });
        assert.ok(zdarzenia.length >= 1, "bez zdarzenia cache dostępu nie miałby czym się unieważniać");
      });

      await t.test("ślad audytowy w kategorii `sharing`", async () => {
        const wpisy = await prisma.auditLog.findMany({
          where: { category: "sharing", action: "grant.created" },
          orderBy: { createdAt: "desc" },
          take: 5,
        });
        assert.ok(wpisy.length >= 1, "rozdz. 12.3 wymienia nadania w dzienniku jako obowiązek, nie funkcję");
      });

      await t.test("odebranie dostępu FAKTYCZNIE odbiera", async () => {
        const { nadania } = await nadaniaZasobu(wlasciciel.id, ref.type, ref.id);
        const osobowe = nadania.find((n) => n.subjectType === "user")!;
        await odbierzDostep(wlasciciel.id, osobowe.id);
        assert.equal(
          await canAccess(obcy.id, ref, "project.read", katalog, await getAccessContext(obcy.id)),
          false,
          "po odebraniu dostęp musi zniknąć NATYCHMIAST (rozdz. 11.1.3)",
        );
      });

      await t.test("nadania Z LUSTRA nie da się odebrać tym oknem", async () => {
        // Skasowanie samego odbicia zniknęłoby przy najbliższej synchronizacji, a użytkownik
        // zobaczyłby dostęp, który „wrócił sam" — objaw bez śladu w logach.
        const lustro = await prisma.resourceGrant.create({
          data: {
            workspaceId: przestrzen.id, resourceType: ref.type, resourceId: ref.id,
            subjectType: "user", subjectId: obcy.id, role: "editor",
            inherited: true, createdById: wlasciciel.id,
          },
        });
        await assert.rejects(() => odbierzDostep(wlasciciel.id, lustro.id), /członkostwa/);
        await prisma.resourceGrant.delete({ where: { id: lustro.id } });
      });

      await t.test("link dostaje token, a dwa linki są dwoma nadaniami", async () => {
        // Znana luka z 051: `@@unique` nie łapie nadań linkowych (`subjectId IS NULL`). Poprawka to
        // TOŻSAMOŚĆ (token), nie zakaz dwóch linków — dwa linki o różnej roli są uzasadnione.
        const a = await nadajDostep(wlasciciel.id, ref.type, ref.id, { rodzaj: "link" }, "viewer");
        const b = await nadajDostep(wlasciciel.id, ref.type, ref.id, { rodzaj: "link" }, "editor");
        assert.equal(a.rodzaj, "link");
        assert.equal(b.rodzaj, "link");
        if (a.rodzaj === "link" && b.rodzaj === "link") assert.notEqual(a.token, b.token);
        const linki = await prisma.resourceGrant.findMany({
          where: { resourceType: ref.type, resourceId: ref.id, subjectType: "link" },
        });
        assert.equal(linki.length, 2);
        assert.ok(linki.every((l) => l.token), "baza pilnuje `CHECK`: link bez tokenu byłby dostępem, którego nie da się użyć");
      });

      await t.test("adres bez konta daje ZAPROSZENIE, nie nadanie — i realizuje się przy pierwszym wejściu", async () => {
        const email = `share-nowy-${rnd()}@test.local`;
        const wynik = await nadajDostep(wlasciciel.id, ref.type, ref.id, { rodzaj: "user", email }, "viewer");
        assert.equal(wynik.rodzaj, "zaproszono", "nadanie dla nieistniejącego konta nie ma komu dać dostępu");

        const nowy = await prisma.user.create({ data: { email } });
        await ensurePersonalWorkspace(nowy.id);
        try {
          assert.equal(await odbierzZaproszeniaZasobow(nowy.id, email), 1);
          assert.equal(
            await canAccess(nowy.id, ref, "project.read", katalog, await getAccessContext(nowy.id)),
            true,
          );
          // Drugie wejście nie może zrealizować tego samego zaproszenia po raz drugi.
          assert.equal(await odbierzZaproszeniaZasobow(nowy.id, email), 0);
        } finally {
          await prisma.resourceGrant.deleteMany({ where: { subjectId: nowy.id } });
          await prisma.workspaceMember.deleteMany({ where: { userId: nowy.id } });
          await prisma.workspace.deleteMany({ where: { personalUserId: nowy.id } });
          await prisma.user.delete({ where: { id: nowy.id } });
        }
      });
    } finally {
      await prisma.resourceInvitation.deleteMany({ where: { resourceId: projekt.id } });
      await prisma.resourceGrant.deleteMany({ where: { resourceId: projekt.id } });
      await prisma.domainEvent.deleteMany({ where: { workspaceId: przestrzen.id } });
      await prisma.auditLog.deleteMany({ where: { category: "sharing", actorId: null } });
      await prisma.notification.deleteMany({ where: { userId: { in: [wlasciciel.id, obcy.id] } } });
      await prisma.taskProject.deleteMany({ where: { id: projekt.id } });
      await prisma.workspaceMember.deleteMany({ where: { userId: { in: [wlasciciel.id, obcy.id] } } });
      await prisma.workspace.deleteMany({ where: { personalUserId: { in: [wlasciciel.id, obcy.id] } } });
      await prisma.user.deleteMany({ where: { id: { in: [wlasciciel.id, obcy.id] } } });
      await prisma.rateLimitBucket.deleteMany({ where: { key: { contains: "nadania:" } } });
    }
  },
);
