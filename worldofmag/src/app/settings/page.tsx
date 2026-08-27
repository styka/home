import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Settings } from "lucide-react";
import { auth } from "@/platform/auth/session";
import { ModuleView } from "@/components/ui/view";
import { SpisUstawien } from "@/components/settings/SpisUstawien";

/**
 * 109: USTAWIENIA TO SPIS SEKCJI, NIE JEDNA DŁUGA STRONA.
 *
 * Do 109 była to jedna kolumna z trzynastoma nagłówkami. Zgłoszenie właściciela: „trzeba
 * przewijać/szukać, gdzie coś jest, żeby do czegoś dojść, i ciężko jest na to trafić". Teraz
 * `/settings` odpowiada na pytanie „co tu w ogóle jest", a każda sekcja ma własny adres, który da
 * się podlinkować i zapisać w ulubionych.
 *
 * Nagłówka nie rysujemy ręcznie — robi to rama widoku (C-33).
 */
export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/signin");

  const t = await getTranslations("app.settings.spis");

  return (
    <ModuleView
      state="ready"
      width="narrow"
      icon={<Settings size={22} />}
      title={t("tytul")}
      subtitle={t("podtytul")}
    >
      <SpisUstawien wariant="kafelki" />
    </ModuleView>
  );
}
