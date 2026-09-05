/**
 * 123 v3 — TRANSPORT transkrypcji konfigurowalny bez deployu.
 *
 * Dwa klucze Config (edytowalne w `/admin/config`):
 *
 * - `youtube_proxy_secret` — adres proxy (np. `http://uzytkownik:haslo@p.webshare.io:80`),
 *   przez które idą żądania **do youtube.com**. To jest branżowa odpowiedź na blokadę adresów
 *   IP centrów danych: rotujące proxy rezydenckie (Webshare jest de facto standardem — ma
 *   wbudowaną integrację w youtube-transcript-api). Sufiks `_secret` sprawia, że wartość jest
 *   szyfrowana w spoczynku i maskowana w panelu (C-41) — niesie hasło.
 *   Żądania do instancji Piped/Invidious świadomie idą BEZ proxy: instancja sama rozwiązuje
 *   problem blokady, a płatne łącze rezydenckie szkoda marnować na ruch, który go nie potrzebuje.
 *
 * - `youtube_transcript_instances` — JSON tablica `"piped:https://…"` / `"invidious:https://…"`,
 *   nadpisująca wbudowaną listę publicznych instancji. Publiczne instancje bywają ulotne
 *   (YouTube aktywnie je zwalcza), więc wymiana martwej na żywą musi być edycją konfiguracji,
 *   nie deployem.
 *
 * `undici` jest tu jedyną drogą: globalny `fetch` Node'a nie honoruje `HTTPS_PROXY`, a agenta
 * proxy nie da się zbudować z modułów wbudowanych. Zależność jest oficjalna (silnik fetch
 * Node'a) i użyta wyłącznie w tym pliku.
 */
import { ProxyAgent, fetch as undiciFetch } from "undici";
import { prisma } from "@/platform/db/prisma";
import { resilientFetch } from "@/lib/integrations/resilientFetch";
import { decryptSecret } from "@/lib/crypto/secrets";
import {
  listaInstancji,
  type Instancja,
  type OpcjePobrania,
  type PobierzTresc,
} from "./transkrypcja";

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

async function wartoscConfig(key: string): Promise<string | null> {
  try {
    const row = await prisma.config.findUnique({ where: { key } });
    return row?.value ?? null;
  } catch {
    return null;
  }
}

export interface TransportTranskrypcji {
  pobierz: PobierzTresc;
  instancje: Instancja[];
  /** Do logu skuteczności — czy przebieg szedł przez proxy. */
  przezProxy: boolean;
}

/**
 * Buduje transport na JEDEN przebieg odświeżania: czyta konfigurację raz, nie per film.
 * Bez proxy zwraca `pobierz: undefined → domyślny` w praktyce ten sam efekt co dotąd —
 * dlatego zawsze budujemy własny fetcher: jeden kod ścieżki zamiast dwóch.
 */
export async function przygotujTransport(): Promise<TransportTranskrypcji> {
  const [surowyProxy, surowaLista] = await Promise.all([
    wartoscConfig("youtube_proxy_secret"),
    wartoscConfig("youtube_transcript_instances"),
  ]);

  let agent: ProxyAgent | null = null;
  if (surowyProxy) {
    try {
      const adres = decryptSecret(surowyProxy);
      if (adres && /^https?:\/\//.test(adres)) agent = new ProxyAgent(adres);
    } catch {
      agent = null; // zepsuta wartość nie może wywrócić odświeżania — jedziemy bez proxy
    }
  }

  // Wstrzykujemy do `resilientFetch` implementację, która dla youtube.com dokłada dispatcher
  // proxy — retry/backoff i timeout zostają wspólne z resztą integracji (jedna krzywa, C-53).
  const fetchImpl = ((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const przezYoutube = agent && /^https:\/\/([a-z0-9-]+\.)*youtube\.com\//i.test(url);
    const opcje = przezYoutube
      ? { ...(init as object), dispatcher: agent }
      : (init as object | undefined);
    return undiciFetch(url, opcje as Parameters<typeof undiciFetch>[1]) as unknown as Promise<Response>;
  }) as typeof fetch;

  const pobierz: PobierzTresc = async (url: string, opcje?: OpcjePobrania) => {
    try {
      const res = await resilientFetch(url, {
        method: opcje?.method ?? "GET",
        body: opcje?.body,
        headers: opcje?.headers ?? {
          "User-Agent": UA,
          "Accept-Language": "pl,en;q=0.8",
          Cookie: "SOCS=CAI",
        },
        cache: "no-store",
        timeoutMs: 12_000,
        fetchImpl,
      });
      if (!res.ok) return null;
      return await res.text();
    } catch {
      return null;
    }
  };

  return { pobierz, instancje: listaInstancji(surowaLista), przezProxy: !!agent };
}
