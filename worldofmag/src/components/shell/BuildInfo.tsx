function fmtDate(iso: string | undefined) {
  if (!iso || iso === "unknown") return "?"
  return iso.slice(0, 16).replace("T", " ")
}

const commit     = process.env.NEXT_PUBLIC_BUILD_COMMIT      ?? "?"
const branch     = process.env.NEXT_PUBLIC_BUILD_BRANCH      ?? "?"
const buildDate  = process.env.NEXT_PUBLIC_BUILD_DATE        ?? "?"
const commitDate = process.env.NEXT_PUBLIC_BUILD_COMMIT_DATE ?? "?"
const commitMsg  = process.env.NEXT_PUBLIC_BUILD_COMMIT_MSG  ?? ""

export function BuildInfo() {
  return (
    <div
      style={{
        padding: "10px 14px 10px",
        borderTop: "1px solid var(--border)",
        fontFamily: "monospace",
        fontSize: 10,
        lineHeight: 1.7,
        color: "var(--text-muted)",
        opacity: 0.7,
        userSelect: "text",
      }}
      title={commitMsg || undefined}
    >
      <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 1 }}>
        <span style={{ color: "var(--accent-purple)", opacity: 0.8 }}>⬡</span>
        <span>{commit}</span>
        <span style={{ opacity: 0.4 }}>·</span>
        <span style={{ maxWidth: 90, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {branch}
        </span>
      </div>
      <div>commit&nbsp;&nbsp;{fmtDate(commitDate)}</div>
      <div>built&nbsp;&nbsp;&nbsp;&nbsp;{fmtDate(buildDate)}</div>
    </div>
  )
}
