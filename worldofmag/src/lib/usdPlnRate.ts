// 029: serwerowy odczyt przelicznika USD→PLN z `Config` (klucz `usd_pln_rate`).
// Osobno od czystego `@/lib/usdPln`, bo importuje prisma (tylko serwer). Odczyt jest
// NIE-gejtowany uprawnieniami — przelicznik nie jest sekretem i bywa pokazywany także
// zwykłym użytkownikom (np. koszt odpowiedzi asystenta).

import { prisma } from "@/platform/db/prisma";
import { USD_PLN_CONFIG_KEY, DEFAULT_USD_PLN_RATE, parseUsdPlnRate } from "@/lib/usdPln";

export async function getUsdPlnRate(): Promise<number> {
  try {
    const row = await prisma.config.findUnique({ where: { key: USD_PLN_CONFIG_KEY } });
    return parseUsdPlnRate(row?.value, DEFAULT_USD_PLN_RATE);
  } catch {
    return DEFAULT_USD_PLN_RATE;
  }
}
