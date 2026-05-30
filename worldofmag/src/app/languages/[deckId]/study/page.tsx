export const dynamic = "force-dynamic";

import { redirect, notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import { getDeck, getDueCards } from "@/actions/languageDecks";
import { StudySession } from "@/components/languages/StudySession";

export default async function LanguageStudyPage({ params }: { params: { deckId: string } }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/signin");
  if (!hasPermission(session, PERMISSIONS.LANGUAGES)) redirect("/");

  const deck = await getDeck(params.deckId);
  if (!deck) notFound();
  const cards = await getDueCards(params.deckId);

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { cards: _cards, ...deckMeta } = deck;

  return <StudySession deck={deckMeta} cards={cards} />;
}
