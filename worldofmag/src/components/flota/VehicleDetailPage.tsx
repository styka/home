"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Car, ArrowLeft, Gauge, Fuel, Wrench, Plus, Loader2, Trash2, CalendarClock, ShieldCheck,
} from "lucide-react";
import { LineChart } from "@/components/ui/LineChart";
import {
  addFuelLog, deleteFuelLog, addServiceRecord, deleteServiceRecord, updateVehicle, deleteVehicle,
  type VehicleWithStats,
} from "@/actions/flota";
import { FUEL_LABELS, SERVICE_LABELS, deadlineStatus, computeConsumption } from "@/lib/flota";
import { pageContainerStyle, pageInnerStyle } from "@/components/ui/home";

export function VehicleDetailPage({ vehicle }: { vehicle: VehicleWithStats }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const cons = computeConsumption(vehicle.fuelLogs);
  const insp = deadlineStatus(vehicle.inspectionDue);
  const ins = deadlineStatus(vehicle.insuranceDue);

  // Formularz tankowania
  const [fOdo, setFOdo] = useState("");
  const [fLiters, setFLiters] = useState("");
  const [fCost, setFCost] = useState("");
  const [fFull, setFFull] = useState(true);

  // Formularz serwisu
  const [sType, setSType] = useState("oil");
  const [sCost, setSCost] = useState("");
  const [sNote, setSNote] = useState("");

  function addFuel() {
    const odometer = parseInt(fOdo);
    const liters = parseFloat(fLiters);
    if (isNaN(odometer) || isNaN(liters)) return;
    startTransition(async () => {
      await addFuelLog(vehicle.id, { odometer, liters, totalCost: fCost ? parseFloat(fCost) : null, full: fFull });
      setFOdo(""); setFLiters(""); setFCost(""); setFFull(true);
    });
  }

  function addService() {
    startTransition(async () => {
      await addServiceRecord(vehicle.id, { type: sType, cost: sCost ? parseFloat(sCost) : null, note: sNote.trim() || null });
      setSCost(""); setSNote("");
    });
  }

  function removeVehicle() {
    if (!confirm(`Usunąć pojazd „${vehicle.name}" wraz z historią?`)) return;
    startTransition(async () => { await deleteVehicle(vehicle.id); router.push("/flota"); });
  }

  function saveDeadline(field: "inspectionDue" | "insuranceDue", value: string) {
    startTransition(async () => { await updateVehicle(vehicle.id, { [field]: value ? new Date(value) : null }); });
  }

  return (
    <div style={pageContainerStyle}>
      <div style={pageInnerStyle}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button onClick={() => router.push("/flota")} style={iconBtn} title="Wróć do floty"><ArrowLeft size={18} /></button>
          <Car size={22} style={{ color: "var(--accent-blue)" }} />
          <h1 style={{ flex: 1, fontSize: 22, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>{vehicle.name}</h1>
          <button onClick={removeVehicle} style={{ ...iconBtn, color: "var(--accent-red)" }} title="Usuń pojazd"><Trash2 size={16} /></button>
        </div>

        {/* Przegląd / dane */}
        <div style={card}>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap", fontSize: 13, color: "var(--text-secondary)" }}>
            {(vehicle.make || vehicle.model) && <span>{[vehicle.make, vehicle.model].filter(Boolean).join(" ")}{vehicle.year ? ` · ${vehicle.year}` : ""}</span>}
            {vehicle.plate && <span>Nr rej.: {vehicle.plate}</span>}
            <span style={{ display: "flex", alignItems: "center", gap: 4 }}><Gauge size={13} /> {vehicle.odometer.toLocaleString("pl-PL")} km</span>
            <span><Fuel size={12} style={{ display: "inline", marginRight: 3 }} />{FUEL_LABELS[vehicle.fuelType] ?? vehicle.fuelType}</span>
          </div>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginTop: 12 }}>
            <label style={dlLabel}>
              <span style={{ display: "flex", alignItems: "center", gap: 4 }}><CalendarClock size={12} /> Przegląd {insp && <em style={{ color: insp.color, fontStyle: "normal" }}>· {insp.text}</em>}</span>
              <input type="date" defaultValue={vehicle.inspectionDue ? new Date(vehicle.inspectionDue).toISOString().slice(0, 10) : ""} onChange={(e) => saveDeadline("inspectionDue", e.target.value)} style={dateInput} />
            </label>
            <label style={dlLabel}>
              <span style={{ display: "flex", alignItems: "center", gap: 4 }}><ShieldCheck size={12} /> OC/AC {ins && <em style={{ color: ins.color, fontStyle: "normal" }}>· {ins.text}</em>}</span>
              <input type="date" defaultValue={vehicle.insuranceDue ? new Date(vehicle.insuranceDue).toISOString().slice(0, 10) : ""} onChange={(e) => saveDeadline("insuranceDue", e.target.value)} style={dateInput} />
            </label>
          </div>
        </div>

        {/* Tankowania + zużycie */}
        <div style={card}>
          <h2 style={h2}><Fuel size={15} style={{ color: "var(--accent-blue)" }} /> Tankowania
            {cons.avg !== null && <span style={{ marginLeft: "auto", fontSize: 13, color: "var(--accent-green)", fontWeight: 600 }}>śr. {cons.avg} l/100km</span>}
          </h2>
          {cons.points.length >= 1 && (
            <div style={{ marginBottom: 12 }}>
              <LineChart points={cons.points} color="var(--accent-blue)" height={140} formatY={(y) => `${y} l/100km`} />
            </div>
          )}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
            <input value={fOdo} onChange={(e) => setFOdo(e.target.value)} placeholder="Przebieg [km]" type="number" style={mini} />
            <input value={fLiters} onChange={(e) => setFLiters(e.target.value)} placeholder="Litry" type="number" step="0.01" style={mini} />
            <input value={fCost} onChange={(e) => setFCost(e.target.value)} placeholder="Koszt [zł]" type="number" step="0.01" style={mini} />
            <label style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: "var(--text-secondary)" }}>
              <input type="checkbox" checked={fFull} onChange={(e) => setFFull(e.target.checked)} style={{ accentColor: "var(--accent-blue)" }} /> Pełny bak
            </label>
            <button onClick={addFuel} disabled={isPending} style={addBtn}>{isPending ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />} Dodaj</button>
          </div>
          {vehicle.fuelLogs.length === 0 ? (
            <p style={emptyText}>Brak tankowań.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {[...vehicle.fuelLogs].reverse().map((l) => (
                <Row key={l.id} onDelete={() => startTransition(() => deleteFuelLog(l.id))} pending={isPending}>
                  <span style={{ color: "var(--text-muted)", width: 78 }}>{new Date(l.date).toLocaleDateString("pl-PL")}</span>
                  <span style={{ flex: 1 }}>{l.liters} l{l.full ? " (pełny)" : ""} · {l.odometer.toLocaleString("pl-PL")} km</span>
                  {l.totalCost != null && <span style={{ color: "var(--text-secondary)" }}>{l.totalCost.toFixed(2)} zł</span>}
                </Row>
              ))}
            </div>
          )}
        </div>

        {/* Serwisy / opony */}
        <div style={card}>
          <h2 style={h2}><Wrench size={15} style={{ color: "var(--accent-amber)" }} /> Serwis i opony</h2>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
            <select value={sType} onChange={(e) => setSType(e.target.value)} style={mini}>
              {Object.entries(SERVICE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            <input value={sNote} onChange={(e) => setSNote(e.target.value)} placeholder="Opis" style={{ ...mini, flex: 2 }} />
            <input value={sCost} onChange={(e) => setSCost(e.target.value)} placeholder="Koszt [zł]" type="number" step="0.01" style={mini} />
            <button onClick={addService} disabled={isPending} style={addBtn}>{isPending ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />} Dodaj</button>
          </div>
          {vehicle.services.length === 0 ? (
            <p style={emptyText}>Brak wpisów serwisowych.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {vehicle.services.map((s) => (
                <Row key={s.id} onDelete={() => startTransition(() => deleteServiceRecord(s.id))} pending={isPending}>
                  <span style={{ color: "var(--text-muted)", width: 78 }}>{new Date(s.date).toLocaleDateString("pl-PL")}</span>
                  <span style={{ width: 80, color: "var(--accent-amber)" }}>{SERVICE_LABELS[s.type] ?? s.type}</span>
                  <span style={{ flex: 1 }}>{s.note}</span>
                  {s.cost != null && <span style={{ color: "var(--text-secondary)" }}>{s.cost.toFixed(2)} zł</span>}
                </Row>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ children, onDelete, pending }: { children: React.ReactNode; onDelete: () => void; pending: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, color: "var(--text-primary)", padding: "6px 8px", borderRadius: 6, background: "var(--bg-base)" }}>
      {children}
      <button onClick={onDelete} disabled={pending} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", display: "flex" }} title="Usuń"><Trash2 size={13} /></button>
    </div>
  );
}

const card: React.CSSProperties = { padding: 16, borderRadius: 12, border: "1px solid var(--border)", background: "var(--bg-surface)" };
const h2: React.CSSProperties = { display: "flex", alignItems: "center", gap: 6, fontSize: 15, fontWeight: 600, color: "var(--text-primary)", margin: "0 0 12px" };
const iconBtn: React.CSSProperties = { display: "flex", alignItems: "center", justifyContent: "center", width: 32, height: 32, borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-surface)", color: "var(--text-secondary)", cursor: "pointer" };
const mini: React.CSSProperties = { flex: 1, minWidth: 90, padding: "7px 10px", borderRadius: 7, border: "1px solid var(--border)", background: "var(--bg-base)", color: "var(--text-primary)", fontSize: 13, outline: "none" };
const addBtn: React.CSSProperties = { display: "flex", alignItems: "center", gap: 4, padding: "7px 12px", borderRadius: 7, border: "none", background: "var(--accent-blue)", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer" };
const emptyText: React.CSSProperties = { fontSize: 13, color: "var(--text-muted)", margin: 0 };
const dlLabel: React.CSSProperties = { display: "flex", flexDirection: "column", gap: 4, fontSize: 12, color: "var(--text-secondary)" };
const dateInput: React.CSSProperties = { padding: "6px 8px", borderRadius: 7, border: "1px solid var(--border)", background: "var(--bg-base)", color: "var(--text-primary)", fontSize: 13, outline: "none" };
