// Z-010: handler akcji asystenta dla modułu Pogoda (lokalizacje + obserwatorzy).
// Scala oba dawne bloki `module === "weather"` z execute/route.ts.
import { prisma } from "@/lib/prisma";
import { addLocationByName, deleteLocation, setDefaultLocation, addPresetWatcher, deleteWatcher, addCustomWatcher, updateWatcher } from "@/actions/weather";
import { asStr, type ExecOutcome } from "@/lib/ai/executors/shared";
import type { AIAction } from "@/lib/ai/aiAction";

export async function executeWeatherAction(action: AIAction, userId: string): Promise<string | ExecOutcome> {
  const { type, params, searchQuery } = action;

  if (type === "add_weather_location") {
    const name = asStr(params.name);
    if (!name) throw new Error("Podaj nazwę miejscowości");
    const loc = await addLocationByName(name);
    const msg = `Dodano lokalizację pogodową „${loc.label ?? name}"`;
    if (params.openAfter === true) return { message: msg, navigateTo: `/pogoda`, navigateLabel: "Otwórz Pogodę" };
    return msg;
  }
  if (type === "delete_weather_location") {
    const id = asStr(params.locationId);
    let locId = id;
    if (!locId && searchQuery) {
      const l = await prisma.weatherLocation.findFirst({
        where: { ownerId: userId, label: { contains: searchQuery, mode: "insensitive" } },
      });
      locId = l?.id;
    }
    if (!locId) throw new Error(`Nie znaleziono lokalizacji: "${searchQuery}"`);
    await deleteLocation(locId);
    return `Usunięto lokalizację pogodową`;
  }
  if (type === "set_default_weather_location") {
    const id = asStr(params.locationId) ?? (await prisma.weatherLocation.findFirst({ where: { ownerId: userId, label: { contains: searchQuery ?? "", mode: "insensitive" } } }))?.id;
    if (!id) throw new Error(`Nie znaleziono lokalizacji: "${searchQuery}"`);
    await setDefaultLocation(id);
    return `Ustawiono domyślną lokalizację pogodową`;
  }
  if (type === "add_weather_watcher") {
    const preset = asStr(params.presetKey);
    if (!preset) throw new Error("Podaj preset obserwatora");
    await addPresetWatcher(preset);
    return `Dodano obserwatora pogody`;
  }
  if (type === "delete_weather_watcher") {
    const id = asStr(params.watcherId) ?? (await prisma.weatherWatcher.findFirst({ where: { ownerId: userId, title: { contains: searchQuery ?? "", mode: "insensitive" } } }))?.id;
    if (!id) throw new Error(`Nie znaleziono obserwatora: "${searchQuery}"`);
    await deleteWatcher(id);
    return `Usunięto obserwatora pogody`;
  }
  if (type === "add_custom_watcher") {
    const title = asStr(params.title);
    const query = asStr(params.query);
    if (!title || !query) throw new Error("Podaj tytuł i zapytanie obserwatora");
    const horizon = (["today", "tomorrow", "weekend", "week"].includes(String(params.horizon)) ? String(params.horizon) : "today") as "today" | "tomorrow" | "weekend" | "week";
    await addCustomWatcher({ title, query, horizon });
    return `Dodano obserwatora pogody „${title}"`;
  }
  if (type === "update_watcher") {
    const id = asStr(params.watcherId) ?? (await prisma.weatherWatcher.findFirst({ where: { ownerId: userId, title: { contains: searchQuery ?? "", mode: "insensitive" } } }))?.id;
    if (!id) throw new Error(`Nie znaleziono obserwatora: "${searchQuery}"`);
    const horizonRaw = asStr(params.horizon);
    await updateWatcher(id, {
      title: asStr(params.newTitle),
      query: asStr(params.query),
      ...(horizonRaw && ["today", "tomorrow", "weekend", "week"].includes(horizonRaw) ? { horizon: horizonRaw as "today" | "tomorrow" | "weekend" | "week" } : {}),
      ...(params.enabled !== undefined ? { enabled: params.enabled === true } : {}),
    });
    return `Zaktualizowano obserwatora pogody`;
  }

  throw new Error(`Nieznany typ akcji pogody: ${type}`);
}
