import { prisma } from "@/platform/db/prisma";

/**
 * 087 (zadanie 32, Faza 6) — METRYKI OPERACJI.
 *
 * **Zliczanie w pamięci, dosypywanie zbiorczo.** Zapis do bazy przy każdej operacji podwoiłby liczbę
 * zapisów w aplikacji i dołożył opóźnienie do rzeczy, którą właśnie mierzymy. Instancja zlicza więc
 * u siebie, a raz na tyknięcie workera dosypuje wynik jednym `UPDATE` na kubełek. Cena: przy nagłym
 * ubiciu procesu przepada do minuty pomiarów. Dla metryki to strata bez znaczenia — dla danych
 * użytkownika byłaby nie do przyjęcia, i dlatego ten wzorzec jest dobry TYLKO tutaj.
 *
 * **Kubełek godzinowy i histogram.** Percentyla 95 nie da się odtworzyć ze średniej, a to on
 * odpowiada na pytanie „czy komuś jest wolno" (średnia odpowiada „czy większości jest dobrze").
 * Stałe przedziały dają p95 z dokładnością do przedziału — w zupełności dość, żeby zobaczyć regres.
 */

/** Górne granice przedziałów histogramu (ms). Ostatni jest otwarty w górę. */
export const PROGI_MS = [50, 100, 250, 500, 1000, 2500, 5000, 10000] as const;
const POLA_HISTOGRAMU = ["b50", "b100", "b250", "b500", "b1000", "b2500", "b5000", "b10000", "bInf"] as const;

type Kubelek = {
  count: number;
  errors: number;
  conflicts: number;
  durationSumMs: number;
  durationMaxMs: number;
  hist: number[]; // 9 pozycji: 8 progów + przedział otwarty
};

const bufor = new Map<string, Kubelek>();

export function godzinaUtc(d = new Date()): string {
  return d.toISOString().slice(0, 13); // YYYY-MM-DDTHH
}

function pusty(): Kubelek {
  return { count: 0, errors: 0, conflicts: 0, durationSumMs: 0, durationMaxMs: 0, hist: new Array(9).fill(0) };
}

function przedzial(durationMs: number): number {
  for (let i = 0; i < PROGI_MS.length; i++) if (durationMs <= PROGI_MS[i]) return i;
  return PROGI_MS.length;
}

/**
 * Notuje jedną operację. Nigdy nie rzuca i nigdy nie czeka na bazę — pomiar, który potrafi wywrócić
 * mierzoną operację, jest gorszy niż brak pomiaru.
 */
export function zanotujOperacje(
  modul: string,
  akcja: string,
  durationMs: number,
  outcome: "ok" | "blad" | "konflikt" = "ok",
): void {
  const klucz = `${godzinaUtc()} ${modul} ${akcja}`;
  const k = bufor.get(klucz) ?? pusty();
  k.count++;
  if (outcome === "blad") k.errors++;
  if (outcome === "konflikt") k.conflicts++;
  const ms = Math.max(0, Math.round(durationMs));
  k.durationSumMs += ms;
  if (ms > k.durationMaxMs) k.durationMaxMs = ms;
  k.hist[przedzial(ms)]++;
  bufor.set(klucz, k);
}

/** Mierzy czas i notuje wynik; `ConflictError` liczy się osobno, bo to nie jest awaria. */
export async function zmierzOperacje<T>(modul: string, akcja: string, f: () => Promise<T>): Promise<T> {
  const start = Date.now();
  try {
    const wynik = await f();
    zanotujOperacje(modul, akcja, Date.now() - start, "ok");
    return wynik;
  } catch (e) {
    const konflikt = e instanceof Error && e.name === "ConflictError";
    zanotujOperacje(modul, akcja, Date.now() - start, konflikt ? "konflikt" : "blad");
    throw e;
  }
}

/**
 * Dosypuje bufor do bazy. Bufor jest czyszczony **przed** zapisem: gdyby zapis padł, stracimy
 * minutę pomiarów, ale nie policzymy tych samych operacji drugi raz przy kolejnym przebiegu.
 * Przy metryce zaniżenie jest znacznie mniej mylące niż zawyżenie.
 */
export async function flushMetryk(): Promise<number> {
  if (bufor.size === 0) return 0;
  const doZapisu = Array.from(bufor.entries());
  bufor.clear();

  for (const [klucz, k] of doZapisu) {
    const [bucket, modul, akcja] = klucz.split(" ");
    const przyrosty = POLA_HISTOGRAMU.map(
      (pole, i) => `"${pole}" = "OperationMetric"."${pole}" + ${k.hist[i]}`,
    ).join(", ");
    await prisma.$executeRawUnsafe(
      `INSERT INTO "OperationMetric"
         ("id","bucket","module","action","count","errors","conflicts","durationSumMs","durationMaxMs",
          "b50","b100","b250","b500","b1000","b2500","b5000","b10000","bInf")
       VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7, $8, ${k.hist.join(", ")})
       ON CONFLICT ("bucket","module","action") DO UPDATE SET
         "count" = "OperationMetric"."count" + EXCLUDED."count",
         "errors" = "OperationMetric"."errors" + EXCLUDED."errors",
         "conflicts" = "OperationMetric"."conflicts" + EXCLUDED."conflicts",
         "durationSumMs" = "OperationMetric"."durationSumMs" + EXCLUDED."durationSumMs",
         "durationMaxMs" = GREATEST("OperationMetric"."durationMaxMs", EXCLUDED."durationMaxMs"),
         ${przyrosty}`,
      bucket,
      modul,
      akcja,
      k.count,
      k.errors,
      k.conflicts,
      BigInt(k.durationSumMs),
      k.durationMaxMs,
    );
  }
  return doZapisu.length;
}

/**
 * Percentyl 95 z histogramu — górna granica przedziału, w którym leży 95. centyl.
 *
 * Zwraca `null` dla pustego histogramu (nie zero: „brak pomiarów" i „wszystko poniżej progu" to dwie
 * różne odpowiedzi, a zero sugerowałoby tę drugą). Dla przedziału otwartego zwraca `Infinity`
 * — wołający pokazuje wtedy „> 10 s", zamiast udawać liczbę, której nie zna.
 */
export function percentyl95(hist: number[]): number | null {
  const suma = hist.reduce((a, b) => a + b, 0);
  if (suma === 0) return null;
  const prog = suma * 0.95;
  let skumulowane = 0;
  for (let i = 0; i < hist.length; i++) {
    skumulowane += hist[i];
    if (skumulowane >= prog) return i < PROGI_MS.length ? PROGI_MS[i] : Infinity;
  }
  return Infinity;
}

export type PodsumowanieModulu = {
  module: string;
  count: number;
  errors: number;
  conflicts: number;
  p95Ms: number | null;
  maxMs: number;
};

/**
 * Metryki z ostatnich `godzin` godzin, zsumowane per moduł.
 *
 * Sumowanie robi baza (`groupBy`), a nie kod. Nie chodzi o elegancję: `findMany` po kubełkach zwraca
 * godziny × moduły × akcje wierszy, czyli zapytanie bez `take`, którego wynik rośnie z ruchem —
 * dokładnie to, czego zabrania zapadka paginacji. `groupBy` zwraca jeden wiersz na moduł.
 */
export async function metrykiPerModul(godzin = 24): Promise<PodsumowanieModulu[]> {
  const od = godzinaUtc(new Date(Date.now() - godzin * 3_600_000));
  const grupy = await prisma.operationMetric.groupBy({
    by: ["module"],
    where: { bucket: { gte: od } },
    _sum: {
      count: true,
      errors: true,
      conflicts: true,
      b50: true, b100: true, b250: true, b500: true,
      b1000: true, b2500: true, b5000: true, b10000: true, bInf: true,
    },
    _max: { durationMaxMs: true },
  });
  return grupy
    .map((g) => ({
      module: g.module,
      count: g._sum.count ?? 0,
      errors: g._sum.errors ?? 0,
      conflicts: g._sum.conflicts ?? 0,
      maxMs: g._max.durationMaxMs ?? 0,
      p95Ms: percentyl95(POLA_HISTOGRAMU.map((pole) => g._sum[pole] ?? 0)),
    }))
    .sort((a, b) => b.count - a.count);
}
