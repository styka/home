import { getCareAgenda, getCareHistory, getEnclosures, getPetWelfare } from "../contract";
import { technicalToLabel } from "@/platform/ai/humanize";
import { getUserTeamIds, ownedOr } from "@/platform/auth/serverUtils";
import { prisma } from "@/platform/db/prisma";
import { HARD_MAX, clampLimit, asStr } from "@/lib/ai/readToolShared";
import type { AiReadToolHandler } from "@/platform/ai/contribution";

/**
 * 049: narzędzia ODCZYTU tego modułu — wkład do asystenta, składany z deklaracji.
 *
 * Wcześniej wszystkie 56 narzędzi mieszkało w jednym `switch (name)` w warstwie AI, która
 * importowała kontrakty szesnastu modułów. Treść jest ta sama; zmienia się właściciel.
 */
export const readToolsPrompt = [
  "- list_pets: args { search? } → [{ id, name, species, status }]",
  "- list_care_agenda: args {} → [{ petName, kind, title, dueAt, overdue }]. Zaległe i nadchodzące czynności opieki nad zwierzętami (leczenie, karmienie, zadania pielęgnacyjne, wizyty).",
  "- list_enclosures: args {} → [{ id, name, type, location }]. Zbiorniki/terraria/klatki (husbandry).",
  "- get_pet_welfare: args {} → { agenda:[…], suggestions:[…] }. Dobrostan zwierząt: zaległa opieka + sugestie.",
  "- list_care_history: args { petName, limit? } → [{ date, kind, note }]. Historia opieki nad wskazanym zwierzęciem (searchowane po imieniu).",
].join("\n");

export const readTools: Record<string, AiReadToolHandler> = {
  list_pets: async (args, userId) => {
      const search = asStr(args.search);
      const teamIds = await getUserTeamIds(userId);
      const pets = await prisma.pet.findMany({
        where: {
          OR: [
            ...ownedOr(userId, teamIds),
            { shares: { some: { userId } } },
          ],
          ...(search ? { name: { contains: search, mode: "insensitive" } } : {}),
        },
        select: { id: true, name: true, species: true, status: true },
        orderBy: { createdAt: "desc" },
        take: HARD_MAX,
      });
      return pets.map((p) => ({ id: p.id, name: p.name, species: p.species, status: technicalToLabel(p.status) }));
  },
  list_care_agenda: async (args, userId) => {
      return getCareAgenda();
  },
  list_enclosures: async (args, userId) => {
      const encs = await getEnclosures();
      return encs.map((e) => ({ id: e.id, name: e.name, type: e.type, location: e.location }));
  },
  get_pet_welfare: async (args, userId) => {
      return getPetWelfare();
  },
  list_care_history: async (args, userId) => {
      const petName = asStr(args.petName) ?? asStr(args.search);
      if (!petName) return { note: "Podaj imię zwierzęcia (petName)." };
      const teamIds = await getUserTeamIds(userId);
      const pet = await prisma.pet.findFirst({
        where: {
          OR: [
            ...ownedOr(userId, teamIds),
            { shares: { some: { userId } } },
          ],
          name: { contains: petName, mode: "insensitive" },
        },
        select: { id: true, name: true },
      });
      if (!pet) return { note: `Nie znaleziono zwierzęcia: „${petName}".` };
      const history = await getCareHistory(pet.id, clampLimit(args.limit, 50));
      return { pet: pet.name, history };
  },
};
