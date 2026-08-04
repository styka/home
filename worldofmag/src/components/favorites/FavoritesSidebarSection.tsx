"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Star, Search, Settings2 } from "lucide-react";
import { openFavoritesSwitcher } from "@/platform/favorites/favoritesBus";
import { FavoriteStarButton } from "@/components/favorites/FavoriteStarButton";
import { filterAccessibleFavorites, type FavoriteViewDTO } from "@/platform/favorites/favoriteViews";
import { isPathLocked } from "@/lib/pathPermissions";

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
 * 043: sekcja renderuje się ZAWSZE, także przy zerze wpisów (AC-1). W 042 zwracała `null`, co
 * w praktyce znaczyło „funkcji nie ma na komputerze" — właściciel zgłosił to jako błąd i miał
 * rację: skoro jedyny punkt zapisu też był schowany na dole paska, nie było skąd się dowiedzieć,
 * że ulubione w ogóle istnieją. Teraz sekcja niesie trzy rzeczy w stałej kolejności: punkt zapisu
 * bieżącego widoku (AC-2), zarządzanie (AC-3) i listę.
 */
export function FavoritesSidebarSection({ favorites, userPermissions }: FavoritesSidebarSectionProps) {
  const pathname = usePathname();
  const accessible = filterAccessibleFavorites(favorites, userPermissions, isPathLocked);

  const visible = accessible.slice(0, VISIBLE_LIMIT);
  const hiddenCount = accessible.length - visible.length;

  return (
    <div style={{ paddingBottom: 6, marginBottom: 6, borderBottom: "1px solid var(--border)" }}>
      <div
        className="flex items-center gap-2 px-4"
        style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 4 }}
      >
        <Star size={11} style={{ color: "var(--accent-amber)" }} />
        <span className="flex-1">Ulubione</span>
        <Link
          href="/settings#ulubione"
          title="Zarządzaj ulubionymi — nazwa, ikona, kolor, kolejność"
          aria-label="Zarządzaj ulubionymi"
          style={{ color: "var(--text-muted)", display: "inline-flex", alignItems: "center" }}
        >
          <Settings2 size={12} />
        </Link>
      </div>

      {/* Punkt zapisu bieżącego widoku — pierwszy element sekcji (AC-2). */}
      <FavoriteStarButton favorites={favorites} placement="viewbar" />

      {accessible.length === 0 ? (
        <p
          className="px-4"
          style={{ fontSize: 10.5, color: "var(--text-muted)", lineHeight: 1.45, margin: "6px 0 2px" }}
        >
          Nie masz jeszcze zapisanych widoków. Ustaw filtry na dowolnej stronie i zapisz ją
          przyciskiem powyżej — wróci tu razem z filtrami.
        </p>
      ) : (
        <>
          <div style={{ height: 4 }} />
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
        </>
      )}
    </div>
  );
}
