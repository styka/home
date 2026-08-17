import { test } from "node:test";
import assert from "node:assert/strict";
import { wlasnoscDoZapisu } from "@/platform/workspaces/zapis";

/**
 * 063 (zadanie 17) — ODWOŁANIE DOSTĘPU DZIAŁA NATYCHMIAST.
 *
 * Rozdz. 12.2 nazywa ten test **nowym i nieoczywistym**, i podaje powód: cache rozstrzygnięć
 * dostępu (11.5) wprowadza ryzyko, że **odebranie uprawnień zadziała dopiero po wygaśnięciu wpisu**.
 * Byłaby to *„dziura bezpieczeństwa wprowadzona przez optymalizację"* — czyli najgorszy rodzaj,
 * bo powstaje w zmianie, która z bezpieczeństwem nie miała nic wspólnego.
 *
 * Dziś cache jest **per żądanie** (052), więc odwołanie działa natychmiast **z definicji** —
 * i właśnie dlatego ten test trzeba napisać TERAZ, a nie wtedy, gdy dojdzie cache
 * międzyżądaniowy. Test napisany po fakcie pisze się już pod istniejące zachowanie; ten zostaje
 * jako **warunek**, który każda przyszła optymalizacja musi spełnić.
 *
 * **Czego tu nie ma:** części „także przy aktywnym SSE". Strumienia zdarzeń nie ma jeszcze
 * w aplikacji (Faza 4, zadania 21–23), a test na nieistniejący mechanizm sprawdzałby wyłącznie
 * własną atrapę. Dopisanie go należy do zadania 23.
 */

const HAS_DB = !!process.env.DATABASE_URL;
const rnd = () => Math.random().toString(36).slice(2, 10);

test(
  "odwołanie dostępu: po odebraniu nadania dostęp znika natychmiast",
  { skip: !HAS_DB && "brak DATABASE_URL", concurrency: false },
  async (t) => {
    const { prisma } = await import("@/platform/db/prisma");
    const { ensurePersonalWorkspace } = await import("@/platform/workspaces/sync");
    const { mirrorProjectMember, unmirrorProjectMember } = await import("../grantMirror");
    const { requireTaskModuleAccess } = await import("@/modules/tasks/lib/sharingGuard");

    const wlasciciel = await prisma.user.create({ data: { email: `rv-o-${rnd()}@test.local` } });
    const wspolpracownik = await prisma.user.create({ data: { email: `rv-w-${rnd()}@test.local` } });
    await ensurePersonalWorkspace(wlasciciel.id);
    await ensurePersonalWorkspace(wspolpracownik.id);

    const projekt = await prisma.taskProject.create({
      data: { name: `RV-${rnd()}`, ...(await wlasnoscDoZapisu(wlasciciel.id)) },
    });

    const maDostep = async (userId: string): Promise<boolean> => {
      try {
        await requireTaskModuleAccess(userId, { type: "tasks.project", id: projekt.id }, "task.edit");
        return true;
      } catch {
        return false;
      }
    };

    try {
      await t.test("bez członkostwa — brak dostępu", async () => {
        assert.equal(await maDostep(wspolpracownik.id), false);
      });

      await t.test("po nadaniu członkostwa — dostęp jest", async () => {
        await prisma.taskProjectMember.create({
          data: { projectId: projekt.id, userId: wspolpracownik.id, role: "MEMBER" },
        });
        await mirrorProjectMember(projekt.id, wspolpracownik.id, "MEMBER", wlasciciel.id);
        assert.equal(await maDostep(wspolpracownik.id), true);
      });

      await t.test("po ODEBRANIU — dostęp znika NATYCHMIAST, bez czekania na cokolwiek", async () => {
        // Sedno testu. Nie ma tu `sleep`, nie ma czyszczenia cache, nie ma drugiego żądania.
        // Kolejne sprawdzenie następuje bezpośrednio po odebraniu i MUSI zwrócić odmowę.
        await prisma.taskProjectMember.delete({
          where: { projectId_userId: { projectId: projekt.id, userId: wspolpracownik.id } },
        });
        await unmirrorProjectMember(projekt.id, wspolpracownik.id);

        assert.equal(
          await maDostep(wspolpracownik.id),
          false,
          "dostęp odebrany przed chwilą nie może działać ani sekundy dłużej",
        );
      });

      await t.test("nadanie z minioną datą ważności nie daje nic", async () => {
        // Druga droga odwołania: `expiresAt`. Nadanie, które wygasło, jest w bazie i nie może
        // niczego przyznawać — inaczej „czasowy dostęp" byłby dostępem bezterminowym.
        const p = await prisma.taskProject.findUnique({
          where: { id: projekt.id },
          select: { workspaceId: true },
        });
        await prisma.resourceGrant.create({
          data: {
            workspaceId: p!.workspaceId!,
            resourceType: "tasks.project",
            resourceId: projekt.id,
            subjectType: "user",
            subjectId: wspolpracownik.id,
            role: "editor",
            expiresAt: new Date(Date.now() - 60_000),
            createdById: wlasciciel.id,
          },
        });
        assert.equal(await maDostep(wspolpracownik.id), false);
      });

      await t.test("to samo nadanie z datą w przyszłości — dostęp działa", async () => {
        // Kontrola mocy poprzedniej asercji: gdyby odmowa brała się z czegoś innego niż data,
        // ten przypadek też byłby czerwony i poprzedni nic by nie dowodził.
        await prisma.resourceGrant.updateMany({
          where: {
            resourceType: "tasks.project",
            resourceId: projekt.id,
            subjectType: "user",
            subjectId: wspolpracownik.id,
          },
          data: { expiresAt: new Date(Date.now() + 3_600_000) },
        });
        assert.equal(await maDostep(wspolpracownik.id), true);
      });
    } finally {
      await prisma.resourceGrant.deleteMany({ where: { resourceId: projekt.id } });
      await prisma.taskProject.delete({ where: { id: projekt.id } }).catch(() => {});
      for (const u of [wlasciciel, wspolpracownik]) {
        await prisma.user.delete({ where: { id: u.id } }).catch(() => {});
      }
    }
  },
);
