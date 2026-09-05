/**
 * 102 (AC-7, AC-8) → 123 (v3) — DOCIĄGNIĘCIE TRANSKRYPCJI FILMU.
 *
 * **Dlaczego to w ogóle jest trudne.** YouTube nie daje oficjalnej drogi do pobrania napisów
 * CUDZEGO filmu. Do tego dochodzą dwie blokady odkryte w 123: (1) adresy napisów z webowej
 * odpowiedzi odtwarzacza wymagają tokenu POT — bez niego przychodzi **200 z pustym ciałem**;
 * (2) YouTube odcina żądania z adresów IP centrów danych (ASN chmur — a Render jest chmurą)
 * już na pierwszym żądaniu, serwując ścianę „potwierdź, że nie jesteś botem" zamiast strony.
 *
 * Właściciel podpowiedział właściwą drogę: przycisk „Wyświetl transkrypcję" w rozwiniętym opisie
 * filmu. Ten przycisk wywołuje `youtubei/v1/get_transcript` z parametrem `params`, który strona
 * (albo odpowiedź `youtubei/v1/next`) niesie w polu `getTranscriptEndpoint` — v2 wyciąga więc
 * PRAWDZIWE `params` zamiast zgadywać, a dopiero w ostateczności buduje je ręcznie wg przepisu
 * z Invidiousa (protobuf: videoId + zagnieżdżony {kind, język} w base64 + identyfikator panelu).
 * Łańcuch dróg, od najtańszej:
 *
 *   1. `strona`    — HTML strony filmu → `captionTracks` → GET adresu napisów; gdy napisy puste
 *                    (POT), z TEGO SAMEGO HTML-a wyciągamy `getTranscriptEndpoint.params` → panel.
 *   2. `instancja` — v3: publiczne instancje Piped/Invidious; z serwerowego IP najpewniejsza
 *                    droga, bo instancja pobiera z YouTube po swojej stronie i serwuje napisy
 *                    przez własne proxy — YouTube nie widzi adresu Rendera.
 *   3. `player`    — `youtubei/v1/player` jako klient ANDROID (adresy bez wymogu POT).
 *   4. `panel`     — `youtubei/v1/get_transcript`: params z HTML-a / z `next`, na końcu ręczne
 *                    (pl/en × autorskie/automatyczne).
 *
 * v3 dokłada też transport konfigurowalny bez deployu (`transkrypcjaTransport.ts`): klucz Config
 * `youtube_proxy_secret` kieruje żądania DO YOUTUBE przez proxy (np. rotujące rezydenckie
 * Webshare — standard branżowy przy blokadzie IP), a `youtube_transcript_instances` nadpisuje
 * listę instancji.
 *
 * Pusty tekst na dowolnym etapie NIE kończy całości — spada do następnej drogi. Wynik niesie
 * `zrodlo`, a łańcuch może zbierać **diagnozę** (dlaczego każda droga odpadła) — bo środowisko
 * budowy nie widzi youtube.com i jedynym mikroskopem jest log z produkcji.
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

/**
 * Przeglądarkowy UA zamiast dawnego jawnie botowego „OmniaYoutubeBot": deklaracja bota
 * gwarantowała ścianę anty-botową na starcie. Standardowa praktyka wszystkich bibliotek
 * transkrypcji; wolumen pozostaje śladowy (limit 25 filmów na przebieg).
 */
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
/** UA klienta Android — endpoint odtwarzacza rozpoznaje klienta także po tym nagłówku. */
const UA_ANDROID = "com.google.android.youtube/20.10.38 (Linux; U; Android 11) gzip";
const WERSJA_ANDROID = "20.10.38";
/** Wersja klienta WEB (za Invidiousem) — do `next` i `get_transcript`. */
const WERSJA_WEB = "2.20260722.01.00";
/** Ciasteczko zgody: bez niego EU dostaje przekierowanie na consent.youtube.com zamiast strony. */
const CIASTECZKO_ZGODY = "SOCS=CAI";

const ADRES_PLAYER = "https://www.youtube.com/youtubei/v1/player?prettyPrint=false";
const ADRES_NEXT = "https://www.youtube.com/youtubei/v1/next?prettyPrint=false";
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

export type ZrodloTranskrypcji = "strona" | "player" | "panel" | "instancja";

/**
 * 123 v3 — publiczna instancja Piped/Invidious jako droga pozyskania napisów.
 *
 * To jest odpowiedź na blokadę adresów IP centrów danych: instancje same utrzymują obejścia
 * po swojej stronie i serwują treść napisów przez własne proxy, więc YouTube nigdy nie widzi
 * adresu Rendera. Cena: publiczne instancje bywają ulotne — dlatego lista jest DANYMI
 * (nadpisywalna kluczem Config `youtube_transcript_instances`, JSON tablica "typ:adres"),
 * a nie stałą wymagającą deployu.
 */
export interface Instancja {
  typ: "piped" | "invidious";
  baza: string;
}

/** Kilka najstabilniejszych publicznych instancji (stan: 2026-09, oficjalne listy projektów). */
export const DOMYSLNE_INSTANCJE: Instancja[] = [
  { typ: "piped", baza: "https://pipedapi.kavin.rocks" },
  { typ: "piped", baza: "https://pipedapi.adminforge.de" },
  { typ: "piped", baza: "https://api.piped.private.coffee" },
  { typ: "invidious", baza: "https://inv.nadeko.net" },
  { typ: "invidious", baza: "https://invidious.nerdvpn.de" },
];

/** Parsuje listę instancji z Config (JSON tablica "piped:https://…" / "invidious:https://…"). CZYSTA. */
export function listaInstancji(zConfig: string | null | undefined): Instancja[] {
  if (!zConfig) return DOMYSLNE_INSTANCJE;
  try {
    const surowe = JSON.parse(zConfig) as unknown;
    if (!Array.isArray(surowe)) return DOMYSLNE_INSTANCJE;
    const wynik: Instancja[] = [];
    for (const wpis of surowe) {
      if (typeof wpis !== "string") continue;
      const m = wpis.match(/^(piped|invidious):(https?:\/\/.+)$/);
      if (m) wynik.push({ typ: m[1] as Instancja["typ"], baza: m[2].replace(/\/$/, "") });
    }
    return wynik.length > 0 ? wynik : DOMYSLNE_INSTANCJE;
  } catch {
    return DOMYSLNE_INSTANCJE;
  }
}

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
 * Ścieżki napisów z odpowiedzi Piped `/streams/{id}`. CZYSTA.
 *
 * Adres treści bywa względny wobec instancji — uzupełniamy go bazą, żeby `wybierzSciezke`
 * i wspólny ogon pobrania działały identycznie jak dla dróg bezpośrednich.
 */
export function sciezkiZPiped(json: string, baza: string): SciezkaNapisow[] {
  try {
    const dane = JSON.parse(json) as {
      subtitles?: Array<{ url?: string; code?: string; autoGenerated?: boolean }>;
    };
    if (!Array.isArray(dane.subtitles)) return [];
    return dane.subtitles
      .filter((s) => typeof s.url === "string" && s.url.length > 0)
      .map((s) => ({
        baseUrl: (s.url as string).startsWith("http") ? (s.url as string) : `${baza}${s.url}`,
        jezyk: s.code ?? "",
        automatyczne: s.autoGenerated === true,
      }));
  } catch {
    return [];
  }
}

/**
 * Ścieżki napisów z odpowiedzi Invidiousa `/api/v1/captions/{id}`. CZYSTA.
 *
 * Adresy są względne (`/api/v1/captions/…`), a automatyczność nie ma osobnego pola —
 * niesie ją etykieta („Polish (auto-generated)").
 */
export function sciezkiZInvidious(json: string, baza: string): SciezkaNapisow[] {
  try {
    const dane = JSON.parse(json) as {
      captions?: Array<{ label?: string; languageCode?: string; url?: string }>;
    };
    if (!Array.isArray(dane.captions)) return [];
    return dane.captions
      .filter((s) => typeof s.url === "string" && s.url.length > 0)
      .map((s) => ({
        baseUrl: (s.url as string).startsWith("http") ? (s.url as string) : `${baza}${s.url}`,
        jezyk: s.languageCode ?? "",
        automatyczne: /auto/i.test(s.label ?? ""),
      }));
  } catch {
    return [];
  }
}

/**
 * Odczytuje z odpowiedzi odtwarzacza POWÓD odmowy (diagnostyka). CZYSTA.
 *
 * `LOGIN_REQUIRED` z komunikatem o bocie to podpis blokady adresów IP centrów danych — jedyna
 * informacja pozwalająca odróżnić „film nie ma napisów" od „YouTube odcina nasz serwer".
 */
export function powodOdmowyZPlayerResponse(json: string): string | null {
  try {
    const dane = JSON.parse(json) as {
      playabilityStatus?: { status?: string; reason?: string };
    };
    const st = dane.playabilityStatus;
    if (!st?.status || st.status === "OK") return null;
    return st.reason ? `${st.status}: ${st.reason}` : st.status;
  } catch {
    return null;
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
 * Obsługuje trzy postacie: XML (domyślna z YouTube), JSON (json3) i WebVTT (tak serwują napisy
 * instancje Piped/Invidious). Bez tego wybór formatu byłby zgadywaniem — a odpowiedź w innej
 * postaci dałaby pusty tekst zamiast błędu, czyli najgorszy możliwy wynik: film „z transkrypcją",
 * która jest pusta.
 */
export function tekstZNapisow(tresc: string): string {
  const przyciete = tresc.trim();
  if (!przyciete) return "";

  if (przyciete.startsWith("WEBVTT")) return tekstZVtt(przyciete);

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

/** Varint protobuf (długości i małe liczby). CZYSTA. */
function varint(n: number): number[] {
  const bajty: number[] = [];
  let v = n;
  do {
    let b = v & 0x7f;
    v >>>= 7;
    if (v > 0) b |= 0x80;
    bajty.push(b);
  } while (v > 0);
  return bajty;
}

function poleTekstowe(nrPola: number, wartosc: string): Buffer {
  const tresc = Buffer.from(wartosc, "utf8");
  return Buffer.concat([Buffer.from([(nrPola << 3) | 2, ...varint(tresc.length)]), tresc]);
}

/**
 * Parametr żądania `get_transcript` budowany RĘCZNIE (ostatnia deska ratunku). CZYSTA.
 *
 * Pełny przepis za Invidiousem (`produce_transcript_params`), nie sam identyfikator filmu —
 * uboższa wersja z pierwszego podejścia 123 nie działała:
 *   pole 1: videoId · pole 2: base64url zagnieżdżonego {1: kind ("asr"|""), 2: język} ·
 *   pole 3: varint 1 · pole 5: "engagement-panel-searchable-transcript-search-panel";
 * całość → base64url (z paddingiem) → procentowanie (`=` → `%3D`), bo tak wyglądają
 * params, które YouTube sam wkłada w `getTranscriptEndpoint`.
 */
export function paramsPanelu(videoId: string, jezyk = "pl", automatyczne = false): string {
  const wewnetrzny = Buffer.concat([
    poleTekstowe(1, automatyczne ? "asr" : ""),
    poleTekstowe(2, jezyk),
  ]);
  const zewnetrzny = Buffer.concat([
    poleTekstowe(1, videoId),
    poleTekstowe(2, base64urlZPaddingiem(wewnetrzny)),
    Buffer.from([0x18, 0x01]),
    poleTekstowe(5, "engagement-panel-searchable-transcript-search-panel"),
  ]);
  return encodeURIComponent(base64urlZPaddingiem(zewnetrzny));
}

/** Node `base64url` ucina padding, a YouTube (jak Crystal `urlsafe_encode`) go oczekuje. */
function base64urlZPaddingiem(b: Buffer): string {
  const base = b.toString("base64url");
  return base + "=".repeat((4 - (base.length % 4)) % 4);
}

/**
 * Wyciąga PRAWDZIWE `params` panelu transkrypcji z dokumentu YouTube. CZYSTA.
 *
 * Działa i na HTML-u strony filmu (ytInitialData), i na surowej odpowiedzi `youtubei/v1/next` —
 * celowo po tekście, nie po ścieżce w drzewie: YouTube przestawia pośrednie poziomy częściej niż
 * sam `getTranscriptEndpoint`. To są dokładnie te params, których używa przycisk
 * „Wyświetl transkrypcję" wskazany przez właściciela.
 */
export function paramsPaneluZDokumentu(dokument: string): string | null {
  const m = dokument.match(/"getTranscriptEndpoint"\s*:\s*\{[^{}]*?"params"\s*:\s*"([^"]+)"/);
  if (!m) return null;
  try {
    // Wartość może nieść ucieczki JSON (= itp.) — odkodowujemy je jak parser JSON.
    return JSON.parse(`"${m[1]}"`) as string;
  } catch {
    return m[1];
  }
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

/**
 * Składa tekst z WebVTT. CZYSTA.
 *
 * Pomija nagłówek, znaczniki czasu, numery bloków i NOTE; zdejmuje tagi (`<c>`, `<00:00:01.000>`).
 * Automatyczne napisy YouTube w VTT bywają „rolowane" (ta sama linia powtórzona w sąsiednich
 * blokach) — sąsiadujące duplikaty są sklejane, inaczej tekst rośnie dwukrotnie.
 */
function tekstZVtt(vtt: string): string {
  const linie = vtt.split(/\r?\n/);
  const czesci: string[] = [];
  // Nagłówek (WEBVTT + metadane typu „Kind: captions") kończy się pierwszą pustą linią —
  // dopiero za nią zaczynają się bloki napisów. Filtrowanie po treści by tu nie wystarczyło,
  // bo dwukropek jest legalny także w wypowiedzianym tekście.
  let wNaglowku = true;
  for (const linia of linie) {
    const p = linia.trim();
    if (wNaglowku) {
      if (!p) wNaglowku = false;
      continue;
    }
    if (!p || p.startsWith("NOTE") || p.startsWith("STYLE") || p.startsWith("REGION")) continue;
    if (p.includes("-->") || /^\d+$/.test(p)) continue;
    const tekst = odkodujEncje(p.replace(/<[^>]*>/g, "")).trim();
    if (!tekst) continue;
    if (czesci[czesci.length - 1] === tekst) continue;
    czesci.push(tekst);
  }
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
      headers: opcje?.headers ?? {
        "User-Agent": UA,
        "Accept-Language": "pl,en;q=0.8",
        Cookie: CIASTECZKO_ZGODY,
      },
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

function kontekstWeb() {
  return { client: { clientName: "WEB", clientVersion: WERSJA_WEB, hl: "pl", gl: "PL" } };
}

function naglowkiWeb(): Record<string, string> {
  return {
    "Content-Type": "application/json",
    "User-Agent": UA,
    "Accept-Language": "pl,en;q=0.8",
    Cookie: CIASTECZKO_ZGODY,
    "X-YouTube-Client-Name": "1",
    "X-YouTube-Client-Version": WERSJA_WEB,
  };
}

function zadanieNext(videoId: string): OpcjePobrania {
  return {
    method: "POST",
    body: JSON.stringify({ context: kontekstWeb(), videoId }),
    headers: naglowkiWeb(),
  };
}

function zadaniePanelu(params: string): OpcjePobrania {
  return {
    method: "POST",
    body: JSON.stringify({ context: kontekstWeb(), params }),
    headers: naglowkiWeb(),
  };
}

/**
 * Dociąga tekst wybranej ścieżki napisów. Wspólny ogon dróg `strona` i `player`.
 * Pusty tekst = `null`, żeby łańcuch spadł do następnej drogi zamiast zapisać pustą transkrypcję.
 */
async function zNapisow(
  sciezki: SciezkaNapisow[],
  pobierz: PobierzTresc,
  zrodlo: ZrodloTranskrypcji,
  diagnoza?: string[]
): Promise<Transkrypcja | null> {
  const sciezka = wybierzSciezke(sciezki);
  if (!sciezka) {
    diagnoza?.push(`${zrodlo}: brak sciezek napisow`);
    return null;
  }

  const tresc = await pobierz(sciezka.baseUrl);
  if (!tresc) {
    diagnoza?.push(`${zrodlo}: napisy ${tresc === "" ? "puste (POT?)" : "nieosiagalne"}`);
    return null;
  }

  const tekst = tekstZNapisow(tresc);
  if (!tekst) {
    diagnoza?.push(`${zrodlo}: napisy bez tekstu (${tresc.length} B)`);
    return null;
  }

  return { tekst, jezyk: sciezka.jezyk, automatyczna: sciezka.automatyczne, zrodlo };
}

/**
 * Droga `instancja`: kolejne publiczne instancje aż do pierwszej, która ODPOWIE listą napisów.
 *
 * Ważne rozróżnienie: instancja, która odpowiedziała poprawną listą (choćby pustą), jest
 * AUTORYTATYWNA — pusta lista znaczy „film nie ma napisów" i kończy tę drogę; dalej próbujemy
 * tylko wtedy, gdy instancja nie działa (błąd/nieparsowalna odpowiedź) albo sama treść napisów
 * nie dojechała (zepsute proxy tej jednej instancji).
 */
async function zInstancji(
  videoId: string,
  instancje: Instancja[],
  pobierz: PobierzTresc,
  diagnoza?: string[]
): Promise<Transkrypcja | null> {
  for (const inst of instancje) {
    const adresListy =
      inst.typ === "piped"
        ? `${inst.baza}/streams/${encodeURIComponent(videoId)}`
        : `${inst.baza}/api/v1/captions/${encodeURIComponent(videoId)}`;
    const lista = await pobierz(adresListy);
    if (!lista) {
      diagnoza?.push(`instancja(${inst.baza}): nieosiagalna`);
      continue;
    }
    const maListe =
      inst.typ === "piped" ? /"subtitles"\s*:/.test(lista) : /"captions"\s*:/.test(lista);
    if (!maListe) {
      diagnoza?.push(`instancja(${inst.baza}): odpowiedz bez listy (${lista.length} B)`);
      continue;
    }
    const sciezki =
      inst.typ === "piped" ? sciezkiZPiped(lista, inst.baza) : sciezkiZInvidious(lista, inst.baza);
    if (sciezki.length === 0) {
      diagnoza?.push(`instancja(${inst.baza}): film bez napisow (autorytatywnie)`);
      return null;
    }
    const t = await zNapisow(sciezki, pobierz, "instancja", diagnoza);
    if (t) return t;
    // Lista była, treść nie dojechała — to wina proxy TEJ instancji, próbujemy następną.
  }
  return null;
}

/** Jedno uderzenie w `get_transcript` z gotowymi params. */
async function zPanelu(
  params: string,
  pobierz: PobierzTresc,
  diagnoza: string[] | undefined,
  etykieta: string
): Promise<string | null> {
  const odpowiedz = await pobierz(ADRES_PANELU, zadaniePanelu(params));
  if (!odpowiedz) {
    diagnoza?.push(`panel(${etykieta}): brak odpowiedzi`);
    return null;
  }
  const tekst = tekstZPanelu(odpowiedz);
  if (!tekst) diagnoza?.push(`panel(${etykieta}): bez segmentow (${odpowiedz.length} B)`);
  return tekst || null;
}

/**
 * Pobiera transkrypcję filmu albo zwraca `null`.
 *
 * `null` znaczy „ten film nie dostanie transkrypcji" i jest odpowiedzią **oczekiwaną**, nie błędem.
 * Opcjonalna tablica `diagnoza` zbiera po drodze powody odpadnięcia każdej drogi — job loguje z niej
 * próbkę, bo to jedyny sposób odróżnienia „film bez napisów" od „YouTube odcina serwer".
 */
export async function pobierzTranskrypcje(
  videoId: string,
  pobierz: PobierzTresc = domyslnePobranie,
  diagnoza?: string[],
  instancje: Instancja[] = DOMYSLNE_INSTANCJE
): Promise<Transkrypcja | null> {
  // Droga 1: `strona` — jedno pobranie daje i captionTracks, i params panelu.
  const html = await pobierz(adresStronyFilmu(videoId));
  if (html) {
    const t = await zNapisow(sciezkiNapisowZHtml(html), pobierz, "strona", diagnoza);
    if (t) return t;

    const paramsZeStrony = paramsPaneluZDokumentu(html);
    if (paramsZeStrony) {
      const tekst = await zPanelu(paramsZeStrony, pobierz, diagnoza, "strona");
      if (tekst) return { tekst, jezyk: "", automatyczna: false, zrodlo: "panel" };
    } else {
      diagnoza?.push(`strona: bez params panelu (${html.length} B)`);
    }
  } else {
    diagnoza?.push("strona: nieosiagalna");
  }

  // Droga 2: `instancja` — publiczne Piped/Invidious; z serwerowego IP to najpewniejsza droga,
  // bo YouTube widzi adres instancji, nie nasz (123 v3).
  const zInstancjiWynik = await zInstancji(videoId, instancje, pobierz, diagnoza);
  if (zInstancjiWynik) return zInstancjiWynik;

  // Droga 3: `player` (klient ANDROID) — adresy napisów bez wymogu POT.
  const odpowiedzPlayera = await pobierz(ADRES_PLAYER, zadaniePlayer(videoId));
  if (odpowiedzPlayera) {
    const odmowa = powodOdmowyZPlayerResponse(odpowiedzPlayera);
    if (odmowa) diagnoza?.push(`player: ${odmowa}`);
    const t = await zNapisow(sciezkiNapisowZPlayerResponse(odpowiedzPlayera), pobierz, "player", diagnoza);
    if (t) return t;
  } else {
    diagnoza?.push("player: nieosiagalny");
  }

  // Droga 4a: `panel` z params z odpowiedzi `next` — dokładnie droga przycisku z UI.
  const odpowiedzNext = await pobierz(ADRES_NEXT, zadanieNext(videoId));
  const paramsZNext = odpowiedzNext ? paramsPaneluZDokumentu(odpowiedzNext) : null;
  if (paramsZNext) {
    const tekst = await zPanelu(paramsZNext, pobierz, diagnoza, "next");
    if (tekst) return { tekst, jezyk: "", automatyczna: false, zrodlo: "panel" };
  } else {
    diagnoza?.push(odpowiedzNext ? `next: bez params panelu (${odpowiedzNext.length} B)` : "next: nieosiagalny");
  }

  // Droga 4b: `panel` z params budowanymi ręcznie — preferencja jak w wybierzSciezke:
  // polski przed angielskim, autorskie przed automatycznymi.
  const kombinacje: Array<{ jezyk: string; automatyczne: boolean }> = [
    { jezyk: "pl", automatyczne: false },
    { jezyk: "pl", automatyczne: true },
    { jezyk: "en", automatyczne: false },
    { jezyk: "en", automatyczne: true },
  ];
  for (const k of kombinacje) {
    const etykieta = `${k.jezyk}${k.automatyczne ? "/asr" : ""}`;
    const tekst = await zPanelu(paramsPanelu(videoId, k.jezyk, k.automatyczne), pobierz, diagnoza, etykieta);
    if (tekst) return { tekst, jezyk: k.jezyk, automatyczna: k.automatyczne, zrodlo: "panel" };
  }

  return null;
}
