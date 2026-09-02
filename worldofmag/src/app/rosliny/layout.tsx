import { CommandPaletteProvider } from "@/components/command-palette/CommandPaletteProvider";
import { wymagajDostepuDoModulu } from "@/lib/gatingTrasy";
import roslinyModule from "@/modules/rosliny/module";

/**
 * 113 (AC-27) — BRAMKA UPRAWNIENIA MODUŁU.
 *
 * Kontrola stoi w LAYOUCIE, nie w stronie, i to jest istotne: layout obejmuje także podtrasy
 * (`/rosliny/<przestrzeń>`, `/rosliny/opieka`, `/rosliny/ewidencja`), a strona tylko siebie.
 * Kontrola wyłącznie na stronie wpuszczałaby pod adres szczegółu wpisany z ręki — nawigacja
 * wygasza pozycje, ale to jest wyłącznie wygląd (lekcja z 098).
 */
export default async function RoslinyLayout({ children }: { children: React.ReactNode }) {
  await wymagajDostepuDoModulu(roslinyModule.permission);
  return <CommandPaletteProvider>{children}</CommandPaletteProvider>;
}
