import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/platform/auth/session";
import { logEvent } from "@/platform/observability/log";
import { zapiszZgode, YOUTUBE_STATE_COOKIE } from "@/modules/youtube/contract";

/**
 * 102 (AC-3): powrót z ekranu zgody Google.
 *
 * Każde niepowodzenie kończy się powrotem na stronę kanałów z powodem w adresie, a nie białym
 * ekranem błędu: użytkownik jest w środku czynności („połącz konto"), więc ma wrócić tam, skąd ją
 * zaczął, i zobaczyć, co poszło nie tak.
 */
export async function GET(req: NextRequest) {
  const powrot = (blad?: string) =>
    NextResponse.redirect(new URL(`/youtube/kanaly${blad ? `?blad=${blad}` : ""}`, req.nextUrl.origin));

  const session = await auth();
  if (!session?.user?.id) return NextResponse.redirect(new URL("/auth/signin", req.url));

  // Użytkownik mógł po prostu kliknąć „anuluj" na ekranie Google — to nie jest błąd aplikacji.
  if (req.nextUrl.searchParams.get("error")) return powrot("anulowano");

  try {
    const wynik = await zapiszZgode({
      userId: session.user.id,
      code: req.nextUrl.searchParams.get("code"),
      state: req.nextUrl.searchParams.get("state"),
      oczekiwanyStan: req.cookies.get(YOUTUBE_STATE_COOKIE)?.value,
      origin: req.nextUrl.origin,
    });
    if (wynik !== "ok") return powrot(wynik);

    const res = powrot();
    res.cookies.delete(YOUTUBE_STATE_COOKIE);
    return res;
  } catch (e) {
    // Bez wartości tokenu w logu (C-41) — wyłącznie fakt niepowodzenia.
    logEvent("warn", "youtube.polaczenie.blad", { powod: e instanceof Error ? e.message : "nieznany" });
    return powrot("wymiana");
  }
}
