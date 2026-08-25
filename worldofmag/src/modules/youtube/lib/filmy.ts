/**
 * 102 (AC-5, AC-6) — LISTA FILMÓW KANAŁU.
 *
 * YouTube udostępnia dla każdego kanału gotowy kanał RSS, więc to jest najprostsza część modułu:
 * nie ma tu nic do wymyślania, jest jeden adres i jeden dokument.
 *
 * **Parser RSS jest REUŻYTY, nie napisany od nowa** (C-53). `@/lib/news/rss` żyje w `src/lib/`,
 * a nie wewnątrz modułu Wiadomości, więc import nie łamie granicy modułów (C-36). Dokument YouTube
 * jest Atomem — a `parseRss` obsługuje Atom i RSS jednym kodem.
 *
 * Czego kanał RSS **nie** zawiera: czasu trwania filmu ani napisów. Czas trwania jest w tej wersji
 * pomijalny (nie występuje w żadnym kryterium akceptacji), a napisy dociąga `transkrypcja.ts`.
 */
import { fetchRss } from "@/lib/news/rss";

export interface FilmZKanalu {
  videoId: string;
  title: string;
  description: string;
  publishedAt: Date;
  thumbnailUrl: string;
}

/** Wyciąga identyfikator filmu z odnośnika. CZYSTA. */
export function idFilmuZOdnosnika(link: string): string | null {
  const m =
    /[?&]v=([A-Za-z0-9_-]{11})(?:[&#]|$)/.exec(link) ??
    /youtu\.be\/([A-Za-z0-9_-]{11})(?:[?#]|$)/.exec(link) ??
    /\/(?:embed|shorts|live)\/([A-Za-z0-9_-]{11})(?:[?#/]|$)/.exec(link);
  return m ? m[1] : null;
}

/** Adres kanału RSS z listą ostatnich filmów. CZYSTA. */
export function adresKanaluRss(channelId: string): string {
  return `https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(channelId)}`;
}

/**
 * Miniatura ma przewidywalny adres, więc nie trzeba jej wyciągać z dokumentu.
 * `hqdefault` istnieje dla każdego filmu — warianty w wyższej rozdzielczości nie zawsze.
 */
export function adresMiniatury(videoId: string): string {
  return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
}

/**
 * Pobiera listę filmów kanału. Zwraca pustą listę przy dowolnym niepowodzeniu — kanał, którego
 * akurat nie da się pobrać, nie może wywrócić przebiegu obejmującego wszystkie pozostałe.
 */
export async function filmyKanalu(channelId: string): Promise<FilmZKanalu[]> {
  const pozycje = await fetchRss(adresKanaluRss(channelId));
  const out: FilmZKanalu[] = [];
  for (const p of pozycje) {
    const videoId = idFilmuZOdnosnika(p.link);
    // Bez identyfikatora nie ma czego zapisać ani czym odróżnić duplikatu; bez daty nie da się
    // powiedzieć, co jest nowe — a to jedyne, o co pyta użytkownik tego modułu.
    if (!videoId || !p.publishedAt) continue;
    out.push({
      videoId,
      title: p.title,
      description: p.description,
      publishedAt: p.publishedAt,
      thumbnailUrl: adresMiniatury(videoId),
    });
  }
  return out;
}
