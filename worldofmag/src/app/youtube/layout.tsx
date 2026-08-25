import { CommandPaletteProvider } from "@/components/command-palette/CommandPaletteProvider";
import { wymagajDostepuDoModulu } from "@/lib/gatingTrasy";
import youtubeModule from "@/modules/youtube/module";

/**
 * 102 (AC-16) — BRAMKA UPRAWNIENIA MODUŁU.
 *
 * Kontrola stoi w LAYOUCIE, nie w stronie, i to jest istotne: layout obejmuje także podtrasy
 * (`/youtube/<film>`, `/youtube/kanaly`), a strona tylko siebie. Kontrola wyłącznie na stronie
 * wpuszczałaby pod adres szczegółu wpisany z ręki — nawigacja wygasza pozycje, ale to jest
 * wyłącznie wygląd (lekcja z 098).
 */
export default async function YoutubeLayout({ children }: { children: React.ReactNode }) {
  await wymagajDostepuDoModulu(youtubeModule.permission);
  return <CommandPaletteProvider>{children}</CommandPaletteProvider>;
}
