import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getStore } from "@/actions/stores";
import { StoreEditorClient } from "@/components/shopping/StoreEditorClient";
import type { StoreWithGraph } from "@/types";

export const dynamic = "force-dynamic";

interface Props { params: { storeId: string } }

async function fetchStore(storeId: string): Promise<StoreWithGraph | null> {
  try {
    return await getStore(storeId);
  } catch {
    return null;
  }
}

export default async function StoreEditorPage({ params }: Props) {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/signin");

  const store = await fetchStore(params.storeId);
  if (!store) notFound();

  return <StoreEditorClient store={store as StoreWithGraph} />;
}
