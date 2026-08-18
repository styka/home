import { getUserTeamIds, ownedWhereAsync } from "@/platform/auth/serverUtils";
import { prisma } from "@/platform/db/prisma";
import { clampLimit, asStr } from "@/lib/ai/readToolShared";
import type { AiReadToolHandler } from "@/platform/ai/contribution";

/**
 * 049: narzędzia ODCZYTU tego modułu — wkład do asystenta, składany z deklaracji.
 *
 * Wcześniej wszystkie 56 narzędzi mieszkało w jednym `switch (name)` w warstwie AI, która
 * importowała kontrakty szesnastu modułów. Treść jest ta sama; zmienia się właściciel.
 */
export const readToolsPrompt = [
  "- list_contacts: args { search?, limit? } → [{ id, name, phone, email, company, tags }]. Kontakty (osobisty CRM). search filtruje po imieniu/telefonie/mailu/firmie/tagach.",
].join("\n");

export const readTools: Record<string, AiReadToolHandler> = {
  list_contacts: async (args, userId) => {
      const search = asStr(args.search);
      const contacts = await prisma.contact.findMany({
        where: {
          ...(await ownedWhereAsync(userId)),
          ...(search
            ? {
                OR: [
                  { name: { contains: search, mode: "insensitive" as const } },
                  { phone: { contains: search, mode: "insensitive" as const } },
                  { email: { contains: search, mode: "insensitive" as const } },
                  { company: { contains: search, mode: "insensitive" as const } },
                  { tags: { contains: search, mode: "insensitive" as const } },
                ],
              }
            : {}),
        },
        select: { id: true, name: true, phone: true, email: true, company: true, tags: true },
        orderBy: { name: "asc" },
        take: clampLimit(args.limit),
      });
      return contacts.map((c) => ({
        id: c.id,
        name: c.name,
        phone: c.phone,
        email: c.email,
        company: c.company,
        tags: (() => { try { return c.tags ? JSON.parse(c.tags) : []; } catch { return []; } })(),
      }));
  },
};
