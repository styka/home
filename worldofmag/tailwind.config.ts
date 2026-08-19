import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  /**
   * 098 — GLOBY MUSZĄ OBEJMOWAĆ CAŁE `src`.
   *
   * Do 098 lista kończyła się na `pages`, `components` i `app`. Przebudowa 046 przeniosła interfejsy
   * WSZYSTKICH 21 modułów do `src/modules/`, a tego pliku nikt wtedy nie ruszył — więc Tailwind
   * przestał widzieć klasy używane tylko w modułach i wycinał je z arkusza.
   *
   * Objaw był mylący, bo NIEJEDNORODNY: klasa, która trafiła się też w `components/` albo `app/`,
   * dalej działała, a ta użyta wyłącznie w module — nie. Tak zniknęło `md:grid` w tygodniowym planie
   * posiłków: `hidden md:grid` zostało bez reguły przywracającej widoczność, więc **cała siatka planu
   * była na desktopie niewidoczna**, a strona wyglądała na wciąż ładującą się.
   *
   * Znalazł to klikacz — po tym, jak przestał być czerwony z sześćdziesięciu innych powodów.
   *
   * Lista jest teraz jedna: `./src/**`. Wyliczanie katalogów po jednym jest dokładnie tym rodzajem
   * równoległej listy, którą ta przebudowa usuwała z aplikacji — i tak samo cicho się rozjeżdża.
   */
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        base: "var(--bg-base)",
        surface: "var(--bg-surface)",
        elevated: "var(--bg-elevated)",
        hover: "var(--bg-hover)",
        border: "var(--border)",
        primary: "var(--text-primary)",
        secondary: "var(--text-secondary)",
        muted: "var(--text-muted)",
        "accent-blue": "var(--accent-blue)",
        "accent-green": "var(--accent-green)",
        "accent-red": "var(--accent-red)",
        "accent-amber": "var(--accent-amber)",
        "accent-purple": "var(--accent-purple)",
      },
      fontFamily: {
        mono: ["'JetBrains Mono'", "Consolas", "Monaco", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
