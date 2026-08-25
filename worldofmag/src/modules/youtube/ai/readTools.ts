import { prisma } from "@/platform/db/prisma";
import { filtrMoichRekordow } from "@/platform/workspaces/zapis";
import { SUFIT_LISTY } from "@/platform/pagination";
import type { AiReadToolHandler } from "@/platform/ai/contribution";

/**
 * 102: narzędzia ODCZYTU tego modułu.
 *
 * Dwa, bo na dwa pytania użytkownik realnie przychodzi do asystenta: „mam co oglądać?" i „w którym
 * filmie o tym mówili?". Reszta modułu (zarządzanie kanałami, streszczenia w trzech długościach)
 * jest mechaniką własnego widoku i w kontrakcie asystenta byłaby balastem promptu.
 */
export const readToolsPrompt = `- list_youtube_videos { stan?, tylkoWarte? } — nowe filmy z obserwowanych kanałów wraz z oceną „czy warto obejrzeć"
- search_youtube_transcripts { fraza } — szuka frazy w transkrypcjach zebranych filmów i mówi, w którym filmie padła`;

export const readTools: Record<string, AiReadToolHandler> = {
  list_youtube_videos: async (args, userId) => {
    const stan = typeof args.stan === "string" ? args.stan : "nowy";
    const tylkoWarte = args.tylkoWarte === true;
    const filmy = await prisma.youtubeVideo.findMany({
      take: 30,
      where: {
        ...(await filtrMoichRekordow(userId)),
        stan,
        ...(tylkoWarte ? { ocena: { gte: 60 } } : {}),
      },
      orderBy: [{ ocena: { sort: "desc", nulls: "last" } }, { publishedAt: "desc" }],
      select: {
        videoId: true, title: true, publishedAt: true, ocena: true, ocenaPowod: true,
        transkrypcjaStan: true, channel: { select: { title: true } },
      },
    });
    return filmy.map((f) => ({
      tytul: f.title,
      kanal: f.channel.title,
      opublikowano: f.publishedAt.toISOString().slice(0, 10),
      ocena: f.ocena,
      dlaczego: f.ocenaPowod,
      maTranskrypcje: f.transkrypcjaStan === "jest",
      adres: `https://www.youtube.com/watch?v=${f.videoId}`,
    }));
  },

  search_youtube_transcripts: async (args, userId) => {
    const fraza = typeof args.fraza === "string" ? args.fraza.trim() : "";
    if (!fraza) return [];
    const filmy = await prisma.youtubeVideo.findMany({
      take: SUFIT_LISTY,
      where: {
        ...(await filtrMoichRekordow(userId)),
        transkrypcja: { contains: fraza, mode: "insensitive" },
      },
      orderBy: { publishedAt: "desc" },
      select: { videoId: true, title: true, transkrypcja: true, channel: { select: { title: true } } },
    });
    return filmy.slice(0, 10).map((f) => {
      // Zwracamy FRAGMENT wokół trafienia, nie całą transkrypcję: pełne transkrypcje dziesięciu
      // filmów przekroczyłyby okno kontekstu modelu i kosztowałyby wielokrotnie więcej niż pytanie.
      const i = (f.transkrypcja ?? "").toLowerCase().indexOf(fraza.toLowerCase());
      const od = Math.max(0, i - 200);
      return {
        tytul: f.title,
        kanal: f.channel.title,
        fragment: (f.transkrypcja ?? "").slice(od, od + 500),
        adres: `https://www.youtube.com/watch?v=${f.videoId}`,
      };
    });
  },
};
