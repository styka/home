"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Wallet } from "lucide-react";
import { getWalletElements } from "@/actions/portfel";

export function PortfelSideNav() {
  const pathname = usePathname();
  const [elements, setElements] = useState<{ id: string; name: string }[]>([]);
  const [hovered, setHovered] = useState<string | null>(null);

  useEffect(() => {
    getWalletElements()
      .then((els) => setElements(els.filter((e) => !e.archived).map((e) => ({ id: e.id, name: e.name }))))
      .catch(() => {});
  }, [pathname]);

  function itemStyle(active: boolean, key: string) {
    return {
      paddingLeft: 40, paddingTop: 5, paddingBottom: 5, paddingRight: 8,
      backgroundColor: active ? "var(--bg-elevated)" : hovered === key ? "var(--bg-hover)" : undefined,
      color: active ? "var(--text-primary)" : "var(--text-muted)",
    };
  }

  if (elements.length === 0) return null;

  return (
    <div className="pb-2">
      {elements.map((el) => (
        <Link
          key={el.id}
          href={`/portfel/${el.id}`}
          onMouseEnter={() => setHovered(el.id)}
          onMouseLeave={() => setHovered(null)}
          className="flex items-center gap-2 mx-2 rounded text-xs"
          style={itemStyle(pathname === `/portfel/${el.id}`, el.id)}
        >
          <Wallet size={12} /> {el.name}
        </Link>
      ))}
    </div>
  );
}
