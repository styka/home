"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, Plus, Trash2, Pencil, Check, X, Wrench, Lightbulb, ClipboardList,
  AlertTriangle, CalendarClock, User, Users,
} from "lucide-react";
import {
  addWorkshopItem, updateWorkshopItem, deleteWorkshopItem, addSuggestedItems,
  deleteWorkshop, addWorkshopProject, updateWorkshopProject, deleteWorkshopProject,
  type WorkshopDetail as WorkshopDetailType, type WarsztatMode,
} from "@/actions/warsztat";
import {
  getWorkshopType, getSuggestions, KIND_LABELS, TIER_LABELS, CONDITION_LABELS,
  type EquipmentKind, type EquipmentTier,
} from "@/lib/warsztat/catalog";

type Tab = "equipment" | "suggestions" | "projects";

const KIND_ORDER: EquipmentKind[] = ["tool", "machine", "consumable", "safety", "material"];
const TIER_ORDER: EquipmentTier[] = ["essential", "recommended", "advanced"];

export function WorkshopDetail({ workshop, mode }: { workshop: WorkshopDetailType; mode: WarsztatMode }) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("equipment");
  const wt = getWorkshopType(workshop.type);

  const tabs: Array<{ id: Tab; label: string; icon: typeof Wrench }> = [
    { id: "equipment", label: "Wyposażenie", icon: Wrench },
    { id: "suggestions", label: "Podpowiedzi", icon: Lightbulb },
    ...(mode === "pro" ? [{ id: "projects" as Tab, label: "Projekty", icon: ClipboardList }] : []),
  ];

  return (
    <div className="px-4 md:px-6 py-6 max-w-4xl mx-auto">
      <Link href="/warsztaty" className="inline-flex items-center gap-1 text-sm mb-4" style={{ color: "var(--text-muted)" }}>
        <ArrowLeft size={15} /> Warsztaty
      </Link>

      <div className="flex items-start justify-between mb-5">
        <div className="flex items-center gap-3">
          <span className="text-3xl" aria-hidden>{wt.emoji}</span>
          <div>
            <h1 className="text-xl font-semibold" style={{ color: "var(--text-primary)" }}>{workshop.name}</h1>
            <div className="text-xs mt-0.5 flex items-center gap-2" style={{ color: "var(--text-muted)" }}>
              <span>{wt.label}</span>
              {workshop.location ? <span>· {workshop.location}</span> : null}
              {workshop.ownerTeamId ? (
                <span className="inline-flex items-center gap-1"><Users size={12} /> zespół</span>
              ) : null}
            </div>
          </div>
        </div>
        <DeleteWorkshopButton id={workshop.id} onDeleted={() => router.push("/warsztaty")} />
      </div>

      <div className="flex items-center gap-1 border-b mb-5" style={{ borderColor: "var(--border)" }}>
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm -mb-px border-b-2"
            style={{
              borderColor: tab === id ? "var(--accent-amber)" : "transparent",
              color: tab === id ? "var(--text-primary)" : "var(--text-secondary)",
            }}
          >
            <Icon size={15} /> {label}
          </button>
        ))}
      </div>

      {tab === "equipment" ? <EquipmentTab workshop={workshop} pro={mode === "pro"} /> : null}
      {tab === "suggestions" ? <SuggestionsTab workshop={workshop} /> : null}
      {tab === "projects" && mode === "pro" ? <ProjectsTab workshop={workshop} /> : null}
    </div>
  );
}

// ─── Usuwanie warsztatu ───────────────────────────────────────────────────────

function DeleteWorkshopButton({ id, onDeleted }: { id: string; onDeleted: () => void }) {
  const [confirm, setConfirm] = useState(false);
  const [pending, startTransition] = useTransition();
  if (!confirm) {
    return (
      <button type="button" onClick={() => setConfirm(true)} className="p-2 rounded" style={{ color: "var(--text-muted)" }} title="Usuń warsztat">
        <Trash2 size={16} />
      </button>
    );
  }
  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        disabled={pending}
        onClick={() => startTransition(async () => { await deleteWorkshop(id); onDeleted(); })}
        className="px-2 py-1 rounded text-xs disabled:opacity-50"
        style={{ backgroundColor: "var(--accent-red)", color: "var(--on-accent)" }}
      >
        Usuń
      </button>
      <button type="button" onClick={() => setConfirm(false)} className="px-2 py-1 rounded text-xs" style={{ color: "var(--text-muted)" }}>
        Anuluj
      </button>
    </div>
  );
}

// ─── Zakładka: Wyposażenie ────────────────────────────────────────────────────

const EMPTY_ITEM = {
  name: "", kind: "tool", category: "", quantity: "", unit: "", minQuantity: "",
  condition: "good", brand: "", station: "", assignedTo: "", nextServiceAt: "", notes: "",
};
type ItemForm = typeof EMPTY_ITEM;

function EquipmentTab({ workshop, pro }: { workshop: WorkshopDetailType; pro: boolean }) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const grouped = useMemo(() => {
    const map = new Map<EquipmentKind, typeof workshop.items>();
    for (const it of workshop.items) {
      const k = (KIND_ORDER.includes(it.kind as EquipmentKind) ? it.kind : "tool") as EquipmentKind;
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(it);
    }
    return map;
  }, [workshop.items]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => { setAdding(true); setEditingId(null); }}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-sm"
          style={{ backgroundColor: "var(--bg-elevated)", color: "var(--text-primary)", border: "1px solid var(--border)" }}
        >
          <Plus size={15} /> Dodaj pozycję
        </button>
      </div>

      {adding ? (
        <ItemEditor workshopId={workshop.id} pro={pro} onClose={() => setAdding(false)} />
      ) : null}

      {workshop.items.length === 0 && !adding ? (
        <p className="text-sm py-6 text-center" style={{ color: "var(--text-muted)" }}>
          Brak wyposażenia. Dodaj ręcznie lub skorzystaj z zakładki „Podpowiedzi”.
        </p>
      ) : null}

      {KIND_ORDER.filter((k) => grouped.has(k)).map((kind) => (
        <section key={kind}>
          <h3 className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: "var(--text-muted)" }}>
            {KIND_LABELS[kind]}
          </h3>
          <div className="flex flex-col gap-1.5">
            {grouped.get(kind)!.map((it) =>
              editingId === it.id ? (
                <ItemEditor
                  key={it.id}
                  workshopId={workshop.id}
                  pro={pro}
                  item={it}
                  onClose={() => setEditingId(null)}
                />
              ) : (
                <EquipmentRow key={it.id} item={it} pro={pro} onEdit={() => { setEditingId(it.id); setAdding(false); }} />
              )
            )}
          </div>
        </section>
      ))}
    </div>
  );
}

const CONDITION_COLOR: Record<string, string> = {
  new: "var(--accent-green)", good: "var(--accent-blue)", worn: "var(--accent-amber)", broken: "var(--accent-red)",
};

function EquipmentRow({ item, pro, onEdit }: { item: WorkshopDetailType["items"][number]; pro: boolean; onEdit: () => void }) {
  const [pending, startTransition] = useTransition();
  const low = item.minQuantity != null && (item.quantity ?? 0) < item.minQuantity;
  const dueSoon = item.nextServiceAt != null;
  return (
    <div
      className="flex items-center gap-3 px-3 py-2 rounded border"
      style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-surface)" }}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm truncate" style={{ color: "var(--text-primary)" }}>{item.name}</span>
          {item.status === "wishlist" ? (
            <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ backgroundColor: "var(--bg-elevated)", color: "var(--text-muted)" }}>do kupienia</span>
          ) : null}
          <span
            className="text-[10px] px-1.5 py-0.5 rounded"
            style={{ backgroundColor: "var(--bg-elevated)", color: CONDITION_COLOR[item.condition] ?? "var(--text-muted)" }}
          >
            {CONDITION_LABELS[item.condition] ?? item.condition}
          </span>
        </div>
        <div className="text-xs flex flex-wrap items-center gap-x-2 mt-0.5" style={{ color: "var(--text-muted)" }}>
          {item.quantity != null ? <span>{item.quantity}{item.unit ? ` ${item.unit}` : ""}</span> : null}
          {item.brand ? <span>· {item.brand}</span> : null}
          {item.category ? <span>· {item.category}</span> : null}
          {pro && item.station ? <span>· {item.station}</span> : null}
          {pro && item.assignedTo ? (
            <span className="inline-flex items-center gap-0.5"><User size={11} /> {item.assignedTo}</span>
          ) : null}
          {low ? (
            <span className="inline-flex items-center gap-0.5" style={{ color: "var(--accent-red)" }}>
              <AlertTriangle size={11} /> mało (min {item.minQuantity})
            </span>
          ) : null}
          {dueSoon ? (
            <span className="inline-flex items-center gap-0.5" style={{ color: "var(--accent-amber)" }}>
              <CalendarClock size={11} /> przegląd {new Date(item.nextServiceAt!).toLocaleDateString("pl-PL")}
            </span>
          ) : null}
        </div>
      </div>
      <button type="button" onClick={onEdit} className="p-1.5 rounded" style={{ color: "var(--text-muted)" }} title="Edytuj">
        <Pencil size={14} />
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={() => startTransition(async () => { await deleteWorkshopItem(item.id); })}
        className="p-1.5 rounded disabled:opacity-50"
        style={{ color: "var(--text-muted)" }}
        title="Usuń"
      >
        <Trash2 size={14} />
      </button>
    </div>
  );
}

function ItemEditor({
  workshopId, pro, item, onClose,
}: {
  workshopId: string;
  pro: boolean;
  item?: WorkshopDetailType["items"][number];
  onClose: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [f, setF] = useState<ItemForm>(() =>
    item
      ? {
          name: item.name, kind: item.kind, category: item.category ?? "",
          quantity: item.quantity?.toString() ?? "", unit: item.unit ?? "",
          minQuantity: item.minQuantity?.toString() ?? "", condition: item.condition,
          brand: item.brand ?? "", station: item.station ?? "", assignedTo: item.assignedTo ?? "",
          nextServiceAt: item.nextServiceAt ? new Date(item.nextServiceAt).toISOString().slice(0, 10) : "",
          notes: item.notes ?? "",
        }
      : { ...EMPTY_ITEM }
  );

  function set<K extends keyof ItemForm>(k: K, v: ItemForm[K]) {
    setF((prev) => ({ ...prev, [k]: v }));
  }

  function save() {
    if (!f.name.trim()) return;
    const payload = {
      name: f.name,
      kind: f.kind,
      category: f.category || null,
      quantity: f.quantity === "" ? null : Number(f.quantity),
      unit: f.unit || null,
      minQuantity: f.minQuantity === "" ? null : Number(f.minQuantity),
      condition: f.condition,
      brand: f.brand || null,
      station: f.station || null,
      assignedTo: f.assignedTo || null,
      nextServiceAt: f.nextServiceAt || null,
      notes: f.notes || null,
    };
    startTransition(async () => {
      if (item) await updateWorkshopItem(item.id, payload);
      else await addWorkshopItem(workshopId, payload);
      onClose();
    });
  }

  const inputStyle = { backgroundColor: "var(--bg-base)", borderColor: "var(--border)", color: "var(--text-primary)" };

  return (
    <div className="rounded-lg border p-3 flex flex-col gap-2" style={{ borderColor: "var(--accent-amber)", backgroundColor: "var(--bg-surface)" }}>
      <input
        autoFocus value={f.name} onChange={(e) => set("name", e.target.value)} placeholder="Nazwa pozycji"
        className="w-full px-2.5 py-1.5 rounded text-sm border outline-none" style={inputStyle}
      />
      <div className="grid grid-cols-2 gap-2">
        <select value={f.kind} onChange={(e) => set("kind", e.target.value)} className="px-2.5 py-1.5 rounded text-sm border outline-none" style={inputStyle}>
          {KIND_ORDER.map((k) => <option key={k} value={k}>{KIND_LABELS[k]}</option>)}
        </select>
        <select value={f.condition} onChange={(e) => set("condition", e.target.value)} className="px-2.5 py-1.5 rounded text-sm border outline-none" style={inputStyle}>
          {Object.entries(CONDITION_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <input value={f.category} onChange={(e) => set("category", e.target.value)} placeholder="Kategoria" className="px-2.5 py-1.5 rounded text-sm border outline-none" style={inputStyle} />
        <input value={f.brand} onChange={(e) => set("brand", e.target.value)} placeholder="Marka / model" className="px-2.5 py-1.5 rounded text-sm border outline-none" style={inputStyle} />
        <input value={f.quantity} onChange={(e) => set("quantity", e.target.value)} placeholder="Ilość" inputMode="decimal" className="px-2.5 py-1.5 rounded text-sm border outline-none" style={inputStyle} />
        <input value={f.unit} onChange={(e) => set("unit", e.target.value)} placeholder="Jednostka (szt, l, m)" className="px-2.5 py-1.5 rounded text-sm border outline-none" style={inputStyle} />
        <input value={f.minQuantity} onChange={(e) => set("minQuantity", e.target.value)} placeholder="Stan min. (low-stock)" inputMode="decimal" className="px-2.5 py-1.5 rounded text-sm border outline-none" style={inputStyle} />
        <input type="date" value={f.nextServiceAt} onChange={(e) => set("nextServiceAt", e.target.value)} title="Następny przegląd" className="px-2.5 py-1.5 rounded text-sm border outline-none" style={inputStyle} />
        {pro ? (
          <>
            <input value={f.station} onChange={(e) => set("station", e.target.value)} placeholder="Stanowisko / miejsce" className="px-2.5 py-1.5 rounded text-sm border outline-none" style={inputStyle} />
            <input value={f.assignedTo} onChange={(e) => set("assignedTo", e.target.value)} placeholder="Przypisane do (kto ma)" className="px-2.5 py-1.5 rounded text-sm border outline-none" style={inputStyle} />
          </>
        ) : null}
      </div>
      <div className="flex items-center justify-end gap-1.5 mt-1">
        <button type="button" onClick={onClose} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded text-sm" style={{ color: "var(--text-muted)" }}>
          <X size={14} /> Anuluj
        </button>
        <button type="button" onClick={save} disabled={pending || !f.name.trim()} className="inline-flex items-center gap-1 px-3 py-1.5 rounded text-sm disabled:opacity-50" style={{ backgroundColor: "var(--accent-amber)", color: "var(--on-accent)" }}>
          <Check size={14} /> Zapisz
        </button>
      </div>
    </div>
  );
}

// ─── Zakładka: Podpowiedzi ────────────────────────────────────────────────────

function SuggestionsTab({ workshop }: { workshop: WorkshopDetailType }) {
  const [pending, startTransition] = useTransition();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const suggestions = getSuggestions(workshop.type);
  const ownedKeys = useMemo(
    () => new Set(workshop.items.map((i) => i.suggestionKey).filter(Boolean) as string[]),
    [workshop.items]
  );

  function toggle(key: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  function addSelected() {
    if (selected.size === 0) return;
    startTransition(async () => {
      await addSuggestedItems(workshop.id, Array.from(selected));
      setSelected(new Set());
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
        Sprzęt, który warto mieć w warsztacie typu <strong>{getWorkshopType(workshop.type).label}</strong>. Zaznacz braki i dodaj je do wyposażenia jednym kliknięciem.
      </p>

      {TIER_ORDER.map((tier) => {
        const items = suggestions.filter((s) => s.tier === tier);
        if (items.length === 0) return null;
        return (
          <section key={tier}>
            <h3 className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: "var(--text-muted)" }}>
              {TIER_LABELS[tier]}
            </h3>
            <div className="grid sm:grid-cols-2 gap-1.5">
              {items.map((s) => {
                const owned = ownedKeys.has(s.key);
                const checked = selected.has(s.key);
                return (
                  <button
                    key={s.key}
                    type="button"
                    disabled={owned}
                    onClick={() => toggle(s.key)}
                    className="flex items-center gap-2 px-3 py-2 rounded border text-left disabled:opacity-60"
                    style={{
                      borderColor: checked ? "var(--accent-amber)" : "var(--border)",
                      backgroundColor: checked ? "var(--bg-elevated)" : "var(--bg-surface)",
                    }}
                  >
                    <span
                      className="w-4 h-4 rounded flex items-center justify-center flex-shrink-0 border"
                      style={{
                        borderColor: owned ? "var(--accent-green)" : checked ? "var(--accent-amber)" : "var(--border)",
                        backgroundColor: owned ? "var(--accent-green)" : checked ? "var(--accent-amber)" : "transparent",
                      }}
                    >
                      {(owned || checked) ? <Check size={11} style={{ color: "var(--on-accent)" }} /> : null}
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="text-sm block truncate" style={{ color: "var(--text-primary)" }}>{s.name}</span>
                      <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                        {KIND_LABELS[s.kind]} · {s.category}{owned ? " · masz" : ""}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        );
      })}

      {selected.size > 0 ? (
        <div className="sticky bottom-0 pt-2">
          <button
            type="button"
            onClick={addSelected}
            disabled={pending}
            className="w-full py-2.5 rounded text-sm font-medium disabled:opacity-50"
            style={{ backgroundColor: "var(--accent-amber)", color: "var(--on-accent)" }}
          >
            Dodaj zaznaczone do wyposażenia ({selected.size})
          </button>
        </div>
      ) : null}
    </div>
  );
}

// ─── Zakładka: Projekty (Pro) ─────────────────────────────────────────────────

const PROJECT_STATUS_LABELS: Record<string, string> = { planned: "Planowany", active: "W toku", done: "Zakończony" };
const PROJECT_STATUS_COLOR: Record<string, string> = { planned: "var(--text-muted)", active: "var(--accent-blue)", done: "var(--accent-green)" };

function ProjectsTab({ workshop }: { workshop: WorkshopDetailType }) {
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [assignedTo, setAssignedTo] = useState("");

  function add() {
    if (!name.trim()) return;
    startTransition(async () => {
      await addWorkshopProject(workshop.id, { name, assignedTo: assignedTo || null });
      setName("");
      setAssignedTo("");
    });
  }

  const inputStyle = { backgroundColor: "var(--bg-base)", borderColor: "var(--border)", color: "var(--text-primary)" };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col sm:flex-row gap-2">
        <input value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} placeholder="Nowy projekt / zlecenie" className="flex-1 px-3 py-2 rounded text-sm border outline-none" style={inputStyle} />
        <input value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)} placeholder="Odpowiedzialny" className="sm:w-44 px-3 py-2 rounded text-sm border outline-none" style={inputStyle} />
        <button type="button" onClick={add} disabled={pending || !name.trim()} className="inline-flex items-center justify-center gap-1 px-3 py-2 rounded text-sm disabled:opacity-50" style={{ backgroundColor: "var(--accent-amber)", color: "var(--on-accent)" }}>
          <Plus size={15} /> Dodaj
        </button>
      </div>

      {workshop.projects.length === 0 ? (
        <p className="text-sm py-4 text-center" style={{ color: "var(--text-muted)" }}>Brak projektów. Dodaj zlecenie realizowane w tym warsztacie.</p>
      ) : (
        <div className="flex flex-col gap-1.5">
          {workshop.projects.map((p) => (
            <div key={p.id} className="flex items-center gap-3 px-3 py-2 rounded border" style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-surface)" }}>
              <div className="flex-1 min-w-0">
                <span className="text-sm block truncate" style={{ color: "var(--text-primary)" }}>{p.name}</span>
                <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                  {p.assignedTo ? `${p.assignedTo} · ` : ""}{p.dueAt ? `termin ${new Date(p.dueAt).toLocaleDateString("pl-PL")}` : "bez terminu"}
                </span>
              </div>
              <select
                value={p.status}
                onChange={(e) => startTransition(async () => { await updateWorkshopProject(p.id, { status: e.target.value }); })}
                className="px-2 py-1 rounded text-xs border outline-none"
                style={{ ...inputStyle, color: PROJECT_STATUS_COLOR[p.status] }}
              >
                {Object.entries(PROJECT_STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
              <button type="button" onClick={() => startTransition(async () => { await deleteWorkshopProject(p.id); })} className="p-1.5 rounded" style={{ color: "var(--text-muted)" }} title="Usuń">
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
