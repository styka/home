/**
 * 102 — przepisanie wiersza filmu na kształt, który dostaje przeglądarka.
 *
 * **Dlaczego to nie mieszka w pliku akcji.** Plik z `"use server"` nie eksportuje funkcji
 * synchronicznych, więc reguły w nim zawartej nie da się zaimportować do testu — jest
 * niesprawdzalna, choćby była prosta. Tutaj jest zwykłą funkcją i ma test obok.
 *
 * Reguła, którą ta funkcja niesie, jest jedna, ale istotna: **`maTranskrypcje` liczymy z TREŚCI,
 * nie ze stanu**. Stan bywa „jest", gdy pobranie się udało, ale treść mogła zostać potem
 * wyczyszczona przez retencję — a widok pyta o to, czy jest CO pokazać.
 */

export interface WierszFilmu {
  id: string;
  videoId: string;
  title: string;
  description: string;
  publishedAt: Date;
  thumbnailUrl: string | null;
  stan: string;
  transkrypcjaStan: string;
  transkrypcja: string | null;
  ocena: number | null;
  ocenaPowod: string | null;
  channel: { id: string; title: string };
}

export interface FilmDTO {
  id: string;
  videoId: string;
  title: string;
  description: string;
  publishedAt: string;
  thumbnailUrl: string | null;
  stan: string;
  transkrypcjaStan: string;
  maTranskrypcje: boolean;
  ocena: number | null;
  ocenaPowod: string | null;
  kanal: { id: string; title: string };
}

export function naDto(r: WierszFilmu): FilmDTO {
  return {
    id: r.id,
    videoId: r.videoId,
    title: r.title,
    description: r.description,
    publishedAt: r.publishedAt.toISOString(),
    thumbnailUrl: r.thumbnailUrl,
    stan: r.stan,
    transkrypcjaStan: r.transkrypcjaStan,
    // Patrz nagłówek: treść, nie stan.
    maTranskrypcje: !!r.transkrypcja,
    ocena: r.ocena,
    ocenaPowod: r.ocenaPowod,
    kanal: { id: r.channel.id, title: r.channel.title },
  };
}

/** Adres filmu na YouTube — jedna definicja dla widoku, asystenta i szczegółu. */
export function adresFilmu(videoId: string): string {
  return `https://www.youtube.com/watch?v=${videoId}`;
}
