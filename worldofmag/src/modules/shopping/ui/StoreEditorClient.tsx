"use client";

import { useState } from "react";
import Link from "next/link";
import { StoreWizard } from "./StoreWizard";
import { StoreGraphView } from "./StoreGraphView";
import type { StoreWithGraph } from "@/types";

interface StoreEditorClientProps {
  store: StoreWithGraph;
}

export function StoreEditorClient({ store }: StoreEditorClientProps) {
  const [showWizard, setShowWizard] = useState(store.nodes.length === 0);

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ backgroundColor: "var(--bg-base)" }}>
      {/* Header */}
      <div
        className="flex items-center gap-3 px-4 h-12 border-b flex-shrink-0"
        style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-surface)" }}
      >
        <Link href="/shopping/stores" className="text-sm" style={{ color: "var(--text-muted)" }}>
          ← Sklepy
        </Link>
        <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
          {store.name}
        </span>
        {store.nodes.length > 0 && !showWizard && (
          <button
            onClick={() => setShowWizard(true)}
            style={{
              marginLeft: "auto",
              fontSize: 12,
              padding: "4px 10px",
              borderRadius: 6,
              border: "1px solid var(--border)",
              background: "var(--bg-elevated)",
              color: "var(--text-secondary)",
              cursor: "pointer",
            }}
          >
            🔄 Przebuduj mapę
          </button>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {showWizard ? (
          <StoreWizard
            storeId={store.id}
            storeName={store.name}
            initialStore={store}
          />
        ) : (
          <div style={{ maxWidth: 900, margin: "0 auto", padding: "24px 16px" }}>
            <StoreGraphView store={store} onRebuild={() => setShowWizard(true)} />
          </div>
        )}
      </div>
    </div>
  );
}
