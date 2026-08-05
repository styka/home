export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { auth } from "@/platform/auth/session";
import { hasPermission, PERMISSIONS } from "@/platform/auth/permissions";
import { ensureNewsSetup, getTopics, getSources, getNewsPref } from "@/actions/news";
import { NewsPage } from "@/components/news/NewsPage";

export default async function WiadomosciRootPage({
  searchParams,
}: {
  // 044: `tryb` = strumień ⇄ pojedynczy temat. Wartość startowa MUSI przyjść propsem z serwera,
  // a nie z `window` w pierwszym renderze — czytanie adresu na kliencie to rozjazd hydratacji
  // (patrz wpis z 2026-08-02 w `doświadczenia.md`).
  searchParams?: { widok?: string; tryb?: string };
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/signin");
  if (!hasPermission(session, PERMISSIONS.NEWS)) redirect("/");

  await ensureNewsSetup();
  const [topics, sources, pref] = await Promise.all([getTopics(), getSources(), getNewsPref()]);

  return (
    <NewsPage
      topics={topics}
      sources={sources}
      defaultLength={pref.defaultSummaryLength}
      activeSourceKey={pref.activeSourceKey}
      viewParams={searchParams ?? {}}
    />
  );
}
