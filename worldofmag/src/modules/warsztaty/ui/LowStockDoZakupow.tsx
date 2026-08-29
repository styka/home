"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { ShoppingCart, Check, Loader2 } from "lucide-react";
import { getLists } from "@/modules/shopping/contract";
import { addWorkshopLowStockToShoppingList } from "../actions/warsztat";

/**
 * 115 (Z-INT-04): pasek „dodaj braki do listy zakupów" w agendzie przeglądów.
 *
 * Osobny komponent kliencki, bo `MaintenanceAgenda` jest serwerowa i ma taka zostać —
 * interakcja (wybór listy + przycisk) to jedyny fragment, który potrzebuje stanu.
 * Bez list zakupów (albo bez dostępu do Zakupów) pasek się nie pokazuje — cichy zapas.
 */
export function LowStockDoZakupow() {
  const t = useTranslations("modules.warsztaty.LowStockDoZakupow");
  const [listy, setListy] = useState<Array<{ id: string; name: string }> | null>(null);
  const [listaId, setListaId] = useState("");
  const [stan, setStan] = useState<"spoczynek" | "praca" | "ok" | "blad">("spoczynek");
  const [dodano, setDodano] = useState(0);

  useEffect(() => {
    getLists()
      .then((l) => {
        setListy(l.map((x) => ({ id: x.id, name: x.name })));
        if (l.length) setListaId(l[0].id);
      })
      .catch(() => setListy([]));
  }, []);

  if (!listy || listy.length === 0) return null;

  function dodaj() {
    if (stan === "praca") return;
    setStan("praca");
    addWorkshopLowStockToShoppingList(listaId)
      .then((r) => {
        setDodano(r.added);
        setStan("ok");
      })
      .catch(() => setStan("blad"));
  }

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <select
        value={listaId}
        onChange={(e) => {
          setListaId(e.target.value);
          setStan("spoczynek");
        }}
        aria-label={t("lista")}
        className="rounded border px-2 py-1.5 text-xs"
        style={{ backgroundColor: "var(--bg-base)", borderColor: "var(--border)", color: "var(--text-primary)" }}
      >
        {listy.map((l) => (
          <option key={l.id} value={l.id}>{l.name}</option>
        ))}
      </select>
      <button
        type="button"
        onClick={dodaj}
        disabled={stan === "praca"}
        className="inline-flex items-center gap-1.5 rounded border px-2.5 py-1.5 text-xs disabled:opacity-50"
        style={{
          borderColor: "var(--border)",
          backgroundColor: "var(--bg-surface)",
          color: stan === "ok" ? "var(--accent-green)" : "var(--text-primary)",
        }}
      >
        {stan === "praca" ? (
          <Loader2 size={13} className="animate-spin" />
        ) : stan === "ok" ? (
          <Check size={13} />
        ) : (
          <ShoppingCart size={13} />
        )}
        {stan === "ok" ? t("dodano", { n: dodano }) : t("dodajBraki")}
      </button>
      {stan === "blad" && (
        <span role="status" className="text-xs" style={{ color: "var(--accent-red)" }}>
          {t("blad")}
        </span>
      )}
    </div>
  );
}
