import { test } from "node:test";
import assert from "node:assert/strict";
import { percentyl95, PROGI_MS } from "../metryki";

/**
 * 087 (zadanie 32) — METRYKI OPERACJI.
 *
 * Percentyl liczymy z histogramu, więc jego poprawność da się sprawdzić bez bazy — i trzeba, bo
 * błąd tutaj nie objawia się awarią, tylko liczbą, w którą ktoś uwierzy.
 */
test("percentyl 95 wskazuje przedział, w którym leży 95. centyl", () => {
  // 100 pomiarów: 96 szybkich, 4 wolne → p95 mieści się jeszcze w pierwszym przedziale.
  const hist = [96, 0, 0, 0, 0, 0, 0, 0, 4];
  assert.equal(percentyl95(hist), PROGI_MS[0]);
});

test("percentyl 95 NIE jest średnią — jedna wartość odstająca go nie rusza, wiele rusza", () => {
  // 90 szybkich + 10 bardzo wolnych: 95. centyl wypada wśród wolnych.
  assert.equal(percentyl95([90, 0, 0, 0, 0, 0, 0, 0, 10]), Infinity);
  // 99 szybkich + 1 wolny: 95. centyl wciąż wśród szybkich.
  assert.equal(percentyl95([99, 0, 0, 0, 0, 0, 0, 0, 1]), PROGI_MS[0]);
});

test("pusty histogram daje null, a nie zero", () => {
  // „Brak pomiarów" i „wszystko poniżej 50 ms" to dwie różne odpowiedzi. Zero sugerowałoby drugą.
  assert.equal(percentyl95(new Array(9).fill(0)), null);
});

test("przedział otwarty zwraca Infinity, a nie ostatni próg", () => {
  // Wołający pokazuje wtedy „> 10 s". Zwrócenie 10000 udawałoby liczbę, której nie znamy.
  assert.equal(percentyl95([0, 0, 0, 0, 0, 0, 0, 0, 5]), Infinity);
});

const HAS_DB = !!process.env.DATABASE_URL;
const rnd = () => Math.random().toString(36).slice(2, 10);

test(
  "dosypywanie metryk kumuluje w kubełku i czyści bufor",
  { skip: !HAS_DB && "brak DATABASE_URL", concurrency: false },
  async (t) => {
    const { prisma } = await import("@/platform/db/prisma");
    const { zanotujOperacje, flushMetryk, godzinaUtc, metrykiPerModul } = await import("../metryki");

    const modul = `test-${rnd()}`;

    try {
      await t.test("dwa przebiegi dosypują do TEGO SAMEGO wiersza", async () => {
        zanotujOperacje(modul, "akcja", 30);
        zanotujOperacje(modul, "akcja", 3000, "blad");
        assert.equal(await flushMetryk(), 1, "jeden kubełek = jeden zapis, niezależnie od liczby operacji");

        zanotujOperacje(modul, "akcja", 40);
        await flushMetryk();

        const wiersz = await prisma.operationMetric.findFirstOrThrow({
          where: { module: modul, bucket: godzinaUtc() },
        });
        assert.equal(wiersz.count, 3, "licznik musi się KUMULOWAĆ, a nie nadpisywać");
        assert.equal(wiersz.errors, 1);
        assert.equal(wiersz.b50, 2, "30 ms i 40 ms wpadają do tego samego przedziału");
        assert.equal(wiersz.durationMaxMs, 3000, "maksimum bierze GREATEST, nie ostatnią wartość");
      });

      await t.test("puste dosypanie nie robi nic", async () => {
        assert.equal(await flushMetryk(), 0, "bufor jest czyszczony przy zapisie — drugi przebieg nie ma czego liczyć");
      });

      await t.test("konflikt edycji liczy się osobno od błędu", async () => {
        zanotujOperacje(modul, "zapis", 5, "konflikt");
        await flushMetryk();
        const per = await metrykiPerModul(1);
        const mój = per.find((m) => m.module === modul);
        assert.equal(mój?.conflicts, 1);
        assert.equal(mój?.errors, 1, "konflikt nie może podbijać licznika błędów — to nie awaria");
      });
    } finally {
      await prisma.operationMetric.deleteMany({ where: { module: modul } });
    }
  },
);
