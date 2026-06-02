// Dociąganie pełnej treści artykułu ze strony źródłowej (tylko dla kandydatów,
// którzy przeszli wstępne dopasowanie). Zwracamy oczyszczony tekst + og:image.
// Brak biblioteki — prosta ekstrakcja: usuwamy skrypty/style/nawigację, zostawiamy
// tekst. To wystarcza LLM-owi do oceny trafności/nowości i streszczenia.

const UA =
  "Mozilla/5.0 (compatible; OmniaNewsBot/1.0; +https://worldofmag.onrender.com)";

export interface FetchedArticle {
  text: string;
  imageUrl: string | null;
  publishedAt: Date | null;
}

// Data publikacji ze standardowych miejsc: meta article:published_time,
// JSON-LD datePublished, albo <time datetime="…">. Best-effort.
function extractPublishedAt(html: string): Date | null {
  const candidates = [
    metaContent(html, "article:published_time"),
    metaContent(html, "og:article:published_time"),
    metaContent(html, "datePublished"),
    /"datePublished"\s*:\s*"([^"]+)"/i.exec(html)?.[1] ?? null,
    /<time[^>]+datetime=["']([^"']+)["']/i.exec(html)?.[1] ?? null,
  ];
  for (const c of candidates) {
    if (!c) continue;
    const d = new Date(c);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return null;
}

function metaContent(html: string, prop: string): string | null {
  const re = new RegExp(
    `<meta[^>]+(?:property|name)=["']${prop}["'][^>]*content=["']([^"']+)["']`,
    "i"
  );
  const m = re.exec(html);
  if (m) return m[1];
  // odwrotna kolejność atrybutów (content przed property)
  const re2 = new RegExp(
    `<meta[^>]+content=["']([^"']+)["'][^>]*(?:property|name)=["']${prop}["']`,
    "i"
  );
  return re2.exec(html)?.[1] ?? null;
}

function extractText(html: string): string {
  let h = html;
  // wytnij sekcje bez treści
  h = h.replace(/<script[\s\S]*?<\/script>/gi, " ");
  h = h.replace(/<style[\s\S]*?<\/style>/gi, " ");
  h = h.replace(/<noscript[\s\S]*?<\/noscript>/gi, " ");
  h = h.replace(/<nav[\s\S]*?<\/nav>/gi, " ");
  h = h.replace(/<header[\s\S]*?<\/header>/gi, " ");
  h = h.replace(/<footer[\s\S]*?<\/footer>/gi, " ");
  h = h.replace(/<aside[\s\S]*?<\/aside>/gi, " ");
  // preferuj treść z <article>, jeśli jest
  const article = /<article[\s\S]*?<\/article>/i.exec(h)?.[0];
  const source = article && article.length > 400 ? article : h;
  const text = source
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
  return text.slice(0, 6000);
}

/** Pobiera artykuł. Przy błędzie zwraca pusty tekst (caller użyje opisu z RSS). */
export async function fetchArticle(url: string): Promise<FetchedArticle> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "text/html,*/*" },
      cache: "no-store",
      signal: AbortSignal.timeout(12_000),
    });
    if (!res.ok) return { text: "", imageUrl: null, publishedAt: null };
    const html = await res.text();
    return {
      text: extractText(html),
      imageUrl: metaContent(html, "og:image"),
      publishedAt: extractPublishedAt(html),
    };
  } catch {
    return { text: "", imageUrl: null, publishedAt: null };
  }
}
