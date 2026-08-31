"use server";

// 116 — MAGAZYN GRAFIK SKÓREK ZAAWANSOWANYCH (`SkinAsset`).
//
// Grafiki żyją w bazie (decyzja właściciela: Neon, nie Drive — asset publicznej skórki
// nie może zniknąć, gdy właściciel odłączy swoje konto Google; nie filesystem — Render
// nie ma trwałego dysku). Definicja skórki trzyma wyłącznie REFERENCJĘ po id; dane
// binarne serwuje trasa `/api/skins/assets/[id]` z nagłówkami immutable.
//
// Deduplikacja: SHA-256 treści, w obrębie właściciela + assetów systemowych. ŚWIADOMIE
// nie globalna — wpięcie się w cudzy rekord oznaczałoby, że kaskada usuwania tamtego
// konta zabiera grafikę z mojej skórki.

import { createHash } from "crypto";
import { revalidatePath } from "next/cache";
import { prisma } from "@/platform/db/prisma";
import { auth } from "@/platform/auth/session";
import { getUserTeamIds } from "@/platform/auth/serverUtils";
import { hasPermission, PERMISSIONS } from "@/platform/auth/permissions";
import { SUFIT_LISTY } from "@/platform/pagination";
import { widokAssetuSkorki } from "@/lib/skins/zapis";

/** Twarde limity magazynu — chronią bazę, nie użytkownika. */
const MAKS_ROZMIAR_ASSETU = 500 * 1024; // 500 kB na plik
const KWOTA_UZYTKOWNIKA = 20 * 1024 * 1024; // 20 MB łącznie na konto

/** Whitelist typów. ŚWIADOMIE bez SVG — wektor XSS (skrypty w środku dokumentu). */
const DOZWOLONE_MIME = new Set(["image/png", "image/jpeg", "image/webp"]);

const RODZAJE = new Set(["background", "texture", "pattern", "logo", "decoration"]);

/** Sygnatury (magic bytes) dozwolonych formatów — weryfikowane przy uploadzie. */
function zgodnaSygnatura(data: Buffer, mimeType: string): boolean {
  if (data.length < 12) return false;
  switch (mimeType) {
    case "image/png":
      return data[0] === 0x89 && data[1] === 0x50 && data[2] === 0x4e && data[3] === 0x47;
    case "image/jpeg":
      return data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff;
    case "image/webp":
      return data.subarray(0, 4).toString("ascii") === "RIFF" && data.subarray(8, 12).toString("ascii") === "WEBP";
    default:
      return false;
  }
}

export type SkinAssetView = {
  id: string;
  name: string;
  kind: string;
  mimeType: string;
  size: number;
  hash: string;
  isSystem: boolean;
  isOwn: boolean;
  createdAt: string;
};

export type UploadSkinAssetResult = {
  id: string;
  /** true = identyczna treść już była w magazynie — zwrócono istniejący rekord. */
  deduplikat: boolean;
  odrzucono?: string;
};

// 117: ciało w `src/lib/skins/zapis.ts` — pomocnik w pliku "use server" łamał zapadkę
// `check:domain` (funkcja stąd jest niesprawdzalna testem). Kształt zwrotu = `SkinAssetView`.
const toView = widokAssetuSkorki;

/** Wgraj grafikę do magazynu. Pola formularza: `file`, `kind`, opcjonalnie `name`
 *  i `system` ("1" — tylko admin: asset systemowy, dostępny każdej skórce). */
export async function uploadSkinAsset(formData: FormData): Promise<UploadSkinAssetResult> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) throw new Error("Unauthorized");
  const isAdmin = hasPermission(session, PERMISSIONS.ADMIN);

  const file = formData.get("file");
  if (!(file instanceof File)) throw new Error("Brak pliku w żądaniu");
  if (file.size > MAKS_ROZMIAR_ASSETU) {
    throw new Error(`Plik jest za duży (${Math.round(file.size / 1024)} kB, limit ${MAKS_ROZMIAR_ASSETU / 1024} kB)`);
  }
  const mimeType = file.type;
  if (!DOZWOLONE_MIME.has(mimeType)) {
    throw new Error("Dozwolone są wyłącznie obrazy PNG, JPEG i WebP");
  }

  const kindRaw = formData.get("kind");
  const kind = typeof kindRaw === "string" && RODZAJE.has(kindRaw) ? kindRaw : "background";
  const nameRaw = formData.get("name");
  const name =
    (typeof nameRaw === "string" && nameRaw.trim().slice(0, 80)) || file.name.slice(0, 80) || "grafika";
  const jakoSystemowy = formData.get("system") === "1";
  if (jakoSystemowy && !isAdmin) throw new Error("Forbidden");

  const data = Buffer.from(await file.arrayBuffer());
  // Recenzja 116 (ust. 1): klienckiemu `file.type` nie ufamy — deklarowany MIME musi
  // zgadzać się z sygnaturą pliku, inaczej pod `image/png` dałoby się wgrać dowolne
  // bajty serwowane potem z tym nagłówkiem.
  if (!zgodnaSygnatura(data, mimeType)) {
    throw new Error("Zawartość pliku nie zgadza się z deklarowanym typem obrazu");
  }
  const hash = createHash("sha256").update(data).digest("hex");

  // Deduplikacja: identyczna treść u tego samego właściciela / w assetach systemowych.
  const istniejacy = await prisma.skinAsset.findFirst({
    where: {
      hash,
      OR: jakoSystemowy
        ? [{ ownerId: null, ownerTeamId: null }]
        : [{ ownerId: userId }, { ownerId: null, ownerTeamId: null }],
    },
    select: { id: true },
  });
  if (istniejacy) return { id: istniejacy.id, deduplikat: true };

  if (!jakoSystemowy) {
    const zajete = await prisma.skinAsset.aggregate({
      where: { ownerId: userId },
      _sum: { size: true },
    });
    if ((zajete._sum.size ?? 0) + data.length > KWOTA_UZYTKOWNIKA) {
      throw new Error(
        `Przekroczono limit miejsca na grafiki skórek (${KWOTA_UZYTKOWNIKA / 1024 / 1024} MB). Usuń nieużywane grafiki.`,
      );
    }
  }

  const asset = await prisma.skinAsset.create({
    data: {
      hash,
      data,
      mimeType,
      size: data.length,
      kind,
      name,
      ownerId: jakoSystemowy ? null : userId,
    },
    select: { id: true },
  });

  revalidatePath("/", "layout");
  return { id: asset.id, deduplikat: false };
}

/** Grafiki dostępne dla użytkownika: własne + zespołowe + systemowe. */
export async function listSkinAssets(): Promise<SkinAssetView[]> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return [];
  const isAdmin = hasPermission(session, PERMISSIONS.ADMIN);
  const teamIds = await getUserTeamIds(userId);

  const assets = await prisma.skinAsset.findMany({
    take: SUFIT_LISTY,
    where: {
      OR: [
        { ownerId: userId },
        { ownerTeamId: { in: teamIds } },
        { ownerId: null, ownerTeamId: null },
      ],
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true, name: true, kind: true, mimeType: true, size: true, hash: true,
      ownerId: true, ownerTeamId: true, createdAt: true,
    },
  });
  return assets.map((a) => toView(a, userId, isAdmin));
}

/** Skórki, które używają danego assetu (referencja po id żyje w JSON-ie definicji). */
async function skorkiUzywajaceAssetu(assetId: string): Promise<{ id: string; name: string }[]> {
  // paginacja: kompletny — guard usunięcia musi widzieć KAŻDĄ skórkę używającą assetu;
  // częściowy wynik pozwoliłby skasować grafikę żywej skórki.
  const skorki = await prisma.skin.findMany({
    where: { kind: "advanced", definition: { contains: assetId } },
    select: { id: true, name: true },
  });
  return skorki;
}

/** Usuń grafikę. Odmawia, gdy używa jej jakakolwiek skórka (AC-7). */
export async function deleteSkinAsset(id: string): Promise<void> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) throw new Error("Unauthorized");
  const isAdmin = hasPermission(session, PERMISSIONS.ADMIN);

  const asset = await prisma.skinAsset.findUnique({
    where: { id },
    select: { id: true, ownerId: true, ownerTeamId: true },
  });
  if (!asset) throw new Error("Not found");

  const isSystem = asset.ownerId === null && asset.ownerTeamId === null;
  if (isSystem) {
    if (!isAdmin) throw new Error("Forbidden");
  } else if (asset.ownerId !== userId) {
    const teamIds = await getUserTeamIds(userId);
    const owns = asset.ownerTeamId !== null && teamIds.includes(asset.ownerTeamId);
    if (!owns && !isAdmin) throw new Error("Forbidden");
  }

  const uzywajace = await skorkiUzywajaceAssetu(id);
  if (uzywajace.length > 0) {
    throw new Error(
      `Nie można usunąć: grafiki używają skórki ${uzywajace.map((s) => `„${s.name}"`).join(", ")}. Najpierw usuń lub zmień te skórki.`,
    );
  }

  await prisma.skinAsset.delete({ where: { id } });
  revalidatePath("/", "layout");
}

export type SkinAssetStats = {
  skorekProstych: number;
  skorekZaawansowanych: number;
  liczbaAssetow: number;
  rozmiarLacznie: number;
  assety: (SkinAssetView & { uzywanaPrzez: { id: string; name: string }[]; osierocony: boolean })[];
};

/** Statystyki magazynu dla administratora (AC-8): liczby, rozmiary, użycia, osierocone. */
export async function getSkinAssetStats(): Promise<SkinAssetStats> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId || !hasPermission(session, PERMISSIONS.ADMIN)) throw new Error("Forbidden");

  const [proste, zaawansowane, agregat, assety, definicje] = await Promise.all([
    prisma.skin.count({ where: { kind: "simple" } }),
    prisma.skin.count({ where: { kind: "advanced" } }),
    prisma.skinAsset.aggregate({ _count: { id: true }, _sum: { size: true } }),
    prisma.skinAsset.findMany({
      take: SUFIT_LISTY,
      orderBy: { size: "desc" },
      select: {
        id: true, name: true, kind: true, mimeType: true, size: true, hash: true,
        ownerId: true, ownerTeamId: true, createdAt: true,
      },
    }),
    // paginacja: kompletny — mapa użyć liczona ze WSZYSTKICH definicji; częściowa
    // oznaczałaby fałszywe „osierocone" i zachętę do skasowania używanej grafiki.
    prisma.skin.findMany({
      where: { kind: "advanced" },
      select: { id: true, name: true, definition: true },
    }),
  ]);

  const wynik = assety.map((a) => {
    const uzywanaPrzez = definicje
      .filter((s) => s.definition?.includes(a.id))
      .map((s) => ({ id: s.id, name: s.name }));
    return { ...toView(a, userId, true), uzywanaPrzez, osierocony: uzywanaPrzez.length === 0 };
  });

  return {
    skorekProstych: proste,
    skorekZaawansowanych: zaawansowane,
    liczbaAssetow: agregat._count.id,
    rozmiarLacznie: agregat._sum.size ?? 0,
    assety: wynik,
  };
}
