"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/platform/db/prisma";
import { requireAuth } from "@/platform/auth/serverUtils";
import { SUFIT_LISTY } from "@/platform/pagination";
import { assertMozeRozmawiac, assertUczestnik, idPowiazanychOsob, widoczneRozmowyWhere } from "../lib/dostep";
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
  // paginacja: kompletny — porównujemy PEŁNE zbiory; ucięcie jednego z nich udawałoby rozjazd.
  const moje = await prisma.chatParticipant.findMany({
    where: { userId, conversation: { rodzaj: "zespol" } },
    select: { id: true, conversation: { select: { workspaceId: true } } },
  });

  const powinienem = new Set(czlonkostwa.map((c) => c.workspaceId));
  const mam = new Set(moje.map((m) => m.conversation.workspaceId).filter((id): id is string => id !== null));

  // Nadmiar: uczestnictwo w kanale zespołu, do którego już nie należę. Widoczności to i tak nie daje
  // (rozstrzyga ją `widoczneRozmowyWhere`), ale wiersz zostawiony na zawsze fałszowałby porównanie
  // poniżej i kazał uzgadniać kanały przy każdym odczycie. Sprzątamy więc przy okazji.
  const zbedne = moje.filter((m) => !m.conversation.workspaceId || !powinienem.has(m.conversation.workspaceId));
  if (zbedne.length > 0) {
    await prisma.chatParticipant.deleteMany({ where: { id: { in: zbedne.map((z) => z.id) } } });
  }

  // Braki: zespół bez mojego kanału. W zwykłym przebiegu ta pętla nie wykonuje ani jednej iteracji,
  // więc `getRozmowy` — wołane przy KAŻDYM sygnale z czatu — przestaje pisać do bazy (U-3).
  const brakujace = czlonkostwa.filter((c) => !mam.has(c.workspaceId));
  for (const cz of brakujace) {
    // `upsert` na indeksie unikalnym, nie sprawdzenie „czy istnieje": dwie równoległe karty
    // założyłyby dwa kanały dla tej samej przestrzeni.
    const rozmowa = await prisma.chatConversation.upsert({
      where: { workspaceId: cz.workspaceId },
      create: { rodzaj: "zespol", workspaceId: cz.workspaceId, tytul: cz.workspace.name },
      update: {},
      select: { id: true },
    });
    // Członek dołączony do zespołu później ma zastać kanał, w którym już jest, a nie kanał,
    // do którego ktoś musi go wpuścić.
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
    // Kanał zespołu wymaga AKTUALNEGO członkostwa, nie tylko wiersza uczestnictwa (U-1).
    where: widoczneRozmowyWhere(user.id),
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

/**
 * Ile rozmów ma dla mnie coś nowego — liczba dla odznaki w chromie.
 *
 * **Stała liczba zapytań, niezależnie od liczby rozmów** (U-2 z recenzji 107). `IkonaCzatu` montuje
 * się w powłoce, czyli na KAŻDEJ trasie aplikacji — pierwsza wersja wołała `count` osobno dla każdej
 * rozmowy, więc konto z dwudziestoma rozmowami płaciło dwadzieścia jeden zapytań za wejście na
 * `/tasks`. To nie był koszt czatu, tylko koszt całej aplikacji.
 *
 * Odznaka liczy **rozmowy**, nie wiadomości, więc dokładna liczba wiadomości jest tu niepotrzebna —
 * wystarczy NAJNOWSZA cudza wiadomość w każdej rozmowie, a to jedno `groupBy`.
 */
export async function getLicznikNieprzeczytanych(): Promise<number> {
  const user = await requireAuth();
  // paginacja: kompletny — to jest LICZBA rozmów z nowościami; ucięcie dałoby zaniżoną odznakę.
  const widoczne = await prisma.chatConversation.findMany({
    where: widoczneRozmowyWhere(user.id),
    select: { id: true, uczestnicy: { where: { userId: user.id }, select: { przeczytaneDo: true } } },
  });
  if (widoczne.length === 0) return 0;

  const najnowsze = await prisma.chatMessage.groupBy({
    by: ["conversationId"],
    where: {
      conversationId: { in: widoczne.map((r) => r.id) },
      deletedAt: null,
      autorId: { not: user.id },
    },
    _max: { createdAt: true },
  });
  const ostatnia = new Map(najnowsze.map((g) => [g.conversationId, g._max.createdAt]));

  return widoczne.filter((r) => {
    const cudza = ostatnia.get(r.id);
    if (!cudza) return false;
    const przeczytaneDo = r.uczestnicy[0]?.przeczytaneDo ?? null;
    // Brak znacznika znaczy „nie otwierałem tej rozmowy" — wtedy nowe jest wszystko cudze.
    return przeczytaneDo === null || cudza > przeczytaneDo;
  }).length;
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
