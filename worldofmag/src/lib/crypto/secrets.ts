// A2: szyfrowanie sekretów (klucze API) w spoczynku + maskowanie.
// AES-256-GCM z kluczem wyprowadzonym z env (CONFIG_SECRET lub AUTH_SECRET).
// Wstecznie kompatybilne: wartości bez prefiksu `enc:v1:` traktujemy jako plaintext
// (stare klucze działają do czasu pierwszego ponownego zapisu, który je zaszyfruje).

import crypto from "crypto";

const PREFIX = "enc:v1:";

function getKey(): Buffer {
  const secret = process.env.CONFIG_SECRET || process.env.AUTH_SECRET || "";
  // Klucz 32-bajtowy z sekretu (gdy brak sekretu — deterministyczny fallback, ale ostrzegamy).
  return crypto.createHash("sha256").update(secret || "omnia-insecure-fallback").digest();
}

export function isEncrypted(value: string | null | undefined): boolean {
  return !!value && value.startsWith(PREFIX);
}

/** Szyfruje sekret. Pusty/niezdefiniowany zwracany bez zmian. Już zaszyfrowany — bez zmian. */
export function encryptSecret(plain: string | null | undefined): string {
  if (!plain) return "";
  if (isEncrypted(plain)) return plain;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", getKey(), iv);
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return PREFIX + [iv.toString("base64"), tag.toString("base64"), ct.toString("base64")].join(".");
}

/** Deszyfruje sekret. Plaintext (bez prefiksu) zwracany bez zmian (wsteczna kompatybilność). */
export function decryptSecret(stored: string | null | undefined): string {
  if (!stored) return "";
  if (!isEncrypted(stored)) return stored;
  try {
    const [ivB64, tagB64, ctB64] = stored.slice(PREFIX.length).split(".");
    const iv = Buffer.from(ivB64, "base64");
    const tag = Buffer.from(tagB64, "base64");
    const ct = Buffer.from(ctB64, "base64");
    const decipher = crypto.createDecipheriv("aes-256-gcm", getKey(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ct), decipher.final()]).toString("utf8");
  } catch {
    return ""; // zły klucz / uszkodzone dane — traktuj jak brak
  }
}

/** Maska do wyświetlenia: kropki + 4 ostatnie znaki realnego sekretu. */
export function maskSecret(plain: string | null | undefined): string {
  const v = plain ?? "";
  if (!v) return "";
  if (v.length <= 4) return "•".repeat(v.length);
  return "•".repeat(Math.max(4, v.length - 4)) + v.slice(-4);
}

/** Czy dany klucz Config jest sekretem (do auto-szyfrowania i maskowania). */
export function isSecretConfigKey(key: string): boolean {
  return /(_api_key|_secret|_token|_password)$/i.test(key);
}

/**
 * Z-054: czy klucz szyfrujący jest realnie skonfigurowany (env `CONFIG_SECRET`
 * lub `AUTH_SECRET`). Gdy `false`, używany jest deterministyczny, NIEbezpieczny
 * fallback — sekrety w bazie są wtedy „szyfrowane" kluczem znanym z kodu.
 * Surfacowane w `/admin/health`, żeby brak sekretu na prod był widoczny.
 */
export function isSecretConfigured(): boolean {
  return !!(process.env.CONFIG_SECRET || process.env.AUTH_SECRET);
}
