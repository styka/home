import { redirect } from "next/navigation";
import { auth } from "@/platform/auth/session";
import { TasksRouteView } from "@/modules/tasks/ui/TasksRouteView";

export const dynamic = "force-dynamic";

interface Props {
  params: { projectId: string };
  // 043: `tags`, `groupBy` i `layout` to stan widoku czytany przez `useViewState` po stronie
  // klienta — serwer tylko podaje je dalej. `status` służy obu rzeczom naraz (wejście z linku
  // ORAZ zapamiętany filtr), dlatego nie dokładamy drugiego parametru o tym samym znaczeniu.
  searchParams?: Record<string, string | undefined>;
}

export default async function TaskProjectPage({ params, searchParams }: Props) {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/signin");

  /**
   * 080 (Z3): ZGODNOŚĆ WSTECZ dla starego widoku wielu projektów.
   *
   * `/tasks/multi` liczył zakres z parametrów zapytania i właśnie dlatego pustoszał po każdej
   * mutacji. Zamiast go łatać, przenieśliśmy zakres do segmentu ścieżki — a stare adresy
   * przekierowujemy, bo właściciel ma je w ulubionych widokach (`FavoriteView.path`) i w linkach
   * paska bocznego. Przekierowanie zachowuje pozostałe parametry: filtry, otwarte zadanie i układ
   * to osobny stan widoku i nie mają powodu ginąć przy zmianie adresu.
   */
  if (params.projectId === "multi") {
    const { group, view, projects, ...reszta } = searchParams ?? {};
    const ogon = new URLSearchParams(
      Object.entries(reszta).filter((e): e is [string, string] => typeof e[1] === "string")
    ).toString();
    const przyrostek = ogon ? `?${ogon}` : "";

    // Zapisany zestaw → własna trasa z zakresem w ścieżce (`?view=` to alias sprzed 043).
    const zestaw = group ?? view;
    if (zestaw) redirect(`/tasks/zestaw/${zestaw}${przyrostek}`);

    // Doraźny wybór projektów → widok zbiorczy z filtrem projektów po stronie klienta.
    // Kluczowa różnica: utrata tego parametru pokazuje WSZYSTKIE projekty, a nie żaden.
    const wybrane = (projects ?? "").split(",").map((s) => s.trim()).filter(Boolean);
    const parametry = new URLSearchParams(
      Object.entries(reszta).filter((e): e is [string, string] => typeof e[1] === "string")
    );
    if (wybrane.length > 0) parametry.set("projekty", wybrane.join(","));
    const zapytanie = parametry.toString();
    redirect(`/tasks/all${zapytanie ? `?${zapytanie}` : ""}`);
  }

  return <TasksRouteView projectId={params.projectId} searchParams={searchParams} />;
}
