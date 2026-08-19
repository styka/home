import { test } from "node:test";
import assert from "node:assert/strict";

/**
 * 082 — KSZTAŁT WIERSZA DOPISYWANEGO DO PULI ARTYKUŁÓW.
 *
 * Dlaczego ten test istnieje. Po migracji 0244 (usunięcie kolumn własnościowych z 40 tabel) zapis
 * do puli nadal podawał `ownerId`, więc `prisma.newsArticle.createMany` odrzucał KAŻDE odświeżanie
 * modułu Wiadomości — a więc i tematy, i linię czasu, i gorące tematy, bo wszystko stoi na puli.
 * Kompilator tego nie widział (`data` to literał obiektu, którego pola Prisma sprawdza dopiero
 * w czasie wykonania), bramka `check:owner-columns` też nie (literał był ukryty w `.map()`).
 *
 * Test jest tani, bo `wierszePuli` jest czyste: bez bazy, bez sieci, bez sesji.
 */

const WLASNOSC = { workspaceId: "ws-1" };

function pozycja(over: Partial<{ title: string; link: string; publishedAt: Date | null; description: string }> = {}) {
  return {
    title: "Tytuł",
    link: "https://example.test/a",
    publishedAt: new Date("2026-08-19T10:00:00Z"),
    description: "Skrót",
    ...over,
  };
}

test("wiersz niesie przestrzeń, a NIE skasowaną kolumnę ownerId", async () => {
  const { wierszePuli } = await import("@/modules/news/jobs/newsRefresh");
  const [row] = wierszePuli([pozycja()], {
    wlasnosc: WLASNOSC,
    sourceId: "src-1",
    since: new Date("2026-08-01T00:00:00Z"),
  });

  assert.equal(row.workspaceId, "ws-1");
  assert.equal(row.sourceId, "src-1");
  assert.equal(row.url, "https://example.test/a");
  // To jest cała treść błędu, który ten test ma trzymać z dala: kolumny `ownerId` nie ma
  // w `NewsArticle` od migracji 0244, a `createMany` odrzuca całą partię za jedno nieznane pole.
  assert.equal("ownerId" in row, false);
  assert.equal("ownerTeamId" in row, false);

  // Zbiór kluczy jest sprawdzany DOKŁADNIE, a nie „czy zawiera": nadmiarowe pole jest tu równie
  // groźne co brakujące — Prisma odrzuci partię tak samo.
  assert.deepEqual(Object.keys(row).sort(), [
    "description",
    "publishedAt",
    "sourceId",
    "title",
    "url",
    "workspaceId",
  ]);
});

test("pozycja bez daty w kanale dostaje bieżącą i przechodzi próg", async () => {
  const { wierszePuli } = await import("@/modules/news/jobs/newsRefresh");
  const teraz = new Date("2026-08-19T12:00:00Z");
  const rows = wierszePuli([pozycja({ publishedAt: null })], {
    wlasnosc: WLASNOSC,
    sourceId: "src-1",
    since: new Date("2026-08-19T00:00:00Z"),
    teraz,
  });
  assert.equal(rows.length, 1, "kanał bez pubDate nie może być dla nas niewidoczny");
  assert.deepEqual(rows[0].publishedAt, teraz);
});

test("pozycja starsza od progu źródła jest odrzucana", async () => {
  const { wierszePuli } = await import("@/modules/news/jobs/newsRefresh");
  const rows = wierszePuli([pozycja({ publishedAt: new Date("2026-07-01T00:00:00Z") })], {
    wlasnosc: WLASNOSC,
    sourceId: "src-1",
    since: new Date("2026-08-01T00:00:00Z"),
  });
  assert.equal(rows.length, 0);
});
