"use server";

import { prisma } from "@/platform/db/prisma";
import { auth } from "@/platform/auth/session";
import { hasPermission, PERMISSIONS } from "@/platform/auth/permissions";
import { encryptSecret, decryptSecret, maskSecret, isSecretConfigKey, isEncrypted } from "@/lib/crypto/secrets";
import { logAudit } from "@/platform/audit/audit";
import { revalidatePath } from "next/cache";

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

/**
 * A2: dla UI — nigdy nie wysyłaj surowego sekretu do klienta, tylko maskę + flagi.
 *
 * 104 (punkt 5 planu domknięcia bezpieczeństwa) — DWIE NOWE FLAGI.
 *
 * Szyfrowanie sekretów dołożono później niż same sekrety, a odczyt jest wstecznie zgodny: wartość
 * bez znacznika `enc:v1:` wraca bez zmian. Skutek: klucz zapisany przed tamtą zmianą **leży w bazie
 * otwartym tekstem** i taki zostanie, dopóki ktoś go ponownie nie zapisze. Do tej pory nie było jak
 * tego zobaczyć — panel twierdził, że klucz jest zaszyfrowany, nie sprawdzając tego.
 *
 * `isEncrypted` czytamy z **surowej** wartości z bazy, przed odszyfrowaniem — po odszyfrowaniu
 * jedno od drugiego jest już nie do odróżnienia.
 */
export async function getConfigMasked(
  key: string
): Promise<{ hasValue: boolean; masked: string; wymagaSzyfrowania: boolean; zaszyfrowany: boolean }> {
  await requireAdmin();
  const wymagaSzyfrowania = isSecretConfigKey(key);
  const row = await prisma.config.findUnique({ where: { key } });
  if (!row?.value) return { hasValue: false, masked: "", wymagaSzyfrowania, zaszyfrowany: false };
  const plain = wymagaSzyfrowania ? decryptSecret(row.value) : row.value;
  return {
    hasValue: !!plain,
    masked: maskSecret(plain),
    wymagaSzyfrowania,
    zaszyfrowany: isEncrypted(row.value),
  };
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
  // Nie logujemy wartości sekretów — tylko fakt zmiany klucza konfiguracji.
  await logAudit("config", "config.set", key, isSecretConfigKey(key) ? `Zmieniono sekret „${key}”` : `Ustawiono „${key}”`);
}

// ─── 083 (zadanie 30): retencja danych ───────────────────────────────────────
//
// Rozdz. 11.6: „retencja konfigurowalna w /admin/config, wykonywana zadaniem okresowym". Lista pól
// jest **wyprowadzona z polityk**, a nie przepisana — dopisanie polityki (np. przez nowy moduł) samo
// dokłada pole w panelu. Ręczna lista rozjechałaby się przy pierwszej takiej zmianie i objawiłaby
// się tabelą, która rośnie mimo „skonfigurowanej" retencji.

export type PolitykaRetencjiDTO = {
  klucz: string;
  etykieta: string;
  dni: number;
  domyslneDni: number;
  minimumDni: number;
  uzasadnienie: string;
};

export type StanRetencjiDTO = {
  polityki: PolitykaRetencjiDTO[];
  ostatniPrzebieg: string | null;
  ostatniWynik: { klucz: string; etykieta: string; dni: number; usunieto: number; blad?: string }[];
};

export async function getRetentionSettings(): Promise<StanRetencjiDTO> {
  await requireAdmin();
  const { POLITYKI_RETENCJI } = await import("@/lib/retention/polityki");
  const { dniRetencji } = await import("@/platform/retention");
  const { RETENCJA_ZNACZNIK_KLUCZ, RETENCJA_WYNIK_KLUCZ } = await import("@/platform/retention/harmonogram");

  const [znacznik, wynik] = await Promise.all([
    prisma.config.findUnique({ where: { key: RETENCJA_ZNACZNIK_KLUCZ } }),
    prisma.config.findUnique({ where: { key: RETENCJA_WYNIK_KLUCZ } }),
  ]);

  const polityki: PolitykaRetencjiDTO[] = [];
  for (const p of POLITYKI_RETENCJI) {
    polityki.push({
      klucz: p.klucz,
      etykieta: p.etykieta,
      dni: await dniRetencji(p),
      domyslneDni: p.domyslneDni,
      minimumDni: p.minimumDni,
      uzasadnienie: p.uzasadnienie,
    });
  }

  let ostatniWynik: StanRetencjiDTO["ostatniWynik"] = [];
  try {
    if (wynik?.value) ostatniWynik = JSON.parse(wynik.value);
  } catch {
    // Uszkodzony wpis nie może wywalić panelu administratora — pokazujemy pustą historię.
  }
  return { polityki, ostatniPrzebieg: znacznik?.value ?? null, ostatniWynik };
}

export async function setRetentionDays(klucz: string, dni: number): Promise<void> {
  await requireAdmin();
  const { POLITYKI_RETENCJI } = await import("@/lib/retention/polityki");
  const { kluczKonfiguracji } = await import("@/platform/retention");
  const polityka = POLITYKI_RETENCJI.find((p) => p.klucz === klucz);
  // Klucz spoza listy polityk to nie „nieznane ustawienie", tylko próba zapisania czegoś, czego
  // nikt nigdy nie odczyta — odrzucamy zamiast tworzyć wiersz-widmo w `Config`.
  if (!polityka) throw new Error(`Nieznana polityka retencji: ${klucz}`);
  const wartosc = Math.max(polityka.minimumDni, Math.floor(Number(dni) || polityka.domyslneDni));
  const key = kluczKonfiguracji(polityka);
  await prisma.config.upsert({
    where: { key },
    update: { value: String(wartosc) },
    create: { key, value: String(wartosc) },
  });
  await logAudit("config", "retention.set", key, `Ustawiono retencję „${polityka.etykieta}" na ${wartosc} dni`);
  revalidatePath("/admin/config");
}
