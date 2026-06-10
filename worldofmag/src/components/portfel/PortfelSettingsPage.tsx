"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Settings, ChevronLeft, Loader2, Check } from "lucide-react";
import { PageHeader, pageContainerStyle, pageInnerStyle } from "@/components/ui/home";
import { setFinanceSettings, type FinanceSettingsDTO } from "@/actions/portfelAuto";

interface Props {
  accounts: { id: string; name: string }[];
  settings: FinanceSettingsDTO;
}

export function PortfelSettingsPage({ accounts, settings }: Props) {
  const [enabled, setEnabled] = useState(settings.autoExpenseEnabled);
  const [elementId, setElementId] = useState(settings.autoExpenseElementId ?? "");
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  function save(next: { enabled?: boolean; elementId?: string }) {
    const e = next.enabled ?? enabled;
    const el = next.elementId ?? elementId;
    setSaved(false);
    startTransition(async () => {
      await setFinanceSettings({ autoExpenseEnabled: e, autoExpenseElementId: el || null });
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    });
  }

  return (
    <div style={pageContainerStyle}>
      <div style={pageInnerStyle}>
        <Link href="/portfel" style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12, color: "var(--text-muted)", textDecoration: "none", marginBottom: 4 }}>
          <ChevronLeft size={14} /> Portfel
        </Link>
        <PageHeader
          icon={<Settings size={22} />}
          iconColor="var(--accent-green)"
          title="Ustawienia Portfela"
          href="/portfel/ustawienia"
          subtitle="Automatyczne księgowanie wydatków z innych modułów"
        />

        <div style={{ padding: "16px", borderRadius: 12, border: "1px solid var(--border)", background: "var(--bg-surface)", display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <h2 style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)", margin: 0 }}>Auto-wydatki</h2>
            <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>
              Gdy włączone, koszty z innych modułów (na razie: <strong>tankowania i serwisy z Floty</strong>)
              są automatycznie księgowane jako wydatek na wybranym koncie. Usunięcie rekordu cofa wpis.
            </p>
          </div>

          <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => { setEnabled(e.target.checked); save({ enabled: e.target.checked }); }}
              style={{ width: 18, height: 18 }}
            />
            <span style={{ fontSize: 14, color: "var(--text-primary)" }}>Księguj wydatki automatycznie</span>
          </label>

          <label style={{ display: "flex", flexDirection: "column", gap: 6, opacity: enabled ? 1 : 0.5 }}>
            <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Konto docelowe</span>
            {accounts.length === 0 ? (
              <span style={{ fontSize: 13, color: "var(--accent-amber)" }}>
                Najpierw dodaj element portfela (konto) na stronie Portfela.
              </span>
            ) : (
              <select
                value={elementId}
                onChange={(e) => { setElementId(e.target.value); save({ elementId: e.target.value }); }}
                disabled={!enabled}
                style={{ maxWidth: 280, padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-base)", color: "var(--text-primary)", fontSize: 14, outline: "none" }}
              >
                <option value="">— wybierz konto —</option>
                {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            )}
          </label>

          <div style={{ height: 18, display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
            {pending && <><Loader2 size={13} className="animate-spin" style={{ color: "var(--text-muted)" }} /> <span style={{ color: "var(--text-muted)" }}>Zapisuję…</span></>}
            {!pending && saved && <><Check size={13} style={{ color: "var(--accent-green)" }} /> <span style={{ color: "var(--accent-green)" }}>Zapisano</span></>}
          </div>
        </div>
      </div>
    </div>
  );
}
