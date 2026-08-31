/**
 * 117 (naprawa po 116): reguły zapisu/widoku skórek wyprowadzone z plików `"use server"`.
 * Bramka `check:domain` (zadanie 19) trzyma zapadkę pomocników w plikach akcji — funkcja w pliku
 * `"use server"` jest niesprawdzalna testem, bo nie da się jej stamtąd wyeksportować. 116 dodał
 * `poleSkorki` i `toView` assetów w akcjach i zapadka pękła (36 > 33); tu obie są eksportowalne.
 */

import { validateTokens, type SkinTokens } from "@/lib/skins";
import { walidujDefinicje, type SkinKind } from "@/lib/skins/zaawansowane";

/** Wspólne wyprowadzenie pól zapisu z wejścia (116): definicja → kind/definition/tokens. */
export function poleSkorki(input: { tokens: SkinTokens; definition?: unknown }): {
  kind: SkinKind;
  definition: string | null;
  tokens: string;
} {
  if (input.definition === undefined || input.definition === null) {
    return { kind: "simple", definition: null, tokens: JSON.stringify(validateTokens(input.tokens)) };
  }
  const { definicja } = walidujDefinicje(input.definition);
  return {
    kind: "advanced",
    definition: JSON.stringify(definicja),
    tokens: JSON.stringify(definicja.tokens ?? {}),
  };
}

/** Wiersz `SkinAsset` z bazy → widok dla klienta (116). Kształt = `SkinAssetView` z akcji. */
export function widokAssetuSkorki(
  a: { id: string; name: string; kind: string; mimeType: string; size: number; hash: string; ownerId: string | null; ownerTeamId: string | null; createdAt: Date },
  userId: string,
  isAdmin: boolean,
): {
  id: string;
  name: string;
  kind: string;
  mimeType: string;
  size: number;
  hash: string;
  isSystem: boolean;
  isOwn: boolean;
  createdAt: string;
} {
  const isSystem = a.ownerId === null && a.ownerTeamId === null;
  return {
    id: a.id,
    name: a.name,
    kind: a.kind,
    mimeType: a.mimeType,
    size: a.size,
    hash: a.hash,
    isSystem,
    isOwn: a.ownerId === userId || (isSystem && isAdmin),
    createdAt: a.createdAt.toISOString(),
  };
}
