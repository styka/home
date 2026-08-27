"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/platform/db/prisma";
import { requireAuth } from "@/platform/auth/serverUtils";
import { SUFIT_LISTY } from "@/platform/pagination";
import { assertMozeRozmawiac, assertUczestnik, idPowiazanychOsob } from "../lib/dostep";
import { etykietaRozmowy, nazwaOsoby, piszacy, type UczestnikRozmowy } from "../domain/rozmowa";

/** Rozmowa tak, jak widzi ją lista. Daty jako tekst — DTO przekracza granicę serwer→klient. */
export interface RozmowaDTO {
  id: string;
  rodzaj: "prywatna" | "zespol";
  etykieta: string;
  ostatniaAktywnosc: string;
  ostatniaWiadomosc: string | null;
  nieprzeczytane: number;
}

export interface UczestnikDTO {
  userId: string;
  nazwa: string;
  avatarUrl: string | null;
  przeczytaneDo: string | null;
}

export interface SzczegolRozmowyDTO {
  id: string;
  rodzaj: "prywatna" | "zespol";
  etykieta: string;
  /**
   * Kim jestem w tej rozmowie. Bez tego widok nie umie odróżnić własnej wiadomości od cudzej —
   * a od tego zależy, czy w ogóle pokazać przycisk edycji i czy „przeczytano” jest informacją
   * dla mnie, czy o mnie. Wyliczamy to na SERWERZE, z sesji.
   */
  jaId: string;
  uczestnicy: UczestnikDTO[];
  /** Nazwy osób, które piszą w tej chwili (bez mojej). */
  piszacy: string[];
}

/** Osoba, do której wolno napisać. */
export interface RozmowcaDTO {
  userId: string;
  nazwa: string;
  avatarUrl: string | null;
}

const BEZ_ROZMOWCY = "Rozmowa bez uczestnika";

/**
 * Zapewnia kanał dla każdego zespołu, do którego użytkownik należy, i dopisuje go do uczestników.
 *
 * **Kanał zespołu nie jest zakładany ręcznie** (AC-14): zespół JEST grupą ludzi, więc osobne
 * „załóż kanał” byłoby pytaniem o rzecz, która już została rozstrzygnięta. Operacja jest
 * idempotentna — stoi na indeksie unikalnym `workspaceId`, a nie na sprawdzeniu „czy istnieje”,
 * które przy dwóch równoległych kartach założyłoby dwa kanały.
 */
async function zapewnijKanalyZespolow(userId: string): Promise<void> {
  // paginacja: kompletny — członkostwa wyznaczają, które kanały mają istnieć; ucięcie ukryłoby zespół.
  const czlonkostwa = await prisma.workspaceMember.findMany({
    where: { userId, workspace: { kind: "team" } },
    select: { workspaceId: true, workspace: { select: { name: true } } },
  });

  for (const cz of czlonkostwa) {
    const rozmowa = await prisma.chatConversation.upsert({
      where: { workspaceId: cz.workspaceId },
      create: { rodzaj: "zespol", workspaceId: cz.workspaceId, tytul: cz.workspace.name },
      update: {},
      select: { id: true },
    });
    // Dopisanie uczestnika też przez `upsert` — członek dołączony do zespołu później ma zastać
    // kanał, w którym już jest, a nie kanał, do którego ktoś musi go wpuścić.
    await prisma.chatParticipant.upsert({
      where: { conversationId_userId: { conversationId: rozmowa.id, userId } },
      create: { conversationId: rozmowa.id, userId },
      update: {},
    });
  }
}

/** Lista rozmów użytkownika: kanały zespołów i rozmowy prywatne, świeże na górze. */
export async function getRozmowy(): Promise<RozmowaDTO[]> {
  const user = await requireAuth();
  await zapewnijKanalyZespolow(user.id);

  const rozmowy = await prisma.chatConversation.findMany({
    where: { uczestnicy: { some: { userId: user.id } } },
    orderBy: { ostatniaAktywnosc: "desc" },
    take: SUFIT_LISTY,
    include: {
      uczestnicy: { select: { userId: true, przeczytaneDo: true, pisalAt: true, user: { select: { name: true, email: true } } } },
      wiadomosci: {
        where: { deletedAt: null },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { tresc: true },
      },
    },
  });

  // Nieprzeczytane liczymy zapytaniem zbiorczym, nie pobraniem wiadomości: rozmowa z trzyletnią
  // historią nie może kosztować przy każdym renderze listy tyle, co jej otwarcie.
  const liczby = await Promise.all(
    rozmowy.map(async (r) => {
      const moje = r.uczestnicy.find((u) => u.userId === user.id);
      return prisma.chatMessage.count({
        where: {
          conversationId: r.id,
          deletedAt: null,
          autorId: { not: user.id },
          ...(moje?.przeczytaneDo ? { createdAt: { gt: moje.przeczytaneDo } } : {}),
        },
      });
    }),
  );

  return rozmowy.map((r, i) => ({
    id: r.id,
    rodzaj: r.rodzaj === "zespol" ? "zespol" : "prywatna",
    etykieta: etykietaRozmowy(
      { rodzaj: r.rodzaj, tytul: r.tytul },
      r.uczestnicy.map((u) => ({ userId: u.userId, nazwa: nazwaOsoby(u.user, BEZ_ROZMOWCY), przeczytaneDo: u.przeczytaneDo, pisalAt: u.pisalAt })),
      user.id,
      BEZ_ROZMOWCY,
    ),
    ostatniaAktywnosc: r.ostatniaAktywnosc.toISOString(),
    ostatniaWiadomosc: r.wiadomosci[0]?.tresc ?? null,
    nieprzeczytane: liczby[i],
  }));
}

/** Nagłówek jednej rozmowy: uczestnicy, ich stan odczytu i kto pisze w tej chwili. */
export async function getRozmowa(rozmowaId: string): Promise<SzczegolRozmowyDTO> {
  const user = await requireAuth();
  await assertUczestnik(user.id, rozmowaId);

  const rozmowa = await prisma.chatConversation.findUniqueOrThrow({
    where: { id: rozmowaId },
    include: {
      uczestnicy: {
        select: {
          userId: true, przeczytaneDo: true, pisalAt: true,
          user: { select: { name: true, email: true, avatarUrl: true } },
        },
      },
    },
  });

  const uczestnicy: UczestnikRozmowy[] = rozmowa.uczestnicy.map((u) => ({
    userId: u.userId,
    nazwa: nazwaOsoby(u.user, BEZ_ROZMOWCY),
    przeczytaneDo: u.przeczytaneDo,
    pisalAt: u.pisalAt,
  }));

  return {
    id: rozmowa.id,
    rodzaj: rozmowa.rodzaj === "zespol" ? "zespol" : "prywatna",
    etykieta: etykietaRozmowy({ rodzaj: rozmowa.rodzaj, tytul: rozmowa.tytul }, uczestnicy, user.id, BEZ_ROZMOWCY),
    jaId: user.id,
    uczestnicy: rozmowa.uczestnicy.map((u) => ({
      userId: u.userId,
      nazwa: nazwaOsoby(u.user, BEZ_ROZMOWCY),
      avatarUrl: u.user.avatarUrl,
      przeczytaneDo: u.przeczytaneDo?.toISOString() ?? null,
    })),
    piszacy: piszacy(uczestnicy, user.id, new Date()),
  };
}

/**
 * Osoby, do których wolno napisać: wspólny zespół albo udostępniony zasób.
 *
 * Lista NIE jest katalogiem kont w systemie — otwarta lista wszystkich użytkowników to zupełnie
 * inna decyzja produktowa niż komunikator dla domowników (AC-15).
 */
export async function getRozmowcy(): Promise<RozmowcaDTO[]> {
  const user = await requireAuth();
  const powiazani = await idPowiazanychOsob(user.id);
  if (powiazani.size === 0) return [];

  const osoby = await prisma.user.findMany({
    // `Array.from`, nie `[...set]`: główny `tsconfig.json` nie ustawia `target`, więc spread
    // iterowalnego wymagałby `downlevelIteration`. `tsconfig.test.json` ma ES2022 i tego NIE
    // wyłapie — czerwieni się dopiero `next build` (wpis z 2026-06-03).
    where: { id: { in: Array.from(powiazani) } },
    select: { id: true, name: true, email: true, avatarUrl: true },
    orderBy: { name: "asc" },
    take: SUFIT_LISTY,
  });
  return osoby.map((o) => ({ userId: o.id, nazwa: nazwaOsoby(o, BEZ_ROZMOWCY), avatarUrl: o.avatarUrl }));
}

/** Ile rozmów ma dla mnie coś nowego — liczba dla odznaki w chromie. */
export async function getLicznikNieprzeczytanych(): Promise<number> {
  const user = await requireAuth();
  // paginacja: kompletny — to jest LICZBA rozmów z nowościami; ucięcie dałoby zaniżoną odznakę.
  const moje = await prisma.chatParticipant.findMany({
    where: { userId: user.id },
    select: { conversationId: true, przeczytaneDo: true },
  });
  if (moje.length === 0) return 0;

  const wyniki = await Promise.all(
    moje.map((m) =>
      prisma.chatMessage.count({
        where: {
          conversationId: m.conversationId,
          deletedAt: null,
          autorId: { not: user.id },
          ...(m.przeczytaneDo ? { createdAt: { gt: m.przeczytaneDo } } : {}),
        },
        take: 1,
      }),
    ),
  );
  return wyniki.filter((n) => n > 0).length;
}

/** Znajduje albo zakłada rozmowę 1:1 z osobą, z którą coś mnie łączy. Zwraca jej identyfikator. */
export async function otworzRozmowePrywatna(drugiId: string): Promise<string> {
  const user = await requireAuth();
  await assertMozeRozmawiac(user.id, drugiId);

  // Istniejąca rozmowa: prywatna, w której jesteśmy oboje. Szukamy po uczestnictwie obu stron,
  // a nie po parze identyfikatorów w kolumnach — para nie ma tu ustalonej kolejności.
  const istniejaca = await prisma.chatConversation.findFirst({
    where: {
      rodzaj: "prywatna",
      AND: [
        { uczestnicy: { some: { userId: user.id } } },
        { uczestnicy: { some: { userId: drugiId } } },
      ],
    },
    select: { id: true },
  });
  if (istniejaca) return istniejaca.id;

  const rozmowa = await prisma.chatConversation.create({
    data: {
      rodzaj: "prywatna",
      uczestnicy: { create: [{ userId: user.id }, { userId: drugiId }] },
    },
    select: { id: true },
  });
  revalidatePath("/czat");
  return rozmowa.id;
}

/**
 * Oznacza rozmowę jako przeczytaną do teraz i gasi jej zbiorczy sygnał w skrzynce.
 *
 * Powiadomienie gasimy **tym samym kluczem**, którym je tworzymy (`czat-<rozmowaId>`) — jedna
 * pozycja na rozmowę, więc jedno oznaczenie wystarczy, żeby licznik nie wrócił po zmianie ekranu
 * (AC-17, AC-27).
 */
export async function oznaczPrzeczytane(rozmowaId: string): Promise<void> {
  const user = await requireAuth();
  await assertUczestnik(user.id, rozmowaId);
  await prisma.chatParticipant.update({
    where: { conversationId_userId: { conversationId: rozmowaId, userId: user.id } },
    data: { przeczytaneDo: new Date() },
  });
  await prisma.notification.updateMany({
    where: { userId: user.id, dedupeKey: `czat-${rozmowaId}`, readAt: null },
    data: { readAt: new Date() },
  });
  revalidatePath("/czat");
}

/**
 * Sygnał „piszę”. Klient dławi to do jednego wywołania na kilka sekund; wygaszanie robi TTL przy
 * ODCZYCIE (`czyPisze`), więc nie ma tu nic do posprzątania w tle.
 *
 * Świadomie BEZ `revalidatePath`: to jest stan ulotny, a przeliczanie strony przy każdym uderzeniu
 * w klawiaturę byłoby kosztem bez pokrycia. Rozmówca zobaczy wskaźnik przy najbliższym odczycie
 * rozmowy, który i tak wywołuje sygnał wysyłki.
 */
export async function zglosPisanie(rozmowaId: string): Promise<void> {
  const user = await requireAuth();
  await assertUczestnik(user.id, rozmowaId);
  await prisma.chatParticipant.update({
    where: { conversationId_userId: { conversationId: rozmowaId, userId: user.id } },
    data: { pisalAt: new Date() },
  });
}
