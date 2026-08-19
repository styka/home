import notesModule from "@/modules/notes/module";
import { wymagajDostepuDoModulu } from "@/lib/gatingTrasy";
import { CommandPaletteProvider } from "@/components/command-palette/CommandPaletteProvider";

export default async function NotesLayout({ children }: { children: React.ReactNode }) {
  // 098: kontrola uprawnienia stoi na TRASIE, nie tylko w nawigacji — adres wpisany
  // z ręki omija menu. W layoucie, więc obejmuje też podtrasy.
  await wymagajDostepuDoModulu(notesModule.permission);

  return (
    <CommandPaletteProvider>
      {children}
    </CommandPaletteProvider>
  );
}
