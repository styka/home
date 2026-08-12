import * as React from "react";
import { getUserTeamIds } from "@/platform/auth/serverUtils";
import { prisma } from "@/platform/db/prisma";
import type { AccessContext } from "./types";

/**
 * Faza 2 przebudowy, zadanie 10 — CACHE PER ŻĄDANIE (rozdz. 8.9 pkt 2).
 *
 * `requireAccess` siedzi na ścieżce **każdego** żądania, a jedna akcja potrafi sprawdzić ten sam
 * zasób kilka razy (guard w akcji, potem guard w funkcji, którą ona woła). Bez memoizacji każde
 * sprawdzenie to komplet zapytań od nowa.
 *
 * **Dlaczego `React.cache`, a nie własna mapa.** Jego zakres to dokładnie jedno żądanie — czyli
 * dokładnie to, czego wymaga dokument. Własny cache trzeba by unieważniać, a unieważnianie
 * zdarzeniem (rozdz. 8.9 pkt 3) wymaga warstwy zdarzeń z Fazy 4. Cache, który znika razem
 * z żądaniem, **nie ma czego unieważniać** — problem nie powstaje, zamiast być rozwiązywany
 * mechanizmem, którego jeszcze nie ma.
 *
 * **Poza kontekstem żądania** (zadanie w tle, skrypt, test) `React.cache` NIE degraduje się sam —
 * w środowisku bez runtime'u React nie jest nawet funkcją i wywołanie kończy się
 * `cache is not a function`. Sprawdziliśmy to testem i dlatego degradacja jest tu **napisana
 * wprost**: gdy `cache` nie istnieje, `perRequest` zwraca funkcję niezmienioną. Bez tego
 * `requireAccess` wywalałby każde zadanie w tle i każdy skrypt — czyli zdanie „cache działa" byłoby
 * prawdziwe wyłącznie tam, gdzie i tak nic by się nie stało.
 */

/**
 * Memoizacja na czas żądania, jeśli środowisko ją ma; w przeciwnym razie funkcja bez zmian.
 * Zawężone do jednego argumentu, bo tyle wystarcza i tyle da się bezpiecznie otypować.
 */
function perRequest<A, R>(fn: (a: A) => Promise<R>): (a: A) => Promise<R> {
  const maybeCache = (React as { cache?: <T>(f: T) => T }).cache;
  return typeof maybeCache === "function" ? maybeCache(fn) : fn;
}

/**
 * Kontekst użytkownika liczony **raz na żądanie**: zespoły i przestrzenie. Bez tego każde
 * sprawdzenie dostępu odpytywałoby o członkostwa od nowa.
 */
export const getAccessContext = perRequest(async (userId: string): Promise<AccessContext> => {
  const [teamIds, workspaces, czlonkostwa] = await Promise.all([
    getUserTeamIds(userId),
    prisma.workspaceMember.findMany({ where: { userId }, select: { workspaceId: true } }),
    // 053: role w zespołach — właściciel/admin dostaje wyższą rolę na zasobach zespołu niż zwykły
    // członek. Czytamy je RAZEM z resztą kontekstu, żeby nie dokładać zapytania na sprawdzenie.
    prisma.teamMember.findMany({
      where: { userId, role: { in: ["OWNER", "ADMIN"] } },
      select: { teamId: true },
    }),
  ]);
  return {
    teamIds,
    adminTeamIds: czlonkostwa.map((m) => m.teamId),
    workspaceIds: workspaces.map((w) => w.workspaceId),
  };
});
