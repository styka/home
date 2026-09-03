/**
 * 102 (AC-7, AC-8) → 123 — DOCIĄGNIĘCIE TRANSKRYPCJI FILMU.
 *
 * **Dlaczego to w ogóle jest trudne.** YouTube nie daje oficjalnej drogi do pobrania napisów
 * CUDZEGO filmu — udostępniony interfejs wymaga bycia właścicielem materiału. Pierwotny wariant
 * (102) czytał adres ścieżki napisów ze strony filmu i pobierał go GET-em. Od ~2025 te adresy
 * (wycięte z webowej odpowiedzi odtwarzacza) wymagają tokenu POT („proof of origin") — bez niego
 * YouTube odpowiada **200 z pustym ciałem**, więc film Z napisami wyglądał jak film bez nich
 * (zgłoszenie 123). Dlatego pobranie jest teraz ŁAŃCUCHEM trzech niezależnych dróg:
 *
 *   1. `strona`  — dotychczasowa: HTML strony filmu → `captionTracks` → GET adresu napisów.
 *   2. `player`  — wewnętrzny endpoint odtwarzacza (`youtubei/v1/player`) wywołany jako klient
 *                  ANDROID; adresy napisów z tego klienta nie wymagają POT.
 *   3. `panel`   — `youtubei/v1/get_transcript`, czyli dokładnie to, co wywołuje przycisk
 *                  „Wyświetl transkrypcję" w rozwiniętym opisie filmu.
 *
 * Pusty tekst na dowolnym etapie NIE kończy całości — spada do następnej drogi. Wynik niesie
 * `zrodlo`, żeby log skuteczności odświeżania mówił, która droga faktycznie niesie ruch — to
 * jedyny sposób wykrycia następnej zmiany po stronie YouTube zanim zgłosi ją użytkownik.
 *
 * **Najważniejsza decyzja projektowa tego pliku bez zmian: nic tu nie rzuca.** Każde niepowodzenie
 * na dowolnym kroku kończy się wartością `null`, którą wołający zamienia na stan „niedostepna".
 * Brak transkrypcji jest **normalnym stanem modułu**, nie awarią (AC-8) — lista filmów, ocena
 * „czy warto obejrzeć" i streszczenie z opisu działają dalej. Gdyby ten plik rzucał, jeden film
 * bez napisów wywracałby całe odświeżanie.
 *
 * Wiedza o kształcie odpowiedzi YouTube siedzi w funkcjach **czystych**, więc zmiana po tamtej
 * stronie objawi się przewracającym się testem na zapisanej próbce, a nie ciszą na produkcji.
 */
import { resilientFetch } from "@/lib/integrations/resilientFetch";

const UA = "Mozilla/5.0 (compatible; OmniaYoutubeBot/1.0; +https://worldofmag.onrender.com)";
/** UA klienta Android — endpoint odtwarzacza rozpoznaje klienta także po tym nagłówku. */
const UA_ANDROID = "com.google.android.youtube/20.10.38 (Linux; U; Android 11) gzip";
const WERSJA_ANDROID = "20.10.38";

const ADRES_PLAYER = "https://www.youtube.com/youtubei/v1/player?prettyPrint=false";
const ADRES_PANELU = "https://www.youtube.com/youtubei/v1/get_transcript?prettyPrint=false";

export interface OpcjePobrania {
  method?: "POST";
  body?: string;
  headers?: Record<string, string>;
}

/**
 * Wstrzykiwalny transport. Drugi parametr jest opcjonalny, żeby dotychczasowi wołający
 * (i testy z prostym `(url) => …`) działali bez zmian.
 */
export type PobierzTresc = (url: string, opcje?: OpcjePobrania) => Promise<string | null>;

export type ZrodloTranskrypcji = "strona" | "player" | "panel";

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
  /** Która droga łańcucha przyniosła tekst — zliczane w logu skuteczności odświeżania. */
  zrodlo: ZrodloTranskrypcji;
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
    return sciezkiZSurowych(JSON.parse(html.slice(otwarcie, koniec + 1)));
  } catch {
    return [];
  }
}

interface SurowaSciezka {
  baseUrl?: string;
  languageCode?: string;
  kind?: string;
}

function sciezkiZSurowych(surowe: unknown): SciezkaNapisow[] {
  if (!Array.isArray(surowe)) return [];
  return (surowe as SurowaSciezka[])
    .filter((s) => typeof s.baseUrl === "string" && s.baseUrl.length > 0)
    .map((s) => ({
      baseUrl: s.baseUrl as string,
      jezyk: s.languageCode ?? "",
      // "asr" = automatyczne rozpoznanie mowy.
      automatyczne: s.kind === "asr",
    }));
}

/**
 * Wycina ścieżki napisów z odpowiedzi endpointu odtwarzacza (droga `player`). CZYSTA.
 *
 * W przeciwieństwie do strony filmu to jest zwykły JSON, więc nie trzeba liczyć nawiasów —
 * ale kształt jest ten sam (`captionTracks`), więc dalszy ciąg (wybór ścieżki, składanie
 * tekstu) jest wspólny dla obu dróg.
 */
export function sciezkiNapisowZPlayerResponse(json: string): SciezkaNapisow[] {
  try {
    const dane = JSON.parse(json) as {
      captions?: { playerCaptionsTracklistRenderer?: { captionTracks?: unknown } };
    };
    return sciezkiZSurowych(dane.captions?.playerCaptionsTracklistRenderer?.captionTracks);
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

/**
 * Parametr żądania `get_transcript` (droga `panel`). CZYSTA.
 *
 * Endpoint przyjmuje identyfikator filmu opakowany w minimalny protobuf: pole 1 (tag `0x0a`)
 * o długości identyfikatora, zakodowany base64. Ręczne złożenie tych trzech bajtów jest tańsze
 * i pewniejsze niż zależność od biblioteki protobuf (C-53).
 */
export function paramsPanelu(videoId: string): string {
  const bajty = Buffer.from(videoId, "utf8");
  // Identyfikatory filmów mają 11 znaków ASCII; varint jednobajtowy wystarcza z ogromnym zapasem.
  const wiadomosc = Buffer.concat([Buffer.from([0x0a, bajty.length]), bajty]);
  return wiadomosc.toString("base64");
}

/**
 * Składa tekst z odpowiedzi `get_transcript` (droga `panel`). CZYSTA.
 *
 * Segmenty siedzą głęboko w drzewie rendererów UI (`transcriptSegmentRenderer.snippet.runs[]`),
 * a YouTube przestawia pośrednie poziomy częściej niż same segmenty — dlatego zamiast sztywnej
 * ścieżki przechodzimy drzewo rekurencyjnie i zbieramy segmenty w kolejności dokumentu.
 */
export function tekstZPanelu(json: string): string {
  let dane: unknown;
  try {
    dane = JSON.parse(json);
  } catch {
    return "";
  }

  const czesci: string[] = [];
  const zbierz = (wezel: unknown): void => {
    if (Array.isArray(wezel)) {
      for (const w of wezel) zbierz(w);
      return;
    }
    if (wezel === null || typeof wezel !== "object") return;
    const obiekt = wezel as Record<string, unknown>;
    const segment = obiekt.transcriptSegmentRenderer as
      | { snippet?: { runs?: Array<{ text?: string }> } }
      | undefined;
    if (segment) {
      const tekst = (segment.snippet?.runs ?? [])
        .map((r) => r.text ?? "")
        .join("")
        .trim();
      if (tekst) czesci.push(tekst);
      return;
    }
    for (const wartosc of Object.values(obiekt)) zbierz(wartosc);
  };
  zbierz(dane);

  return zlozTekst(czesci.join(" "));
}

function zlozTekst(surowy: string): string {
  return surowy
    .replace(/\r/g, " ")
    .replace(/\n+/g, " ")
    .replace(/[ \t]+/g, " ")
    .trim();
}

async function domyslnePobranie(url: string, opcje?: OpcjePobrania): Promise<string | null> {
  try {
    const res = await resilientFetch(url, {
      method: opcje?.method ?? "GET",
      body: opcje?.body,
      headers: opcje?.headers ?? { "User-Agent": UA, "Accept-Language": "pl,en;q=0.8" },
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

/** Ciała i nagłówki żądań do wewnętrznych endpointów — wydzielone, żeby łańcuch był czytelny. */
function zadaniePlayer(videoId: string): OpcjePobrania {
  return {
    method: "POST",
    body: JSON.stringify({
      context: {
        client: {
          clientName: "ANDROID",
          clientVersion: WERSJA_ANDROID,
          androidSdkVersion: 30,
          hl: "pl",
          gl: "PL",
        },
      },
      videoId,
    }),
    headers: {
      "Content-Type": "application/json",
      "User-Agent": UA_ANDROID,
      "X-YouTube-Client-Name": "3",
      "X-YouTube-Client-Version": WERSJA_ANDROID,
    },
  };
}

function zadaniePanelu(videoId: string): OpcjePobrania {
  return {
    method: "POST",
    body: JSON.stringify({
      context: { client: { clientName: "WEB", clientVersion: "2.20260101.00.00", hl: "pl", gl: "PL" } },
      params: paramsPanelu(videoId),
    }),
    headers: {
      "Content-Type": "application/json",
      "User-Agent": UA,
      "Accept-Language": "pl,en;q=0.8",
    },
  };
}

/**
 * Dociąga tekst wybranej ścieżki napisów. Wspólny ogon dróg `strona` i `player`.
 * Pusty tekst = `null`, żeby łańcuch spadł do następnej drogi zamiast zapisać pustą transkrypcję.
 */
async function zNapisow(
  sciezki: SciezkaNapisow[],
  pobierz: PobierzTresc,
  zrodlo: ZrodloTranskrypcji
): Promise<Transkrypcja | null> {
  const sciezka = wybierzSciezke(sciezki);
  if (!sciezka) return null;

  const tresc = await pobierz(sciezka.baseUrl);
  if (!tresc) return null;

  const tekst = tekstZNapisow(tresc);
  if (!tekst) return null;

  return { tekst, jezyk: sciezka.jezyk, automatyczna: sciezka.automatyczne, zrodlo };
}

/**
 * Pobiera transkrypcję filmu albo zwraca `null`.
 *
 * `null` znaczy „ten film nie dostanie transkrypcji" i jest odpowiedzią **oczekiwaną**, nie błędem:
 * film mógł mieć napisy wyłączone, YouTube mógł odmówić serwerowi, kształt strony mógł się zmienić.
 * We wszystkich tych przypadkach moduł ma dalej działać (AC-8). Trzy drogi próbowane po kolei;
 * każda porażka (w tym 200 z pustym ciałem) przechodzi do następnej.
 */
export async function pobierzTranskrypcje(
  videoId: string,
  pobierz: PobierzTresc = domyslnePobranie
): Promise<Transkrypcja | null> {
  // Droga 1: `strona` — darmowa, gdy działa; jej porażka niczego już nie przesądza.
  const html = await pobierz(adresStronyFilmu(videoId));
  if (html) {
    const t = await zNapisow(sciezkiNapisowZHtml(html), pobierz, "strona");
    if (t) return t;
  }

  // Droga 2: `player` (klient ANDROID) — adresy napisów bez wymogu POT.
  const odpowiedzPlayera = await pobierz(ADRES_PLAYER, zadaniePlayer(videoId));
  if (odpowiedzPlayera) {
    const t = await zNapisow(sciezkiNapisowZPlayerResponse(odpowiedzPlayera), pobierz, "player");
    if (t) return t;
  }

  // Droga 3: `panel` — endpoint przycisku „Wyświetl transkrypcję". Język nieznany (endpoint
  // zwraca gotowy panel, nie listę ścieżek), więc zostaje pusty — kolumna języka jest opcjonalna.
  const odpowiedzPanelu = await pobierz(ADRES_PANELU, zadaniePanelu(videoId));
  if (odpowiedzPanelu) {
    const tekst = tekstZPanelu(odpowiedzPanelu);
    if (tekst) return { tekst, jezyk: "", automatyczna: false, zrodlo: "panel" };
  }

  return null;
}
