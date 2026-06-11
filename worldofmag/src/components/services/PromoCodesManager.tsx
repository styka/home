"use client";

import { useEffect, useState, useTransition } from "react";
import { Tag, Plus, Trash2, Loader2 } from "lucide-react";
import { SectionHeading } from "@/components/ui/home";
import { getMyPromoCodes, createPromoCode, togglePromoCode, deletePromoCode } from "@/actions/services";
import type { ServicePromoCodeDTO, PromoKind } from "@/lib/services";
import { fieldInputStyle, primaryButtonStyle } from "./serviceUi";

export function PromoCodesManager() {
  const [codes, setCodes] = useState<ServicePromoCodeDTO[] | null>(null);
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [kind, setKind] = useState<PromoKind>("percent");
  const [value, setValue] = useState("");
  const [maxUses, setMaxUses] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  async function reload() { setCodes(await getMyPromoCodes().catch(() => [])); }
  useEffect(() => { reload(); }, []);

  function add() {
    if (!code.trim() || !value) return;
    setErr(null);
    startTransition(async () => {
      try {
        await createPromoCode({
          code: code.trim(),
          kind,
          value: parseFloat(value.replace(",", ".")),
          maxUses: maxUses ? parseInt(maxUses, 10) : null,
          expiresAt: expiresAt || null,
        });
        setCode(""); setValue(""); setMaxUses(""); setExpiresAt(""); setOpen(false);
        await reload();
      } catch (e) { setErr(e instanceof Error ? e.message : "Błąd"); }
    });
  }

  function fmtValue(c: ServicePromoCodeDTO): string {
    return c.kind === "percent" ? `−${c.value}%` : `−${(c.value / 100).toFixed(2)} zł`;
  }

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <SectionHeading>Kody rabatowe</SectionHeading>
        <button onClick={() => setOpen((v) => !v)} style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, padding: "4px 10px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-surface)", color: "var(--accent-purple)", cursor: "pointer" }}>
          <Plus size={13} /> Nowy kod
        </button>
      </div>

      {open && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center", padding: 10, borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-surface)", marginBottom: 8 }}>
          <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="KOD" style={{ ...fieldInputStyle, width: 110, textTransform: "uppercase" }} />
          <select value={kind} onChange={(e) => setKind(e.target.value as PromoKind)} style={{ ...fieldInputStyle, width: 110 }}>
            <option value="percent">Procent (%)</option>
            <option value="amount">Kwota (zł)</option>
          </select>
          <input value={value} onChange={(e) => setValue(e.target.value)} inputMode="decimal" placeholder={kind === "percent" ? "1–100" : "zł"} style={{ ...fieldInputStyle, width: 80 }} />
          <input value={maxUses} onChange={(e) => setMaxUses(e.target.value)} inputMode="numeric" placeholder="limit (opc.)" style={{ ...fieldInputStyle, width: 100 }} />
          <input value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} type="date" title="Wygasa (opc.)" style={{ ...fieldInputStyle, width: 140 }} />
          <button onClick={add} disabled={pending || !code.trim() || !value} style={primaryButtonStyle}>
            {pending ? <Loader2 size={13} className="animate-spin" /> : "Dodaj"}
          </button>
          {err && <span style={{ color: "var(--accent-red)", fontSize: 11 }}>{err}</span>}
        </div>
      )}

      {codes === null ? (
        <Loader2 size={14} className="animate-spin" style={{ color: "var(--text-muted)" }} />
      ) : codes.length === 0 ? (
        <p style={{ fontSize: 12, color: "var(--text-muted)" }}>Brak kodów. Dodaj kod, by oferować klientom zniżki.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {codes.map((c) => {
            const expired = c.expiresAt && new Date(c.expiresAt) < new Date();
            const exhausted = c.maxUses != null && c.usedCount >= c.maxUses;
            return (
              <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-surface)", opacity: c.active && !expired && !exhausted ? 1 : 0.55 }}>
                <Tag size={13} style={{ color: "var(--accent-purple)", flexShrink: 0 }} />
                <strong style={{ fontSize: 13, color: "var(--text-primary)" }}>{c.code}</strong>
                <span style={{ fontSize: 12, color: "var(--accent-green)", fontWeight: 600 }}>{fmtValue(c)}</span>
                <span style={{ fontSize: 11, color: "var(--text-muted)", flex: 1 }}>
                  {c.usedCount}{c.maxUses != null ? `/${c.maxUses}` : ""} użyć
                  {expired ? " · wygasł" : exhausted ? " · limit" : ""}
                  {c.expiresAt && !expired ? ` · do ${new Date(c.expiresAt).toLocaleDateString("pl-PL", { day: "2-digit", month: "short" })}` : ""}
                </span>
                <button onClick={() => startTransition(async () => { await togglePromoCode(c.id); await reload(); })} style={{ fontSize: 11, padding: "2px 8px", borderRadius: 6, border: "1px solid var(--border)", background: "transparent", color: "var(--text-secondary)", cursor: "pointer" }}>
                  {c.active ? "Wyłącz" : "Włącz"}
                </button>
                <button onClick={() => startTransition(async () => { await deletePromoCode(c.id); await reload(); })} title="Usuń" style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer" }}>
                  <Trash2 size={13} />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
