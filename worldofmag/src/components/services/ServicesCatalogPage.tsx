"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Handshake, Search, Briefcase, ClipboardList, MapPin, SlidersHorizontal, Navigation } from "lucide-react";
import { PageHeader, EmptyState, pageContainerStyle, pageInnerStyle, cardStyle, cardHoverHandlers } from "@/components/ui/home";
import { getListings, type ListingSort } from "@/actions/services";
import type { ListingDTO, ServiceCategoryDTO } from "@/lib/services";
import { formatDistance } from "@/lib/serviceGeo";
import { RatingStars, formatPrice, fieldInputStyle, fieldLabelStyle, primaryButtonStyle, secondaryButtonStyle, VerifiedBadge } from "./serviceUi";

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

  // M10 — filtry zaawansowane
  const [showFilters, setShowFilters] = useState(false);
  const [sort, setSort] = useState<ListingSort>("rating");
  const [minRating, setMinRating] = useState(0);
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [bookingOnly, setBookingOnly] = useState(false);
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [nearPos, setNearPos] = useState<{ lat: number; lon: number } | null>(null);
  const [radiusKm, setRadiusKm] = useState(10);
  const [geoMsg, setGeoMsg] = useState<string | null>(null);

  function applyFilters(nextCat: string | null, nextQuery: string, over?: Partial<{ sort: ListingSort; minRating: number; minPrice: string; maxPrice: string; bookingOnly: boolean; verifiedOnly: boolean; nearPos: { lat: number; lon: number } | null; radiusKm: number }>) {
    const s = over?.sort ?? sort;
    const mr = over?.minRating ?? minRating;
    const mnp = over?.minPrice ?? minPrice;
    const mxp = over?.maxPrice ?? maxPrice;
    const bo = over?.bookingOnly ?? bookingOnly;
    const vo = over?.verifiedOnly ?? verifiedOnly;
    const np = over?.nearPos !== undefined ? over.nearPos : nearPos;
    const rk = over?.radiusKm ?? radiusKm;
    const toGrosze = (v: string) => { const n = parseFloat(v.replace(",", ".")); return Number.isFinite(n) ? Math.round(n * 100) : null; };
    startTransition(async () => {
      const results = await getListings({
        categoryId: nextCat ?? undefined,
        query: nextQuery.trim() || undefined,
        sort: np && s === "rating" ? "distance" : s,
        minRating: mr > 0 ? mr : null,
        minPrice: mnp.trim() ? toGrosze(mnp) : null,
        maxPrice: mxp.trim() ? toGrosze(mxp) : null,
        bookingOnly: bo,
        verifiedOnly: vo,
        near: np ? { lat: np.lat, lon: np.lon, radiusKm: rk } : null,
      });
      setListings(results);
    });
  }

  function toggleNear() {
    if (nearPos) { setNearPos(null); setGeoMsg(null); applyFilters(activeCat, query, { nearPos: null }); return; }
    if (typeof navigator === "undefined" || !navigator.geolocation) { setGeoMsg("Brak geolokalizacji w przeglądarce"); return; }
    setGeoMsg("Pobieram lokalizację…");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const p = { lat: pos.coords.latitude, lon: pos.coords.longitude };
        setNearPos(p); setGeoMsg(null);
        applyFilters(activeCat, query, { nearPos: p });
      },
      () => setGeoMsg("Nie udało się pobrać lokalizacji"),
      { enableHighAccuracy: false, timeout: 10000 }
    );
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
          <button type="button" onClick={() => setShowFilters((v) => !v)} title="Filtry" style={{ ...secondaryButtonStyle, display: "inline-flex", alignItems: "center", gap: 6 }}>
            <SlidersHorizontal size={15} /> Filtry
          </button>
        </form>

        {/* Filtry zaawansowane (M10) */}
        {showFilters && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12, padding: 12, borderRadius: 10, border: "1px solid var(--border)", background: "var(--bg-surface)", alignItems: "flex-end" }}>
            <div>
              <label style={fieldLabelStyle}>Sortuj</label>
              <select value={sort} onChange={(e) => { const v = e.target.value as ListingSort; setSort(v); applyFilters(activeCat, query, { sort: v }); }} style={{ ...fieldInputStyle, width: 160 }}>
                <option value="rating">Najlepiej oceniani</option>
                <option value="priceAsc">Cena rosnąco</option>
                <option value="priceDesc">Cena malejąco</option>
                <option value="newest">Najnowsze</option>
              </select>
            </div>
            <div>
              <label style={fieldLabelStyle}>Min. ocena</label>
              <select value={minRating} onChange={(e) => { const v = Number(e.target.value); setMinRating(v); applyFilters(activeCat, query, { minRating: v }); }} style={{ ...fieldInputStyle, width: 120 }}>
                <option value={0}>dowolna</option>
                <option value={3}>3+ ★</option>
                <option value={4}>4+ ★</option>
                <option value={4.5}>4.5+ ★</option>
              </select>
            </div>
            <div>
              <label style={fieldLabelStyle}>Cena (PLN)</label>
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <input value={minPrice} onChange={(e) => setMinPrice(e.target.value)} onBlur={() => applyFilters(activeCat, query)} placeholder="od" inputMode="decimal" style={{ ...fieldInputStyle, width: 80 }} />
                <span style={{ color: "var(--text-muted)" }}>–</span>
                <input value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} onBlur={() => applyFilters(activeCat, query)} placeholder="do" inputMode="decimal" style={{ ...fieldInputStyle, width: 80 }} />
              </div>
            </div>
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--text-secondary)", cursor: "pointer", paddingBottom: 8 }}>
              <input type="checkbox" checked={bookingOnly} onChange={(e) => { setBookingOnly(e.target.checked); applyFilters(activeCat, query, { bookingOnly: e.target.checked }); }} />
              Z rezerwacją online
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--text-secondary)", cursor: "pointer", paddingBottom: 8 }}>
              <input type="checkbox" checked={verifiedOnly} onChange={(e) => { setVerifiedOnly(e.target.checked); applyFilters(activeCat, query, { verifiedOnly: e.target.checked }); }} />
              Tylko zweryfikowani
            </label>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 8 }}>
              <button type="button" onClick={toggleNear} style={{ ...(nearPos ? primaryButtonStyle : secondaryButtonStyle), display: "inline-flex", alignItems: "center", gap: 6 }}>
                <Navigation size={14} /> {nearPos ? "W pobliżu: wł." : "W pobliżu"}
              </button>
              {nearPos && (
                <div>
                  <label style={fieldLabelStyle}>Promień</label>
                  <select value={radiusKm} onChange={(e) => { const v = Number(e.target.value); setRadiusKm(v); applyFilters(activeCat, query, { radiusKm: v }); }} style={{ ...fieldInputStyle, width: 110 }}>
                    {[2, 5, 10, 25, 50].map((r) => <option key={r} value={r}>{r} km</option>)}
                  </select>
                </div>
              )}
            </div>
          </div>
        )}
        {geoMsg && <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{geoMsg}</div>}

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
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                      {l.provider.displayName}
                      {l.provider.verified && <VerifiedBadge size={12} />}
                    </span>
                    {l.provider.area && (
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
                        <MapPin size={11} /> {l.provider.area}
                      </span>
                    )}
                    <RatingStars avg={l.provider.ratingAvg} count={l.provider.ratingCount} size={11} />
                    {l.distanceKm != null && (
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 3, color: "var(--accent-blue)" }}>
                        <Navigation size={11} /> {formatDistance(l.distanceKm)}
                      </span>
                    )}
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
