"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { ChevronLeft, ShieldAlert, Check, X, Loader2 } from "lucide-react";
import { PageHeader, EmptyState, pageContainerStyle, pageInnerStyle } from "@/components/ui/home";
import { getModerationDisputes, resolveDispute, type ModerationDisputeDTO } from "@/actions/services";

type Tab = "OPEN" | "RESOLVED" | "REJECTED";

export function ModerationPage({ disputes: initial }: { disputes: ModerationDisputeDTO[] }) {
  const [disputes, setDisputes] = useState(initial);
  const [tab, setTab] = useState<Tab>("OPEN");
  const [pending, startTransition] = useTransition();
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [note, setNote] = useState("");

  function switchTab(t: Tab) {
    setTab(t);
    startTransition(async () => { setDisputes(await getModerationDisputes({ status: t })); });
  }
  function resolve(id: string, status: "RESOLVED" | "REJECTED") {
    startTransition(async () => {
      await resolveDispute(id, status, note.trim() || null);
      setResolvingId(null); setNote("");
      setDisputes(await getModerationDisputes({ status: tab }));
    });
  }

  return (
    <div style={pageContainerStyle}>
      <div style={pageInnerStyle}>
        <Link href="/services" style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12, color: "var(--text-muted)", textDecoration: "none", marginBottom: 4 }}>
          <ChevronLeft size={14} /> Usługi
        </Link>
        <PageHeader icon={<ShieldAlert size={22} />} iconColor="var(--accent-red)" title="Moderacja sporów" href="/services/moderation" subtitle="Zgłoszenia problemów ze zleceniami marketplace" />

        <div style={{ display: "flex", gap: 6 }}>
          {(["OPEN", "RESOLVED", "REJECTED"] as Tab[]).map((t) => (
            <button key={t} onClick={() => switchTab(t)} style={{ padding: "5px 12px", borderRadius: 8, fontSize: 12, cursor: "pointer", border: "1px solid var(--border)", background: tab === t ? "var(--bg-elevated)" : "transparent", color: tab === t ? "var(--text-primary)" : "var(--text-muted)" }}>
              {t === "OPEN" ? "Otwarte" : t === "RESOLVED" ? "Rozwiązane" : "Odrzucone"}
            </button>
          ))}
          {pending && <Loader2 size={14} className="animate-spin" style={{ color: "var(--text-muted)", alignSelf: "center" }} />}
        </div>

        {disputes.length === 0 ? (
          <EmptyState icon={<ShieldAlert size={26} />} message="Brak zgłoszeń" hint="Spory zgłoszone przez klientów lub wykonawców pojawią się tutaj." />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {disputes.map((d) => (
              <div key={d.id} style={{ padding: "12px 14px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--bg-surface)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", flex: 1 }}>{d.reason}</span>
                  <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{new Date(d.createdAt).toLocaleString("pl-PL", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                </div>
                <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
                  Zlecenie: <Link href="/services/requests" style={{ color: "var(--accent-blue)" }}>{d.requestTitle}</Link> · klient {d.clientName ?? "—"} ↔ wykonawca {d.providerName}
                </div>
                {d.description && <p style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 6, whiteSpace: "pre-wrap" }}>{d.description}</p>}
                {d.resolution && <p style={{ fontSize: 12, color: "var(--accent-green)", marginTop: 6 }}>Rozstrzygnięcie: {d.resolution}</p>}

                {d.status === "OPEN" && (
                  resolvingId === d.id ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8 }}>
                      <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Notatka moderatora (opcjonalnie)" style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-base)", color: "var(--text-primary)", fontSize: 13, outline: "none" }} />
                      <div style={{ display: "flex", gap: 6 }}>
                        <button onClick={() => resolve(d.id, "RESOLVED")} disabled={pending} style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "6px 12px", borderRadius: 8, border: "none", background: "var(--accent-green)", color: "var(--on-accent)", fontSize: 13, fontWeight: 600, cursor: "pointer" }}><Check size={14} /> Rozwiąż</button>
                        <button onClick={() => resolve(d.id, "REJECTED")} disabled={pending} style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "6px 12px", borderRadius: 8, border: "1px solid var(--border)", background: "transparent", color: "var(--accent-red)", fontSize: 13, cursor: "pointer" }}><X size={14} /> Odrzuć</button>
                        <button onClick={() => { setResolvingId(null); setNote(""); }} style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid var(--border)", background: "transparent", color: "var(--text-secondary)", fontSize: 13, cursor: "pointer" }}>Anuluj</button>
                      </div>
                    </div>
                  ) : (
                    <button onClick={() => { setResolvingId(d.id); setNote(""); }} style={{ marginTop: 8, fontSize: 12, color: "var(--accent-blue)", background: "none", border: "none", cursor: "pointer", padding: 0 }}>Rozstrzygnij</button>
                  )
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
