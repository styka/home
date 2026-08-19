import { AsyncLocalStorage } from "async_hooks";

/**
 * 086 (zadanie 31, Faza 6) — LOGI STRUKTURALNE.
 *
 * Rozwinięcie Z-096 (`lib/observability/log.ts`), przeniesione do platformy razem z resztą
 * zdolności przekrojowych. Rozdz. 11.7 podaje wprost skład rekordu: `requestId`, `userId`,
 * `workspaceId`, `module`, `action`, `durationMs`, `outcome` — **bez PII w treści**.
 *
 * Dwie rzeczy, których brakowało i bez których poprzednia wersja nie mogła spełnić tego wymagania:
 *
 * **1. Kontekst.** Wołający musiałby podawać `requestId`/`userId`/`workspaceId` przy każdym logu,
 * a większość miejsc ich po prostu nie ma pod ręką (helper w głębi modułu nie zna żądania). Efekt
 * byłby taki, że pola istnieją w typie i nie ma ich w logach. Kontekst wchodzi więc raz, na wejściu
 * (`wKontekscieLogu`), i dokleja się automatycznie — tym samym `AsyncLocalStorage`, co zakres
 * operacji z 084.
 *
 * **2. Ochrona przed PII.** „Bez PII" zapisane w komentarzu jest życzeniem; pierwszy log z obiektem
 * użytkownika wsadzi do strumienia adres e-mail. Dlatego wartości przechodzą przez `oczysc`:
 * adresy e-mail są zamieniane na `[e-mail]`, długie teksty przycinane, a obiekty i tablice
 * spłaszczane do rozmiaru — bo to zwykle całe rekordy, wrzucone „na wszelki wypadek”.
 *
 * **Czego ta warstwa nie robi:** nie wysyła nigdzie logów. Render zbiera stdout/stderr; jedna linia
 * JSON to format, który każdy agregator zrozumie bez konfiguracji.
 */
export type LogLevel = "debug" | "info" | "warn" | "error";

/** Wynik operacji. `blad` = wyjątek, `odmowa` = świadome odrzucenie (limit, brak dostępu). */
export type LogOutcome = "ok" | "blad" | "odmowa";

export type LogFields = Record<string, unknown>;

export type KontekstLogu = {
  requestId?: string;
  userId?: string;
  workspaceId?: string;
  module?: string;
};

/**
 * 098 — jak w `platform/sharing/cache.ts`: magazyn powstaje LENIWIE. `new AsyncLocalStorage()`
 * w zasięgu modułu wykonuje się przy imporcie, a w grafie klienta `async_hooks` jest pustym
 * modułem, więc ta linijka wywracała hydrację całej strony. Brak magazynu = brak kontekstu, czyli
 * log bez pól żądania — a nie wyjątek.
 */
let kontekst: AsyncLocalStorage<KontekstLogu> | null = null;
function magazynKontekstu(): AsyncLocalStorage<KontekstLogu> | null {
  if (kontekst) return kontekst;
  if (typeof AsyncLocalStorage !== "function") return null;
  kontekst = new AsyncLocalStorage<KontekstLogu>();
  return kontekst;
}

/**
 * Ustawia kontekst dla całego drzewa wywołań. Zagnieżdżenie **scala** — trasa ustawia `requestId`,
 * a akcja w środku dokłada `module`, nie gubiąc tego pierwszego.
 */
export function wKontekscieLogu<T>(pola: KontekstLogu, f: () => T): T {
  const magazyn = magazynKontekstu();
  if (!magazyn) return f();
  const biezacy = magazyn.getStore() ?? {};
  return magazyn.run({ ...biezacy, ...pola }, f);
}

export function biezacyKontekstLogu(): KontekstLogu {
  return magazynKontekstu()?.getStore() ?? {};
}

/** Adres e-mail w logu to PII — najczęstsze i najłatwiejsze do przeoczenia. */
const EMAIL = /[\w.+-]+@[\w-]+\.[\w.-]+/g;
const MAKS_DLUGOSC = 200;

/**
 * Czyści pojedynczą wartość. Reguła jest zachowawcza z rozmysłem: log ma być diagnostyką, a nie
 * kopią danych. Obiekt zamiast wartości to prawie zawsze rekord wrzucony odruchowo — zostaje po nim
 * sam rozmiar, bo to jedyna informacja, która z takiego wpisu bywa przydatna.
 */
export function oczysc(wartosc: unknown): unknown {
  if (wartosc === null || wartosc === undefined) return wartosc;
  if (typeof wartosc === "number" || typeof wartosc === "boolean") return wartosc;
  if (typeof wartosc === "string") {
    const bezPii = wartosc.replace(EMAIL, "[e-mail]");
    return bezPii.length > MAKS_DLUGOSC ? `${bezPii.slice(0, MAKS_DLUGOSC)}…` : bezPii;
  }
  if (Array.isArray(wartosc)) return `[tablica ${wartosc.length}]`;
  if (wartosc instanceof Error) return oczysc(wartosc.message);
  if (wartosc instanceof Date) return wartosc.toISOString();
  return `[obiekt ${Object.keys(wartosc as object).length} pól]`;
}

/** Buduje rekord loga (czysta funkcja — testowalna, bez wypisywania). */
export function buildLogRecord(
  level: LogLevel,
  event: string,
  fields?: LogFields,
  now: Date = new Date(),
  ctx: KontekstLogu = biezacyKontekstLogu(),
): Record<string, unknown> {
  const rekord: Record<string, unknown> = { ts: now.toISOString(), level, event, ...ctx };
  for (const [k, v] of Object.entries(fields ?? {})) rekord[k] = oczysc(v);
  return rekord;
}

/** Emituje log strukturalny na właściwy strumień (error→stderr, reszta→stdout). */
export function logEvent(level: LogLevel, event: string, fields?: LogFields): void {
  const line = JSON.stringify(buildLogRecord(level, event, fields));
  // eslint-disable-next-line no-console
  if (level === "error") console.error(line);
  // eslint-disable-next-line no-console
  else if (level === "warn") console.warn(line);
  // eslint-disable-next-line no-console
  else console.log(line);
}

/**
 * Mierzy czas wykonania `fn` i loguje zdarzenie z `durationMs` oraz `outcome`.
 * Re-rzuca wyjątek po zalogowaniu — nie zmienia zachowania wołającego.
 */
export async function timed<T>(event: string, fn: () => Promise<T>, fields?: LogFields): Promise<T> {
  const start = Date.now();
  try {
    const result = await fn();
    logEvent("info", event, { ...fields, durationMs: Date.now() - start, outcome: "ok" satisfies LogOutcome });
    return result;
  } catch (e) {
    logEvent("error", event, {
      ...fields,
      durationMs: Date.now() - start,
      outcome: "blad" satisfies LogOutcome,
      error: e instanceof Error ? e.message : String(e),
    });
    throw e;
  }
}
