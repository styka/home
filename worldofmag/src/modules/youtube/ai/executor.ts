import { prisma } from "@/platform/db/prisma";
import { asStr, type ExecOutcome } from "@/lib/ai/executorShared";
import type { AIAction } from "@/platform/ai/aiAction";
import { filtrMoichRekordow } from "@/platform/workspaces/zapis";
import { dodajKanal } from "../actions/kanaly";
import { odswiezYoutube, ustawStan } from "../actions/filmy";

/** 102: egzekutor akcji zapisu modułu YouTube. */
export async function executeYoutubeAction(action: AIAction, userId: string): Promise<string | ExecOutcome> {
  const { type, params, searchQuery } = action;

  if (type === "add_youtube_channel") {
    const adres = asStr(params.adresKanalu) ?? asStr(params.adres) ?? searchQuery;
    if (!adres) throw new Error("Podaj odnośnik do kanału, jego identyfikator albo uchwyt");
    const wynik = await dodajKanal(adres);
    if (!wynik.ok) {
      throw new Error(
        wynik.powod === "juz-jest"
          ? "Ten kanał jest już obserwowany"
          : `Nie rozpoznano kanału YouTube: "${adres}"`
      );
    }
    return {
      message: `Obserwujesz teraz kanał „${wynik.kanal.title}"`,
      navigateTo: "/youtube/kanaly",
      navigateLabel: "Otwórz kanały",
    };
  }

  if (type === "refresh_youtube") {
    await odswiezYoutube();
    return {
      message: "Sprawdzam nowe filmy na obserwowanych kanałach — przebieg leci w tle",
      navigateTo: "/youtube",
      navigateLabel: "Otwórz YouTube",
    };
  }

  if (type === "mark_youtube_watched") {
    let videoId = asStr(params.videoId);
    if (!videoId && searchQuery) {
      const f = await prisma.youtubeVideo.findFirst({
        where: {
          ...(await filtrMoichRekordow(userId)),
          title: { contains: searchQuery, mode: "insensitive" },
        },
        orderBy: { publishedAt: "desc" },
        select: { videoId: true },
      });
      videoId = f?.videoId;
    }
    if (!videoId) throw new Error(`Nie znaleziono filmu: "${searchQuery ?? ""}"`);
    await ustawStan(videoId, "obejrzany");
    return "Oznaczono film jako obejrzany";
  }

  throw new Error(`Nieznana akcja modułu YouTube: ${type}`);
}
