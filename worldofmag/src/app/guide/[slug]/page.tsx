import { notFound, redirect } from "next/navigation";
import { auth } from "@/platform/auth/session";
import { markdownToHtml } from "@/lib/markdown";
import { przewodnikPoSlugu } from "@/lib/przewodniki";
import { PrzewodnikReader } from "@/components/guide/PrzewodnikReader";

/**
 * 108 — trasa jednego przewodnika. Cienka (C-36): sesja → treść → render.
 *
 * Bez uprawnienia modułowego: przewodnik jest dokumentacją, a nie danymi użytkownika — jak `/trash`
 * i `/reports` wystarczy zalogowanie. Uprawnienia liczy hub, żeby oznaczyć moduł, do którego
 * czytelnik nie ma dostępu; sama LEKTURA nie musi być za nie płatna.
 */
export default async function PrzewodnikPage({ params }: { params: { slug: string } }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/signin");

  const przewodnik = przewodnikPoSlugu(params.slug);
  if (!przewodnik) notFound();

  // Markdown → HTML po stronie SERWERA: do przeglądarki idzie gotowa treść, a nie treść plus
  // parser. Wyciąg tekstowy do wyszukiwania (`tekst`) zostaje tutaj — czytnik go nie potrzebuje.
  const rozdzialy = przewodnik.rozdzialy.map((r) => ({
    slug: r.slug,
    title: r.title,
    summary: r.summary,
    html: markdownToHtml(r.markdown),
  }));

  return (
    <PrzewodnikReader
      title={przewodnik.title}
      subtitle={przewodnik.subtitle}
      rozdzialy={rozdzialy}
      updatedAt={przewodnik.updatedAt}
    />
  );
}
