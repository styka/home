"use server";

import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/ownership";
import { revalidatePath } from "next/cache";
import { CONSENT_DOCUMENTS, getLegalDoc } from "@/lib/legal/documents";

/** Z-053: aktualne zgody użytkownika (klucz → zaakceptowana wersja + data). */
export async function getMyConsents(): Promise<Record<string, { version: string; acceptedAt: string }>> {
  const userId = await requireUserId();
  const rows = await prisma.userConsent.findMany({ where: { userId } });
  const out: Record<string, { version: string; acceptedAt: string }> = {};
  for (const r of rows) out[r.documentKey] = { version: r.version, acceptedAt: r.acceptedAt.toISOString() };
  return out;
}

/** Klucze dokumentów wymagających zgody, których BIEŻĄCA wersja nie jest zaakceptowana. */
export async function getOutstandingConsents(): Promise<string[]> {
  const consents = await getMyConsents();
  return CONSENT_DOCUMENTS.filter((d) => consents[d.key]?.version !== d.version).map((d) => d.key);
}

/** Zapis akceptacji konkretnego dokumentu w podanej wersji (upsert — nadpisuje starszą). */
export async function acceptConsent(documentKey: string, version: string): Promise<void> {
  const userId = await requireUserId();
  const doc = getLegalDoc(documentKey);
  if (!doc || !doc.consent) throw new Error("Nieznany dokument zgody");
  if (doc.version !== version) throw new Error("Nieaktualna wersja dokumentu");
  await prisma.userConsent.upsert({
    where: { userId_documentKey: { userId, documentKey } },
    create: { userId, documentKey, version },
    update: { version, acceptedAt: new Date() },
  });
  revalidatePath("/");
}

/** Akceptacja bieżących wersji wszystkich dokumentów wymagających zgody (baner). */
export async function acceptAllCurrentConsents(): Promise<void> {
  const userId = await requireUserId();
  for (const doc of CONSENT_DOCUMENTS) {
    await prisma.userConsent.upsert({
      where: { userId_documentKey: { userId, documentKey: doc.key } },
      create: { userId, documentKey: doc.key, version: doc.version },
      update: { version: doc.version, acceptedAt: new Date() },
    });
  }
  revalidatePath("/");
}
