"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Briefcase, ArrowLeft, Plus, Pencil, Trash2, Check, X, Eye, EyeOff, ImagePlus } from "lucide-react";
import { PageHeader, EmptyState, SectionHeading, pageContainerStyle, pageInnerStyle, cardStyle } from "@/components/ui/home";
import {
  upsertServiceProvider,
  createListing,
  updateListing,
  deleteListing,
  advanceRequestStatus,
  addServiceImage,
  deleteServiceImage,
} from "@/actions/services";
import {
  PRICE_MODEL_LABELS,
  type ServiceCategoryDTO,
  type PriceModel,
  type RequestDTO,
  type RequestStatus,
} from "@/lib/services";
import { RatingStars, formatPrice, StatusBadge, fieldInputStyle, fieldLabelStyle, primaryButtonStyle, secondaryButtonStyle } from "./serviceUi";
import { AvailabilityEditor } from "./AvailabilityEditor";

type ListingItem = {
  id: string;
  title: string;
  description: string | null;
  priceModel: PriceModel;
  priceAmount: number | null;
  currency: string;
  active: boolean;
  durationMin: number | null;
  bookingEnabled: boolean;
  category: { id: string; name: string; icon: string; color: string } | null;
};

type ProviderData = {
  displayName: string;
  bio: string | null;
  area: string | null;
  phone: string | null;
  visible: boolean;
  ratingAvg: number;
  ratingCount: number;
  listings: ListingItem[];
  images: { id: string; url: string; caption: string | null }[];
};

interface Props {
  provider: ProviderData | null;
  categories: ServiceCategoryDTO[];
  incomingRequests: RequestDTO[];
}

export function ProviderPanelPage({ provider, categories, incomingRequests }: Props) {
  const router = useRouter();
  const [editingProfile, setEditingProfile] = useState(provider == null);

  return (
    <div style={pageContainerStyle}>
      <div style={pageInnerStyle}>
        <Link href="/services" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--text-muted)", textDecoration: "none" }}>
          <ArrowLeft size={15} /> Wszystkie usługi
        </Link>

        <PageHeader
          icon={<Briefcase size={22} />}
          iconColor="var(--accent-blue)"
          title="Panel wykonawcy"
          subtitle={provider ? "Zarządzaj profilem, ofertami i zleceniami" : "Załóż profil, aby zacząć przyjmować zlecenia"}
        />

        {/* Profil */}
        {editingProfile || !provider ? (
          <ProfileForm
            initial={provider}
            categories={categories}
            onDone={() => {
              setEditingProfile(false);
              router.refresh();
            }}
            onCancel={provider ? () => setEditingProfile(false) : undefined}
          />
        ) : (
          <div style={{ ...cardStyle, cursor: "default", alignItems: "flex-start" }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)" }}>{provider.displayName}</span>
                {provider.visible ? (
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 11, color: "var(--accent-green)" }}><Eye size={12} /> Widoczny</span>
                ) : (
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 11, color: "var(--text-muted)" }}><EyeOff size={12} /> Ukryty</span>
                )}
              </div>
              {provider.area && <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>{provider.area}</div>}
              {provider.bio && <div style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 6, whiteSpace: "pre-wrap" }}>{provider.bio}</div>}
              <div style={{ marginTop: 8 }}><RatingStars avg={provider.ratingAvg} count={provider.ratingCount} /></div>
            </div>
            <button onClick={() => setEditingProfile(true)} style={secondaryButtonStyle}>
              <Pencil size={14} />
            </button>
          </div>
        )}

        {/* Oferty */}
        {provider && (
          <ListingsSection listings={provider.listings} categories={categories} onChange={() => router.refresh()} />
        )}

        {/* Portfolio (M4) */}
        {provider && (
          <PortfolioSection images={provider.images} onChange={() => router.refresh()} />
        )}

        {/* Dostępność do rezerwacji (M2) */}
        {provider && <AvailabilityEditor />}

        {/* Przychodzące zlecenia */}
        {provider && (
          <div>
            <SectionHeading>Przychodzące zlecenia</SectionHeading>
            {incomingRequests.length === 0 ? (
              <EmptyState icon={<Briefcase size={26} />} message="Brak zleceń" hint="Gdy klient zamówi Twoją usługę, pojawi się tutaj." />
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {incomingRequests.map((r) => (
                  <IncomingRequestCard key={r.id} request={r} onChange={() => router.refresh()} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function ProfileForm({
  initial,
  onDone,
  onCancel,
}: {
  initial: ProviderData | null;
  categories: ServiceCategoryDTO[];
  onDone: () => void;
  onCancel?: () => void;
}) {
  const [displayName, setDisplayName] = useState(initial?.displayName ?? "");
  const [area, setArea] = useState(initial?.area ?? "");
  const [phone, setPhone] = useState(initial?.phone ?? "");
  const [bio, setBio] = useState(initial?.bio ?? "");
  const [visible, setVisible] = useState(initial?.visible ?? true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!displayName.trim()) {
      setError("Podaj nazwę wyświetlaną");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await upsertServiceProvider({ displayName, area, phone, bio, visible });
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nie udało się zapisać profilu");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save} style={{ display: "flex", flexDirection: "column", gap: 12, padding: 16, borderRadius: 10, border: "1px solid var(--border)", background: "var(--bg-surface)" }}>
      <div>
        <label style={fieldLabelStyle}>Nazwa wyświetlana *</label>
        <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} style={fieldInputStyle} placeholder="np. Jan Kowalski — usługi hydrauliczne" />
      </div>
      <div style={{ display: "flex", gap: 10 }}>
        <div style={{ flex: 1 }}>
          <label style={fieldLabelStyle}>Obszar działania</label>
          <input value={area} onChange={(e) => setArea(e.target.value)} style={fieldInputStyle} placeholder="np. Warszawa" />
        </div>
        <div style={{ flex: 1 }}>
          <label style={fieldLabelStyle}>Telefon</label>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} style={fieldInputStyle} placeholder="opcjonalnie" />
        </div>
      </div>
      <div>
        <label style={fieldLabelStyle}>O mnie</label>
        <textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={3} style={{ ...fieldInputStyle, resize: "vertical" }} placeholder="Doświadczenie, specjalizacja, godziny pracy…" />
      </div>
      <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--text-secondary)", cursor: "pointer" }}>
        <input type="checkbox" checked={visible} onChange={(e) => setVisible(e.target.checked)} />
        Profil widoczny w katalogu usług
      </label>
      {error && <div style={{ fontSize: 12, color: "var(--accent-red)" }}>{error}</div>}
      <div style={{ display: "flex", gap: 8 }}>
        <button type="submit" disabled={busy} style={{ ...primaryButtonStyle, opacity: busy ? 0.6 : 1 }}>
          {initial ? "Zapisz profil" : "Załóż profil wykonawcy"}
        </button>
        {onCancel && <button type="button" onClick={onCancel} style={secondaryButtonStyle}>Anuluj</button>}
      </div>
    </form>
  );
}

function ListingsSection({
  listings,
  categories,
  onChange,
}: {
  listings: ListingItem[];
  categories: ServiceCategoryDTO[];
  onChange: () => void;
}) {
  const [adding, setAdding] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  return (
    <div>
      <SectionHeading
        action={
          !adding && (
            <button onClick={() => { setAdding(true); setEditId(null); }} style={{ ...secondaryButtonStyle, display: "inline-flex", alignItems: "center", gap: 5, padding: "4px 10px" }}>
              <Plus size={14} /> Dodaj ofertę
            </button>
          )
        }
      >
        Moje oferty
      </SectionHeading>

      {adding && (
        <div style={{ marginBottom: 10 }}>
          <ListingForm categories={categories} onDone={() => { setAdding(false); onChange(); }} onCancel={() => setAdding(false)} />
        </div>
      )}

      {listings.length === 0 && !adding ? (
        <EmptyState icon={<Plus size={26} />} message="Brak ofert" hint="Dodaj pierwszą ofertę, aby klienci mogli Cię znaleźć." />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {listings.map((l) =>
            editId === l.id ? (
              <ListingForm key={l.id} listing={l} categories={categories} onDone={() => { setEditId(null); onChange(); }} onCancel={() => setEditId(null)} />
            ) : (
              <div key={l.id} style={{ ...cardStyle, cursor: "default", alignItems: "flex-start" }}>
                <div style={{ fontSize: 22, flexShrink: 0 }}>{l.category?.icon ?? "🛠️"}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>{l.title}</span>
                    {!l.active && <span style={{ fontSize: 11, color: "var(--text-muted)" }}>(nieaktywna)</span>}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--accent-green)", marginTop: 2 }}>{formatPrice(l.priceModel, l.priceAmount, l.currency)}</div>
                </div>
                <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                  <button onClick={() => { setEditId(l.id); setAdding(false); }} style={secondaryButtonStyle}><Pencil size={14} /></button>
                  <button
                    onClick={async () => { if (confirm("Usunąć ofertę?")) { await deleteListing(l.id); onChange(); } }}
                    style={{ ...secondaryButtonStyle, color: "var(--accent-red)" }}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
}

function ListingForm({
  listing,
  categories,
  onDone,
  onCancel,
}: {
  listing?: ListingItem;
  categories: ServiceCategoryDTO[];
  onDone: () => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(listing?.title ?? "");
  const [description, setDescription] = useState(listing?.description ?? "");
  const [categoryId, setCategoryId] = useState(listing?.category?.id ?? "");
  const [priceModel, setPriceModel] = useState<PriceModel>(listing?.priceModel ?? "quote");
  const [priceValue, setPriceValue] = useState(listing?.priceAmount != null ? String(listing.priceAmount / 100) : "");
  const [active, setActive] = useState(listing?.active ?? true);
  const [durationMin, setDurationMin] = useState(listing?.durationMin != null ? String(listing.durationMin) : "");
  const [bookingEnabled, setBookingEnabled] = useState(listing?.bookingEnabled ?? false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      setError("Tytuł oferty jest wymagany");
      return;
    }
    const amount = priceModel === "quote" ? null : Math.round(parseFloat(priceValue.replace(",", ".")) * 100);
    if (priceModel !== "quote" && (amount == null || isNaN(amount))) {
      setError("Podaj poprawną cenę");
      return;
    }
    const dur = durationMin.trim() ? Math.round(parseInt(durationMin, 10)) : null;
    if (durationMin.trim() && (dur == null || isNaN(dur) || dur <= 0)) {
      setError("Podaj poprawny czas trwania (w minutach)");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const common = { title, description, categoryId: categoryId || null, priceModel, priceAmount: amount, durationMin: dur, bookingEnabled };
      if (listing) {
        await updateListing(listing.id, { ...common, active });
      } else {
        await createListing(common);
      }
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nie udało się zapisać oferty");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save} style={{ display: "flex", flexDirection: "column", gap: 10, padding: 14, borderRadius: 10, border: "1px solid var(--border-focus)", background: "var(--bg-surface)" }}>
      <div>
        <label style={fieldLabelStyle}>Tytuł oferty *</label>
        <input value={title} onChange={(e) => setTitle(e.target.value)} style={fieldInputStyle} placeholder="np. Montaż i naprawa instalacji wodnej" />
      </div>
      <div>
        <label style={fieldLabelStyle}>Opis</label>
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} style={{ ...fieldInputStyle, resize: "vertical" }} />
      </div>
      <div style={{ display: "flex", gap: 10 }}>
        <div style={{ flex: 1 }}>
          <label style={fieldLabelStyle}>Kategoria</label>
          <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} style={fieldInputStyle}>
            <option value="">— brak —</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
            ))}
          </select>
        </div>
        <div style={{ flex: 1 }}>
          <label style={fieldLabelStyle}>Model ceny</label>
          <select value={priceModel} onChange={(e) => setPriceModel(e.target.value as PriceModel)} style={fieldInputStyle}>
            {(Object.keys(PRICE_MODEL_LABELS) as PriceModel[]).map((m) => (
              <option key={m} value={m}>{PRICE_MODEL_LABELS[m]}</option>
            ))}
          </select>
        </div>
      </div>
      {priceModel !== "quote" && (
        <div>
          <label style={fieldLabelStyle}>Cena (PLN){priceModel === "hourly" ? " / godz." : ""}</label>
          <input value={priceValue} onChange={(e) => setPriceValue(e.target.value)} style={fieldInputStyle} placeholder="np. 150" inputMode="decimal" />
        </div>
      )}
      <div style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
        <div style={{ width: 150 }}>
          <label style={fieldLabelStyle}>Czas trwania (min)</label>
          <input value={durationMin} onChange={(e) => setDurationMin(e.target.value)} style={fieldInputStyle} placeholder="np. 60" inputMode="numeric" />
        </div>
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: durationMin.trim() ? "var(--text-secondary)" : "var(--text-muted)", cursor: durationMin.trim() ? "pointer" : "not-allowed", paddingBottom: 8 }}>
          <input type="checkbox" checked={bookingEnabled} disabled={!durationMin.trim()} onChange={(e) => setBookingEnabled(e.target.checked)} />
          Rezerwacja terminów (Booksy)
        </label>
      </div>
      {listing && (
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--text-secondary)", cursor: "pointer" }}>
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
          Oferta aktywna (widoczna w katalogu)
        </label>
      )}
      {error && <div style={{ fontSize: 12, color: "var(--accent-red)" }}>{error}</div>}
      <div style={{ display: "flex", gap: 8 }}>
        <button type="submit" disabled={busy} style={{ ...primaryButtonStyle, display: "inline-flex", alignItems: "center", gap: 6, opacity: busy ? 0.6 : 1 }}>
          <Check size={15} /> Zapisz
        </button>
        <button type="button" onClick={onCancel} style={secondaryButtonStyle}><X size={15} /></button>
      </div>
    </form>
  );
}

function IncomingRequestCard({ request, onChange }: { request: RequestDTO; onChange: () => void }) {
  const [pending, startTransition] = useTransition();
  const [scheduledAt, setScheduledAt] = useState("");
  const [showSchedule, setShowSchedule] = useState(false);

  function advance(next: RequestStatus, opts?: { scheduledAt?: string }) {
    startTransition(async () => {
      await advanceRequestStatus(request.id, next, opts);
      onChange();
    });
  }

  const actions = nextActionsFor(request.status);

  return (
    <div style={{ ...cardStyle, cursor: "default", alignItems: "flex-start", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, width: "100%" }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", flex: 1 }}>{request.title}</span>
        <StatusBadge status={request.status} />
      </div>
      <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Od: {request.clientName}</div>
      {request.description && <div style={{ fontSize: 13, color: "var(--text-secondary)", whiteSpace: "pre-wrap" }}>{request.description}</div>}
      {request.preferredAt && (
        <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Preferowany termin: {new Date(request.preferredAt).toLocaleString("pl-PL")}</div>
      )}
      {request.scheduledAt && (
        <div style={{ fontSize: 12, color: "var(--accent-purple)" }}>Umówiono: {new Date(request.scheduledAt).toLocaleString("pl-PL")}</div>
      )}

      {showSchedule && (
        <div style={{ display: "flex", gap: 8, width: "100%" }}>
          <input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} style={{ ...fieldInputStyle, flex: 1 }} />
          <button disabled={!scheduledAt || pending} onClick={() => advance("SCHEDULED", { scheduledAt })} style={primaryButtonStyle}>Umów</button>
        </div>
      )}

      {actions.length > 0 && !showSchedule && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {actions.map((a) =>
            a === "SCHEDULED" ? (
              <button key={a} onClick={() => setShowSchedule(true)} disabled={pending} style={secondaryButtonStyle}>Umów termin</button>
            ) : (
              <button
                key={a}
                onClick={() => advance(a)}
                disabled={pending}
                style={a === "DECLINED" || a === "CANCELLED" ? { ...secondaryButtonStyle, color: "var(--accent-red)" } : primaryButtonStyle}
              >
                {ACTION_LABELS[a]}
              </button>
            )
          )}
        </div>
      )}
    </div>
  );
}

const ACTION_LABELS: Record<string, string> = {
  ACCEPTED: "Akceptuj",
  DECLINED: "Odrzuć",
  SCHEDULED: "Umów termin",
  IN_PROGRESS: "Rozpocznij",
  COMPLETED: "Zakończ",
  CANCELLED: "Anuluj",
};

function nextActionsFor(status: RequestDTO["status"]): RequestStatus[] {
  switch (status) {
    case "REQUESTED": return ["ACCEPTED", "DECLINED"];
    case "ACCEPTED": return ["SCHEDULED", "IN_PROGRESS", "CANCELLED"];
    case "SCHEDULED": return ["IN_PROGRESS", "CANCELLED"];
    case "IN_PROGRESS": return ["COMPLETED", "CANCELLED"];
    default: return [];
  }
}

function PortfolioSection({ images, onChange }: { images: { id: string; url: string; caption: string | null }[]; onChange: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > 2_000_000) { setError("Zdjęcie jest za duże (max ~2MB)"); return; }
    setBusy(true); setError(null);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(String(r.result));
        r.onerror = () => reject(new Error("Nie udało się wczytać pliku"));
        r.readAsDataURL(file);
      });
      await addServiceImage(dataUrl);
      onChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Błąd dodawania zdjęcia");
    } finally { setBusy(false); }
  }

  return (
    <div>
      <SectionHeading>Portfolio realizacji</SectionHeading>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
        {images.map((img) => (
          <div key={img.id} style={{ position: "relative", width: 104, height: 104, borderRadius: 8, overflow: "hidden", border: "1px solid var(--border)" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={img.url} alt={img.caption ?? "Realizacja"} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            <button
              onClick={async () => { if (confirm("Usunąć zdjęcie?")) { await deleteServiceImage(img.id); onChange(); } }}
              aria-label="Usuń zdjęcie"
              style={{ position: "absolute", top: 4, right: 4, width: 24, height: 24, borderRadius: 6, background: "rgba(0,0,0,0.6)", color: "#fff", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
            >
              <Trash2 size={13} />
            </button>
          </div>
        ))}
        <label style={{ width: 104, height: 104, borderRadius: 8, border: "1px dashed var(--border)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4, cursor: busy ? "wait" : "pointer", color: "var(--text-muted)", fontSize: 11 }}>
          <ImagePlus size={20} />
          {busy ? "Wgrywanie…" : "Dodaj zdjęcie"}
          <input type="file" accept="image/*" onChange={onFile} disabled={busy} style={{ display: "none" }} />
        </label>
      </div>
      {error && <div style={{ fontSize: 12, color: "var(--accent-red)", marginTop: 6 }}>{error}</div>}
    </div>
  );
}
