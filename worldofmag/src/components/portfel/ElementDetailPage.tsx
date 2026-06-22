"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Wallet, ArrowLeft, Plus, Loader2, Trash2, ArrowUpCircle, ArrowDownCircle, Pencil, Upload } from "lucide-react";
import { LineChart } from "@/components/ui/LineChart";
import { addEntry, setBalance, deleteElement, importBankCsv, type ElementWithEntries } from "@/actions/portfel";
import { ELEMENT_KIND_LABELS, ENTRY_KIND_LABELS, formatMoney } from "@/lib/portfel";
import { pageContainerStyle, pageInnerStyle } from "@/components/ui/home";

export function ElementDetailPage({ element }: { element: ElementWithEntries }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const isDebt = element.kind === "debt";

  const [mode, setMode] = useState<"income" | "expense" | "adjustment">("income");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("");
  const [note, setNote] = useState("");
  const [importMsg, setImportMsg] = useState<string | null>(null);

  // Z-300: import wyciągu CSV (czyta plik po stronie klienta, księguje serwerowo).
  function onCsvFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // pozwól wybrać ten sam plik ponownie
    if (!file) return;
    setImportMsg(null);
    file.text().then((text) => {
      startTransition(async () => {
        try {
          const r = await importBankCsv(element.id, text);
          setImportMsg(`Zaimportowano ${r.imported}, duplikatów ${r.duplicates}, pominięto ${r.skipped}.`);
          router.refresh();
        } catch (err) {
          setImportMsg(err instanceof Error ? err.message : "Błąd importu");
        }
      });
    });
  }

  // Szereg czasowy salda (rosnąco po dacie).
  const asc = [...element.entries].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const series = asc.map((e) => ({
    x: new Date(e.date).getTime(),
    y: e.balanceAfter,
    label: new Date(e.date).toLocaleDateString("pl-PL", { day: "numeric", month: "short", year: "2-digit" }),
  }));

  function submit() {
    const value = parseFloat(amount);
    if (isNaN(value)) return;
    startTransition(async () => {
      if (mode === "adjustment") {
        await setBalance(element.id, { targetBalance: value, note: note.trim() || null });
      } else {
        await addEntry(element.id, { kind: mode, amount: value, category: category.trim() || null, note: note.trim() || null });
      }
      setAmount(""); setCategory(""); setNote("");
    });
  }

  function remove() {
    if (!confirm(`Usunąć element „${element.name}" wraz z historią?`)) return;
    startTransition(async () => { await deleteElement(element.id); router.push("/portfel"); });
  }

  return (
    <div style={pageContainerStyle}>
      <div style={pageInnerStyle}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button onClick={() => router.push("/portfel")} style={iconBtn} title="Wróć do portfela"><ArrowLeft size={18} /></button>
          <Wallet size={22} style={{ color: "var(--accent-green)" }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>{element.name}</h1>
            <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{ELEMENT_KIND_LABELS[element.kind] ?? element.kind}</span>
          </div>
          <span style={{ fontSize: 20, fontWeight: 700, color: isDebt ? "var(--accent-red)" : "var(--text-primary)" }}>{isDebt ? "−" : ""}{formatMoney(element.balance, element.currency)}</span>
          <button onClick={remove} style={{ ...iconBtn, color: "var(--accent-red)" }} title="Usuń element"><Trash2 size={16} /></button>
        </div>

        {series.length >= 2 && (
          <div style={card}>
            <LineChart points={series} color={isDebt ? "var(--accent-red)" : "var(--accent-green)"} height={170} formatY={(y) => formatMoney(y, element.currency)} />
          </div>
        )}

        {/* Dodaj wpis */}
        <div style={card}>
          <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
            {(["income", "expense", "adjustment"] as const).map((m) => (
              <button key={m} onClick={() => setMode(m)} style={{ flex: 1, padding: "7px 0", borderRadius: 7, border: "1px solid var(--border)", background: mode === m ? "var(--bg-elevated)" : "transparent", color: mode === m ? "var(--text-primary)" : "var(--text-muted)", fontSize: 12, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}>
                {m === "income" ? <ArrowUpCircle size={13} /> : m === "expense" ? <ArrowDownCircle size={13} /> : <Pencil size={12} />}
                {ENTRY_KIND_LABELS[m]}
              </button>
            ))}
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <input value={amount} onChange={(e) => setAmount(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()} placeholder={mode === "adjustment" ? "Nowe saldo" : "Kwota"} type="number" step="0.01" style={mini} />
            {mode !== "adjustment" && <input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Kategoria" style={mini} />}
            <input value={note} onChange={(e) => setNote(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()} placeholder="Notatka" style={{ ...mini, flex: 2 }} />
            <button onClick={submit} disabled={isPending} style={{ display: "flex", alignItems: "center", gap: 4, padding: "7px 14px", borderRadius: 7, border: "none", background: "var(--accent-green)", color: "var(--on-accent)", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
              {isPending ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />} Zapisz
            </button>
          </div>
          {/* Z-300: import wyciągu bankowego CSV */}
          <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--text-secondary)", cursor: "pointer" }}>
              <Upload size={13} /> Import CSV z banku
              <input type="file" accept=".csv,text/csv,text/plain" onChange={onCsvFile} disabled={isPending} style={{ display: "none" }} />
            </label>
            {importMsg && <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{importMsg}</span>}
          </div>
        </div>

        {/* Historia */}
        <div style={card}>
          <h2 style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)", margin: "0 0 12px" }}>Historia ({element.entries.length})</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {element.entries.map((e) => (
              <div key={e.id} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, padding: "7px 8px", borderRadius: 6, background: "var(--bg-base)" }}>
                <span style={{ color: "var(--text-muted)", width: 84, flexShrink: 0 }}>{new Date(e.date).toLocaleDateString("pl-PL")}</span>
                <span style={{ width: 72, flexShrink: 0, color: "var(--text-secondary)" }}>{ENTRY_KIND_LABELS[e.kind] ?? e.kind}</span>
                <span style={{ flex: 1, minWidth: 0, color: "var(--text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {[e.category, e.note].filter(Boolean).join(" · ")}
                </span>
                <span style={{ flexShrink: 0, fontWeight: 600, color: e.delta >= 0 ? "var(--accent-green)" : "var(--accent-red)" }}>{e.delta >= 0 ? "+" : ""}{formatMoney(e.delta, element.currency)}</span>
                <span style={{ flexShrink: 0, width: 96, textAlign: "right", color: "var(--text-muted)" }}>{formatMoney(e.balanceAfter, element.currency)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

const card: React.CSSProperties = { padding: 16, borderRadius: 12, border: "1px solid var(--border)", background: "var(--bg-surface)" };
const iconBtn: React.CSSProperties = { display: "flex", alignItems: "center", justifyContent: "center", width: 32, height: 32, borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-surface)", color: "var(--text-secondary)", cursor: "pointer", flexShrink: 0 };
const mini: React.CSSProperties = { flex: 1, minWidth: 100, padding: "7px 10px", borderRadius: 7, border: "1px solid var(--border)", background: "var(--bg-base)", color: "var(--text-primary)", fontSize: 13, outline: "none" };
