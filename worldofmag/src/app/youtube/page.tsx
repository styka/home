export const dynamic = "force-dynamic";

import { getFilmy, type StanFilmu, type SortFilmow } from "@/modules/youtube/actions/filmy";
import { YoutubePage } from "@/modules/youtube/ui/YoutubePage";

export default async function YoutubeRootPage({
  searchParams,
}: {
  // Stan widoku żyje w ADRESIE (filtr, porządek, szukana fraza), więc widok da się zapisać
  // w ulubionych. Wartości startowe MUSZĄ przyjść propsem z serwera — czytanie adresu na kliencie
  // w pierwszym renderze to rozjazd hydratacji (wpis z 2026-08-02 w `doświadczenia.md`).
  searchParams?: { stan?: string; sort?: string; q?: string };
}) {
  const stan = (searchParams?.stan as StanFilmu | undefined) ?? "nowy";
  const sort = (searchParams?.sort as SortFilmow | undefined) ?? "warto";
  const filmy = await getFilmy({ stan, sort, szukaj: searchParams?.q });

  return <YoutubePage poczatkowe={filmy} viewParams={searchParams ?? {}} />;
}
