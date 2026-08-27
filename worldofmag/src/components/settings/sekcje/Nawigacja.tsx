import { getTranslations } from "next-intl/server";
import { auth } from "@/platform/auth/session";
import { getMenuPrefs } from "@/actions/menuPrefs";
import { getFavoriteViews } from "@/actions/favoriteViews";
import { MenuPrefsEditor } from "@/components/settings/MenuPrefsEditor";
import { FavoriteViewsEditor } from "@/components/settings/FavoriteViewsEditor";
import { Podsekcja } from "@/components/settings/sekcje/Podsekcja";

/**
 * 109: sekcja „Menu i nawigacja" — dawne bloki „Menu" i „Nawigacja" (ulubione widoki) razem,
 * bo obie zmieniają to samo: czym i w jakiej kolejności nawiguje się po aplikacji.
 */
export async function Nawigacja() {
  const t = await getTranslations("app.settings.sekcje");
  const session = await auth();
  const [menuPrefs, favoriteViews] = await Promise.all([
    getMenuPrefs(),
    getFavoriteViews().catch(() => []),
  ]);

  return (
    <>
      <Podsekcja tytul={t("menu")}>
        <MenuPrefsEditor permissions={session?.user?.permissions ?? []} prefs={menuPrefs} />
      </Podsekcja>

      {/* Kotwica dla odnośnika „Zarządzaj" z przełącznika ulubionych (043/AC-3) — przenosi się
          razem z blokiem, więc `/settings/nawigacja#ulubione` działa dalej. */}
      <section id="ulubione" style={{ scrollMarginTop: 16 }}>
        <Podsekcja tytul={t("ulubioneWidoki")}>
          <FavoriteViewsEditor favorites={favoriteViews} />
        </Podsekcja>
      </section>
    </>
  );
}
