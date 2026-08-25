import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/platform/auth/session";
import { prisma } from "@/platform/db/prisma";
import { logEvent } from "@/platform/observability/log";
import {
  exchangeCode,
  fetchAccountEmail,
  zaszyfrujToken,
  YOUTUBE_CALLBACK_PATH,
  YOUTUBE_STATE_COOKIE,
} from "@/lib/youtube/oauth";

/**
 * 102 (AC-3): powrót z ekranu zgody Google.
 *
 * Każde niepowodzenie kończy się powrotem na stronę kanałów z opisem w adresie, a nie białym
 * ekranem błędu: użytkownik jest w środku czynności („połącz konto"), więc ma wrócić tam, skąd ją
 * zaczął, i zobaczyć, co poszło nie tak.
 */
export async function GET(req: NextRequest) {
  const powrot = (blad?: string) =>
    NextResponse.redirect(new URL(`/youtube/kanaly${blad ? `?blad=${blad}` : ""}`, req.nextUrl.origin));

  const session = await auth();
  if (!session?.user?.id) return NextResponse.redirect(new URL("/auth/signin", req.url));

  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const oczekiwany = req.cookies.get(YOUTUBE_STATE_COOKIE)?.value;

  // Użytkownik mógł po prostu kliknąć „anuluj" na ekranie Google — to nie jest błąd aplikacji.
  if (req.nextUrl.searchParams.get("error")) return powrot("anulowano");

  // Porównanie stanu jest właściwym zabezpieczeniem przed CSRF: bez niego ktoś mógłby podstawić
  // WŁASNY kod autoryzacyjny i podpiąć swoje konto YouTube pod cudzą przestrzeń.
  if (!code || !state || !oczekiwany || state !== oczekiwany) return powrot("stan");

  try {
    const redirectUri = new URL(YOUTUBE_CALLBACK_PATH, req.nextUrl.origin).toString();
    const tokeny = await exchangeCode(code, redirectUri);
    const email = await fetchAccountEmail(tokeny.accessToken);

    await prisma.youtubeConnection.upsert({
      where: { userId: session.user.id },
      create: {
        userId: session.user.id,
        email,
        refreshToken: zaszyfrujToken(tokeny.refreshToken),
        accessToken: zaszyfrujToken(tokeny.accessToken),
        accessTokenExpiresAt: tokeny.expiresAt,
      },
      update: {
        email,
        // Przy ponownym łączeniu Google nie zawsze zwraca token odświeżający — wtedy zostawiamy
        // dotychczasowy, zamiast nadpisać go wartością pustą i zerwać połączenie.
        ...(tokeny.refreshToken ? { refreshToken: zaszyfrujToken(tokeny.refreshToken) } : {}),
        accessToken: zaszyfrujToken(tokeny.accessToken),
        accessTokenExpiresAt: tokeny.expiresAt,
      },
    });

    const res = powrot();
    res.cookies.delete(YOUTUBE_STATE_COOKIE);
    return res;
  } catch (e) {
    // Bez wartości tokenu w logu (C-41) — wyłącznie fakt niepowodzenia.
    logEvent("warn", "youtube.polaczenie.blad", { powod: e instanceof Error ? e.message : "nieznany" });
    return powrot("wymiana");
  }
}
