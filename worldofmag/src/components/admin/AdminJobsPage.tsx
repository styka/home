"use client";

// Z-131 (T-17) — panel obserwowalności kolejki zadań. Podgląd stanu (liczniki, typy,
// najwięksi „konsumenci"), lista ostatnich zadań, ręczny retry/anulowanie i sprzątanie.

import { useState, useTransition, useCallback } from "react";
import Link from "next/link";
import { ChevronLeft, ListChecks, RefreshCw, RotateCcw, XCircle, Trash2, Loader2 } from "lucide-react";
import {
  getJobsOverview,
  retryJobAction,
  cancelJobAction,
  cleanupJobsAction,
  type JobsOverview,
  type JobRow,
} from "@/actions/jobs";
import { useToast } from "@/components/ui/Toast";

type JobStatus = "QUEUED" | "RUNNING" | "DONE" | "FAILED" | "CANCELLED";

const STATUS_META: Record<JobStatus, { label: string; color: string }> = {
  QUEUED: { label: "W kolejce", color: "var(--accent-blue)" },
  RUNNING: { label: "W toku", color: "var(--accent-amber)" },
  DONE: { label: "Gotowe", color: "var(--accent-green)" },
  FAILED: { label: "Błąd", color: "var(--accent-red)" },
  CANCELLED: { label: "Anulowane", color: "var(--text-muted)" },
};

const FILTERS: Array<JobStatus | "ALL"> = ["ALL", "QUEUED", "RUNNING", "FAILED", "DONE", "CANCELLED"];

function fmt(iso: string) {
  return iso.slice(0, 19).replace("T", " ");
}

export function AdminJobsPage({ initial }: { initial: JobsOverview }) {
  const { showToast } = useToast();
  const [data, setData] = useState<JobsOverview>(initial);
  const [filter, setFilter] = useState<JobStatus | "ALL">("ALL");
  const [refreshing, setRefreshing] = useState(false);
  const [pending, startTransition] = useTransition();

  const reload = useCallback(
    async (f: JobStatus | "ALL" = filter) => {
      setRefreshing(true);
      try {
        setData(await getJobsOverview(f));
      } catch {
        showToast("Nie udało się odświeżyć", "error");
      } finally {
        setRefreshing(false);
      }
    },
    [filter, showToast]
  );

  function selectFilter(f: JobStatus | "ALL") {
    setFilter(f);
    reload(f);
  }

  function retry(id: string) {
    startTransition(async () => {
      const res = await retryJobAction(id);
      showToast(res.ok ? "Ponowiono zadanie" : res.message ?? "Błąd", res.ok ? "success" : "error");
      if (res.ok) reload();
    });
  }

  function cancel(id: string) {
    startTransition(async () => {
      const res = await cancelJobAction(id);
      showToast(res.ok ? "Anulowano zadanie" : res.message ?? "Błąd", res.ok ? "success" : "error");
      if (res.ok) reload();
    });
  }

  function cleanup() {
    if (!confirm("Usunąć zakończone zadania starsze niż 24h?")) return;
    startTransition(async () => {
      const n = await cleanupJobsAction(24);
      showToast(`Usunięto ${n} zadań`, "success");
      reload();
    });
  }

  const c = data.counts;

  return (
    <div className="flex-1 overflow-y-auto" style={{ backgroundColor: "var(--bg-base)", padding: "32px 24px" }}>
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        <Link href="/admin" style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12, color: "var(--text-muted)", textDecoration: "none", marginBottom: 20 }}>
          <ChevronLeft size={14} /> Admin
        </Link>

        <div className="flex items-center justify-between mb-1 flex-wrap gap-2">
          <div className="flex items-center gap-3">
            <ListChecks size={20} style={{ color: "var(--accent-blue)" }} />
            <h1 style={{ fontSize: 18, fontWeight: 600, color: "var(--text-primary)", margin: 0 }}>Kolejka zadań</h1>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => reload()} disabled={refreshing} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs border disabled:opacity-50" style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}>
              {refreshing ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />} Odśwież
            </button>
            <button type="button" onClick={cleanup} disabled={pending} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs border disabled:opacity-50" style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}>
              <Trash2 size={13} /> Sprzątnij 24h+
            </button>
          </div>
        </div>
        <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 18 }}>
          Zadania w tle (OCR, generowanie, wnioski AI). Zawieszone „W toku” po ~2 min są automatycznie odzyskiwane; tu możesz też ręcznie ponowić błędne.
        </p>

        {/* Liczniki wg statusu */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: 10, marginBottom: 20 }}>
          {(Object.keys(STATUS_META) as JobStatus[]).map((s) => (
            <div key={s} style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 10, padding: "12px 14px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                <span style={{ width: 8, height: 8, borderRadius: 99, background: STATUS_META[s].color, display: "inline-block" }} />
                <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{STATUS_META[s].label}</span>
              </div>
              <div style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)", fontFamily: "monospace" }}>{c[s].toLocaleString("pl-PL")}</div>
            </div>
          ))}
        </div>

        {/* Aktywne wg typu + najwięksi konsumenci */}
        {(data.byType.length > 0 || data.topOwners.length > 0) && (
          <div className="grid sm:grid-cols-2 gap-4 mb-6">
            {data.byType.length > 0 && (
              <section>
                <h2 style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 8 }}>Aktywne wg typu</h2>
                <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden" }}>
                  {data.byType.map((t, i) => (
                    <div key={t.type} className="flex items-center justify-between" style={{ padding: "8px 12px", borderBottom: i < data.byType.length - 1 ? "1px solid var(--border)" : undefined }}>
                      <span style={{ fontSize: 12, color: "var(--text-secondary)", fontFamily: "monospace" }}>{t.type}</span>
                      <span style={{ fontSize: 13, color: "var(--text-primary)", fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{t.active}</span>
                    </div>
                  ))}
                </div>
              </section>
            )}
            {data.topOwners.length > 0 && (
              <section>
                <h2 style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 8 }}>Najwięcej aktywnych (per user)</h2>
                <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden" }}>
                  {data.topOwners.map((o, i) => (
                    <div key={o.email} className="flex items-center justify-between gap-2" style={{ padding: "8px 12px", borderBottom: i < data.topOwners.length - 1 ? "1px solid var(--border)" : undefined }}>
                      <span className="truncate" style={{ fontSize: 12, color: "var(--text-secondary)" }}>{o.email}</span>
                      <span style={{ fontSize: 13, color: o.active >= 20 ? "var(--accent-red)" : "var(--text-primary)", fontWeight: 600, fontVariantNumeric: "tabular-nums", flexShrink: 0 }}>{o.active}</span>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}

        {/* Filtr statusu */}
        <div className="flex items-center gap-1.5 flex-wrap mb-3">
          {FILTERS.map((f) => (
            <button key={f} type="button" onClick={() => selectFilter(f)} className="px-2.5 py-1 rounded text-xs border" style={{ borderColor: filter === f ? "var(--accent-blue)" : "var(--border)", color: filter === f ? "var(--accent-blue)" : "var(--text-secondary)" }}>
              {f === "ALL" ? "Wszystkie" : STATUS_META[f].label}
            </button>
          ))}
        </div>

        {/* Lista ostatnich zadań */}
        {data.recent.length === 0 ? (
          <p style={{ fontSize: 13, color: "var(--text-muted)", padding: "24px 0", textAlign: "center" }}>Brak zadań.</p>
        ) : (
          <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden" }}>
            {data.recent.map((j, i) => (
              <JobRowView key={j.id} job={j} last={i === data.recent.length - 1} pending={pending} onRetry={retry} onCancel={cancel} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function JobRowView({ job, last, pending, onRetry, onCancel }: { job: JobRow; last: boolean; pending: boolean; onRetry: (id: string) => void; onCancel: (id: string) => void }) {
  const meta = STATUS_META[job.status];
  const canRetry = job.status === "FAILED" || job.status === "CANCELLED" || job.status === "DONE";
  const canCancel = job.status === "QUEUED" || job.status === "FAILED";
  return (
    <div style={{ padding: "10px 14px", borderBottom: last ? undefined : "1px solid var(--border)", display: "flex", alignItems: "flex-start", gap: 10 }}>
      <span style={{ width: 8, height: 8, borderRadius: 99, background: meta.color, display: "inline-block", marginTop: 5, flexShrink: 0 }} title={meta.label} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="flex items-center gap-2 flex-wrap">
          <span style={{ fontSize: 13, color: "var(--text-primary)", fontFamily: "monospace" }}>{job.type}</span>
          <span style={{ fontSize: 10, color: meta.color }}>{meta.label}</span>
          <span style={{ fontSize: 11, color: "var(--text-muted)" }}>· próby {job.attempts}/{job.maxAttempts}</span>
        </div>
        <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
          {job.ownerEmail ?? "—"} · {fmt(job.createdAt)}
        </div>
        {job.error && (
          <div style={{ fontSize: 11, color: "var(--accent-red)", marginTop: 3, wordBreak: "break-word" }}>{job.error}</div>
        )}
      </div>
      <div className="flex items-center gap-1 flex-shrink-0">
        {canRetry && (
          <button type="button" onClick={() => onRetry(job.id)} disabled={pending} title="Ponów" className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs border disabled:opacity-50" style={{ borderColor: "var(--border)", color: "var(--accent-blue)" }}>
            <RotateCcw size={12} /> Ponów
          </button>
        )}
        {canCancel && (
          <button type="button" onClick={() => onCancel(job.id)} disabled={pending} title="Anuluj" className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs border disabled:opacity-50" style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}>
            <XCircle size={12} /> Anuluj
          </button>
        )}
      </div>
    </div>
  );
}
