"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTransition } from "react";
import {
  Boxes,
  Search,
  Camera,
  ClipboardList,
  QrCode,
  ScanLine,
  BarChart3,
  Truck,
  ShoppingBag,
  FileText,
  Settings,
  Home,
  Building2,
} from "lucide-react";
import { setStorageMode, type StorageMode } from "@/actions/storage";

interface Tab {
  href: string;
  label: string;
  icon: typeof Boxes;
  pro?: boolean;
}

const TABS: Tab[] = [
  { href: "/magazynowanie", label: "Rzeczy", icon: Boxes },
  { href: "/magazynowanie/szukaj", label: "Szukaj", icon: Search },
  { href: "/magazynowanie/przeplyw", label: "Przyjmij/Wydaj", icon: ScanLine, pro: true },
  { href: "/magazynowanie/scan", label: "Skan zdjęcia", icon: Camera },
  { href: "/magazynowanie/stocktake", label: "Spis", icon: ClipboardList },
  { href: "/magazynowanie/analityka", label: "Analityka", icon: BarChart3, pro: true },
  { href: "/magazynowanie/dostawcy", label: "Dostawcy", icon: Truck, pro: true },
  { href: "/magazynowanie/zamowienia", label: "Zamówienia", icon: ShoppingBag, pro: true },
  { href: "/magazynowanie/dokumenty", label: "Dokumenty", icon: FileText, pro: true },
  { href: "/magazynowanie/etykiety", label: "Etykiety QR", icon: QrCode },
  { href: "/magazynowanie/ustawienia", label: "Ustawienia", icon: Settings },
];

export function StorageNav({ mode, children }: { mode: StorageMode; children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const tabs = TABS.filter((t) => !t.pro || mode === "pro");

  function toggleMode() {
    const next: StorageMode = mode === "pro" ? "home" : "pro";
    startTransition(async () => {
      await setStorageMode(next);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <header
        className="flex-shrink-0 border-b"
        style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-surface)" }}
      >
        <div className="hidden md:flex items-center justify-between gap-2 px-6 py-3">
          <div className="flex items-center gap-2">
            <Boxes size={20} style={{ color: "var(--accent-blue)" }} />
            <h1 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
              Magazynowanie
            </h1>
          </div>
          <button
            type="button"
            onClick={toggleMode}
            disabled={pending}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs border disabled:opacity-50"
            style={{
              borderColor: "var(--border)",
              backgroundColor: "var(--bg-elevated)",
              color: mode === "pro" ? "var(--accent-purple)" : "var(--accent-green)",
            }}
            title="Przełącz tryb Dom ↔ Profesjonalny"
          >
            {mode === "pro" ? <Building2 size={13} /> : <Home size={13} />}
            {mode === "pro" ? "Profesjonalny" : "Dom"}
          </button>
        </div>
        <nav className="flex items-center gap-1 px-3 md:px-6 py-1 overflow-x-auto">
          {tabs.map(({ href, label, icon: Icon }) => {
            const isActive =
              href === "/magazynowanie"
                ? pathname === href
                : pathname === href || pathname.startsWith(href + "/");
            return (
              <Link
                key={href}
                href={href}
                className="flex items-center gap-2 px-3 py-2 rounded text-sm whitespace-nowrap"
                style={{
                  backgroundColor: isActive ? "var(--bg-elevated)" : "transparent",
                  color: isActive ? "var(--accent-blue)" : "var(--text-secondary)",
                }}
              >
                <Icon size={16} />
                {label}
              </Link>
            );
          })}
        </nav>
      </header>
      <div className="flex-1 overflow-y-auto">{children}</div>
    </div>
  );
}
