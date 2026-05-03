import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"

export default async function AdminPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/auth/signin")
  if ((session.user as { role?: string }).role !== "ADMIN") redirect("/")

  const [userCount, listCount, itemCount, teamCount, actionCount] = await Promise.all([
    prisma.user.count(),
    prisma.shoppingList.count(),
    prisma.item.count(),
    prisma.team.count(),
    prisma.action.count(),
  ])

  const recentUsers = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    take: 10,
    select: { id: true, name: true, email: true, role: true, createdAt: true, image: true },
  })

  return (
    <div style={{ padding: "32px", maxWidth: 800 }}>
      <h1 style={{ color: "var(--text-primary)", fontSize: 20, fontWeight: 600, marginBottom: 32 }}>
        Panel administratora
      </h1>

      {/* Stats grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
          gap: 12,
          marginBottom: 40,
        }}
      >
        {[
          { label: "Użytkownicy", value: userCount },
          { label: "Listy zakupów", value: listCount },
          { label: "Produkty", value: itemCount },
          { label: "Teamy", value: teamCount },
          { label: "Akcje", value: actionCount },
        ].map(({ label, value }) => (
          <div
            key={label}
            style={{
              background: "var(--bg-surface)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              padding: "16px 20px",
            }}
          >
            <div style={{ color: "var(--text-primary)", fontSize: 28, fontWeight: 700 }}>{value}</div>
            <div style={{ color: "var(--text-muted)", fontSize: 12, marginTop: 4 }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Recent users */}
      <section>
        <h2 style={{ color: "var(--text-primary)", fontSize: 16, fontWeight: 600, marginBottom: 16 }}>
          Ostatni użytkownicy
        </h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
          {recentUsers.map((user) => (
            <div
              key={user.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "10px 16px",
                background: "var(--bg-surface)",
                border: "1px solid var(--border)",
                borderRadius: 6,
              }}
            >
              {user.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={user.image}
                  alt=""
                  style={{ width: 32, height: 32, borderRadius: "50%", objectFit: "cover" }}
                />
              ) : (
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: "50%",
                    background: "var(--bg-elevated)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "var(--text-muted)",
                    fontSize: 13,
                  }}
                >
                  {(user.name ?? user.email ?? "?")[0].toUpperCase()}
                </div>
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ color: "var(--text-primary)", fontSize: 13, fontWeight: 500 }}>
                  {user.name ?? "(bez nazwy)"}
                </div>
                <div style={{ color: "var(--text-muted)", fontSize: 12 }}>{user.email}</div>
              </div>
              <div
                style={{
                  fontSize: 11,
                  padding: "2px 8px",
                  borderRadius: 4,
                  background: user.role === "ADMIN" ? "#7c3aed22" : "var(--bg-elevated)",
                  color: user.role === "ADMIN" ? "#a78bfa" : "var(--text-muted)",
                  border: `1px solid ${user.role === "ADMIN" ? "#7c3aed44" : "var(--border)"}`,
                }}
              >
                {user.role}
              </div>
              <div style={{ color: "var(--text-muted)", fontSize: 12, flexShrink: 0 }}>
                {new Date(user.createdAt).toLocaleDateString("pl-PL")}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
