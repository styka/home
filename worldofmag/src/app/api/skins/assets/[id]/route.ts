// 116 — serwowanie grafik skórek z magazynu w bazie (`SkinAsset`).
//
// Id jest stabilne, a treść rekordu NIEZMIENNA (podmiana grafiki = nowy rekord po
// deduplikacji hashem), więc odpowiedź wolno cache'ować agresywnie: rok + immutable.
// Dzięki temu ta sama tekstura na dziesięciu widokach to jedno żądanie na przeglądarkę.
//
// Sesja jest wymagana (aplikacja nie ma trybu anonimowego), ale NIE zawężamy odczytu do
// właściciela: grafika skórki publicznej/zespołowej musi się wyświetlić każdemu, kto tę
// skórkę widzi w pickerze albo ma ją aktywną — dokładnie jak tokeny skórki publicznej.

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/platform/auth/session";
import { prisma } from "@/platform/db/prisma";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const id = params.id;
  if (!/^[a-z0-9]{16,40}$/.test(id)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const asset = await prisma.skinAsset.findUnique({
    where: { id },
    select: { data: true, mimeType: true, hash: true },
  });
  if (!asset) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return new NextResponse(Buffer.from(asset.data), {
    headers: {
      "Content-Type": asset.mimeType,
      "Cache-Control": "public, max-age=31536000, immutable",
      ETag: `"${asset.hash}"`,
    },
  });
}
