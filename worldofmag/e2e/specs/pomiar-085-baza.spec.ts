import { test } from "../fixtures/test";

/**
 * 085 / T-1 — POMIAR PUNKTU ODNIESIENIA (przed zmianą).
 *
 * Plik TYMCZASOWY: istnieje tylko po to, żeby zapisać liczby sprzed przebudowy. Bez nich zdania
 * „pasek się przykleja" i „pasek mieści się w jednym wierszu" są opiniami, a nie dowodami. Po
 * zapisaniu wyników w `verify.md` plik znika.
 */

async function pomiarPaskaWidoku(page: import("@playwright/test").Page, sciezka: string) {
  await page.goto(sciezka);
  await page.waitForLoadState("load").catch(() => {});
  await page.waitForTimeout(1500);
  return page.evaluate(() => {
    // Pasek widoku rozpoznajemy po dolnej krawędzi listwy w ramie: bierzemy pierwszy element
    // z `border-bottom`, który zawiera nagłówek albo zakładki modułu. Prościej i pewniej:
    // szukamy kontenera przewijania i mierzymy, czy po przewinięciu cokolwiek zostaje u góry.
    const ramy = Array.from(document.querySelectorAll<HTMLElement>("main *")).filter((el) => {
      const s = getComputedStyle(el);
      return (s.overflowY === "auto" || s.overflowY === "scroll") && el.scrollHeight > el.clientHeight + 50;
    });
    const rama = ramy[0] ?? null;
    return {
      znalezionoRame: !!rama,
      wysokoscTresci: rama?.scrollHeight ?? 0,
      wysokoscOkna: rama?.clientHeight ?? 0,
      lepkichElementow: Array.from(document.querySelectorAll<HTMLElement>("main *")).filter(
        (el) => getComputedStyle(el).position === "sticky",
      ).length,
    };
  });
}

test("[085-baza] pasek widoku po przewinięciu — Pogoda i Wiadomości", async ({ page }) => {
  for (const sciezka of ["/pogoda", "/wiadomosci"]) {
    const przed = await pomiarPaskaWidoku(page, sciezka);
    // Przewijamy ramę o 800 px i sprawdzamy, czy zakładki/akcje nadal widać.
    const po = await page.evaluate(() => {
      const rama = Array.from(document.querySelectorAll<HTMLElement>("main *")).find((el) => {
        const s = getComputedStyle(el);
        return (s.overflowY === "auto" || s.overflowY === "scroll") && el.scrollHeight > el.clientHeight + 50;
      });
      if (!rama) return { przewinieto: 0, gwiazdkaWidoczna: false, akcjeWidoczne: false };
      rama.scrollTop = 800;
      const gorna = rama.getBoundingClientRect().top;
      const widoczny = (sel: string) => {
        const el = document.querySelector<HTMLElement>(sel);
        if (!el) return false;
        const r = el.getBoundingClientRect();
        return r.bottom > gorna && r.top < window.innerHeight;
      };
      return {
        przewinieto: rama.scrollTop,
        gwiazdkaWidoczna: widoczny('main button[aria-label*="ulubion"]'),
        akcjeWidoczne: widoczny("main h1") || widoczny('main [role="tablist"]'),
      };
    });
    console.log(`POMIAR ${sciezka}: ${JSON.stringify({ ...przed, ...po })}`);
  }
});

test("[085-baza] pasek obserwatorów i chipsy — wysokość przy 360 px", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 });
  await page.goto("/pogoda");
  await page.waitForLoadState("load").catch(() => {});
  await page.waitForTimeout(2500);
  const wynik = await page.evaluate(() => {
    const tekst = (el: Element) => (el.textContent ?? "").replace(/\s+/g, " ").trim();
    const chipy = Array.from(document.querySelectorAll("button")).filter((b) =>
      /^(Spełnione|Częściowo|Niespełnione|Brak danych)\s*\d+$/.test(tekst(b)),
    );
    const pasek = chipy[0]?.parentElement ?? null;
    const meta = Array.from(document.querySelectorAll<HTMLElement>("*")).find((el) =>
      tekst(el).startsWith("Wygenerowano") && el.children.length < 8,
    );
    return {
      chipow: chipy.length,
      wysokoscPaskaChipow: pasek ? Math.round(pasek.getBoundingClientRect().height) : null,
      metaNaDole: meta ? Math.round(meta.getBoundingClientRect().top) : null,
      wysokoscOkna: window.innerHeight,
    };
  });
  console.log(`POMIAR obserwatory: ${JSON.stringify(wynik)}`);
});
