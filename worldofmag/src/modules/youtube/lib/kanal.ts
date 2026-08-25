/**
 * 102 (AC-1) — ROZWIĄZANIE ADRESU KANAŁU NA JEGO IDENTYFIKATOR.
 *
 * Kanał RSS YouTube (`feeds/videos.xml?channel_id=…`) przyjmuje **wyłącznie** identyfikator postaci
 * `UC…`. Użytkownik natomiast wkleja to, co ma pod ręką: pełny adres, `@uchwyt`, stary adres
 * `/c/nazwa` albo `/user/nazwa`. Wszystkie te postacie poza `UC…` wymagają zajrzenia na stronę
 * kanału, bo tylko ona zna właściwy identyfikator.
 *
 * **Podział na część czystą i część sięgającą do sieci jest celowy.** Cała wiedza o kształcie
 * stron YouTube siedzi w funkcjach bez wejścia/wyjścia, więc da się je sprawdzić testem na
 * zapisanej próbce. Test odpytujący żywy YouTube nie przechodzi w piaskownicy, a w CI byłby
 * migotliwy — i tak czy inaczej sprawdzałby cudzy serwis zamiast naszego kodu.
 */
import { resilientFetch } from "@/lib/integrations/resilientFetch";

/** Pobranie strony wstrzykiwane jako zależność — testy podają własne. */
export type PobierzStrone = (url: string) => Promise<string | null>;

const UA = "Mozilla/5.0 (compatible; OmniaYoutubeBot/1.0; +https://worldofmag.onrender.com)";

export interface RozwiazanyKanal {
  channelId: string;
  title: string | null;
  handle: string | null;
}

/** Identyfikator kanału to zawsze `UC` + 22 znaki. */
const WZORZEC_ID = /^UC[A-Za-z0-9_-]{22}$/;

export function czyIdentyfikatorKanalu(tekst: string): boolean {
  return WZORZEC_ID.test(tekst.trim());
}

/**
 * Rozpoznaje, co użytkownik wkleił. CZYSTA.
 *
 * Zwraca albo gotowy identyfikator (nie trzeba nic pobierać), albo adres strony, na której
 * identyfikatora trzeba poszukać, albo `null` gdy wejście nie wygląda na kanał YouTube.
 */
export function rozpoznajAdresKanalu(
  wejscie: string
): { rodzaj: "id"; id: string } | { rodzaj: "strona"; url: string; handle: string | null } | null {
  const t = wejscie.trim();
  if (!t) return null;

  if (czyIdentyfikatorKanalu(t)) return { rodzaj: "id", id: t };

  // Sam uchwyt, bez adresu.
  if (/^@[A-Za-z0-9._-]+$/.test(t)) {
    return { rodzaj: "strona", url: `https://www.youtube.com/${t}`, handle: t };
  }

  let u: URL;
  try {
    u = new URL(t.startsWith("http") ? t : `https://${t}`);
  } catch {
    return null;
  }
  if (!/(^|\.)youtube\.com$/.test(u.hostname) && u.hostname !== "youtu.be") return null;

  const sciezka = u.pathname.replace(/\/+$/, "");

  const poId = /^\/channel\/(UC[A-Za-z0-9_-]{22})$/.exec(sciezka);
  if (poId) return { rodzaj: "id", id: poId[1] };

  const poUchwycie = /^\/(@[A-Za-z0-9._-]+)$/.exec(sciezka);
  if (poUchwycie) {
    return { rodzaj: "strona", url: `https://www.youtube.com/${poUchwycie[1]}`, handle: poUchwycie[1] };
  }

  if (/^\/(c|user)\/[^/]+$/.test(sciezka)) {
    return { rodzaj: "strona", url: `https://www.youtube.com${sciezka}`, handle: null };
  }

  return null;
}

/** Wyciąga identyfikator kanału ze strony kanału. CZYSTA. */
export function idKanaluZHtml(html: string): string | null {
  const kandydaci = [
    /"(?:externalId|channelId)"\s*:\s*"(UC[A-Za-z0-9_-]{22})"/,
    /<link[^>]+rel="canonical"[^>]+href="https:\/\/www\.youtube\.com\/channel\/(UC[A-Za-z0-9_-]{22})"/,
    /<meta[^>]+itemprop="identifier"[^>]+content="(UC[A-Za-z0-9_-]{22})"/,
  ];
  for (const re of kandydaci) {
    const m = re.exec(html);
    if (m) return m[1];
  }
  return null;
}

/**
 * Odkodowanie encji HTML. Encje LICZBOWE są tu obowiązkowe, a nie ozdobne: nazwy kanałów są pełne
 * polskich znaków, a YouTube zapisuje je w atrybucie `content` właśnie w tej postaci. Bez tego
 * „Spółka" trafiłaby do bazy jako „Sp&#243;łka" i tak zostało — na liście kanałów, na zawsze.
 */
function odkodujEncje(s: string): string {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&");
}

/** Wyciąga nazwę kanału ze strony kanału. CZYSTA. */
export function nazwaKanaluZHtml(html: string): string | null {
  const m =
    /<meta[^>]+property="og:title"[^>]+content="([^"]+)"/.exec(html) ??
    /<meta[^>]+name="title"[^>]+content="([^"]+)"/.exec(html);
  if (!m) return null;
  return odkodujEncje(m[1]).trim();
}

/** Wyciąga uchwyt (`@nazwa`) ze strony kanału. CZYSTA. */
export function uchwytZHtml(html: string): string | null {
  const m = /"channelHandle"\s*:\s*\{\s*"[^"]*"\s*:\s*"(@[A-Za-z0-9._-]+)"/.exec(html)
    ?? /"vanityChannelUrl"\s*:\s*"https:\\?\/\\?\/www\.youtube\.com\\?\/(@[A-Za-z0-9._-]+)"/.exec(html);
  return m ? m[1] : null;
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

/**
 * Jedyna funkcja tego pliku sięgająca do sieci. Zwraca `null`, gdy adresu nie da się rozwiązać —
 * nigdy nie rzuca, bo „nie znaleziono kanału" to normalna odpowiedź dla użytkownika, który wkleił
 * cokolwiek, a nie awaria aplikacji.
 */
export async function rozwiazKanal(
  wejscie: string,
  pobierz: PobierzStrone = domyslnePobranie
): Promise<RozwiazanyKanal | null> {
  const rozpoznane = rozpoznajAdresKanalu(wejscie);
  if (!rozpoznane) return null;

  if (rozpoznane.rodzaj === "id") {
    // Nazwę i tak warto mieć — bez niej lista kanałów pokazywałaby surowy identyfikator.
    const html = await pobierz(`https://www.youtube.com/channel/${rozpoznane.id}`);
    return {
      channelId: rozpoznane.id,
      title: html ? nazwaKanaluZHtml(html) : null,
      handle: html ? uchwytZHtml(html) : null,
    };
  }

  const html = await pobierz(rozpoznane.url);
  if (!html) return null;
  const channelId = idKanaluZHtml(html);
  if (!channelId) return null;
  return {
    channelId,
    title: nazwaKanaluZHtml(html),
    handle: rozpoznane.handle ?? uchwytZHtml(html),
  };
}
