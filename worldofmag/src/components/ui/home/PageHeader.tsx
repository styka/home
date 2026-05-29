import type { ReactNode } from "react";
import Link from "next/link";

interface PageHeaderProps {
  icon: ReactNode;
  iconColor?: string;
  title: string;
  subtitle?: string;
  action?: ReactNode;
  /** Gdy podane — tytuł działu staje się linkiem do strony domowej działu. */
  href?: string;
}

export function PageHeader({ icon, iconColor, title, subtitle, action, href }: PageHeaderProps) {
  const titleInner = (
    <>
      <span style={{ color: iconColor, display: "flex", flexShrink: 0 }}>{icon}</span>
      <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {title}
      </span>
    </>
  );
  return (
    <div
      style={{
        display: "flex",
        alignItems: subtitle ? "flex-start" : "center",
        justifyContent: "space-between",
        gap: 12,
      }}
    >
      <div style={{ minWidth: 0, flex: 1 }}>
        <h1
          style={{
            fontSize: 22,
            fontWeight: 700,
            color: "var(--text-primary)",
            margin: 0,
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          {href ? (
            <Link href={href} title="Strona główna działu" style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0, color: "inherit", textDecoration: "none" }}>
              {titleInner}
            </Link>
          ) : (
            titleInner
          )}
        </h1>
        {subtitle && (
          <p
            style={{
              fontSize: 13,
              color: "var(--text-muted)",
              margin: 0,
              marginTop: 4,
              paddingLeft: 32,
            }}
          >
            {subtitle}
          </p>
        )}
      </div>
      {action && <div style={{ flexShrink: 0 }}>{action}</div>}
    </div>
  );
}
