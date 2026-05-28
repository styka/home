// Środowisko/nazwa aplikacji zależne od gałęzi deployu.
// Produkcja (branch master) → "Omnia"; dev (develop) i lokalnie → pierwotna nazwa.
// NEXT_PUBLIC_BUILD_BRANCH jest wstrzykiwany w next.config.mjs (z RENDER_GIT_BRANCH na Renderze).
export const IS_PROD = process.env.NEXT_PUBLIC_BUILD_BRANCH === "master";
export const APP_NAME = IS_PROD ? "Omnia" : "WorldOfMag";
