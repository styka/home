"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, PawPrint } from "lucide-react";
import { getPets } from "@/actions/pets";
import { speciesEmoji } from "@/lib/petSpecies";
import type { Pet } from "@/types";

export function PetsSideNav() {
  const pathname = usePathname();
  const [pets, setPets] = useState<Pet[]>([]);
  const [hovered, setHovered] = useState<string | null>(null);

  useEffect(() => {
    getPets().then(setPets).catch(() => {});
  }, []);

  function itemStyle(active: boolean, key: string) {
    return {
      paddingLeft: 40, paddingTop: 5, paddingBottom: 5, paddingRight: 8,
      backgroundColor: active ? "var(--bg-elevated)" : hovered === key ? "var(--bg-hover)" : undefined,
      color: active ? "var(--text-primary)" : "var(--text-muted)",
    };
  }

  return (
    <div className="pb-2">
      <Link
        href="/pets/calendar"
        onMouseEnter={() => setHovered("cal")}
        onMouseLeave={() => setHovered(null)}
        className="flex items-center gap-2 mx-2 rounded text-xs"
        style={itemStyle(pathname === "/pets/calendar", "cal")}
      >
        <CalendarDays size={12} /> Kalendarz opieki
      </Link>

      <div className="mx-4 my-1" style={{ borderTop: "1px solid var(--border)" }} />

      {pets.length === 0 ? (
        <div className="flex items-center gap-2 mx-2 text-xs" style={{ paddingLeft: 40, paddingTop: 5, paddingBottom: 5, color: "var(--text-muted)" }}>
          <PawPrint size={12} /> Brak zwierząt
        </div>
      ) : (
        pets.map((p) => (
          <Link
            key={p.id}
            href={`/pets/${p.id}`}
            onMouseEnter={() => setHovered(p.id)}
            onMouseLeave={() => setHovered(null)}
            className="flex items-center gap-2 mx-2 rounded text-xs"
            style={itemStyle(pathname === `/pets/${p.id}`, p.id)}
          >
            <span>{speciesEmoji(p.species)}</span>
            <span className="flex-1 truncate">{p.name}</span>
          </Link>
        ))
      )}
    </div>
  );
}
