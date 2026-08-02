"use client";

import Link from "next/link";
import { Star } from "lucide-react";
import { openFavoritesSwitcher } from "@/lib/favorites/favoritesBus";
import { filterAccessibleFavorites, type FavoriteViewDTO } from "@/lib/favorites/favoriteViews";

interface FavoriteCardsProps {
  favorites: FavoriteViewDTO[];
  permissions: string[];
}

/**
 * 042: ulubione widoki jako karty na pulpicie — „guziki do natychmiastowego otwarcia".
 *
 * Pusty stan (AC-6) to JEDNA linijka zachęty, nie pusta ramka z nagłówkiem: sekcja, której
 * użytkownik jeszcze nie używa, nie ma prawa zajmować miejsca nad fałdą.
 */
export function FavoriteCards({ favorites, permissions }: FavoriteCardsProps) {
  const accessible = filterAccessibleFavorites(favorites, permissions);

  if (accessible.length === 0) {
    return (
      <p style={{ fontSize: 12.5, color: "var(--text-muted)", margin: 0, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
        <Star size={12} style={{ color: "var(--accent-amber)", flexShrink: 0 }} />
        Zapisz miejsce gwiazdką w pasku, żeby wracać tu jednym kliknięciem.
      </p>
    );
  }

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
        gap: 8,
      }}
    >
      {accessible.map((f, i) => (
        <Link
          key={f.id}
          href={f.path}
          title={`${f.label} — ${f.path}`}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "10px 12px",
            borderRadius: "var(--radius, 8px)",
            border: "1px solid var(--border)",
            // Delikatna poświata koloru zakładki — wyłącznie przez color-mix na tokenach,
            // więc działa tak samo na skórce jasnej i ciemnej (C-30).
            background: f.color
              ? `linear-gradient(180deg, color-mix(in srgb, ${f.color} 10%, var(--bg-surface)), var(--bg-surface))`
              : "var(--bg-surface)",
            color: "var(--text-primary)",
            textDecoration: "none",
            minHeight: 44,
          }}
        >
          <span style={{ fontSize: 16, flexShrink: 0 }}>{f.icon}</span>
          <span style={{ fontSize: 13, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>
            {f.label}
          </span>
          {i < 9 && (
            <kbd style={{ fontSize: 9, color: "var(--text-muted)", flexShrink: 0 }}>⌥{i + 1}</kbd>
          )}
        </Link>
      ))}

      <button
        onClick={openFavoritesSwitcher}
        title="Wszystkie ulubione (Alt+0)"
        style={{
          display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
          padding: "10px 12px", borderRadius: "var(--radius, 8px)",
          border: "1px dashed var(--border)", background: "transparent",
          color: "var(--text-muted)", fontSize: 12.5, cursor: "pointer", minHeight: 44,
        }}
      >
        <Star size={12} /> Wszystkie
      </button>
    </div>
  );
}
