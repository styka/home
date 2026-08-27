import { test } from "node:test";
import assert from "node:assert/strict";

/**
 * 107 (U-1 z recenzji) — DOSTĘP DO KANAŁU ZESPOŁU PO OPUSZCZENIU ZESPOŁU.
 *
 * Test istnieje, bo ta luka **raz już przeszła przez weryfikację**. Sonda dowodziła wtedy AC-25 na
 * ścieżce „usunięto przestrzeń zespołu", gdzie kaskada klucza obcego działa poprawnie — a kryterium
 * mówi o **opuszczeniu zespołu**, gdzie żadna kaskada nie biegnie: `removeMember`/`leaveTeam` kasują
 * `TeamMember` i `WorkspaceMember`, ale o wierszu `ChatParticipant` nie wiedzą. Były członek widział
 * kanał i jego NOWE wiadomości.
 *
 * Dlatego mierzymy **skutek na bazie**, a nie obecność wzorca w kodzie, i trzymamy dwie KONTROLE
 * DODATNIE. Bez nich test przechodziłby też wtedy, gdyby ktoś przez pomyłkę odciął od kanału
 * wszystkich — a to jest awaria równie poważna, tylko głośniejsza.
 */
const HAS_DB = !!process.env.DATABASE_URL;
const rnd = () => Math.random().toString(36).slice(2, 10);

test(
  "czat: opuszczenie zespołu odbiera dostęp do jego kanału",
  { skip: !HAS_DB && "brak DATABASE_URL", concurrency: false },
  async () => {
    const { prisma } = await import("@/platform/db/prisma");
    const { widoczneRozmowyWhere } = await import("../dostep");

    const s = `t107-${rnd()}`;
    const zostaje = await prisma.user.create({ data: { email: `${s}-a@t.pl`, name: "Zostaje" } });
    const odchodzi = await prisma.user.create({ data: { email: `${s}-b@t.pl`, name: "Odchodzi" } });
    const team = await prisma.team.create({ data: { name: `Z ${s}`, ownerId: zostaje.id } });
    const ws = await prisma.workspace.create({ data: { kind: "team", name: team.name, teamId: team.id } });
    await prisma.workspaceMember.createMany({
      data: [
        { workspaceId: ws.id, userId: zostaje.id, role: "OWNER" },
        { workspaceId: ws.id, userId: odchodzi.id, role: "MEMBER" },
      ],
    });
    const kanal = await prisma.chatConversation.create({
      data: { rodzaj: "zespol", workspaceId: ws.id, tytul: team.name },
    });
    await prisma.chatParticipant.createMany({
      data: [{ conversationId: kanal.id, userId: zostaje.id }, { conversationId: kanal.id, userId: odchodzi.id }],
    });

    const widzi = async (userId: string) =>
      (await prisma.chatConversation.findMany({ where: widoczneRozmowyWhere(userId), select: { id: true } }))
        .some((r) => r.id === kanal.id);

    try {
      assert.equal(await widzi(odchodzi.id), true, "kontrola dodatnia: członek zespołu widzi kanał");

      // Dokładnie to, co robią `removeMember`/`leaveTeam` wraz z uzgodnieniem lustra przestrzeni.
      await prisma.workspaceMember.delete({
        where: { workspaceId_userId: { workspaceId: ws.id, userId: odchodzi.id } },
      });
      await prisma.chatMessage.create({
        data: { conversationId: kanal.id, autorId: zostaje.id, tresc: "treść po wyjściu" },
      });

      assert.equal(await widzi(odchodzi.id), false, "były członek NIE widzi kanału ani jego nowych wiadomości");
      assert.equal(await widzi(zostaje.id), true, "kontrola dodatnia: pozostały członek widzi kanał dalej");

      // Wiersz uczestnictwa celowo PRZEŻYWA wyjście: dostęp rozstrzygamy przy odczycie, a nie
      // kasowaniem kopii w każdym miejscu mutującym zespół. Gdyby ten wiersz znikał, test
      // przechodziłby z zupełnie innego powodu i nie mierzyłby tego, co ma mierzyć.
      const uczestnictwo = await prisma.chatParticipant.findUnique({
        where: { conversationId_userId: { conversationId: kanal.id, userId: odchodzi.id } },
      });
      assert.notEqual(uczestnictwo, null, "dostępu broni odczyt, nie kasowanie wiersza uczestnictwa");
    } finally {
      await prisma.chatConversation.deleteMany({ where: { id: kanal.id } });
      await prisma.workspace.deleteMany({ where: { id: ws.id } });
      await prisma.team.deleteMany({ where: { id: team.id } });
      await prisma.user.deleteMany({ where: { email: { startsWith: s } } });
    }
  },
);
