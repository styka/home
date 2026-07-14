"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Send, MessageSquare, Tag, Check, X, Wallet, AlertTriangle } from "lucide-react";
import {
  getRequestThread,
  sendServiceMessage,
  sendQuote,
  respondToQuote,
} from "@/actions/services";
import { setServicePayment, markPaymentPaid, bookClientExpense } from "@/actions/services/payments";
import { applyPromoCode, clearPromoCode } from "@/actions/services/promo";
import { getRequestDisputes, openDispute } from "@/actions/services/disputes";
import { getWalletElements } from "@/actions/portfel";
import type { RequestThreadDTO, ServiceQuoteDTO, ServicePaymentDTO, PaymentMethod, ServiceDisputeDTO } from "@/lib/services";
import { QUOTE_STATUS_LABELS, PAYMENT_METHOD_LABELS } from "@/lib/services";
import { fieldInputStyle, fieldLabelStyle, primaryButtonStyle, secondaryButtonStyle } from "./serviceUi";

function money(grosze: number, currency: string): string {
  return `${(grosze / 100).toLocaleString("pl-PL", { minimumFractionDigits: 0, maximumFractionDigits: 2 })} ${currency}`;
}

/** Wątek zlecenia: czat klient↔wykonawca (M1) + wyceny (M3). */
export function RequestThread({ requestId }: { requestId: string }) {
  const [thread, setThread] = useState<RequestThreadDTO | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const bottomRef = useRef<HTMLDivElement>(null);

  const reload = () => getRequestThread(requestId).then(setThread).catch((e) => setError(e instanceof Error ? e.message : "Błąd"));

  useEffect(() => { void reload(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [requestId]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ block: "nearest" }); }, [thread?.messages.length]);

  if (error) return <div style={{ fontSize: 12, color: "var(--accent-red)", paddingTop: 8 }}>{error}</div>;
  if (!thread) return <div style={{ fontSize: 12, color: "var(--text-muted)", paddingTop: 8 }}>Ładowanie wątku…</div>;

  const closed = thread.status === "COMPLETED" || thread.status === "CANCELLED" || thread.status === "DECLINED";
  const canQuote = thread.role === "provider" && !closed;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, paddingTop: 10, borderTop: "1px solid var(--border)" }}>
      {/* Wyceny */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600, color: "var(--text-secondary)" }}>
          <Tag size={13} /> Wyceny
        </span>
        {thread.quotes.length === 0 ? (
          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
            {canQuote ? "Brak wycen — wyślij pierwszą poniżej." : "Wykonawca nie wysłał jeszcze wyceny."}
          </span>
        ) : (
          thread.quotes.map((q) => (
            <QuoteRow key={q.id} quote={q} role={thread.role} pending={pending}
              onRespond={(accept) => startTransition(async () => { await respondToQuote(q.id, accept); await reload(); })} />
          ))
        )}
        {canQuote && <QuoteForm requestId={requestId} onSent={() => reload()} />}
      </div>

      {/* Płatność (M9) */}
      <PaymentSection requestId={requestId} role={thread.role} payment={thread.payment} onChange={() => reload()} />

      {/* Spory / moderacja (M17) */}
      <DisputeSection requestId={requestId} />

      {/* Czat */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600, color: "var(--text-secondary)" }}>
          <MessageSquare size={13} /> Wiadomości
        </span>
        <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 260, overflowY: "auto", padding: "2px 0" }}>
          {thread.messages.length === 0 ? (
            <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Brak wiadomości. Napisz, by ustalić szczegóły.</span>
          ) : (
            thread.messages.map((m) => (
              <div key={m.id} style={{ alignSelf: m.mine ? "flex-end" : "flex-start", maxWidth: "82%" }}>
                <div style={{
                  background: m.mine ? "var(--accent-blue)" : "var(--bg-elevated)",
                  color: m.mine ? "var(--on-accent)" : "var(--text-primary)",
                  border: m.mine ? "none" : "1px solid var(--border)",
                  borderRadius: 10, padding: "6px 10px", fontSize: 13, whiteSpace: "pre-wrap", wordBreak: "break-word",
                }}>
                  {m.body}
                </div>
                <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2, textAlign: m.mine ? "right" : "left" }}>
                  {m.mine ? "Ty" : m.senderName ?? "Druga strona"} · {new Date(m.createdAt).toLocaleString("pl-PL", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                </div>
              </div>
            ))
          )}
          <div ref={bottomRef} />
        </div>
        <MessageForm requestId={requestId} onSent={() => reload()} />
      </div>
    </div>
  );
}

function QuoteRow({ quote, role, pending, onRespond }: { quote: ServiceQuoteDTO; role: "client" | "provider"; pending: boolean; onRespond: (accept: boolean) => void }) {
  const color = quote.status === "ACCEPTED" ? "var(--accent-green)" : quote.status === "REJECTED" ? "var(--text-muted)" : "var(--accent-amber)";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 10px", background: "var(--bg-base)", border: "1px solid var(--border)", borderRadius: 8 }}>
      <span style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>{money(quote.amount, quote.currency)}</span>
      {quote.message && <span style={{ fontSize: 12, color: "var(--text-secondary)", flex: 1, minWidth: 0 }}>{quote.message}</span>}
      <span style={{ fontSize: 11, fontWeight: 600, color, marginLeft: "auto" }}>{QUOTE_STATUS_LABELS[quote.status]}</span>
      {role === "client" && quote.status === "SENT" && (
        <span style={{ display: "inline-flex", gap: 4 }}>
          <button disabled={pending} onClick={() => onRespond(true)} title="Akceptuj"
            style={{ ...primaryButtonStyle, padding: "4px 8px", background: "var(--accent-green)" }}><Check size={14} /></button>
          <button disabled={pending} onClick={() => onRespond(false)} title="Odrzuć"
            style={{ ...secondaryButtonStyle, padding: "4px 8px", color: "var(--accent-red)" }}><X size={14} /></button>
        </span>
      )}
    </div>
  );
}

function QuoteForm({ requestId, onSent }: { requestId: string; onSent: () => void }) {
  const [amount, setAmount] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const pln = parseFloat(amount.replace(",", "."));
    if (!Number.isFinite(pln) || pln <= 0) { setErr("Podaj poprawną kwotę"); return; }
    setBusy(true); setErr(null);
    try {
      await sendQuote(requestId, Math.round(pln * 100), message.trim() || null);
      setAmount(""); setMessage("");
      onSent();
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : "Nie udało się wysłać wyceny");
    } finally { setBusy(false); }
  }

  return (
    <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 6, padding: 8, background: "var(--bg-base)", border: "1px dashed var(--border)", borderRadius: 8 }}>
      <label style={fieldLabelStyle}>Wyślij wycenę (PLN)</label>
      <div style={{ display: "flex", gap: 6 }}>
        <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" placeholder="np. 250"
          style={{ ...fieldInputStyle, width: 110 }} />
        <input value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Zakres / uwagi (opcjonalnie)"
          style={{ ...fieldInputStyle, flex: 1 }} />
        <button type="submit" disabled={busy} style={{ ...primaryButtonStyle, opacity: busy ? 0.6 : 1, whiteSpace: "nowrap" }}>Wyślij</button>
      </div>
      {err && <span style={{ fontSize: 11, color: "var(--accent-red)" }}>{err}</span>}
    </form>
  );
}

function MessageForm({ requestId, onSent }: { requestId: string; onSent: () => void }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const body = text.trim();
    if (!body) return;
    setBusy(true);
    try {
      await sendServiceMessage(requestId, body);
      setText("");
      onSent();
    } finally { setBusy(false); }
  }

  return (
    <form onSubmit={submit} style={{ display: "flex", gap: 6 }}>
      <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Napisz wiadomość…" style={{ ...fieldInputStyle, flex: 1 }} />
      <button type="submit" disabled={busy} style={{ ...primaryButtonStyle, display: "inline-flex", alignItems: "center", gap: 6, opacity: busy ? 0.6 : 1 }}>
        <Send size={14} /> Wyślij
      </button>
    </form>
  );
}

function PaymentSection({ requestId, role, payment, onChange }: { requestId: string; role: "client" | "provider"; payment: ServicePaymentDTO | null; onChange: () => void }) {
  const [amount, setAmount] = useState(payment ? String(payment.amount / 100) : "");
  const [method, setMethod] = useState<PaymentMethod>(payment?.method ?? "cash");
  const [invoiceNo, setInvoiceNo] = useState(payment?.invoiceNo ?? "");
  const [elements, setElements] = useState<{ id: string; name: string; currency: string }[]>([]);
  const [walletId, setWalletId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const loadWallets = async () => {
    if (elements.length) return;
    try {
      const els = await getWalletElements();
      setElements(els.filter((e) => !e.archived).map((e) => ({ id: e.id, name: e.name, currency: e.currency })));
    } catch { /* Portfel niedostępny — pomijamy */ }
  };

  async function saveAmount() {
    const pln = parseFloat(amount.replace(",", "."));
    if (!Number.isFinite(pln) || pln <= 0) { setError("Podaj poprawną kwotę"); return; }
    setBusy(true); setError(null);
    try { await setServicePayment(requestId, Math.round(pln * 100), method, invoiceNo.trim() || null); onChange(); }
    catch (e) { setError(e instanceof Error ? e.message : "Błąd"); } finally { setBusy(false); }
  }

  async function markPaid() {
    setBusy(true); setError(null);
    try { await markPaymentPaid(requestId, walletId || null); setInfo(walletId ? "Oznaczono i zaksięgowano przychód" : "Oznaczono jako opłacone"); onChange(); }
    catch (e) { setError(e instanceof Error ? e.message : "Błąd"); } finally { setBusy(false); }
  }

  async function bookExpense() {
    if (!walletId) { setError("Wybierz element portfela"); return; }
    setBusy(true); setError(null);
    try { await bookClientExpense(requestId, walletId); setInfo("Zapisano wydatek w Portfelu"); }
    catch (e) { setError(e instanceof Error ? e.message : "Błąd"); } finally { setBusy(false); }
  }

  const paid = payment?.status === "PAID";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, paddingTop: 10, borderTop: "1px solid var(--border)" }}>
      <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600, color: "var(--text-secondary)" }}>
        <Wallet size={13} /> Płatność
        {payment && (
          <span style={{ marginLeft: 6, fontSize: 12, fontWeight: 700, color: paid ? "var(--accent-green)" : "var(--accent-amber)" }}>
            {payment.discount > 0 ? (
              <>
                <span style={{ textDecoration: "line-through", color: "var(--text-muted)", fontWeight: 500 }}>{money(payment.amount, payment.currency)}</span>
                {" "}{money(payment.amount - payment.discount, payment.currency)}
              </>
            ) : money(payment.amount, payment.currency)}
            {" · "}{paid ? "Opłacone" : "Do zapłaty"} · {PAYMENT_METHOD_LABELS[payment.method]}
            {payment.invoiceNo ? ` · ${payment.invoiceNo}` : ""}
          </span>
        )}
      </span>

      {/* M16: kod rabatowy */}
      {payment && !paid && (
        <PromoCodeRow requestId={requestId} payment={payment} onChange={onChange} />
      )}

      {role === "provider" && !paid && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
          <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" placeholder="kwota PLN" style={{ ...fieldInputStyle, width: 100 }} />
          <select value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)} style={{ ...fieldInputStyle, width: 110 }}>
            {(Object.keys(PAYMENT_METHOD_LABELS) as PaymentMethod[]).map((m) => <option key={m} value={m}>{PAYMENT_METHOD_LABELS[m]}</option>)}
          </select>
          <input value={invoiceNo} onChange={(e) => setInvoiceNo(e.target.value)} placeholder="nr faktury (opc.)" style={{ ...fieldInputStyle, width: 130 }} />
          <button onClick={saveAmount} disabled={busy} style={secondaryButtonStyle}>Zapisz kwotę</button>
        </div>
      )}

      {role === "provider" && payment && !paid && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
          <select value={walletId} onFocusCapture={loadWallets} onChange={(e) => setWalletId(e.target.value)} style={{ ...fieldInputStyle, width: 200 }}>
            <option value="">Księguj przychód w… (opcjonalnie)</option>
            {elements.map((el) => <option key={el.id} value={el.id}>{el.name}</option>)}
          </select>
          <button onClick={markPaid} disabled={busy} style={{ ...primaryButtonStyle, background: "var(--accent-green)" }}>Oznacz jako opłacone</button>
        </div>
      )}

      {role === "client" && paid && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
          <select value={walletId} onFocusCapture={loadWallets} onChange={(e) => setWalletId(e.target.value)} style={{ ...fieldInputStyle, width: 200 }}>
            <option value="">Zapisz wydatek w…</option>
            {elements.map((el) => <option key={el.id} value={el.id}>{el.name}</option>)}
          </select>
          <button onClick={bookExpense} disabled={busy || !walletId} style={secondaryButtonStyle}>Zapisz wydatek w Portfelu</button>
        </div>
      )}

      {role === "client" && !payment && <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Wykonawca nie wystawił jeszcze płatności.</span>}
      {error && <span style={{ fontSize: 11, color: "var(--accent-red)" }}>{error}</span>}
      {info && <span style={{ fontSize: 11, color: "var(--accent-green)" }}>{info}</span>}
    </div>
  );
}

function PromoCodeRow({ requestId, payment, onChange }: { requestId: string; payment: ServicePaymentDTO; onChange: () => void }) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function apply() {
    if (!code.trim()) return;
    setBusy(true); setErr(null);
    try { await applyPromoCode(requestId, code.trim()); setCode(""); onChange(); }
    catch (e) { setErr(e instanceof Error ? e.message : "Błąd"); } finally { setBusy(false); }
  }
  async function clear() {
    setBusy(true); setErr(null);
    try { await clearPromoCode(requestId); onChange(); }
    catch (e) { setErr(e instanceof Error ? e.message : "Błąd"); } finally { setBusy(false); }
  }

  if (payment.promoCode) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "var(--text-secondary)" }}>
        <Tag size={12} style={{ color: "var(--accent-green)" }} />
        Kod <strong style={{ color: "var(--text-primary)" }}>{payment.promoCode}</strong> — rabat {money(payment.discount, payment.currency)}
        <button onClick={clear} disabled={busy} style={{ background: "none", border: "none", color: "var(--accent-red)", cursor: "pointer", fontSize: 11, padding: 0 }}>usuń</button>
        {err && <span style={{ color: "var(--accent-red)", fontSize: 11 }}>{err}</span>}
      </div>
    );
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
      <Tag size={12} style={{ color: "var(--text-muted)" }} />
      <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} onKeyDown={(e) => e.key === "Enter" && apply()} placeholder="Kod rabatowy" style={{ ...fieldInputStyle, width: 130, textTransform: "uppercase" }} />
      <button onClick={apply} disabled={busy || !code.trim()} style={secondaryButtonStyle}>Zastosuj</button>
      {err && <span style={{ color: "var(--accent-red)", fontSize: 11 }}>{err}</span>}
    </div>
  );
}

const DISPUTE_STATUS_LABELS: Record<string, string> = { OPEN: "Otwarte", RESOLVED: "Rozwiązane", REJECTED: "Odrzucone" };
const DISPUTE_STATUS_COLORS: Record<string, string> = { OPEN: "var(--accent-amber)", RESOLVED: "var(--accent-green)", REJECTED: "var(--text-muted)" };

function DisputeSection({ requestId }: { requestId: string }) {
  const [disputes, setDisputes] = useState<ServiceDisputeDTO[] | null>(null);
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [desc, setDesc] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function reload() { setDisputes(await getRequestDisputes(requestId).catch(() => [])); }
  useEffect(() => { reload(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [requestId]);

  const hasOpen = (disputes ?? []).some((d) => d.status === "OPEN");

  async function submit() {
    if (!reason.trim()) return;
    setBusy(true); setErr(null);
    try { await openDispute(requestId, reason.trim(), desc.trim() || null); setReason(""); setDesc(""); setOpen(false); await reload(); }
    catch (e) { setErr(e instanceof Error ? e.message : "Błąd"); } finally { setBusy(false); }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, paddingTop: 10, borderTop: "1px solid var(--border)" }}>
      <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600, color: "var(--text-secondary)" }}>
        <AlertTriangle size={13} /> Problem ze zleceniem
      </span>

      {(disputes ?? []).map((d) => (
        <div key={d.id} style={{ fontSize: 12, padding: "6px 8px", borderRadius: 6, background: "var(--bg-surface)", border: "1px solid var(--border)" }}>
          <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>{d.reason}</span>
          <span style={{ marginLeft: 6, color: DISPUTE_STATUS_COLORS[d.status] }}>· {DISPUTE_STATUS_LABELS[d.status]}</span>
          {d.mine && <span style={{ marginLeft: 6, color: "var(--text-muted)" }}>(Twoje zgłoszenie)</span>}
          {d.description && <div style={{ color: "var(--text-muted)", marginTop: 2 }}>{d.description}</div>}
          {d.resolution && <div style={{ color: "var(--accent-green)", marginTop: 2 }}>Moderator: {d.resolution}</div>}
        </div>
      ))}

      {!hasOpen && !open && (
        <button onClick={() => setOpen(true)} style={{ alignSelf: "flex-start", fontSize: 12, color: "var(--accent-red)", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
          Zgłoś problem do moderacji
        </button>
      )}
      {open && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Powód (np. usługa niewykonana)" style={fieldInputStyle} />
          <textarea value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Opis (opcjonalnie)" rows={2} style={{ ...fieldInputStyle, resize: "vertical" }} />
          <div style={{ display: "flex", gap: 6 }}>
            <button onClick={submit} disabled={busy || !reason.trim()} style={{ ...primaryButtonStyle, background: "var(--accent-red)" }}>Wyślij zgłoszenie</button>
            <button onClick={() => setOpen(false)} style={secondaryButtonStyle}>Anuluj</button>
          </div>
          {err && <span style={{ color: "var(--accent-red)", fontSize: 11 }}>{err}</span>}
        </div>
      )}
    </div>
  );
}
