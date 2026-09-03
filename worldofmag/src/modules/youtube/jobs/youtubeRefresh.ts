import { prisma } from "@/platform/db/prisma";
import type { JobHandler } from "@/platform/jobs/types";
import { logEvent } from "@/platform/observability/log";
import { chatComplete } from "@/platform/llm/chat";
import { parseJsonLoose } from "@/platform/llm/json";
import { usageFromChat, type AiUsageInfo } from "@/platform/ai/usage";
import { buildUserContext } from "@/lib/userContext";
import { przestrzenOsobista } from "@/platform/workspaces/zapis";
import { filmyKanalu } from "../lib/filmy";
import { pobierzTranskrypcje } from "../lib/transkrypcja";

/**
 * 102 (AC-5, AC-11, AC-12) — JEDNO ODŚWIEŻENIE OBEJMUJĄCE CAŁY MODUŁ.
 *
 * Wzorzec z Wiadomości: etapy raportują postęp przez `ctx.progress`, więc pasek stanu przeżywa
 * przeładowanie strony (czyta go z kolejki, nie z własnej pamięci).
 *
 * **Etapy 2 i 3 są DODATKOWE i ich awaria nie może wywrócić przebiegu.** Po etapie 1 filmy są już
 * zapisane — a to jest właśnie to, po co użytkownik kliknął „Odśwież". Gdyby wyjątek z transkrypcji
 * albo z modelu przewrócił całe zadanie, wynikiem byłaby czerwona kolejka i pusta lista, mimo że
 * najważniejsza część pracy się udała (wzorzec `etapGoracychTematow`, 086).
 */

/** Ile transkrypcji dociągamy w jednym przebiegu. Reszta dobierze się w kolejnym. */
const LIMIT_TRANSKRYPCJI = 25;
/** Ile filmów ocenia jedno wywołanie modelu. */
const PARTIA_OCENY = 10;
/** Ile filmów w ogóle oceniamy w jednym przebiegu. */
const LIMIT_OCENY = 40;

export interface WynikOdswiezania {
  kanalow: number;
  nowychFilmow: number;
  transkrypcji: number;
  transkrypcjiProbowano: number;
  ocenionych: number;
  /**
   * Zużycie modelu z tego przebiegu. Handler chodzi w workerze BEZ sesji, więc nie może sam
   * rozstrzygnąć, czy wolno je pokazać — zapisuje surowe, a bramkę widoczności nakłada dopiero
   * odczyt zadania (`GET /api/jobs/[id]`). To jest wyjątek przewidziany przez `check:cost-badge`.
   */
  usage?: AiUsageInfo;
}

export const youtubeRefreshHandler: JobHandler<Record<string, never>, WynikOdswiezania> = async (
  _payload,
  ctx
) => {
  if (!ctx.ownerId) throw new Error("Odświeżanie YouTube wymaga właściciela zadania");
  const ownerId = ctx.ownerId;
  const workspaceId = await przestrzenOsobista(ownerId);

  const wynik: WynikOdswiezania = {
    kanalow: 0,
    nowychFilmow: 0,
    transkrypcji: 0,
    transkrypcjiProbowano: 0,
    ocenionych: 0,
  };

  // Zbieramy wywołania modelu z całego przebiegu — koszt liczy się dla przebiegu, nie dla partii.
  const zuzycie: Parameters<typeof usageFromChat>[0] = [];

  // ── Etap 1: nowe filmy z obserwowanych kanałów ────────────────────────────
  // paginacja: kompletny — przebieg MUSI objąć wszystkie obserwowane kanały; pominięcie
  // któregokolwiek znaczyłoby „nie ma nic nowego" na kanale, na którym coś jest.
  const kanaly = await prisma.youtubeChannel.findMany({
    where: { workspaceId },
    select: { id: true, channelId: true, title: true },
  });
  wynik.kanalow = kanaly.length;

  for (let i = 0; i < kanaly.length; i++) {
    const kanal = kanaly[i];
    ctx.progress?.(`Sprawdzam kanały (${i + 1}/${kanaly.length})…`);
    const filmy = await filmyKanalu(kanal.channelId);
    if (filmy.length === 0) continue;

    const dodane = await prisma.youtubeVideo.createMany({
      data: filmy.map((f) => ({
        workspaceId,
        channelId: kanal.id,
        videoId: f.videoId,
        title: f.title,
        description: f.description,
        publishedAt: f.publishedAt,
        thumbnailUrl: f.thumbnailUrl,
      })),
      // Powtórzone pozycje odpadają na indeksie unikalnym — nie sprawdzamy ich po jednej.
      skipDuplicates: true,
    });
    wynik.nowychFilmow += dodane.count;
    await prisma.youtubeChannel.update({ where: { id: kanal.id }, data: { lastFetchedAt: new Date() } });
  }

  // ── Etap 2: transkrypcje (DODATKOWY) ──────────────────────────────────────
  try {
    const doPobrania = await prisma.youtubeVideo.findMany({
      take: LIMIT_TRANSKRYPCJI,
      where: { workspaceId, transkrypcjaStan: "oczekuje" },
      orderBy: { publishedAt: "desc" },
      select: { id: true, videoId: true },
    });

    // 123: pobranie jest łańcuchem trzech dróg (strona → player → panel), więc sama liczba
    // udanych już nie wystarcza — rozbicie po źródle mówi, która droga niesie ruch, a jej
    // wyzerowanie jest pierwszym sygnałem kolejnej zmiany po stronie YouTube.
    const zrodla: Record<string, number> = {};
    for (let i = 0; i < doPobrania.length; i++) {
      const film = doPobrania[i];
      ctx.progress?.(`Pobieram transkrypcje (${i + 1}/${doPobrania.length})…`);
      wynik.transkrypcjiProbowano++;
      const t = await pobierzTranskrypcje(film.videoId);
      await prisma.youtubeVideo.update({
        where: { id: film.id },
        data: t
          ? { transkrypcja: t.tekst, transkrypcjaJezyk: t.jezyk, transkrypcjaStan: "jest" }
          : { transkrypcjaStan: "niedostepna" },
      });
      if (t) {
        wynik.transkrypcji++;
        zrodla[t.zrodlo] = (zrodla[t.zrodlo] ?? 0) + 1;
      }
    }

    // **Odsetek udanych pobrań jest tu po to, żeby dało się ocenić, czy wariant lekki wystarcza.**
    // Bez tej liczby decyzja „dokładamy przeglądarkę w tle" byłaby zgadywaniem, a przy pobieraniu
    // ze strony cudzego serwisu to jest dokładnie ta rzecz, która potrafi przestać działać po cichu.
    if (wynik.transkrypcjiProbowano > 0) {
      logEvent("info", "youtube.transkrypcje.skutecznosc", {
        probowano: wynik.transkrypcjiProbowano,
        udane: wynik.transkrypcji,
        odsetek: Math.round((wynik.transkrypcji / wynik.transkrypcjiProbowano) * 100),
        zrodla,
      });
    }
  } catch (e) {
    logEvent("warn", "youtube.transkrypcje.etap_nieudany", {
      powod: e instanceof Error ? e.message : "nieznany",
    });
  }

  // ── Etap 3: ocena „czy warto obejrzeć" (DODATKOWY) ────────────────────────
  try {
    const doOceny = await prisma.youtubeVideo.findMany({
      take: LIMIT_OCENY,
      where: { workspaceId, stan: "nowy", ocena: null },
      orderBy: { publishedAt: "desc" },
      select: { id: true, title: true, description: true, transkrypcja: true },
    });

    if (doOceny.length > 0) {
      // Wiedza o użytkowniku wchodzi do promptu, żeby uzasadnienie odwoływało się do JEGO
      // zainteresowań, a nie do popularności filmu (AC-12). Bez tego ocena byłaby recenzją.
      const kontekst = await buildUserContext(ownerId);

      for (let start = 0; start < doOceny.length; start += PARTIA_OCENY) {
        const partia = doOceny.slice(start, start + PARTIA_OCENY);
        ctx.progress?.(`Oceniam, co warto obejrzeć (${start + partia.length}/${doOceny.length})…`);

        const opis = partia
          .map(
            (f, i) =>
              `${i}. Tytuł: ${f.title}\n   Materiał: ${(f.transkrypcja ?? f.description).slice(0, 800) || "(brak)"}`
          )
          .join("\n\n");

        const res = await chatComplete({
          op: "generation",
          json: true,
          temperature: 0.3,
          maxTokens: 1200,
          cache: false,
          messages: [
            {
              role: "system",
              content:
                "Oceniasz po polsku, czy dany materiał wideo warto obejrzeć — dla KONKRETNEJ osoby, " +
                "której zainteresowania znasz. Ocena to liczba 0–100. Uzasadnienie to JEDNO zdanie " +
                "odwołujące się do zainteresowań tej osoby, nigdy do popularności filmu ani liczby " +
                "wyświetleń. Gdy materiał jest ubogi, oceniaj ostrożnie i powiedz to w uzasadnieniu." +
                (kontekst ? `\n\n${kontekst}` : ""),
            },
            {
              role: "user",
              content: `${opis}\n\nZwróć JSON: {"oceny":[{"index":0,"ocena":72,"powod":"..."}]} dla KAŻDEJ pozycji.`,
            },
          ],
        });
        if (!res.ok) throw new Error(res.message);
        zuzycie.push({ res, label: "Ocena „czy warto obejrzeć”", op: "generation" });

        const parsed = parseJsonLoose<{ oceny?: Array<{ index: number; ocena: number; powod: string }> }>(
          res.content
        );
        for (const o of parsed?.oceny ?? []) {
          const film = partia[o.index];
          if (!film || typeof o.ocena !== "number") continue;
          await prisma.youtubeVideo.update({
            where: { id: film.id },
            data: {
              ocena: Math.max(0, Math.min(100, Math.round(o.ocena))),
              ocenaPowod: (o.powod ?? "").slice(0, 400) || null,
              ocenaAt: new Date(),
            },
          });
          wynik.ocenionych++;
        }
      }
    }
  } catch (e) {
    logEvent("warn", "youtube.ocena.etap_nieudany", {
      powod: e instanceof Error ? e.message : "nieznany",
    });
  }

  ctx.progress?.(`Gotowe: ${wynik.nowychFilmow} nowych filmów.`);
  return { ...wynik, usage: usageFromChat(zuzycie) };
};
