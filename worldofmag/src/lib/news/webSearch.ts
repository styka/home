import { prisma } from "@/lib/prisma";
import { decryptSecret } from "@/lib/crypto/secrets";

// Wyszukiwarka internetowa do budowania BAZOWEJ bazy wiedzy (RSS ma tylko świeże
// pozycje — wyszukiwarka sięga do archiwum i szerszego internetu).
//
// Dwa tryby, z automatycznym wyborem:
//  1. Brave Search API — gdy w Config jest klucz `brave_search_api_key`
//     (darmowy tier ~2000 zapytań/mc, wiarygodny też z IP serwerowni).
//  2. DuckDuckGo (lite) — bez klucza, fallback. Bywa ograniczany dla IP
//     centrów danych, więc traktujemy go jako „best effort" i degradujemy do [].

export interface WebResult {
  title: string;
  url: string;
  snippet: string;
}

const UA =
  "Mozilla/5.0 (compatible; OmniaNewsBot/1.0; +https://worldofmag.onrender.com)";

function stripTags(s: string): string {
  return s
    .replace(/<[^>]*>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function braveSearch(key: string, query: string, limit: number): Promise<WebResult[]> {
  try {
    const url =
      `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}` +
      `&count=${limit}&country=pl&search_lang=pl`;
    const res = await fetch(url, {
      headers: { Accept: "application/json", "X-Subscription-Token": key },
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return [];
    const data = (await res.json()) as {
      web?: { results?: Array<{ title?: string; url?: string; description?: string }> };
    };
    return (data.web?.results ?? [])
      .filter((r) => r.url)
      .slice(0, limit)
      .map((r) => ({
        title: stripTags(r.title ?? r.url!),
        url: r.url!,
        snippet: stripTags(r.description ?? ""),
      }));
  } catch {
    return [];
  }
}

function decodeDdgHref(href: string): string | null {
  let h = href;
  if (h.startsWith("//")) h = "https:" + h;
  const m = /[?&]uddg=([^&]+)/.exec(h);
  if (m) {
    try {
      return decodeURIComponent(m[1]);
    } catch {
      return null;
    }
  }
  return h.startsWith("http") ? h : null;
}

async function duckDuckGo(query: string, limit: number): Promise<WebResult[]> {
  try {
    const res = await fetch("https://lite.duckduckgo.com/lite/", {
      method: "POST",
      headers: {
        "User-Agent": UA,
        "Content-Type": "application/x-www-form-urlencoded",
        "Accept-Language": "pl,en;q=0.8",
      },
      body: `q=${encodeURIComponent(query)}`,
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return [];
    const html = await res.text();
    const out: WebResult[] = [];
    const seen = new Set<string>();
    for (const m of Array.from(html.matchAll(/<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi))) {
      const url = decodeDdgHref(m[1]);
      if (!url) continue;
      let host = "";
      try {
        host = new URL(url).hostname;
      } catch {
        continue;
      }
      if (host.includes("duckduckgo.com")) continue;
      if (seen.has(url)) continue;
      const title = stripTags(m[2]);
      if (!title) continue;
      seen.add(url);
      out.push({ title, url, snippet: "" });
      if (out.length >= limit) break;
    }
    return out;
  } catch {
    return [];
  }
}

/** Wyszukuje w internecie; zwraca [] przy braku dostępu/wyników (nigdy nie rzuca). */
export async function webSearch(query: string, limit = 6): Promise<WebResult[]> {
  const q = query.trim();
  if (!q) return [];
  const key = await prisma.config
    .findUnique({ where: { key: "brave_search_api_key" } })
    .catch(() => null);
  if (key?.value) {
    const brave = await braveSearch(decryptSecret(key.value), q, limit);
    if (brave.length > 0) return brave;
  }
  return duckDuckGo(q, limit);
}

/** Czy skonfigurowano wiarygodną wyszukiwarkę (Brave). */
export async function hasConfiguredSearch(): Promise<boolean> {
  const key = await prisma.config
    .findUnique({ where: { key: "brave_search_api_key" } })
    .catch(() => null);
  return Boolean(key?.value);
}
