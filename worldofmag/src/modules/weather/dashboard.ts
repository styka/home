import { prisma } from "@/platform/db/prisma";
import { filtrMoichRekordow } from "@/platform/workspaces/zapis";
import type { DashboardContributor } from "@/platform/dashboard";
import type { DashboardSnapshot, WeatherTodayInfo } from "../home/contract";
import { fetchForecast, wmo, type Forecast } from "./lib/openMeteo";

/** Twardy limit czasu na Open-Meteo — pulpit nie może czekać na zewnętrzne API. */
const LIMIT_MS = 3_000;

/**
 * 115 (Z-INT-17): wkład Pogody do migawki pulpitu — bieżące warunki domyślnej lokalizacji.
 *
 * Jedyny wkład sięgający poza własną bazę, stąd `Promise.race` z limitem 3 s: wolne Open-Meteo
 * ma dać `null` (pole po prostu się nie pokaże), a nie przytrzymać całego pulpitu.
 */
const wklad: DashboardContributor<Pick<DashboardSnapshot, "weatherToday">> = async (userId) => {
  try {
    const lokalizacja = await prisma.weatherLocation.findFirst({
      where: { ...(await filtrMoichRekordow(userId)) },
      orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
      select: { label: true, lat: true, lon: true },
    });
    if (!lokalizacja) return { weatherToday: null };

    const f = await Promise.race([
      fetchForecast(lokalizacja.lat, lokalizacja.lon),
      new Promise<Forecast | null>((resolve) => setTimeout(() => resolve(null), LIMIT_MS)),
    ]);
    if (!f?.current) return { weatherToday: null };

    const meta = wmo(f.current.code, !f.current.isDay);
    const weatherToday: WeatherTodayInfo = {
      temp: Math.round(f.current.temp),
      opis: meta.label,
      emoji: meta.emoji,
      label: lokalizacja.label,
    };
    return { weatherToday };
  } catch {
    return { weatherToday: null };
  }
};

export default wklad;
