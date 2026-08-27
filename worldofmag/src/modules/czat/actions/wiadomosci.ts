"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/platform/db/prisma";
import { requireAuth } from "@/platform/auth/serverUtils";
import { stronaZWierszy, zapytanieKursorowe } from "@/platform/pagination";
import { notifyUser } from "@/lib/notify";
import { recordTrash } from "@/platform/trash/trash";
import { assertAutor, assertUczestnik } from "../lib/dostep";
import { sygnalRozmowy } from "../lib/sygnal";

/** Maksymalna długość wiadomości — bezpiecznik, nie funkcja produktowa. */
const MAKS_DLUGOSC = 4000;

export interface ReakcjaDTO {
  emoji: string;
  ile: number;
  /** Czy TA reakcja jest moja — przycisk musi umieć powiedzieć, że kolejne kliknięcie ją cofnie. */
  moja: boolean;
}

export interface WiadomoscDTO {
  id: string;
  autorId: string;
  autor: string;
  tresc: string;
  createdAt: string;
  editedAt: string | null;
  usunieta: boolean;
  odpowiedzNa: { id: string; autor: string; tresc: string } | null;
  reakcje: ReakcjaDTO[];
}

export interface StronaWiadomosci {
  pozycje: WiadomoscDTO[];
  jestWiecej: boolean;
  nastepnyKursor: string | null;
}

function nazwaOsoby(u: { name: string | null; email: string | null } | null): string {
  return u?.name ?? u?.email ?? "—";
}

/** Treść usuniętej wiadomości nigdy nie opuszcza serwera — cytat też jej nie zdradza. */
const USUNIETA = "";

/**
 * Strona wiadomości, od najnowszych. Paginacja **kursorowa** — rozmowa rośnie latami, a widok
 * doczytuje starsze przy przewijaniu w górę (AC-26).
 */
export async function getWiadomosci(
  rozmowaId: string,
  kursor?: string | null,
  rozmiar?: number | null,
): Promise<StronaWiadomosci> {
  const user = await requireAuth();
  await assertUczestnik(user.id, rozmowaId);

  const wiersze = await prisma.chatMessage.findMany({
    where: { conversationId: rozmowaId },
    orderBy: { createdAt: "desc" },
    ...zapytanieKursorowe({ kursor, rozmiar }),
    include: {
      autor: { select: { name: true, email: true } },
      odpowiedzNa: { select: { id: true, tresc: true, deletedAt: true, autor: { select: { name: true, email: true } } } },
      reakcje: { select: { emoji: true, userId: true }, take: 200 },
    },
  });

  const strona = stronaZWierszy(wiersze, rozmiar);
  return {
    jestWiecej: strona.jestWiecej,
    nastepnyKursor: strona.nastepnyKursor,
    pozycje: strona.pozycje.map((w) => {
      const grupy = new Map<string, { ile: number; moja: boolean }>();
      for (const r of w.reakcje) {
        const g = grupy.get(r.emoji) ?? { ile: 0, moja: false };
        grupy.set(r.emoji, { ile: g.ile + 1, moja: g.moja || r.userId === user.id });
      }
      return {
        id: w.id,
        autorId: w.autorId,
        autor: nazwaOsoby(w.autor),
        tresc: w.deletedAt ? USUNIETA : w.tresc,
        createdAt: w.createdAt.toISOString(),
        editedAt: w.editedAt?.toISOString() ?? null,
        usunieta: w.deletedAt !== null,
        odpowiedzNa: w.odpowiedzNa
          ? {
              id: w.odpowiedzNa.id,
              autor: nazwaOsoby(w.odpowiedzNa.autor),
              tresc: w.odpowiedzNa.deletedAt ? USUNIETA : w.odpowiedzNa.tresc,
            }
          : null,
        reakcje: [...grupy.entries()].map(([emoji, g]) => ({ emoji, ile: g.ile, moja: g.moja })),
      };
    }),
  };
}

/**
 * Wysyła wiadomość: zapis, podbicie aktywności rozmowy, sygnał do otwartych kart i **jeden
 * zbiorczy wpis w skrzynce na rozmowę** dla pozostałych uczestników.
 *
 * Zbiorczość jest tu regułą, nie oszczędnością (AC-27): pozycja na każdą wiadomość zamieniłaby
 * skrzynkę w drugi, gorszy widok rozmowy. Klucz `czat-<rozmowaId>` jest jednocześnie tym, którym
 * `oznaczPrzeczytane` tę pozycję gasi.
 */
export async function wyslijWiadomosc(
  rozmowaId: string,
  tresc: string,
  odpowiedzNaId?: string | null,
): Promise<void> {
  const user = await requireAuth();
  await assertUczestnik(user.id, rozmowaId);

  const czysta = tresc.trim().slice(0, MAKS_DLUGOSC);
  if (!czysta) return;

  // Cytat musi pochodzić z TEJ rozmowy — inaczej dałoby się przenieść fragment cudzej.
  let cytat: string | null = null;
  if (odpowiedzNaId) {
    const zrodlo = await prisma.chatMessage.findFirst({
      where: { id: odpowiedzNaId, conversationId: rozmowaId },
      select: { id: true },
    });
    cytat = zrodlo?.id ?? null;
  }

  const teraz = new Date();
  await prisma.$transaction([
    prisma.chatMessage.create({
      data: { conversationId: rozmowaId, autorId: user.id, tresc: czysta, odpowiedzNaId: cytat },
    }),
    prisma.chatConversation.update({ where: { id: rozmowaId }, data: { ostatniaAktywnosc: teraz } }),
    // Wysłanie jest też przeczytaniem — bez tego nadawca podbijałby własny licznik.
    prisma.chatParticipant.update({
      where: { conversationId_userId: { conversationId: rozmowaId, userId: user.id } },
      data: { przeczytaneDo: teraz, pisalAt: null },
    }),
  ]);

  const rozmowa = await prisma.chatConversation.findUniqueOrThrow({
    where: { id: rozmowaId },
    select: {
      rodzaj: true,
      tytul: true,
      uczestnicy: { select: { userId: true, przeczytaneDo: true, user: { select: { name: true, email: true } } } },
    },
  });

  const nadawca = nazwaOsoby(rozmowa.uczestnicy.find((u) => u.userId === user.id)?.user ?? null);
  const skad = rozmowa.rodzaj === "zespol" && rozmowa.tytul ? rozmowa.tytul : nadawca;

  await Promise.all(
    rozmowa.uczestnicy
      .filter((u) => u.userId !== user.id)
      .map(async (u) => {
        const nowe = await prisma.chatMessage.count({
          where: {
            conversationId: rozmowaId,
            deletedAt: null,
            autorId: { not: u.userId },
            ...(u.przeczytaneDo ? { createdAt: { gt: u.przeczytaneDo } } : {}),
          },
        });
        await notifyUser({
          userId: u.userId,
          module: "czat",
          rodzaj: "relacja",
          title: nowe > 1 ? `${nowe} nowych wiadomości — ${skad}` : `Nowa wiadomość — ${skad}`,
          body: czysta.slice(0, 120),
          href: `/czat?r=${rozmowaId}`,
          dedupeKey: `czat-${rozmowaId}`,
          // Bez tego licznik zamarłby na pierwszej wiadomości: `upsert` bez aktualizacji nie
          // nadpisuje treści i nie przywraca pozycji do nieprzeczytanych.
          aktualizuj: true,
        });
      }),
  );

  sygnalRozmowy(rozmowaId, rozmowa.uczestnicy.map((u) => u.userId));
  revalidatePath("/czat");
}

/** Edycja WŁASNEJ wiadomości. Ślad edycji zostaje widoczny — cicha podmiana treści byłaby kłamstwem. */
export async function edytujWiadomosc(wiadomoscId: string, tresc: string): Promise<void> {
  const user = await requireAuth();
  const wiadomosc = await assertAutor(user.id, wiadomoscId);

  const czysta = tresc.trim().slice(0, MAKS_DLUGOSC);
  if (!czysta) return;

  await prisma.chatMessage.update({
    where: { id: wiadomoscId },
    data: { tresc: czysta, editedAt: new Date() },
  });
  await powiadomOZmianie(wiadomosc.conversationId);
}

/**
 * Usunięcie WŁASNEJ wiadomości: miękkie (C-24), z migawką w koszu.
 *
 * Wiersz zostaje, bo wiszą na nim cytaty w odpowiedziach — twarde usunięcie zabrałoby kontekst
 * cudzym wiadomościom. Treść przestaje opuszczać serwer natychmiast, także w cytacie.
 */
export async function usunWiadomosc(wiadomoscId: string): Promise<void> {
  const user = await requireAuth();
  const wiadomosc = await assertAutor(user.id, wiadomoscId);

  await recordTrash(user.id, {
    module: "czat",
    entityId: wiadomoscId,
    title: wiadomosc.tresc.slice(0, 80),
    payload: { id: wiadomoscId, conversationId: wiadomosc.conversationId, tresc: wiadomosc.tresc, autorId: user.id },
  });
  await prisma.chatMessage.update({ where: { id: wiadomoscId }, data: { deletedAt: new Date() } });
  await powiadomOZmianie(wiadomosc.conversationId);
}

/**
 * Dodaje albo cofa reakcję. Ta sama reakcja drugi raz jest jej cofnięciem (AC-23) — stoi to na
 * indeksie unikalnym, a nie na sprawdzeniu „czy istnieje”, które przy dwóch szybkich kliknięciach
 * zostawiłoby duplikat.
 */
export async function przelaczReakcje(wiadomoscId: string, emoji: string): Promise<void> {
  const user = await requireAuth();
  const wiadomosc = await prisma.chatMessage.findUnique({
    where: { id: wiadomoscId },
    select: { conversationId: true, deletedAt: true },
  });
  if (!wiadomosc || wiadomosc.deletedAt) throw new Error("Wiadomość nie istnieje");
  await assertUczestnik(user.id, wiadomosc.conversationId);

  const znak = emoji.slice(0, 8);
  const usuniete = await prisma.chatReaction.deleteMany({
    where: { messageId: wiadomoscId, userId: user.id, emoji: znak },
  });
  if (usuniete.count === 0) {
    await prisma.chatReaction.create({ data: { messageId: wiadomoscId, userId: user.id, emoji: znak } });
  }
  await powiadomOZmianie(wiadomosc.conversationId);
}

/** Wspólny ogon edycji/usunięcia/reakcji: sygnał do kart uczestników + unieważnienie ścieżki. */
async function powiadomOZmianie(rozmowaId: string): Promise<void> {
  // paginacja: kompletny — sygnał ma dojść do WSZYSTKICH uczestników; ucięcie to cicha luka.
  const uczestnicy = await prisma.chatParticipant.findMany({
    where: { conversationId: rozmowaId },
    select: { userId: true },
  });
  sygnalRozmowy(rozmowaId, uczestnicy.map((u) => u.userId));
  revalidatePath("/czat");
}
