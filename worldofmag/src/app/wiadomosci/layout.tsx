import { CommandPaletteProvider } from "@/components/command-palette/CommandPaletteProvider";

export default function WiadomosciLayout({ children }: { children: React.ReactNode }) {
  return <CommandPaletteProvider>{children}</CommandPaletteProvider>;
}
