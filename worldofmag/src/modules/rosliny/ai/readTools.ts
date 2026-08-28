import { prisma } from "@/platform/db/prisma";
import { ownedWhereAsync } from "@/platform/auth/serverUtils";
import type { AiReadToolHandler } from "@/platform/ai/contribution";

/**
 * 113: narzędzia ODCZYTU tego modułu.
 *
 * Trzy, bo na trzy pytania użytkownik realnie przychodzi do asystenta: „co dziś podlać?",
 * „co mam w ogrodzie?" i „jakie mam przestrzenie?". Ewidencja zabiegów, katalog gatunków
 * i dziennik są mechaniką własnych widoków — w kontrakcie asystenta byłyby balastem promptu,
 * a ewidencja dodatkowo dokumentem, którego nikt nie czyta rozmową.
 *
 * **`offset` przy liście roślin nie jest ozdobą** (lekcja 112): gdy wynik zostanie ucięty,
 * komunikat obcięcia ma nazwać liczbę do pominięcia, a nie kazać modelowi „zawęzić zapytanie" —
 * to drugie jest niewykonalne, bo limit siedzi w kontekście, nie w zapytaniu.
 */
export const readToolsPrompt = `- list_plant_spaces {} — przestrzenie roślinne użytkownika wraz z ich trybem i liczbą roślin
- list_plants { przestrzen?, tylkoAktywne?, offset? } — rośliny użytkownika (nazwa, gatunek, miejsce, liczność, stan)
- plant_care_agenda { dni? } — co wymaga opieki: zaległe, dzisiejsze i najbliższe zabiegi wraz z uzasadnieniem terminu`;

const LIMIT = 40;

export const readTools: Record<string, AiReadToolHandler> = {
  list_plant_spaces: async (_args, userId) => {
    const przestrzenie = await prisma.plantSpace.findMany({
      take: LIMIT,
      where: await ownedWhereAsync(userId),
      select: { id: true, name: true, kind: true, _count: { select: { plants: true } } },
      orderBy: { createdAt: "asc" },
    });
    return przestrzenie.map((p) => ({
      nazwa: p.name,
      tryb: p.kind,
      liczbaRoslin: p._count.plants,
      adres: `/rosliny/${p.id}`,
    }));
  },

  list_plants: async (args, userId) => {
    const przestrzen = typeof args.przestrzen === "string" ? args.przestrzen.trim() : "";
    const offset = typeof args.offset === "number" && args.offset > 0 ? Math.floor(args.offset) : 0;
    const tylkoAktywne = args.tylkoAktywne !== false;

    const rosliny = await prisma.plant.findMany({
      take: LIMIT,
      skip: offset,
      where: {
        ...(await ownedWhereAsync(userId)),
        ...(tylkoAktywne ? { status: "ACTIVE" } : {}),
        ...(przestrzen ? { space: { is: { name: { contains: przestrzen, mode: "insensitive" } } } } : {}),
      },
      select: {
        name: true,
        quantity: true,
        quantityUnit: true,
        status: true,
        statusReason: true,
        stage: true,
        spaceId: true,
        id: true,
        customSpecies: true,
        space: { select: { name: true } },
        place: { select: { name: true } },
        species: { select: { namePl: true } },
      },
      orderBy: [{ name: "asc" }],
    });

    return rosliny.map((r) => ({
      nazwa: r.name,
      gatunek: r.species?.namePl ?? r.customSpecies ?? null,
      przestrzen: r.space.name,
      miejsce: r.place?.name ?? null,
      ilosc: `${r.quantity} ${r.quantityUnit}`,
      stan: r.status,
      // Powód zakończenia jest tu celowo: pytanie „co mi padło i dlaczego" jest jednym
      // z niewielu, na które użytkownik przyjdzie do asystenta zamiast otwierać widok.
      powod: r.statusReason,
      faza: r.stage,
      adres: `/rosliny/${r.spaceId}/roslina/${r.id}`,
    }));
  },

  plant_care_agenda: async (args, userId) => {
    const dni = typeof args.dni === "number" && args.dni > 0 ? Math.min(Math.floor(args.dni), 60) : 7;
    const horyzont = new Date(Date.now() + dni * 86_400_000);

    const zadania = await prisma.plantCareTask.findMany({
      take: LIMIT,
      where: {
        active: true,
        nextDueAt: { lte: horyzont },
        space: { is: await ownedWhereAsync(userId) },
      },
      select: {
        title: true,
        kind: true,
        nextDueAt: true,
        reason: true,
        spaceId: true,
        plantId: true,
        space: { select: { name: true } },
        plant: { select: { name: true } },
      },
      orderBy: { nextDueAt: "asc" },
    });

    const teraz = Date.now();
    return zadania.map((z) => ({
      zabieg: z.title,
      rodzaj: z.kind,
      roslina: z.plant?.name ?? null,
      przestrzen: z.space.name,
      termin: z.nextDueAt?.toISOString().slice(0, 10) ?? null,
      zalegly: z.nextDueAt ? z.nextDueAt.getTime() < teraz : false,
      // Uzasadnienie idzie do modelu, żeby odpowiedź brzmiała „podlej, bo od 9 dni bez deszczu",
      // a nie „podlej". Użytkownik, który rozumie powód, przestaje pytać o to samo.
      dlaczego: z.reason,
      adres: z.plantId ? `/rosliny/${z.spaceId}/roslina/${z.plantId}` : `/rosliny/${z.spaceId}`,
    }));
  },
};
