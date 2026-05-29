"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Car, Plus, Loader2, ChevronRight, Gauge, CalendarClock, ShieldCheck, AlertTriangle, Users } from "lucide-react";
import { PageHeader, SectionHeading, EmptyState, pageContainerStyle, pageInnerStyle } from "@/components/ui/home";
import { createVehicle, type VehicleWithStats } from "@/actions/flota";
import { FUEL_LABELS, deadlineStatus } from "@/lib/flota";

interface Props {
  vehicles: VehicleWithStats[];
  teams: { id: string; name: string }[];
}

export function FlotaHomePage({ vehicles, teams }: Props) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [plate, setPlate] = useState("");
  const [fuelType, setFuelType] = useState("petrol");
  const [ownerTeamId, setOwnerTeamId] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleCreate() {
    if (!name.trim()) return;
    startTransition(async () => {
      await createVehicle({ name: name.trim(), plate: plate.trim() || null, fuelType, ownerTeamId: ownerTeamId || null });
      setName(""); setPlate(""); setFuelType("petrol"); setOwnerTeamId(""); setAdding(false);
    });
  }

  return (
    <div style={pageContainerStyle}>
      <div style={pageInnerStyle}>
        <PageHeader
          icon={<Car size={22} />}
          iconColor="var(--accent-blue)"
          title="Flota"
          href="/flota"
          subtitle={vehicles.length > 0 ? `${vehicles.length} pojazdów` : "Dodaj pierwszy pojazd"}
          action={
            <button
              onClick={() => setAdding((v) => !v)}
              style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 12px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-surface)", color: "var(--text-secondary)", fontSize: 13, cursor: "pointer" }}
            >
              <Plus size={13} /> Nowy pojazd
            </button>
          }
        />

        {adding && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, padding: 12, borderRadius: 10, border: "1px solid var(--border)", background: "var(--bg-surface)" }}>
            <input autoFocus value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleCreate()} placeholder="Nazwa (np. Octavia)" style={inputStyle} />
            <input value={plate} onChange={(e) => setPlate(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleCreate()} placeholder="Nr rej." style={{ ...inputStyle, maxWidth: 120 }} />
            <select value={fuelType} onChange={(e) => setFuelType(e.target.value)} style={{ ...inputStyle, maxWidth: 140 }}>
              {Object.entries(FUEL_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            {teams.length > 0 && (
              <select value={ownerTeamId} onChange={(e) => setOwnerTeamId(e.target.value)} style={{ ...inputStyle, maxWidth: 160 }}>
                <option value="">Mój (prywatny)</option>
                {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            )}
            <button onClick={handleCreate} disabled={isPending || !name.trim()} style={{ padding: "8px 14px", borderRadius: 8, border: "none", background: "var(--accent-blue)", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}>
              {isPending ? <Loader2 size={13} className="animate-spin" /> : null} Dodaj
            </button>
            <button onClick={() => setAdding(false)} style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border)", background: "transparent", color: "var(--text-secondary)", fontSize: 13, cursor: "pointer" }}>Anuluj</button>
          </div>
        )}

        <div>
          <SectionHeading>Pojazdy</SectionHeading>
          {vehicles.length === 0 ? (
            <EmptyState icon={<Car size={28} />} message="Brak pojazdów" hint="Dodaj pojazd, by śledzić przeglądy, OC, serwisy i zużycie paliwa" cta={{ label: "+ Nowy pojazd", onClick: () => setAdding(true), color: "var(--accent-blue)" }} />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {vehicles.map((v) => <VehicleCard key={v.id} v={v} />)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function VehicleCard({ v }: { v: VehicleWithStats }) {
  const insp = deadlineStatus(v.inspectionDue);
  const ins = deadlineStatus(v.insuranceDue);
  return (
    <Link href={`/flota/${v.id}`} style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--bg-surface)", textDecoration: "none" }}>
      <Car size={18} style={{ color: "var(--accent-blue)", flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>{v.name}</span>
          {v.plate && <span style={{ fontSize: 11, color: "var(--text-muted)", border: "1px solid var(--border)", borderRadius: 4, padding: "0 5px" }}>{v.plate}</span>}
          {v.ownerTeamId && <Users size={11} style={{ color: "var(--accent-purple)" }} />}
        </div>
        <div style={{ display: "flex", gap: 12, marginTop: 3, fontSize: 11, color: "var(--text-muted)", flexWrap: "wrap" }}>
          {(v.make || v.model) && <span>{[v.make, v.model].filter(Boolean).join(" ")}</span>}
          <span style={{ display: "flex", alignItems: "center", gap: 3 }}><Gauge size={11} /> {v.odometer.toLocaleString("pl-PL")} km</span>
          <span>{FUEL_LABELS[v.fuelType] ?? v.fuelType}</span>
        </div>
        <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
          {insp && <DeadlineBadge icon={<CalendarClock size={10} />} label="Przegląd" status={insp} />}
          {ins && <DeadlineBadge icon={<ShieldCheck size={10} />} label="OC" status={ins} />}
        </div>
      </div>
      <ChevronRight size={14} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
    </Link>
  );
}

function DeadlineBadge({ icon, label, status }: { icon: React.ReactNode; label: string; status: ReturnType<typeof deadlineStatus> }) {
  if (!status) return null;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 10, padding: "1px 6px", borderRadius: 999, color: status.color, background: status.bg, border: `1px solid ${status.color}33` }}>
      {status.overdue ? <AlertTriangle size={10} /> : icon}
      {label}: {status.text}
    </span>
  );
}

const inputStyle: React.CSSProperties = {
  flex: 1, minWidth: 120, padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-base)", color: "var(--text-primary)", fontSize: 14, outline: "none",
};
