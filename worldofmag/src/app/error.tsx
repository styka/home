"use client";

import { useEffect } from "react";
import { ErrorState } from "@/components/ui/ErrorState";
import { reportClientError } from "@/lib/observability/report";

/**
 * Z-111: granica błędu segmentu (App Router). Łapie błędy renderowania/akcji w
 * obrębie układu i pokazuje spójny stan zamiast białego ekranu. `reset()` ponawia
 * render segmentu. Błąd raportujemy do warstwy observability (Z-090).
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    reportClientError(error, { source: "route-error-boundary" });
  }, [error]);

  return (
    <div style={{ flex: 1, display: "flex", backgroundColor: "var(--bg-base)" }}>
      <ErrorState onRetry={reset} digest={error.digest} />
    </div>
  );
}
