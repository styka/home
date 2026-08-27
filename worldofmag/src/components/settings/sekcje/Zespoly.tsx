import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { getMyTeams } from "@/actions/teams";

/** 109: sekcja „Zespoły". Treść przeniesiona 1:1; nagłówek rysuje rama widoku. */
export async function Zespoly() {
  const t = await getTranslations("app.settings.page");
  const teams = await getMyTeams();

  return (
    <>
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <Link
          href="/settings/team/new"
          style={{
            display: "inline-flex",
            alignItems: "center",
            minHeight: 44,
            padding: "6px 14px",
            background: "var(--bg-elevated)",
            border: "1px solid var(--border)",
            borderRadius: 6,
            color: "var(--text-primary)",
            fontSize: 13,
            textDecoration: "none",
          }}
        >
          + Nowy team
        </Link>
      </div>

      {teams.length === 0 ? (
        <p style={{ color: "var(--text-muted)", fontSize: 14, margin: 0 }}>{t("nieNalezyszJeszczeDo")}</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {teams.map((team) => (
            <Link
              key={team.id}
              href={`/settings/team/${team.id}`}
              style={{
                background: "var(--bg-surface)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                padding: "16px 20px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                textDecoration: "none",
                color: "inherit",
              }}
            >
              <div>
                <div style={{ color: "var(--text-primary)", fontWeight: 500, display: "flex", alignItems: "center", gap: 8 }}>
                  {team.name}
                  {team.kind === "household" && (
                    <span style={{ fontSize: 10, padding: "1px 7px", borderRadius: 999, background: "var(--bg-elevated)", color: "var(--accent-green)", border: "1px solid var(--border)" }}>Rodzina</span>
                  )}
                </div>
                {team.description && (
                  <div style={{ color: "var(--text-muted)", fontSize: 13, marginTop: 2 }}>{team.description}</div>
                )}
              </div>
              <div style={{ color: "var(--text-muted)", fontSize: 13 }}>
                {team._count.members} {team._count.members === 1 ? "member" : "members"}
              </div>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
