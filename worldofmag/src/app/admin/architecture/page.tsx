import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/platform/auth/session";
import { hasPermission, PERMISSIONS } from "@/platform/auth/permissions";
import { Map, Package, Database, Shield, ChevronLeft, BookOpen, GitBranch } from "lucide-react";
import { MODULES } from "@/lib/modules";
import { PRZEGLAD_ARCHITEKTURY } from "@/generated/architecture";
import { getTranslations } from "next-intl/server";

/**
 * 094 (zadanie 45; rozdz. 13.F9) — PRZEGLĄD ARCHITEKTURY, WYPROWADZONY ZE STANU REPOZYTORIUM.
 *
 * Poprzednia wersja tej strony była **pisana ręcznie**: 449 linii, w tym „SQLite (lokalne dev)" długo
 * po przejściu na Postgresa i data „ostatnia aktualizacja: 2026-06-01". To przewidywalny los każdego
 * opisu struktury utrzymywanego osobno od struktury.
 *
 * Teraz liczby i listy pochodzą z `scripts/generate-architecture.js` (bakowane w buildzie) oraz
 * z rejestru modułów. Strona nie może się rozjechać ze stanem repozytorium, bo jej treść **jest**
 * tym stanem.
 *
 * **Czego tu świadomie nie ma: uzasadnień.** Na „dlaczego tak" są dwie książki i dziennik przebiegów;
 * ta strona odpowiada na „co tu jest". Dublowanie uzasadnień dałoby trzecie miejsce do aktualizowania
 * — czyli dokładnie problem, który ta zmiana rozwiązuje.
 */
export default async function ArchitecturePage() {
  const session = await auth();
  if (!hasPermission(session, PERMISSIONS.ADMIN)) redirect("/");

  const t = await getTranslations("admin.architecture");
  const p = PRZEGLAD_ARCHITEKTURY;
  const wygenerowano = new Date(p.wygenerowano).toLocaleString("pl-PL");

  return (
    <div className="flex-1 overflow-y-auto" style={{ backgroundColor: "var(--bg-base)", padding: "32px 24px" }}>
      <div style={{ maxWidth: 860, margin: "0 auto" }}>
        <Link
          href="/admin"
          style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12, color: "var(--text-muted)", textDecoration: "none", marginBottom: 20 }}
        >
          <ChevronLeft size={14} />
          Admin
        </Link>

        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
          <Map size={20} style={{ color: "var(--accent-purple)" }} />
          <h1 style={{ fontSize: 18, fontWeight: 600, color: "var(--text-primary)", margin: 0 }}>
            {t("title")}
          </h1>
        </div>
        <p style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 4, marginBottom: 8, lineHeight: 1.6 }}>
          {t("lead")}
        </p>
        <p style={{ fontSize: 11.5, color: "var(--text-muted)", marginBottom: 28 }}>
          {t("generated", { kiedy: wygenerowano })}
        </p>

        <Sekcja title={t("whySection")} icon={<BookOpen size={15} />}>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <Odnosnik href="/admin/architektura-docelowa" tytul={t("linkTargetTitle")} opis={t("linkTargetDesc")} />
            <Odnosnik href="/admin/audyt" tytul={t("linkAuditTitle")} opis={t("linkAuditDesc")} />
            <Odnosnik href="/admin/spec-pipeline" tytul={t("linkPipelineTitle")} opis={t("linkPipelineDesc")} />
            <Odnosnik href="/admin/docs" tytul={t("linkDocsTitle")} opis={t("linkDocsDesc")} />
          </div>
        </Sekcja>

        <Sekcja title={t("modules", { ile: MODULES.length })} icon={<Package size={15} />}>
          <p style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 0, marginBottom: 10, lineHeight: 1.6 }}>
            {t("modulesNote")}
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {MODULES.map((m) => (
              <span
                key={m.id}
                title={m.permission ?? t("permissionNone")}
                style={{
                  fontSize: 11.5, padding: "3px 8px", borderRadius: 999,
                  background: "var(--bg-elevated)", border: "1px solid var(--border)", color: "var(--text-secondary)",
                }}
              >
                {m.label}
              </span>
            ))}
          </div>
        </Sekcja>

        <Sekcja title={t("platform", { ile: p.zdolnosciPlatformy.length })} icon={<Shield size={15} />}>
          <p style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 0, marginBottom: 10, lineHeight: 1.6 }}>
            {t("platformNote")}
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {p.zdolnosciPlatformy.map((z) => (
              <Kod key={z}>{z}</Kod>
            ))}
          </div>
        </Sekcja>

        <Sekcja title={t("gates", { ile: p.bramki.length })} icon={<GitBranch size={15} />}>
          <p style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 0, marginBottom: 10, lineHeight: 1.6 }}>
            {t("gatesNote", { ile: p.bakowanie.length })}
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {p.bramki.map((b) => (
              <Kod key={b}>{b.replace(/^check-/, "")}</Kod>
            ))}
          </div>
        </Sekcja>

        <Sekcja title={t("ratchetsSection")} icon={<GitBranch size={15} />}>
          <p style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 0, marginBottom: 10, lineHeight: 1.6 }}>
            {t("ratchetsNote")}
          </p>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <tbody>
              {p.zapadki.map((z) => (
                <tr key={z.nazwa}>
                  <td style={komorka}>{z.nazwa}</td>
                  <td style={{ ...komorka, textAlign: "right", color: "var(--text-primary)", fontVariantNumeric: "tabular-nums" }}>
                    {z.wartosc.toLocaleString("pl-PL")}
                  </td>
                  <td style={{ ...komorka, color: "var(--text-muted)" }}>
                    <code>{z.bramka}</code>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Sekcja>

        <Sekcja title={t("dbSection")} icon={<Database size={15} />}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <tbody>
              <Wiersz etykieta={t("dbModels")} wartosc={String(p.liczbaModeli)} />
              <Wiersz etykieta={t("dbMigrations")} wartosc={String(p.liczbaMigracji)} />
              <Wiersz
                etykieta={t("dbWorkspace")}
                wartosc={t("dbWorkspaceValue", { ile: p.modeleZPrzestrzenia.length })}
              />
              <Wiersz
                etykieta={t("dbVersion")}
                wartosc={p.modeleZWersja.join(", ") || "—"}
              />
            </tbody>
          </table>
          <p style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 10, lineHeight: 1.6 }}>
            {t("dbNote")}
          </p>
        </Sekcja>
      </div>
    </div>
  );
}

const komorka: React.CSSProperties = {
  padding: "6px 8px",
  fontSize: 12.5,
  color: "var(--text-secondary)",
  borderBottom: "1px solid var(--border)",
};

function Wiersz({ etykieta, wartosc }: { etykieta: string; wartosc: string }) {
  return (
    <tr>
      <td style={komorka}>{etykieta}</td>
      <td style={{ ...komorka, textAlign: "right", color: "var(--text-primary)" }}>{wartosc}</td>
    </tr>
  );
}

function Kod({ children }: { children: React.ReactNode }) {
  return (
    <code
      style={{
        fontSize: 11.5, padding: "3px 7px", borderRadius: 5,
        background: "var(--bg-elevated)", border: "1px solid var(--border)", color: "var(--text-secondary)",
      }}
    >
      {children}
    </code>
  );
}

function Odnosnik({ href, tytul, opis }: { href: string; tytul: string; opis: string }) {
  return (
    <Link
      href={href}
      style={{
        display: "block", padding: "10px 12px", borderRadius: 8,
        border: "1px solid var(--border)", background: "var(--bg-surface)", textDecoration: "none",
      }}
    >
      <span style={{ display: "block", fontSize: 13, color: "var(--text-primary)" }}>{tytul}</span>
      <span style={{ display: "block", fontSize: 11.5, color: "var(--text-muted)", lineHeight: 1.5, marginTop: 2 }}>{opis}</span>
    </Link>
  );
}

function Sekcja({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 30 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <span style={{ color: "var(--accent-blue)", display: "inline-flex" }}>{icon}</span>
        <h2 style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", margin: 0 }}>{title}</h2>
      </div>
      {children}
    </section>
  );
}
