// Tolerancyjny parser RSS 2.0 / Atom bez zewnętrznych zależności.
// Wyciąga pozycje z <item> (RSS) albo <entry> (Atom). Daty normalizujemy do Date;
// pozycje bez wiarygodnej daty publikacji odrzucamy później (twardy limit 24h).
import { resilientFetch } from "@/lib/integrations/resilientFetch"; // Z-157

export interface RssItem {
  title: string;
  link: string;
  publishedAt: Date | null;
  description: string;
}

function decodeEntities(s: string): string {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&amp;/g, "&")
    .trim();
}

function stripTags(s: string): string {
  return decodeEntities(s.replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim();
}

function pick(block: string, tag: string): string | null {
  const m = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i").exec(block);
  return m ? m[1] : null;
}

// Atom <link href="..."/>; preferuj rel="alternate" lub brak rel.
function pickAtomLink(block: string): string | null {
  const links = Array.from(block.matchAll(/<link\b([^>]*)\/?>(?:<\/link>)?/gi));
  let fallback: string | null = null;
  for (const l of links) {
    const attrs = l[1];
    const href = /href=["']([^"']+)["']/i.exec(attrs)?.[1];
    if (!href) continue;
    const rel = /rel=["']([^"']+)["']/i.exec(attrs)?.[1];
    if (!rel || rel === "alternate") return decodeEntities(href);
    fallback = decodeEntities(href);
  }
  return fallback;
}

function parseDate(raw: string | null): Date | null {
  if (!raw) return null;
  const d = new Date(raw.trim());
  return Number.isNaN(d.getTime()) ? null : d;
}

export function parseRss(xml: string): RssItem[] {
  const out: RssItem[] = [];
  const isAtom = /<entry[\s>]/i.test(xml) && !/<item[\s>]/i.test(xml);
  const blocks = Array.from(
    xml.matchAll(isAtom ? /<entry[\s\S]*?<\/entry>/gi : /<item[\s\S]*?<\/item>/gi)
  );
  for (const b of blocks) {
    const block = b[0];
    const title = stripTags(pick(block, "title") ?? "");
    const link = isAtom
      ? pickAtomLink(block)
      : decodeEntities(pick(block, "link") ?? "");
    const publishedAt = parseDate(
      pick(block, "pubDate") ?? pick(block, "published") ?? pick(block, "updated") ?? pick(block, "dc:date")
    );
    const description = stripTags(
      pick(block, "description") ?? pick(block, "summary") ?? pick(block, "content") ?? ""
    ).slice(0, 600);
    if (!title || !link) continue;
    out.push({ title, link, publishedAt, description });
  }
  return out;
}

const UA =
  "Mozilla/5.0 (compatible; OmniaNewsBot/1.0; +https://worldofmag.onrender.com)";

/** Pobiera i parsuje feed RSS. Zwraca [] przy błędzie sieci/parsowania. */
export async function fetchRss(url: string): Promise<RssItem[]> {
  try {
    const res = await resilientFetch(url, {
      headers: { "User-Agent": UA, Accept: "application/rss+xml, application/xml, text/xml, */*" },
      cache: "no-store",
      timeoutMs: 12_000,
    });
    if (!res.ok) return [];
    const xml = await res.text();
    return parseRss(xml);
  } catch {
    return [];
  }
}
