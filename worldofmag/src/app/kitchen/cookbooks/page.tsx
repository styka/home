import { BookOpen } from "lucide-react";

export const dynamic = "force-dynamic";

export default function KitchenCookbooksPage() {
  return (
    <div className="flex flex-col items-center justify-center h-full px-6 py-16 text-center">
      <BookOpen size={48} style={{ color: "var(--text-muted)" }} />
      <h2 className="mt-4 text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
        Książki kucharskie
      </h2>
      <p className="mt-2 max-w-md text-sm" style={{ color: "var(--text-secondary)" }}>
        Wkrótce — Faza 1. Grupowanie przepisów w kolekcje.
      </p>
    </div>
  );
}
