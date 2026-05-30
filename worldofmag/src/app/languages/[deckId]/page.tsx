export const dynamic = "force-dynamic";

import { redirect, notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import { getDeck } from "@/actions/languageDecks";
import { DeckPage } from "@/components/languages/DeckPage";

export default async function LanguageDeckPage({ params }: { params: { deckId: string } }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/signin");
  if (!hasPermission(session, PERMISSIONS.LANGUAGES)) redirect("/");

  const deck = await getDeck(params.deckId);
  if (!deck) notFound();

  return <DeckPage deck={deck} />;
}
