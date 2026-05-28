// Nazwa aplikacji zależna od środowiska deployu.
// Produkcja (branch master) → "Omnia"; dev (develop) i lokalnie → pierwotna nazwa.
// NEXT_PUBLIC_BUILD_BRANCH jest wstrzykiwany w next.config.mjs (z RENDER_GIT_BRANCH na Renderze).
export const APP_NAME = process.env.NEXT_PUBLIC_BUILD_BRANCH === "master" ? "Omnia" : "WorldOfMag";
