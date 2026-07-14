"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Pill, HeartPulse, Plus, Trash2, Pencil, Check, X, Clock, Bandage, CalendarClock } from "lucide-react";
import { PageHeader, EmptyState, pageContainerStyle, pageInnerStyle, cardStyle } from "@/components/ui/home";
import {
  createMedicationSchedule,
  updateMedicationSchedule,
  deleteMedicationSchedule,
  logDose,
  unlogDose,
} from "@/actions/medications";
import { describeFrequency, parseTimes } from "@/lib/medicationSchedule";
import type { DoseSlot, MedicationFreqType, MedicationKind, MedicationSchedule } from "@/types";
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

const DAY_NAMES = ["nd", "pon", "wt", "śr", "czw", "pt", "sb"];

function kindMeta(kind: MedicationKind) {
  return kind === "CARE"
    ? { label: "Pielęgnacja", color: "var(--accent-purple)", Icon: Bandage }
    : { label: "Lek", color: "var(--accent-blue)", Icon: Pill };
}

function toDateInput(d: Date | string | null): string {
  if (!d) return "";
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
}

interface FormState {
  kind: MedicationKind;
  name: string;
  dosage: string;
  route: string;
  reason: string;
  instructions: string;
  freqType: MedicationFreqType;
  interval: number;
  daysOfWeek: number[];
  times: string[];
  hourlyStart: string;
  hourlyEnd: string;
  startDate: string;
  endDate: string;
  notes: string;
}

const emptyForm = (): FormState => ({
  kind: "MEDICATION",
  name: "",
  dosage: "",
  route: "",
  reason: "",
  instructions: "",
  freqType: "DAILY",
  interval: 1,
  daysOfWeek: [1, 2, 3, 4, 5],
  times: ["08:00"],
  hourlyStart: "08:00",
  hourlyEnd: "22:00",
  startDate: toDateInput(new Date()),
  endDate: "",
  notes: "",
});

function formFromSchedule(s: MedicationSchedule): FormState {
  return {
    kind: s.kind,
    name: s.name,
    dosage: s.dosage ?? "",
    route: s.route ?? "",
    reason: s.reason ?? "",
    instructions: s.instructions ?? "",
    freqType: s.freqType,
    interval: s.interval,
    daysOfWeek: s.daysOfWeek ? s.daysOfWeek.split(",").map(Number).filter((n) => !isNaN(n)) : [],
    times: parseTimes(s.timesOfDay).length ? parseTimes(s.timesOfDay) : ["08:00"],
    hourlyStart: s.hourlyStart ?? "08:00",
    hourlyEnd: s.hourlyEnd ?? "22:00",
    startDate: toDateInput(s.startDate),
    endDate: toDateInput(s.endDate),
    notes: s.notes ?? "",
  };
}

function ScheduleForm({ initial, onSave, onCancel }: { initial: FormState; onSave: (f: FormState) => Promise<void>; onCancel: () => void }) {
  const [form, setForm] = useState<FormState>(initial);
  const [newTime, setNewTime] = useState("12:00");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((f) => ({ ...f, [k]: v }));
  const isCare = form.kind === "CARE";

  function toggleDay(d: number) {
    setForm((f) => ({ ...f, daysOfWeek: f.daysOfWeek.includes(d) ? f.daysOfWeek.filter((x) => x !== d) : [...f.daysOfWeek, d] }));
  }
  function addTime() {
    if (!/^\d{2}:\d{2}$/.test(newTime) || form.times.includes(newTime)) return;
    setForm((f) => ({ ...f, times: [...f.times, newTime].sort() }));
  }
  function removeTime(t: string) {
    setForm((f) => ({ ...f, times: f.times.filter((x) => x !== t) }));
  }

  async function save() {
    if (!form.name.trim()) {
      setError("Nazwa jest wymagana");
      return;
    }
    if (form.freqType !== "HOURLY" && form.times.length === 0) {
      setError("Dodaj przynajmniej jedną godzinę");
      return;
    }
    if (form.freqType === "WEEKLY" && form.daysOfWeek.length === 0) {
      setError("Wybierz dni tygodnia");
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

  const FREQ: Array<{ id: MedicationFreqType; label: string }> = [
    { id: "DAILY", label: "Co N dni" },
    { id: "WEEKLY", label: "Dni tygodnia" },
    { id: "HOURLY", label: "Co N godzin" },
  ];

  return (
    <div style={{ ...cardStyle, flexDirection: "column", alignItems: "stretch", gap: 10, cursor: "default" }}>
      <div style={{ display: "flex", gap: 6 }}>
        {(["MEDICATION", "CARE"] as MedicationKind[]).map((k) => {
          const meta = kindMeta(k);
          return (
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
              <meta.Icon size={13} /> {meta.label}
            </button>
          );
        })}
      </div>

      <div>
        <label style={labelStyle}>{isCare ? "Czynność" : "Nazwa leku"}</label>
        <input style={inputStyle} value={form.name} onChange={(e) => set("name", e.target.value)} placeholder={isCare ? "np. Zmiana opatrunku" : "np. Ibuprom"} autoFocus />
      </div>

      <div style={{ display: "flex", gap: 8 }}>
        <div style={{ flex: 1 }}>
          <label style={labelStyle}>{isCare ? "Ilość / zakres" : "Dawka"}</label>
          <input style={inputStyle} value={form.dosage} onChange={(e) => set("dosage", e.target.value)} placeholder={isCare ? "np. 1 opatrunek" : "np. 200 mg"} />
        </div>
        {!isCare && (
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>Droga podania</label>
            <input style={inputStyle} value={form.route} onChange={(e) => set("route", e.target.value)} placeholder="doustnie / iniekcja" />
          </div>
        )}
      </div>

      <div style={{ display: "flex", gap: 8 }}>
        <div style={{ flex: 1 }}>
          <label style={labelStyle}>{isCare ? "Powód" : "Wskazanie"}</label>
          <input style={inputStyle} value={form.reason} onChange={(e) => set("reason", e.target.value)} />
        </div>
        <div style={{ flex: 1 }}>
          <label style={labelStyle}>Instrukcja</label>
          <input style={inputStyle} value={form.instructions} onChange={(e) => set("instructions", e.target.value)} placeholder="np. po posiłku" />
        </div>
      </div>

      <div>
        <label style={labelStyle}>Cykliczność</label>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {FREQ.map((f) => (
            <button
              key={f.id}
              onClick={() => set("freqType", f.id)}
              className="px-3 py-1.5 rounded text-xs font-medium"
              style={{
                background: form.freqType === f.id ? "var(--bg-elevated)" : "transparent",
                border: `1px solid ${form.freqType === f.id ? "var(--border-focus)" : "var(--border)"}`,
                color: form.freqType === f.id ? "var(--text-primary)" : "var(--text-muted)",
              }}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {form.freqType === "DAILY" && (
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>Co</span>
          <input style={{ ...inputStyle, width: 64 }} type="number" min={1} value={form.interval} onChange={(e) => set("interval", Math.max(1, Number(e.target.value)))} />
          <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>dni</span>
        </div>
      )}

      {form.freqType === "WEEKLY" && (
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          {DAY_NAMES.map((name, idx) => (
            <button
              key={idx}
              onClick={() => toggleDay(idx)}
              className="px-2.5 py-1.5 rounded text-xs font-medium"
              style={{
                background: form.daysOfWeek.includes(idx) ? "var(--accent-red)" : "transparent",
                border: `1px solid ${form.daysOfWeek.includes(idx) ? "var(--accent-red)" : "var(--border)"}`,
                color: form.daysOfWeek.includes(idx) ? "#fff" : "var(--text-muted)",
              }}
            >
              {name}
            </button>
          ))}
        </div>
      )}

      {form.freqType === "HOURLY" ? (
        <div style={{ display: "flex", alignItems: "flex-end", gap: 8, flexWrap: "wrap" }}>
          <div>
            <label style={labelStyle}>Co ile godzin</label>
            <input style={{ ...inputStyle, width: 72 }} type="number" min={1} value={form.interval} onChange={(e) => set("interval", Math.max(1, Number(e.target.value)))} />
          </div>
          <div>
            <label style={labelStyle}>Od</label>
            <input style={{ ...inputStyle, width: 110 }} type="time" value={form.hourlyStart} onChange={(e) => set("hourlyStart", e.target.value)} />
          </div>
          <div>
            <label style={labelStyle}>Do</label>
            <input style={{ ...inputStyle, width: 110 }} type="time" value={form.hourlyEnd} onChange={(e) => set("hourlyEnd", e.target.value)} />
          </div>
        </div>
      ) : (
        <div>
          <label style={labelStyle}>Pory dnia</label>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
            {form.times.map((t) => (
              <span key={t} className="flex items-center gap-1.5 px-2 py-1 rounded text-xs" style={{ background: "var(--bg-elevated)", color: "var(--text-primary)" }}>
                <Clock size={11} /> {t}
                <button onClick={() => removeTime(t)} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", padding: 0, lineHeight: 1 }}><X size={12} /></button>
              </span>
            ))}
            <input style={{ ...inputStyle, width: 110 }} type="time" value={newTime} onChange={(e) => setNewTime(e.target.value)} />
            <button onClick={addTime} className="px-2 py-1 rounded text-xs" style={{ background: "var(--bg-hover)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}>Dodaj porę</button>
          </div>
        </div>
      )}

      <div style={{ display: "flex", gap: 8 }}>
        <div style={{ flex: 1 }}>
          <label style={labelStyle}>Początek</label>
          <input style={inputStyle} type="date" value={form.startDate} onChange={(e) => set("startDate", e.target.value)} />
        </div>
        <div style={{ flex: 1 }}>
          <label style={labelStyle}>Koniec kuracji (opcjonalnie)</label>
          <input style={inputStyle} type="date" value={form.endDate} onChange={(e) => set("endDate", e.target.value)} />
        </div>
      </div>

      <div>
        <label style={labelStyle}>Notatki</label>
        <textarea style={{ ...inputStyle, minHeight: 48, resize: "vertical", fontFamily: "inherit" }} value={form.notes} onChange={(e) => set("notes", e.target.value)} />
      </div>

      {error && <p style={{ fontSize: 12, color: "var(--accent-red)", margin: 0 }}>{error}</p>}
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={save} disabled={busy} className="flex items-center gap-2 px-3 py-2 rounded text-sm font-medium disabled:opacity-40" style={{ background: "var(--accent-red)", color: "var(--on-accent)", border: "none" }}>
          <Check size={14} /> Zapisz
        </button>
        <button onClick={onCancel} disabled={busy} className="px-3 py-2 rounded text-sm" style={{ background: "var(--bg-hover)", color: "var(--text-secondary)" }}>Anuluj</button>
      </div>
    </div>
  );
}

function DoseRow({ date, dose, onChanged }: { date: string; dose: DoseSlot; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);
  const meta = kindMeta(dose.kind);

  async function toggle() {
    setBusy(true);
    try {
      if (dose.done) await unlogDose(dose.scheduleId, date, dose.slot);
      else await logDose(dose.scheduleId, date, dose.slot, "TAKEN");
      onChanged();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ ...cardStyle, cursor: "default", gap: 12, opacity: dose.done ? 0.6 : 1 }}>
      <button
        onClick={toggle}
        disabled={busy}
        className="flex items-center justify-center rounded"
        style={{ width: 22, height: 22, flexShrink: 0, border: `2px solid ${dose.done ? "var(--accent-green)" : "var(--border)"}`, background: dose.done ? "var(--accent-green)" : "transparent", cursor: "pointer" }}
        title={dose.done ? "Cofnij" : "Odhacz"}
      >
        {dose.done && <Check size={14} color="#fff" />}
      </button>
      <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", minWidth: 44 }}>{dose.slot}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, color: "var(--text-primary)", fontWeight: 500, textDecoration: dose.done ? "line-through" : "none" }}>
          {dose.name}
          {dose.dosage && <span style={{ color: "var(--text-muted)", fontWeight: 400 }}> · {dose.dosage}</span>}
        </div>
        {dose.instructions && <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{dose.instructions}</div>}
      </div>
      <span style={{ color: meta.color, flexShrink: 0 }} title={meta.label}><meta.Icon size={16} /></span>
    </div>
  );
}

function ScheduleCard({ s, focused, onEdit, onDelete, onToggleActive, onFocus }: { s: MedicationSchedule; focused: boolean; onEdit: () => void; onDelete: () => void; onToggleActive: () => void; onFocus: () => void }) {
  const meta = kindMeta(s.kind);

  return (
    <div onMouseEnter={onFocus} style={{ ...cardStyle, alignItems: "flex-start", cursor: "default", gap: 12, opacity: s.active ? 1 : 0.55, borderColor: focused ? "var(--border-focus)" : "var(--border)" }}>
      <span style={{ color: meta.color, flexShrink: 0, marginTop: 2 }}><meta.Icon size={18} /></span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, color: "var(--text-primary)", fontWeight: 500 }}>
          {s.name}
          {s.dosage && <span style={{ color: "var(--text-muted)", fontWeight: 400 }}> · {s.dosage}</span>}
        </div>
        <div style={{ fontSize: 12, color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginTop: 2 }}>
          <CalendarClock size={12} /> {describeFrequency(s)}
          {s.endDate && <span>· do {toDateInput(s.endDate)}</span>}
        </div>
        {(s.reason || s.instructions) && (
          <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4 }}>
            {[s.reason, s.instructions].filter(Boolean).join(" · ")}
          </div>
        )}
      </div>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6, flexShrink: 0 }}>
        <button onClick={onToggleActive} className="text-xs px-2 py-1 rounded" style={{ color: s.active ? "var(--accent-green)" : "var(--text-muted)", border: `1px solid ${s.active ? "var(--accent-green)" : "var(--border)"}`, background: "transparent" }}>
          {s.active ? "Aktywny" : "Wstrzymany"}
        </button>
        <div style={{ display: "flex", gap: 4 }}>
          <button onClick={onEdit} className="p-1 rounded" style={{ color: "var(--text-muted)", background: "none", border: "none" }}><Pencil size={14} /></button>
          <button onClick={onDelete} className="p-1 rounded" style={{ color: "var(--accent-red)", background: "none", border: "none" }}><Trash2 size={14} /></button>
        </div>
      </div>
    </div>
  );
}

export function MedicationsPage({ schedules, today }: { schedules: MedicationSchedule[]; today: { date: string; slots: DoseSlot[] } }) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<MedicationSchedule | null>(null);
  const [focused, setFocused] = useState<number>(-1);

  const doneCount = today.slots.filter((s) => s.done).length;

  async function removeSchedule(s: MedicationSchedule) {
    if (!confirm("Usunąć harmonogram?")) return;
    await deleteMedicationSchedule(s.id);
    router.refresh();
  }
  async function toggleScheduleActive(s: MedicationSchedule) {
    await updateMedicationSchedule(s.id, { active: !s.active });
    router.refresh();
  }

  // Z-232: klawiatura przez wspólny hub. j/k nawiguje po HARMONOGRAMACH (trwałe
  // encje); x = aktywny/wstrzymany, e = edycja, d = usuń, a = dodaj. Odhaczanie
  // dawek „na dziś" zostaje pod myszą/dotykiem (osobna, szybka lista).
  const shortcutHandlers = useMemo(
    () => ({
      onNavigateDown: () => { if (!adding && !editing) setFocused((i) => Math.min(schedules.length - 1, i + 1)); },
      onNavigateUp: () => { if (!adding && !editing) setFocused((i) => Math.max(0, i - 1)); },
      onQuickAdd: () => { if (!adding && !editing) { setAdding(true); setEditing(null); } },
      onToggleStatus: () => { if (!adding && !editing && focused >= 0 && schedules[focused]) toggleScheduleActive(schedules[focused]); },
      onEdit: () => { if (!adding && !editing && focused >= 0 && schedules[focused]) { setEditing(schedules[focused]); setAdding(false); } },
      onDelete: () => { if (!adding && !editing && focused >= 0 && schedules[focused]) removeSchedule(schedules[focused]); },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [schedules, focused, adding, editing]
  );
  useKeyboardShortcuts(shortcutHandlers);

  function toInput(f: FormState) {
    return {
      kind: f.kind,
      name: f.name,
      dosage: f.dosage,
      route: f.route,
      reason: f.reason,
      instructions: f.instructions,
      freqType: f.freqType,
      interval: f.interval,
      daysOfWeek: f.daysOfWeek,
      timesOfDay: f.times,
      hourlyStart: f.hourlyStart,
      hourlyEnd: f.hourlyEnd,
      startDate: f.startDate || null,
      endDate: f.endDate || null,
      notes: f.notes,
    };
  }

  async function handleCreate(f: FormState) {
    await createMedicationSchedule(toInput(f));
    setAdding(false);
    router.refresh();
  }
  async function handleUpdate(f: FormState) {
    if (!editing) return;
    await updateMedicationSchedule(editing.id, toInput(f));
    setEditing(null);
    router.refresh();
  }

  return (
    <div style={pageContainerStyle}>
      <div style={pageInnerStyle}>
        <PageHeader
          icon={<Pill size={22} />}
          iconColor="var(--accent-red)"
          title="Leki i pielęgnacja"
          subtitle="Harmonogram dawkowania leków i czynności pielęgnacyjnych"
          action={
            <button onClick={() => { setAdding(true); setEditing(null); }} className="flex items-center gap-2 px-3 py-2 rounded text-sm font-medium" style={{ background: "var(--accent-red)", color: "var(--on-accent)", border: "none" }}>
              <Plus size={15} /> Dodaj
            </button>
          }
        />

        {(adding || editing) && (
          <ScheduleForm
            initial={editing ? formFromSchedule(editing) : emptyForm()}
            onSave={editing ? handleUpdate : handleCreate}
            onCancel={() => { setAdding(false); setEditing(null); }}
          />
        )}

        <section>
          <h2 style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 8px", display: "flex", justifyContent: "space-between" }}>
            <span>Na dziś</span>
            {today.slots.length > 0 && <span>{doneCount}/{today.slots.length}</span>}
          </h2>
          {today.slots.length === 0 ? (
            <p style={{ fontSize: 13, color: "var(--text-muted)", margin: 0 }}>Brak zaplanowanych dawek ani czynności na dziś.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {today.slots.map((d) => (
                <DoseRow key={`${d.scheduleId}-${d.slot}`} date={today.date} dose={d} onChanged={() => router.refresh()} />
              ))}
            </div>
          )}
        </section>

        <section>
          <h2 style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 8px" }}>Wszystkie harmonogramy</h2>
          {schedules.length === 0 ? (
            <EmptyState
              icon={<HeartPulse size={32} />}
              message="Brak harmonogramów"
              hint="Dodaj lek z dawkowaniem albo cykliczną czynność pielęgnacyjną."
              cta={{ label: "Dodaj harmonogram", onClick: () => setAdding(true), color: "var(--accent-red)" }}
            />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {schedules.map((s, i) => (
                <ScheduleCard key={s.id} s={s} focused={focused === i} onFocus={() => setFocused(i)} onEdit={() => { setEditing(s); setAdding(false); }} onDelete={() => removeSchedule(s)} onToggleActive={() => toggleScheduleActive(s)} />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
