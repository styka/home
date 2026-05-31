"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Handshake, MapPin, Send, Check } from "lucide-react";
import { PageHeader, pageContainerStyle, pageInnerStyle, cardStyle } from "@/components/ui/home";
import { createServiceRequest } from "@/actions/services";
import type { ListingDTO } from "@/lib/services";
import { RatingStars, formatPrice, fieldInputStyle, fieldLabelStyle, primaryButtonStyle } from "./serviceUi";

export function ListingDetailPage({ listing, isOwnListing }: { listing: ListingDTO; isOwnListing: boolean }) {
  const router = useRouter();
  const [title, setTitle] = useState(listing.title);
  const [description, setDescription] = useState("");
  const [preferredAt, setPreferredAt] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      setError("Opisz krótko, czego potrzebujesz");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await createServiceRequest({
        providerId: listing.provider.id,
        listingId: listing.id,
        title: title.trim(),
        description: description.trim() || null,
        preferredAt: preferredAt || null,
      });
      setSent(true);
      setTimeout(() => router.push("/services/requests"), 900);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nie udało się wysłać zlecenia");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={pageContainerStyle}>
      <div style={pageInnerStyle}>
        <Link href="/services" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--text-muted)", textDecoration: "none" }}>
          <ArrowLeft size={15} /> Wszystkie usługi
        </Link>

        <PageHeader
          icon={<span style={{ fontSize: 24 }}>{listing.category?.icon ?? "🛠️"}</span>}
          title={listing.title}
          subtitle={listing.category?.name}
        />

        {/* Karta wykonawcy + cena */}
        <div style={{ ...cardStyle, cursor: "default" }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <Link href={`/services/providers/${listing.provider.id}`} style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", textDecoration: "none" }}>
              {listing.provider.displayName}
            </Link>
            <div style={{ fontSize: 12, color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 8, marginTop: 3, flexWrap: "wrap" }}>
              {listing.provider.area && (
                <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
                  <MapPin size={11} /> {listing.provider.area}
                </span>
              )}
              <RatingStars avg={listing.provider.ratingAvg} count={listing.provider.ratingCount} size={11} />
            </div>
          </div>
          <div style={{ fontSize: 15, fontWeight: 700, color: "var(--accent-green)" }}>
            {formatPrice(listing.priceModel, listing.priceAmount, listing.currency)}
          </div>
        </div>

        {listing.description && (
          <p style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.7, margin: 0, whiteSpace: "pre-wrap" }}>
            {listing.description}
          </p>
        )}

        {/* Formularz zlecenia */}
        {isOwnListing ? (
          <div style={{ ...cardStyle, cursor: "default", color: "var(--text-muted)", fontSize: 13 }}>
            To Twoja oferta — zarządzaj nią w panelu wykonawcy.
          </div>
        ) : sent ? (
          <div style={{ ...cardStyle, cursor: "default", color: "var(--accent-green)", fontSize: 14, fontWeight: 600 }}>
            <Check size={18} /> Zlecenie wysłane! Przekierowuję…
          </div>
        ) : (
          <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 12, padding: 16, borderRadius: 10, border: "1px solid var(--border)", background: "var(--bg-surface)" }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", display: "flex", alignItems: "center", gap: 6 }}>
              <Handshake size={16} color="var(--accent-blue)" /> Zamów tę usługę
            </div>
            <div>
              <label style={fieldLabelStyle}>Czego potrzebujesz?</label>
              <input value={title} onChange={(e) => setTitle(e.target.value)} style={fieldInputStyle} placeholder="np. Naprawa cieknącego kranu w łazience" />
            </div>
            <div>
              <label style={fieldLabelStyle}>Szczegóły (opcjonalnie)</label>
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} style={{ ...fieldInputStyle, resize: "vertical" }} placeholder="Dodatkowe informacje dla wykonawcy…" />
            </div>
            <div>
              <label style={fieldLabelStyle}>Preferowany termin (opcjonalnie)</label>
              <input type="datetime-local" value={preferredAt} onChange={(e) => setPreferredAt(e.target.value)} style={fieldInputStyle} />
            </div>
            {error && <div style={{ fontSize: 12, color: "var(--accent-red)" }}>{error}</div>}
            <button type="submit" disabled={busy} style={{ ...primaryButtonStyle, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, opacity: busy ? 0.6 : 1 }}>
              <Send size={15} /> Wyślij zlecenie
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
