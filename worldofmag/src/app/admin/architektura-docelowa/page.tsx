export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import { markdownToHtml } from "@/lib/markdown";
import {
  ARCHITEKTURA_CHAPTERS,
  ARCHITEKTURA_META,
  ARCHITEKTURA_PROMPT,
  ARCHITEKTURA_GENERATED_AT,
} from "@/generated/architektura-book";
import { AudytBookReader } from "@/components/admin/AudytBookReader";

/**
 * „Omnia 🧐 — architektura docelowa": czternastorozdziałowa książka admina opisująca stan,
 * jaki ma powstać po przebudowie architektonicznej.
 *
 * Treść jest **częścią kodu źródłowego** (`content/architektura/*.md` → `scripts/copy-architektura.js`
 * → `src/generated/architektura-book.ts`), a nie danymi w bazie — dzięki temu wersjonuje się razem
 * z kodem, który opisuje, i nie wymaga migracji przy każdej poprawce.
 *
 * Świadomie pod adresem `architektura-docelowa`, a NIE `architecture`: ta druga trasa istnieje
 * i pokazuje drzewo bieżącej struktury aplikacji. Dwie trasy różniące się tylko językiem nazwy
 * byłyby pułapką.
 *
 * Reużywa czytnik z `/admin/audyt` (`basePath` przekierowuje linki tutaj) i dokłada `copyPrompt` —
 * ikonę kopiowania całego dokumentu opakowanego w prompt uruchamiający spec-driven pipeline.
 */
export default async function AdminArchitekturaDocelowaPage({
  searchParams,
}: {
  searchParams: { r?: string };
}) {
  const session = await auth();
  if (!hasPermission(session, PERMISSIONS.ADMIN)) redirect("/");

  const activeIndex = Math.max(
    0,
    ARCHITEKTURA_CHAPTERS.findIndex((c) => c.slug === searchParams.r),
  );
  const active = ARCHITEKTURA_CHAPTERS[activeIndex] ?? ARCHITEKTURA_CHAPTERS[0];

  const activeHtml = active && active.markdown.trim() ? markdownToHtml(active.markdown) : "";

  const toc = ARCHITEKTURA_CHAPTERS.map((c) => ({
    slug: c.slug,
    number: c.number,
    part: c.part,
    title: c.title,
    summary: c.summary,
    status: c.status,
    words: c.words,
  }));

  return (
    <AudytBookReader
      meta={ARCHITEKTURA_META}
      toc={toc}
      activeSlug={active?.slug ?? ""}
      activeHtml={activeHtml}
      activeStatus={active?.status ?? "planned"}
      generatedAt={ARCHITEKTURA_GENERATED_AT}
      basePath="/admin/architektura-docelowa"
      sourceLabel="content/architektura/*.md"
      copyPrompt={ARCHITEKTURA_PROMPT}
      copyPromptLabel="Kopiuj cały dokument jako prompt uruchamiający spec-driven pipeline"
    />
  );
}
