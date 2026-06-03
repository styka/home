"use client";

import { useMemo, useState } from "react";
import { Search, Sparkles, MapPin, Loader2, PackageSearch } from "lucide-react";
import { llm } from "@/lib/llm-client";
import { useToast } from "@/components/ui/Toast";
import type { StorageItemWithMovements } from "@/actions/storage";

interface StorageSearchProps {
  items: StorageItemWithMovements[];
  initialLocation?: string;
}

export function StorageSearch({ items, initialLocation }: StorageSearchProps) {
  const { showToast } = useToast();
  const [query, setQuery] = useState(initialLocation ?? "");
  const [aiIds, setAiIds] = useState<string[] | null>(null);
  const [loading, setLoading] = useState(false);

  // Zwykłe dopasowanie tekstowe (natychmiastowe).
  const textMatches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((i) =>
      `${i.name} ${i.sku ?? ""} ${i.barcode ?? ""} ${i.category ?? ""} ${i.warehouse ?? ""} ${i.location ?? ""}`
        .toLowerCase()
        .includes(q)
    );
  }, [items, query]);

  const aiMatches = useMemo(() => {
    if (!aiIds) return null;
    const byId = new Map(items.map((i) => [i.id, i]));
    return aiIds.map((id) => byId.get(id)).filter(Boolean) as StorageItemWithMovements[];
  }, [aiIds, items]);

  async function askAI() {
    if (!query.trim()) return;
    setLoading(true);
    setAiIds(null);
    try {
      const res = await llm.magazynowanie.search({
        query: query.trim(),
        items: items.map((i) => ({ id: i.id, name: i.name, category: i.category })),
      });
      if (res.unavailable) {
        showToast("AI niedostępne — pokazuję dopasowanie tekstowe", "error");
        return;
      }
      setAiIds(res.ids ?? []);
    } catch {
      showToast("Błąd wyszukiwania AI", "error");
    } finally {
      setLoading(false);
    }
  }

  const results = aiMatches ?? textMatches;

  return (
    <div className="px-4 md:px-6 py-4 max-w-2xl mx-auto flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-semibold mb-1" style={{ color: "var(--text-primary)" }}>
          Gdzie to jest?
        </h2>
        <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
          Wpisz, czego szukasz — pokażę magazyn i lokalizację. Zapytaj naturalnie („gdzie mam ładowarkę do wiertarki”) i użyj AI.
        </p>
      </div>

      <div className="flex items-center gap-2">
        <div className="flex items-center gap-2 flex-1 px-3 py-2.5 rounded border" style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-surface)" }}>
          <Search size={16} style={{ color: "var(--text-muted)" }} />
          <input
            autoFocus
            value={query}
            onChange={(e) => { setQuery(e.target.value); setAiIds(null); }}
            onKeyDown={(e) => e.key === "Enter" && askAI()}
            placeholder="np. śrubokręt krzyżakowy, kable USB…"
            className="flex-1 bg-transparent outline-none text-sm"
            style={{ color: "var(--text-primary)" }}
          />
        </div>
        <button
          type="button"
          onClick={askAI}
          disabled={loading || !query.trim()}
          className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded text-sm disabled:opacity-50"
          style={{ backgroundColor: "var(--accent-purple)", color: "#fff" }}
        >
          {loading ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />} AI
        </button>
      </div>

      {aiMatches ? (
        <p className="text-xs" style={{ color: "var(--accent-purple)" }}>
          Wyniki AI ({aiMatches.length}). <button type="button" className="underline" onClick={() => setAiIds(null)}>pokaż dopasowanie tekstowe</button>
        </p>
      ) : null}

      {results.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center gap-2">
          <PackageSearch size={40} style={{ color: "var(--text-muted)" }} />
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>Nic nie znaleziono.</p>
        </div>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {results.map((i) => (
            <li
              key={i.id}
              className="flex items-center gap-3 px-3 py-2.5 rounded border"
              style={{ backgroundColor: "var(--bg-surface)", borderColor: "var(--border)" }}
            >
              {i.photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={i.photoUrl} alt="" className="w-10 h-10 rounded object-cover flex-shrink-0" />
              ) : null}
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>{i.name}</div>
                <div className="flex items-center gap-1 text-xs" style={{ color: "var(--text-secondary)" }}>
                  <MapPin size={11} style={{ color: "var(--text-muted)" }} />
                  {i.warehouse?.trim() || "Bez magazynu"}
                  {i.location ? ` · ${i.location}` : ""}
                </div>
              </div>
              <span className="text-xs tabular-nums whitespace-nowrap" style={{ color: "var(--text-secondary)" }}>
                {i.quantity != null ? `${i.quantity}${i.unit ? ` ${i.unit}` : ""}` : "—"}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
