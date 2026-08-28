"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, CalendarCheck, ClipboardList, Sprout } from "lucide-react";
import { getSpaces, type PrzestrzenDTO } from "../actions/przestrzenie";
import { trybZawodowy } from "../lib/tryb";

/**
 * 113 — nawigacja boczna modułu.
 *
 * Poniżej stałych pozycji stoją **przestrzenie użytkownika**, bo to one są tu jednostką pracy —
 * dokładnie tak, jak w Zwierzętach listą są zwierzęta. „Ewidencja zabiegów" pokazuje się tylko
 * wtedy, gdy użytkownik ma choć jedną przestrzeń zawodową: pozycja prowadząca do pustego rejestru
 * jest w mieszkaniu szumem, a nie funkcją.
 */
export function RoslinySideNav() {
  const t = useTranslations("modules.rosliny.SideNav");
  const pathname = usePathname();
  const [przestrzenie, setPrzestrzenie] = useState<PrzestrzenDTO[]>([]);
  const [hovered, setHovered] = useState<string | null>(null);

  useEffect(() => {
    getSpaces().then(setPrzestrzenie).catch(() => {});
  }, []);

  const maZawodowa = przestrzenie.some((p) => trybZawodowy(p.kind));

  function itemStyle(active: boolean, key: string) {
    return {
      paddingLeft: 40,
      paddingTop: 5,
      paddingBottom: 5,
      paddingRight: 8,
      backgroundColor: active ? "var(--bg-elevated)" : hovered === key ? "var(--bg-hover)" : undefined,
      color: active ? "var(--text-primary)" : "var(--text-muted)",
    };
  }

  return (
    <div className="pb-2">
      <Link
        href="/rosliny/opieka"
        onMouseEnter={() => setHovered("opieka")}
        onMouseLeave={() => setHovered(null)}
        className="flex items-center gap-2 mx-2 rounded text-xs"
        style={itemStyle(pathname === "/rosliny/opieka", "opieka")}
      >
        <CalendarCheck size={12} /> {t("opieka")}
      </Link>
      <Link
        href="/rosliny/katalog"
        onMouseEnter={() => setHovered("katalog")}
        onMouseLeave={() => setHovered(null)}
        className="flex items-center gap-2 mx-2 rounded text-xs"
        style={itemStyle(pathname === "/rosliny/katalog", "katalog")}
      >
        <BookOpen size={12} /> {t("katalog")}
      </Link>
      {maZawodowa && (
        <Link
          href="/rosliny/ewidencja"
          onMouseEnter={() => setHovered("ewidencja")}
          onMouseLeave={() => setHovered(null)}
          className="flex items-center gap-2 mx-2 rounded text-xs"
          style={itemStyle(pathname === "/rosliny/ewidencja", "ewidencja")}
        >
          <ClipboardList size={12} /> {t("ewidencja")}
        </Link>
      )}

      <div className="mx-4 my-1" style={{ borderTop: "1px solid var(--border)" }} />

      {przestrzenie.length === 0 ? (
        <div
          className="flex items-center gap-2 mx-2 text-xs"
          style={{ paddingLeft: 40, paddingTop: 5, paddingBottom: 5, color: "var(--text-muted)" }}
        >
          <Sprout size={12} /> {t("brakPrzestrzeni")}
        </div>
      ) : (
        przestrzenie.map((p) => (
          <Link
            key={p.id}
            href={`/rosliny/${p.id}`}
            onMouseEnter={() => setHovered(p.id)}
            onMouseLeave={() => setHovered(null)}
            className="flex items-center gap-2 mx-2 rounded text-xs"
            style={itemStyle(pathname === `/rosliny/${p.id}`, p.id)}
          >
            <Sprout size={12} />
            <span className="flex-1 truncate">{p.name}</span>
            <span style={{ color: "var(--text-muted)" }}>{p.liczbaRoslin}</span>
          </Link>
        ))
      )}
    </div>
  );
}
