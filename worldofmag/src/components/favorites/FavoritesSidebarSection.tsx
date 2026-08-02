"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Star, Search } from "lucide-react";
import { openFavoritesSwitcher } from "@/lib/favorites/favoritesBus";
import { filterAccessibleFavorites, type FavoriteViewDTO } from "@/lib/favorites/favoriteViews";

interface FavoritesSidebarSectionProps {
  favorites: FavoriteViewDTO[];
  userPermissions: string[];
}

const VISIBLE_LIMIT = 6;

/**
 * 042: sekcja ulubionych w pasku bocznym (desktop). Pokazuje kilka pierwszych pozycji, resztę
 * chowa za „Wszystkie ulubione" otwierającym przełącznik z wyszukiwaniem — dzięki temu długa
 * lista nie rozpycha nawigacji modułów.
 *
 * Gdy użytkownik nie ma jeszcze żadnego ulubionego, sekcja NIE renderuje się wcale (AC-6):
 * pusty nagłówek w pasku byłby stałym szumem, a zachęta i tak czeka na pulpicie.
 */
export function FavoritesSidebarSection({ favorites, userPermissions }: FavoritesSidebarSectionProps) {
  const pathname = usePathname();
  const accessible = filterAccessibleFavorites(favorites, userPermissions);

  if (accessible.length === 0) return null;

  const visible = accessible.slice(0, VISIBLE_LIMIT);
  const hiddenCount = accessible.length - visible.length;

  return (
    <div style={{ paddingBottom: 6, marginBottom: 6, borderBottom: "1px solid var(--border)" }}>
      <div
        className="flex items-center gap-2 px-4"
        style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 2 }}
      >
        <Star size={11} style={{ color: "var(--accent-amber)" }} />
        Ulubione
      </div>

      {visible.map((f, i) => {
        const isActive = pathname === f.path.split("?")[0];
        return (
          <Link
            key={f.id}
            href={f.path}
            title={f.label}
            className="flex items-center gap-2 px-4 py-1.5 mx-2 rounded text-xs"
            style={{
              textDecoration: "none",
              backgroundColor: isActive ? "var(--bg-elevated)" : undefined,
              color: isActive ? "var(--text-primary)" : "var(--text-muted)",
            }}
            onMouseEnter={(e) => { if (!isActive) { e.currentTarget.style.backgroundColor = "var(--bg-hover)"; e.currentTarget.style.color = "var(--text-secondary)"; } }}
            onMouseLeave={(e) => { if (!isActive) { e.currentTarget.style.backgroundColor = ""; e.currentTarget.style.color = "var(--text-muted)"; } }}
          >
            <span style={{ width: 14, textAlign: "center", flexShrink: 0 }}>{f.icon}</span>
            <span className="truncate flex-1">{f.label}</span>
            {i < 9 && (
              <kbd style={{ fontSize: 9, color: "var(--text-muted)", opacity: 0.7, flexShrink: 0 }}>⌥{i + 1}</kbd>
            )}
          </Link>
        );
      })}

      <button
        onClick={openFavoritesSwitcher}
        className="flex items-center gap-2 px-4 py-1.5 mx-2 rounded text-xs w-[calc(100%-1rem)] focus:outline-none"
        style={{ color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer" }}
        title="Wszystkie ulubione (Alt+0)"
      >
        <Search size={11} style={{ flexShrink: 0 }} />
        <span>{hiddenCount > 0 ? `Wszystkie ulubione (+${hiddenCount})` : "Wszystkie ulubione"}</span>
      </button>
    </div>
  );
}
