import { prisma } from "@/lib/prisma";

/**
 * 036: przełącznik propozycji kolejnych pytań („follow-upy") pod odpowiedzią asystenta.
 *
 * Follow-upy są zamawiane w prompcie i model dopisuje je do KAŻDEJ odpowiedzi, więc kosztują tokeny
 * przy każdej wiadomości. Administrator steruje nimi w `/admin/llm`; wartość żyje w `Config` — tak
 * samo jak próg alertu kosztowego i przelicznik USD→PLN.
 *
 * Ten moduł to czysty ODCZYT bez sesji — woła go trasa agenta, która nie może przechodzić przez
 * akcję administratora (`requireAdmin`). Wersja dla panelu admina jest w `actions/llmConfig.ts`.
 */
export const FOLLOWUPS_CONFIG_KEY = "assistant_followups_enabled";

/** Brak wiersza = włączone (zgodność wsteczna z instalacjami sprzed migracji 0214). */
export async function readFollowupsEnabled(): Promise<boolean> {
  try {
    const row = await prisma.config.findUnique({ where: { key: FOLLOWUPS_CONFIG_KEY } });
    if (!row) return true;
    return row.value !== "0";
  } catch {
    // Awaria odczytu nie może wyłączyć funkcji „po cichu" — zostajemy przy zachowaniu domyślnym.
    return true;
  }
}
