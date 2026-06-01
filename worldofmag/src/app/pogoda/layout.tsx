import { CommandPaletteProvider } from "@/components/command-palette/CommandPaletteProvider";

export default function PogodaLayout({ children }: { children: React.ReactNode }) {
  return <CommandPaletteProvider>{children}</CommandPaletteProvider>;
}
