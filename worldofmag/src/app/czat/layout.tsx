import { CommandPaletteProvider } from "@/components/command-palette/CommandPaletteProvider";
import { wymagajDostepuDoModulu } from "@/lib/gatingTrasy";
import czatModule from "@/modules/czat/module";

/**
 * 107 — BRAMKA UPRAWNIENIA MODUŁU.
 *
 * Kontrola stoi w LAYOUCIE, nie w stronie: layout obejmuje także przyszłe podtrasy, a strona
 * tylko siebie. Nawigacja wygasza pozycje bez uprawnienia, ale to jest wyłącznie wygląd — adres
 * wpisany z ręki ją omija (lekcja z 098).
 */
export default async function CzatLayout({ children }: { children: React.ReactNode }) {
  await wymagajDostepuDoModulu(czatModule.permission);
  return <CommandPaletteProvider>{children}</CommandPaletteProvider>;
}
