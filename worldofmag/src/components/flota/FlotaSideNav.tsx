"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Car } from "lucide-react";
import { getVehicles } from "@/actions/flota";

export function FlotaSideNav() {
  const pathname = usePathname();
  const [vehicles, setVehicles] = useState<{ id: string; name: string }[]>([]);
  const [hovered, setHovered] = useState<string | null>(null);

  useEffect(() => {
    getVehicles().then((vs) => setVehicles(vs.map((v) => ({ id: v.id, name: v.name })))).catch(() => {});
  }, [pathname]);

  function itemStyle(active: boolean, key: string) {
    return {
      paddingLeft: 40, paddingTop: 5, paddingBottom: 5, paddingRight: 8,
      backgroundColor: active ? "var(--bg-elevated)" : hovered === key ? "var(--bg-hover)" : undefined,
      color: active ? "var(--text-primary)" : "var(--text-muted)",
    };
  }

  if (vehicles.length === 0) return null;

  return (
    <div className="pb-2">
      {vehicles.map((v) => (
        <Link
          key={v.id}
          href={`/flota/${v.id}`}
          onMouseEnter={() => setHovered(v.id)}
          onMouseLeave={() => setHovered(null)}
          className="flex items-center gap-2 mx-2 rounded text-xs"
          style={itemStyle(pathname === `/flota/${v.id}`, v.id)}
        >
          <Car size={12} /> {v.name}
        </Link>
      ))}
    </div>
  );
}
