export const dynamic = "force-dynamic";

import { redirect, notFound } from "next/navigation";
import { auth } from "@/platform/auth/session";
import { hasPermission } from "@/platform/auth/permissions";
import languagesModule from "@/modules/languages/module";
import { getDeck } from "@/modules/languages/actions/languageDecks";
import { DeckPage } from "@/modules/languages/ui/DeckPage";

export default async function LanguageDeckPage({ params }: { params: { deckId: string } }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/signin");
  if (!hasPermission(session, languagesModule.permission)) redirect("/");

  const deck = await getDeck(params.deckId);
  if (!deck) notFound();

  return <DeckPage deck={deck} />;
}
