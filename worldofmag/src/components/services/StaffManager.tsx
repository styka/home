"use client";

import { useEffect, useState, useTransition } from "react";
import { Users, Plus, Trash2, Loader2 } from "lucide-react";
import { SectionHeading } from "@/components/ui/home";
import { getMyStaff, createStaff, updateStaff, deleteStaff } from "@/actions/services/scheduling";
import { fieldInputStyle, primaryButtonStyle } from "./serviceUi";

type Staff = { id: string; name: string; role: string | null; active: boolean };

export function StaffManager({ onChange }: { onChange?: () => void }) {
  const [staff, setStaff] = useState<Staff[] | null>(null);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  async function reload() { setStaff(await getMyStaff().catch(() => [])); }
  useEffect(() => { reload(); }, []);

  function add() {
    if (!name.trim()) return;
    setErr(null);
    startTransition(async () => {
      try { await createStaff({ name: name.trim(), role: role.trim() || null }); setName(""); setRole(""); setOpen(false); await reload(); onChange?.(); }
      catch (e) { setErr(e instanceof Error ? e.message : "Błąd"); }
    });
  }

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <SectionHeading>Pracownicy</SectionHeading>
        <button onClick={() => setOpen((v) => !v)} style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, padding: "4px 10px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-surface)", color: "var(--accent-purple)", cursor: "pointer" }}>
          <Plus size={13} /> Pracownik
        </button>
      </div>
      <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "0 0 8px" }}>
        Dodaj pracowników, by klienci rezerwowali wizyty u konkretnej osoby. Każdy pracownik ma własny harmonogram dostępności (ustaw go w sekcji „Dostępność").
      </p>

      {open && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center", padding: 10, borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-surface)", marginBottom: 8 }}>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Imię" style={{ ...fieldInputStyle, width: 150 }} />
          <input value={role} onChange={(e) => setRole(e.target.value)} placeholder="Rola (opc.)" style={{ ...fieldInputStyle, width: 150 }} />
          <button onClick={add} disabled={pending || !name.trim()} style={primaryButtonStyle}>{pending ? <Loader2 size={13} className="animate-spin" /> : "Dodaj"}</button>
          {err && <span style={{ color: "var(--accent-red)", fontSize: 11 }}>{err}</span>}
        </div>
      )}

      {staff === null ? (
        <Loader2 size={14} className="animate-spin" style={{ color: "var(--text-muted)" }} />
      ) : staff.length === 0 ? (
        <p style={{ fontSize: 12, color: "var(--text-muted)" }}>Brak pracowników — firma jednoosobowa (rezerwacje na cały profil).</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {staff.map((s) => (
            <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-surface)", opacity: s.active ? 1 : 0.55 }}>
              <Users size={13} style={{ color: "var(--accent-purple)", flexShrink: 0 }} />
              <strong style={{ fontSize: 13, color: "var(--text-primary)" }}>{s.name}</strong>
              {s.role && <span style={{ fontSize: 12, color: "var(--text-muted)" }}>· {s.role}</span>}
              <span style={{ flex: 1 }} />
              <button onClick={() => startTransition(async () => { await updateStaff(s.id, { active: !s.active }); await reload(); onChange?.(); })} style={{ fontSize: 11, padding: "2px 8px", borderRadius: 6, border: "1px solid var(--border)", background: "transparent", color: "var(--text-secondary)", cursor: "pointer" }}>
                {s.active ? "Wyłącz" : "Włącz"}
              </button>
              <button onClick={() => { if (confirm(`Usunąć pracownika „${s.name}"?`)) startTransition(async () => { await deleteStaff(s.id); await reload(); onChange?.(); }); }} title="Usuń" style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer" }}>
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
