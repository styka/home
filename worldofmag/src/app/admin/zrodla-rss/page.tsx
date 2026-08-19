import { redirect } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { auth } from "@/platform/auth/session";
import { hasPermission, PERMISSIONS } from "@/platform/auth/permissions";
import { getCatalogEntries } from "@/actions/adminNewsCatalog";
import { NewsSourceCatalogManager } from "@/components/admin/NewsSourceCatalogManager";

/**
 * 082 — systemowa biblioteka źródeł RSS (`/admin/zrodla-rss`).
 *
 * Trasa jest cienka jak reszta panelu: sesja → uprawnienie → dane → render. Bramkowanie idzie
 * przez `PERMISSIONS.ADMIN` dokładnie tak, jak w sąsiednim `/admin/categories` — słownik systemowy
 * ma jednego edytora, więc nowy slug `module.*` byłby uprawnieniem bez własnego modułu.
 */
export default async function AdminZrodlaRssPage() {
  const t = await getTranslations("app.admin.zrodlaRss");
  const session = await auth();
  if (!hasPermission(session, PERMISSIONS.ADMIN)) redirect("/");

  const entries = await getCatalogEntries();

  return (
    <div className="flex-1 overflow-y-auto bg-[var(--bg-base)] px-6 py-8">
      <div className="mx-auto max-w-4xl">
        <Link
          href="/admin"
          className="mb-6 inline-flex items-center gap-1 text-xs text-[var(--text-muted)] no-underline hover:text-[var(--text-primary)]"
        >
          <ChevronLeft size={14} />
          {t("panelAdmina")}
        </Link>

        <h1 className="mb-1 text-xl font-semibold text-[var(--text-primary)]">{t("tytul")}</h1>
        <p className="mb-5 text-sm text-[var(--text-secondary)]">{t("opis")}</p>

        <NewsSourceCatalogManager initial={entries} />
      </div>
    </div>
  );
}
