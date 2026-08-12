import { cache } from "react";
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
 * **Poza kontekstem żądania** (zadanie w tle, skrypt, test) `React.cache` degraduje się do zwykłego
 * wywołania — nie rzuca. To jest sprawdzone testem, bo inaczej „cache działa" byłoby zdaniem
 * prawdziwym wyłącznie tam, gdzie i tak nic by się nie stało.
 */

/**
 * Kontekst użytkownika liczony **raz na żądanie**: zespoły i przestrzenie. Bez tego każde
 * sprawdzenie dostępu odpytywałoby o członkostwa od nowa.
 */
export const getAccessContext = cache(async (userId: string): Promise<AccessContext> => {
  const [teamIds, workspaces] = await Promise.all([
    getUserTeamIds(userId),
    prisma.workspaceMember.findMany({ where: { userId }, select: { workspaceId: true } }),
  ]);
  return { teamIds, workspaceIds: workspaces.map((w) => w.workspaceId) };
});
