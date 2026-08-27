
import { getTranslations } from "next-intl/server";import { auth } from "@/platform/auth/session"
import { getMyTeams } from "@/actions/teams"
import { getRecentActivity } from "@/actions/activity"
import { getMenuPrefs } from "@/actions/menuPrefs"
import { signOut } from "@/platform/auth/session"
import Link from "next/link"
import { Settings } from "lucide-react"
import { ActivityFeed } from "@/components/settings/ActivityFeed"
import { MenuPrefsEditor } from "@/components/settings/MenuPrefsEditor"
import { FavoriteViewsEditor } from "@/components/settings/FavoriteViewsEditor"
import { getFavoriteViews } from "@/actions/favoriteViews"
import { SkinPicker } from "@/components/settings/SkinPicker"
import { listAvailableSkins, getActiveSkinId } from "@/actions/skins"
import { DriveSettings } from "@/components/settings/DriveSettings"
import { IcalFeedCard } from "@/modules/calendar/ui/IcalFeedCard"
import { getDriveStatus } from "@/actions/drive"
import { PrivacySettings } from "@/components/settings/PrivacySettings"
import { UserFactsSection } from "@/components/settings/UserFactsSection"
import { getActivePlan } from "@/lib/plans"
import { getMyAiUsage } from "@/platform/ai/budzet"
import { getWorkspaceLocaleSettings } from "@/actions/workspaceSettings"
import { WorkspaceLocaleSection } from "@/components/settings/WorkspaceLocaleSection"
import { AiUsageMeters } from "@/components/settings/AiUsageMeters"

export default async function SettingsPage({
  searchParams,
}: {
  searchParams?: { drive?: string }
}) {
  const t = await getTranslations("app.settings.page");
  const session = await auth()
  const driveStatus = await getDriveStatus()
  const teams = await getMyTeams()
  const recentActivity = await getRecentActivity(30)
  const userPermissions: string[] = session?.user?.permissions ?? []
  const menuPrefs = await getMenuPrefs()
  const favoriteViews = await getFavoriteViews().catch(() => [])
  const skins = await listAvailableSkins()
  const activeSkinId = await getActiveSkinId()
  const teamOpts = teams.map((t) => ({ id: t.id, name: t.name }))
  const plan = session?.user?.id ? await getActivePlan(session.user.id) : null
  // 082 (zadanie 27): „wykorzystano X z Y” — rozdz. 11.3 wymienia widoczność dla użytkownika jako
  // jeden z czterech mechanizmów budżetu. Sam limit, którego nie widać, użytkownik poznaje dopiero
  // w chwili odmowy.
  const zuzycieAi = session?.user?.id ? await getMyAiUsage(session.user.id) : null
  // 089 (zadanie 37): język i strefa należą do PRZESTRZENI (rozdz. 8.2), więc ustawia się je per
  // przestrzeń — przy jednej osobistej wygląda to jak zwykłe ustawienie konta.
  const ustawieniaJezykowe = await getWorkspaceLocaleSettings().catch(() => null)
  const activityForUI = recentActivity.map((a) => ({
    module: a.module,
    action: a.action,
    createdAt: a.createdAt instanceof Date ? a.createdAt.toISOString() : String(a.createdAt),
    metadata: (a.metadata as Record<string, unknown> | null) ?? null,
  }))

  return (
    <div style={{ flex: 1, overflowY: "auto", backgroundColor: "var(--bg-base)", padding: "24px 16px" }}>
    <div style={{ maxWidth: 640, margin: "0 auto", display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Header */}
      <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)", margin: 0, display: "flex", alignItems: "center", gap: 10 }}>
        <Settings size={22} style={{ color: "var(--text-secondary)" }} />
        Ustawienia
      </h1>

      {/* Profile */}
      <section>
        <h2 style={{ color: "var(--text-secondary)", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>
          Profil
        </h2>
        <div style={{
          background: "var(--bg-surface)",
          border: "1px solid var(--border)",
          borderRadius: 8,
          padding: "20px 24px",
          display: "flex",
          alignItems: "center",
          gap: 16,
        }}>
          {session?.user?.image && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={session.user.image}
              alt=""
              style={{ width: 48, height: 48, borderRadius: "50%", objectFit: "cover" }}
            />
          )}
          <div>
            <div style={{ color: "var(--text-primary)", fontWeight: 500 }}>
              {session?.user?.name}
            </div>
            <div style={{ color: "var(--text-muted)", fontSize: 13 }}>
              {session?.user?.email}
            </div>
          </div>
          <form
            action={async () => {
              "use server"
              await signOut({ redirectTo: "/auth/signin" })
            }}
            style={{ marginLeft: "auto" }}
          >
            <button
              type="submit"
              style={{
                padding: "8px 16px",
                background: "none",
                border: "1px solid var(--border)",
                borderRadius: 6,
                color: "var(--text-secondary)",
                fontSize: 13,
                cursor: "pointer",
              }}
            >
              Wyloguj
            </button>
          </form>
        </div>
      </section>

      {/* Teams */}
      <section>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <h2 style={{ color: "var(--text-secondary)", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Teamy
          </h2>
          <Link
            href="/settings/team/new"
            style={{
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
          <p style={{ color: "var(--text-muted)", fontSize: 14 }}>
            {t("nieNalezyszJeszczeDo")}
          </p>
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
                    <div style={{ color: "var(--text-muted)", fontSize: 13, marginTop: 2 }}>
                      {team.description}
                    </div>
                  )}
                </div>
                <div style={{ color: "var(--text-muted)", fontSize: 13 }}>
                  {team._count.members} {team._count.members === 1 ? "member" : "members"}
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Menu */}
      <section>
        <h2 style={{ color: "var(--text-secondary)", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>
          Menu
        </h2>
        <MenuPrefsEditor permissions={userPermissions} prefs={menuPrefs} />
      </section>

      {/* Ulubione widoki — kotwica dla linku „Zarządzaj" z sekcji ulubionych w pasku (043/AC-3). */}
      <section id="ulubione" style={{ scrollMarginTop: 16 }}>
        <h2 style={{ color: "var(--text-secondary)", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>
          Nawigacja
        </h2>
        <FavoriteViewsEditor favorites={favoriteViews} />
      </section>

      {/* Dysk Google */}
      <section>
        <h2 style={{ color: "var(--text-secondary)", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>
          Dysk Google
        </h2>
        <DriveSettings status={driveStatus} notice={searchParams?.drive} />
      </section>

      {/* Kalendarz — subskrypcja iCal (Z-150) */}
      <section>
        <h2 style={{ color: "var(--text-secondary)", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>
          Kalendarz — subskrypcja
        </h2>
        <IcalFeedCard />
      </section>

      {/* Wygląd / Skórka */}
      <section>
        <h2 style={{ color: "var(--text-secondary)", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>
          {t("wygladSkorka")}
        </h2>
        <SkinPicker skins={skins} activeId={activeSkinId} teams={teamOpts} />
      </section>

      {/* Twój plan (Z-471) */}
      {ustawieniaJezykowe && ustawieniaJezykowe.przestrzenie.length > 0 && (
        <section>
          <h2 style={{ color: "var(--text-secondary)", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>
            {t("jezykIStrefaCzasowa")}
          </h2>
          <WorkspaceLocaleSection przestrzenie={ustawieniaJezykowe.przestrzenie} jezyki={ustawieniaJezykowe.jezyki} />
        </section>
      )}

      {plan && (
        <section>
          <h2 style={{ color: "var(--text-secondary)", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>
            {t("twojPlan")}
          </h2>
          <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 8, padding: "16px 20px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>{plan.name}</span>
              <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 999, background: "var(--bg-elevated)", color: "var(--text-muted)" }}>{plan.key}</span>
            </div>
            {zuzycieAi && <AiUsageMeters zuzycie={zuzycieAi} />}
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 10, lineHeight: 1.6 }}>
              {t("zmianaPlanuBedzieDostepna")}
            </div>
          </div>
        </section>
      )}

      {/* 039: wiedza o użytkowniku stoi tuż nad sekcją prywatności — bo to jest sekcja o tym, co
          system o nim wie, i tam użytkownik będzie jej szukał. */}
      <section>
        <h2 style={{ color: "var(--text-secondary)", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>
          Wiedza o Tobie
        </h2>
        <UserFactsSection />
      </section>

      {/* 108: wejście do działu przewodników. Sąsiaduje z dokumentami prawnymi, bo to to samo
          miejsce psychiczne — rzeczy do przeczytania, nie przełączniki. Przewodniki MIESZKAJĄ pod
          /guide, a nie tutaj: lektura schowana w ustawieniach konta byłaby niewidoczna dla kogoś,
          kto do ustawień nie zagląda. */}
      <section>
        <h2 style={{ color: "var(--text-secondary)", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>
          {t("pomocIPrzewodniki")}
        </h2>
        <p style={{ color: "var(--text-muted)", fontSize: 13, margin: 0 }}>
          {t("przewodnikiOpis")}
        </p>
        <Link href="/guide" style={{ display: "inline-block", marginTop: 10, fontSize: 13, color: "var(--accent-blue)", textDecoration: "none" }}>
          {t("otworzPrzewodniki")}
        </Link>
      </section>

      {/* Prywatność i dane (RODO) */}
      <section>
        <h2 style={{ color: "var(--text-secondary)", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>
          {t("prywatnoscIDane")}
        </h2>
        <PrivacySettings />
        <Link href="/legal" style={{ display: "inline-block", marginTop: 10, fontSize: 13, color: "var(--accent-blue)", textDecoration: "none" }}>
          {t("dokumentyPrawnePolitykaPrywatnosci")}
        </Link>
      </section>

      {/* Activity */}
      <section>
        <h2 style={{ color: "var(--text-secondary)", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>
          {t("aktywnosc")}
        </h2>
        {activityForUI.length === 0 ? (
          <p style={{ color: "var(--text-muted)", fontSize: 14 }}>
            {t("brakOstatniejAktywnosci")}
          </p>
        ) : (
          <ActivityFeed activities={activityForUI} permissions={userPermissions} />
        )}
      </section>

    </div>
    </div>
  )
}
