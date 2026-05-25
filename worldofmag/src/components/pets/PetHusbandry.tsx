"use client";

import { useState, useEffect, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Loader2, Unlink, Wrench, AlertTriangle } from "lucide-react";
import { Modal, Field, inputStyle, PrimaryButton, GhostButton } from "./Modal";
import { useToast } from "@/components/ui/Toast";
import {
  getEnclosures, createEnclosure, assignPetToEnclosure, updateEnclosure,
  addEnvironmentReading, deleteEnvironmentReading,
} from "@/actions/petHusbandry";
import {
  ENCLOSURE_TYPES, enclosureTypeMeta, enclosureTypeForSpecies, paramsForGroup,
  classifyValue, rangeLabel, type EnvGroup, type EnvStatus, type Range,
} from "@/lib/petEnvironment";
import { formatDate } from "@/lib/petSpecies";
import type { PetWithRelations, PetEnclosure, PetEnvironmentReading } from "@/types";

const STATUS_COLOR: Record<EnvStatus, string> = {
  ok: "var(--accent-green)",
  warn: "var(--accent-amber)",
  danger: "var(--accent-red)",
};

interface EquipItem { name: string; replaceBy?: string | null }

function parseJSON<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try { return JSON.parse(raw) as T; } catch { return fallback; }
}

export function HusbandrySection({ pet }: { pet: PetWithRelations }) {
  return <EnclosureSection pet={pet} group="terrarium" />;
}
export function AquariumSection({ pet }: { pet: PetWithRelations }) {
  return <EnclosureSection pet={pet} group="aquarium" />;
}

function EnclosureSection({ pet, group }: { pet: PetWithRelations; group: EnvGroup }) {
  const router = useRouter();
  const { showToast } = useToast();
  const [isPending, startTransition] = useTransition();
  const enc = pet.enclosure;

  if (!enc) return <NoEnclosure pet={pet} group={group} />;

  const ranges = parseJSON<Record<string, Range>>(enc.targetRanges, {});
  const equipment = parseJSON<EquipItem[]>(enc.equipment, []);
  const params = paramsForGroup(group);
  const latest = enc.readings[0] as (PetEnvironmentReading | undefined);
  const meta = enclosureTypeMeta(enc.type);
  const dims = [enc.lengthCm, enc.widthCm, enc.heightCm].some((d) => d != null)
    ? `${enc.lengthCm ?? "?"}×${enc.widthCm ?? "?"}×${enc.heightCm ?? "?"} cm`
    : enc.volumeL != null ? `${enc.volumeL} l` : null;

  function unassign() {
    if (!confirm("Odłączyć zwierzę od tego zbiornika? Zbiornik i jego pomiary pozostaną.")) return;
    startTransition(async () => {
      await assignPetToEnclosure(pet.id, null);
      router.refresh();
      showToast("Odłączono od zbiornika", "success");
    });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Enclosure header */}
      <div style={{ padding: "12px 14px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--bg-surface)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 22 }}>{meta.emoji}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>{enc.name}</div>
            <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
              {meta.label}{dims ? ` · ${dims}` : ""}{enc.location ? ` · ${enc.location}` : ""}
            </div>
          </div>
          <button onClick={unassign} disabled={isPending} title="Odłącz" style={iconBtn}><Unlink size={14} /></button>
        </div>
      </div>

      {/* Latest readings */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <SectionTitle title="Aktualne parametry" />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 8 }}>
          {params.map((p) => {
            const value = latest ? (latest as unknown as Record<string, number | null>)[p.key] : null;
            const status = classifyValue(p.key, value, ranges);
            return (
              <div key={p.key} style={{ padding: "10px 12px", borderRadius: 8, border: `1px solid ${value != null && status !== "ok" ? STATUS_COLOR[status] : "var(--border)"}`, background: "var(--bg-surface)" }}>
                <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{p.label}</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: value != null ? STATUS_COLOR[status] : "var(--text-muted)" }}>
                  {value != null ? `${value.toFixed(p.decimals)}${p.unit ? " " + p.unit : ""}` : "—"}
                </div>
                <div style={{ fontSize: 10, color: "var(--text-muted)" }}>{rangeLabel(p.key, ranges)}</div>
              </div>
            );
          })}
        </div>
        {latest && (
          <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Ostatni pomiar: {formatDate(latest.measuredAt)}</div>
        )}
      </div>

      <ReadingControls enclosure={enc} group={group} ranges={ranges} />

      {/* Equipment */}
      <EquipmentBlock enclosure={enc} equipment={equipment} />

      {/* Readings history */}
      <ReadingsHistory enclosure={enc} group={group} ranges={ranges} />
    </div>
  );
}

function SectionTitle({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
      <h3 style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", margin: 0 }}>{title}</h3>
      {action}
    </div>
  );
}

// ── No enclosure: assign or create ──────────────────────────────────────────

function NoEnclosure({ pet, group }: { pet: PetWithRelations; group: EnvGroup }) {
  const router = useRouter();
  const { showToast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [enclosures, setEnclosures] = useState<PetEnclosure[]>([]);
  const [creating, setCreating] = useState(false);

  const groupTypes = ENCLOSURE_TYPES.filter((t) => t.group === group);
  const [name, setName] = useState("");
  const [type, setType] = useState(() => {
    const suggested = enclosureTypeForSpecies(pet.species);
    return groupTypes.some((t) => t.value === suggested) ? suggested : groupTypes[0].value;
  });
  const [volumeL, setVolumeL] = useState("");
  const [lengthCm, setLengthCm] = useState("");
  const [location, setLocation] = useState("");

  useEffect(() => {
    getEnclosures().then((all) => setEnclosures(all.filter((e) => groupTypes.some((t) => t.value === e.type)))).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function assign(id: string) {
    startTransition(async () => {
      await assignPetToEnclosure(pet.id, id);
      router.refresh();
      showToast("Przypisano zbiornik", "success");
    });
  }

  function create() {
    if (!name.trim()) { showToast("Podaj nazwę zbiornika", "error"); return; }
    startTransition(async () => {
      try {
        await createEnclosure({
          name: name.trim(), type,
          volumeL: volumeL ? parseFloat(volumeL.replace(",", ".")) : null,
          lengthCm: lengthCm ? parseFloat(lengthCm.replace(",", ".")) : null,
          location: location.trim() || null,
          assignPetId: pet.id,
        });
        router.refresh();
        showToast("Utworzono i przypisano zbiornik", "success");
      } catch (e) { showToast(e instanceof Error ? e.message : "Błąd", "error"); }
    });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: 0 }}>
        {group === "aquarium"
          ? "Przypisz akwarium/zbiornik, aby śledzić parametry wody (pH, amoniak, azotyny, azotany, temperatura)."
          : "Przypisz terrarium, aby śledzić temperaturę stref, wilgotność i UVB oraz sprzęt (np. żarówki UVB)."}
      </p>

      {enclosures.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <SectionTitle title="Przypisz istniejący" />
          {enclosures.map((e) => (
            <button key={e.id} onClick={() => assign(e.id)} disabled={isPending}
              style={{ textAlign: "left", padding: "10px 12px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-surface)", cursor: "pointer", color: "var(--text-primary)", fontSize: 13 }}>
              {enclosureTypeMeta(e.type).emoji} {e.name}
              <span style={{ color: "var(--text-muted)" }}> · {enclosureTypeMeta(e.type).label}</span>
            </button>
          ))}
        </div>
      )}

      {creating ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "12px 14px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--bg-surface)" }}>
          <SectionTitle title="Nowy zbiornik" />
          <Field label="Nazwa *"><input autoFocus style={inputStyle} value={name} onChange={(e) => setName(e.target.value)} placeholder={group === "aquarium" ? "np. Akwarium salon 240l" : "np. Terrarium Pyton"} /></Field>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <Field label="Typ">
              <select style={inputStyle} value={type} onChange={(e) => setType(e.target.value)}>
                {groupTypes.map((t) => <option key={t.value} value={t.value}>{t.emoji} {t.label}</option>)}
              </select>
            </Field>
            {group === "aquarium"
              ? <Field label="Pojemność (l)"><input style={inputStyle} inputMode="decimal" value={volumeL} onChange={(e) => setVolumeL(e.target.value)} /></Field>
              : <Field label="Długość (cm)"><input style={inputStyle} inputMode="decimal" value={lengthCm} onChange={(e) => setLengthCm(e.target.value)} /></Field>}
          </div>
          <Field label="Lokalizacja"><input style={inputStyle} value={location} onChange={(e) => setLocation(e.target.value)} placeholder="np. salon" /></Field>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <GhostButton onClick={() => setCreating(false)}>Anuluj</GhostButton>
            <PrimaryButton onClick={create} disabled={isPending}>{isPending ? <Loader2 size={14} className="animate-spin" /> : "Utwórz"}</PrimaryButton>
          </div>
        </div>
      ) : (
        <button onClick={() => setCreating(true)} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--accent-orange)", background: "none", border: "1px dashed var(--border)", borderRadius: 8, padding: "10px 12px", cursor: "pointer" }}>
          <Plus size={15} /> Utwórz nowy zbiornik
        </button>
      )}
    </div>
  );
}

// ── Add reading ─────────────────────────────────────────────────────────────

function ReadingControls({ enclosure, group, ranges }: { enclosure: PetEnclosure; group: EnvGroup; ranges: Record<string, Range> }) {
  const router = useRouter();
  const { showToast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [rangesOpen, setRangesOpen] = useState(false);
  const params = paramsForGroup(group);
  const [vals, setVals] = useState<Record<string, string>>({});

  function add() {
    const data: Record<string, number | null> = {};
    let any = false;
    for (const p of params) {
      const raw = vals[p.key];
      if (raw != null && raw !== "") { data[p.key] = parseFloat(raw.replace(",", ".")); any = true; }
    }
    if (!any) { showToast("Podaj przynajmniej jeden parametr", "error"); return; }
    startTransition(async () => {
      try {
        await addEnvironmentReading(enclosure.id, data);
        setOpen(false); setVals({}); router.refresh();
        showToast("Zapisano pomiar", "success");
      } catch (e) { showToast(e instanceof Error ? e.message : "Błąd", "error"); }
    });
  }

  return (
    <div style={{ display: "flex", gap: 8 }}>
      <PrimaryButton onClick={() => setOpen(true)}>+ Dodaj pomiar</PrimaryButton>
      <GhostButton onClick={() => setRangesOpen(true)}>Zakresy docelowe</GhostButton>

      {open && (
        <Modal title="Nowy pomiar parametrów" onClose={() => setOpen(false)} wide
          footer={<><GhostButton onClick={() => setOpen(false)}>Anuluj</GhostButton><PrimaryButton onClick={add} disabled={isPending}>Zapisz</PrimaryButton></>}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {params.map((p) => (
              <Field key={p.key} label={`${p.label}${p.unit ? ` (${p.unit})` : ""}`}>
                <input style={inputStyle} inputMode="decimal" value={vals[p.key] ?? ""} onChange={(e) => setVals((v) => ({ ...v, [p.key]: e.target.value }))} />
              </Field>
            ))}
          </div>
        </Modal>
      )}

      {rangesOpen && <TargetRangesModal enclosure={enclosure} group={group} current={ranges} onClose={() => setRangesOpen(false)} />}
    </div>
  );
}

function TargetRangesModal({ enclosure, group, current, onClose }: { enclosure: PetEnclosure; group: EnvGroup; current: Record<string, Range>; onClose: () => void }) {
  const router = useRouter();
  const { showToast } = useToast();
  const [isPending, startTransition] = useTransition();
  const params = paramsForGroup(group);
  const [draft, setDraft] = useState<Record<string, { min: string; max: string }>>(() => {
    const d: Record<string, { min: string; max: string }> = {};
    for (const p of params) d[p.key] = { min: current[p.key]?.min?.toString() ?? "", max: current[p.key]?.max?.toString() ?? "" };
    return d;
  });

  function save() {
    const out: Record<string, Range> = { ...current };
    for (const p of params) {
      const { min, max } = draft[p.key];
      const r: Range = {};
      if (min !== "") r.min = parseFloat(min.replace(",", "."));
      if (max !== "") r.max = parseFloat(max.replace(",", "."));
      if (r.min != null || r.max != null) out[p.key] = r; else delete out[p.key];
    }
    startTransition(async () => {
      try { await updateEnclosure(enclosure.id, { targetRanges: out }); router.refresh(); showToast("Zapisano zakresy", "success"); onClose(); }
      catch (e) { showToast(e instanceof Error ? e.message : "Błąd", "error"); }
    });
  }

  return (
    <Modal title="Zakresy docelowe" onClose={onClose} wide
      footer={<><GhostButton onClick={onClose}>Anuluj</GhostButton><PrimaryButton onClick={save} disabled={isPending}>Zapisz</PrimaryButton></>}>
      <p style={{ fontSize: 12, color: "var(--text-muted)", margin: 0 }}>Puste pole = użyj domyślnego zakresu bezpieczeństwa.</p>
      {params.map((p) => (
        <div key={p.key} style={{ display: "grid", gridTemplateColumns: "1fr 80px 80px", gap: 8, alignItems: "center" }}>
          <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>{p.label}</span>
          <input style={inputStyle} inputMode="decimal" placeholder="min" value={draft[p.key].min} onChange={(e) => setDraft((d) => ({ ...d, [p.key]: { ...d[p.key], min: e.target.value } }))} />
          <input style={inputStyle} inputMode="decimal" placeholder="max" value={draft[p.key].max} onChange={(e) => setDraft((d) => ({ ...d, [p.key]: { ...d[p.key], max: e.target.value } }))} />
        </div>
      ))}
    </Modal>
  );
}

// ── Equipment ────────────────────────────────────────────────────────────────

function EquipmentBlock({ enclosure, equipment }: { enclosure: PetEnclosure; equipment: EquipItem[] }) {
  const router = useRouter();
  const { showToast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [replaceBy, setReplaceBy] = useState("");

  function persist(list: EquipItem[]) {
    startTransition(async () => {
      try { await updateEnclosure(enclosure.id, { equipment: list }); router.refresh(); }
      catch (e) { showToast(e instanceof Error ? e.message : "Błąd", "error"); }
    });
  }
  function add() {
    if (!name.trim()) return;
    persist([...equipment, { name: name.trim(), replaceBy: replaceBy || null }]);
    setName(""); setReplaceBy(""); setOpen(false);
  }
  function remove(i: number) { persist(equipment.filter((_, idx) => idx !== i)); }

  const now = Date.now();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <SectionTitle title="Sprzęt" action={
        <button onClick={() => setOpen(true)} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: "var(--accent-orange)", background: "none", border: "none", cursor: "pointer" }}><Plus size={14} /> Dodaj</button>
      } />
      {equipment.length === 0 ? (
        <p style={{ fontSize: 12, color: "var(--text-muted)", margin: 0 }}>Brak sprzętu (grzałka, filtr, żarówka UVB…).</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {equipment.map((eq, i) => {
            const overdue = eq.replaceBy ? new Date(eq.replaceBy).getTime() < now : false;
            return (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderRadius: 8, border: `1px solid ${overdue ? "var(--accent-red)" : "var(--border)"}`, background: "var(--bg-surface)" }}>
                <Wrench size={14} style={{ color: overdue ? "var(--accent-red)" : "var(--text-muted)", flexShrink: 0 }} />
                <span style={{ flex: 1, fontSize: 13, color: "var(--text-primary)" }}>{eq.name}</span>
                {eq.replaceBy && (
                  <span style={{ fontSize: 11, color: overdue ? "var(--accent-red)" : "var(--text-muted)", display: "flex", alignItems: "center", gap: 3 }}>
                    {overdue && <AlertTriangle size={11} />} wymień: {formatDate(eq.replaceBy)}
                  </span>
                )}
                <button onClick={() => remove(i)} disabled={isPending} style={iconBtn}><Trash2 size={13} /></button>
              </div>
            );
          })}
        </div>
      )}

      {open && (
        <Modal title="Dodaj sprzęt" onClose={() => setOpen(false)}
          footer={<><GhostButton onClick={() => setOpen(false)}>Anuluj</GhostButton><PrimaryButton onClick={add} disabled={isPending}>Dodaj</PrimaryButton></>}>
          <Field label="Nazwa *"><input autoFocus style={inputStyle} value={name} onChange={(e) => setName(e.target.value)} placeholder="np. Żarówka UVB 10.0" /></Field>
          <Field label="Wymień do (opcjonalnie)"><input type="date" style={inputStyle} value={replaceBy} onChange={(e) => setReplaceBy(e.target.value)} /></Field>
        </Modal>
      )}
    </div>
  );
}

// ── History ──────────────────────────────────────────────────────────────────

function ReadingsHistory({ enclosure, group, ranges }: { enclosure: PetEnclosure & { readings: PetEnvironmentReading[] }; group: EnvGroup; ranges: Record<string, Range> }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const params = paramsForGroup(group);
  const readings = enclosure.readings.slice(0, 12);

  function del(id: string) { startTransition(async () => { await deleteEnvironmentReading(id); router.refresh(); }); }

  if (readings.length === 0) return null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <SectionTitle title="Historia pomiarów" />
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {readings.map((r) => (
          <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-surface)" }}>
            <span style={{ fontSize: 11, color: "var(--text-muted)", width: 64, flexShrink: 0 }}>{formatDate(r.measuredAt)}</span>
            <div style={{ flex: 1, display: "flex", flexWrap: "wrap", gap: 8 }}>
              {params.map((p) => {
                const v = (r as unknown as Record<string, number | null>)[p.key];
                if (v == null) return null;
                const status = classifyValue(p.key, v, ranges);
                return <span key={p.key} style={{ fontSize: 12, color: STATUS_COLOR[status] }}>{p.label.split(" ")[0]}: {v.toFixed(p.decimals)}{p.unit}</span>;
              })}
            </div>
            <button onClick={() => del(r.id)} disabled={isPending} style={iconBtn}><Trash2 size={12} /></button>
          </div>
        ))}
      </div>
    </div>
  );
}

const iconBtn: React.CSSProperties = {
  flexShrink: 0, width: 28, height: 28, borderRadius: 6, border: "1px solid var(--border)",
  background: "var(--bg-elevated)", color: "var(--text-muted)", cursor: "pointer",
  display: "flex", alignItems: "center", justifyContent: "center",
};
