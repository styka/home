import shoppingModule from "@/modules/shopping/module";
import { wymagajDostepuDoModulu } from "@/lib/gatingTrasy";
import { CommandPaletteProvider } from "@/components/command-palette/CommandPaletteProvider";
import { OfflineSyncManager } from "@/modules/shopping/ui/OfflineSyncManager";

export default async function ShoppingLayout({ children }: { children: React.ReactNode }) {
  // 098: kontrola uprawnienia stoi na TRASIE, nie tylko w nawigacji — adres wpisany
  // z ręki omija menu. W layoucie, więc obejmuje też podtrasy.
  await wymagajDostepuDoModulu(shoppingModule.permission);

  return (
    <CommandPaletteProvider>
      {children}
      {/* 009-shopping-offline-sync: tryb offline + synchronizacja kolejki + wskaźnik */}
      <OfflineSyncManager />
    </CommandPaletteProvider>
  );
}
