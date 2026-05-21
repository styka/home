import { BookMarked } from "lucide-react";

export const dynamic = "force-dynamic";

export default function KitchenRecipesPage() {
  return (
    <div className="flex flex-col items-center justify-center h-full px-6 py-16 text-center">
      <BookMarked size={48} style={{ color: "var(--text-muted)" }} />
      <h2 className="mt-4 text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
        Przepisy
      </h2>
      <p className="mt-2 max-w-md text-sm" style={{ color: "var(--text-secondary)" }}>
        Wkrótce — Faza 1. Biblioteka przepisów z filtrami i tagami.
      </p>
    </div>
  );
}
