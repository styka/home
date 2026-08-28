import { getLocations, getWeather } from "@/modules/weather/contract";
import { logEvent } from "@/platform/observability/log";
import type { PrognozaDobowa } from "../domain/harmonogram";

/**
 * 113 — ADAPTER POGODY DLA REGUŁY TERMINU.
 *
 * **To jedyne miejsce w module, które wie o istnieniu modułu Pogoda** — i sięga tam wyłącznie przez
 * jego kontrakt (C-36). Reguła dziedzinowa (`domain/harmonogram`) dostaje trzy pola zamiast
 * dziesięciu i nie wie, skąd pochodzą; dzięki temu jej test nie potrzebuje ani sieci, ani bazy.
 *
 * **Brak prognozy nie jest błędem.** Przestrzeń bez przypisanej lokalizacji, nieosiągalny dostawca,
 * usunięta lokalizacja — we wszystkich tych przypadkach zwracamy pustą listę, a reguła liczy termin
 * bez korekty pogodowej. Rzucenie wyjątkiem oznaczałoby, że awaria zewnętrznego API zabiera
 * użytkownikowi CAŁĄ agendę opieki, łącznie z roślinami w mieszkaniu, na które pogoda i tak nie
 * wpływa.
 *
 * Ile dni: siedem. Dłuższa prognoza nie poprawia decyzji o podlaniu (odstępy rzadko przekraczają
 * dwa tygodnie), a każde dodatkowe pole to dane, które trzeba by przenosić przez granicę modułu.
 */
const DNI_PROGNOZY = 7;

export async function prognozaDlaPrzestrzeni(weatherLocationId: string | null | undefined): Promise<PrognozaDobowa[]> {
  if (!weatherLocationId) return [];

  try {
    const lokalizacje = await getLocations();
    const lok = lokalizacje.find((l) => l.id === weatherLocationId);
    // Lokalizacja mogła zostać usunięta w module Pogoda — przestrzeń trzyma sam identyfikator, bez
    // klucza obcego (to inny moduł). Cisza jest tu właściwą odpowiedzią.
    if (!lok) return [];

    const forecast = await getWeather(lok.lat, lok.lon);
    return (forecast.daily ?? []).slice(0, DNI_PROGNOZY).map((d) => ({
      date: d.date,
      precipSum: d.precipSum,
      tMin: d.tMin,
      tMax: d.tMax,
    }));
  } catch (e) {
    logEvent("warn", "rosliny/prognoza.niedostepna", {
      weatherLocationId,
      powod: e instanceof Error ? e.message : "nieznany",
    });
    return [];
  }
}
