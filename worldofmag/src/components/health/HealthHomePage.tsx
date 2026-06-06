"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { HeartPulse, Plus, Stethoscope, FlaskConical, Trash2, Pencil, Check, X, MapPin, CalendarClock } from "lucide-react";
import { PageHeader, EmptyState, pageContainerStyle, pageInnerStyle, cardStyle } from "@/components/ui/home";
import { createHealthEvent, updateHealthEvent, setHealthStatus, deleteHealthEvent } from "@/actions/health";
import type { HealthEvent, HealthKind, HealthStatus } from "@/types";

const inputStyle: React.CSSProperties = {
  width: "100%",
  background: "var(--bg-base)",
  border: "1px solid var(--border)",
  borderRadius: 6,
  padding: "7px 10px",
  color: "var(--text-primary)",
  fontSize: 13,
};
const labelStyle: React.CSSProperties = { fontSize: 11, color: "var(--text-muted)", display: "block", marginBottom: 3 };

const STATUS_META: Record<HealthStatus, { label: string; color: string }> = {
  PLANNED: { label: "Zaplanowane", color: "var(--accent-blue)" },
  DONE: { label: "Zrealizowane", color: "var(--accent-green)" },
  CANCELLED: { label: "Odwołane", color: "var(--text-muted)" },
};

function toLocalInput(d: Date | string | null): string {
  if (!d) return "";
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}T${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
}

function formatWhen(d: Date | string): string {
  return new Intl.DateTimeFormat("pl-PL", { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(d));
}

interface FormState {
  kind: HealthKind;
  title: string;
  scheduledAt: string;
  doctorName: string;
  specialty: string;
  facility: string;
  location: string;
  referral: string;
  notes: string;
  result: string;
}

const emptyForm = (kind: HealthKind): FormState => ({
  kind, title: "", scheduledAt: "", doctorName: "", specialty: "", facility: "", location: "", referral: "", notes: "", result: "",
});

function EventForm({ initial, onSave, onCancel }: { initial: FormState; onSave: (f: FormState) => Promise<void>; onCancel: () => void }) {
  const [form, setForm] = useState<FormState>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof FormState, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const isTest = form.kind === "TEST";

  async function save() {
    if (!form.title.trim() || !form.scheduledAt) {
      setError("Tytuł i termin są wymagane");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onSave(form);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Błąd zapisu");
      setBusy(false);
    }
  }

  return (
    <div style={{ ...cardStyle, flexDirection: "column", alignItems: "stretch", gap: 10, cursor: "default" }}>
      <div style={{ display: "flex", gap: 6 }}>
        {(["VISIT", "TEST"] as HealthKind[]).map((k) => (
          <button
            key={k}
            onClick={() => set("kind", k)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium"
            style={{
              background: form.kind === k ? "var(--bg-elevated)" : "transparent",
              border: `1px solid ${form.kind === k ? "var(--border-focus)" : "var(--border)"}`,
              color: form.kind === k ? "var(--text-primary)" : "var(--text-muted)",
            }}
          >
            {k === "VISIT" ? <Stethoscope size={13} /> : <FlaskConical size={13} />}
            {k === "VISIT" ? "Wizyta" : "Badanie"}
          </button>
        ))}
      </div>

      <div>
        <label style={labelStyle}>{isTest ? "Nazwa badania" : "Cel wizyty / specjalizacja"}</label>
        <input style={inputStyle} value={form.title} onChange={(e) => set("title", e.target.value)} placeholder={isTest ? "np. Morfologia krwi" : "np. Wizyta u kardiologa"} autoFocus />
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <div style={{ flex: 1 }}>
          <label style={labelStyle}>Termin</label>
          <input style={inputStyle} type="datetime-local" value={form.scheduledAt} onChange={(e) => set("scheduledAt", e.target.value)} />
        </div>
        <div style={{ flex: 1 }}>
          <label style={labelStyle}>{isTest ? "Laboratorium / placówka" : "Lekarz"}</label>
          <input style={inputStyle} value={isTest ? form.facility : form.doctorName} onChange={(e) => set(isTest ? "facility" : "doctorName", e.target.value)} />
        </div>
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        {!isTest && (
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>Specjalizacja</label>
            <input style={inputStyle} value={form.specialty} onChange={(e) => set("specialty", e.target.value)} />
          </div>
        )}
        <div style={{ flex: 1 }}>
          <label style={labelStyle}>Miejsce / adres</label>
          <input style={inputStyle} value={form.location} onChange={(e) => set("location", e.target.value)} />
        </div>
        <div style={{ flex: 1 }}>
          <label style={labelStyle}>Skierowanie</label>
          <input style={inputStyle} value={form.referral} onChange={(e) => set("referral", e.target.value)} placeholder="nr / uwagi" />
        </div>
      </div>
      <div>
        <label style={labelStyle}>Notatki</label>
        <textarea style={{ ...inputStyle, minHeight: 56, resize: "vertical", fontFamily: "inherit" }} value={form.notes} onChange={(e) => set("notes", e.target.value)} />
      </div>
      {isTest && (
        <div>
          <label style={labelStyle}>Wynik</label>
          <textarea style={{ ...inputStyle, minHeight: 48, resize: "vertical", fontFamily: "inherit" }} value={form.result} onChange={(e) => set("result", e.target.value)} placeholder="Wynik badania (po realizacji)" />
        </div>
      )}
      {error && <p style={{ fontSize: 12, color: "var(--accent-red)", margin: 0 }}>{error}</p>}
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={save} disabled={busy} className="flex items-center gap-2 px-3 py-2 rounded text-sm font-medium disabled:opacity-40" style={{ background: "var(--accent-blue)", color: "var(--on-accent)", border: "none" }}>
          <Check size={14} /> Zapisz
        </button>
        <button onClick={onCancel} disabled={busy} className="px-3 py-2 rounded text-sm" style={{ background: "var(--bg-hover)", color: "var(--text-secondary)" }}>Anuluj</button>
      </div>
    </div>
  );
}

function EventCard({ ev, onEdit }: { ev: HealthEvent; onEdit: () => void }) {
  const router = useRouter();
  const status = STATUS_META[ev.status];
  const isTest = ev.kind === "TEST";

  async function cycleStatus() {
    const next: HealthStatus = ev.status === "PLANNED" ? "DONE" : ev.status === "DONE" ? "CANCELLED" : "PLANNED";
    await setHealthStatus(ev.id, next);
    router.refresh();
  }
  async function remove() {
    if (!confirm("Usunąć wpis?")) return;
    await deleteHealthEvent(ev.id);
    router.refresh();
  }

  return (
    <div style={{ ...cardStyle, alignItems: "flex-start", cursor: "default", gap: 12 }}>
      <span style={{ color: isTest ? "var(--accent-amber)" : "var(--accent-green)", flexShrink: 0, marginTop: 2 }}>
        {isTest ? <FlaskConical size={18} /> : <Stethoscope size={18} />}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, color: "var(--text-primary)", fontWeight: 500 }}>{ev.title}</div>
        <div style={{ fontSize: 12, color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginTop: 2 }}>
          <CalendarClock size={12} /> {formatWhen(ev.scheduledAt)}
          {(ev.doctorName || ev.specialty) && <span>· {[ev.specialty, ev.doctorName].filter(Boolean).join(", ")}</span>}
          {ev.facility && <span>· {ev.facility}</span>}
          {ev.location && <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>· <MapPin size={11} /> {ev.location}</span>}
        </div>
        {ev.notes && <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4 }}>{ev.notes}</div>}
        {ev.result && <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4 }}><b>Wynik:</b> {ev.result}</div>}
      </div>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6, flexShrink: 0 }}>
        <button onClick={cycleStatus} className="text-xs px-2 py-1 rounded" style={{ color: status.color, border: `1px solid ${status.color}`, background: "transparent" }} title="Zmień status">
          {status.label}
        </button>
        <div style={{ display: "flex", gap: 4 }}>
          <button onClick={onEdit} className="p-1 rounded" style={{ color: "var(--text-muted)", background: "none", border: "none" }}><Pencil size={14} /></button>
          <button onClick={remove} className="p-1 rounded" style={{ color: "var(--accent-red)", background: "none", border: "none" }}><Trash2 size={14} /></button>
        </div>
      </div>
    </div>
  );
}

type Tab = "ALL" | "VISIT" | "TEST";

export function HealthHomePage({ events }: { events: HealthEvent[] }) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("ALL");
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<HealthEvent | null>(null);

  const filtered = events.filter((e) => tab === "ALL" || e.kind === tab);
  const now = Date.now();
  const upcoming = filtered.filter((e) => new Date(e.scheduledAt).getTime() >= now && e.status !== "CANCELLED");
  const past = filtered.filter((e) => new Date(e.scheduledAt).getTime() < now || e.status === "CANCELLED");

  async function handleCreate(f: FormState) {
    await createHealthEvent({
      kind: f.kind, title: f.title, scheduledAt: f.scheduledAt,
      doctorName: f.doctorName, specialty: f.specialty, facility: f.facility,
      location: f.location, referral: f.referral, notes: f.notes, result: f.result,
    });
    setAdding(false);
    router.refresh();
  }

  async function handleUpdate(f: FormState) {
    if (!editing) return;
    await updateHealthEvent(editing.id, {
      kind: f.kind, title: f.title, scheduledAt: f.scheduledAt,
      doctorName: f.doctorName, specialty: f.specialty, facility: f.facility,
      location: f.location, referral: f.referral, notes: f.notes, result: f.result,
    });
    setEditing(null);
    router.refresh();
  }

  const formFromEvent = (ev: HealthEvent): FormState => ({
    kind: ev.kind, title: ev.title, scheduledAt: toLocalInput(ev.scheduledAt),
    doctorName: ev.doctorName ?? "", specialty: ev.specialty ?? "", facility: ev.facility ?? "",
    location: ev.location ?? "", referral: ev.referral ?? "", notes: ev.notes ?? "", result: ev.result ?? "",
  });

  const TABS: Array<{ id: Tab; label: string }> = [
    { id: "ALL", label: "Wszystkie" },
    { id: "VISIT", label: "Wizyty" },
    { id: "TEST", label: "Badania" },
  ];

  return (
    <div style={pageContainerStyle}>
      <div style={pageInnerStyle}>
        <PageHeader
          icon={<HeartPulse size={22} />}
          iconColor="var(--accent-red)"
          title="Zdrowie"
          subtitle="Wizyty u lekarzy i badania — terminy, statusy i wyniki"
          action={
            <button onClick={() => { setAdding(true); setEditing(null); }} className="flex items-center gap-2 px-3 py-2 rounded text-sm font-medium" style={{ background: "var(--accent-red)", color: "var(--on-accent)", border: "none" }}>
              <Plus size={15} /> Dodaj
            </button>
          }
        />

        <div style={{ display: "flex", gap: 6 }}>
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className="px-3 py-1.5 rounded text-xs font-medium"
              style={{
                background: tab === t.id ? "var(--bg-elevated)" : "transparent",
                border: `1px solid ${tab === t.id ? "var(--border-focus)" : "var(--border)"}`,
                color: tab === t.id ? "var(--text-primary)" : "var(--text-muted)",
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {adding && <EventForm initial={emptyForm(tab === "TEST" ? "TEST" : "VISIT")} onSave={handleCreate} onCancel={() => setAdding(false)} />}
        {editing && <EventForm initial={formFromEvent(editing)} onSave={handleUpdate} onCancel={() => setEditing(null)} />}

        {filtered.length === 0 && !adding ? (
          <EmptyState
            icon={<HeartPulse size={32} />}
            message="Brak wpisów"
            hint="Dodaj pierwszą wizytę lub badanie z terminem."
            cta={{ label: "Dodaj wpis", onClick: () => setAdding(true), color: "var(--accent-red)" }}
          />
        ) : (
          <>
            {upcoming.length > 0 && (
              <section>
                <h2 style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 8px" }}>Nadchodzące</h2>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {upcoming.map((e) => <EventCard key={e.id} ev={e} onEdit={() => { setEditing(e); setAdding(false); }} />)}
                </div>
              </section>
            )}
            {past.length > 0 && (
              <section>
                <h2 style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 8px" }}>Minione</h2>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {past.map((e) => <EventCard key={e.id} ev={e} onEdit={() => { setEditing(e); setAdding(false); }} />)}
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
}
