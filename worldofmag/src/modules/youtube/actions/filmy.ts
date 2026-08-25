"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/platform/db/prisma";
import { requireAuth } from "@/platform/auth/serverUtils";
import { SUFIT_LISTY } from "@/platform/pagination";
import { filtrMoichRekordow } from "@/platform/workspaces/zapis";
import { enqueue, MAX_ACTIVE_JOBS_PER_OWNER } from "@/platform/jobs/queue";
import { ensureJobWorker } from "@/lib/jobs/registry";
import { naDto, adresFilmu, type FilmDTO } from "../domain/film";

/**
 * 102 — FILMY: lista, szczegół, stan, odświeżenie.
 *
 * Filtrowanie, sortowanie i ograniczenie liczby wierszy dzieją się **po stronie bazy**. To nie jest
 * czystość dla czystości: gdyby lista przyszła w całości i została odsiana w przeglądarce,
 * sortowanie „po tym, czy warto obejrzeć" (AC-11) działałoby na przypadkowym wycinku, a licznik
 * pokazywałby liczbę pobranych wierszy zamiast liczby filmów.
 */

export type StanFilmu = "nowy" | "obejrzany" | "odrzucony";
export type SortFilmow = "data" | "warto";

export type { FilmDTO };

export type FilmSzczegolDTO = FilmDTO & {
  transkrypcja: string | null;
  transkrypcjaJezyk: string | null;
  adresYoutube: string;
};

export async function getFilmy(opcje?: {
  stan?: StanFilmu;
  sort?: SortFilmow;
  szukaj?: string;
}): Promise<FilmDTO[]> {
  const user = await requireAuth();
  const moje = await filtrMoichRekordow(user.id);
  const szukaj = opcje?.szukaj?.trim();

  const rows = await prisma.youtubeVideo.findMany({
    take: SUFIT_LISTY,
    where: {
      ...moje,
      ...(opcje?.stan ? { stan: opcje.stan } : {}),
      // AC-14: szukanie obejmuje TRANSKRYPCJĘ, nie tylko tytuł — o to w tym module chodzi.
      // Zapytanie wspiera indeks trigramowy z migracji 0262.
      ...(szukaj
        ? {
            OR: [
              { title: { contains: szukaj, mode: "insensitive" as const } },
              { transkrypcja: { contains: szukaj, mode: "insensitive" as const } },
            ],
          }
        : {}),
    },
    orderBy:
      opcje?.sort === "warto"
        // Filmy bez oceny na koniec — „nieocenione" to nie to samo co „nie warto".
        ? [{ ocena: { sort: "desc", nulls: "last" } }, { publishedAt: "desc" }]
        : [{ publishedAt: "desc" }],
    include: { channel: { select: { id: true, title: true } } },
  });

  return rows.map(naDto);
}

export async function getFilm(videoId: string): Promise<FilmSzczegolDTO | null> {
  const user = await requireAuth();
  const moje = await filtrMoichRekordow(user.id);
  const r = await prisma.youtubeVideo.findUnique({
    where: { workspaceId_videoId: { ...moje, videoId } },
    include: { channel: { select: { id: true, title: true } } },
  });
  if (!r) return null;
  return {
    ...naDto(r),
    transkrypcja: r.transkrypcja,
    transkrypcjaJezyk: r.transkrypcjaJezyk,
    adresYoutube: adresFilmu(r.videoId),
  };
}

export async function ustawStan(videoId: string, stan: StanFilmu): Promise<void> {
  const user = await requireAuth();
  const moje = await filtrMoichRekordow(user.id);
  // `updateMany` z filtrem przestrzeni jest jednocześnie strażnikiem: cudzy film nie pasuje do
  // warunku, więc nie ma jak go zmienić, i nie trzeba osobnego odczytu „czy mój".
  await prisma.youtubeVideo.updateMany({ where: { ...moje, videoId }, data: { stan } });
  revalidatePath("/youtube");
}

export async function odswiezYoutube(): Promise<{ jobId: string }> {
  const user = await requireAuth();
  const job = await enqueue(
    "youtube.refresh",
    {},
    { ownerId: user.id, dedupeKey: `youtube.refresh:${user.id}`, maxActivePerOwner: MAX_ACTIVE_JOBS_PER_OWNER }
  );
  // Worker startuje leniwie i tylko z tras `/api/jobs`; ta ścieżka je omija, więc bez tego
  // wywołania zadanie zostałoby w kolejce, a pasek pokazywałby „Odświeżam…" w nieskończoność.
  ensureJobWorker();
  return { jobId: job.id };
}

export type StanOdswiezania = {
  jobId: string;
  status: string;
  progress: string | null;
  error: string | null;
  startedAt: string;
};

export async function getStanOdswiezania(): Promise<StanOdswiezania | null> {
  const user = await requireAuth();
  ensureJobWorker();
  const job = await prisma.job.findFirst({
    // `Job` należy do PIĘCIU tabel, które zostały przy `ownerId` (`workspace-nullable.json`) —
    // zadanie w tle bywa systemowe, więc przestrzeni nie ma. Użycie tu `filtrMoichRekordow`
    // odrzuciłaby Prisma („Unknown argument workspaceId") przy każdym wywołaniu (lekcja z 098).
    where: { ownerId: user.id, type: "youtube.refresh" },
    orderBy: { createdAt: "desc" },
  });
  if (!job) return null;
  return {
    jobId: job.id,
    status: job.status,
    progress: job.progress,
    error: job.error,
    startedAt: job.createdAt.toISOString(),
  };
}
