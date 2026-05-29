import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AppShell } from "@/components/shell/AppShell";
import { ServiceWorkerRegistration } from "@/components/ServiceWorkerRegistration";
import { auth } from "@/lib/auth";
import { getPendingInvitationsCount } from "@/actions/invitations";
import { APP_TITLE, ICON_VERSION } from "@/lib/appName";

export const viewport: Viewport = {
  themeColor: "#0d0d0d",
  width: "device-width",
  initialScale: 1,
  minimumScale: 1,
  viewportFit: "cover",
};

export const metadata: Metadata = {
  title: APP_TITLE,
  description: "Personal management system",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: APP_TITLE,
  },
  // Favicon (zakładka) i ikona iOS są generowane konwencją plikową:
  // src/app/icon.tsx oraz src/app/apple-icon.tsx (przezroczyste tło, kolor wg środowiska).
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const invitationCount = session?.user?.id
    ? await getPendingInvitationsCount().catch(() => 0)
    : 0;

  const userRoles: string[] = session?.user?.roles ?? [];
  const userPermissions: string[] = session?.user?.permissions ?? [];
  const isAdmin = userPermissions.includes("module.admin");

  return (
    <html lang="en" className="dark">
      <head>
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content={APP_TITLE} />
        {/* iOS cache'uje apple-touch-icon po SAMEJ ścieżce (ignoruje ?query), więc
            podajemy go pod wersjonowaną ścieżką /apple-touch-icon/<ICON_VERSION>.
            Podbij ICON_VERSION w appName.ts przy każdej zmianie wyglądu logo. */}
        <link rel="apple-touch-icon" href={`/apple-touch-icon/${ICON_VERSION}`} />
      </head>
      <body>
        <AppShell invitationCount={invitationCount} isAdmin={isAdmin} userRoles={userRoles} userPermissions={userPermissions}>{children}</AppShell>
        <ServiceWorkerRegistration />
      </body>
    </html>
  );
}
