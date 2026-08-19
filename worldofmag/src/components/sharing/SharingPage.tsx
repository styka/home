"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { Share2, Users, User } from "lucide-react";
import { ModuleView } from "@/components/ui/view";
import type { SharedGrantRow } from "@/actions/sharing";

/**
 * 067 (zadanie 14, część odczytowa) — „Udostępnione mi" i „Co udostępniłem".
 *
 * Rozdz. 8.7: *„Widok »Udostępnione mi« jest możliwy tylko dzięki jednolitemu modelowi — przy
 * pięciu mechanizmach wymagałby pięciu zapytań i pięciu formatów."* Ten ekran jest wypłatą
 * za całą Fazę 2: **jedna lista, wszystkie moduły**.
 */

const ROLE_PL: Record<string, string> = {
  viewer: "podgląd",
  commenter: "komentowanie",
  editor: "edycja",
  manager: "zarządzanie",
};

function Lista({ wiersze, pusty }: { wiersze: SharedGrantRow[]; pusty: string }) {
  if (wiersze.length === 0) {
    return (
      <p className="text-sm px-4 py-8 text-center" style={{ color: "var(--text-muted)" }}>
        {pusty}
      </p>
    );
  }
  return (
    <div className="flex flex-col">
      {wiersze.map((w) => (
        <div
          key={w.id}
          className="flex items-center gap-3 px-4 py-3 border-b"
          style={{ borderColor: "var(--border)" }}
        >
          <span
            className="text-xs px-2 py-0.5 rounded flex-shrink-0"
            style={{ backgroundColor: "var(--bg-elevated)", color: "var(--text-secondary)" }}
          >
            {w.resourceLabel}
          </span>
          <span className="flex-1 text-sm truncate" style={{ color: "var(--text-primary)" }}>
            {w.subjectLabel ?? "—"}
          </span>
          <span className="flex items-center gap-1 text-xs" style={{ color: "var(--text-muted)" }}>
            {w.subjectType === "workspace" ? <Users size={12} /> : <User size={12} />}
            {ROLE_PL[w.role] ?? w.role}
          </span>
          {w.expiresAt && (
            <span className="text-xs" style={{ color: "var(--accent-amber)" }}>
              do {new Date(w.expiresAt).toLocaleDateString("pl-PL")}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

export function SharingPage({
  doMnie,
  odeMnie,
}: {
  doMnie: SharedGrantRow[];
  odeMnie: SharedGrantRow[];
}) {
  const t = useTranslations("components.sharing.SharingPage");
  const [zakladka, setZakladka] = useState<"doMnie" | "odeMnie">("doMnie");

  return (
    <ModuleView
      width="narrow"
      state="ready"
      icon={<Share2 size={22} />}
      iconColor="var(--accent-blue)"
      title={t("udostepnianie")}
      href="/udostepnione"
      subtitle="Jedno miejsce dla wszystkich modułów — kto ma dostęp do czego."
      filters={
        <div className="flex gap-1">
          {(
            [
              ["doMnie", `Udostępnione mi (${doMnie.length})`],
              ["odeMnie", `Co udostępniłem (${odeMnie.length})`],
            ] as const
          ).map(([klucz, etykieta]) => (
            <button
              key={klucz}
              onClick={() => setZakladka(klucz)}
              className="text-xs px-3 py-1.5 rounded"
              style={{
                backgroundColor: zakladka === klucz ? "var(--accent-blue)" : "var(--bg-elevated)",
                color: zakladka === klucz ? "var(--on-accent)" : "var(--text-secondary)",
              }}
            >
              {etykieta}
            </button>
          ))}
        </div>
      }
    >
      {zakladka === "doMnie" ? (
        <Lista
          wiersze={doMnie}
          pusty="Nikt nie udostępnił Ci jeszcze żadnego zasobu."
        />
      ) : (
        <Lista
          wiersze={odeMnie}
          pusty="Nie udostępniasz nikomu żadnego ze swoich zasobów."
        />
      )}
      <p className="text-xs px-4 py-4" style={{ color: "var(--text-muted)" }}>
        {t("odwolywanieDostepuJednymKliknieciem")}
      </p>
    </ModuleView>
  );
}
