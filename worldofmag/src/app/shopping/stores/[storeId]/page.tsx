import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getStore } from "@/actions/stores";
import { StoreMapEditor } from "@/components/shopping/StoreMapEditor";
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

  const resolvedStore = store as StoreWithGraph;

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ backgroundColor: "var(--bg-base)" }}>
      <div
        className="flex items-center gap-3 px-4 h-12 border-b flex-shrink-0"
        style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-surface)" }}
      >
        <a href="/shopping/stores" className="text-sm" style={{ color: "var(--text-muted)" }}>← Sklepy</a>
        <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{resolvedStore.name}</span>
      </div>
      <div className="flex-1 overflow-hidden">
        <StoreMapEditor store={resolvedStore} />
      </div>
    </div>
  );
}
