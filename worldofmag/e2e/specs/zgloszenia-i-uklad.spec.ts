import { test, expect } from "../fixtures/test";
import { prisma } from "../fixtures/db";
import { E2E_ADMIN } from "../fixtures/users";

/**
 * 099 — ZGŁOSZENIA BEZ CZEKANIA I TRZY POPRAWKI UKŁADU.
 *
 * Zgłoszenia właściciela: „muszę czekać z zamknięciem asystenta, aż zadanie się stworzy",
 * „punkty osi przesuwają się obok przyklejonych pasków", „czemu tu jest pusta linia na mobile",
 * „na mobile ciasno zmieścić te trzy opcje w tym wierszu".
 *
 * Metoda pomiarów jest tu ważniejsza niż zwykle: wszystkie trzy usterki układu to POZYCJE, a nie
 * treść — sprawdzamy więc geometrię (`boundingBox`), a nie obecność napisów.
 */

const PROJEKT_SKRZYNKI = "Omnia";

async function otworz(page: import("@playwright/test").Page, adres: string, szer = 1280) {
  await page.setViewportSize({ width: szer, height: 800 });
  await page.goto(adres);
  // 098: NIE `networkidle` — aplikacja trzyma otwarty strumień zdarzeń, więc sieć nigdy nie jest bezczynna.
  await page.waitForLoadState("load").catch(() => {});
  await page.waitForTimeout(900);
}

/** Przestrzeń osobista administratora — tam żyje skrzynka zgłoszeń i dane testowe. */
async function przestrzenAdmina(): Promise<string> {
  const user = await prisma.user.findUniqueOrThrow({ where: { email: E2E_ADMIN.email } });
  const ws = await prisma.workspace.findFirst({ where: { personalUserId: user.id } });
  if (!ws) throw new Error("Administrator e2e nie ma przestrzeni osobistej");
  return ws.id;
}

test.describe("099 — układ", () => {
  test("[099-AC14] pasek widoku bez akcji nie zostawia pustego wiersza na telefonie", async ({ page }) => {
    await otworz(page, "/tasks", 360);

    // Wiersz akcji paska widoku ma na telefonie zniknąć CAŁKOWICIE, a nie tylko być pusty:
    // 48 px pustej listwy pod nazwą modułu to dokładnie to, co właściciel zgłosił.
    const wysokoscPustego = await page.evaluate(() => {
      const kandydaci = Array.from(document.querySelectorAll<HTMLElement>("main div.flex.min-w-0.items-center.gap-2"));
      const puste = kandydaci.filter((el) => el.textContent?.trim() === "" && el.getBoundingClientRect().height > 0);
      return puste.map((el) => Math.round(el.getBoundingClientRect().height));
    });
    expect(wysokoscPustego, `puste wiersze paska o wysokości: ${wysokoscPustego.join(", ")}`).toEqual([]);
  });

  test("[099-AC15] na komputerze pasek widoku wygląda jak wcześniej", async ({ page }) => {
    await otworz(page, "/tasks", 1280);
    // Od `md` opakowanie wraca przez `display: contents`, więc tytuł modułu jest widoczny w pasku.
    const tytul = page.locator("main h1").first();
    await expect(tytul).toBeVisible();
  });

  test("[099-AC17] nagłówek „Proponowane” mieści się w jednym wierszu przy 360 px", async ({ page }) => {
    await otworz(page, "/wiadomosci?widok=hot", 360);

    const naglowek = page.getByRole("heading", { name: "Proponowane", exact: false }).first();
    await expect(naglowek).toBeVisible();

    // Jeden wiersz = wysokość nagłówka sekcji nie przekracza wysokości pojedynczego wiersza tekstu
    // z marginesami. Mierzymy RODZICA (pasek sekcji), bo to on rósł, gdy przyciski się zawijały.
    const wysokosc = await page.evaluate(() => {
      const h = Array.from(document.querySelectorAll("h3")).find((x) => x.textContent?.includes("Proponowane"));
      const pasek = h?.parentElement;
      return pasek ? Math.round(pasek.getBoundingClientRect().height) : null;
    });
    expect(wysokosc, "pasek sekcji „Proponowane”").not.toBeNull();
    expect(wysokosc!).toBeLessThanOrEqual(56);
  });

  test("[099-AC12, 099-AC13] kropki osi czasu nie wystają poza kolumnę treści", async ({ page }) => {
    const workspaceId = await przestrzenAdmina();
    const temat = await prisma.newsTopic.create({
      data: { title: "099 test osi", semanticFilter: "099 test osi", workspaceId },
    });
    await prisma.newsTimelineEntry.createMany({
      data: [1, 2, 3].map((i) => ({
        topicId: temat.id,
        eventDate: new Date(Date.now() - i * 3600_000),
        fact: `Fakt numer ${i} na osi czasu`,
        fingerprint: `099-test-${i}`,
      })),
    });

    try {
      await otworz(page, "/wiadomosci?tresc=timeline", 360);
      await expect(page.locator("ol li").first()).toBeVisible({ timeout: 15000 });

      const pomiar = await page.evaluate(() => {
        const ol = document.querySelector("ol");
        const kropka = ol?.querySelector("li > span[aria-hidden]");
        // Punktem odniesienia jest PRZYKLEJONY PASEK, a nie sama oś: usterka polegała na tym, że
        // kropka przesuwała się widocznie OBOK paska, bo wychodziła poza jego tło. Mierzenie
        // względem `ol` niczego nie dowodzi — `ol` przesuwa się razem z kropką.
        const pasek = document.querySelector("div.sticky");
        if (!ol || !kropka || !pasek) return null;
        const o = ol.getBoundingClientRect();
        const k = kropka.getBoundingClientRect();
        const p = pasek.getBoundingClientRect();
        return {
          // Ile kropka wystaje w lewo poza tło przyklejonego paska (≤ 0 = pasek ją zasłoni).
          wystajePoza: Math.round(p.left - k.left),
          // Odchyłka środka kropki od linii osi — poprawka nie może zsunąć kropki z linii.
          odchylkaOdLinii: Math.round(Math.abs((k.left + k.width / 2) - o.left)),
        };
      });

      expect(pomiar, "nie znaleziono osi z kropką").not.toBeNull();
      // AC-12: skrajny piksel kropki jest już wewnątrz kolumny — pasek go zasłoni.
      expect(pomiar!.wystajePoza).toBeLessThanOrEqual(0);
      // AC-13: kropka nadal leży NA linii (a nie obok niej).
      expect(pomiar!.odchylkaOdLinii).toBeLessThanOrEqual(1);
    } finally {
      await prisma.newsTopic.delete({ where: { id: temat.id } });
    }
  });
});

test.describe("099 — zgłoszenie z trybu wskazywania", () => {
  test("[099-AC1, 099-AC2, 099-AC10, 099-AC11] zadanie powstaje od razu i przeżywa zamknięcie asystenta", async ({ page }) => {
    const workspaceId = await przestrzenAdmina();
    // Skrzynka zgłoszeń: projekt „Omnia" w przestrzeni administratora (fallback z `feedback.ts`).
    const projekt =
      (await prisma.taskProject.findFirst({ where: { workspaceId, name: PROJEKT_SKRZYNKI } })) ??
      (await prisma.taskProject.create({ data: { name: PROJEKT_SKRZYNKI, workspaceId } }));

    const opis = `Test klikacza 099 — ${Date.now()}`;

    await otworz(page, "/tasks", 1280);
    // Tryb administratora musi być włączony — to on odsłania „robaczka" (085).
    await page.evaluate(() => localStorage.setItem("omnia.trybAdmina", "1"));
    await page.reload();
    await page.waitForLoadState("load").catch(() => {});
    await page.waitForTimeout(800);

    // Wejście w tryb wskazywania skrótem, potem wskazanie dowolnego elementu treści.
    await page.keyboard.press("Control+Shift+B");
    await page.locator("main h1").first().click({ force: true });

    // Asystent otwiera się w trybie zgłoszenia: wybór priorytetu jest widoczny OD RAZU (AC-10).
    const wysoki = page.getByRole("button", { name: "Wysoki", exact: true });
    await expect(wysoki).toBeVisible({ timeout: 10000 });
    await wysoki.click();

    await page.locator("textarea").last().fill(opis);
    // Kompozytor wysyła Ctrl+Enter (samo Enter robi nową linię) — tak jak mówi podpowiedź pod polem.
    await page.keyboard.press("Control+Enter");

    // AC-1: potwierdzenie pojawia się bez czekania na model.
    await expect(page.getByText("Utworzono zgłoszenie", { exact: false })).toBeVisible({ timeout: 10000 });

    // AC-2: zamknięcie asystenta zaraz po wysyłce niczego nie cofa.
    await page.keyboard.press("Escape");

    const zadanie = await prisma.task.findFirst({
      where: { projectId: projekt.id, description: { contains: opis } },
      orderBy: { createdAt: "desc" },
    });
    expect(zadanie, "zadanie nie powstało w skrzynce zgłoszeń").not.toBeNull();
    // AC-11: priorytet wybrany w kompozytorze trafił do zadania.
    expect(zadanie!.priority).toBe("HIGH");
    // AC-5: opis zgłaszającego jest w zadaniu słowo w słowo.
    expect(zadanie!.description ?? "").toContain(opis);

    // AC-6: zrzut wskazanego elementu dojechał aż do zadania — cała droga naraz: rasteryzacja
    // w przeglądarce → magistrala asystenta → akcja → tabela załączników.
    const zalaczniki = await prisma.taskAttachment.findMany({ where: { taskId: zadanie!.id } });
    expect(zalaczniki.length, "zrzut nie dojechał do zadania").toBe(1);
    expect(zalaczniki[0].kind).toBe("screenshot");
    expect(zalaczniki[0].url.startsWith("data:image/"), "załącznik nie jest obrazem").toBe(true);

    await prisma.task.delete({ where: { id: zadanie!.id } });
    // AC-7: kaskada — zrzut ginie razem z zadaniem, bez osobnego sprzątania.
    expect(await prisma.taskAttachment.count({ where: { taskId: zadanie!.id } })).toBe(0);
  });
});
