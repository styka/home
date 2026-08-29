import { prisma } from "@/platform/db/prisma";
import { asStr, type ExecOutcome } from "@/lib/ai/executorShared";
import type { AIAction } from "@/platform/ai/aiAction";
import { ownedWhereAsync } from "@/platform/auth/serverUtils";
import { zakresPrzestrzeni } from "../lib/sharingGuard";
import { createSpace } from "../actions/przestrzenie";
import { createPlant } from "../actions/rosliny";
import { recordCare } from "../actions/opieka";
import { addMeasurement } from "../actions/dziennik";
import { TRYBY_PRZESTRZENI, type JednostkaLicznosci, type RodzajPomiaru, type RodzajZabiegu, type TrybPrzestrzeni } from "../lib/typy";

/**
 * 113: egzekutor akcji zapisu modułu Rośliny.
 *
 * Wszystkie akcje przechodzą przez **te same Server Actions, co interfejs** — a więc przez te same
 * guardy dostępu. Asystent nie ma tu własnej drogi do bazy i mieć nie może: własna droga byłaby
 * obejściem kontroli dostępu, którego nikt by nie zauważył (test „bypass" pilnuje właśnie tego).
 */

/** Znajduje przestrzeń po nazwie. Jedna przestrzeń = nie pytamy; brak = mówimy wprost, czego brakuje.
 *  Zakres = `zakresPrzestrzeni` (moje + nadane mi) — ten sam co agenda/kalendarz/widoki; węższy
 *  `ownedWhereAsync` sprawiał, że opiekun udostępnionego ogrodu słyszał „Nie znaleziono rośliny". */
async function znajdzPrzestrzen(userId: string, nazwa: string | undefined): Promise<string> {
  const zakres = await zakresPrzestrzeni(userId);

  if (nazwa) {
    const trafiona = await prisma.plantSpace.findFirst({
      where: { ...zakres, name: { contains: nazwa, mode: "insensitive" } },
      select: { id: true },
    });
    if (trafiona) return trafiona.id;
  }

  const wszystkie = await prisma.plantSpace.findMany({ take: 2, where: zakres, select: { id: true, name: true } });
  if (wszystkie.length === 1) return wszystkie[0].id;
  if (wszystkie.length === 0) throw new Error("Nie masz jeszcze żadnej przestrzeni roślinnej — załóż ją najpierw");
  throw new Error(
    nazwa
      ? `Nie znaleziono przestrzeni roślinnej: „${nazwa}"`
      : "Masz kilka przestrzeni roślinnych — powiedz, w której ma powstać ta roślina",
  );
}

/** Znajduje roślinę po nazwie w zakresie użytkownika. */
async function znajdzRosline(userId: string, nazwa: string | undefined): Promise<{ id: string; name: string }> {
  if (!nazwa) throw new Error("Powiedz, o którą roślinę chodzi");
  const roslina = await prisma.plant.findFirst({
    where: { space: { is: await zakresPrzestrzeni(userId) }, name: { contains: nazwa, mode: "insensitive" } },
    select: { id: true, name: true },
    orderBy: { updatedAt: "desc" },
  });
  if (!roslina) throw new Error(`Nie znaleziono rośliny: „${nazwa}"`);
  return roslina;
}

const RODZAJE_ZABIEGU: RodzajZabiegu[] = [
  "WATERING", "FERTILIZING", "PRUNING", "REPOTTING", "SPRAYING", "MULCHING", "SOWING", "HARVEST", "CUSTOM",
];
const RODZAJE_POMIARU: RodzajPomiaru[] = [
  "HEIGHT_CM", "LEAF_COUNT", "TRUNK_CM", "SOIL_MOISTURE", "TEMP_C", "PH", "LIGHT", "OTHER",
];

export async function executeRoslinyAction(action: AIAction, userId: string): Promise<string | ExecOutcome> {
  const { type, params, searchQuery } = action;

  if (type === "create_plant_space") {
    const nazwa = asStr(params.nazwa) ?? asStr(params.name) ?? searchQuery;
    if (!nazwa) throw new Error("Podaj nazwę przestrzeni roślinnej");
    const podany = asStr(params.tryb) ?? asStr(params.kind);
    const tryb = TRYBY_PRZESTRZENI.includes(podany as TrybPrzestrzeni) ? (podany as TrybPrzestrzeni) : "home";

    const { id } = await createSpace({ name: nazwa, kind: tryb });
    return {
      message: `Założyłem przestrzeń roślinną „${nazwa}"`,
      navigateTo: `/rosliny/${id}`,
      navigateLabel: "Otwórz przestrzeń",
    };
  }

  if (type === "create_plant") {
    const nazwa = asStr(params.nazwa) ?? asStr(params.name);
    if (!nazwa) throw new Error("Podaj nazwę rośliny");
    const spaceId = await znajdzPrzestrzen(userId, asStr(params.przestrzen) ?? searchQuery);

    const nazwaMiejsca = asStr(params.miejsce);
    const miejsce = nazwaMiejsca
      ? await prisma.plantPlace.findFirst({
          where: { spaceId, name: { contains: nazwaMiejsca, mode: "insensitive" } },
          select: { id: true },
        })
      : null;

    // Gatunek podany słowem dopasowujemy do KOPII w przestrzeni użytkownika. Sięganie stąd wprost
    // do katalogu systemowego kopiowałoby wiersz przy okazji tworzenia rośliny — czyli robiło
    // rzecz, o którą użytkownik nie prosił.
    const nazwaGatunku = asStr(params.gatunek);
    const gatunek = nazwaGatunku
      ? await prisma.plantSpecies.findFirst({
          where: {
            ...(await ownedWhereAsync(userId)),
            OR: [
              { namePl: { contains: nazwaGatunku, mode: "insensitive" } },
              { nameLatin: { contains: nazwaGatunku, mode: "insensitive" } },
            ],
          },
          select: { id: true },
        })
      : null;

    const ilosc = typeof params.ilosc === "number" ? params.ilosc : undefined;
    const jednostka = asStr(params.jednostka);

    const { id } = await createPlant({
      spaceId,
      name: nazwa,
      placeId: miejsce?.id ?? null,
      speciesId: gatunek?.id ?? null,
      // Nazwa gatunku, której nie ma w słowniku użytkownika, ZOSTAJE jako tekst — inaczej
      // informacja podana przez użytkownika przepadłaby bez śladu.
      customSpecies: gatunek ? null : (nazwaGatunku ?? null),
      quantity: ilosc,
      quantityUnit: (["szt", "m2", "ha"] as const).includes(jednostka as JednostkaLicznosci)
        ? (jednostka as JednostkaLicznosci)
        : undefined,
    });

    return {
      message: `Dodałem roślinę „${nazwa}"`,
      navigateTo: `/rosliny/${spaceId}/roslina/${id}`,
      navigateLabel: "Otwórz roślinę",
    };
  }

  if (type === "log_plant_care") {
    const roslina = await znajdzRosline(userId, asStr(params.roslina) ?? searchQuery);
    const podany = asStr(params.rodzaj);
    const rodzaj = RODZAJE_ZABIEGU.includes(podany as RodzajZabiegu) ? (podany as RodzajZabiegu) : "WATERING";

    // Zabieg odnotowujemy przez ZADANIE opieki, bo to ono trzyma termin następnego. Gdy zadania
    // nie ma, zakładamy je w locie — inaczej „podlałem monsterę" nie miałoby gdzie wylądować,
    // a użytkownik dostałby odmowę zamiast zapisu.
    let zadanie = await prisma.plantCareTask.findFirst({
      where: { plantId: roslina.id, kind: rodzaj, active: true },
      select: { id: true },
    });
    if (!zadanie) {
      const dane = await prisma.plant.findUnique({
        where: { id: roslina.id },
        select: { spaceId: true, placeId: true },
      });
      if (!dane) throw new Error("Roślina nie istnieje");
      zadanie = await prisma.plantCareTask.create({
        data: {
          spaceId: dane.spaceId,
          plantId: roslina.id,
          placeId: dane.placeId,
          kind: rodzaj,
          title: rodzaj === "WATERING" ? "Podlewanie" : "Zabieg",
        },
        select: { id: true },
      });
    }

    await recordCare({ taskId: zadanie.id, outcome: "DONE", note: asStr(params.notatka) ?? null });
    return `Odnotowałem zabieg dla rośliny „${roslina.name}"`;
  }

  if (type === "add_plant_measurement") {
    const roslina = await znajdzRosline(userId, asStr(params.roslina) ?? searchQuery);
    const podany = asStr(params.rodzaj);
    const rodzaj = RODZAJE_POMIARU.includes(podany as RodzajPomiaru) ? (podany as RodzajPomiaru) : "HEIGHT_CM";
    const wartosc = typeof params.wartosc === "number" ? params.wartosc : Number(asStr(params.wartosc));
    if (!Number.isFinite(wartosc)) throw new Error("Podaj wartość pomiaru jako liczbę");

    await addMeasurement({
      plantId: roslina.id,
      kind: rodzaj,
      value: wartosc,
      unit: asStr(params.jednostka) ?? undefined,
    });
    return `Zapisałem pomiar dla rośliny „${roslina.name}"`;
  }

  throw new Error(`Nieznana akcja modułu Rośliny: ${type}`);
}
