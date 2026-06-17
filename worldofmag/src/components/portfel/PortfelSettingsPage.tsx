"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Settings, ChevronLeft, Loader2, Check, Coins, Trash2, RefreshCw, Plus } from "lucide-react";
import { PageHeader, pageContainerStyle, pageInnerStyle } from "@/components/ui/home";
import { setFinanceSettings, type FinanceSettingsDTO } from "@/actions/portfelAuto";
import { FinanceAiAccessToggle } from "./FinanceAiAccessToggle";
import {
  setBaseCurrency, setExchangeRate, deleteExchangeRate, refreshRatesFromNBP,
  type ExchangeRateDTO,
} from "@/actions/portfelCurrency";

interface Props {
  accounts: { id: string; name: string }[];
  settings: FinanceSettingsDTO;
  currency: { baseCurrency: string; rates: ExchangeRateDTO[] };
}

export function PortfelSettingsPage({ accounts, settings, currency }: Props) {
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

        <div style={{ borderTop: "1px solid var(--border)", paddingTop: 14 }}>
          <h2 style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)", margin: "0 0 8px" }}>Prywatność i AI</h2>
          <FinanceAiAccessToggle />
        </div>

        <CurrencySection baseCurrency={currency.baseCurrency} rates={currency.rates} />
      </div>
    </div>
  );
}

function CurrencySection({ baseCurrency, rates }: { baseCurrency: string; rates: ExchangeRateDTO[] }) {
  const [base, setBase] = useState(baseCurrency);
  const [newCur, setNewCur] = useState("");
  const [newRate, setNewRate] = useState("");
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [pending, startTransition] = useTransition();

  function saveBase(v: string) {
    const c = v.trim().toUpperCase();
    setBase(c);
    if (!c) return;
    startTransition(async () => { await setBaseCurrency(c); });
  }

  function addRate() {
    const c = newCur.trim().toUpperCase();
    const r = parseFloat(newRate);
    if (!c || !r) return;
    startTransition(async () => {
      await setExchangeRate(c, r);
      setNewCur(""); setNewRate("");
    });
  }

  function refresh() {
    setMsg(null);
    startTransition(async () => {
      try {
        const res = await refreshRatesFromNBP();
        setMsg({ text: `Zaktualizowano ${res.updated} kursów z NBP`, ok: true });
      } catch (e) {
        setMsg({ text: e instanceof Error ? e.message : "Błąd pobierania", ok: false });
      }
    });
  }

  return (
    <div style={{ padding: "16px", borderRadius: 12, border: "1px solid var(--border)", background: "var(--bg-surface)", display: "flex", flexDirection: "column", gap: 14 }}>
      <div>
        <h2 style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)", margin: 0, display: "flex", alignItems: "center", gap: 6 }}>
          <Coins size={16} style={{ color: "var(--accent-amber)" }} /> Waluty i kursy
        </h2>
        <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>
          Majątek netto przeliczany jest na <strong>walutę sprawozdawczą</strong>. Dla kont w innych
          walutach ustaw kurs (ile waluty bazowej za 1 jednostkę), ręcznie lub z NBP.
        </p>
      </div>

      <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Waluta sprawozdawcza</span>
        <input
          value={base}
          onChange={(e) => setBase(e.target.value.toUpperCase())}
          onBlur={(e) => saveBase(e.target.value)}
          maxLength={8}
          placeholder="PLN"
          style={{ maxWidth: 120, padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-base)", color: "var(--text-primary)", fontSize: 14, outline: "none", textTransform: "uppercase" }}
        />
      </label>

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Kursy (1 waluta = X {base})</span>
        {rates.filter((r) => r.currency !== base).length === 0 && (
          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Brak kursów — dodaj poniżej lub pobierz z NBP.</span>
        )}
        {rates.filter((r) => r.currency !== base).map((r) => (
          <div key={r.currency} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", width: 50 }}>{r.currency}</span>
            <input
              defaultValue={r.rate}
              type="number" step="0.0001"
              onBlur={(e) => { const v = parseFloat(e.target.value); if (v) startTransition(() => { setExchangeRate(r.currency, v); }); }}
              style={{ width: 120, padding: "6px 10px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-base)", color: "var(--text-primary)", fontSize: 13, outline: "none" }}
            />
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{base} {r.source === "nbp" ? "· NBP" : ""}</span>
            <button onClick={() => startTransition(() => { deleteExchangeRate(r.currency); })} title="Usuń kurs" style={{ background: "transparent", border: "none", color: "var(--text-muted)", cursor: "pointer", marginLeft: "auto" }}>
              <Trash2 size={13} />
            </button>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
        <input value={newCur} onChange={(e) => setNewCur(e.target.value.toUpperCase())} placeholder="np. EUR" maxLength={8} style={{ width: 90, padding: "8px 10px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-base)", color: "var(--text-primary)", fontSize: 13, outline: "none", textTransform: "uppercase" }} />
        <input value={newRate} onChange={(e) => setNewRate(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addRate()} placeholder={`kurs w ${base}`} type="number" step="0.0001" style={{ width: 130, padding: "8px 10px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-base)", color: "var(--text-primary)", fontSize: 13, outline: "none" }} />
        <button onClick={addRate} disabled={pending || !newCur.trim() || !newRate} style={{ display: "flex", alignItems: "center", gap: 4, padding: "8px 12px", borderRadius: 8, border: "none", background: "var(--accent-amber)", color: "var(--on-accent)", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
          <Plus size={13} /> Dodaj
        </button>
        <button onClick={refresh} disabled={pending} style={{ display: "flex", alignItems: "center", gap: 5, padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-base)", color: "var(--text-secondary)", fontSize: 13, cursor: "pointer" }}>
          {pending ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />} Pobierz z NBP
        </button>
      </div>
      {msg && <span style={{ fontSize: 12, color: msg.ok ? "var(--accent-green)" : "var(--accent-red)" }}>{msg.text}</span>}
    </div>
  );
}
