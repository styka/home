import { Package } from "lucide-react";

export const dynamic = "force-dynamic";

export default function KitchenPantryPage() {
  return (
    <div className="flex flex-col items-center justify-center h-full px-6 py-16 text-center">
      <Package size={48} style={{ color: "var(--text-muted)" }} />
      <h2 className="mt-4 text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
        Spiżarnia
      </h2>
      <p className="mt-2 max-w-md text-sm" style={{ color: "var(--text-secondary)" }}>
        Wkrótce — Faza 3. Stan magazynu, terminy ważności, auto-uzupełnianie.
      </p>
    </div>
  );
}
