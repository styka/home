"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { HeartPulse, Plus, Stethoscope, FlaskConical, Trash2, Pencil, Check, X, MapPin, CalendarClock, Paperclip } from "lucide-react";
import { PageHeader, EmptyState, pageContainerStyle, pageInnerStyle, cardStyle } from "@/components/ui/home";
import { createHealthEvent, updateHealthEvent, setHealthStatus, deleteHealthEvent, getHealthAttachments, addHealthAttachment, deleteHealthAttachment, type TestTrend, type HealthAttachmentDTO } from "@/actions/health";
import type { HealthEvent, HealthKind, HealthStatus } from "@/types";
import { HealthAiOptInToggle } from "@/components/health/HealthAiOptInToggle";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";

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
  numericValue: string;
  unit: string;
}

const emptyForm = (kind: HealthKind): FormState => ({
  kind, title: "", scheduledAt: "", doctorName: "", specialty: "", facility: "", location: "", referral: "", notes: "", result: "", numericValue: "", unit: "",
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
        <>
          <div>
            <label style={labelStyle}>Wynik</label>
            <textarea style={{ ...inputStyle, minHeight: 48, resize: "vertical", fontFamily: "inherit" }} value={form.result} onChange={(e) => set("result", e.target.value)} placeholder="Wynik badania (po realizacji)" />
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Wartość liczbowa (do trendu)</label>
              <input style={inputStyle} type="number" step="any" inputMode="decimal" value={form.numericValue} onChange={(e) => set("numericValue", e.target.value)} placeholder="np. 5.2" />
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Jednostka</label>
              <input style={inputStyle} value={form.unit} onChange={(e) => set("unit", e.target.value)} placeholder="np. mg/dl" />
            </div>
          </div>
        </>
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

function EventCard({ ev, focused, onEdit, onCycleStatus, onDelete, onFocus }: { ev: HealthEvent; focused: boolean; onEdit: () => void; onCycleStatus: () => void; onDelete: () => void; onFocus: () => void }) {
  const status = STATUS_META[ev.status];
  const isTest = ev.kind === "TEST";

  return (
    <div onMouseEnter={onFocus} style={{ ...cardStyle, alignItems: "flex-start", cursor: "default", gap: 12, borderColor: focused ? "var(--border-focus)" : "var(--border)" }}>
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
        <HealthAttachments eventId={ev.id} />
      </div>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6, flexShrink: 0 }}>
        <button onClick={onCycleStatus} className="text-xs px-2 py-1 rounded" style={{ color: status.color, border: `1px solid ${status.color}`, background: "transparent" }} title="Zmień status">
          {status.label}
        </button>
        <div style={{ display: "flex", gap: 4 }}>
          <button onClick={onEdit} className="p-1 rounded" style={{ color: "var(--text-muted)", background: "none", border: "none" }}><Pencil size={14} /></button>
          <button onClick={onDelete} className="p-1 rounded" style={{ color: "var(--accent-red)", background: "none", border: "none" }}><Trash2 size={14} /></button>
        </div>
      </div>
    </div>
  );
}

type Tab = "ALL" | "VISIT" | "TEST";

export function HealthHomePage({ events, trends = [] }: { events: HealthEvent[]; trends?: TestTrend[] }) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("ALL");
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<HealthEvent | null>(null);
  const [focused, setFocused] = useState<number>(-1);

  const filtered = events.filter((e) => tab === "ALL" || e.kind === tab);
  const now = Date.now();
  const upcoming = filtered.filter((e) => new Date(e.scheduledAt).getTime() >= now && e.status !== "CANCELLED");
  const past = filtered.filter((e) => new Date(e.scheduledAt).getTime() < now || e.status === "CANCELLED");
  const ordered = useMemo(() => [...upcoming, ...past], [upcoming, past]);

  const parseNum = (s: string) => { const n = parseFloat(s.replace(",", ".")); return Number.isFinite(n) ? n : null; };

  async function handleCreate(f: FormState) {
    await createHealthEvent({
      kind: f.kind, title: f.title, scheduledAt: f.scheduledAt,
      doctorName: f.doctorName, specialty: f.specialty, facility: f.facility,
      location: f.location, referral: f.referral, notes: f.notes, result: f.result,
      numericValue: f.kind === "TEST" ? parseNum(f.numericValue) : null, unit: f.unit,
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
      numericValue: f.kind === "TEST" ? parseNum(f.numericValue) : null, unit: f.unit,
    });
    setEditing(null);
    router.refresh();
  }

  async function cycleStatus(ev: HealthEvent) {
    const next: HealthStatus = ev.status === "PLANNED" ? "DONE" : ev.status === "DONE" ? "CANCELLED" : "PLANNED";
    await setHealthStatus(ev.id, next);
    router.refresh();
  }
  async function removeEvent(ev: HealthEvent) {
    if (!confirm("Usunąć wpis?")) return;
    await deleteHealthEvent(ev.id);
    router.refresh();
  }

  const formFromEvent = (ev: HealthEvent): FormState => ({
    kind: ev.kind, title: ev.title, scheduledAt: toLocalInput(ev.scheduledAt),
    doctorName: ev.doctorName ?? "", specialty: ev.specialty ?? "", facility: ev.facility ?? "",
    location: ev.location ?? "", referral: ev.referral ?? "", notes: ev.notes ?? "", result: ev.result ?? "",
    numericValue: ev.numericValue != null ? String(ev.numericValue) : "", unit: ev.unit ?? "",
  });

  const TABS: Array<{ id: Tab; label: string }> = [
    { id: "ALL", label: "Wszystkie" },
    { id: "VISIT", label: "Wizyty" },
    { id: "TEST", label: "Badania" },
  ];

  // Z-232: klawiatura przez wspólny hub. Skróty tła nieaktywne, gdy otwarty formularz.
  // j/k = nawigacja po liście (nadchodzące + minione), x = cykl statusu, e = edycja,
  // d = usuń, a = dodaj, 1–3 = zakładki. focus po stronie rodzica (ordered[focused]).
  const shortcutHandlers = useMemo(
    () => ({
      onNavigateDown: () => { if (!adding && !editing) setFocused((i) => Math.min(ordered.length - 1, i + 1)); },
      onNavigateUp: () => { if (!adding && !editing) setFocused((i) => Math.max(0, i - 1)); },
      onQuickAdd: () => { if (!adding && !editing) { setAdding(true); setEditing(null); } },
      onToggleStatus: () => { if (!adding && !editing && focused >= 0 && ordered[focused]) cycleStatus(ordered[focused]); },
      onEdit: () => { if (!adding && !editing && focused >= 0 && ordered[focused]) { setEditing(ordered[focused]); setAdding(false); } },
      onDelete: () => { if (!adding && !editing && focused >= 0 && ordered[focused]) removeEvent(ordered[focused]); },
      onFilterTab: (i: number) => { const id = TABS[i]?.id; if (id) { setTab(id); setFocused(-1); } },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ordered, focused, adding, editing]
  );
  useKeyboardShortcuts(shortcutHandlers);

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

        <HealthAiOptInToggle />

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

        {/* Z2: trendy badań */}
        {(tab === "ALL" || tab === "TEST") && trends.length > 0 && (
          <section>
            <h2 style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 8px" }}>Trendy badań</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {trends.map((t) => <TrendRow key={t.title} trend={t} />)}
            </div>
          </section>
        )}

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
                  {upcoming.map((e, i) => <EventCard key={e.id} ev={e} focused={focused === i} onFocus={() => setFocused(i)} onEdit={() => { setEditing(e); setAdding(false); }} onCycleStatus={() => cycleStatus(e)} onDelete={() => removeEvent(e)} />)}
                </div>
              </section>
            )}
            {past.length > 0 && (
              <section>
                <h2 style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 8px" }}>Minione</h2>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {past.map((e, j) => { const idx = upcoming.length + j; return <EventCard key={e.id} ev={e} focused={focused === idx} onFocus={() => setFocused(idx)} onEdit={() => { setEditing(e); setAdding(false); }} onCycleStatus={() => cycleStatus(e)} onDelete={() => removeEvent(e)} />; })}
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function TrendRow({ trend }: { trend: TestTrend }) {
  const pts = trend.points;
  const first = pts[0].value;
  const last = pts[pts.length - 1].value;
  const delta = last - first;
  const vals = pts.map((p) => p.value);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const span = max - min || 1;
  const W = 120, H = 28;
  const poly = pts.map((p, i) => {
    const x = pts.length === 1 ? 0 : (i / (pts.length - 1)) * W;
    const y = H - ((p.value - min) / span) * H;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
  const deltaColor = delta > 0 ? "var(--accent-amber)" : delta < 0 ? "var(--accent-blue)" : "var(--text-muted)";

  return (
    <div style={{ ...cardStyle, cursor: "default", alignItems: "center", gap: 12 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{trend.title}</div>
        <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
          {pts.length} pomiarów · {first}{trend.unit ? ` ${trend.unit}` : ""} → {last}{trend.unit ? ` ${trend.unit}` : ""}
        </div>
      </div>
      <svg width={W} height={H} style={{ flexShrink: 0, overflow: "visible" }} aria-hidden>
        <polyline points={poly} fill="none" stroke="var(--accent-red)" strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
      </svg>
      <div style={{ fontSize: 13, fontWeight: 700, color: deltaColor, flexShrink: 0, minWidth: 56, textAlign: "right" }}>
        {delta > 0 ? "▲ +" : delta < 0 ? "▼ " : ""}{delta !== 0 ? delta.toLocaleString("pl-PL", { maximumFractionDigits: 2 }) : "—"}
      </div>
    </div>
  );
}

function HealthAttachments({ eventId }: { eventId: string }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<HealthAttachmentDTO[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try { setItems(await getHealthAttachments(eventId)); } catch { setItems([]); }
  }
  function toggle() { setOpen((o) => { const n = !o; if (n && items === null) void load(); return n; }); }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > 2_500_000) { setError("Plik za duży (max ~2,5 MB)"); return; }
    setBusy(true); setError(null);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(String(r.result));
        r.onerror = () => reject(new Error("Nie udało się wczytać"));
        r.readAsDataURL(file);
      });
      await addHealthAttachment(eventId, file.name, dataUrl);
      await load();
    } catch (err) { setError(err instanceof Error ? err.message : "Błąd"); }
    finally { setBusy(false); }
  }

  return (
    <div style={{ marginTop: 6 }}>
      <button onClick={toggle} className="inline-flex items-center gap-1 text-xs" style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)" }}>
        <Paperclip size={12} /> Wyniki / załączniki{items && items.length > 0 ? ` (${items.length})` : ""}
      </button>
      {open && (
        <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 4 }}>
          {(items ?? []).map((a) => (
            <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
              <a href={a.url} target="_blank" rel="noopener noreferrer" download={a.name} style={{ color: "var(--accent-blue)", textDecoration: "none", flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.name}</a>
              <button onClick={async () => { if (confirm("Usunąć?")) { await deleteHealthAttachment(a.id); await load(); } }} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", display: "flex" }} title="Usuń"><Trash2 size={12} /></button>
            </div>
          ))}
          <label style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, color: "var(--accent-blue)", cursor: busy ? "wait" : "pointer" }}>
            <Plus size={12} /> {busy ? "Wgrywanie…" : "Dodaj plik (PDF/zdjęcie)"}
            <input type="file" accept="image/*,application/pdf" onChange={onFile} disabled={busy} style={{ display: "none" }} />
          </label>
          {error && <span style={{ fontSize: 11, color: "var(--accent-red)" }}>{error}</span>}
        </div>
      )}
    </div>
  );
}
