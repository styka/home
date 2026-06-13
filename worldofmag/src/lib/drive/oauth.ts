// Google OAuth 2.0 helpers for the per-user Drive integration.
//
// We deliberately run a SEPARATE OAuth flow from NextAuth (which signs users in
// with the minimal openid/email/profile scopes). This lets a user explicitly
// "Connect Google Drive" in Settings and grant only the `drive.file` scope —
// app-created files only, never the rest of their Drive. The same Google OAuth
// client (GOOGLE_CLIENT_ID/SECRET) is reused.

export const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file";

const AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const USERINFO_ENDPOINT = "https://www.googleapis.com/oauth2/v3/userinfo";

/** Path Google redirects back to after consent. */
export const DRIVE_CALLBACK_PATH = "/api/drive/callback";

export interface DriveTokens {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: Date;
}

/** Build the Google consent URL. `state` guards against CSRF; `redirectUri` is
 * derived from the incoming request origin so it works on localhost and prod. */
export function buildConsentUrl(state: string, redirectUri: string): string {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID ?? "",
    redirect_uri: redirectUri,
    response_type: "code",
    scope: `openid email profile ${DRIVE_SCOPE}`,
    access_type: "offline",
    include_granted_scopes: "true",
    // Force the consent screen so we reliably receive a refresh_token even on
    // re-connect (Google only returns it on the first consent otherwise).
    prompt: "consent",
    state,
  });
  return `${AUTH_ENDPOINT}?${params.toString()}`;
}

function tokensFromResponse(data: {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
}): DriveTokens {
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? null,
    // Subtract a small safety margin so we refresh slightly early.
    expiresAt: new Date(Date.now() + (data.expires_in - 60) * 1000),
  };
}

/** Exchange an authorization code for tokens. */
export async function exchangeCode(code: string, redirectUri: string): Promise<DriveTokens> {
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
  if (!res.ok) throw new Error(`Drive token exchange failed: ${res.status} ${await res.text()}`);
  return tokensFromResponse(await res.json());
}

/** Use a refresh_token to obtain a fresh access_token. Google does not return a
 * new refresh_token here, so the caller keeps the existing one. */
export async function refreshAccessToken(refreshToken: string): Promise<DriveTokens> {
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
  if (!res.ok) throw new Error(`Drive token refresh failed: ${res.status} ${await res.text()}`);
  const tokens = tokensFromResponse(await res.json());
  return { ...tokens, refreshToken };
}

/** Fetch the email of the Google account that just authorized. */
export async function fetchAccountEmail(accessToken: string): Promise<string | null> {
  const res = await fetch(USERINFO_ENDPOINT, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { email?: string };
  return data.email ?? null;
}
