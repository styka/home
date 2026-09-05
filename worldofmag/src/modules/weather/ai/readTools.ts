import { getLocations, getWatchers, getWeather } from "../contract";
import { prisma } from "@/platform/db/prisma";
import { HARD_MAX, asStr } from "@/lib/ai/readToolShared";
import type { AiReadToolHandler } from "@/platform/ai/contribution";
import { filtrMoichRekordow } from "@/platform/workspaces/zapis";

/**
 * 049: narzędzia ODCZYTU tego modułu — wkład do asystenta, składany z deklaracji.
 *
 * Wcześniej wszystkie 56 narzędzi mieszkało w jednym `switch (name)` w warstwie AI, która
 * importowała kontrakty szesnastu modułów. Treść jest ta sama; zmienia się właściciel.
 */
export const readToolsPrompt = [
  "- list_weather_locations: args {} → [{ id, label, isDefault }]. Lokalizacje pogodowe.",
  "- get_weather: args { locationName? } → { location, current:{ temp, apparent, windKph }, daily:[{ date, tMax, tMin, precipProbMax, windMaxKph, code }] }. Prognoza pogody dla domyślnej (lub wskazanej nazwą) lokalizacji użytkownika. Kod pogody wg WMO. Użyj do pytań „jaka pogoda / czy będzie padać / jak się ubrać\".",
  "- list_watchers: args {} → [{ id, title, query, horizon, enabled }]. Obserwatorzy pogody (alerty).",
].join("\n");

export const readTools: Record<string, AiReadToolHandler> = {
  list_weather_locations: async (args, userId) => {
      // WeatherLocation jest user-only (ownerId wymagany).
      const locations = await prisma.weatherLocation.findMany({
        where: { ...(await filtrMoichRekordow(userId)) },
        select: { id: true, label: true, isDefault: true },
        orderBy: { createdAt: "asc" },
        take: HARD_MAX,
      });
      return locations;
  },
  get_weather: async (args, userId) => {
      const locations = await getLocations();
      if (locations.length === 0) return { note: "Brak zapisanych lokalizacji pogodowych — dodaj miejscowość w /pogoda." };
      const wanted = asStr(args.locationName);
      const loc = (wanted && locations.find((l) => l.label.toLowerCase().includes(wanted.toLowerCase())))
        || locations.find((l) => l.isDefault)
        || locations[0];
      const wynik = await getWeather(loc.lat, loc.lon);
      // Niedostępność dostawcy wraca jako notatka dla agenta — jak brak lokalizacji wyżej.
      if (!wynik.ok) return { note: wynik.blad };
      const f = wynik.forecast;
      return {
        location: loc.label,
        current: f.current ? { temp: f.current.temp, apparent: f.current.apparent, windKph: f.current.windKph, code: f.current.code } : null,
        daily: f.daily.slice(0, 5).map((d) => ({
          date: d.date, tMax: d.tMax, tMin: d.tMin, precipProbMax: d.precipProbMax, precipSum: d.precipSum, windMaxKph: d.windMaxKph, code: d.code,
        })),
      };
  },
  list_watchers: async (args, userId) => {
      const watchers = await getWatchers();
      return watchers.map((w) => ({ id: w.id, title: w.title, query: w.query, horizon: w.horizon, enabled: w.enabled }));
  },
};
