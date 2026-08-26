import { test, expect } from "../fixtures/test";

/**
 * 042 — weryfikacja zgłoszonych usterek w Zadaniach (AC-20..AC-23).
 *
 * Kluczowa sztuczka: `@media (hover: hover)` emulujemy przez CDP
 * (`Emulation.setEmulatedMedia`), bo tylko tak da się w jednym Chromium sprawdzić OBA warianty —
 * urządzenie dotykowe (hover: none) i wskaźnik myszy (hover: hover).
 */

/** Tworzy projekt z jednym zadaniem i zwraca ich identyfikatory. */
async function seedTask(title: string, description?: string) {
  const { PrismaClient } = await import("@prisma/client");
  const { E2E_ADMIN } = await import("../fixtures/users");
  const prisma = new PrismaClient();
  try {
    const user = await prisma.user.findUniqueOrThrow({ where: { email: E2E_ADMIN.email } });
    const przestrzen = await prisma.workspace.findUniqueOrThrow({ where: { personalUserId: user.id } });
    const project = await prisma.taskProject.create({
      // 098: przestrzeń bierzemy zapytaniem, a NIE przez `wlasnoscOsobistaDoZapisu` z aplikacji.
      // Spec Playwrighta jest transpilowany, ale moduł zaimportowany z niego dynamicznie już nie —
      // `await import("@/platform/...")` kończy się „Cannot use import statement outside a module".
      // Fikstura ma być samowystarczalna: zna schemat, nie kod aplikacji.
      data: { name: `UX ${Date.now()}`, workspaceId: przestrzen.id },
    });
    const task = await prisma.task.create({
      data: { title, description: description ?? null, projectId: project.id, createdById: user.id },
    });
    return { projectId: project.id, taskId: task.id };
  } finally {
    await prisma.$disconnect();
  }
}

/** Dokłada zadanie do istniejącego projektu (gdy test potrzebuje więcej niż jednego wiersza). */
async function seedTaskWProjekcie(projectId: string, title: string) {
  const { PrismaClient } = await import("@prisma/client");
  const { E2E_ADMIN } = await import("../fixtures/users");
  const prisma = new PrismaClient();
  try {
    const user = await prisma.user.findUniqueOrThrow({ where: { email: E2E_ADMIN.email } });
    await prisma.task.create({ data: { title, projectId, createdById: user.id } });
  } finally {
    await prisma.$disconnect();
  }
}

test.describe("042 — usterki w Zadaniach", () => {
  test("[080-AC1] kolumna zaznaczeń pojawia się i ZNIKA razem z trybem zaznaczania", async ({ page }) => {
    /**
     * 080 (Z1) ZASTĘPUJE test [ux-AC20-AC21] z 042.
     *
     * 042 sprawdzało, że checkbox ujawnia się przy najechaniu myszą, a na dotyku nie. Właściciel
     * zgłosił potem, że chce czegoś innego: ikona trybu ma UKRYWAĆ I ODKRYWAĆ kolumnę, a nie tylko
     * blokować zaznaczanie. Ujawnianie przy najechaniu było właśnie powodem, dla którego checkbox
     * musiał się renderować zawsze (z `opacity-0`) i zajmować 20 px w każdym wierszu.
     *
     * Dlatego stary test nie jest „naprawiany" — jest zastąpiony testem nowej reguły. Asercja idzie
     * na OBECNOŚĆ W DOM, nie na przezroczystość: „ukryta kolumna" znaczy brak elementu, bo
     * `opacity: 0` chowa piksele, a nie układ.
     */
    const { projectId } = await seedTask("Zadanie testowe A");

    await page.goto(`/tasks/${projectId}`);
    await page.waitForLoadState("load").catch(() => {});
    await expect(page.getByText("Zadanie testowe A").first()).toBeVisible({ timeout: 15_000 });

    const checkboxy = page.locator('button[aria-label="Zaznacz zadanie"]');
    const przelacznik = page.getByRole("button", { name: /zaznacz wiele/i }).first();

    // Poza trybem: kolumny NIE MA w drzewie. Najechanie myszą też jej nie przywraca.
    await page.getByText("Zadanie testowe A").first().hover();
    await page.waitForTimeout(300);
    expect(await checkboxy.count()).toBe(0);

    // Włączenie trybu odsłania kolumnę.
    await przelacznik.click();
    await expect(checkboxy.first()).toBeVisible({ timeout: 10_000 });

    // Wyłączenie trybu chowa ją z powrotem — w całości.
    await przelacznik.click();
    await page.waitForTimeout(300);
    expect(await checkboxy.count()).toBe(0);
  });

  test("[ux-AC23] pole opisu rozciąga się bez wewnętrznego przewijania", async ({ page }) => {
    // JEDEN akapit bez znaków nowej linii — dokładnie przypadek, którego stary `rows` nie widział.
    const longText = "Bardzo dlugi opis zadania. ".repeat(60).trim();
    const { projectId, taskId } = await seedTask("Zadanie z dlugim opisem", longText);

    await page.goto(`/tasks/${projectId}?task=${taskId}`);
    await page.waitForLoadState("load").catch(() => {});

    // Otwieramy szczegóły zadania i wchodzimy w edycję opisu (klik w wyrenderowany markdown).
    await page.getByText("Zadanie z dlugim opisem").first().click();
    const rendered = page.locator("div.cursor-text").filter({ hasText: "Bardzo dlugi opis" }).first();
    await expect(rendered).toBeVisible({ timeout: 15_000 });
    await rendered.click();

    // 105: pole szybkiego dodawania też jest już `textarea` i stoi WYŻEJ w drzewie, więc
    // `locator("textarea").first()` trafiałoby w nie, a nie w opis. Bierzemy pole po jego
    // własnym zastępniku tekstu.
    const ta = page.getByPlaceholder(/Dodaj opis/);
    await expect(ta).toBeVisible({ timeout: 10_000 });

    const m = await ta.evaluate((el) => {
      const t = el as HTMLTextAreaElement;
      return { scrollHeight: t.scrollHeight, clientHeight: t.clientHeight, maxAllowed: Math.round(window.innerHeight * 0.6) };
    });
    console.log("[AC-23] pole opisu →", JSON.stringify(m));

    // Pole ma wysokość treści (z tolerancją 2px) albo osiągnęło sufit 60vh.
    const dopasowane = Math.abs(m.scrollHeight - m.clientHeight) <= 2;
    const przySuficie = m.clientHeight >= m.maxAllowed - 2;
    expect(dopasowane || przySuficie).toBe(true);
    // I na pewno jest znacznie wyższe niż domyślne 3 wiersze (~72 px).
    expect(m.clientHeight).toBeGreaterThan(100);
  });
});

test.describe("105 — UX tworzenia i przeglądania zadań", () => {
  test("[105-AC17] tryb zaznaczania PRZEŻYWA akcję masową", async ({ page }) => {
    /**
     * Zgłoszenie właściciela: „za każdym razem po wykonaniu bulk akcji widok z checkboxami się
     * wyłącza". Przyczyną było `finishSelection`, które czyściło zaznaczenie ORAZ gasiło tryb —
     * jedna funkcja na dwie różne rzeczy, wołana w sześciu miejscach.
     *
     * Asercja idzie na OBECNOŚĆ kolumny w drzewie, tak samo jak [080-AC1], bo to ta sama reguła
     * widziana z drugiej strony: tryb ma znikać wyłącznie wtedy, gdy ktoś go jawnie wyłączy.
     *
     * DWA zadania, nie jedno: zaznaczony wiersz zmienia etykietę na „Odznacz zadanie", więc przy
     * jednym zadaniu licznik „Zaznacz zadanie" spadłby do zera z powodu zaznaczenia, a nie z powodu
     * wyłączenia trybu — test mierzyłby coś innego, niż mówi jego nazwa.
     */
    const { projectId } = await seedTask("Zadanie masowe A");
    await seedTaskWProjekcie(projectId, "Zadanie masowe B");

    await page.goto(`/tasks/${projectId}`);
    await page.waitForLoadState("load").catch(() => {});
    await expect(page.getByText("Zadanie masowe A").first()).toBeVisible({ timeout: 15_000 });

    const doZaznaczenia = page.locator('button[aria-label="Zaznacz zadanie"]');
    const przelacznik = page.getByRole("button", { name: /zaznacz wiele/i }).first();

    await przelacznik.click();
    await expect(doZaznaczenia.first()).toBeVisible({ timeout: 10_000 });
    expect(await doZaznaczenia.count()).toBe(2);

    // Zaznaczamy jedno zadanie i wykonujemy na nim akcję masową z paska akcji zbiorczych.
    // `exact` jest tu konieczne: formularz dodawania ma własny przycisk „Priorytet (kliknij by
    // zmienić)", który stoi WYŻEJ w drzewie i bez tego przejąłby kliknięcie.
    await doZaznaczenia.first().click();
    const priorytetZbiorczy = page.getByRole("button", { name: "Priorytet", exact: true });
    await expect(priorytetZbiorczy).toBeVisible({ timeout: 10_000 });
    await priorytetZbiorczy.click();
    await page.getByRole("button", { name: /Wysoki/ }).first().click();

    // Sedno: po akcji kolumna zaznaczeń JEST NADAL w drzewie, przy OBU zadaniach — zaznaczenie
    // zostało wyczyszczone (te zadania są już zmienione), ale tryb trwa i można zaznaczać dalej.
    await expect(doZaznaczenia.first()).toBeVisible({ timeout: 10_000 });
    await expect(doZaznaczenia).toHaveCount(2, { timeout: 10_000 });

    // A jawne wyjście (Esc) dalej ją chowa — tryb nie stał się nieusuwalny.
    await page.keyboard.press("Escape");
    await expect(doZaznaczenia).toHaveCount(0, { timeout: 10_000 });
  });

  test("[105-AC5] pole dodawania zadania rośnie z tekstem", async ({ page }) => {
    // Ten sam pomiar co [ux-AC23], tylko dla pola dodawania: jednolinijkowy pasek pokazywał
    // z długiego tekstu jedną szczelinę i użytkownik nie widział, co pisze.
    const { projectId } = await seedTask("Zadanie kontrolne");

    await page.goto(`/tasks/${projectId}`);
    await page.waitForLoadState("load").catch(() => {});

    const pole = page.getByPlaceholder(/Dodaj zadanie/);
    await expect(pole).toBeVisible({ timeout: 15_000 });

    const wysokoscPrzed = await pole.evaluate((el) => (el as HTMLTextAreaElement).clientHeight);
    await pole.fill("Bardzo dlugi opis zadania do wpisania w pole dodawania. ".repeat(6).trim());

    const m = await pole.evaluate((el) => {
      const t = el as HTMLTextAreaElement;
      return { scrollHeight: t.scrollHeight, clientHeight: t.clientHeight };
    });
    console.log("[105-AC5] pole dodawania →", JSON.stringify(m));

    expect(m.clientHeight).toBeGreaterThan(wysokoscPrzed);
    expect(Math.abs(m.scrollHeight - m.clientHeight)).toBeLessThanOrEqual(4);
  });

  test("[105-AC11] tryb pelny oddaje zadaniu cala przestrzen i przezywa przeladowanie", async ({ page, isMobile }) => {
    // Tryb pełny jest ustawieniem KOMPUTERA — na wąskim ekranie panel i tak zajmuje cały ekran.
    test.skip(isMobile === true, "Tryb pelny dotyczy wylacznie widoku na komputerze (AC-13).");

    const { projectId, taskId } = await seedTask("Zadanie do rozwiniecia");

    await page.goto(`/tasks/${projectId}?task=${taskId}`);
    await page.waitForLoadState("load").catch(() => {});

    const przelacznik = page.getByRole("button", { name: /Rozwi.* na ca.* szerokość/i }).first();
    await expect(przelacznik).toBeVisible({ timeout: 15_000 });

    const panel = page.locator('[data-omnia-panel="zadanie"]');
    const szerokoscPrzed = await panel.evaluate((el) => el.clientWidth);
    await przelacznik.click();
    await expect(page.getByRole("button", { name: /Zwi.* do panelu bocznego/i }).first()).toBeVisible({ timeout: 10_000 });

    // Lista USTĘPUJE MIEJSCA: panel zajmuje istotnie więcej niż przedtem.
    const szerokoscPo = await panel.evaluate((el) => el.clientWidth);
    console.log("[105-AC11] panel →", JSON.stringify({ szerokoscPrzed, szerokoscPo }));
    expect(szerokoscPrzed).toBeGreaterThanOrEqual(360);
    expect(szerokoscPo).toBeGreaterThan(szerokoscPrzed);

    // Wybór trybu przeżywa przeładowanie (AC-12a) — wracamy na tę samą stronę z otwartym zadaniem.
    await page.reload();
    await page.waitForLoadState("load").catch(() => {});
    await expect(page.getByRole("button", { name: /Zwi.* do panelu bocznego/i }).first()).toBeVisible({ timeout: 15_000 });

    // Esc zdejmuje JEDNĄ warstwę: najpierw tryb pełny, zadanie zostaje otwarte.
    await page.keyboard.press("Escape");
    await expect(page.getByRole("button", { name: /Rozwi.* na ca.* szerokość/i }).first()).toBeVisible({ timeout: 10_000 });
  });

  test("[105-AC1] strona modulu pozwala dodac zadanie bez wchodzenia w projekt", async ({ page }) => {
    await page.goto("/tasks");
    await page.waitForLoadState("load").catch(() => {});

    const pole = page.getByPlaceholder(/Dodaj zadanie/);
    await expect(pole).toBeVisible({ timeout: 15_000 });

    const tytul = `E2E z widgetu ${Date.now()}`;
    await pole.fill(tytul);
    await pole.press("Enter");

    // Po zapisie lądujemy w zadaniu — adres niesie `?task=<id>`, więc panel szczegółów jest otwarty.
    await expect(page).toHaveURL(/\/tasks\/[^?]+\?task=/, { timeout: 20_000 });
    await expect(page.getByText(tytul).first()).toBeVisible({ timeout: 15_000 });
  });
});
