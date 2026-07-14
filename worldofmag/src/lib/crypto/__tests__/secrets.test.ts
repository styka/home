import { test } from "node:test";
import assert from "node:assert/strict";
import { encryptSecret, decryptSecret, isEncrypted, maskSecret, isSecretConfigKey, isSecretConfigured } from "@/lib/crypto/secrets";

// A2/Z-054: szyfrowanie sekretów w spoczynku + diagnostyka konfiguracji klucza.
test("encrypt/decrypt: round-trip i prefiks enc:v1:", () => {
  const plain = "sk-test-1234567890";
  const enc = encryptSecret(plain);
  assert.ok(isEncrypted(enc), "zaszyfrowany ma prefiks enc:v1:");
  assert.notEqual(enc, plain);
  assert.equal(decryptSecret(enc), plain, "deszyfracja odtwarza oryginał");
});

test("decryptSecret: plaintext (bez prefiksu) zwracany bez zmian (wsteczna kompatybilność)", () => {
  assert.equal(decryptSecret("stary-klucz-plaintext"), "stary-klucz-plaintext");
});

test("encryptSecret: pusty i już-zaszyfrowany bez zmian (idempotencja)", () => {
  assert.equal(encryptSecret(""), "");
  assert.equal(encryptSecret(null), "");
  const enc = encryptSecret("abc");
  assert.equal(encryptSecret(enc), enc, "ponowne szyfrowanie nie zagnieżdża");
});

test("maskSecret: kropki + 4 ostatnie znaki", () => {
  assert.equal(maskSecret("1234567890"), "••••••7890");
  assert.equal(maskSecret("ab"), "••");
  assert.equal(maskSecret(""), "");
});

test("isSecretConfigKey: rozpoznaje sekretne klucze Config", () => {
  assert.equal(isSecretConfigKey("groq_api_key"), true);
  assert.equal(isSecretConfigKey("some_secret"), true);
  assert.equal(isSecretConfigKey("auth_token"), true);
  assert.equal(isSecretConfigKey("theme_color"), false);
});

test("isSecretConfigured: odzwierciedla obecność CONFIG_SECRET/AUTH_SECRET", () => {
  const prevC = process.env.CONFIG_SECRET;
  const prevA = process.env.AUTH_SECRET;
  try {
    delete process.env.CONFIG_SECRET;
    delete process.env.AUTH_SECRET;
    assert.equal(isSecretConfigured(), false, "brak sekretu → false");
    process.env.AUTH_SECRET = "x";
    assert.equal(isSecretConfigured(), true, "AUTH_SECRET ustawiony → true");
    delete process.env.AUTH_SECRET;
    process.env.CONFIG_SECRET = "y";
    assert.equal(isSecretConfigured(), true, "CONFIG_SECRET ustawiony → true");
  } finally {
    if (prevC === undefined) delete process.env.CONFIG_SECRET; else process.env.CONFIG_SECRET = prevC;
    if (prevA === undefined) delete process.env.AUTH_SECRET; else process.env.AUTH_SECRET = prevA;
  }
});
