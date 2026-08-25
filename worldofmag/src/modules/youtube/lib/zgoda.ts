import { randomBytes } from "crypto";
import { prisma } from "@/platform/db/prisma";
import {
  buildConsentUrl,
  exchangeCode,
  fetchAccountEmail,
  zaszyfrujToken,
  YOUTUBE_CALLBACK_PATH,
  YOUTUBE_STATE_COOKIE,
} from "./oauth";

/**
 * 102 — PRZEPŁYW ZGODY W DWÓCH FUNKCJACH, po jednej na trasę.
 *
 * Trasy w `src/app/` mają być **cienkie** (C-36) i widzieć moduł wyłącznie przez kontrakt. Gdyby
 * kontrakt wystawiał zamiast tego mechanikę OAuth (budowanie adresu, wymianę kodu, szyfrowanie
 * tokenu), trasa musiałaby znać kolejność tych kroków — czyli logika modułu mieszkałaby w `app/`.
 * Tutaj trasa robi wyłącznie to, czego moduł zrobić nie może: ustawia ciasteczko i przekierowuje.
 */

export { YOUTUBE_STATE_COOKIE } from "./oauth";

export interface PrzygotowanaZgoda {
  url: string;
  state: string;
}

/** Buduje adres ekranu zgody i losuje stan chroniący przed CSRF. */
export function przygotujZgode(origin: string): PrzygotowanaZgoda {
  const state = randomBytes(16).toString("hex");
  const redirectUri = new URL(YOUTUBE_CALLBACK_PATH, origin).toString();
  return { url: buildConsentUrl(state, redirectUri), state };
}

export type WynikZgody = "ok" | "stan" | "anulowano" | "wymiana";

/**
 * Domyka zgodę: sprawdza stan, wymienia kod na tokeny i zapisuje połączenie.
 *
 * Porównanie stanu jest właściwym zabezpieczeniem przed CSRF — bez niego ktoś mógłby podstawić
 * WŁASNY kod autoryzacyjny i podpiąć swoje konto YouTube pod cudzą przestrzeń.
 */
export async function zapiszZgode(args: {
  userId: string;
  code: string | null;
  state: string | null;
  oczekiwanyStan: string | undefined;
  origin: string;
}): Promise<WynikZgody> {
  const { userId, code, state, oczekiwanyStan, origin } = args;
  if (!code || !state || !oczekiwanyStan || state !== oczekiwanyStan) return "stan";

  const redirectUri = new URL(YOUTUBE_CALLBACK_PATH, origin).toString();
  const tokeny = await exchangeCode(code, redirectUri);
  const email = await fetchAccountEmail(tokeny.accessToken);

  await prisma.youtubeConnection.upsert({
    where: { userId },
    create: {
      userId,
      email,
      refreshToken: zaszyfrujToken(tokeny.refreshToken),
      accessToken: zaszyfrujToken(tokeny.accessToken),
      accessTokenExpiresAt: tokeny.expiresAt,
    },
    update: {
      email,
      // Przy ponownym łączeniu Google nie zawsze zwraca token odświeżający — wtedy zostawiamy
      // dotychczasowy, zamiast nadpisać go pustą wartością i zerwać połączenie.
      ...(tokeny.refreshToken ? { refreshToken: zaszyfrujToken(tokeny.refreshToken) } : {}),
      accessToken: zaszyfrujToken(tokeny.accessToken),
      accessTokenExpiresAt: tokeny.expiresAt,
    },
  });

  return "ok";
}
