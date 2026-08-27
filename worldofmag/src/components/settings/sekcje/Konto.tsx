import { auth, signOut } from "@/platform/auth/session";

/**
 * 109: sekcja „Konto" — profil i wylogowanie. Treść przeniesiona 1:1 z dawnej długiej strony;
 * nagłówek rysuje teraz rama widoku (C-33).
 */
export async function Konto() {
  const session = await auth();

  return (
    <div
      style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border)",
        borderRadius: 8,
        padding: "20px 24px",
        display: "flex",
        alignItems: "center",
        gap: 16,
      }}
    >
      {session?.user?.image && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={session.user.image}
          alt=""
          style={{ width: 48, height: 48, borderRadius: "50%", objectFit: "cover" }}
        />
      )}
      <div>
        <div style={{ color: "var(--text-primary)", fontWeight: 500 }}>{session?.user?.name}</div>
        <div style={{ color: "var(--text-muted)", fontSize: 13 }}>{session?.user?.email}</div>
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
            minHeight: 44,
          }}
        >
          Wyloguj
        </button>
      </form>
    </div>
  );
}
