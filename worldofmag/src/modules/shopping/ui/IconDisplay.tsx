"use client";

import { odkazSvg, bezpiecznyObrazekData } from "../lib/odkazSvg";

interface IconDisplayProps {
  content: string;
  size?: number;
}

/**
 * 101 (AC-9): treść ikony jest **cudzym wejściem** — `getActiveCategoryIconMap` zwraca także ikony
 * zespołowe, więc to, co zapisał jeden użytkownik, renderuje się u drugiego. Odkażamy **tutaj**,
 * przy wyświetleniu, a nie wyłącznie przy zapisie: w bazie leżą już wiersze zapisane przed tą
 * poprawką i tylko ten krok je obejmuje.
 */
export function IconDisplay({ content, size = 24 }: IconDisplayProps) {
  if (content.startsWith("data:image/")) {
    // Rastry są bezpieczne; `data:image/svg+xml` to ta sama treść co niżej, tylko innym wejściem —
    // dlatego nie trafia do `<img>`, gdzie nie przechodzi przez odkażanie.
    if (!bezpiecznyObrazekData(content)) return null;
    return (
      // Treść to data-URI wybrany przez użytkownika — `next/image` nie ma tu czego optymalizować.
      // eslint-disable-next-line @next/next/no-img-element
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
        dangerouslySetInnerHTML={{ __html: odkazSvg(content) }}
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
