import { test } from "node:test";
import assert from "node:assert/strict";

/**
 * 085 (zadanie 29, Faza 5) — STEMPEL PRZESTRZENI.
 *
 * Stempel jest kluczem cache'u agregatów, więc jego błąd nie objawia się awarią, tylko **starymi
 * danymi na ekranie** — najtrudniejszym do zauważenia rodzajem usterki. Stąd cztery przypadki
 * dobrane pod cztery sposoby, w jakie mógłby milczeć.
 */
const HAS_DB = !!process.env.DATABASE_URL;
const rnd = () => Math.random().toString(36).slice(2, 10);

test(
  "stempel zmienia się przy każdym zdarzeniu i tylko we właściwej przestrzeni",
  { skip: !HAS_DB && "brak DATABASE_URL", concurrency: false },
  async (t) => {
    const { prisma } = await import("@/platform/db/prisma");
    const { stempelPrzestrzeni } = await import("../stempel");
    const { ensurePersonalWorkspace } = await import("@/platform/workspaces/sync");

    const a = await prisma.user.create({ data: { email: `stempel-a-${rnd()}@test.local` } });
    const b = await prisma.user.create({ data: { email: `stempel-b-${rnd()}@test.local` } });
    await ensurePersonalWorkspace(a.id);
    await ensurePersonalWorkspace(b.id);
    const moja = await prisma.workspace.findUniqueOrThrow({ where: { personalUserId: a.id } });
    const cudza = await prisma.workspace.findUniqueOrThrow({ where: { personalUserId: b.id } });

    const zdarzenie = (workspaceId: string, createdAt?: Date) =>
      prisma.domainEvent.create({
        data: { type: "test.stempel", module: "test", workspaceId, payload: {}, ...(createdAt ? { createdAt } : {}) },
      });

    try {
      await t.test("bez przestrzeni zwraca stałą, a nie pusty klucz", async () => {
        // Pusty tekst w kluczu cache'u skleiłby się z sąsiednim segmentem — konto bez przestrzeni
        // dostawałoby wpis kogoś innego.
        assert.equal(await stempelPrzestrzeni([]), "pusto");
      });

      await t.test("nowe zdarzenie zmienia stempel", async () => {
        const przed = await stempelPrzestrzeni([moja.id]);
        await zdarzenie(moja.id);
        assert.notEqual(await stempelPrzestrzeni([moja.id]), przed);
      });

      await t.test("zdarzenie w TEJ SAMEJ milisekundzie też zmienia stempel", async () => {
        // `createdAt` ma dokładność milisekundy. Stempel zbudowany z samego znacznika czasu nie
        // odróżniłby dwóch zdarzeń zapisanych razem — drugie byłoby niewidoczne, a agregat
        // pokazywałby stan sprzed niego.
        const chwila = new Date();
        await zdarzenie(moja.id, chwila);
        const przed = await stempelPrzestrzeni([moja.id]);
        await zdarzenie(moja.id, chwila);
        assert.notEqual(await stempelPrzestrzeni([moja.id]), przed, "liczność w stemplu jest po to, żeby to złapać");
      });

      await t.test("zdarzenie w CUDZEJ przestrzeni nie rusza mojego stempla", async () => {
        // Inaczej każda mutacja w systemie unieważniałaby cache wszystkim — cache przestałby
        // cokolwiek dawać, a nikt by tego nie zauważył poza rachunkiem za bazę.
        const przed = await stempelPrzestrzeni([moja.id]);
        await zdarzenie(cudza.id);
        assert.equal(await stempelPrzestrzeni([moja.id]), przed);
      });
    } finally {
      await prisma.domainEvent.deleteMany({ where: { workspaceId: { in: [moja.id, cudza.id] } } });
      await prisma.workspaceMember.deleteMany({ where: { userId: { in: [a.id, b.id] } } });
      await prisma.workspace.deleteMany({ where: { id: { in: [moja.id, cudza.id] } } });
      await prisma.user.deleteMany({ where: { id: { in: [a.id, b.id] } } });
    }
  },
);
