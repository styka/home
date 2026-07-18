"use client";

import { CloudOff, RefreshCw } from "lucide-react";

// 009-shopping-offline-sync — dyskretny wskaźnik trybu offline + licznik zmian oczekujących
// na synchronizację. Prezentacyjny: stan (online/pending/syncing) podaje OfflineSyncManager.
// Zmienne CSS (C-30), teksty PL (C-32), respektuje safe-area (C-31). Fixed pill, nie koliduje
// z FAB asystenta (prawy dół) — siedzi w dolnym-środku.

interface OfflineIndicatorProps {
  online: boolean;
  pending: number;
  syncing: boolean;
}

export function OfflineIndicator({ online, pending, syncing }: OfflineIndicatorProps) {
  // Pokazujemy tylko gdy jest co komunikować: offline, trwa sync, albo są zmiany w kolejce.
  const visible = !online || syncing || pending > 0;
  if (!visible) return null;

  const showSyncing = online && syncing;
  const accent = online ? "var(--accent-blue)" : "var(--accent-amber)";

  let label: string;
  if (!online) {
    label = pending > 0
      ? `Offline — ${pending} ${pending === 1 ? "zmiana czeka" : "zmian czeka"} na wysłanie`
      : "Offline — pracujesz lokalnie";
  } else if (showSyncing) {
    label = "Synchronizuję zmiany…";
  } else {
    label = `${pending} ${pending === 1 ? "zmiana do wysłania" : "zmian do wysłania"}`;
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed left-1/2 z-40 flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium shadow-lg pointer-events-none"
      style={{
        bottom: "calc(env(safe-area-inset-bottom, 0px) + 72px)",
        transform: "translateX(-50%)",
        backgroundColor: "var(--bg-elevated)",
        border: `1px solid ${accent}`,
        color: "var(--text-primary)",
      }}
    >
      {showSyncing ? (
        <RefreshCw size={13} className="animate-spin" style={{ color: accent }} />
      ) : (
        <CloudOff size={13} style={{ color: accent }} />
      )}
      <span>{label}</span>
    </div>
  );
}
