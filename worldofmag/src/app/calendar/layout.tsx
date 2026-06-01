import { CommandPaletteProvider } from "@/components/command-palette/CommandPaletteProvider";

export default function CalendarLayout({ children }: { children: React.ReactNode }) {
  return <CommandPaletteProvider>{children}</CommandPaletteProvider>;
}
