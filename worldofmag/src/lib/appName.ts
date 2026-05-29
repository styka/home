// Środowisko i nazwa marki zależne od gałęzi deployu.
// Marka to zawsze „Omnia". Na dev dodajemy znacznik DEV, by odróżnić środowisko.
// NEXT_PUBLIC_BUILD_BRANCH jest wstrzykiwany w next.config.mjs (z RENDER_GIT_BRANCH na Renderze).
export const IS_PROD = process.env.NEXT_PUBLIC_BUILD_BRANCH === "master";

// Marka (bez znacznika) — np. w zdaniach.
export const APP_NAME = "Omnia";

// Czysty tekst do <title>, manifestu i tytułu iOS (bez indeksu górnego):
// prod → „Omnia", dev → „Omnia DEV". Indeks górny ᴰᴱⱽ renderuje komponent <AppName/>.
export const APP_TITLE = IS_PROD ? "Omnia" : "Omnia DEV";

// Wersja ikony — podbij przy każdej zmianie wyglądu logo. iOS cache'uje
// apple-touch-icon po SAMEJ ścieżce (ignoruje ?query), więc wymuszamy świeżość
// zmianą ścieżki: /apple-touch-icon/<ICON_VERSION>. Patrz doświadczenia.md.
export const ICON_VERSION = "3";
