"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import { encryptSecret, decryptSecret, maskSecret, isSecretConfigKey } from "@/lib/crypto/secrets";

async function requireAdmin() {
  const session = await auth();
  if (!hasPermission(session, PERMISSIONS.ADMIN)) throw new Error("Forbidden");
}

export async function getConfigValue(key: string): Promise<string | null> {
  await requireAdmin();
  const row = await prisma.config.findUnique({ where: { key } });
  if (!row?.value) return null;
  // Sekrety deszyfrujemy do faktycznego użycia (tylko admin po stronie serwera).
  return isSecretConfigKey(key) ? decryptSecret(row.value) : row.value;
}

/** A2: dla UI — nigdy nie wysyłaj surowego sekretu do klienta, tylko maskę + flagę. */
export async function getConfigMasked(key: string): Promise<{ hasValue: boolean; masked: string }> {
  await requireAdmin();
  const row = await prisma.config.findUnique({ where: { key } });
  if (!row?.value) return { hasValue: false, masked: "" };
  const plain = isSecretConfigKey(key) ? decryptSecret(row.value) : row.value;
  return { hasValue: !!plain, masked: maskSecret(plain) };
}

export async function setConfigValue(key: string, value: string): Promise<void> {
  await requireAdmin();
  // Sekrety szyfrujemy w spoczynku.
  const stored = isSecretConfigKey(key) ? encryptSecret(value.trim()) : value;
  await prisma.config.upsert({
    where: { key },
    update: { value: stored, updatedAt: new Date() },
    create: { key, value: stored, updatedAt: new Date() },
  });
}
