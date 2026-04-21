import { CommandPaletteProvider } from "@/components/command-palette/CommandPaletteProvider";

export default function ShoppingLayout({ children }: { children: React.ReactNode }) {
  return (
    <CommandPaletteProvider>
      {children}
    </CommandPaletteProvider>
  );
}
