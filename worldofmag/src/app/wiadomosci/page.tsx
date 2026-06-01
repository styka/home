export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import { ensureNewsSetup, getTopics, getSources, getNewsPref } from "@/actions/news";
import { NewsPage } from "@/components/news/NewsPage";

export default async function WiadomosciRootPage() {
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
    />
  );
}
