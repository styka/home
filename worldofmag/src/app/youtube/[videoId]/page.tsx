export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { getFilm } from "@/modules/youtube/actions/filmy";
import { getDomyslnaDlugosc } from "@/modules/youtube/actions/ustawienia";
import { FilmSzczegol } from "@/modules/youtube/ui/FilmSzczegol";

export default async function FilmPage({ params }: { params: { videoId: string } }) {
  const [film, domyslnaDlugosc] = await Promise.all([getFilm(params.videoId), getDomyslnaDlugosc()]);
  // Film spoza własnej przestrzeni jest nieodróżnialny od nieistniejącego — i tak ma być:
  // odpowiedź „nie masz dostępu" potwierdzałaby, że taki rekord istnieje.
  if (!film) notFound();
  return <FilmSzczegol film={film} domyslnaDlugosc={domyslnaDlugosc} />;
}
