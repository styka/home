export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { LEGAL_DOCUMENTS } from "@/lib/legal/documents";
import { getMyConsents } from "@/actions/legal";
import { ScrollText, Check, ChevronRight } from "lucide-react";

export default async function LegalIndexPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/signin");

  const consents = await getMyConsents();

  return (
    <div className="flex-1 overflow-y-auto" style={{ backgroundColor: "var(--bg-base)", padding: "24px 16px" }}>
      <div style={{ maxWidth: 640, margin: "0 auto", display: "flex", flexDirection: "column", gap: 16 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)", margin: 0, display: "flex", alignItems: "center", gap: 10 }}>
          <ScrollText size={22} style={{ color: "var(--text-secondary)" }} />
          Dokumenty prawne
        </h1>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {LEGAL_DOCUMENTS.map((doc) => {
            const accepted = doc.consent && consents[doc.key]?.version === doc.version;
            return (
              <Link
                key={doc.key}
                href={`/legal/${doc.key}`}
                style={{
                  display: "flex", alignItems: "center", gap: 12, padding: "16px 18px",
                  background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 8,
                  textDecoration: "none",
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ color: "var(--text-primary)", fontWeight: 500 }}>
                    {doc.title}
                    {doc.draft ? <span style={{ marginLeft: 8, fontSize: 11, color: "var(--accent-amber)" }}>(robocza)</span> : null}
                  </div>
                  <div style={{ color: "var(--text-muted)", fontSize: 12 }}>
                    wersja {doc.version}
                    {doc.consent ? (accepted ? " · zaakceptowano" : " · wymaga akceptacji") : " · informacyjny"}
                  </div>
                </div>
                {doc.consent && accepted ? <Check size={16} style={{ color: "var(--accent-green)" }} /> : null}
                <ChevronRight size={16} style={{ color: "var(--text-muted)" }} />
              </Link>
            );
          })}
        </div>

        <p style={{ color: "var(--text-muted)", fontSize: 12, lineHeight: 1.5, margin: 0 }}>
          Polityka prywatności i regulamin to obecnie wersje robocze przygotowane technicznie —
          wymagają weryfikacji prawnej przed publicznym startem. Eksport i usunięcie danych dostępne
          są w <Link href="/settings" style={{ color: "var(--accent-blue)" }}>Ustawienia → Prywatność i dane</Link>.
        </p>
      </div>
    </div>
  );
}
