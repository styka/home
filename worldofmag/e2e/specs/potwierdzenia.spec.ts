import { test, expect } from "../fixtures/test";

/**
 * 086 (AC-5, AC-6) — OKNO POTWIERDZENIA MÓWI, CO SIĘ STANIE.
 *
 * Zgłoszenie właściciela: „dlaczego jak jest pytanie, czy oznaczyć wszystkie jako przeczytane, to
 * jest przycisk usuń? Czy przypadkiem usuń i przeczytane to nie dwie różne rzeczy?". Przyczyna była
 * systemowa: wspólne okno miało domyślnie etykietę „Usuń", a ŻADNE z 54 wywołań w aplikacji nie
 * przekazywało opcji.
 */

test("[086-AC5] operacja, która niczego nie usuwa, nie proponuje Usuń", async ({ page }) => {
  await page.goto("/wiadomosci");
  await page.waitForLoadState("load").catch(() => {});

  const oznacz = page.getByRole("button", { name: /Oznacz wszystkie/i });
  const jest = await oznacz.isVisible().catch(() => false);
  test.skip(!jest, "brak nowych wiadomości w tym środowisku — nie ma czego oznaczać");

  await oznacz.click();
  const okno = page.getByRole("dialog");
  await expect(okno).toBeVisible({ timeout: 10_000 });
  await expect(okno.getByText(/jako przeczytane/i)).toBeVisible();
  await expect(okno.getByRole("button", { name: /^Usuń$/ })).toHaveCount(0);
  await expect(okno.getByRole("button", { name: /^Potwierdź$/ })).toBeVisible();
  await page.keyboard.press("Escape");
});

test("[086-AC6] operacja usuwająca NADAL proponuje Usuń", async ({ page }) => {
  await page.goto("/wiadomosci");
  await page.waitForLoadState("load").catch(() => {});

  // Usunięcie tematu stoi w nagłówku sekcji — trzeba mieć widoczny temat.
  const ustawienia = page.getByRole("button", { name: /Ustawienia modułu/i });
  await ustawienia.click();
  const przelacznik = page.getByRole("checkbox", { name: /Pokazuj tematy bez nowych wiadomości/i });
  await expect(przelacznik).toBeVisible({ timeout: 15_000 });
  const bylo = await przelacznik.isChecked();
  if (!bylo) await przelacznik.check();
  await page.getByRole("tab", { name: "Tematy", exact: true }).click();
  await page.waitForTimeout(1200);

  const usun = page.getByRole("button", { name: /Usuń temat/i }).first();
  const jest = await usun.isVisible().catch(() => false);
  if (jest) {
    await usun.click();
    const okno = page.getByRole("dialog");
    await expect(okno).toBeVisible({ timeout: 10_000 });
    // Tu czerwony „Usuń" jest na miejscu — temat i jego linia czasu naprawdę znikają.
    await expect(okno.getByRole("button", { name: /^Usuń$/ })).toBeVisible();
    await page.keyboard.press("Escape");
  }

  if (!bylo) {
    await ustawienia.click();
    await przelacznik.uncheck();
  }
  test.skip(!jest, "brak tematu do usunięcia w tym środowisku");
});
