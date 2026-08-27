import { SkinPicker } from "@/components/settings/SkinPicker";
import { listAvailableSkins, getActiveSkinId } from "@/actions/skins";
import { getMyTeams } from "@/actions/teams";

/** 109: sekcja „Wygląd" — skórka aplikacji. Pobiera WYŁĄCZNIE swoje dane (AC-12). */
export async function Wyglad() {
  const [skins, activeSkinId, teams] = await Promise.all([
    listAvailableSkins(),
    getActiveSkinId(),
    getMyTeams(),
  ]);

  return <SkinPicker skins={skins} activeId={activeSkinId} teams={teams.map((t) => ({ id: t.id, name: t.name }))} />;
}
