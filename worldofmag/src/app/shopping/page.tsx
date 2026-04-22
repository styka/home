import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getLists, createList } from "@/actions/lists";

export const dynamic = "force-dynamic";

export default async function ShoppingIndexPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/signin");

  const lists = await getLists();

  if (lists.length === 0) {
    const newList = await createList("Zakupy");
    redirect(`/shopping/${newList.id}`);
  }

  redirect(`/shopping/${lists[0].id}`);
}
