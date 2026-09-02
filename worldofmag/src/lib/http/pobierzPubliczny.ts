import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

/**
 * Pobranie adresu PODANEGO PRZEZ UŻYTKOWNIKA z blokadą sieci prywatnych (SSRF).
 *
 * Trasa importu przepisu przyjmuje dowolny URL i zwracała treść błędu HTTP w komunikacie —
 * czyli nadawała się na skaner portów i odczyt wewnętrznych endpointów z sieci hostingu
 * (localhost, 169.254.169.254, 10/8…). Sama walidacja hosta nie wystarcza dwukrotnie:
 * nazwa może rozwiązywać się do adresu prywatnego, a przekierowanie może prowadzić w głąb
 * sieci — dlatego sprawdzamy KAŻDY skok (redirect: "manual") i rozwiązujemy DNS przed fetch.
 */

const MAX_PRZEKIEROWAN = 3;

export function prywatnyAdres(ip: string): boolean {
  if (isIP(ip) === 4) {
    const o = ip.split(".").map(Number);
    return (
      o[0] === 0 ||
      o[0] === 10 ||
      o[0] === 127 ||
      (o[0] === 100 && o[1] >= 64 && o[1] <= 127) || // CGNAT
      (o[0] === 169 && o[1] === 254) || // link-local + metadane chmury
      (o[0] === 172 && o[1] >= 16 && o[1] <= 31) ||
      (o[0] === 192 && o[1] === 168)
    );
  }
  const v6 = ip.toLowerCase();
  if (v6.startsWith("::ffff:")) return prywatnyAdres(v6.slice(7)); // zmapowane IPv4
  if (v6 === "::" || v6 === "::1") return true; // nieokreślony / loopback
  if (v6.startsWith("fc") || v6.startsWith("fd")) return true; // ULA
  if (v6.startsWith("fe8") || v6.startsWith("fe9") || v6.startsWith("fea") || v6.startsWith("feb")) return true; // link-local
  return false;
}

async function sprawdzHost(u: URL): Promise<string | null> {
  if (!["http:", "https:"].includes(u.protocol)) return "Dozwolone są tylko adresy http(s)";
  const host = u.hostname;
  if (!host || host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal")) {
    return "Adres wskazuje na sieć lokalną";
  }
  if (isIP(host)) {
    if (prywatnyAdres(host)) return "Adres wskazuje na sieć prywatną";
    return null;
  }
  try {
    const adresy = await lookup(host, { all: true, verbatim: true });
    if (adresy.length === 0) return "Nie udało się rozwiązać adresu";
    if (adresy.some((a) => prywatnyAdres(a.address))) return "Adres wskazuje na sieć prywatną";
  } catch {
    return "Nie udało się rozwiązać adresu";
  }
  return null;
}

/** Pobiera treść publicznego adresu; rzuca `Error` z komunikatem zdatnym dla użytkownika. */
export async function pobierzPubliczny(
  startUrl: string,
  opts?: { timeoutMs?: number; headers?: Record<string, string> },
): Promise<{ html: string; finalUrl: string }> {
  let biezacy = new URL(startUrl);
  for (let skok = 0; skok <= MAX_PRZEKIEROWAN; skok++) {
    const blad = await sprawdzHost(biezacy);
    if (blad) throw new Error(blad);

    const res = await fetch(biezacy.toString(), {
      headers: opts?.headers,
      redirect: "manual",
      signal: AbortSignal.timeout(opts?.timeoutMs ?? 15000),
    });
    if (res.status >= 300 && res.status < 400) {
      const cel = res.headers.get("location");
      if (!cel) throw new Error(`HTTP ${res.status} bez adresu docelowego`);
      biezacy = new URL(cel, biezacy); // względne przekierowania są legalne
      continue;
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return { html: await res.text(), finalUrl: biezacy.toString() };
  }
  throw new Error("Za dużo przekierowań");
}
