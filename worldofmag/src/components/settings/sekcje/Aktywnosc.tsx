import { getTranslations } from "next-intl/server";
import { auth } from "@/platform/auth/session";
import { getRecentActivity } from "@/actions/activity";
import { ActivityFeed } from "@/components/settings/ActivityFeed";

/**
 * 109: sekcja „Aktywność".
 *
 * To był najdroższy blok dawnej strony — `getRecentActivity(30)` czekało też ten, kto wszedł
 * zmienić skórkę. Od 109 pobiera się wyłącznie tutaj (AC-12).
 */
export async function Aktywnosc() {
  const t = await getTranslations("app.settings.page");
  const session = await auth();
  const ostatnie = await getRecentActivity(30);

  const doUI = ostatnie.map((a) => ({
    module: a.module,
    action: a.action,
    createdAt: a.createdAt instanceof Date ? a.createdAt.toISOString() : String(a.createdAt),
    metadata: (a.metadata as Record<string, unknown> | null) ?? null,
  }));

  if (doUI.length === 0) {
    return <p style={{ color: "var(--text-muted)", fontSize: 14, margin: 0 }}>{t("brakOstatniejAktywnosci")}</p>;
  }

  return <ActivityFeed activities={doUI} permissions={session?.user?.permissions ?? []} />;
}
