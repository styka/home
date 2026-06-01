"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ClipboardList, ArrowLeft, Star, X } from "lucide-react";
import { PageHeader, EmptyState, pageContainerStyle, pageInnerStyle, cardStyle } from "@/components/ui/home";
import { cancelMyRequest, addReview } from "@/actions/services";
import type { RequestDTO } from "@/lib/services";
import { StatusBadge, fieldInputStyle, fieldLabelStyle, primaryButtonStyle, secondaryButtonStyle } from "./serviceUi";

type Tab = "client" | "provider";

export function MyRequestsPage({ asClient, asProvider }: { asClient: RequestDTO[]; asProvider: RequestDTO[] }) {
  const [tab, setTab] = useState<Tab>("client");
  const router = useRouter();
  const list = tab === "client" ? asClient : asProvider;

  return (
    <div style={pageContainerStyle}>
      <div style={pageInnerStyle}>
        <Link href="/services" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--text-muted)", textDecoration: "none" }}>
          <ArrowLeft size={15} /> Wszystkie usługi
        </Link>

        <PageHeader icon={<ClipboardList size={22} />} iconColor="var(--accent-blue)" title="Moje zlecenia" subtitle="Zlecenia złożone i przyjęte" />

        {/* Zakładki */}
        <div style={{ display: "flex", gap: 4, borderBottom: "1px solid var(--border)" }}>
          <TabButton active={tab === "client"} onClick={() => setTab("client")} label={`Jako klient (${asClient.length})`} />
          <TabButton active={tab === "provider"} onClick={() => setTab("provider")} label={`Jako wykonawca (${asProvider.length})`} />
        </div>

        {list.length === 0 ? (
          <EmptyState
            icon={<ClipboardList size={28} />}
            message={tab === "client" ? "Nie złożyłeś jeszcze żadnych zleceń" : "Nie masz jeszcze przyjętych zleceń"}
            hint={tab === "client" ? "Przeglądaj usługi i zamów pierwszą." : "Zlecenia od klientów pojawią się tutaj."}
            cta={tab === "client" ? { label: "Przeglądaj usługi", href: "/services" } : undefined}
          />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {list.map((r) => (
              <RequestCard key={r.id} request={r} role={tab} onChange={() => router.refresh()} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function TabButton({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "8px 14px",
        fontSize: 13,
        fontWeight: 600,
        background: "none",
        border: "none",
        cursor: "pointer",
        color: active ? "var(--accent-blue)" : "var(--text-muted)",
        borderBottom: `2px solid ${active ? "var(--accent-blue)" : "transparent"}`,
        marginBottom: -1,
      }}
    >
      {label}
    </button>
  );
}

function RequestCard({ request, role, onChange }: { request: RequestDTO; role: Tab; onChange: () => void }) {
  const [pending, startTransition] = useTransition();
  const [reviewing, setReviewing] = useState(false);

  const canCancel = role === "client" && request.status !== "COMPLETED" && request.status !== "CANCELLED" && request.status !== "DECLINED";
  const canReview = role === "client" && request.status === "COMPLETED" && !request.hasReview;

  return (
    <div style={{ ...cardStyle, cursor: "default", flexDirection: "column", alignItems: "stretch", gap: 8 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", flex: 1 }}>{request.title}</span>
        <StatusBadge status={request.status} />
      </div>
      <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
        {role === "client" ? `Wykonawca: ${request.providerName}` : `Klient: ${request.clientName}`}
      </div>
      {request.description && <div style={{ fontSize: 13, color: "var(--text-secondary)", whiteSpace: "pre-wrap" }}>{request.description}</div>}
      {request.scheduledAt && (
        <div style={{ fontSize: 12, color: "var(--accent-purple)" }}>Umówiono: {new Date(request.scheduledAt).toLocaleString("pl-PL")}</div>
      )}
      {request.hasReview && request.rating != null && (
        <div style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12, color: "var(--accent-amber)" }}>
          <Star size={13} fill="var(--accent-amber)" color="var(--accent-amber)" /> Oceniono: {request.rating}/5
        </div>
      )}

      {reviewing ? (
        <ReviewForm requestId={request.id} onDone={() => { setReviewing(false); onChange(); }} onCancel={() => setReviewing(false)} />
      ) : (
        (canCancel || canReview) && (
          <div style={{ display: "flex", gap: 8 }}>
            {canReview && (
              <button onClick={() => setReviewing(true)} style={{ ...primaryButtonStyle, display: "inline-flex", alignItems: "center", gap: 6 }}>
                <Star size={14} /> Oceń
              </button>
            )}
            {canCancel && (
              <button
                disabled={pending}
                onClick={() => startTransition(async () => { await cancelMyRequest(request.id); onChange(); })}
                style={{ ...secondaryButtonStyle, color: "var(--accent-red)" }}
              >
                Anuluj zlecenie
              </button>
            )}
          </div>
        )
      )}
    </div>
  );
}

function ReviewForm({ requestId, onDone, onCancel }: { requestId: string; onDone: () => void; onCancel: () => void }) {
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await addReview(requestId, rating, comment.trim() || undefined);
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nie udało się zapisać oceny");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 10, paddingTop: 8, borderTop: "1px solid var(--border)" }}>
      <div>
        <label style={fieldLabelStyle}>Ocena</label>
        <div style={{ display: "flex", gap: 4 }}>
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setRating(n)}
              style={{ background: "none", border: "none", cursor: "pointer", padding: 2 }}
              aria-label={`${n} gwiazdek`}
            >
              <Star size={22} fill={n <= rating ? "var(--accent-amber)" : "none"} color="var(--accent-amber)" />
            </button>
          ))}
        </div>
      </div>
      <div>
        <label style={fieldLabelStyle}>Komentarz (opcjonalnie)</label>
        <textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={2} style={{ ...fieldInputStyle, resize: "vertical" }} />
      </div>
      {error && <div style={{ fontSize: 12, color: "var(--accent-red)" }}>{error}</div>}
      <div style={{ display: "flex", gap: 8 }}>
        <button type="submit" disabled={busy} style={{ ...primaryButtonStyle, opacity: busy ? 0.6 : 1 }}>Wyślij ocenę</button>
        <button type="button" onClick={onCancel} style={secondaryButtonStyle}><X size={15} /></button>
      </div>
    </form>
  );
}
