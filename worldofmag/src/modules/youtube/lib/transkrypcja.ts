/**
 * 102 (AC-7, AC-8) — DOCIĄGNIĘCIE TRANSKRYPCJI FILMU.
 *
 * **Dlaczego to w ogóle jest trudne.** YouTube nie daje oficjalnej drogi do pobrania napisów
 * CUDZEGO filmu — udostępniony interfejs wymaga bycia właścicielem materiału. Właściciel wybrał
 * wariant lekki: pobrać stronę filmu zwykłym żądaniem i odczytać z niej adres ścieżki napisów,
 * którą i tak wczytuje odtwarzacz. To ten sam wzorzec, którym `src/lib/news/article.ts` dociąga
 * treść artykułu — zero zależności, ułamki sekundy na film, mieści się w zadaniu w tle.
 *
 * **Najważniejsza decyzja projektowa tego pliku: nic tu nie rzuca.** Każde niepowodzenie na
 * dowolnym kroku kończy się wartością `null`, którą wołający zamienia na stan „niedostepna".
 * Brak transkrypcji jest **normalnym stanem modułu**, nie awarią (AC-8) — lista filmów, ocena
 * „czy warto obejrzeć" i streszczenie z opisu działają dalej. Gdyby ten plik rzucał, jeden film
 * bez napisów wywracałby całe odświeżanie.
 *
 * Wiedza o kształcie odpowiedzi YouTube siedzi w funkcjach **czystych**, więc zmiana po tamtej
 * stronie objawi się przewracającym się testem na zapisanej próbce, a nie ciszą na produkcji.
 */
import { resilientFetch } from "@/lib/integrations/resilientFetch";

const UA = "Mozilla/5.0 (compatible; OmniaYoutubeBot/1.0; +https://worldofmag.onrender.com)";

export type PobierzTresc = (url: string) => Promise<string | null>;

export interface SciezkaNapisow {
  baseUrl: string;
  jezyk: string;
  /** `true` dla napisów wygenerowanych automatycznie (rozpoznanie mowy). */
  automatyczne: boolean;
}

export interface Transkrypcja {
  tekst: string;
  jezyk: string;
  automatyczna: boolean;
}

/**
 * Wycina z HTML-a tablicę opisującą dostępne ścieżki napisów. CZYSTA.
 *
 * Tablica jest częścią większego dokumentu JSON osadzonego w stronie, więc wycinamy ją licząc
 * nawiasy — wyrażenie regularne „do pierwszego `]`" urwałoby się na pierwszej zagnieżdżonej
 * strukturze.
 */
export function sciezkiNapisowZHtml(html: string): SciezkaNapisow[] {
  const klucz = '"captionTracks":';
  const start = html.indexOf(klucz);
  if (start === -1) return [];

  const otwarcie = html.indexOf("[", start);
  if (otwarcie === -1) return [];

  let glebokosc = 0;
  let koniec = -1;
  let wCudzyslowie = false;
  let ucieczka = false;
  for (let i = otwarcie; i < html.length; i++) {
    const z = html[i];
    if (ucieczka) { ucieczka = false; continue; }
    if (z === "\\") { ucieczka = true; continue; }
    if (z === '"') { wCudzyslowie = !wCudzyslowie; continue; }
    if (wCudzyslowie) continue;
    if (z === "[") glebokosc++;
    else if (z === "]") {
      glebokosc--;
      if (glebokosc === 0) { koniec = i; break; }
    }
  }
  if (koniec === -1) return [];

  try {
    const surowe = JSON.parse(html.slice(otwarcie, koniec + 1)) as Array<{
      baseUrl?: string;
      languageCode?: string;
      kind?: string;
    }>;
    return surowe
      .filter((s) => typeof s.baseUrl === "string" && s.baseUrl.length > 0)
      .map((s) => ({
        baseUrl: s.baseUrl as string,
        jezyk: s.languageCode ?? "",
        // "asr" = automatyczne rozpoznanie mowy.
        automatyczne: s.kind === "asr",
      }));
  } catch {
    return [];
  }
}

/**
 * Wybiera ścieżkę wg preferencji językowej. CZYSTA.
 *
 * Kolejność: polski → angielski → cokolwiek. W obrębie języka **napisy autorskie przed
 * automatycznymi** — te drugie bywają bez interpunkcji i z przekręconymi nazwami własnymi, więc
 * jako materiał do streszczenia są wyraźnie gorsze.
 */
export function wybierzSciezke(
  sciezki: SciezkaNapisow[],
  preferencje: string[] = ["pl", "en"]
): SciezkaNapisow | null {
  if (sciezki.length === 0) return null;
  for (const jezyk of preferencje) {
    const wJezyku = sciezki.filter((s) => s.jezyk === jezyk || s.jezyk.startsWith(`${jezyk}-`));
    if (wJezyku.length === 0) continue;
    return wJezyku.find((s) => !s.automatyczne) ?? wJezyku[0];
  }
  return sciezki.find((s) => !s.automatyczne) ?? sciezki[0];
}

function odkodujEncje(s: string): string {
  return s
    .replace(/&amp;#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&");
}

/**
 * Składa czytelny tekst z odpowiedzi ze ścieżką napisów. CZYSTA.
 *
 * Obsługuje obie postacie, w jakich YouTube tę ścieżkę zwraca: XML (domyślna) i JSON. Bez tego
 * wybór formatu byłby zgadywaniem — a odpowiedź w drugiej postaci dałaby pusty tekst zamiast błędu,
 * czyli najgorszy możliwy wynik: film „z transkrypcją", która jest pusta.
 */
export function tekstZNapisow(tresc: string): string {
  const przyciete = tresc.trim();
  if (!przyciete) return "";

  if (przyciete.startsWith("{")) {
    try {
      const dane = JSON.parse(przyciete) as {
        events?: Array<{ segs?: Array<{ utf8?: string }> }>;
      };
      const czesci = (dane.events ?? []).flatMap((e) => (e.segs ?? []).map((s) => s.utf8 ?? ""));
      return zlozTekst(czesci.join(""));
    } catch {
      return "";
    }
  }

  const czesci = Array.from(przyciete.matchAll(/<text\b[^>]*>([\s\S]*?)<\/text>/gi)).map((m) =>
    odkodujEncje(m[1].replace(/<[^>]*>/g, " "))
  );
  return zlozTekst(czesci.join(" "));
}

function zlozTekst(surowy: string): string {
  return surowy
    .replace(/\r/g, " ")
    .replace(/\n+/g, " ")
    .replace(/[ \t]+/g, " ")
    .trim();
}

async function domyslnePobranie(url: string): Promise<string | null> {
  try {
    const res = await resilientFetch(url, {
      headers: { "User-Agent": UA, "Accept-Language": "pl,en;q=0.8" },
      cache: "no-store",
      timeoutMs: 12_000,
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

export function adresStronyFilmu(videoId: string): string {
  return `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`;
}

/**
 * Pobiera transkrypcję filmu albo zwraca `null`.
 *
 * `null` znaczy „ten film nie dostanie transkrypcji" i jest odpowiedzią **oczekiwaną**, nie błędem:
 * film mógł mieć napisy wyłączone, YouTube mógł odmówić serwerowi, kształt strony mógł się zmienić.
 * We wszystkich tych przypadkach moduł ma dalej działać (AC-8).
 */
export async function pobierzTranskrypcje(
  videoId: string,
  pobierz: PobierzTresc = domyslnePobranie
): Promise<Transkrypcja | null> {
  const html = await pobierz(adresStronyFilmu(videoId));
  if (!html) return null;

  const sciezka = wybierzSciezke(sciezkiNapisowZHtml(html));
  if (!sciezka) return null;

  const tresc = await pobierz(sciezka.baseUrl);
  if (!tresc) return null;

  const tekst = tekstZNapisow(tresc);
  if (!tekst) return null;

  return { tekst, jezyk: sciezka.jezyk, automatyczna: sciezka.automatyczne };
}
