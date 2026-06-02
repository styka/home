"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Save } from "lucide-react";
import { bulkSetStorageQuantities } from "@/actions/storage";
import { useToast } from "@/components/ui/Toast";
import type { StorageItemWithMovements } from "@/actions/storage";

interface StockTakeModeProps {
  items: StorageItemWithMovements[];
}

const NO_WAREHOUSE = "Bez magazynu";

export function StockTakeMode({ items }: StockTakeModeProps) {
  const router = useRouter();
  const { showToast } = useToast();
  const [pending, startTransition] = useTransition();
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(items.map((i) => [i.id, i.quantity?.toString() ?? ""]))
  );

  const grouped = items.reduce<Record<string, StorageItemWithMovements[]>>((acc, i) => {
    const wh = i.warehouse?.trim() || NO_WAREHOUSE;
    if (!acc[wh]) acc[wh] = [];
    acc[wh].push(i);
    return acc;
  }, {});

  function handleSave() {
    const updates = Object.entries(values)
      .map(([id, v]) => ({ id, quantity: v === "" ? null : Number(v) }))
      .filter((u) => {
        const original = items.find((i) => i.id === u.id);
        return original && original.quantity !== u.quantity;
      });
    if (updates.length === 0) {
      showToast("Brak zmian do zapisania", "info");
      return;
    }
    startTransition(async () => {
      try {
        await bulkSetStorageQuantities(updates);
        showToast(`Zaktualizowano ${updates.length} pozycji`, "success");
        router.push("/magazynowanie");
      } catch (e) {
        showToast(e instanceof Error ? e.message : "Błąd zapisu", "error");
      }
    });
  }

  return (
    <div className="px-4 md:px-6 py-4 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <button
          type="button"
          onClick={() => router.back()}
          className="inline-flex items-center gap-1 text-sm"
          style={{ color: "var(--text-secondary)" }}
        >
          <ArrowLeft size={14} /> Anuluj
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={pending}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-sm disabled:opacity-50"
          style={{ backgroundColor: "var(--accent-blue)", color: "#0d0d0d" }}
        >
          <Save size={14} /> {pending ? "Zapisuję…" : "Zapisz wszystko"}
        </button>
      </div>

      <h1 className="text-lg font-semibold mb-1" style={{ color: "var(--text-primary)" }}>
        Spis magazynu
      </h1>
      <p className="text-sm mb-4" style={{ color: "var(--text-secondary)" }}>
        Wpisz aktualną ilość każdej pozycji. Zmiany trafią do dziennika ruchów jako korekta (spis).
      </p>

      <div className="flex flex-col gap-4">
        {Object.entries(grouped).map(([wh, list]) => (
          <section key={wh}>
            <h3 className="text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: "var(--text-muted)" }}>
              🏷️ {wh}
            </h3>
            <div className="flex flex-col gap-1">
              {list.map((i) => (
                <div
                  key={i.id}
                  className="flex items-center gap-2 px-3 py-2 rounded border"
                  style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-surface)" }}
                >
                  <span className="flex-1 min-w-0 truncate text-sm" style={{ color: "var(--text-primary)" }}>
                    {i.name}
                    {i.location ? <span style={{ color: "var(--text-muted)" }}> · {i.location}</span> : null}
                  </span>
                  <input
                    type="number"
                    step="any"
                    value={values[i.id] ?? ""}
                    onChange={(e) => setValues((prev) => ({ ...prev, [i.id]: e.target.value }))}
                    className="w-20 px-2 py-1 rounded border text-sm tabular-nums text-right"
                    style={{
                      backgroundColor: "var(--bg-elevated)",
                      borderColor: "var(--border)",
                      color: "var(--text-primary)",
                    }}
                  />
                  <span className="text-xs w-12" style={{ color: "var(--text-muted)" }}>
                    {i.unit ?? ""}
                  </span>
                </div>
              ))}
            </div>
          </section>
        ))}

        {items.length === 0 ? (
          <p className="text-sm text-center py-10" style={{ color: "var(--text-muted)" }}>
            Brak pozycji do spisu.
          </p>
        ) : null}
      </div>
    </div>
  );
}
