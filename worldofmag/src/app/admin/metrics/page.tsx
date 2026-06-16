export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import { getUnitEconomics } from "@/actions/metrics";
import { ChevronLeft, LineChart } from "lucide-react";

function usd(n: number): string {
  return "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default async function AdminMetricsPage() {
  const session = await auth();
  if (!hasPermission(session, PERMISSIONS.ADMIN)) redirect("/");

  const m = await getUnitEconomics(30);

  const cards: { label: string; value: string; hint?: string }[] = [
    { label: "Użytkownicy (zarejestrowani)", value: String(m.registeredUsers) },
    { label: `MAU (aktywni AI, ${m.windowDays} dni)`, value: String(m.aiActiveUsers), hint: "proxy: użytkownicy z zużyciem AI" },
    { label: "Zapytania AI", value: m.aiRequests.toLocaleString("pl-PL") },
    { label: "Tokeny AI", value: m.aiTokens.toLocaleString("pl-PL") },
    { label: "Szac. koszt AI", value: usd(m.estAiCostUsd), hint: `${usd(m.pricePer1mTokensUsd)}/1M tok` },
    { label: "Koszt AI / aktywny user", value: m.estAiCostPerActiveUserUsd == null ? "—" : usd(m.estAiCostPerActiveUserUsd) },
  ];

  return (
    <div className="flex-1 overflow-y-auto" style={{ backgroundColor: "var(--bg-base)", padding: "32px 24px" }}>
      <div style={{ maxWidth: 820, margin: "0 auto" }}>
        <Link href="/admin" style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12, color: "var(--text-muted)", textDecoration: "none", marginBottom: 20 }}>
          <ChevronLeft size={14} /> Admin
        </Link>
        <div className="flex items-center gap-3 mb-2">
          <LineChart size={20} style={{ color: "var(--accent-green)" }} />
          <h1 style={{ fontSize: 18, fontWeight: 600, color: "var(--text-primary)", margin: 0 }}>Ekonomika jednostkowa</h1>
        </div>
        <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 18 }}>
          Koszt AI liczony z realnego zużycia ({m.windowDays} dni). Cena tokenów w{" "}
          <Link href="/admin/config" style={{ color: "var(--accent-blue)" }}>Konfiguracji</Link>{" "}
          (<code>ai_cost_per_1m_tokens</code>).
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginBottom: 22 }}>
          {cards.map((c) => (
            <div key={c.label} style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 10, padding: "14px 16px" }}>
              <div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>{c.label}</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)", marginTop: 6 }}>{c.value}</div>
              {c.hint ? <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{c.hint}</div> : null}
            </div>
          ))}
        </div>

        <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 10, padding: "14px 16px", marginBottom: 22 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", marginBottom: 6 }}>Metryki przychodowe (ARPU / CAC / LTV)</div>
          <div style={{ display: "flex", gap: 24, marginBottom: 8 }}>
            {(["arpuUsd", "cacUsd", "ltvUsd"] as const).map((k) => (
              <div key={k}>
                <div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase" }}>{k.replace("Usd", "").toUpperCase()}</div>
                <div style={{ fontSize: 18, fontWeight: 600, color: "var(--text-muted)" }}>{m.revenue[k] == null ? "—" : usd(m.revenue[k] as number)}</div>
              </div>
            ))}
          </div>
          <p style={{ fontSize: 12, color: "var(--text-muted)", margin: 0, lineHeight: 1.5 }}>{m.revenue.note}</p>
        </div>

        <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 8 }}>Zużycie AI dzień po dniu</div>
        {m.perDay.length === 0 ? (
          <p style={{ fontSize: 13, color: "var(--text-muted)" }}>Brak danych zużycia AI w oknie.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            {m.perDay.map((d) => (
              <div key={d.day} style={{ display: "flex", gap: 12, fontSize: 12, color: "var(--text-secondary)", padding: "4px 0", borderBottom: "1px solid var(--border)" }}>
                <span className="mono" style={{ width: 96 }}>{d.day}</span>
                <span style={{ width: 110 }}>{d.requests.toLocaleString("pl-PL")} zapytań</span>
                <span>{d.tokens.toLocaleString("pl-PL")} tok</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
