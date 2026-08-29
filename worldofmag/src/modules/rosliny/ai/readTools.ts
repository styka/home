import { prisma } from "@/platform/db/prisma";
import type { AiReadToolHandler } from "@/platform/ai/contribution";
import { zakresPrzestrzeni } from "../lib/sharingGuard";
import { kubelekAgendy } from "../domain/agenda";
import { userDayBounds } from "@/lib/userTime";

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
    // Zakres DOKŁADNIE ten sam co agenda/kalendarz/pulpit (`zakresPrzestrzeni` = moje + nadane
    // mi przestrzenie). Asystent był czwartym czytelnikiem tych samych zadań i jako jedyny nie
    // widział przestrzeni udostępnionych — „co dziś podlać?" odpowiadało „nic" opiekunowi ogrodu.
    const przestrzenie = await prisma.plantSpace.findMany({
      take: LIMIT,
      where: await zakresPrzestrzeni(userId),
      // Licznik tylko ACTIVE — ta sama definicja co kafelek przestrzeni („ile mam",
      // nie „ile kiedykolwiek miałem"); asystent zawyżał liczbę o zakończone rośliny.
      select: { id: true, name: true, kind: true, _count: { select: { plants: { where: { status: "ACTIVE" } } } } },
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
        space: {
          is: {
            ...(await zakresPrzestrzeni(userId)),
            ...(przestrzen ? { name: { contains: przestrzen, mode: "insensitive" } } : {}),
          },
        },
        ...(tylkoAktywne ? { status: "ACTIVE" } : {}),
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
        space: { is: await zakresPrzestrzeni(userId) },
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

    const teraz = new Date();
    const koniecDnia = userDayBounds().end;
    return zadania.map((z) => ({
      zabieg: z.title,
      rodzaj: z.kind,
      roslina: z.plant?.name ?? null,
      przestrzen: z.space.name,
      termin: z.nextDueAt?.toISOString().slice(0, 10) ?? null,
      // Ta sama definicja co widok agendy (`kubelekAgendy`): „zaległe" zaczyna się dobę po
      // terminie. Surowe `< teraz` kazało asystentowi alarmować o zadaniu, które UI pokazuje
      // jako „na dziś" — ta sama dana, dwie sprzeczne odpowiedzi w tej samej minucie.
      zalegly: kubelekAgendy(z.nextDueAt, teraz, koniecDnia) === "OVERDUE",
      // Uzasadnienie idzie do modelu, żeby odpowiedź brzmiała „podlej, bo od 9 dni bez deszczu",
      // a nie „podlej". Użytkownik, który rozumie powód, przestaje pytać o to samo.
      dlaczego: z.reason,
      adres: z.plantId ? `/rosliny/${z.spaceId}/roslina/${z.plantId}` : `/rosliny/${z.spaceId}`,
    }));
  },
};
