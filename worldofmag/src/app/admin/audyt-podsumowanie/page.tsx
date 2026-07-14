export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import { markdownToHtml } from "@/lib/markdown";
import {
  AUDYT_PODSUMOWANIE_CHAPTERS,
  AUDYT_PODSUMOWANIE_META,
  AUDYT_PODSUMOWANIE_GENERATED_AT,
} from "@/generated/audyt-podsumowanie-book";
import { AudytBookReader } from "@/components/admin/AudytBookReader";

// „Analiza / Audyt stanu projektu Omnia — podsumowanie zmian": osobna, dwurozdziałowa
// książka admina (Co wykonano / Co pozostało) — samodzielna baza do kolejnego etapu
// prac poaudytowych. Reużywa czytnik z /admin/audyt (basePath przekierowuje linki tutaj).
export default async function AdminAudytPodsumowaniePage({
  searchParams,
}: {
  searchParams: { r?: string };
}) {
  const session = await auth();
  if (!hasPermission(session, PERMISSIONS.ADMIN)) redirect("/");

  const activeIndex = Math.max(
    0,
    AUDYT_PODSUMOWANIE_CHAPTERS.findIndex((c) => c.slug === searchParams.r),
  );
  const active = AUDYT_PODSUMOWANIE_CHAPTERS[activeIndex] ?? AUDYT_PODSUMOWANIE_CHAPTERS[0];

  const activeHtml = active && active.markdown.trim() ? markdownToHtml(active.markdown) : "";

  const toc = AUDYT_PODSUMOWANIE_CHAPTERS.map((c) => ({
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
      meta={AUDYT_PODSUMOWANIE_META}
      toc={toc}
      activeSlug={active?.slug ?? ""}
      activeHtml={activeHtml}
      activeStatus={active?.status ?? "planned"}
      generatedAt={AUDYT_PODSUMOWANIE_GENERATED_AT}
      basePath="/admin/audyt-podsumowanie"
      sourceLabel="content/audyt-podsumowanie/*.md"
    />
  );
}
