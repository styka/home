import type { CSSProperties } from "react";

export const cardStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 12,
  padding: "14px 16px",
  borderRadius: 10,
  border: "1px solid var(--border)",
  background: "var(--bg-surface)",
  textDecoration: "none",
  transition: "background 0.1s, border-color 0.1s",
};

export const compactCardStyle: CSSProperties = {
  ...cardStyle,
  padding: "12px 14px",
};

export const cardHoverHandlers = {
  onMouseEnter: (e: React.MouseEvent<HTMLElement>) => {
    e.currentTarget.style.background = "var(--bg-elevated)";
    e.currentTarget.style.borderColor = "var(--border-focus)";
  },
  onMouseLeave: (e: React.MouseEvent<HTMLElement>) => {
    e.currentTarget.style.background = "var(--bg-surface)";
    e.currentTarget.style.borderColor = "var(--border)";
  },
};

export const pageContainerStyle: CSSProperties = {
  flex: 1,
  overflowY: "auto",
  backgroundColor: "var(--bg-base)",
  padding: "24px 16px",
};

export const pageInnerStyle: CSSProperties = {
  maxWidth: 640,
  margin: "0 auto",
  display: "flex",
  flexDirection: "column",
  gap: 24,
};

export const sectionHeadingStyle: CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  color: "var(--text-muted)",
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  marginBottom: 8,
  margin: 0,
};
