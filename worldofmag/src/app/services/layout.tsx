import { CommandPaletteProvider } from "@/components/command-palette/CommandPaletteProvider";

export default function ServicesLayout({ children }: { children: React.ReactNode }) {
  return <CommandPaletteProvider>{children}</CommandPaletteProvider>;
}
