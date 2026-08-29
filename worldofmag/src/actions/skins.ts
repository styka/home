"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/platform/db/prisma";
import { auth } from "@/platform/auth/session";
import { requireAuth, getUserTeamIds } from "@/platform/auth/serverUtils";
import { hasPermission, PERMISSIONS } from "@/platform/auth/permissions";
import { SUFIT_LISTY } from "@/platform/pagination";
import {
  parseTokens,
  validateTokens,
  type SkinTokens,
} from "@/lib/skins";
import {
  parseDefinicja,
  walidujDefinicje,
  type DefinicjaZaawansowana,
  type SkinKind,
} from "@/lib/skins/zaawansowane";
import { kompilujDefinicje } from "@/lib/skins/kompilacja";

export type SkinView = {
  id: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  colorScheme: "light" | "dark";
  tokens: SkinTokens;
  /** 116: rodzaj skórki. Zaawansowana niesie też zwalidowaną definicję. */
  kind: SkinKind;
  definition: DefinicjaZaawansowana | null;
  ownerId: string | null;
  ownerTeamId: string | null;
  isPublic: boolean;
  sortOrder: number;
  isOwn: boolean; // czy bieżący użytkownik może edytować
};

export type ActiveSkin = {
  skinId: string | null;
  tokens: SkinTokens;
  colorScheme: "light" | "dark";
  /** 116: atrybuty `data-*` na <html> (bramki reguł skórki zaawansowanej). Puste dla prostych. */
  atrybuty: Record<string, string>;
};

function scheme(v: string): "light" | "dark" {
  return v === "light" ? "light" : "dark";
}

/** Aktywna skórka użytkownika — czytane z layoutu (bez ponownej autoryzacji).
 *  Brak preferencji lub wskazana skórka niedostępna ⇒ domyślna ciemna.
 *
 *  116: skórka zaawansowana KOMPILUJE się tutaj do tej samej mapy zmiennych, którą
 *  aplikuje layout. Każdy błąd kompilacji degraduje do warstwy tokenów (zapisanej
 *  w `Skin.tokens` przy tworzeniu), a błąd i tam — do domyślnej ciemnej. Aplikacja
 *  nie ma prawa się wywrócić od zepsutej definicji (AC-9). */
export async function readActiveSkin(userId: string): Promise<ActiveSkin> {
  const fallback: ActiveSkin = { skinId: null, tokens: {}, colorScheme: "dark", atrybuty: {} };
  const pref = await prisma.userSkinPref.findUnique({ where: { userId } }).catch(() => null);
  if (!pref?.skinId) return fallback;
  const skin = await prisma.skin.findUnique({ where: { id: pref.skinId } }).catch(() => null);
  if (!skin) return fallback;

  const prosty: ActiveSkin = {
    skinId: skin.id,
    tokens: parseTokens(skin.tokens),
    colorScheme: scheme(skin.colorScheme),
    atrybuty: {},
  };
  if (skin.kind !== "advanced" || !skin.definition) return prosty;

  try {
    const definicja = parseDefinicja(skin.definition);
    const ids = (definicja.assets ?? []).map((a) => a.id).filter(Boolean);
    const assety = ids.length
      ? await prisma.skinAsset.findMany({
          where: { id: { in: ids } },
          take: ids.length,
          select: { id: true, mimeType: true },
        })
      : [];
    const w = kompilujDefinicje(definicja, assety);
    return { skinId: skin.id, tokens: w.tokens, colorScheme: scheme(skin.colorScheme), atrybuty: w.atrybuty };
  } catch {
    return prosty;
  }
}

/** Id aktywnej skórki — dla UI (picker). */
export async function getActiveSkinId(): Promise<string | null> {
  const user = await requireAuth();
  const pref = await prisma.userSkinPref.findUnique({ where: { userId: user.id } }).catch(() => null);
  return pref?.skinId ?? null;
}

function toView(
  s: {
    id: string; name: string; description: string | null; isSystem: boolean;
    colorScheme: string; tokens: string; kind: string; definition: string | null;
    ownerId: string | null;
    ownerTeamId: string | null; isPublic: boolean; sortOrder: number;
  },
  canEdit: boolean,
): SkinView {
  const kind: SkinKind = s.kind === "advanced" ? "advanced" : "simple";
  return {
    id: s.id,
    name: s.name,
    description: s.description,
    isSystem: s.isSystem,
    colorScheme: scheme(s.colorScheme),
    tokens: parseTokens(s.tokens),
    kind,
    definition: kind === "advanced" && s.definition ? parseDefinicja(s.definition) : null,
    ownerId: s.ownerId,
    ownerTeamId: s.ownerTeamId,
    isPublic: s.isPublic,
    sortOrder: s.sortOrder,
    isOwn: canEdit,
  };
}

/** Skórki dostępne dla użytkownika: systemowe + własne + zespołowe + publiczne. */
export async function listAvailableSkins(): Promise<SkinView[]> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return [];
  const isAdmin = hasPermission(session, PERMISSIONS.ADMIN);
  const teamIds = await getUserTeamIds(userId);

  const skins = await prisma.skin.findMany({
    take: SUFIT_LISTY,
    where: {
      OR: [
        { isSystem: true },
        { ownerId: userId },
        { ownerTeamId: { in: teamIds } },
        { isPublic: true },
      ],
    },
    orderBy: [{ isSystem: "desc" }, { sortOrder: "asc" }, { createdAt: "asc" }],
  });

  return skins.map((s) =>
    toView(s, (s.isSystem && isAdmin) || s.ownerId === userId || (s.ownerTeamId !== null && teamIds.includes(s.ownerTeamId))),
  );
}

/** Ustaw aktywną skórkę (null ⇒ domyślna ciemna). */
export async function setActiveSkin(skinId: string | null): Promise<void> {
  const user = await requireAuth();
  if (skinId) {
    // upewnij się, że skórka istnieje i jest dla użytkownika dostępna
    const available = await listAvailableSkins();
    if (!available.some((s) => s.id === skinId)) throw new Error("Skin not available");
  }
  await prisma.userSkinPref.upsert({
    where: { userId: user.id },
    create: { userId: user.id, skinId },
    update: { skinId },
  });
  revalidatePath("/", "layout");
}

export type SkinInput = {
  name: string;
  description?: string | null;
  colorScheme: "light" | "dark";
  tokens: SkinTokens;
  /** 116: surowa definicja zaawansowana (np. z generatora LLM). Jej obecność czyni
   *  skórkę zaawansowaną; przechodzi pełną walidację przed zapisem, a warstwa tokenów
   *  z definicji jest lustrzana w `tokens` (fallback + miniatura w pickerze). */
  definition?: unknown;
  isSystem?: boolean;
  isPublic?: boolean;
  ownerTeamId?: string | null;
  sortOrder?: number;
};

/** Wspólne wyprowadzenie pól zapisu z wejścia (116): definicja → kind/definition/tokens. */
function poleSkorki(input: Pick<SkinInput, "tokens" | "definition">): {
  kind: SkinKind;
  definition: string | null;
  tokens: string;
} {
  if (input.definition === undefined || input.definition === null) {
    return { kind: "simple", definition: null, tokens: JSON.stringify(validateTokens(input.tokens)) };
  }
  const { definicja } = walidujDefinicje(input.definition);
  return {
    kind: "advanced",
    definition: JSON.stringify(definicja),
    tokens: JSON.stringify(definicja.tokens ?? {}),
  };
}

/** Tworzy nową skórkę. isSystem wymaga admina; w przeciwnym razie user-owned. */
export async function createSkin(input: SkinInput): Promise<string> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) throw new Error("Unauthorized");

  const name = input.name.trim().slice(0, 60) || "Skórka";
  const pola = poleSkorki(input);
  const colorScheme = input.colorScheme === "light" ? "light" : "dark";

  if (input.isSystem) {
    if (!hasPermission(session, PERMISSIONS.ADMIN)) throw new Error("Forbidden");
    const skin = await prisma.skin.create({
      data: {
        name,
        description: input.description?.trim() || null,
        isSystem: true,
        isPublic: true,
        colorScheme,
        ...pola,
        sortOrder: input.sortOrder ?? 100,
      },
    });
    revalidatePath("/", "layout");
    return skin.id;
  }

  // skórka użytkownika; opcjonalnie przypisana do zespołu (musi być członkiem)
  let ownerTeamId: string | null = null;
  if (input.ownerTeamId) {
    const teamIds = await getUserTeamIds(userId);
    if (!teamIds.includes(input.ownerTeamId)) throw new Error("Not a team member");
    ownerTeamId = input.ownerTeamId;
  }
  const skin = await prisma.skin.create({
    data: {
      name,
      description: input.description?.trim() || null,
      isSystem: false,
      isPublic: !!input.isPublic,
      colorScheme,
      ...pola,
      ownerId: ownerTeamId ? null : userId,
      ownerTeamId,
    },
  });
  revalidatePath("/", "layout");
  return skin.id;
}

async function assertCanEditSkin(skinId: string): Promise<{ isSystem: boolean }> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) throw new Error("Unauthorized");
  const skin = await prisma.skin.findUnique({ where: { id: skinId } });
  if (!skin) throw new Error("Not found");
  if (skin.isSystem) {
    if (!hasPermission(session, PERMISSIONS.ADMIN)) throw new Error("Forbidden");
    return { isSystem: true };
  }
  const teamIds = await getUserTeamIds(userId);
  const owns = skin.ownerId === userId || (skin.ownerTeamId !== null && teamIds.includes(skin.ownerTeamId));
  if (!owns) throw new Error("Forbidden");
  return { isSystem: false };
}

export async function updateSkin(id: string, patch: Partial<SkinInput>): Promise<void> {
  await assertCanEditSkin(id);
  const data: Record<string, unknown> = {};
  if (patch.name !== undefined) data.name = patch.name.trim().slice(0, 60) || "Skórka";
  if (patch.description !== undefined) data.description = patch.description?.trim() || null;
  if (patch.colorScheme !== undefined) data.colorScheme = patch.colorScheme === "light" ? "light" : "dark";
  if (patch.definition !== undefined) {
    // Zmiana definicji przelicza też lustrzaną warstwę tokenów (fallback + miniatura).
    const pola = poleSkorki({ tokens: patch.tokens ?? {}, definition: patch.definition });
    data.kind = pola.kind;
    data.definition = pola.definition;
    data.tokens = pola.tokens;
  } else if (patch.tokens !== undefined) {
    data.tokens = JSON.stringify(validateTokens(patch.tokens));
  }
  if (patch.isPublic !== undefined) data.isPublic = !!patch.isPublic;
  if (patch.sortOrder !== undefined) data.sortOrder = patch.sortOrder;
  await prisma.skin.update({ where: { id }, data });
  revalidatePath("/", "layout");
}

export async function deleteSkin(id: string): Promise<void> {
  await assertCanEditSkin(id);
  // wyczyść preferencje wskazujące na usuwaną skórkę (powrót do domyślnej)
  await prisma.userSkinPref.updateMany({ where: { skinId: id }, data: { skinId: null } });
  await prisma.skin.delete({ where: { id } });
  revalidatePath("/", "layout");
}

/** Format pliku skórki (045, 116). Wersjonowany, żeby przyszła zmiana kształtu dała się
 *  rozpoznać, zamiast po cichu zaimportować śmieci. Wersja 1 = skórka prosta (bez zmian);
 *  wersja 2 = zaawansowana: + definicja + hashe assetów. Danych binarnych plik NIE niesie —
 *  przy imporcie referencje wiążą się po hashu z assetami dostępnymi w tej instalacji,
 *  a nieodnalezione są jawnie oznaczane jako brakujące (AC-14). */
export type SkinFile = {
  omniaSkin: 1 | 2;
  name: string;
  description: string | null;
  colorScheme: "light" | "dark";
  tokens: SkinTokens;
  definition?: DefinicjaZaawansowana;
  /** id assetu z definicji → SHA-256 treści (do ponownego wiązania przy imporcie). */
  assetHashes?: Record<string, string>;
};

/** Eksport skórki do JSON-a (do pobrania jako plik).
 *  Przepuszczamy tylko skórki, które użytkownik i tak widzi w pickerze. */
export async function exportSkin(id: string): Promise<string> {
  const available = await listAvailableSkins();
  const skin = available.find((s) => s.id === id);
  if (!skin) throw new Error("Skin not available");

  if (skin.kind === "advanced" && skin.definition) {
    const ids = (skin.definition.assets ?? []).map((a) => a.id).filter(Boolean);
    const assety = ids.length
      ? await prisma.skinAsset.findMany({
          where: { id: { in: ids } },
          take: ids.length,
          select: { id: true, hash: true },
        })
      : [];
    const file: SkinFile = {
      omniaSkin: 2,
      name: skin.name,
      description: skin.description,
      colorScheme: skin.colorScheme,
      tokens: skin.tokens,
      definition: skin.definition,
      assetHashes: Object.fromEntries(assety.map((a) => [a.id, a.hash])),
    };
    return JSON.stringify(file, null, 2);
  }

  const file: SkinFile = {
    omniaSkin: 1,
    name: skin.name,
    description: skin.description,
    colorScheme: skin.colorScheme,
    tokens: skin.tokens,
  };
  return JSON.stringify(file, null, 2);
}

export type SkinImportResult = {
  id: string;
  /** Ile tokenów przyjęto. */
  accepted: number;
  /** Klucze odrzucone przy walidacji — pokazujemy je użytkownikowi, zamiast milczeć. */
  rejected: string[];
};

/** Import skórki z JSON-a. ZAWSZE tworzy skórkę użytkownika — nigdy systemową —
 *  więc plik z `isSystem: true` nie jest drogą do podniesienia uprawnień.
 *
 *  Wejście jest OBCE: cała mapa tokenów przechodzi przez `validateTokens`, które
 *  odrzuca klucz spoza whitelisty i wartość niezgodną z rodzajem. Odrzucone klucze
 *  wracają do UI — cicha utrata połowy skórki byłaby gorsza niż błąd. */
export async function importSkin(json: string, name?: string): Promise<SkinImportResult> {
  const user = await requireAuth();

  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    throw new Error("To nie jest poprawny plik JSON");
  }
  if (!raw || typeof raw !== "object") throw new Error("Plik skórki musi być obiektem JSON");

  const src = raw as Record<string, unknown>;
  const rawTokens = (src.tokens ?? {}) as Record<string, unknown>;
  if (typeof rawTokens !== "object" || rawTokens === null) {
    throw new Error("Plik skórki nie zawiera mapy tokenów");
  }

  const tokens = validateTokens(rawTokens);
  const rejected = Object.keys(rawTokens).filter((k) => !(k in tokens));

  const importedName =
    (typeof name === "string" && name.trim()) ||
    (typeof src.name === "string" && src.name.trim()) ||
    "Zaimportowana skórka";

  // 116: plik wersji 2 niesie definicję zaawansowaną. Definicja jest OBCA — pełna
  // walidacja; referencje assetów wiążemy po hashu z assetami dostępnymi importującemu
  // (własne + systemowe), a nieodnalezione oznaczamy `missing`, żeby kompilator jawnie
  // je pominął zamiast pokazywać cudze/nieistniejące id.
  let pola: { kind: SkinKind; definition: string | null; tokens: string } = {
    kind: "simple",
    definition: null,
    tokens: JSON.stringify(tokens),
  };
  if (src.definition !== undefined) {
    const { definicja, odrzucone } = walidujDefinicje(src.definition);
    rejected.push(...odrzucone.map((o) => `definition.${o}`));
    const hashes =
      src.assetHashes && typeof src.assetHashes === "object" && !Array.isArray(src.assetHashes)
        ? (src.assetHashes as Record<string, unknown>)
        : {};
    if (definicja.assets?.length) {
      const szukane = definicja.assets
        .map((r) => hashes[r.id])
        .filter((h): h is string => typeof h === "string" && /^[0-9a-f]{64}$/.test(h));
      const znalezione = szukane.length
        ? await prisma.skinAsset.findMany({
            where: {
              hash: { in: szukane },
              OR: [{ ownerId: user.id }, { ownerId: null, ownerTeamId: null }],
            },
            take: szukane.length,
            select: { id: true, hash: true },
          })
        : [];
      const poHashu = new Map(znalezione.map((a) => [a.hash, a.id]));
      definicja.assets = definicja.assets.map((r) => {
        const hash = hashes[r.id];
        const noweId = typeof hash === "string" ? poHashu.get(hash) : undefined;
        return noweId ? { ...r, id: noweId, status: "ready" as const } : { ...r, id: "", status: "missing" as const };
      });
    }
    pola = {
      kind: "advanced",
      definition: JSON.stringify(definicja),
      tokens: JSON.stringify(definicja.tokens ?? {}),
    };
  }

  const skin = await prisma.skin.create({
    data: {
      name: importedName.slice(0, 60),
      description: typeof src.description === "string" ? src.description.trim().slice(0, 200) || null : null,
      isSystem: false,
      isPublic: false,
      colorScheme: src.colorScheme === "light" ? "light" : "dark",
      ...pola,
      ownerId: user.id,
    },
  });

  revalidatePath("/", "layout");
  return { id: skin.id, accepted: Object.keys(tokens).length, rejected };
}

/** Duplikuje skórkę jako nową, edytowalną skórkę użytkownika. */
export async function duplicateSkin(id: string, name?: string): Promise<string> {
  const user = await requireAuth();
  const src = await prisma.skin.findUnique({ where: { id } });
  if (!src) throw new Error("Not found");
  const skin = await prisma.skin.create({
    data: {
      name: (name?.trim() || `${src.name} (kopia)`).slice(0, 60),
      description: src.description,
      isSystem: false,
      isPublic: false,
      colorScheme: src.colorScheme,
      tokens: JSON.stringify(validateTokens(parseTokens(src.tokens))),
      // 116: kopia skórki zaawansowanej zachowuje definicję (rewalidowaną przy odczycie).
      kind: src.kind === "advanced" ? "advanced" : "simple",
      definition: src.kind === "advanced" ? src.definition : null,
      ownerId: user.id,
    },
  });
  revalidatePath("/", "layout");
  return skin.id;
}
