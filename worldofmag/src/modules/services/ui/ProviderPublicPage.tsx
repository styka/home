"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import Link from "next/link";
import { ArrowLeft, MapPin, Star, MessageSquare, Share2, Check, UserPlus } from "lucide-react";
import { SectionHeading, cardStyle, cardHoverHandlers } from "@/components/ui/home";
import { ModuleView } from "@/components/ui/view";
import { Heart } from "lucide-react";
import { RatingStars, formatPrice, VerifiedBadge, secondaryButtonStyle } from "./serviceUi";
import { setProviderVerified } from "../actions/services";
import { saveProviderToContacts } from "../actions/parts/providers";
import { toggleFavorite } from "../actions/parts/favorites";
import type { PriceModel } from "../lib/services";

interface ProviderPublic {
  id: string;
  slug: string | null;
  displayName: string;
  tagline: string | null;
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
  const t = useTranslations("modules.services.ProviderPublicPage");
  const [verified, setVerified] = useState(provider.verified);
  const [favored, setFavored] = useState(provider.isFavorite);
  const [copied, setCopied] = useState(false);
  // Recenzja 115 (R-5): komunikat niesie TON — błąd nie może wyglądać jak sukces.
  const [kontaktInfo, setKontaktInfo] = useState<{ tekst: string; blad: boolean } | null>(null);

  // 115 (Z-INT-06): wykonawca do prywatnego CRM.
  async function doKontaktow() {
    try {
      const w = await saveProviderToContacts(provider.id);
      setKontaktInfo({ tekst: w.istnial ? t("kontaktJuzIstnial") : t("kontaktZapisany"), blad: false });
    } catch (e) {
      setKontaktInfo({ tekst: e instanceof Error ? e.message : t("bladOperacji"), blad: true });
    }
    setTimeout(() => setKontaktInfo(null), 5000);
  }
  const [pending, startTransition] = useTransition();

  function share() {
    const url = `${window.location.origin}/services/providers/${provider.slug ?? provider.id}`;
    navigator.clipboard?.writeText(url).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1800); }).catch(() => {});
  }

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
    <ModuleView
      width="narrow"
      state="ready"
      breadcrumb={
        <Link href="/services" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--text-muted)", textDecoration: "none" }}>
      <ArrowLeft size={15} /> {t("wszystkieUslugi")}
    </Link>
      }
      icon={<span style={{ fontSize: 22 }}>👤</span>}
      title={provider.displayName}
      subtitle={provider.tagline ?? provider.area ?? undefined}
      headerAction={
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
        <button onClick={doKontaktow} style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "6px 12px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-surface)", color: "var(--text-secondary)", fontSize: 13, cursor: "pointer" }} title={t("zapiszWKontaktach")}>
          <UserPlus size={14} /> {t("zapiszWKontaktach")}
        </button>
        <button onClick={share} style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "6px 12px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-surface)", color: copied ? "var(--accent-green)" : "var(--text-secondary)", fontSize: 13, cursor: "pointer" }} title="Skopiuj link do profilu">
          {copied ? <Check size={14} /> : <Share2 size={14} />} {copied ? "Skopiowano" : "Udostępnij"}
        </button>
        </div>
      }
    >

      {kontaktInfo && (
        <div role="status" style={{ fontSize: 12, color: kontaktInfo.blad ? "var(--accent-red)" : "var(--accent-green)" }}>{kontaktInfo.tekst}</div>
      )}
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
    </ModuleView>
  );
}
