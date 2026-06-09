"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { ArrowLeft, MapPin, Star, MessageSquare } from "lucide-react";
import { PageHeader, SectionHeading, pageContainerStyle, pageInnerStyle, cardStyle, cardHoverHandlers } from "@/components/ui/home";
import { Heart } from "lucide-react";
import { RatingStars, formatPrice, VerifiedBadge, secondaryButtonStyle } from "./serviceUi";
import { setProviderVerified, toggleFavorite } from "@/actions/services";
import type { PriceModel } from "@/lib/services";

interface ProviderPublic {
  id: string;
  displayName: string;
  bio: string | null;
  area: string | null;
  ratingAvg: number;
  ratingCount: number;
  verified: boolean;
  nip: string | null;
  isFavorite: boolean;
  listings: { id: string; title: string; priceModel: PriceModel; priceAmount: number | null; currency: string; categoryIcon: string }[];
  images: { id: string; url: string; caption: string | null }[];
  reviews: { id: string; rating: number; comment: string | null; clientName: string }[];
}

export function ProviderPublicPage({ provider, isAdmin = false }: { provider: ProviderPublic; isAdmin?: boolean }) {
  const [verified, setVerified] = useState(provider.verified);
  const [favored, setFavored] = useState(provider.isFavorite);
  const [pending, startTransition] = useTransition();

  function onToggleFav() {
    setFavored((v) => !v);
    startTransition(async () => { const r = await toggleFavorite(provider.id); setFavored(r.favored); });
  }

  function toggleVerified() {
    startTransition(async () => {
      const next = !verified;
      await setProviderVerified(provider.id, next);
      setVerified(next);
    });
  }

  return (
    <div style={pageContainerStyle}>
      <div style={pageInnerStyle}>
        <Link href="/services" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--text-muted)", textDecoration: "none" }}>
          <ArrowLeft size={15} /> Wszystkie usługi
        </Link>

        <PageHeader
          icon={<span style={{ fontSize: 22 }}>👤</span>}
          title={provider.displayName}
          subtitle={provider.area ?? undefined}
        />

        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <RatingStars avg={provider.ratingAvg} count={provider.ratingCount} size={15} />
          <button onClick={onToggleFav} disabled={pending} title={favored ? "Usuń z ulubionych" : "Dodaj do ulubionych"}
            style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "none", border: "none", cursor: "pointer", color: favored ? "var(--accent-red)" : "var(--text-muted)", fontSize: 12 }}>
            <Heart size={15} fill={favored ? "var(--accent-red)" : "none"} /> {favored ? "Ulubiony" : "Obserwuj"}
          </button>
          {verified && <VerifiedBadge size={15} withLabel />}
          {provider.area && (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12, color: "var(--text-muted)" }}>
              <MapPin size={12} /> {provider.area}
            </span>
          )}
          {provider.nip && <span style={{ fontSize: 12, color: "var(--text-muted)" }}>NIP: {provider.nip}</span>}
          {isAdmin && (
            <button onClick={toggleVerified} disabled={pending} style={{ ...secondaryButtonStyle, marginLeft: "auto", fontSize: 12, padding: "5px 10px" }}>
              {verified ? "Cofnij weryfikację" : "Zweryfikuj (admin)"}
            </button>
          )}
        </div>

        {provider.bio && (
          <p style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.7, margin: 0, whiteSpace: "pre-wrap" }}>{provider.bio}</p>
        )}

        {/* Portfolio (M4) */}
        {provider.images.length > 0 && (
          <div>
            <SectionHeading>Portfolio</SectionHeading>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
              {provider.images.map((img) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={img.id} src={img.url} alt={img.caption ?? "Realizacja"}
                  style={{ width: 120, height: 120, objectFit: "cover", borderRadius: 8, border: "1px solid var(--border)" }} />
              ))}
            </div>
          </div>
        )}

        {/* Oferty */}
        <div>
          <SectionHeading>Oferty</SectionHeading>
          {provider.listings.length === 0 ? (
            <p style={{ fontSize: 13, color: "var(--text-muted)" }}>Brak aktywnych ofert.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {provider.listings.map((l) => (
                <Link key={l.id} href={`/services/${l.id}`} style={cardStyle} {...cardHoverHandlers}>
                  <div style={{ fontSize: 22, flexShrink: 0 }}>{l.categoryIcon}</div>
                  <div style={{ flex: 1, minWidth: 0, fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>{l.title}</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--accent-green)" }}>{formatPrice(l.priceModel, l.priceAmount, l.currency)}</div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Opinie */}
        {provider.reviews.length > 0 && (
          <div>
            <SectionHeading>Opinie ({provider.reviews.length})</SectionHeading>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {provider.reviews.map((rev) => (
                <div key={rev.id} style={{ ...cardStyle, cursor: "default", flexDirection: "column", alignItems: "stretch", gap: 6 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ display: "inline-flex", gap: 1 }}>
                      {[1, 2, 3, 4, 5].map((n) => (
                        <Star key={n} size={13} fill={n <= rev.rating ? "var(--accent-amber)" : "none"} color="var(--accent-amber)" />
                      ))}
                    </span>
                    <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{rev.clientName}</span>
                  </div>
                  {rev.comment && (
                    <div style={{ fontSize: 13, color: "var(--text-secondary)", display: "flex", gap: 6 }}>
                      <MessageSquare size={14} style={{ flexShrink: 0, marginTop: 2, color: "var(--text-muted)" }} />
                      {rev.comment}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
