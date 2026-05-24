import type { Page, Locator } from "@playwright/test";

export class BasePage {
  constructor(protected readonly page: Page) {}

  async goto(path: string) {
    await this.page.goto(path);
  }

  heading(name: string | RegExp): Locator {
    return this.page.getByRole("heading", { name });
  }

  button(name: string | RegExp): Locator {
    return this.page.getByRole("button", { name });
  }

  link(name: string | RegExp): Locator {
    return this.page.getByRole("link", { name });
  }

  /** True when running under the mobile (iPhone) project. */
  get isMobile(): boolean {
    const vp = this.page.viewportSize();
    return !!vp && vp.width < 768;
  }
}
