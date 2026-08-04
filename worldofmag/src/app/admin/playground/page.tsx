import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import { FlaskConical, ChevronLeft } from "lucide-react";
import Link from "next/link";
import { PlaygroundPage } from "@/components/admin/playground/PlaygroundPage";
import { listAvailableSkins } from "@/actions/skins";

export default async function AdminPlaygroundPage() {
  const session = await auth();
  if (!hasPermission(session, PERMISSIONS.ADMIN)) redirect("/");

  // Skórki pobieramy na serwerze, żeby przełącznik w playgroundzie mógł pokazać każdy
  // komponent w każdym motywie — to jest główny powód, dla którego ta galeria istnieje:
  // sprawdzić, czy skórka niczego nie psuje, ZANIM ktoś ją włączy.
  const skins = await listAvailableSkins().catch(() => []);

  return (
    <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column", backgroundColor: "var(--bg-base)" }}>
      <div style={{ padding: "12px var(--view-padding)", borderBottom: "var(--border-width) var(--border-style) var(--border)", flexShrink: 0 }}>
        <Link
          href="/admin"
          style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12, color: "var(--text-muted)", textDecoration: "none", marginBottom: 8 }}
        >
          <ChevronLeft size={14} />
          Admin
        </Link>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <FlaskConical size={16} style={{ color: "var(--accent-purple)" }} />
          <div>
            <h1 style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)", margin: 0 }}>
              Galeria komponentów
            </h1>
            <p style={{ fontSize: 11, color: "var(--text-muted)", margin: 0 }}>
              Interaktywne demonstracje wspólnych komponentów — z podglądem w każdej skórce
            </p>
          </div>
        </div>
      </div>

      <div style={{ flex: 1, overflow: "hidden", display: "flex" }}>
        <PlaygroundPage skins={skins.map((s) => ({ id: s.id, name: s.name, tokens: s.tokens }))} />
      </div>
    </div>
  );
}
