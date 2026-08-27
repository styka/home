import { getTranslations } from "next-intl/server";
import { getWorkspaceLocaleSettings } from "@/actions/workspaceSettings";
import { WorkspaceLocaleSection } from "@/components/settings/WorkspaceLocaleSection";
import { PustaSekcja } from "@/components/settings/sekcje/PustaSekcja";

/**
 * 109: sekcja „Język i strefa czasowa".
 *
 * Blok był dotąd renderowany warunkowo w środku długiej strony — przy braku danych po prostu go
 * nie było i nikt tego nie zauważał. Jako osobna trasa musi powiedzieć, co się dzieje: pusty ekran
 * pod własnym adresem wygląda jak awaria (lekcja z 038 o stanie oczekiwania kontra błąd).
 */
export async function Jezyk() {
  const t = await getTranslations("app.settings.sekcja");
  const ustawienia = await getWorkspaceLocaleSettings().catch(() => null);

  if (!ustawienia || ustawienia.przestrzenie.length === 0) {
    return <PustaSekcja tytul={t("brakDanychTytul")} opis={t("jezykBrakOpis")} />;
  }

  return <WorkspaceLocaleSection przestrzenie={ustawienia.przestrzenie} jezyki={ustawienia.jezyki} />;
}
