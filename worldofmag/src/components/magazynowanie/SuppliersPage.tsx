"use client";

import { useState, useTransition } from "react";
import { Plus, Truck, Trash2, Pencil, Mail, Phone, X } from "lucide-react";
import { addSupplier, updateSupplier, deleteSupplier } from "@/actions/storage";
import { useToast } from "@/components/ui/Toast";
import type { StorageSupplier } from "@prisma/client";

const inputStyle: React.CSSProperties = {
  backgroundColor: "var(--bg-elevated)",
  borderColor: "var(--border)",
  color: "var(--text-primary)",
};

export function SuppliersPage({ suppliers }: { suppliers: StorageSupplier[] }) {
  const { showToast } = useToast();
  const [editing, setEditing] = useState<StorageSupplier | "new" | null>(null);

  return (
    <div className="px-4 md:px-6 py-4 max-w-2xl mx-auto flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
          <Truck size={20} style={{ color: "var(--accent-blue)" }} /> Dostawcy
        </h2>
        <button type="button" onClick={() => setEditing("new")} className="inline-flex items-center gap-1.5 px-3 py-2 rounded text-sm" style={{ backgroundColor: "var(--accent-blue)", color: "#0d0d0d" }}>
          <Plus size={16} /> Dodaj
        </button>
      </div>

      {suppliers.length === 0 ? (
        <p className="text-sm py-8 text-center" style={{ color: "var(--text-muted)" }}>
          Brak dostawców. Dodaj pierwszego — przyda się przy dokumentach i zamówieniach.
        </p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {suppliers.map((s) => (
            <li key={s.id} className="flex items-center gap-3 px-3 py-2.5 rounded border" style={{ backgroundColor: "var(--bg-surface)", borderColor: "var(--border)" }}>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>{s.name}</div>
                <div className="flex items-center gap-3 text-xs" style={{ color: "var(--text-secondary)" }}>
                  {s.contact ? <span className="truncate">{s.contact}</span> : null}
                  {s.email ? <span className="inline-flex items-center gap-1"><Mail size={11} />{s.email}</span> : null}
                  {s.phone ? <span className="inline-flex items-center gap-1"><Phone size={11} />{s.phone}</span> : null}
                </div>
              </div>
              <button type="button" onClick={() => setEditing(s)} aria-label="Edytuj" style={{ color: "var(--text-muted)" }}><Pencil size={15} /></button>
            </li>
          ))}
        </ul>
      )}

      {editing ? (
        <SupplierEditor
          supplier={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onToast={showToast}
        />
      ) : null}
    </div>
  );
}

function SupplierEditor({
  supplier,
  onClose,
  onToast,
}: {
  supplier: StorageSupplier | null;
  onClose: () => void;
  onToast: (m: string, t: "success" | "error") => void;
}) {
  const [name, setName] = useState(supplier?.name ?? "");
  const [contact, setContact] = useState(supplier?.contact ?? "");
  const [email, setEmail] = useState(supplier?.email ?? "");
  const [phone, setPhone] = useState(supplier?.phone ?? "");
  const [notes, setNotes] = useState(supplier?.notes ?? "");
  const [pending, startTransition] = useTransition();

  function save() {
    if (!name.trim()) {
      onToast("Nazwa jest wymagana", "error");
      return;
    }
    const payload = { name: name.trim(), contact: contact.trim() || null, email: email.trim() || null, phone: phone.trim() || null, notes: notes.trim() || null };
    startTransition(async () => {
      try {
        if (supplier) await updateSupplier(supplier.id, payload);
        else await addSupplier(payload);
        onToast("Zapisano", "success");
        onClose();
      } catch (e) {
        onToast(e instanceof Error ? e.message : "Błąd", "error");
      }
    });
  }

  function remove() {
    if (!supplier || !confirm("Usunąć dostawcę?")) return;
    startTransition(async () => {
      try {
        await deleteSupplier(supplier.id);
        onToast("Usunięto", "success");
        onClose();
      } catch (e) {
        onToast(e instanceof Error ? e.message : "Błąd", "error");
      }
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center" style={{ backgroundColor: "rgba(0,0,0,0.6)" }} onClick={onClose}>
      <div className="w-full md:w-[440px] md:rounded border p-4 flex flex-col gap-3" style={{ backgroundColor: "var(--bg-surface)", borderColor: "var(--border)", borderTopLeftRadius: 12, borderTopRightRadius: 12 }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="font-semibold" style={{ color: "var(--text-primary)" }}>{supplier ? "Edytuj dostawcę" : "Nowy dostawca"}</h3>
          <button onClick={onClose} style={{ color: "var(--text-muted)" }}><X size={18} /></button>
        </div>
        <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Nazwa" className="px-3 py-2 rounded border text-sm" style={inputStyle} />
        <input value={contact} onChange={(e) => setContact(e.target.value)} placeholder="Osoba kontaktowa" className="px-3 py-2 rounded border text-sm" style={inputStyle} />
        <div className="grid grid-cols-2 gap-2">
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="E-mail" className="px-3 py-2 rounded border text-sm" style={inputStyle} />
          <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Telefon" className="px-3 py-2 rounded border text-sm" style={inputStyle} />
        </div>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notatki" rows={2} className="px-3 py-2 rounded border text-sm resize-none" style={inputStyle} />
        <div className="flex items-center justify-between">
          {supplier ? (
            <button type="button" onClick={remove} disabled={pending} className="inline-flex items-center gap-1 text-xs" style={{ color: "var(--accent-red)" }}><Trash2 size={14} /> Usuń</button>
          ) : <span />}
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="px-3 py-1.5 rounded text-sm" style={{ color: "var(--text-secondary)" }}>Anuluj</button>
            <button onClick={save} disabled={pending} className="px-3 py-1.5 rounded text-sm disabled:opacity-50" style={{ backgroundColor: "var(--accent-blue)", color: "#0d0d0d" }}>Zapisz</button>
          </div>
        </div>
      </div>
    </div>
  );
}
