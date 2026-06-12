"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Handshake, MapPin, Send, Check, CalendarClock, Clock } from "lucide-react";
import { PageHeader, pageContainerStyle, pageInnerStyle, cardStyle } from "@/components/ui/home";
import { createServiceRequest, getAvailableSlots, bookSlot, getListingStaff } from "@/actions/services";
import type { ListingDTO } from "@/lib/services";
import { RatingStars, formatPrice, fieldInputStyle, fieldLabelStyle, primaryButtonStyle, secondaryButtonStyle } from "./serviceUi";

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

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

        {/* Rezerwacja terminu (M2 / Booksy) */}
        {!isOwnListing && !sent && listing.bookingEnabled && listing.durationMin && (
          <BookingWidget listingId={listing.id} durationMin={listing.durationMin} />
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

function BookingWidget({ listingId, durationMin }: { listingId: string; durationMin: number }) {
  const router = useRouter();
  const [date, setDate] = useState(todayISO());
  const [slots, setSlots] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [booking, setBooking] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  // M14: pracownicy oferty (gdy firma wieloosobowa, klient wybiera pracownika).
  const [staff, setStaff] = useState<{ id: string; name: string; role: string | null }[]>([]);
  const [staffId, setStaffId] = useState<string>("");

  useEffect(() => {
    getListingStaff(listingId).then((s) => {
      setStaff(s);
      if (s.length > 0) setStaffId((cur) => cur || s[0].id);
    }).catch(() => {});
  }, [listingId]);

  const needsStaff = staff.length > 0;

  useEffect(() => {
    let active = true;
    if (needsStaff && !staffId) { setSlots([]); return; }
    setLoading(true); setError(null);
    getAvailableSlots(listingId, date, { staffId: staffId || null })
      .then((s) => { if (active) setSlots(s); })
      .catch((e) => { if (active) setError(e instanceof Error ? e.message : "Błąd"); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [listingId, date, staffId, needsStaff]);

  async function book(iso: string) {
    setBooking(iso); setError(null);
    try {
      await bookSlot(listingId, iso, staffId || null);
      setDone(true);
      setTimeout(() => router.push("/services/requests"), 900);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Nie udało się zarezerwować");
      // odśwież sloty (mogło się zmienić)
      getAvailableSlots(listingId, date, { staffId: staffId || null }).then(setSlots).catch(() => {});
    } finally {
      setBooking(null);
    }
  }

  if (done) {
    return (
      <div style={{ ...cardStyle, cursor: "default", color: "var(--accent-green)", fontSize: 14, fontWeight: 600 }}>
        <Check size={18} /> Termin zarezerwowany! Przekierowuję…
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, padding: 16, borderRadius: 10, border: "1px solid var(--border)", background: "var(--bg-surface)" }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", display: "flex", alignItems: "center", gap: 6 }}>
        <CalendarClock size={16} color="var(--accent-purple)" /> Zarezerwuj termin
        <span style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12, fontWeight: 500, color: "var(--text-muted)" }}>
          <Clock size={12} /> {durationMin} min
        </span>
      </div>
      {needsStaff && (
        <div>
          <label style={fieldLabelStyle}>Pracownik</label>
          <select value={staffId} onChange={(e) => setStaffId(e.target.value)} style={{ ...fieldInputStyle, width: 220 }}>
            {staff.map((s) => <option key={s.id} value={s.id}>{s.name}{s.role ? ` · ${s.role}` : ""}</option>)}
          </select>
        </div>
      )}
      <div>
        <label style={fieldLabelStyle}>Dzień</label>
        <input type="date" value={date} min={todayISO()} onChange={(e) => setDate(e.target.value)} style={{ ...fieldInputStyle, width: 180 }} />
      </div>
      {loading ? (
        <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Szukam wolnych terminów…</div>
      ) : slots.length === 0 ? (
        <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Brak wolnych terminów tego dnia. Wybierz inny dzień.</div>
      ) : (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {slots.map((iso) => {
            const t = new Date(iso).toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" });
            return (
              <button key={iso} onClick={() => book(iso)} disabled={booking !== null}
                style={{ ...secondaryButtonStyle, padding: "6px 12px", opacity: booking && booking !== iso ? 0.5 : 1, borderColor: "var(--accent-purple)" }}>
                {booking === iso ? "…" : t}
              </button>
            );
          })}
        </div>
      )}
      {error && <div style={{ fontSize: 12, color: "var(--accent-red)" }}>{error}</div>}
    </div>
  );
}
