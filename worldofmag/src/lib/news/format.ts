// Drobne helpery prezentacji wiadomości (bezpieczne dla klienta).

export function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  const diffMin = Math.max(0, Math.round((Date.now() - then) / 60000));
  if (diffMin < 1) return "przed chwilą";
  if (diffMin < 60) return `${diffMin} min temu`;
  const h = Math.floor(diffMin / 60);
  if (h < 24) return `${h} godz. temu`;
  const d = Math.floor(h / 24);
  return `${d} dni temu`;
}

export const SUMMARY_LENGTHS: { key: "short" | "medium" | "long"; label: string }[] = [
  { key: "short", label: "Krótkie" },
  { key: "medium", label: "Średnie" },
  { key: "long", label: "Szczegółowe" },
];
