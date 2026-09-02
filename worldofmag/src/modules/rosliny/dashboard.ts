import type { DashboardContributor } from "@/platform/dashboard";
import type { DashboardSnapshot } from "../home/contract";
import { getCareAgenda } from "./contract";

/**
 * 113 — wkład Roślin do migawki pulpitu (AC-29).
 *
 * Ten sam kształt co wkład Zwierząt: licznik spraw na dziś i zaległych plus krótki podgląd.
 * Podgląd ma **cztery pozycje**, bo pulpit pokazuje wiele modułów naraz i dłuższa lista wypycha
 * pozostałe poza ekran telefonu.
 *
 * `try/catch` z wartościami zerowymi jest wymogiem, nie ostrożnością: pulpit składa wkłady wielu
 * modułów, więc wyjątek stąd (brak uprawnienia, błąd bazy) zabrałby użytkownikowi CAŁĄ stronę
 * główną, a nie jedną sekcję.
 */
const wklad: DashboardContributor<Pick<DashboardSnapshot, "plantCareDue" | "plantAgenda">> = async () => {
  try {
    const agenda = await getCareAgenda({ dni: 7 });
    return {
      plantCareDue: agenda.filter((a) => a.bucket === "OVERDUE" || a.bucket === "TODAY").length,
      plantAgenda: agenda.slice(0, 4).map((a) => ({
        id: a.id,
        title: a.title,
        plantName: a.plantName,
        href: a.plantId ? `/rosliny/${a.spaceId}/roslina/${a.plantId}` : `/rosliny/${a.spaceId}`,
        bucket: a.bucket,
      })),
    };
  } catch {
    return { plantCareDue: 0, plantAgenda: [] };
  }
};

export default wklad;
