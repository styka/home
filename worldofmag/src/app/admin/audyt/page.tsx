export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import { markdownToHtml } from "@/lib/markdown";
import {
  AUDYT_CHAPTERS,
  AUDYT_META,
  AUDYT_GENERATED_AT,
} from "@/generated/audyt-book";
import { AudytBookReader } from "@/components/admin/AudytBookReader";

export default async function AdminAudytPage({
  searchParams,
}: {
  searchParams: { r?: string };
}) {
  const session = await auth();
  if (!hasPermission(session, PERMISSIONS.ADMIN)) redirect("/");

  // Active chapter from ?r=slug (default: first / title page).
  const activeIndex = Math.max(
    0,
    AUDYT_CHAPTERS.findIndex((c) => c.slug === searchParams.r),
  );
  const active = AUDYT_CHAPTERS[activeIndex] ?? AUDYT_CHAPTERS[0];

  // Render only the active chapter server-side (small payload, SSR, safe path).
  const activeHtml =
    active && active.markdown.trim()
      ? markdownToHtml(active.markdown)
      : "";

  // Metadata-only TOC for the client (no markdown shipped to the browser).
  const toc = AUDYT_CHAPTERS.map((c) => ({
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
      meta={AUDYT_META}
      toc={toc}
      activeSlug={active?.slug ?? ""}
      activeHtml={activeHtml}
      activeStatus={active?.status ?? "planned"}
      generatedAt={AUDYT_GENERATED_AT}
    />
  );
}
