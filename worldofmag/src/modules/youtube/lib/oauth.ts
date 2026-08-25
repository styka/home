/**
 * 102 (AC-3, AC-4) — OSOBNA, DOBROWOLNA ZGODA NA ODCZYT SUBSKRYPCJI YOUTUBE.
 *
 * Wzorzec przeniesiony z połączenia z Dyskiem (`src/lib/drive/oauth.ts`): logowanie do aplikacji
 * (NextAuth) prosi o minimalny zakres, a moduł, który potrzebuje więcej, prosi o to **osobno
 * i dopiero gdy użytkownik sam kliknie**. Ten sam klient Google, inny zakres.
 *
 * **Dlaczego nie rozszerzyć zakresu przy logowaniu:** wtedy KAŻDY użytkownik — także ten, który
 * nigdy nie otworzy tego modułu — musiałby przy pierwszym logowaniu zgodzić się na dostęp do
 * swojego YouTube'a. To jest zakres wrażliwy: przed udostępnieniem aplikacji szerokiej publiczności
 * Google będzie wymagać weryfikacji aplikacji. Moduł działa bez tej zgody (AC-2), więc jej brak
 * ogranicza wygodę, a nie użyteczność.
 */
import { encryptSecret, decryptSecret } from "@/lib/crypto/secrets";

/** Tylko odczyt: lista subskrypcji. Zapisu ani zarządzania kanałem nie potrzebujemy i nie prosimy. */
export const YOUTUBE_SCOPE = "https://www.googleapis.com/auth/youtube.readonly";

const AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const USERINFO_ENDPOINT = "https://www.googleapis.com/oauth2/v3/userinfo";
const SUBSCRIPTIONS_ENDPOINT = "https://www.googleapis.com/youtube/v3/subscriptions";

export const YOUTUBE_CALLBACK_PATH = "/api/youtube/callback";
export const YOUTUBE_STATE_COOKIE = "youtube_oauth_state";

export interface YoutubeTokens {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: Date;
}

export function buildConsentUrl(state: string, redirectUri: string): string {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID ?? "",
    redirect_uri: redirectUri,
    response_type: "code",
    scope: `openid email profile ${YOUTUBE_SCOPE}`,
    access_type: "offline",
    include_granted_scopes: "true",
    // Wymuszamy ekran zgody, żeby przy ponownym łączeniu na pewno wrócił `refresh_token` —
    // Google zwraca go inaczej tylko przy pierwszej zgodzie.
    prompt: "consent",
    state,
  });
  return `${AUTH_ENDPOINT}?${params.toString()}`;
}

function tokensZOdpowiedzi(data: {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
}): YoutubeTokens {
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? null,
    // Margines bezpieczeństwa — odświeżamy odrobinę wcześniej, niż token faktycznie wygaśnie.
    expiresAt: new Date(Date.now() + (data.expires_in - 60) * 1000),
  };
}

export async function exchangeCode(code: string, redirectUri: string): Promise<YoutubeTokens> {
  const res = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID ?? "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      code,
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
    }),
  });
  if (!res.ok) throw new Error(`Wymiana kodu YouTube nie powiodła się: ${res.status}`);
  return tokensZOdpowiedzi(await res.json());
}

export async function refreshAccessToken(refreshToken: string): Promise<YoutubeTokens> {
  const res = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID ?? "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) throw new Error(`Odświeżenie tokenu YouTube nie powiodło się: ${res.status}`);
  const tokens = tokensZOdpowiedzi(await res.json());
  // Google nie zwraca nowego `refresh_token` przy odświeżeniu — wołający zachowuje dotychczasowy.
  return { ...tokens, refreshToken };
}

export async function fetchAccountEmail(accessToken: string): Promise<string | null> {
  const res = await fetch(USERINFO_ENDPOINT, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!res.ok) return null;
  const data = (await res.json()) as { email?: string };
  return data.email ?? null;
}

/**
 * **Świadoma różnica wobec połączenia z Dyskiem: token odświeżający trzymamy ZASZYFROWANY.**
 *
 * `DriveConnection` zapisuje go otwartym tekstem. Nie powielamy tego: token odświeżający jest
 * długowieczny i wymienialny na dostęp do konta Google użytkownika, a `encryptSecret` jest jeden
 * import stąd (C-41). To nie jest nowa abstrakcja „przy okazji" — to istniejący pomocnik platformy
 * użyty tam, gdzie jest po to zbudowany. Odszyfrowanie jest wsteczne zgodne: wartość bez prefiksu
 * wraca bez zmian, więc gdyby kiedyś przyszła niezaszyfrowana, nadal zadziała.
 */
export function zaszyfrujToken(token: string | null): string | null {
  return token ? encryptSecret(token) : null;
}

export function odszyfrujToken(token: string | null): string | null {
  return token ? decryptSecret(token) : null;
}

export interface SubskrybowanyKanal {
  channelId: string;
  title: string;
  thumbnailUrl: string | null;
}

/**
 * Pobiera subskrypcje użytkownika, stronicując do skutku.
 *
 * Limit stron jest twardy i celowy: konto z tysiącami subskrypcji nie może zamienić jednego
 * kliknięcia w kilkuminutowe odpytywanie cudzego API.
 */
export async function pobierzSubskrypcje(
  accessToken: string,
  maksStron = 20
): Promise<SubskrybowanyKanal[]> {
  const out: SubskrybowanyKanal[] = [];
  let pageToken: string | undefined;

  for (let strona = 0; strona < maksStron; strona++) {
    const params = new URLSearchParams({
      part: "snippet",
      mine: "true",
      maxResults: "50",
      ...(pageToken ? { pageToken } : {}),
    });
    const res = await fetch(`${SUBSCRIPTIONS_ENDPOINT}?${params.toString()}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });
    if (!res.ok) break;

    const dane = (await res.json()) as {
      items?: Array<{
        snippet?: {
          title?: string;
          resourceId?: { channelId?: string };
          thumbnails?: { default?: { url?: string } };
        };
      }>;
      nextPageToken?: string;
    };

    for (const it of dane.items ?? []) {
      const channelId = it.snippet?.resourceId?.channelId;
      if (!channelId) continue;
      out.push({
        channelId,
        title: it.snippet?.title ?? channelId,
        thumbnailUrl: it.snippet?.thumbnails?.default?.url ?? null,
      });
    }

    pageToken = dane.nextPageToken;
    if (!pageToken) break;
  }

  return out;
}
