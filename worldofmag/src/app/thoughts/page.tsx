import { getThoughts } from "@/actions/thoughts";
import { ThoughtsPage } from "@/components/thoughts/ThoughtsPage";

export const dynamic = "force-dynamic";

export default async function ThoughtsIndexPage() {
  const thoughts = await getThoughts();
  return <ThoughtsPage thoughts={thoughts} />;
}
