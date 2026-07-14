"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { ScrollText, Loader2 } from "lucide-react";
import { getOutstandingConsents, acceptAllCurrentConsents } from "@/actions/legal";

// Z-053: baner zgód. Sam pobiera, czy bieżący użytkownik ma niezaakceptowane
// bieżące wersje dokumentów (bez przeciągania propsów przez AppShell). Gdy nie ma
// zaległości — nie renderuje nic.
export function ConsentBanner() {
  const [need, setNeed] = useState<string[] | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    let active = true;
    getOutstandingConsents()
      .then((k) => { if (active) setNeed(k); })
      .catch(() => { if (active) setNeed([]); });
    return () => { active = false; };
  }, []);

  if (!need || need.length === 0) return null;

  return (
    <div
      role="dialog"
      aria-label="Zgody prawne"
      style={{
        position: "fixed",
        left: 16, right: 16,
        bottom: "calc(env(safe-area-inset-bottom, 0px) + 80px)",
        margin: "0 auto", maxWidth: 560, zIndex: 9985,
        background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 10,
        boxShadow: "0 8px 30px rgba(0,0,0,0.45)", padding: "14px 16px",
        display: "flex", flexDirection: "column", gap: 10,
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
        <ScrollText size={18} style={{ color: "var(--text-secondary)", flexShrink: 0, marginTop: 1 }} />
        <div style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.5 }}>
          Zaktualizowaliśmy dokumenty. Zapoznaj się z{" "}
          <Link href="/legal/privacy" style={{ color: "var(--accent-blue)" }}>polityką prywatności</Link>{" "}
          i <Link href="/legal/terms" style={{ color: "var(--accent-blue)" }}>regulaminem</Link>, aby
          dalej korzystać z aplikacji.
        </div>
      </div>
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <Link
          href="/legal"
          style={{
            padding: "8px 14px", border: "1px solid var(--border)", borderRadius: 6,
            color: "var(--text-secondary)", fontSize: 13, textDecoration: "none",
          }}
        >
          Czytaj
        </Link>
        <button
          type="button"
          disabled={pending}
          onClick={() => startTransition(async () => { await acceptAllCurrentConsents(); setNeed([]); })}
          style={{
            display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 16px",
            background: "var(--accent-blue)", border: "1px solid var(--accent-blue)", borderRadius: 6,
            color: "var(--on-accent)", fontSize: 13, cursor: pending ? "default" : "pointer",
          }}
        >
          {pending ? <Loader2 size={14} className="animate-spin" /> : null} Akceptuję
        </button>
      </div>
    </div>
  );
}
