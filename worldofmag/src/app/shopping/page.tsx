import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { createList } from "@/actions/lists";

export const dynamic = "force-dynamic";

export default async function ShoppingIndexPage() {
  let lists = await prisma.shoppingList.findMany({ orderBy: { createdAt: "asc" } });

  if (lists.length === 0) {
    const newList = await createList("Zakupy");
    redirect(`/shopping/${newList.id}`);
  }

  redirect(`/shopping/${lists[0].id}`);
}
