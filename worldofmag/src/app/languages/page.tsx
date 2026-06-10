export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import { getDecks, getStudyStreak } from "@/actions/languageDecks";
import { LanguagesHomePage } from "@/components/languages/LanguagesHomePage";

export default async function LanguagesRootPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/signin");
  if (!hasPermission(session, PERMISSIONS.LANGUAGES)) redirect("/");

  const [decks, streak] = await Promise.all([getDecks(), getStudyStreak()]);

  return <LanguagesHomePage decks={decks} streak={streak} />;
}
