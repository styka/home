export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { auth } from "@/platform/auth/session";
import { hasPermission } from "@/platform/auth/permissions";
import languagesModule from "@/modules/languages/module";
import { getDecks, getStudyStreak } from "@/modules/languages/actions/languageDecks";
import { LanguagesHomePage } from "@/modules/languages/ui/LanguagesHomePage";

export default async function LanguagesRootPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/signin");
  if (!hasPermission(session, languagesModule.permission)) redirect("/");

  const [decks, streak] = await Promise.all([getDecks(), getStudyStreak()]);

  return <LanguagesHomePage decks={decks} streak={streak} />;
}
