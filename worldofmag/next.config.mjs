import { execSync } from "child_process"
import createNextIntlPlugin from "next-intl/plugin"

function getGitInfo() {
  try {
    const rawBranch = execSync("git rev-parse --abbrev-ref HEAD", { encoding: "utf8" }).trim()
    // On Render (and most CI/CD) git is in detached HEAD state → abbrev-ref returns "HEAD".
    // Render injects RENDER_GIT_BRANCH automatically, so prefer that.
    const branch = (rawBranch === "HEAD" ? process.env.RENDER_GIT_BRANCH : rawBranch) ?? rawBranch
    return {
      commit:     execSync("git rev-parse --short HEAD", { encoding: "utf8" }).trim(),
      branch,
      commitDate: execSync("git log -1 --format=%cI",   { encoding: "utf8" }).trim(),
      commitMsg:  execSync("git log -1 --format=%s",    { encoding: "utf8" }).trim(),
    }
  } catch {
    return { commit: "unknown", branch: process.env.RENDER_GIT_BRANCH ?? "unknown", commitDate: "unknown", commitMsg: "" }
  }
}

const git = getGitInfo()

const nextConfig = {
  env: {
    NEXT_PUBLIC_BUILD_COMMIT:      git.commit,
    NEXT_PUBLIC_BUILD_BRANCH:      git.branch,
    NEXT_PUBLIC_BUILD_DATE:        new Date().toISOString(),
    NEXT_PUBLIC_BUILD_COMMIT_DATE: git.commitDate,
    NEXT_PUBLIC_BUILD_COMMIT_MSG:  git.commitMsg,
  },
  eslint: {
    // Z-011/015 (T-02): ESLint jest JAWNĄ bramką buildu (krok `next lint --dir src`
    // przed `next build`), więc wyłączamy auto-lint wbudowany w `next build` — jedno,
    // celowe miejsce (bez dublowania). Realne błędy = error (build pada), kosmetyka = warning.
    ignoreDuringBuilds: true,
    dirs: ["src"],
  },
  experimental: {
    // Z-090: instrumentation.ts (register()) — raportowanie błędów serwera + punkt
    // initu zewnętrznego error-trackingu (Sentry) gdy DSN jest ustawiony.
    instrumentationHook: true,
    serverActions: {
      allowedOrigins: ["localhost:3000", "worldofmag.onrender.com", "omnia-prod.onrender.com"],
    },
    // Nie używaj ponownie Router Cache dla stron dynamicznych — nawigacja w aplikacji
    // (zmień moduł → wróć) zawsze pobiera świeże dane. Razem z DataFreshness (router.refresh()
    // na visibility/focus) domyka cross-device świeżość bez ręcznego odświeżania strony.
    staleTimes: { dynamic: 0 },
  },
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // 084 (zadanie 28): `platform/sharing/cache.ts` sięga po `node:async_hooks` (zakres operacji
      // poza żądaniem). Do grafu KLIENTA trafia nie dlatego, że przeglądarka tego używa, tylko przez
      // barierę barelową: klient importuje Server Action z `@/modules/portfel/contract`, a kontrakt
      // — jako zwykły moduł, nie `"use server"` — jest przez webpack ROZWIĄZYWANY w całości, razem
      // z `lib/autoExpense`. Kod i tak zostaje wytrząśnięty; wywraca się samo rozwiązanie ścieżki,
      // bo modułu wbudowanego Node klient nie ma. (Import celowo BEZ przedrostka `node:` —
      // schematy URI webpack rozstrzyga przed aliasami, więc `node:async_hooks` byłoby nie do przykrycia.)
      //
      // `false` = pusty moduł po stronie klienta. Jest to poprawne, a nie zamiatające: zakres
      // operacji w przeglądarce nie ma sensu i ta gałąź nigdy tam nie biegnie. Alternatywy —
      // dopisanie `"use server"` do kontraktu (wystawiłoby `bookAutoExpense` jako punkt końcowy
      // wołalny z przeglądarki) albo dublowanie akcji w module Usługi — są gorsze.
      config.resolve.alias = { ...config.resolve.alias, async_hooks: false };
    }
    return config;
  },
};

/**
 * 089 (zadanie 34): `next-intl` BEZ routingu językowego — aplikacja nie ma i nie będzie miała
 * ścieżek `/pl/...`. Język należy do przestrzeni (rozdz. 8.2), nie do adresu; prefiks w URL-u
 * związałby go z sesją przeglądarki i unieważnił wszystkie istniejące zakładki.
 */
const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

export default withNextIntl(nextConfig);
