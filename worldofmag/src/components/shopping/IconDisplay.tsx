"use client";

interface IconDisplayProps {
  content: string;
  size?: number;
}

export function IconDisplay({ content, size = 24 }: IconDisplayProps) {
  if (content.startsWith("data:image/")) {
    return (
      <img
        src={content}
        alt=""
        width={size}
        height={size}
        style={{ objectFit: "contain", borderRadius: 4, display: "block" }}
      />
    );
  }
  if (content.trimStart().startsWith("<")) {
    return (
      <svg
        viewBox="0 0 24 24"
        width={size}
        height={size}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ color: "var(--text-secondary)", flexShrink: 0 }}
        dangerouslySetInnerHTML={{ __html: content }}
      />
    );
  }
  // Emoji or plain text
  return (
    <span style={{ fontSize: Math.round(size * 0.75), lineHeight: 1, userSelect: "none" }}>
      {content}
    </span>
  );
}
