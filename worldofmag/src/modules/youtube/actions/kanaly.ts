"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/platform/db/prisma";
import { requireAuth } from "@/platform/auth/serverUtils";
import { SUFIT_LISTY } from "@/platform/pagination";
import { wlasnoscOsobistaDoZapisu, filtrMoichRekordow } from "@/platform/workspaces/zapis";
import { recordTrash } from "@/platform/trash/trash";
import { rozwiazKanal } from "../lib/kanal";
import type { ZrodloKanalu } from "../lib/zapisKanalow";

/**
 * 102 — KANAŁY OBSERWOWANE.
 *
 * Moduł jest OSOBISTY: nie ma wariantu zespołowego, więc zapis idzie przez
 * `wlasnoscOsobistaDoZapisu`, a odczyt przez `filtrMoichRekordow` — wariant **wąski**. Użycie
 * szerszego `ownedWhereAsync` byłoby cichym poszerzeniem dostępu: dziś, przy koncie bez zespołów,
 * oba zwracają te same wiersze, więc pomyłka wyszłaby dopiero u pierwszego użytkownika z zespołem.
 */

export type KanalDTO = {
  id: string;
  channelId: string;
  title: string;
  handle: string | null;
  thumbnailUrl: string | null;
  zrodlo: string;
  lastFetchedAt: string | null;
};

export async function getKanaly(): Promise<KanalDTO[]> {
  const user = await requireAuth();
  const rows = await prisma.youtubeChannel.findMany({
    take: SUFIT_LISTY,
    where: { ...(await filtrMoichRekordow(user.id)) },
    orderBy: { title: "asc" },
  });
  return rows.map((r) => ({
    id: r.id,
    channelId: r.channelId,
    title: r.title,
    handle: r.handle,
    thumbnailUrl: r.thumbnailUrl,
    zrodlo: r.zrodlo,
    lastFetchedAt: r.lastFetchedAt?.toISOString() ?? null,
  }));
}

/**
 * Dodaje kanał po dowolnej postaci adresu (AC-1).
 *
 * Zwraca komunikat zamiast rzucać, gdy adresu nie da się rozwiązać — wklejenie czegoś, co nie jest
 * kanałem, jest zwykłą pomyłką użytkownika, a nie awarią aplikacji.
 */
export async function dodajKanal(
  adres: string
): Promise<{ ok: true; kanal: KanalDTO } | { ok: false; powod: "nierozpoznany" | "juz-jest" }> {
  const user = await requireAuth();

  const rozwiazany = await rozwiazKanal(adres);
  if (!rozwiazany) return { ok: false, powod: "nierozpoznany" };

  const wlasnosc = await wlasnoscOsobistaDoZapisu(user.id);

  const istnieje = await prisma.youtubeChannel.findUnique({
    where: { workspaceId_channelId: { ...wlasnosc, channelId: rozwiazany.channelId } },
    select: { id: true },
  });
  if (istnieje) return { ok: false, powod: "juz-jest" };

  const utworzony = await prisma.youtubeChannel.create({
    data: {
      ...wlasnosc,
      channelId: rozwiazany.channelId,
      title: rozwiazany.title ?? rozwiazany.channelId,
      handle: rozwiazany.handle,
      zrodlo: "reczne" satisfies ZrodloKanalu,
    },
  });

  revalidatePath("/youtube");
  revalidatePath("/youtube/kanaly");
  return {
    ok: true,
    kanal: {
      id: utworzony.id,
      channelId: utworzony.channelId,
      title: utworzony.title,
      handle: utworzony.handle,
      thumbnailUrl: utworzony.thumbnailUrl,
      zrodlo: utworzony.zrodlo,
      lastFetchedAt: null,
    },
  };
}

/**
 * Usuwa kanał — **przez kosz** (C-24, AC-18).
 *
 * Filmy znikają razem z kanałem przez kaskadę klucza obcego, ale migawka do kosza obejmuje sam
 * kanał: przywrócenie ma sens jako „obserwuję go znowu", a nie jako odtworzenie setek filmów,
 * które i tak dobiorą się przy najbliższym odświeżeniu.
 */
export async function usunKanal(id: string): Promise<void> {
  const user = await requireAuth();
  const kanal = await prisma.youtubeChannel.findUnique({ where: { id } });
  if (!kanal) throw new Error("Kanał nie istnieje");

  const moje = await filtrMoichRekordow(user.id);
  if (kanal.workspaceId !== moje.workspaceId) throw new Error("Brak dostępu do kanału");

  await recordTrash(user.id, {
    module: "youtube",
    entityId: kanal.id,
    title: kanal.title,
    payload: {
      channelId: kanal.channelId,
      title: kanal.title,
      handle: kanal.handle,
      thumbnailUrl: kanal.thumbnailUrl,
      zrodlo: kanal.zrodlo,
      ownerId: user.id,
    },
  });

  await prisma.youtubeChannel.delete({ where: { id } });

  revalidatePath("/youtube");
  revalidatePath("/youtube/kanaly");
  revalidatePath("/trash");
}
