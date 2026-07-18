import { CommandPaletteProvider } from "@/components/command-palette/CommandPaletteProvider";
import { OfflineSyncManager } from "@/components/shopping/OfflineSyncManager";

export default function ShoppingLayout({ children }: { children: React.ReactNode }) {
  return (
    <CommandPaletteProvider>
      {children}
      {/* 009-shopping-offline-sync: tryb offline + synchronizacja kolejki + wskaźnik */}
      <OfflineSyncManager />
    </CommandPaletteProvider>
  );
}
