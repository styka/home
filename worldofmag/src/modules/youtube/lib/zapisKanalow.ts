import { prisma } from "@/platform/db/prisma";
import { revalidatePath } from "next/cache";
import { wlasnoscOsobistaDoZapisu } from "@/platform/workspaces/zapis";
import { logEvent } from "@/platform/observability/log";

/** „reczne" — wklejone przez użytkownika; „subskrypcje" — zaimportowane z konta Google. */
export type ZrodloKanalu = "reczne" | "subskrypcje";

/**
 * Dopisuje kanały, których jeszcze nie ma. Wspólne dla importu subskrypcji i dla przywracania
 * z kosza. Idempotentne dzięki `@@unique([workspaceId, channelId])` — powtórzony import nie tworzy
 * duplikatów (AC-3), bo nie ma na to miejsca w bazie, a nie dlatego, że ktoś pamiętał o sprawdzeniu.
 */
export async function dopiszKanaly(
  userId: string,
  kanaly: Array<{ channelId: string; title: string; handle?: string | null; thumbnailUrl?: string | null }>,
  zrodlo: ZrodloKanalu
): Promise<number> {
  if (kanaly.length === 0) return 0;
  const wlasnosc = await wlasnoscOsobistaDoZapisu(userId);

  // JEDEN zapis na całą partię, nie jeden na kanał. `skipDuplicates` odsiewa istniejące po stronie
  // bazy, więc pętla dawałaby dokładnie ten sam wynik — tyle że kontem z dwustoma subskrypcjami
  // płaciłaby dwieście podróży do bazy zamiast jednej.
  const wynik = await prisma.youtubeChannel.createMany({
    data: kanaly.map((k) => ({
      ...wlasnosc,
      channelId: k.channelId,
      title: k.title,
      handle: k.handle ?? null,
      thumbnailUrl: k.thumbnailUrl ?? null,
      zrodlo,
    })),
    skipDuplicates: true,
  });
  const dodane = wynik.count;

  if (dodane > 0) {
    logEvent("info", "youtube.kanaly.dopisane", { ile: dodane, zrodlo });
    revalidatePath("/youtube/kanaly");
  }
  return dodane;
}
