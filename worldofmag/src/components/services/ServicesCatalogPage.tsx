"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Handshake, Search, Briefcase, ClipboardList, MapPin } from "lucide-react";
import { PageHeader, EmptyState, pageContainerStyle, pageInnerStyle, cardStyle, cardHoverHandlers } from "@/components/ui/home";
import { getListings } from "@/actions/services";
import type { ListingDTO, ServiceCategoryDTO } from "@/lib/services";
import { RatingStars, formatPrice, fieldInputStyle, primaryButtonStyle, secondaryButtonStyle } from "./serviceUi";

interface Props {
  initialListings: ListingDTO[];
  categories: ServiceCategoryDTO[];
  hasProviderProfile: boolean;
}

export function ServicesCatalogPage({ initialListings, categories, hasProviderProfile }: Props) {
  const [listings, setListings] = useState<ListingDTO[]>(initialListings);
  const [query, setQuery] = useState("");
  const [activeCat, setActiveCat] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function applyFilters(nextCat: string | null, nextQuery: string) {
    startTransition(async () => {
      const results = await getListings({
        categoryId: nextCat ?? undefined,
        query: nextQuery.trim() || undefined,
      });
      setListings(results);
    });
  }

  function selectCategory(id: string | null) {
    setActiveCat(id);
    applyFilters(id, query);
  }

  function onSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    applyFilters(activeCat, query);
  }

  return (
    <div style={pageContainerStyle}>
      <div style={pageInnerStyle}>
        <PageHeader
          icon={<Handshake size={22} />}
          iconColor="var(--accent-blue)"
          title="Usługi"
          subtitle="Znajdź wykonawcę lub zaoferuj swoje usługi"
          action={
            <div style={{ display: "flex", gap: 8 }}>
              <Link href="/services/requests" style={{ ...secondaryButtonStyle, display: "inline-flex", alignItems: "center", gap: 6, textDecoration: "none" }}>
                <ClipboardList size={15} /> Moje zlecenia
              </Link>
              <Link href="/services/provider" style={{ ...primaryButtonStyle, display: "inline-flex", alignItems: "center", gap: 6, textDecoration: "none" }}>
                <Briefcase size={15} /> {hasProviderProfile ? "Panel wykonawcy" : "Zostań wykonawcą"}
              </Link>
            </div>
          }
        />

        {/* Wyszukiwarka */}
        <form onSubmit={onSearchSubmit} style={{ display: "flex", gap: 8 }}>
          <div style={{ position: "relative", flex: 1 }}>
            <Search size={15} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Szukaj usługi lub wykonawcy…"
              style={{ ...fieldInputStyle, paddingLeft: 32 }}
            />
          </div>
          <button type="submit" style={primaryButtonStyle} disabled={pending}>
            Szukaj
          </button>
        </form>

        {/* Kategorie */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          <CategoryChip label="Wszystkie" icon="🗂️" active={activeCat === null} onClick={() => selectCategory(null)} />
          {categories.map((c) => (
            <CategoryChip
              key={c.id}
              label={c.name}
              icon={c.icon}
              color={c.color}
              active={activeCat === c.id}
              onClick={() => selectCategory(c.id)}
            />
          ))}
        </div>

        {/* Lista ofert */}
        {listings.length === 0 ? (
          <EmptyState
            icon={<Handshake size={28} />}
            message="Brak ofert w tej kategorii"
            hint={hasProviderProfile ? "Dodaj własną ofertę w panelu wykonawcy." : "Zostań wykonawcą i dodaj pierwszą ofertę."}
            cta={{ label: "Panel wykonawcy", href: "/services/provider", color: "var(--accent-blue)" }}
          />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10, opacity: pending ? 0.6 : 1 }}>
            {listings.map((l) => (
              <Link key={l.id} href={`/services/${l.id}`} style={cardStyle} {...cardHoverHandlers}>
                <div style={{ fontSize: 24, lineHeight: 1, flexShrink: 0 }}>{l.category?.icon ?? "🛠️"}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>{l.title}</div>
                  <div style={{ fontSize: 12, color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 8, marginTop: 2, flexWrap: "wrap" }}>
                    <span>{l.provider.displayName}</span>
                    {l.provider.area && (
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
                        <MapPin size={11} /> {l.provider.area}
                      </span>
                    )}
                    <RatingStars avg={l.provider.ratingAvg} count={l.provider.ratingCount} size={11} />
                  </div>
                </div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--accent-green)", flexShrink: 0, textAlign: "right" }}>
                  {formatPrice(l.priceModel, l.priceAmount, l.currency)}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function CategoryChip({
  label,
  icon,
  color,
  active,
  onClick,
}: {
  label: string;
  icon: string;
  color?: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "6px 12px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 500,
        cursor: "pointer",
        border: `1px solid ${active ? (color ?? "var(--accent-blue)") : "var(--border)"}`,
        background: active ? "color-mix(in srgb, var(--accent-blue) 14%, transparent)" : "var(--bg-surface)",
        color: active ? "var(--text-primary)" : "var(--text-secondary)",
      }}
    >
      <span>{icon}</span>
      {label}
    </button>
  );
}
