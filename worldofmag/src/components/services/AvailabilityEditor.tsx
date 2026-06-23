"use client";

import { useCallback, useEffect, useState } from "react";
import { Check } from "lucide-react";
import { SectionHeading } from "@/components/ui/home";
import { getMyAvailability, setAvailability, getMyStaff } from "@/actions/services/scheduling";
import { WEEKDAY_LABELS, minToLabel, labelToMin } from "@/lib/serviceSlots";
import { fieldInputStyle, primaryButtonStyle } from "./serviceUi";

// Kolejność wyświetlania: poniedziałek…niedziela (weekday: 1..6,0).
const ORDER = [1, 2, 3, 4, 5, 6, 0];

type DayState = { enabled: boolean; start: string; end: string };

/** Edytor dostępności wykonawcy (M2) — M14: per-firma lub per-pracownik. */
export function AvailabilityEditor() {
  const emptyDays = () => {
    const init: Record<number, DayState> = {};
    for (let w = 0; w <= 6; w++) init[w] = { enabled: false, start: "09:00", end: "17:00" };
    return init;
  };
  const [days, setDays] = useState<Record<number, DayState>>(emptyDays);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [staff, setStaff] = useState<{ id: string; name: string }[]>([]);
  const [staffId, setStaffId] = useState<string>(""); // "" = cała firma

  useEffect(() => {
    getMyStaff().then((s) => setStaff(s.filter((x) => x.active).map((x) => ({ id: x.id, name: x.name })))).catch(() => {});
  }, []);

  const load = useCallback((sid: string) => {
    setLoaded(false);
    getMyAvailability(sid || null).then((rules) => {
      const next = emptyDays();
      for (const r of rules) next[r.weekday] = { enabled: true, start: minToLabel(r.startMin), end: minToLabel(r.endMin) };
      setDays(next);
      setLoaded(true);
    }).catch(() => setLoaded(true));
  }, []);

  useEffect(() => { load(staffId); }, [staffId, load]);

  function patch(w: number, p: Partial<DayState>) {
    setDays((prev) => ({ ...prev, [w]: { ...prev[w], ...p } }));
    setMsg(null);
  }

  async function save() {
    const rules = [];
    for (const w of ORDER) {
      const d = days[w];
      if (!d.enabled) continue;
      const s = labelToMin(d.start);
      const e = labelToMin(d.end);
      if (s == null || e == null || s >= e) { setMsg(`Niepoprawne godziny: ${WEEKDAY_LABELS[w]}`); return; }
      rules.push({ weekday: w, startMin: s, endMin: e });
    }
    setBusy(true); setMsg(null);
    try {
      await setAvailability(rules, staffId || null);
      setMsg("Zapisano dostępność");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Błąd zapisu");
    } finally { setBusy(false); }
  }

  return (
    <div>
      <SectionHeading>Dostępność do rezerwacji</SectionHeading>
      <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 8 }}>
        Klienci zarezerwują wolne sloty w tych godzinach dla ofert z włączoną rezerwacją.
      </div>
      {staff.length > 0 && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
          <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>Harmonogram dla:</span>
          <select value={staffId} onChange={(e) => setStaffId(e.target.value)} style={{ ...fieldInputStyle, width: 200 }}>
            <option value="">Cała firma (solo)</option>
            {staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
      )}
      <div style={{ opacity: loaded ? 1 : 0.5 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {ORDER.map((w) => {
          const d = days[w];
          return (
            <div key={w} style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <label style={{ display: "flex", alignItems: "center", gap: 6, width: 130, fontSize: 13, color: "var(--text-secondary)", cursor: "pointer" }}>
                <input type="checkbox" checked={d.enabled} onChange={(e) => patch(w, { enabled: e.target.checked })} />
                {WEEKDAY_LABELS[w]}
              </label>
              <input type="time" value={d.start} disabled={!d.enabled} onChange={(e) => patch(w, { start: e.target.value })} style={{ ...fieldInputStyle, width: 110, opacity: d.enabled ? 1 : 0.4 }} />
              <span style={{ color: "var(--text-muted)" }}>–</span>
              <input type="time" value={d.end} disabled={!d.enabled} onChange={(e) => patch(w, { end: e.target.value })} style={{ ...fieldInputStyle, width: 110, opacity: d.enabled ? 1 : 0.4 }} />
            </div>
          );
        })}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 10 }}>
        <button onClick={save} disabled={busy} style={{ ...primaryButtonStyle, display: "inline-flex", alignItems: "center", gap: 6, opacity: busy ? 0.6 : 1 }}>
          <Check size={15} /> Zapisz dostępność
        </button>
        {msg && <span style={{ fontSize: 12, color: msg.startsWith("Zapisano") ? "var(--accent-green)" : "var(--accent-red)" }}>{msg}</span>}
      </div>
      </div>
    </div>
  );
}
