"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { GraduationCap } from "lucide-react";
import { getDecks } from "@/actions/languageDecks";
import type { LanguageDeck } from "@/types";

export function LanguagesSideNav() {
  const pathname = usePathname();
  const [decks, setDecks] = useState<LanguageDeck[]>([]);
  const [hovered, setHovered] = useState<string | null>(null);

  useEffect(() => {
    getDecks().then(setDecks).catch(() => {});
  }, []);

  if (decks.length === 0) {
    return (
      <div className="pb-2">
        <div className="flex items-center gap-2 mx-2 text-xs" style={{ paddingLeft: 40, paddingTop: 5, paddingBottom: 5, color: "var(--text-muted)" }}>
          <GraduationCap size={12} /> Brak talii
        </div>
      </div>
    );
  }

  return (
    <div className="pb-2">
      {decks.map((d) => {
        const href = `/languages/${d.id}`;
        const active = pathname === href || pathname.startsWith(href + "/");
        return (
          <Link
            key={d.id}
            href={href}
            onMouseEnter={() => setHovered(d.id)}
            onMouseLeave={() => setHovered(null)}
            className="flex items-center gap-2 mx-2 rounded text-xs"
            style={{
              paddingLeft: 40,
              paddingTop: 5,
              paddingBottom: 5,
              paddingRight: 8,
              backgroundColor: active ? "var(--bg-elevated)" : hovered === d.id ? "var(--bg-hover)" : undefined,
              color: active ? "var(--text-primary)" : "var(--text-muted)",
            }}
          >
            <span className="flex-1 truncate">{d.name}</span>
            {(d.dueCount ?? 0) > 0 && (
              <span style={{ fontSize: 10, color: "var(--accent-green)" }}>{d.dueCount}</span>
            )}
          </Link>
        );
      })}
    </div>
  );
}
