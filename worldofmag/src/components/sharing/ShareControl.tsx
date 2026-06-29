"use client";

// Z-193 (T-10) — ujednolicony „Udostępnij". JEDEN reużywalny komponent czytający mapę
// zdolności (`SHARE_CAPABILITIES`) i renderujący spójnie dostępne mechanizmy. Zastępuje
// rozjechane, per-moduł wejścia (TaskShare/PetShare…). Prezentacyjny — logika dostępu
// zostaje w Server Actions przekazanych jako callbacki (zero zmian semantyki współdzielenia).

import { useState } from "react";
import { Share2, UserMinus } from "lucide-react";
import { getShareCapability, SHARE_MECHANISM_LABELS } from "@/lib/sharing/capabilities";

export interface ShareEntry {
  id: string;
  label: string;
  /** Wartość roli (np. VIEWER/EDITOR) — opcjonalna. */
  role?: string;
}

export interface ShareControlProps {
  /** id modułu (zgodny z mapą zdolności / `src/lib/modules`). */
  module: string;
  /** Istniejące udostępnienia do wyświetlenia. */
  shares: ShareEntry[];
  /** Opcje ról dla udostępnienia per-osoba (kolejność = od najmniejszych uprawnień). */
  roleOptions?: { value: string; label: string }[];
  /** Udostępnij po e-mailu (mechanizm „entity"). Zwraca `{error?}` do pokazania. */
  onShareByEmail?: (email: string, role: string) => Promise<{ error?: string }>;
  /** Usuń udostępnienie. */
  onRemoveShare: (id: string) => void;
  busy?: boolean;
}

const DEFAULT_ROLES = [
  { value: "VIEWER", label: "Widz" },
  { value: "EDITOR", label: "Edytor" },
];

/** Spójny widżet „Udostępnianie" sterowany mapą zdolności modułu. */
export function ShareControl({ module, shares, roleOptions = DEFAULT_ROLES, onShareByEmail, onRemoveShare, busy }: ShareControlProps) {
  const cap = getShareCapability(module);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState(roleOptions[0]?.value ?? "VIEWER");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  // Moduł user-only (poza mapą) — nic do udostępniania.
  if (!cap) return null;

  const canEntity = cap.mechanisms.includes("entity") && !!onShareByEmail;
  const roleLabel = (r?: string) => roleOptions.find((o) => o.value === r)?.label ?? r;

  async function submit() {
    if (!onShareByEmail || !email.trim()) return;
    setError("");
    setPending(true);
    try {
      const res = await onShareByEmail(email.trim(), role);
      if (res.error) setError(res.error);
      else setEmail("");
    } finally {
      setPending(false);
    }
  }

  return (
    <div>
      <div className="flex items-center gap-1.5 mb-2">
        <Share2 size={13} style={{ color: "var(--text-muted)" }} />
        <span className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>Udostępnianie</span>
      </div>

      {/* Istniejące udostępnienia */}
      {shares.length > 0 && (
        <div className="space-y-1 mb-2">
          {shares.map((s) => (
            <div key={s.id} className="flex items-center gap-2">
              <span className="text-xs flex-1" style={{ color: "var(--text-secondary)" }}>
                {s.label}
                {s.role && <span className="ml-1" style={{ color: "var(--text-muted)" }}>({roleLabel(s.role)})</span>}
              </span>
              <button
                onClick={() => onRemoveShare(s.id)}
                disabled={busy}
                className="focus:outline-none hover:opacity-70 disabled:opacity-40"
                style={{ color: "var(--text-muted)" }}
                title="Usuń dostęp"
              >
                <UserMinus size={12} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Dodaj udostępnienie po e-mailu (mechanizm entity) */}
      {canEntity && (
        <div className="flex items-center gap-1.5">
          <input
            value={email}
            onChange={(e) => { setEmail(e.target.value); setError(""); }}
            onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
            placeholder="Email użytkownika…"
            className="flex-1 bg-transparent text-xs focus:outline-none border rounded px-2 py-1"
            style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
          />
          {roleOptions.length > 1 && (
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="bg-transparent text-xs focus:outline-none border rounded px-1 py-1"
              style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
            >
              {roleOptions.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          )}
          <button
            onClick={submit}
            disabled={!email.trim() || pending}
            className="text-xs px-2 py-1 rounded focus:outline-none disabled:opacity-30"
            style={{ backgroundColor: "var(--accent-blue)", color: "var(--on-accent)" }}
          >
            +
          </button>
        </div>
      )}

      {/* Podpowiedź o dostępnych mechanizmach (np. „też przez zespół / projekt") */}
      {cap.mechanisms.length > 1 && (
        <p className="text-[11px] mt-1.5" style={{ color: "var(--text-muted)" }}>
          Dostępne też: {cap.mechanisms.filter((m) => m !== "entity").map((m) => SHARE_MECHANISM_LABELS[m]).join(", ")}.
        </p>
      )}

      {error && <p className="text-xs mt-1" style={{ color: "var(--accent-red)" }}>{error}</p>}
    </div>
  );
}
