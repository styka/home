"use client";

import { useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  Plus, Trash2, Check, Loader2, ExternalLink, Mail, Users, X, HardDrive, Clock,
} from "lucide-react";
import { Modal, Field, inputStyle, PrimaryButton, GhostButton } from "./Modal";
import { useToast } from "@/components/ui/Toast";
import {
  addMeasurement, deleteMeasurement,
  createTreatment, completeTreatment, deleteTreatment,
  createVetVisit, deleteVetVisit,
  createHealthRecord, updateHealthRecord, deleteHealthRecord,
  createCareTask, completeCareTask, deleteCareTask, logFeeding,
} from "@/actions/petCare";
import { updatePet, setPetStatus, updatePetFeatures, sharePetByEmail, removePetShare } from "@/actions/pets";
import {
  formatDate, formatWeight, TREATMENT_KIND_LABELS, CARE_CATEGORY_LABELS, HEALTH_TYPE_LABELS, STATUS_LABELS,
} from "@/lib/petSpecies";
import {
  resolveFeatures, flagsForPreset, PET_PRESETS, PET_FEATURE_KEYS, PET_FEATURE_LABELS, PET_FEATURE_PHASE,
  type PetFeatureKey, type PetFeatureFlags,
} from "@/lib/petPresets";
import type {
  PetWithRelations, PetStatus, PetTreatmentKind, PetCareCategory, PetHealthType, RecurringRule,
} from "@/types";

// ─── Shared UI ──────────────────────────────────────────────────────────────

function useRefresh() {
  const router = useRouter();
  return () => router.refresh();
}

function SectionShell({ title, onAdd, addLabel, children }: { title: string; onAdd?: () => void; addLabel?: string; children: ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <h2 style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", margin: 0 }}>{title}</h2>
        {onAdd && (
          <button onClick={onAdd} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: "var(--accent-orange)", background: "none", border: "none", cursor: "pointer" }}>
            <Plus size={14} /> {addLabel ?? "Dodaj"}
          </button>
        )}
      </div>
      {children}
    </div>
  );
}

function Row({ children, onDelete, onComplete, completing }: { children: ReactNode; onDelete?: () => void; onComplete?: () => void; completing?: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-surface)" }}>
      <div style={{ minWidth: 0, flex: 1 }}>{children}</div>
      {onComplete && (
        <button onClick={onComplete} disabled={completing} title="Odhacz" style={smallBtn("var(--accent-green)")}>
          {completing ? <Loader2 size={13} className="animate-spin" /> : <Check size={14} />}
        </button>
      )}
      {onDelete && (
        <button onClick={onDelete} title="Usuń" style={smallBtn("var(--accent-red)")}><Trash2 size={13} /></button>
      )}
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <p style={{ fontSize: 13, color: "var(--text-muted)", padding: "12px 0", margin: 0 }}>{text}</p>;
}

function smallBtn(color: string): React.CSSProperties {
  return { flexShrink: 0, width: 28, height: 28, borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg-elevated)", color, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" };
}

function recurringFromDays(days: number | null): RecurringRule | null {
  if (!days || days <= 0) return null;
  return { type: "DAILY", interval: days };
}

// ─── Profile ──────────────────────────────────────────────────────────────

export function ProfileSection({ pet }: { pet: PetWithRelations }) {
  const { showToast } = useToast();
  const refresh = useRefresh();
  const [isPending, startTransition] = useTransition();

  function changeStatus(status: PetStatus) {
    startTransition(async () => {
      try { await setPetStatus(pet.id, status); refresh(); showToast("Zaktualizowano status", "success"); }
      catch (e) { showToast(e instanceof Error ? e.message : "Błąd", "error"); }
    });
  }

  const rows: Array<[string, string]> = [
    ["Chip", pet.microchipId || "—"],
    ["Identyfikator", pet.identifier || "—"],
    ["Umaszczenie", pet.color || "—"],
    ["Data urodzenia", pet.birthDate ? formatDate(pet.birthDate) : "—"],
    ["Nabyto", pet.acquiredAt ? formatDate(pet.acquiredAt) : "—"],
    ["Źródło", pet.acquiredFrom || "—"],
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        {rows.map(([k, v]) => (
          <div key={k} style={{ padding: "10px 12px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-surface)" }}>
            <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{k}</div>
            <div style={{ fontSize: 13, color: "var(--text-primary)", marginTop: 2 }}>{v}</div>
          </div>
        ))}
      </div>

      {pet.notes && (
        <div style={{ padding: "10px 12px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-surface)" }}>
          <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>Notatki</div>
          <div style={{ fontSize: 13, color: "var(--text-secondary)", whiteSpace: "pre-wrap" }}>{pet.notes}</div>
        </div>
      )}

      <Field label="Status">
        <select style={inputStyle} value={pet.status} disabled={isPending} onChange={(e) => changeStatus(e.target.value as PetStatus)}>
          {(Object.keys(STATUS_LABELS) as PetStatus[]).map((s) => (
            <option key={s} value={s}>{STATUS_LABELS[s]}</option>
          ))}
        </select>
      </Field>
    </div>
  );
}

// ─── Measurements ───────────────────────────────────────────────────────────

export function MeasurementsSection({ pet }: { pet: PetWithRelations }) {
  const { showToast } = useToast();
  const refresh = useRefresh();
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [weightKg, setWeightKg] = useState("");
  const [lengthCm, setLengthCm] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState("");

  const sorted = [...pet.measurements].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const latest = sorted[0];
  const prev = sorted[1];
  const delta = latest?.weightGrams != null && prev?.weightGrams != null ? latest.weightGrams - prev.weightGrams : null;

  function add() {
    startTransition(async () => {
      try {
        await addMeasurement(pet.id, {
          date: new Date(date),
          weightGrams: weightKg ? Math.round(parseFloat(weightKg.replace(",", ".")) * 1000) : null,
          lengthCm: lengthCm ? parseFloat(lengthCm.replace(",", ".")) : null,
          note: note.trim() || null,
        });
        setOpen(false); setWeightKg(""); setLengthCm(""); setNote(""); refresh();
        showToast("Dodano pomiar", "success");
      } catch (e) { showToast(e instanceof Error ? e.message : "Błąd", "error"); }
    });
  }

  function del(id: string) {
    startTransition(async () => { await deleteMeasurement(id); refresh(); });
  }

  return (
    <SectionShell title="Pomiary i waga" onAdd={() => setOpen(true)} addLabel="Dodaj pomiar">
      {latest && (
        <div style={{ display: "flex", gap: 16, padding: "12px 14px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-surface)" }}>
          <div>
            <div style={{ fontSize: 20, fontWeight: 700, color: "var(--text-primary)" }}>{formatWeight(latest.weightGrams)}</div>
            <div style={{ fontSize: 11, color: "var(--text-muted)" }}>aktualna waga</div>
          </div>
          {delta != null && (
            <div>
              <div style={{ fontSize: 20, fontWeight: 700, color: delta < 0 ? "var(--accent-red)" : "var(--accent-green)" }}>
                {delta > 0 ? "+" : ""}{formatWeight(Math.abs(delta))}
              </div>
              <div style={{ fontSize: 11, color: "var(--text-muted)" }}>zmiana</div>
            </div>
          )}
        </div>
      )}

      {sorted.length === 0 ? <Empty text="Brak pomiarów. Dodaj pierwszy, aby śledzić trend." /> : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {sorted.map((m) => (
            <Row key={m.id} onDelete={() => del(m.id)}>
              <div style={{ fontSize: 13, color: "var(--text-primary)" }}>
                {formatWeight(m.weightGrams)}{m.lengthCm != null ? ` · ${m.lengthCm} cm` : ""}
              </div>
              <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{formatDate(m.date)}{m.note ? ` · ${m.note}` : ""}</div>
            </Row>
          ))}
        </div>
      )}

      {open && (
        <Modal title="Nowy pomiar" onClose={() => setOpen(false)} footer={<><GhostButton onClick={() => setOpen(false)}>Anuluj</GhostButton><PrimaryButton onClick={add} disabled={isPending}>Dodaj</PrimaryButton></>}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <Field label="Waga (kg)"><input style={inputStyle} inputMode="decimal" value={weightKg} onChange={(e) => setWeightKg(e.target.value)} placeholder="np. 12.5" /></Field>
            <Field label="Długość (cm)"><input style={inputStyle} inputMode="decimal" value={lengthCm} onChange={(e) => setLengthCm(e.target.value)} /></Field>
          </div>
          <Field label="Data"><input type="date" style={inputStyle} value={date} onChange={(e) => setDate(e.target.value)} /></Field>
          <Field label="Notatka"><input style={inputStyle} value={note} onChange={(e) => setNote(e.target.value)} /></Field>
        </Modal>
      )}
    </SectionShell>
  );
}

// ─── Treatments ─────────────────────────────────────────────────────────────

export function TreatmentsSection({ pet }: { pet: PetWithRelations }) {
  const { showToast } = useToast();
  const refresh = useRefresh();
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<PetTreatmentKind>("MEDICATION");
  const [name, setName] = useState("");
  const [dosage, setDosage] = useState("");
  const [everyDays, setEveryDays] = useState("");
  const [nextDue, setNextDue] = useState("");
  const [completingId, setCompletingId] = useState<string | null>(null);

  function add() {
    if (!name.trim()) { showToast("Podaj nazwę", "error"); return; }
    startTransition(async () => {
      try {
        await createTreatment(pet.id, {
          kind, name: name.trim(), dosage: dosage.trim() || null,
          recurring: recurringFromDays(everyDays ? parseInt(everyDays, 10) : null),
          nextDueAt: nextDue ? new Date(nextDue) : null,
        });
        setOpen(false); setName(""); setDosage(""); setEveryDays(""); setNextDue(""); refresh();
        showToast("Dodano", "success");
      } catch (e) { showToast(e instanceof Error ? e.message : "Błąd", "error"); }
    });
  }

  function complete(id: string) {
    setCompletingId(id);
    startTransition(async () => {
      try { await completeTreatment(id); refresh(); showToast("Odhaczono", "success"); }
      catch (e) { showToast(e instanceof Error ? e.message : "Błąd", "error"); }
      finally { setCompletingId(null); }
    });
  }

  function del(id: string) { startTransition(async () => { await deleteTreatment(id); refresh(); }); }

  return (
    <SectionShell title="Leki i szczepienia" onAdd={() => setOpen(true)}>
      {pet.treatments.length === 0 ? <Empty text="Brak leków, szczepień ani odrobaczania." /> : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {pet.treatments.map((t) => (
            <Row key={t.id} onComplete={() => complete(t.id)} completing={completingId === t.id} onDelete={() => del(t.id)}>
              <div style={{ fontSize: 13, color: "var(--text-primary)" }}>{t.name}</div>
              <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                {TREATMENT_KIND_LABELS[t.kind as PetTreatmentKind]}
                {t.dosage ? ` · ${t.dosage}` : ""}
                {t.nextDueAt ? ` · następny: ${formatDate(t.nextDueAt)}` : ""}
              </div>
            </Row>
          ))}
        </div>
      )}

      {open && (
        <Modal title="Nowy lek / szczepienie" onClose={() => setOpen(false)} footer={<><GhostButton onClick={() => setOpen(false)}>Anuluj</GhostButton><PrimaryButton onClick={add} disabled={isPending}>Dodaj</PrimaryButton></>}>
          <Field label="Rodzaj">
            <select style={inputStyle} value={kind} onChange={(e) => setKind(e.target.value as PetTreatmentKind)}>
              {(Object.keys(TREATMENT_KIND_LABELS) as PetTreatmentKind[]).map((k) => <option key={k} value={k}>{TREATMENT_KIND_LABELS[k]}</option>)}
            </select>
          </Field>
          <Field label="Nazwa *"><input style={inputStyle} value={name} onChange={(e) => setName(e.target.value)} placeholder="np. Drontal, szczepienie wścieklizna" /></Field>
          <Field label="Dawka"><input style={inputStyle} value={dosage} onChange={(e) => setDosage(e.target.value)} placeholder="np. 1 tabletka" /></Field>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <Field label="Następny termin"><input type="date" style={inputStyle} value={nextDue} onChange={(e) => setNextDue(e.target.value)} /></Field>
            <Field label="Powtarzaj co (dni)"><input style={inputStyle} inputMode="numeric" value={everyDays} onChange={(e) => setEveryDays(e.target.value)} placeholder="np. 90" /></Field>
          </div>
        </Modal>
      )}
    </SectionShell>
  );
}

// ─── Vet visits ─────────────────────────────────────────────────────────────

export function VetSection({ pet }: { pet: PetWithRelations }) {
  const { showToast } = useToast();
  const refresh = useRefresh();
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [vetName, setVetName] = useState("");
  const [reason, setReason] = useState("");
  const [diagnosis, setDiagnosis] = useState("");
  const [cost, setCost] = useState("");
  const [nextVisit, setNextVisit] = useState("");
  const [attachmentUrl, setAttachmentUrl] = useState("");

  function add() {
    startTransition(async () => {
      try {
        await createVetVisit(pet.id, {
          date: new Date(date), vetName: vetName.trim() || null, reason: reason.trim() || null,
          diagnosis: diagnosis.trim() || null, cost: cost ? parseFloat(cost.replace(",", ".")) : null,
          nextVisitAt: nextVisit ? new Date(nextVisit) : null, attachmentUrl: attachmentUrl.trim() || null,
        });
        setOpen(false); setVetName(""); setReason(""); setDiagnosis(""); setCost(""); setNextVisit(""); setAttachmentUrl(""); refresh();
        showToast("Zapisano wizytę", "success");
      } catch (e) { showToast(e instanceof Error ? e.message : "Błąd", "error"); }
    });
  }

  function del(id: string) { startTransition(async () => { await deleteVetVisit(id); refresh(); }); }

  return (
    <SectionShell title="Wizyty weterynaryjne" onAdd={() => setOpen(true)} addLabel="Dodaj wizytę">
      {pet.vetVisits.length === 0 ? <Empty text="Brak wizyt weterynaryjnych." /> : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {pet.vetVisits.map((v) => (
            <Row key={v.id} onDelete={() => del(v.id)}>
              <div style={{ fontSize: 13, color: "var(--text-primary)" }}>{v.reason || "Wizyta"}{v.cost != null ? ` · ${v.cost.toFixed(2)} zł` : ""}</div>
              <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                {formatDate(v.date)}{v.vetName ? ` · ${v.vetName}` : ""}{v.nextVisitAt ? ` · następna: ${formatDate(v.nextVisitAt)}` : ""}
              </div>
              {v.diagnosis && <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 2 }}>{v.diagnosis}</div>}
              {v.attachmentUrl && (
                <a href={v.attachmentUrl} target="_blank" rel="noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, color: "var(--accent-blue)", textDecoration: "none", marginTop: 2 }}>
                  <ExternalLink size={11} /> załącznik
                </a>
              )}
            </Row>
          ))}
        </div>
      )}

      {open && (
        <Modal title="Nowa wizyta weterynaryjna" onClose={() => setOpen(false)} wide footer={<><GhostButton onClick={() => setOpen(false)}>Anuluj</GhostButton><PrimaryButton onClick={add} disabled={isPending}>Zapisz</PrimaryButton></>}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <Field label="Data"><input type="date" style={inputStyle} value={date} onChange={(e) => setDate(e.target.value)} /></Field>
            <Field label="Lekarz / klinika"><input style={inputStyle} value={vetName} onChange={(e) => setVetName(e.target.value)} /></Field>
          </div>
          <Field label="Powód"><input style={inputStyle} value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
          <Field label="Diagnoza"><textarea style={{ ...inputStyle, minHeight: 50, resize: "vertical" }} value={diagnosis} onChange={(e) => setDiagnosis(e.target.value)} /></Field>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <Field label="Koszt (zł)"><input style={inputStyle} inputMode="decimal" value={cost} onChange={(e) => setCost(e.target.value)} /></Field>
            <Field label="Następna wizyta"><input type="date" style={inputStyle} value={nextVisit} onChange={(e) => setNextVisit(e.target.value)} /></Field>
          </div>
          <Field label="URL załącznika (skan, wynik)"><input style={inputStyle} value={attachmentUrl} onChange={(e) => setAttachmentUrl(e.target.value)} placeholder="https://…" /></Field>
        </Modal>
      )}
    </SectionShell>
  );
}

// ─── Health journal ─────────────────────────────────────────────────────────

export function HealthSection({ pet }: { pet: PetWithRelations }) {
  const { showToast } = useToast();
  const refresh = useRefresh();
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<PetHealthType>("SYMPTOM");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  function add() {
    if (!title.trim()) { showToast("Podaj tytuł", "error"); return; }
    startTransition(async () => {
      try {
        await createHealthRecord(pet.id, { type, title: title.trim(), description: description.trim() || null });
        setOpen(false); setTitle(""); setDescription(""); refresh(); showToast("Dodano wpis", "success");
      } catch (e) { showToast(e instanceof Error ? e.message : "Błąd", "error"); }
    });
  }

  function toggleResolved(id: string, resolved: boolean) {
    startTransition(async () => { await updateHealthRecord(id, { resolved: !resolved }); refresh(); });
  }
  function del(id: string) { startTransition(async () => { await deleteHealthRecord(id); refresh(); }); }

  return (
    <SectionShell title="Dziennik zdrowia" onAdd={() => setOpen(true)} addLabel="Dodaj wpis">
      {pet.healthRecords.length === 0 ? <Empty text="Brak wpisów zdrowotnych, alergii ani objawów." /> : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {pet.healthRecords.map((h) => (
            <Row key={h.id} onDelete={() => del(h.id)}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 13, color: "var(--text-primary)", textDecoration: h.resolved ? "line-through" : "none" }}>{h.title}</span>
                <button onClick={() => toggleResolved(h.id, h.resolved)} style={{ fontSize: 10, padding: "1px 6px", borderRadius: 99, border: "1px solid var(--border)", background: "var(--bg-elevated)", color: h.resolved ? "var(--accent-green)" : "var(--text-muted)", cursor: "pointer" }}>
                  {h.resolved ? "rozwiązane" : "aktywne"}
                </button>
              </div>
              <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{HEALTH_TYPE_LABELS[h.type as PetHealthType]} · {formatDate(h.date)}</div>
              {h.description && <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 2 }}>{h.description}</div>}
            </Row>
          ))}
        </div>
      )}

      {open && (
        <Modal title="Nowy wpis zdrowotny" onClose={() => setOpen(false)} footer={<><GhostButton onClick={() => setOpen(false)}>Anuluj</GhostButton><PrimaryButton onClick={add} disabled={isPending}>Dodaj</PrimaryButton></>}>
          <Field label="Typ">
            <select style={inputStyle} value={type} onChange={(e) => setType(e.target.value as PetHealthType)}>
              {(Object.keys(HEALTH_TYPE_LABELS) as PetHealthType[]).map((t) => <option key={t} value={t}>{HEALTH_TYPE_LABELS[t]}</option>)}
            </select>
          </Field>
          <Field label="Tytuł *"><input style={inputStyle} value={title} onChange={(e) => setTitle(e.target.value)} /></Field>
          <Field label="Opis"><textarea style={{ ...inputStyle, minHeight: 60, resize: "vertical" }} value={description} onChange={(e) => setDescription(e.target.value)} /></Field>
        </Modal>
      )}
    </SectionShell>
  );
}

// ─── Feeding ────────────────────────────────────────────────────────────────

export function FeedingSection({ pet }: { pet: PetWithRelations }) {
  const { showToast } = useToast();
  const refresh = useRefresh();
  const [isPending, startTransition] = useTransition();
  const [foodType, setFoodType] = useState("");
  const [preyType, setPreyType] = useState("");
  const [outcome, setOutcome] = useState<"FED" | "REFUSED" | "REGURGITATED">("FED");
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [schedTitle, setSchedTitle] = useState("");
  const [schedEvery, setSchedEvery] = useState("");

  const feedingTasks = pet.careTasks.filter((c) => c.category === "FEEDING");
  const feedingLogs = pet.careLogs.filter((l) => l.category === "FEEDING").slice(0, 10);

  function quickLog() {
    startTransition(async () => {
      try {
        await logFeeding(pet.id, { foodType: foodType.trim() || null, preyType: preyType.trim() || null, outcome });
        setFoodType(""); setPreyType(""); setOutcome("FED"); refresh(); showToast("Zapisano karmienie", "success");
      } catch (e) { showToast(e instanceof Error ? e.message : "Błąd", "error"); }
    });
  }

  function addSchedule() {
    if (!schedTitle.trim()) { showToast("Podaj nazwę", "error"); return; }
    startTransition(async () => {
      try {
        await createCareTask(pet.id, { category: "FEEDING", title: schedTitle.trim(), recurring: recurringFromDays(schedEvery ? parseInt(schedEvery, 10) : null) });
        setScheduleOpen(false); setSchedTitle(""); setSchedEvery(""); refresh(); showToast("Dodano harmonogram", "success");
      } catch (e) { showToast(e instanceof Error ? e.message : "Błąd", "error"); }
    });
  }

  function del(id: string) { startTransition(async () => { await deleteCareTask(id); refresh(); }); }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <SectionShell title="Szybki wpis karmienia">
        <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "12px 14px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-surface)" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <Field label="Pokarm"><input style={inputStyle} value={foodType} onChange={(e) => setFoodType(e.target.value)} placeholder="np. karma sucha" /></Field>
            <Field label="Ofiara (gady)"><input style={inputStyle} value={preyType} onChange={(e) => setPreyType(e.target.value)} placeholder="np. mysz" /></Field>
          </div>
          <Field label="Wynik">
            <select style={inputStyle} value={outcome} onChange={(e) => setOutcome(e.target.value as typeof outcome)}>
              <option value="FED">Zjedzone</option>
              <option value="REFUSED">Odrzucone</option>
              <option value="REGURGITATED">Zwrócone</option>
            </select>
          </Field>
          <PrimaryButton onClick={quickLog} disabled={isPending}>Zapisz karmienie</PrimaryButton>
        </div>
      </SectionShell>

      <SectionShell title="Harmonogram karmienia" onAdd={() => setScheduleOpen(true)}>
        {feedingTasks.length === 0 ? <Empty text="Brak harmonogramu karmienia." /> : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {feedingTasks.map((c) => (
              <Row key={c.id} onDelete={() => del(c.id)}>
                <div style={{ fontSize: 13, color: "var(--text-primary)" }}>{c.title}</div>
                <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{c.nextDueAt ? `następne: ${formatDate(c.nextDueAt)}` : "bez terminu"}</div>
              </Row>
            ))}
          </div>
        )}
      </SectionShell>

      {feedingLogs.length > 0 && (
        <SectionShell title="Ostatnie karmienia">
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {feedingLogs.map((l) => {
              let info = "";
              try { const p = l.payload ? JSON.parse(l.payload) : null; if (p) info = [p.preyType, p.foodType, p.outcome === "REFUSED" ? "odrzucone" : p.outcome === "REGURGITATED" ? "zwrócone" : null].filter(Boolean).join(" · "); } catch { /* ignore */ }
              return (
                <div key={l.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-surface)" }}>
                  <span style={{ color: "var(--text-secondary)" }}>{info || "Karmienie"}</span>
                  <span style={{ color: "var(--text-muted)" }}>{formatDate(l.occurredAt)}</span>
                </div>
              );
            })}
          </div>
        </SectionShell>
      )}

      {scheduleOpen && (
        <Modal title="Harmonogram karmienia" onClose={() => setScheduleOpen(false)} footer={<><GhostButton onClick={() => setScheduleOpen(false)}>Anuluj</GhostButton><PrimaryButton onClick={addSchedule} disabled={isPending}>Dodaj</PrimaryButton></>}>
          <Field label="Nazwa *"><input style={inputStyle} value={schedTitle} onChange={(e) => setSchedTitle(e.target.value)} placeholder="np. Karmienie poranne" /></Field>
          <Field label="Powtarzaj co (dni)"><input style={inputStyle} inputMode="numeric" value={schedEvery} onChange={(e) => setSchedEvery(e.target.value)} placeholder="np. 1, 7, 14" /></Field>
        </Modal>
      )}
    </div>
  );
}

// ─── Routines ─────────────────────────────────────────────────────────────

const ROUTINE_CATEGORIES: PetCareCategory[] = ["CLEANING", "GROOMING", "WALK", "WATER_CHANGE", "UVB_REPLACEMENT", "WEIGHING", "CUSTOM"];

export function RoutinesSection({ pet }: { pet: PetWithRelations }) {
  const { showToast } = useToast();
  const refresh = useRefresh();
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<PetCareCategory>("CLEANING");
  const [title, setTitle] = useState("");
  const [everyDays, setEveryDays] = useState("");
  const [nextDue, setNextDue] = useState("");
  const [completingId, setCompletingId] = useState<string | null>(null);

  const routines = pet.careTasks.filter((c) => c.category !== "FEEDING");

  function add() {
    if (!title.trim()) { showToast("Podaj nazwę", "error"); return; }
    startTransition(async () => {
      try {
        await createCareTask(pet.id, { category, title: title.trim(), recurring: recurringFromDays(everyDays ? parseInt(everyDays, 10) : null), nextDueAt: nextDue ? new Date(nextDue) : null });
        setOpen(false); setTitle(""); setEveryDays(""); setNextDue(""); refresh(); showToast("Dodano rutynę", "success");
      } catch (e) { showToast(e instanceof Error ? e.message : "Błąd", "error"); }
    });
  }

  function complete(id: string) {
    setCompletingId(id);
    startTransition(async () => {
      try { await completeCareTask(id); refresh(); showToast("Odhaczono", "success"); }
      catch (e) { showToast(e instanceof Error ? e.message : "Błąd", "error"); }
      finally { setCompletingId(null); }
    });
  }
  function del(id: string) { startTransition(async () => { await deleteCareTask(id); refresh(); }); }

  return (
    <SectionShell title="Rutyny opieki" onAdd={() => setOpen(true)} addLabel="Dodaj rutynę">
      {routines.length === 0 ? <Empty text="Brak rutyn (czyszczenie, pielęgnacja, spacery…)." /> : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {routines.map((c) => (
            <Row key={c.id} onComplete={() => complete(c.id)} completing={completingId === c.id} onDelete={() => del(c.id)}>
              <div style={{ fontSize: 13, color: "var(--text-primary)" }}>{c.title}</div>
              <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                {CARE_CATEGORY_LABELS[c.category as PetCareCategory]}{c.nextDueAt ? ` · następne: ${formatDate(c.nextDueAt)}` : ""}
              </div>
            </Row>
          ))}
        </div>
      )}

      {open && (
        <Modal title="Nowa rutyna" onClose={() => setOpen(false)} footer={<><GhostButton onClick={() => setOpen(false)}>Anuluj</GhostButton><PrimaryButton onClick={add} disabled={isPending}>Dodaj</PrimaryButton></>}>
          <Field label="Kategoria">
            <select style={inputStyle} value={category} onChange={(e) => setCategory(e.target.value as PetCareCategory)}>
              {ROUTINE_CATEGORIES.map((c) => <option key={c} value={c}>{CARE_CATEGORY_LABELS[c]}</option>)}
            </select>
          </Field>
          <Field label="Nazwa *"><input style={inputStyle} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="np. Czyszczenie terrarium" /></Field>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <Field label="Następny termin"><input type="date" style={inputStyle} value={nextDue} onChange={(e) => setNextDue(e.target.value)} /></Field>
            <Field label="Powtarzaj co (dni)"><input style={inputStyle} inputMode="numeric" value={everyDays} onChange={(e) => setEveryDays(e.target.value)} /></Field>
          </div>
        </Modal>
      )}
    </SectionShell>
  );
}

// ─── Finance ─────────────────────────────────────────────────────────────

export function FinanceSection({ pet }: { pet: PetWithRelations }) {
  const withCost = pet.vetVisits.filter((v) => v.cost != null);
  const total = withCost.reduce((sum, v) => sum + (v.cost ?? 0), 0);

  return (
    <SectionShell title="Finanse">
      <div style={{ padding: "14px 16px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-surface)" }}>
        <div style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)" }}>{total.toFixed(2)} zł</div>
        <div style={{ fontSize: 11, color: "var(--text-muted)" }}>suma kosztów wizyt weterynaryjnych</div>
      </div>
      {withCost.length === 0 ? <Empty text="Brak zarejestrowanych kosztów. Dodawaj koszty przy wizytach weterynaryjnych." /> : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {withCost.map((v) => (
            <div key={v.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-surface)" }}>
              <span style={{ color: "var(--text-secondary)" }}>{v.reason || "Wizyta"} · {formatDate(v.date)}</span>
              <span style={{ color: "var(--text-primary)" }}>{v.cost!.toFixed(2)} zł</span>
            </div>
          ))}
        </div>
      )}
    </SectionShell>
  );
}

// ─── Documents (URL-based + GDrive coming soon) ─────────────────────────────

export function DocumentsSection({ pet }: { pet: PetWithRelations }) {
  const { showToast } = useToast();
  const refresh = useRefresh();
  const [isPending, startTransition] = useTransition();
  const [photoUrl, setPhotoUrl] = useState(pet.photoUrl ?? "");

  const attachments = pet.vetVisits.filter((v) => v.attachmentUrl);

  function savePhoto() {
    startTransition(async () => {
      try { await updatePet(pet.id, { photoUrl: photoUrl.trim() || null }); refresh(); showToast("Zapisano", "success"); }
      catch (e) { showToast(e instanceof Error ? e.message : "Błąd", "error"); }
    });
  }

  return (
    <SectionShell title="Dokumenty i zdjęcia">
      <Field label="URL zdjęcia profilowego">
        <div style={{ display: "flex", gap: 8 }}>
          <input style={inputStyle} value={photoUrl} onChange={(e) => setPhotoUrl(e.target.value)} placeholder="https://…" />
          <PrimaryButton onClick={savePhoto} disabled={isPending}>Zapisz</PrimaryButton>
        </div>
      </Field>

      <div>
        <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 6 }}>Załączniki z wizyt</div>
        {attachments.length === 0 ? <Empty text="Brak załączników. Dodawaj linki przy wizytach weterynaryjnych." /> : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {attachments.map((v) => (
              <a key={v.id} href={v.attachmentUrl!} target="_blank" rel="noreferrer" style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-surface)", color: "var(--accent-blue)", textDecoration: "none" }}>
                <ExternalLink size={14} /> {v.reason || "Wizyta"} · {formatDate(v.date)}
              </a>
            ))}
          </div>
        )}
      </div>

      <div style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "12px 14px", borderRadius: 8, border: "1px dashed var(--border)", background: "var(--bg-surface)", opacity: 0.85 }}>
        <HardDrive size={16} style={{ color: "var(--accent-blue)", flexShrink: 0, marginTop: 1 }} />
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>Integracja Google Drive — wkrótce</div>
          <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
            Wkrótce będzie można wskazać własny folder na Google Drive i przechowywać tam zdjęcia oraz dokumenty (rodowody, wyniki badań). Na razie wklejaj linki URL.
          </div>
        </div>
      </div>
    </SectionShell>
  );
}

// ─── Sharing ─────────────────────────────────────────────────────────────

export function SharingSection({ pet, teams }: { pet: PetWithRelations; teams: Array<{ id: string; name: string }> }) {
  const { showToast } = useToast();
  const refresh = useRefresh();
  const [isPending, startTransition] = useTransition();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"VIEWER" | "EDITOR">("VIEWER");

  function shareByEmail() {
    if (!email.trim()) return;
    startTransition(async () => {
      const res = await sharePetByEmail(pet.id, email.trim(), role);
      if (res.error) { showToast(res.error, "error"); return; }
      setEmail(""); refresh(); showToast("Udostępniono", "success");
    });
  }
  function remove(id: string) { startTransition(async () => { await removePetShare(id); refresh(); }); }

  return (
    <SectionShell title="Udostępnianie">
      <div style={{ padding: "12px 14px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-surface)", display: "flex", flexDirection: "column", gap: 8 }}>
        <Field label="Udostępnij osobie (e-mail)">
          <div style={{ display: "flex", gap: 8 }}>
            <input style={inputStyle} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="osoba@example.com" />
            <select style={{ ...inputStyle, width: 120 }} value={role} onChange={(e) => setRole(e.target.value as "VIEWER" | "EDITOR")}>
              <option value="VIEWER">Podgląd</option>
              <option value="EDITOR">Edycja</option>
            </select>
            <button onClick={shareByEmail} disabled={isPending} style={{ ...smallBtn("#fff"), width: 36, background: "var(--accent-orange)", border: "none" }}>
              {isPending ? <Loader2 size={14} className="animate-spin" /> : <Mail size={14} />}
            </button>
          </div>
        </Field>
      </div>

      <div>
        <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 6 }}>Współdzielone z</div>
        {pet.shares.length === 0 ? <Empty text="To zwierzę nie jest jeszcze z nikim współdzielone." /> : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {pet.shares.map((s) => (
              <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-surface)" }}>
                {s.team ? <Users size={14} style={{ color: "var(--accent-purple)" }} /> : <Mail size={14} style={{ color: "var(--accent-blue)" }} />}
                <span style={{ flex: 1, color: "var(--text-primary)", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {s.team ? s.team.name : (s.user?.email ?? s.user?.name ?? "Użytkownik")}
                </span>
                <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{s.role === "EDITOR" ? "edycja" : "podgląd"}</span>
                <button onClick={() => remove(s.id)} style={smallBtn("var(--accent-red)")}><X size={13} /></button>
              </div>
            ))}
          </div>
        )}
        {teams.length > 0 && (
          <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 8 }}>
            Aby udostępnić całemu zespołowi, utwórz zwierzę jako własność zespołu lub poproś administratora zespołu.
          </p>
        )}
      </div>
    </SectionShell>
  );
}

// ─── Feature visibility settings ─────────────────────────────────────────────

export function FeatureSettingsSection({ pet }: { pet: PetWithRelations }) {
  const { showToast } = useToast();
  const refresh = useRefresh();
  const [isPending, startTransition] = useTransition();
  const [presetKey, setPresetKey] = useState(pet.presetKey);
  const [flags, setFlags] = useState<PetFeatureFlags>(resolveFeatures(pet));

  function applyPreset(key: string) {
    setPresetKey(key);
    if (key !== "custom") setFlags(flagsForPreset(key));
  }
  function toggle(key: PetFeatureKey) {
    setPresetKey("custom");
    setFlags((prev) => ({ ...prev, [key]: !prev[key] }));
  }
  function save() {
    startTransition(async () => {
      try { await updatePetFeatures(pet.id, presetKey, JSON.stringify(flags)); refresh(); showToast("Zapisano widoczność", "success"); }
      catch (e) { showToast(e instanceof Error ? e.message : "Błąd", "error"); }
    });
  }

  return (
    <SectionShell title="Widoczność funkcji">
      <Field label="Pakiet (preset)">
        <select style={inputStyle} value={presetKey} onChange={(e) => applyPreset(e.target.value)}>
          {PET_PRESETS.map((p) => <option key={p.key} value={p.key}>{p.emoji} {p.label}</option>)}
        </select>
      </Field>

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {PET_FEATURE_KEYS.map((key) => {
          const phase = PET_FEATURE_PHASE[key];
          return (
            <label key={key} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-surface)", cursor: "pointer" }}>
              <input type="checkbox" checked={flags[key]} onChange={() => toggle(key)} style={{ width: 16, height: 16 }} />
              <span style={{ flex: 1, fontSize: 13, color: "var(--text-primary)" }}>{PET_FEATURE_LABELS[key]}</span>
              {phase && <span style={{ fontSize: 10, color: "var(--text-muted)", border: "1px solid var(--border)", borderRadius: 99, padding: "1px 6px" }}>Faza {phase}</span>}
            </label>
          );
        })}
      </div>

      <PrimaryButton onClick={save} disabled={isPending}>Zapisz widoczność</PrimaryButton>
    </SectionShell>
  );
}

// ─── Coming soon (phase 2/3 features) ───────────────────────────────────────

export function ComingSoonSection({ feature, phase }: { feature: PetFeatureKey; phase?: 2 | 3 }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, padding: "40px 16px", borderRadius: 10, border: "1px dashed var(--border)", background: "var(--bg-surface)", textAlign: "center" }}>
      <Clock size={28} style={{ color: "var(--text-muted)" }} />
      <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>{PET_FEATURE_LABELS[feature]} — wkrótce</div>
      <div style={{ fontSize: 13, color: "var(--text-muted)", maxWidth: 360 }}>
        Ta sekcja zostanie wprowadzona w {phase ? `Fazie ${phase}` : "kolejnej fazie"}. Możesz ją już włączyć w presecie, aby zarezerwować miejsce w profilu.
      </div>
    </div>
  );
}
