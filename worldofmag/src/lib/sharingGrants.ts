import { randomBytes } from "node:crypto";
import { prisma } from "@/platform/db/prisma";
import { getAccessContext } from "@/platform/sharing/cache";
import { requireShareAccess } from "@/platform/sharing/access";
import { loadResourceCatalog } from "@/lib/sharingResources";
import { emitDomainEvent } from "@/platform/events/emit";
import { logAudit } from "@/platform/audit/audit";
import { notifyUser } from "@/lib/notify";
import { sprawdzLimit } from "@/platform/rateLimit";
import type { ResourceRole } from "@/platform/workspaces/types";
import { SUFIT_LISTY } from "@/platform/pagination";

/**
 * 090 (zadanie 14, część zapisowa) — NADAWANIE I ODBIERANIE DOSTĘPU.
 *
 * 067 zrobiło stronę odczytową („Udostępnione mi" / „Co udostępniłem"). Tu jest druga połowa: samo
 * nadawanie. Do dziś jedynymi nadaniami w `ResourceGrant` były te z **lustra** (059/061) — odbicia
 * `TaskProjectMember`, `TaskShare` i `PetShare`. Model jednolity istniał, a nikt nie mógł z niego
 * skorzystać.
 *
 * ### Cztery rzeczy, które ta warstwa robi przy KAŻDYM nadaniu
 *
 * 1. **Sprawdza rolę `manager`** (`requireShareAccess`) — reguła platformowa, nie modułowa.
 * 2. **Ogranicza tempo** (`sprawdzLimit("nadania")`) — polityka czekała gotowa od 081 właśnie na to
 *    wpięcie; rozdz. 11.2 nazywa to „ochroną przed masowym udostępnianiem".
 * 3. **Zapisuje ślad audytowy** w kategorii `sharing` — rozdz. 12.3 wymienia „nadania i odwołania
 *    dostępu do dziennika" jako obowiązek, nie funkcję.
 * 4. **Ogłasza zdarzenie** `sharing.grant.granted` / `sharing.grant.revoked` w TEJ SAMEJ transakcji,
 *    co zapis. To jest brakujący producent, na który czekał cache rozstrzygnięć dostępu (085):
 *    bez niego cache byłby dziurą z rozdz. 11.1.3, bo nie miałby czym się unieważniać.
 *
 * ### Czego tu nie ma
 *
 * **Wysyłki e-maili** — w repozytorium nie ma klienta pocztowego (ustalone przy 081). Nadanie dla
 * adresu bez konta zapisuje się jako `ResourceInvitation` i czeka; osoba odbiera je przy pierwszym
 * wejściu na `/invitations`, tak jak zaproszenia do zespołu.
 */

export type PodmiotNadania =
  | { rodzaj: "user"; email: string }
  | { rodzaj: "workspace"; workspaceId: string }
  | { rodzaj: "link" };

export type NadanieDTO = {
  id: string;
  subjectType: string;
  subjectId: string | null;
  /** E-mail osoby albo nazwa przestrzeni; dla linku `null`. */
  subjectLabel: string | null;
  role: string;
  /** Tylko dla nadań linkowych — do zbudowania adresu do skopiowania. */
  token: string | null;
  inherited: boolean;
  expiresAt: string | null;
  createdAt: string;
};

export type ZaproszenieDTO = {
  id: string;
  email: string;
  role: string;
  expiresAt: string;
};

const DNI_WAZNOSCI_ZAPROSZENIA = 30;

/** Nadania i oczekujące zaproszenia dla jednego zasobu — treść okna udostępniania. */
export async function nadaniaZasobu(
  userId: string,
  resourceType: string,
  resourceId: string,
): Promise<{ nadania: NadanieDTO[]; zaproszenia: ZaproszenieDTO[]; etykietaTypu: string }> {
  const [katalog, ctx] = await Promise.all([loadResourceCatalog(), getAccessContext(userId)]);
  // Do PODEJRZENIA listy nadań wymagamy tego samego, co do jej zmiany: kto może zobaczyć, komu
  // zasób jest udostępniony, ten zna skład zespołu właściciela.
  await requireShareAccess(userId, { type: resourceType, id: resourceId }, katalog, ctx);

  const [wiersze, zaproszenia] = await Promise.all([
    prisma.resourceGrant.findMany({
      where: { resourceType, resourceId },
      orderBy: { createdAt: "asc" },
      take: 200,
    }),
    prisma.resourceInvitation.findMany({
      where: { resourceType, resourceId, acceptedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: "asc" },
      take: 50,
    }),
  ]);

  const userIds = wiersze.filter((w) => w.subjectType === "user" && w.subjectId).map((w) => w.subjectId!);
  const wsIds = wiersze.filter((w) => w.subjectType === "workspace" && w.subjectId).map((w) => w.subjectId!);
  const [users, spaces] = await Promise.all([
    userIds.length ? prisma.user.findMany({ take: SUFIT_LISTY, where: { id: { in: userIds } }, select: { id: true, email: true, name: true } }) : [],
    wsIds.length ? prisma.workspace.findMany({ take: SUFIT_LISTY, where: { id: { in: wsIds } }, select: { id: true, name: true } }) : [],
  ]);
  const etykiety: Record<string, string> = {};
  for (const u of users) etykiety[u.id] = u.email ?? u.name ?? "(bez nazwy)";
  for (const w of spaces) etykiety[w.id] = w.name;

  return {
    etykietaTypu: katalog[resourceType]?.label ?? resourceType,
    nadania: wiersze.map((w) => ({
      id: w.id,
      subjectType: w.subjectType,
      subjectId: w.subjectId,
      subjectLabel: w.subjectId ? (etykiety[w.subjectId] ?? null) : null,
      role: w.role,
      token: w.token,
      inherited: w.inherited,
      expiresAt: w.expiresAt?.toISOString() ?? null,
      createdAt: w.createdAt.toISOString(),
    })),
    zaproszenia: zaproszenia.map((z) => ({
      id: z.id,
      email: z.email,
      role: z.role,
      expiresAt: z.expiresAt.toISOString(),
    })),
  };
}

/** Przestrzeń, w której żyje zasób — potrzebna do zapisu nadania i do kanału zdarzenia. */
async function przestrzenZasobu(resourceType: string, resourceId: string): Promise<string | null> {
  const katalog = await loadResourceCatalog();
  const dekl = katalog[resourceType];
  if (!dekl) return null;
  let ref = { type: resourceType, id: resourceId };
  // Zasób bez własnej przestrzeni (zadanie w projekcie) dziedziczy ją po rodzicu — idziemy w górę,
  // dopóki ktoś jej nie poda. Ograniczenie głębokości, bo cykl w deklaracjach zawiesiłby zapis.
  for (let i = 0; i < 5; i++) {
    const fakty = await katalog[ref.type]?.resolve(ref.id);
    if (!fakty) return null;
    if (fakty.workspaceId) return fakty.workspaceId;
    if (!fakty.parent) return null;
    ref = fakty.parent;
  }
  return null;
}

export type WynikNadania =
  | { rodzaj: "nadano"; grantId: string }
  | { rodzaj: "zaproszono"; email: string }
  | { rodzaj: "link"; token: string };

/**
 * Nadaje dostęp do zasobu. Zwraca, CO się stało — bo trzy przypadki wyglądają dla użytkownika
 * inaczej: osoba z kontem dostaje dostęp od razu, osoba bez konta dostaje zaproszenie, a link
 * trzeba skopiować.
 */
export async function nadajDostep(
  userId: string,
  resourceType: string,
  resourceId: string,
  podmiot: PodmiotNadania,
  role: ResourceRole,
  expiresAt?: Date | null,
): Promise<WynikNadania> {
  const [katalog, ctx] = await Promise.all([loadResourceCatalog(), getAccessContext(userId)]);
  const ref = { type: resourceType, id: resourceId };
  await requireShareAccess(userId, ref, katalog, ctx);

  // Limit PO kontroli uprawnień — inaczej liczyłby próby kogoś, kto i tak nie ma prawa udostępniać.
  const limit = await sprawdzLimit("nadania", userId);
  if (!limit.ok) throw new Error(limit.message);

  const workspaceId = await przestrzenZasobu(resourceType, resourceId);
  if (!workspaceId) throw new Error("Nie udało się ustalić przestrzeni zasobu");
  const etykietaTypu = katalog[resourceType]?.label ?? resourceType;

  if (podmiot.rodzaj === "link") {
    const token = randomBytes(24).toString("base64url");
    const grant = await prisma.$transaction(async (tx) => {
      const g = await tx.resourceGrant.create({
        data: {
          workspaceId, resourceType, resourceId,
          subjectType: "link", subjectId: null, token,
          role, createdById: userId, expiresAt: expiresAt ?? null,
        },
      });
      await emitDomainEvent(tx, {
        workspaceId, module: "sharing", type: "sharing.grant.granted", actorId: userId,
        payload: { resourceType, resourceId, subjectType: "link", role },
      });
      return g;
    });
    await logAudit("sharing", "grant.link.created", grant.id, `Utworzono link z rolą ${role} do: ${etykietaTypu}`);
    return { rodzaj: "link", token };
  }

  if (podmiot.rodzaj === "workspace") {
    const grant = await zapiszNadanie(workspaceId, resourceType, resourceId, "workspace", podmiot.workspaceId, role, userId, expiresAt);
    await logAudit("sharing", "grant.created", grant.id, `Nadano rolę ${role} przestrzeni ${podmiot.workspaceId} do: ${etykietaTypu}`);
    // Powiadamiamy CZŁONKÓW przestrzeni — nadanie dla przestrzeni bez powiadomienia nikogo nie
    // dociera do nikogo, a to jest zmiana dostępu, o której ludzie powinni wiedzieć.
    const czlonkowie = await prisma.workspaceMember.findMany({
      where: { workspaceId: podmiot.workspaceId },
      select: { userId: true },
      take: 100,
    });
    await Promise.all(
      czlonkowie
        .filter((c) => c.userId !== userId)
        .map((c) =>
          notifyUser({
            userId: c.userId, module: "sharing",
            title: "Udostępniono zasób Twojej przestrzeni",
            body: `${etykietaTypu} — rola: ${role}.`,
            href: "/udostepnione",
            dedupeKey: `grant-${grant.id}`,
          }),
        ),
    );
    return { rodzaj: "nadano", grantId: grant.id };
  }

  const email = podmiot.email.trim().toLowerCase();
  const osoba = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (!osoba) {
    // Osoba bez konta: zapisujemy zaproszenie i mówimy o tym wprost. Nadanie dla nieistniejącego
    // konta nie ma komu dać dostępu, a udawanie, że „nadano", byłoby kłamstwem wobec właściciela.
    const token = randomBytes(24).toString("base64url");
    await prisma.resourceInvitation.create({
      data: {
        resourceType, resourceId, email, role, token, createdById: userId,
        expiresAt: new Date(Date.now() + DNI_WAZNOSCI_ZAPROSZENIA * 86_400_000),
      },
    });
    await logAudit("sharing", "invitation.created", email, `Zaproszono ${email} z rolą ${role} do: ${etykietaTypu}`);
    return { rodzaj: "zaproszono", email };
  }

  const grant = await zapiszNadanie(workspaceId, resourceType, resourceId, "user", osoba.id, role, userId, expiresAt);
  await logAudit("sharing", "grant.created", grant.id, `Nadano ${email} rolę ${role} do: ${etykietaTypu}`);
  await notifyUser({
    userId: osoba.id, module: "sharing",
    title: "Udostępniono Ci zasób",
    body: `${etykietaTypu} — rola: ${role}.`,
    href: "/udostepnione",
    dedupeKey: `grant-${grant.id}`,
  });
  return { rodzaj: "nadano", grantId: grant.id };
}

/** Zapis nadania osobowego/przestrzennego. `upsert`, bo powtórne nadanie ma ZMIENIĆ rolę, nie paść. */
async function zapiszNadanie(
  workspaceId: string,
  resourceType: string,
  resourceId: string,
  subjectType: "user" | "workspace",
  subjectId: string,
  role: ResourceRole,
  createdById: string,
  expiresAt?: Date | null,
) {
  return prisma.$transaction(async (tx) => {
    const g = await tx.resourceGrant.upsert({
      where: { resourceType_resourceId_subjectType_subjectId: { resourceType, resourceId, subjectType, subjectId } },
      update: { role, expiresAt: expiresAt ?? null },
      create: { workspaceId, resourceType, resourceId, subjectType, subjectId, role, createdById, expiresAt: expiresAt ?? null },
    });
    await emitDomainEvent(tx, {
      workspaceId, module: "sharing", type: "sharing.grant.granted", actorId: createdById,
      payload: { resourceType, resourceId, subjectType, subjectId, role },
    });
    return g;
  });
}

/**
 * Odbiera dostęp. Nadanie **odziedziczone z lustra** (`inherited`) odrzucamy: jego źródłem jest
 * członkostwo w projekcie albo `PetShare`, więc skasowanie samego odbicia zniknęłoby przy
 * najbliższej synchronizacji, a użytkownik zobaczyłby dostęp, który „wrócił sam".
 */
export async function odbierzDostep(userId: string, grantId: string): Promise<void> {
  const grant = await prisma.resourceGrant.findUnique({ where: { id: grantId } });
  if (!grant) throw new Error("Nadanie nie istnieje");

  const [katalog, ctx] = await Promise.all([loadResourceCatalog(), getAccessContext(userId)]);
  await requireShareAccess(userId, { type: grant.resourceType, id: grant.resourceId }, katalog, ctx);
  if (grant.inherited) {
    throw new Error("To nadanie wynika z członkostwa w zasobie — odbierz je tam, gdzie powstało");
  }

  await prisma.$transaction(async (tx) => {
    await tx.resourceGrant.delete({ where: { id: grantId } });
    await emitDomainEvent(tx, {
      workspaceId: grant.workspaceId, module: "sharing", type: "sharing.grant.revoked", actorId: userId,
      payload: { resourceType: grant.resourceType, resourceId: grant.resourceId, subjectType: grant.subjectType, subjectId: grant.subjectId },
    });
  });

  const etykieta = katalog[grant.resourceType]?.label ?? grant.resourceType;
  await logAudit("sharing", "grant.revoked", grantId, `Odebrano dostęp (${grant.subjectType}) do: ${etykieta}`);
  if (grant.subjectType === "user" && grant.subjectId) {
    await notifyUser({
      userId: grant.subjectId, module: "sharing",
      title: "Odebrano dostęp",
      body: `${etykieta} nie jest już Tobie udostępniony.`,
      href: "/udostepnione",
      dedupeKey: `revoke-${grantId}`,
    });
  }
}

/**
 * Odbiera zaproszenia czekające na adres tej osoby — wołane przy wejściu na `/invitations`.
 *
 * Kluczem jest e-mail, bo w chwili wystawienia zaproszenia konta jeszcze nie było. Zaproszenie
 * z minionym terminem **nie jest** realizowane i nie jest kasowane: właściciel ma je zobaczyć
 * jako wygasłe, zamiast zastanawiać się, czy w ogóle je wysłał.
 */
export async function odbierzZaproszeniaZasobow(userId: string, email: string | null | undefined): Promise<number> {
  if (!email) return 0;
  const czekajace = await prisma.resourceInvitation.findMany({
    where: { email: email.toLowerCase(), acceptedAt: null, expiresAt: { gt: new Date() } },
    take: 50,
  });
  let zrealizowane = 0;
  for (const z of czekajace) {
    const workspaceId = await przestrzenZasobu(z.resourceType, z.resourceId).catch(() => null);
    if (!workspaceId) continue; // zasób zniknął — zaproszenie nie ma czego dać
    await zapiszNadanie(workspaceId, z.resourceType, z.resourceId, "user", userId, z.role as ResourceRole, z.createdById);
    await prisma.resourceInvitation.update({ where: { id: z.id }, data: { acceptedAt: new Date() } });
    await logAudit("sharing", "invitation.accepted", z.id, `Zrealizowano zaproszenie do: ${z.resourceType}`);
    zrealizowane++;
  }
  return zrealizowane;
}
