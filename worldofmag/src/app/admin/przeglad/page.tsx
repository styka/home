import { getTranslations } from "next-intl/server"
import { redirect } from "next/navigation"
import { auth } from "@/platform/auth/session"
import { hasPermission, PERMISSIONS } from "@/platform/auth/permissions"
import { prisma } from "@/platform/db/prisma"
import {
  Activity, Boxes, ChefHat, Clock, Database, GitBranch, GitCommit, Hammer, ListChecks,
  MessageSquare, PawPrint, ShoppingCart, StickyNote, BookOpen, Shield, Users,
} from "lucide-react"
import { RamaPrzegladu } from "@/components/admin/RamaPrzegladu"

/**
 * 110: PRZEGLĄD SYSTEMU — build, liczniki i aktywna sesja.
 *
 * Cała ta treść stała do 110 na `/admin`, nad płaską listą narzędzi. Skutek był taki, że **każde**
 * wejście do panelu — najczęściej po to, żeby pójść dalej — czekało na jedenaście zapytań
 * zliczających. Po przeniesieniu płaci za nie tylko ten, kto wchodzi po liczby.
 *
 * **Kontrola uprawnienia stoi tutaj, jawnie.** Rozbicie jednej chronionej strony na dwie mnoży
 * miejsca do obronienia, a pominięcie kontroli na którymś z nich nie objawia się niczym widocznym
 * w interfejsie. „To jest pod `/admin`" nie jest kontrolą.
 */

function fmtDate(iso: string | undefined) {
  if (!iso || iso === "unknown") return "—"
  return iso.slice(0, 19).replace("T", " ")
}

const BUILD = {
  commit:     process.env.NEXT_PUBLIC_BUILD_COMMIT      ?? "?",
  branch:     process.env.NEXT_PUBLIC_BUILD_BRANCH      ?? "?",
  buildDate:  process.env.NEXT_PUBLIC_BUILD_DATE        ?? "?",
  commitDate: process.env.NEXT_PUBLIC_BUILD_COMMIT_DATE ?? "?",
  commitMsg:  process.env.NEXT_PUBLIC_BUILD_COMMIT_MSG  ?? "—",
}

interface Row {
  icon: React.ReactNode
  label: string
  value: string
  mono?: boolean
}

export default async function PrzegladSystemuPage() {
  const session = await auth()
  if (!hasPermission(session, PERMISSIONS.ADMIN)) redirect("/")
  const safeSession = session!
  const t = await getTranslations("app.admin.przeglad")
  const tPage = await getTranslations("app.admin.page")

  const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  const [
    users, teams, reports, permissions, activity7d,
    shoppingItems, tasks, notes, recipes, pets, storageItems,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.team.count(),
    prisma.report.count(),
    prisma.permission.count(),
    prisma.userActivity.count({ where: { createdAt: { gte: since7d } } }),
    prisma.item.count(),
    prisma.task.count(),
    prisma.note.count(),
    prisma.recipe.count(),
    prisma.pet.count(),
    prisma.storageItem.count(),
  ])

  const systemMetrics = [
    { icon: <Users size={15} />,    label: "Użytkownicy",       value: users },
    { icon: <Users size={15} />,    label: "Zespoły",           value: teams },
    { icon: <BookOpen size={15} />, label: "Raporty",           value: reports },
    { icon: <Shield size={15} />,   label: "Uprawnienia",       value: permissions },
    { icon: <Activity size={15} />, label: "Aktywność (7 dni)", value: activity7d },
  ]

  const contentMetrics = [
    { icon: <ShoppingCart size={15} />, label: "Pozycje zakupowe", value: shoppingItems },
    { icon: <ListChecks size={15} />,   label: "Zadania",          value: tasks },
    { icon: <StickyNote size={15} />,   label: "Notatki",          value: notes },
    { icon: <ChefHat size={15} />,      label: "Przepisy",         value: recipes },
    { icon: <PawPrint size={15} />,     label: "Zwierzęta",        value: pets },
    { icon: <Boxes size={15} />,        label: "Pozycje magazynu", value: storageItems },
  ]

  const rows: Row[] = [
    { icon: <GitBranch size={15} />,     label: "Branch",       value: BUILD.branch,              mono: true },
    { icon: <GitCommit size={15} />,     label: "Commit",       value: BUILD.commit,              mono: true },
    { icon: <MessageSquare size={15} />, label: "Wiadomość",    value: BUILD.commitMsg },
    { icon: <Clock size={15} />,         label: "Data commitu", value: fmtDate(BUILD.commitDate), mono: true },
    { icon: <Hammer size={15} />,        label: "Data buildu",  value: fmtDate(BUILD.buildDate),  mono: true },
  ]

  const sesja = [
    { label: "Email",   value: safeSession.user?.email ?? "—" },
    { label: "Rola",    value: safeSession.user?.role  ?? "—" },
    { label: "User ID", value: safeSession.user?.id    ?? "—", mono: true },
  ]

  return (
    <RamaPrzegladu tytul={t("tytul")} podtytul={t("podtytul")}>
      {/* Informacje o buildzie */}
      <section>
        <NaglowekSekcji tytul={t("wdrozenie")} />
        <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden" }}>
          {rows.map((row, i) => (
            <div
              key={row.label}
              style={{
                display: "flex", alignItems: "flex-start", gap: 12, padding: "12px 16px",
                borderBottom: i < rows.length - 1 ? "1px solid var(--border)" : undefined,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 7, minWidth: 140, color: "var(--text-muted)", flexShrink: 0 }}>
                {row.icon}
                <span style={{ fontSize: 13 }}>{row.label}</span>
              </div>
              <span style={{ fontSize: 13, color: "var(--text-primary)", fontFamily: row.mono ? "monospace" : undefined, wordBreak: "break-all" }}>
                {row.value}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* Metryki */}
      <section>
        <NaglowekSekcji tytul={t("metrykiSystem")} ikona={<Database size={13} />} />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 10, marginBottom: 16 }}>
          {systemMetrics.map((m) => <MetricCard key={m.label} {...m} />)}
        </div>

        <NaglowekSekcji tytul={tPage("metrykiZawartosc")} ikona={<Boxes size={13} />} />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 10 }}>
          {contentMetrics.map((m) => <MetricCard key={m.label} {...m} />)}
        </div>
      </section>

      {/* Aktywna sesja */}
      <section>
        <NaglowekSekcji tytul={t("aktywnaSesja")} />
        <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden" }}>
          {sesja.map((row, i, arr) => (
            <div
              key={row.label}
              style={{
                display: "flex", alignItems: "center", gap: 12, padding: "12px 16px",
                borderBottom: i < arr.length - 1 ? "1px solid var(--border)" : undefined,
              }}
            >
              <span style={{ fontSize: 13, color: "var(--text-muted)", minWidth: 140, flexShrink: 0 }}>{row.label}</span>
              <span style={{
                fontSize: 13,
                color: row.label === "Rola" ? "var(--accent-purple)" : "var(--text-primary)",
                fontFamily: row.mono ? "monospace" : undefined,
                fontWeight: row.label === "Rola" ? 600 : undefined,
              }}>
                {row.value}
              </span>
            </div>
          ))}
        </div>
      </section>
    </RamaPrzegladu>
  )
}

function NaglowekSekcji({ tytul, ikona }: { tytul: string; ikona?: React.ReactNode }) {
  return (
    <h2 style={{
      fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase",
      color: "var(--text-muted)", marginBottom: 12, display: "flex", alignItems: "center", gap: 7,
    }}>
      {ikona}{tytul}
    </h2>
  )
}

function MetricCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 10, padding: "14px 16px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--text-muted)", marginBottom: 8 }}>
        {icon}
        <span style={{ fontSize: 12 }}>{label}</span>
      </div>
      <div style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)", fontFamily: "monospace" }}>
        {value.toLocaleString("pl-PL")}
      </div>
    </div>
  )
}
