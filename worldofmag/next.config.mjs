import { execSync } from "child_process"

function getGitInfo() {
  try {
    return {
      commit:     execSync("git rev-parse --short HEAD",    { encoding: "utf8" }).trim(),
      branch:     execSync("git rev-parse --abbrev-ref HEAD", { encoding: "utf8" }).trim(),
      commitDate: execSync("git log -1 --format=%cI",       { encoding: "utf8" }).trim(),
      commitMsg:  execSync("git log -1 --format=%s",        { encoding: "utf8" }).trim(),
    }
  } catch {
    return { commit: "unknown", branch: "unknown", commitDate: "unknown", commitMsg: "" }
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
  experimental: {
    serverActions: {
      allowedOrigins: ["localhost:3000", "worldofmag.onrender.com"],
    },
  },
};

export default nextConfig;
