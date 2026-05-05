import { CommandPaletteProvider } from "@/components/command-palette/CommandPaletteProvider";

export default function NotesLayout({ children }: { children: React.ReactNode }) {
  return (
    <CommandPaletteProvider>
      {children}
    </CommandPaletteProvider>
  );
}
