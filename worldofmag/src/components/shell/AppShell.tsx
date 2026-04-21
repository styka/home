import { ModuleSidebar } from "./ModuleSidebar";
import { Sparkles } from "lucide-react";

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  return (
    <div
      className="flex flex-col md:flex-row h-screen overflow-hidden"
      style={{ backgroundColor: "var(--bg-base)" }}
    >
      {/* Mobile-only top bar */}
      <div
        className="md:hidden flex items-center gap-2 px-4 h-11 border-b flex-shrink-0"
        style={{ backgroundColor: "var(--bg-surface)", borderColor: "var(--border)" }}
      >
        <Sparkles size={14} style={{ color: "var(--accent-purple)" }} />
        <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
          WorldOfMag
        </span>
      </div>

      {/* Desktop sidebar — hidden on mobile */}
      <ModuleSidebar />

      <main className="flex-1 overflow-hidden flex flex-col min-w-0">
        {children}
      </main>
    </div>
  );
}
