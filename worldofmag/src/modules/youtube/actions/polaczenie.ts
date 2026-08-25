"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/platform/db/prisma";
import { requireAuth } from "@/platform/auth/serverUtils";
import { logEvent } from "@/platform/observability/log";
import { odszyfrujToken, zaszyfrujToken, refreshAccessToken, pobierzSubskrypcje } from "../lib/oauth";
import { dopiszKanaly } from "../lib/zapisKanalow";

/**
 * 102 (AC-2, AC-3, AC-4) — POŁĄCZENIE Z KONTEM GOOGLE.
 *
 * Start zgody nie jest tutaj Server Action, tylko zwykłym odnośnikiem do `/api/youtube/connect`:
 * przepływ OAuth jest przekierowaniem przeglądarki i musi ustawić ciasteczko ze stanem, czego
 * akcja serwerowa zrobić nie może.
 */

export async function czyPolaczony(): Promise<boolean> {
  const user = await requireAuth();
  const p = await prisma.youtubeConnection.findUnique({
    where: { userId: user.id },
    select: { refreshToken: true },
  });
  return !!p?.refreshToken;
}

/**
 * Rozłącza konto.
 *
 * **Kasuje wyłącznie zgodę — kanały ZOSTAJĄ** (AC-4 wprost tego wymaga). Zaimportowane kanały są
 * już decyzją użytkownika („obserwuję je"), a nie własnością połączenia; przestają się tylko same
 * aktualizować z subskrypcji.
 */
export async function rozlaczYoutube(): Promise<void> {
  const user = await requireAuth();
  await prisma.youtubeConnection.deleteMany({ where: { userId: user.id } });
  revalidatePath("/youtube/kanaly");
}

/** Zwraca ważny token dostępu albo `null`, gdy konto nie jest połączone. */
async function wazyToken(userId: string): Promise<string | null> {
  const p = await prisma.youtubeConnection.findUnique({ where: { userId } });
  if (!p) return null;

  const jeszczeWazny = p.accessTokenExpiresAt && p.accessTokenExpiresAt > new Date();
  if (jeszczeWazny && p.accessToken) return odszyfrujToken(p.accessToken);

  const refresh = odszyfrujToken(p.refreshToken);
  if (!refresh) return null;

  try {
    const tokeny = await refreshAccessToken(refresh);
    await prisma.youtubeConnection.update({
      where: { userId },
      data: {
        accessToken: zaszyfrujToken(tokeny.accessToken),
        accessTokenExpiresAt: tokeny.expiresAt,
      },
    });
    return tokeny.accessToken;
  } catch {
    // Zgoda mogła zostać cofnięta po stronie Google. To nie jest awaria aplikacji — moduł ma dalej
    // działać na kanałach dodanych ręcznie (AC-2).
    logEvent("warn", "youtube.token.odswiezenie_nieudane", {});
    return null;
  }
}

export type WynikImportu = { ok: true; dodane: number } | { ok: false; powod: "brak-polaczenia" };

/**
 * Import subskrypcji (AC-3).
 *
 * Idempotentny **z konstrukcji**, a nie przez sprawdzanie: `@@unique([workspaceId, channelId])`
 * plus `skipDuplicates` sprawiają, że powtórzony import po prostu nie ma gdzie zapisać duplikatu.
 */
export async function importujSubskrypcje(): Promise<WynikImportu> {
  const user = await requireAuth();
  const token = await wazyToken(user.id);
  if (!token) return { ok: false, powod: "brak-polaczenia" };

  const subskrypcje = await pobierzSubskrypcje(token);
  const dodane = await dopiszKanaly(user.id, subskrypcje, "subskrypcje");

  logEvent("info", "youtube.subskrypcje.import", { pobrane: subskrypcje.length, dodane });
  revalidatePath("/youtube/kanaly");
  return { ok: true, dodane };
}
