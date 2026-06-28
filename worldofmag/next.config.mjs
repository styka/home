import { execSync } from "child_process"

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
};

export default nextConfig;
