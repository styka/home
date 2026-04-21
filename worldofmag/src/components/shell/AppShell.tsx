import { ModuleSidebar } from "./ModuleSidebar";

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="flex h-screen overflow-hidden" style={{ backgroundColor: "var(--bg-base)" }}>
      <ModuleSidebar />
      <main className="flex-1 overflow-hidden flex flex-col min-w-0">
        {children}
      </main>
    </div>
  );
}
