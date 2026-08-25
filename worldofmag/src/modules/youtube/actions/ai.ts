"use server";

import { prisma } from "@/platform/db/prisma";
import { requireAuth } from "@/platform/auth/serverUtils";
import { filtrMoichRekordow } from "@/platform/workspaces/zapis";
import { chatComplete } from "@/platform/llm/chat";
import { rememberedContent, hashInputs } from "@/platform/ai/contentMemory";
import { usageFromChat, type AiUsageInfo } from "@/platform/ai/usage";
import { visibleUsage } from "@/platform/ai/costVisibility";
import { buildUserContext, userContextStamp } from "@/lib/userContext";

/**
 * 102 — AI MODUŁU: streszczenia i pytania do filmu.
 *
 * Dwie operacje o **różnym stosunku do pamięci** i to jest sedno tego pliku:
 *
 * * **Streszczenie** to treść DO CZYTANIA — ta sama przy każdym wejściu, więc idzie przez
 *   `rememberedContent` i drugi raz nie kosztuje (AC-9, AC-10).
 * * **Pytanie do filmu** jest za każdym razem inne, więc pamięć zwracałaby odpowiedź na CUDZE
 *   pytanie. Idzie na żądanie, bez zapisu.
 */

export type DlugoscStreszczenia = "krotkie" | "srednie" | "dlugie";

export type WynikStreszczenia = {
  tresc: string;
  generatedAt: string | null;
  stale: boolean;
  zPamieci: boolean;
  usage?: AiUsageInfo;
};

const WYTYCZNE: Record<DlugoscStreszczenia, string> = {
  krotkie: "dwa–trzy zdania: o czym jest ten materiał i dla kogo",
  srednie: "jeden akapit (około 120 słów): główna teza i najważniejsze wnioski",
  dlugie: "kilka akapitów: tok wywodu, kluczowe argumenty i wnioski, w kolejności z materiału",
};

/** Ile znaków transkrypcji wysyłamy do modelu. Dłuższe materiały tniemy — koszt rośnie liniowo. */
const LIMIT_MATERIALU = 24_000;

export async function streszczenie(
  videoId: string,
  dlugosc: DlugoscStreszczenia,
  force = false
): Promise<WynikStreszczenia> {
  const user = await requireAuth();
  const moje = await filtrMoichRekordow(user.id);

  const film = await prisma.youtubeVideo.findUnique({
    where: { workspaceId_videoId: { ...moje, videoId } },
    select: { title: true, description: true, transkrypcja: true },
  });
  if (!film) throw new Error("Film nie istnieje");

  // Gdy transkrypcji nie ma, streszczamy z tytułu i opisu — i mówimy o tym modelowi wprost, żeby
  // nie udawał wiedzy o treści, której nie widział (AC-8).
  const maTranskrypcje = !!film.transkrypcja;
  const material = maTranskrypcje
    ? (film.transkrypcja as string).slice(0, LIMIT_MATERIALU)
    : `${film.title}\n\n${film.description}`.slice(0, LIMIT_MATERIALU);

  const inputHash = hashInputs(
    videoId,
    dlugosc,
    String(material.length),
    material.slice(0, 200),
    await userContextStamp(user.id)
  );

  const kontekst = await buildUserContext(user.id);

  const remembered = await rememberedContent<string>({
    ownerId: user.id,
    kind: "youtube.streszczenie",
    // Trzy długości to trzy osobne treści do zapamiętania, a nie jedna w wariantach — inaczej
    // przełączenie długości kasowałoby poprzednią i kazało płacić za nią ponownie.
    scopeKey: `${videoId}:${dlugosc}`,
    inputHash,
    force,
    generate: async () => {
      const res = await chatComplete({
        op: "generation",
        temperature: 0.3,
        maxTokens: dlugosc === "dlugie" ? 1600 : dlugosc === "srednie" ? 700 : 300,
        // Pamięć treści zastępuje tu pamięć podręczną wywołań: do modelu idziemy wyłącznie przy
        // braku zapisu albo na wyraźne żądanie, więc drugi poziom nie ma czego oszczędzić.
        cache: false,
        messages: [
          {
            role: "system",
            content:
              "Streszczasz materiały wideo po polsku. Piszesz rzeczowo, bez zwrotów w rodzaju " +
              "„w tym filmie” i bez zachwytów. Streszczasz WYŁĄCZNIE to, co jest w materiale — " +
              "niczego nie dopowiadasz." +
              (maTranskrypcje
                ? ""
                : " UWAGA: nie masz transkrypcji, tylko tytuł i opis. Napisz streszczenie na tyle, " +
                  "na ile pozwala ten materiał, i nie udawaj, że znasz treść filmu.") +
              (kontekst ? `\n\n${kontekst}` : ""),
          },
          {
            role: "user",
            content: `Tytuł: ${film.title}\n\nMateriał:\n${material}\n\nNapisz streszczenie: ${WYTYCZNE[dlugosc]}.`,
          },
        ],
      });
      if (!res.ok) throw new Error(res.message);
      return {
        value: res.content.trim(),
        usage: usageFromChat([{ res, label: "Streszczenie filmu", op: "generation" }]),
      };
    },
  });

  return {
    tresc: remembered.value,
    generatedAt: remembered.generatedAt ?? null,
    stale: remembered.stale,
    zPamieci: remembered.fromMemory,
    usage: await visibleUsage(remembered.usage),
  };
}

/**
 * Pytanie do filmu (AC-13).
 *
 * Odpowiedź powstaje **wyłącznie z transkrypcji**. Wymóg przyznania „nie ma tego w transkrypcji"
 * jest w prompcie postawiony wprost, bo bez niego model zawsze coś odpowie — a odpowiedź zmyślona
 * jest tu gorsza niż jej brak: użytkownik pyta właśnie po to, żeby NIE oglądać filmu, więc nie ma
 * jak jej sprawdzić.
 */
export async function zapytajOFilm(videoId: string, pytanie: string): Promise<string> {
  const user = await requireAuth();
  const moje = await filtrMoichRekordow(user.id);

  const film = await prisma.youtubeVideo.findUnique({
    where: { workspaceId_videoId: { ...moje, videoId } },
    select: { title: true, transkrypcja: true },
  });
  if (!film) throw new Error("Film nie istnieje");
  if (!film.transkrypcja) return "Ten film nie ma transkrypcji, więc nie mam z czego odpowiedzieć.";

  const res = await chatComplete({
    op: "reasoning",
    temperature: 0.2,
    maxTokens: 800,
    cache: false,
    messages: [
      {
        role: "system",
        content:
          "Odpowiadasz po polsku na pytania o materiał wideo, opierając się WYŁĄCZNIE na jego " +
          "transkrypcji. Jeśli transkrypcja nie zawiera odpowiedzi, napisz wprost: " +
          "„Nie ma tego w transkrypcji.” — i nie zgaduj. Nie korzystasz z wiedzy spoza materiału.",
      },
      {
        role: "user",
        content: `Tytuł: ${film.title}\n\nTranskrypcja:\n${film.transkrypcja.slice(0, LIMIT_MATERIALU)}\n\nPytanie: ${pytanie}`,
      },
    ],
  });
  if (!res.ok) throw new Error(res.message);
  return res.content.trim();
}
