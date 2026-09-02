import { useTranslations } from "next-intl";
import Link from "next/link";
import { CalendarClock, AlertTriangle, PackageOpen } from "lucide-react";
import type { MaintenanceOverview } from "../actions/warsztat";
import { LowStockDoZakupow } from "./LowStockDoZakupow";

export function MaintenanceAgenda({ overview }: { overview: MaintenanceOverview }) {
  const t = useTranslations("modules.warsztaty.MaintenanceAgenda");
  const { due, lowStock } = overview;

  return (
    <div className="px-4 md:px-6 py-6 max-w-3xl mx-auto flex flex-col gap-6">
      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide mb-3 flex items-center gap-2" style={{ color: "var(--text-muted)" }}>
          <CalendarClock size={15} /> {t("przegladyISerwis30")}
        </h2>
        {due.length === 0 ? (
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>{t("brakZaplanowanychPrzegladow")}</p>
        ) : (
          <div className="flex flex-col gap-1.5">
            {due.map((i) => (
              <Link
                key={i.id}
                href={`/warsztaty/${i.workshopId}`}
                className="flex items-center gap-3 px-3 py-2 rounded border"
                style={{ borderColor: i.overdue ? "var(--accent-red)" : "var(--border)", backgroundColor: "var(--bg-surface)" }}
              >
                <div className="flex-1 min-w-0">
                  <span className="text-sm block truncate" style={{ color: "var(--text-primary)" }}>{i.name}</span>
                  <span className="text-xs" style={{ color: "var(--text-muted)" }}>{i.workshopName}</span>
                </div>
                <span
                  className="text-xs inline-flex items-center gap-1 whitespace-nowrap"
                  style={{ color: i.overdue ? "var(--accent-red)" : "var(--accent-amber)" }}
                >
                  {i.overdue ? <AlertTriangle size={13} /> : <CalendarClock size={13} />}
                  {i.nextServiceAt ? new Date(i.nextServiceAt).toLocaleDateString("pl-PL") : ""}
                  {i.overdue ? " · zaległy" : ""}
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide mb-3 flex items-center gap-2" style={{ color: "var(--text-muted)" }}>
          <PackageOpen size={15} /> {t("materialyNaWyczerpaniu")}
        </h2>
        {lowStock.length === 0 ? (
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>{t("wszystkieMaterialyPowyzejStanu")}</p>
        ) : (
          <div className="flex flex-col gap-1.5">
            {lowStock.map((i) => (
              <Link
                key={i.id}
                href={`/warsztaty/${i.workshopId}`}
                className="flex items-center gap-3 px-3 py-2 rounded border"
                style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-surface)" }}
              >
                <div className="flex-1 min-w-0">
                  <span className="text-sm block truncate" style={{ color: "var(--text-primary)" }}>{i.name}</span>
                  <span className="text-xs" style={{ color: "var(--text-muted)" }}>{i.workshopName}</span>
                </div>
                <span className="text-xs inline-flex items-center gap-1" style={{ color: "var(--accent-red)" }}>
                  <AlertTriangle size={13} /> {i.quantity ?? 0}{i.unit ? ` ${i.unit}` : ""} / min {i.minQuantity}
                </span>
              </Link>
            ))}
          </div>
        )}
        {/* 115 (Z-INT-04): braki → lista zakupów; pasek pokazuje się tylko przy brakach i listach. */}
        {lowStock.length > 0 && <LowStockDoZakupow />}
      </section>
    </div>
  );
}
